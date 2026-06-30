import { Form, redirect, useActionData, useLoaderData } from "react-router";
import { prisma } from "../lib/prisma.server";
import { getUserId } from "../lib/session.server";

function makeOrderNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toTimeString().slice(0, 8).replaceAll(":", "");
  return `G-${date}-${time}`;
}

async function getCurrentTenant(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: {
      tenant: true,
    },
  });

  if (!tenantUser) {
    throw redirect("/login");
  }

  return tenantUser.tenant;
}

export async function loader({ request }: { request: Request }) {
  const tenant = await getCurrentTenant(request);

  const orders = await prisma.order.findMany({
    where: {
      tenantId: tenant.id,
    },
    include: {
      customer: true,
      items: true,
      brand: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });

  const customers = await prisma.customer.findMany({
    where: {
      tenantId: tenant.id,
    },
    orderBy: {
      name: "asc",
    },
    take: 100,
  });

  return {
    tenant,
    orders,
    customers,
  };
}

export async function action({ request }: { request: Request }) {
  const tenant = await getCurrentTenant(request);
  const formData = await request.formData();

  const customerName = String(formData.get("customerName") || "").trim();
  const customerEmail = String(formData.get("customerEmail") || "").trim().toLowerCase();
  const customerPhone = String(formData.get("customerPhone") || "").trim();
  const eventName = String(formData.get("eventName") || "").trim();
  const deliveryDateRaw = String(formData.get("deliveryDate") || "").trim();
  const deliveryTimeText = String(formData.get("deliveryTimeText") || "").trim();
  const deliveryAddress = String(formData.get("deliveryAddress") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const contactPhone = String(formData.get("contactPhone") || "").trim();
  const source = String(formData.get("source") || "DIRECT").trim();
  const externalOrderNumber = String(formData.get("externalOrderNumber") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  const itemName = String(formData.get("itemName") || "").trim();
  const quantity = Number(formData.get("quantity") || 1);
  const unit = String(formData.get("unit") || "Portion").trim();
  const unitPriceEuro = String(formData.get("unitPriceEuro") || "0").replace(",", ".");
  const unitCents = Math.round(Number(unitPriceEuro || 0) * 100);
  const totalCents = Math.max(1, quantity || 1) * unitCents;

  if (!customerName || !deliveryDateRaw || !deliveryAddress || !itemName) {
    return {
      error: "Bitte mindestens Kunde, Lieferdatum, Lieferadresse und eine Position ausfüllen.",
    };
  }

  const deliveryDate = new Date(`${deliveryDateRaw}T00:00:00`);

  const result = await prisma.$transaction(async (tx) => {
    let customer = await tx.customer.findFirst({
      where: {
        tenantId: tenant.id,
        name: customerName,
      },
    });

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          tenantId: tenant.id,
          name: customerName,
          email: customerEmail || null,
          phone: customerPhone || null,
          address: deliveryAddress || null,
        },
      });
    }

    const order = await tx.order.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        orderNumber: makeOrderNumber(),
        externalOrderNumber: externalOrderNumber || null,
        source: source as any,
        status: "AUTO_CREATED",
        customerName,
        eventName: eventName || null,
        deliveryDate,
        deliveryTimeText: deliveryTimeText || null,
        deliveryAddress,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        notes: notes || null,
        totalCents,
        confidenceScore: 100,
        confidenceLabel: "HIGH",
        reviewReason: "Manuell erfasster echter Auftrag",
        items: {
          create: [
            {
              name: itemName,
              quantity: Math.max(1, quantity || 1),
              unit: unit || "Portion",
              unitCents,
              totalCents,
            },
          ],
        },
      },
      include: {
        items: true,
      },
    });

    return order;
  });

  return redirect(`/auftragseingang?created=${result.id}`);
}

export default function Auftragseingang() {
  const { orders, customers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="page">
      <style>{`
        .page {
          padding: 28px;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #0f172a;
          background: #f8fafc;
          min-height: 100vh;
        }

        .headline {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 22px;
        }

        h1 {
          font-size: 32px;
          margin: 0 0 6px;
          letter-spacing: -0.04em;
        }

        .sub {
          margin: 0;
          color: #64748b;
          font-weight: 650;
        }

        .grid {
          display: grid;
          grid-template-columns: minmax(360px, 480px) 1fr;
          gap: 22px;
          align-items: start;
        }

        .card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.07);
          padding: 22px;
        }

        .card h2 {
          margin: 0 0 16px;
          font-size: 20px;
        }

        form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 13px;
        }

        label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 850;
          color: #334155;
        }

        input, select, textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 11px 12px;
          background: #f8fafc;
          font-size: 14px;
          outline: none;
        }

        textarea {
          min-height: 82px;
          resize: vertical;
        }

        input:focus, select:focus, textarea:focus {
          border-color: #0f766e;
          box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.10);
          background: white;
        }

        .full {
          grid-column: 1 / -1;
        }

        button {
          grid-column: 1 / -1;
          border: none;
          border-radius: 999px;
          background: #0f766e;
          color: white;
          padding: 14px 18px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 14px 28px rgba(15, 118, 110, 0.22);
        }

        .error {
          grid-column: 1 / -1;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 850;
        }

        .orders {
          display: grid;
          gap: 12px;
        }

        .order {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 15px;
          background: #ffffff;
        }

        .orderTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        .orderNo {
          font-weight: 950;
          color: #0f172a;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .meta {
          margin-top: 8px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
        }

        .items {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          color: #334155;
          font-size: 13px;
        }

        .empty {
          color: #64748b;
          font-weight: 650;
          padding: 18px;
          background: #f8fafc;
          border-radius: 16px;
          border: 1px dashed #cbd5e1;
        }

        @media (max-width: 1050px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="headline">
        <div>
          <h1>Auftragseingang</h1>
          <p className="sub">
            Erfasse echte Aufträge aus Heycater, Egora, E-Mail oder Direktanfragen. Später wird dieser Ablauf automatisch aus E-Mails und PDFs befüllt.
          </p>
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <h2>Echten Auftrag erfassen</h2>

          <Form method="post">
            {actionData?.error ? <div className="error">{actionData.error}</div> : null}

            <label>
              Quelle
              <select name="source" defaultValue="DIRECT">
                <option value="DIRECT">Direkt</option>
                <option value="HEYCATER">Heycater</option>
                <option value="EGORA">Egora</option>
                <option value="EMAIL">E-Mail</option>
                <option value="WEBSITE">Website</option>
              </select>
            </label>

            <label>
              Externe Auftragsnummer
              <input name="externalOrderNumber" placeholder="z. B. Heycater ID" />
            </label>

            <label>
              Kunde
              <input name="customerName" list="customerList" placeholder="Firma / Kunde" required />
              <datalist id="customerList">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.name} />
                ))}
              </datalist>
            </label>

            <label>
              Kunden-E-Mail
              <input name="customerEmail" type="email" placeholder="kunde@firma.de" />
            </label>

            <label>
              Kunden-Telefon
              <input name="customerPhone" placeholder="+49 ..." />
            </label>

            <label>
              Eventname
              <input name="eventName" placeholder="Meeting, Lunch, Firmenfeier..." />
            </label>

            <label>
              Lieferdatum
              <input name="deliveryDate" type="date" required />
            </label>

            <label>
              Lieferzeit
              <input name="deliveryTimeText" placeholder="z. B. 11:30 - 12:00" />
            </label>

            <label className="full">
              Lieferadresse
              <input name="deliveryAddress" placeholder="Straße, PLZ Ort" required />
            </label>

            <label>
              Ansprechpartner
              <input name="contactName" placeholder="Name vor Ort" />
            </label>

            <label>
              Telefon vor Ort
              <input name="contactPhone" placeholder="+49 ..." />
            </label>

            <label className="full">
              Position
              <input name="itemName" placeholder="z. B. Chicken Bowl" required />
            </label>

            <label>
              Menge
              <input name="quantity" type="number" min="1" defaultValue="1" required />
            </label>

            <label>
              Einheit
              <input name="unit" defaultValue="Portion" />
            </label>

            <label className="full">
              Einzelpreis netto/brutto
              <input name="unitPriceEuro" placeholder="z. B. 12,50" />
            </label>

            <label className="full">
              Bemerkungen
              <textarea name="notes" placeholder="Allergene, Aufbauhinweise, Besonderheiten..." />
            </label>

            <button type="submit">Auftrag speichern</button>
          </Form>
        </section>

        <section className="card">
          <h2>Letzte echte Aufträge</h2>

          <div className="orders">
            {orders.length === 0 ? (
              <div className="empty">Noch keine Aufträge gespeichert.</div>
            ) : (
              orders.map((order) => (
                <article className="order" key={order.id}>
                  <div className="orderTop">
                    <div>
                      <div className="orderNo">{order.orderNumber}</div>
                      <strong>{order.customerName}</strong>
                    </div>
                    <span className="badge">{order.source}</span>
                  </div>

                  <div className="meta">
                    {order.eventName ? <div>Event: {order.eventName}</div> : null}
                    <div>
                      Lieferung:{" "}
                      {order.deliveryDate
                        ? new Date(order.deliveryDate).toLocaleDateString("de-DE")
                        : "-"}{" "}
                      {order.deliveryTimeText || ""}
                    </div>
                    <div>Adresse: {order.deliveryAddress || "-"}</div>
                    {order.contactName ? <div>Ansprechpartner: {order.contactName}</div> : null}
                  </div>

                  <div className="items">
                    {order.items.map((item) => (
                      <div key={item.id}>
                        {item.quantity} × {item.name} {item.unit ? `(${item.unit})` : ""}
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
