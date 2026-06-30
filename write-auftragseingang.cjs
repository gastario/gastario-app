const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes", "auftragseingang.tsx");

const content = String.raw`
import { Form, useActionData, useLoaderData } from "react-router";

const SOURCES = [
  { value: "DIRECT", label: "Direkt" },
  { value: "HEYCATER", label: "Heycater" },
  { value: "EGORA", label: "Egora" },
  { value: "EMAIL", label: "E-Mail" },
  { value: "WEBSITE", label: "Website" },
];

const STATUSES = [
  { value: "AUTO_CREATED", label: "Prüfen" },
  { value: "CONFIRMED", label: "Übernommen" },
  { value: "REJECTED", label: "Abgelehnt" },
];

function euroToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "0").replace(",", ".").trim();
  const number = Number(raw);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function createOrderNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return "GA-" + date + "-" + random;
}

export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw new Response("Nicht angemeldet", { status: 401 });
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!tenantUser) {
    throw new Response("Kein Mandant gefunden", { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";

  const orders = await prisma.order.findMany({
    where: {
      tenantId: tenantUser.tenantId,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      items: true,
      customer: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  const counts = await Promise.all([
    prisma.order.count({ where: { tenantId: tenantUser.tenantId } }),
    prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "AUTO_CREATED" as any } }),
    prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "CONFIRMED" as any } }),
    prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "REJECTED" as any } }),
  ]);

  return {
    tenant: tenantUser.tenant,
    orders,
    activeStatus: status,
    counts: {
      all: counts[0],
      review: counts[1],
      confirmed: counts[2],
      rejected: counts[3],
    },
  };
}

export async function action({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    return { error: "Nicht angemeldet." };
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
  });

  if (!tenantUser) {
    return { error: "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createOrder") {
    const source = String(formData.get("source") || "DIRECT");
    const externalOrderNumber = String(formData.get("externalOrderNumber") || "").trim();

    const customerName = String(formData.get("customerName") || "").trim();
    const customerEmail = String(formData.get("customerEmail") || "").trim().toLowerCase();
    const customerPhone = String(formData.get("customerPhone") || "").trim();

    const eventName = String(formData.get("eventName") || "").trim();
    const deliveryDateRaw = String(formData.get("deliveryDate") || "").trim();
    const deliveryTime = String(formData.get("deliveryTime") || "").trim();
    const deliveryAddress = String(formData.get("deliveryAddress") || "").trim();

    const contactName = String(formData.get("contactName") || "").trim();
    const contactPhone = String(formData.get("contactPhone") || "").trim();

    const itemName = String(formData.get("itemName") || "").trim();
    const quantity = Number(formData.get("quantity") || 1);
    const unit = String(formData.get("unit") || "Stück").trim();
    const unitPriceCents = euroToCents(formData.get("unitPriceEuro"));
    const notes = String(formData.get("notes") || "").trim();

    if (!customerName) {
      return { error: "Kundenname fehlt." };
    }

    if (!itemName) {
      return { error: "Position fehlt." };
    }

    let customer = await prisma.customer.findFirst({
      where: {
        tenantId: tenantUser.tenantId,
        OR: [
          ...(customerEmail ? [{ email: customerEmail }] : []),
          { name: customerName },
        ],
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId: tenantUser.tenantId,
          name: customerName,
          email: customerEmail || null,
          phone: customerPhone || null,
        } as any,
      });
    }

    const deliveryDate = deliveryDateRaw ? new Date(deliveryDateRaw + "T00:00:00") : null;

    const order = await prisma.order.create({
      data: {
        tenantId: tenantUser.tenantId,
        customerId: customer.id,
        orderNumber: createOrderNumber(),
        externalOrderNumber: externalOrderNumber || null,
        source: source as any,
        status: "AUTO_CREATED" as any,
        confidence: "HIGH" as any,
        manualReviewReason: "Manuell im Auftragseingang angelegt",
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        eventName: eventName || null,
        deliveryDate,
        deliveryTime: deliveryTime || null,
        deliveryAddress: deliveryAddress || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        notes: notes || null,
      } as any,
    });

    await prisma.orderItem.create({
      data: {
        tenantId: tenantUser.tenantId,
        orderId: order.id,
        name: itemName,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unit,
        unitPriceCents,
        totalPriceCents: unitPriceCents * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1),
      } as any,
    });

    return { success: "Auftrag wurde angelegt." };
  }

  if (intent === "updateStatus") {
    const orderId = String(formData.get("orderId") || "");
    const status = String(formData.get("status") || "AUTO_CREATED");

    if (!orderId) {
      return { error: "Auftrag fehlt." };
    }

    await prisma.order.updateMany({
      where: {
        id: orderId,
        tenantId: tenantUser.tenantId,
      },
      data: {
        status: status as any,
      },
    });

    return { success: "Auftragsstatus wurde aktualisiert." };
  }

  if (intent === "deleteOrder") {
    const orderId = String(formData.get("orderId") || "");

    if (!orderId) {
      return { error: "Auftrag fehlt." };
    }

    await prisma.orderItem.deleteMany({
      where: {
        orderId,
        tenantId: tenantUser.tenantId,
      },
    });

    await prisma.order.deleteMany({
      where: {
        id: orderId,
        tenantId: tenantUser.tenantId,
      },
    });

    return { success: "Auftrag wurde gelöscht." };
  }

  return { error: "Unbekannte Aktion." };
}

function statusLabel(status: string) {
  if (status === "AUTO_CREATED") return "Prüfen";
  if (status === "CONFIRMED") return "Übernommen";
  if (status === "REJECTED") return "Abgelehnt";
  return status;
}

function sourceLabel(source: string) {
  const item = SOURCES.find((entry) => entry.value === source);
  return item?.label || source;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

export default function AuftragseingangPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#edf2f6",
      padding: 32,
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#07111f"
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 20,
        alignItems: "flex-start",
        marginBottom: 24
      }}>
        <div>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".11em",
            fontSize: 11,
            fontWeight: 950,
            marginBottom: 8
          }}>
            Gastario
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 44,
            lineHeight: .95,
            letterSpacing: "-0.065em"
          }}>
            Auftragseingang
          </h1>
          <p style={{
            margin: "12px 0 0",
            color: "#64748b",
            fontWeight: 700
          }}>
            Neue Aufträge erfassen, prüfen und übernehmen.
          </p>
        </div>

        <div style={{
          background: "white",
          border: "1px solid #dbe5ee",
          borderRadius: 18,
          padding: 14,
          fontWeight: 900
        }}>
          {data.tenant.name}
        </div>
      </header>

      {actionData?.success ? (
        <div style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          color: "#065f46",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.success}
        </div>
      ) : null}

      {actionData?.error ? (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.error}
        </div>
      ) : null}

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
        marginBottom: 20
      }}>
        {[
          ["Alle", data.counts.all, ""],
          ["Prüfen", data.counts.review, "AUTO_CREATED"],
          ["Übernommen", data.counts.confirmed, "CONFIRMED"],
          ["Abgelehnt", data.counts.rejected, "REJECTED"],
        ].map(([label, count, status]) => (
          <a
            key={String(label)}
            href={status ? "/auftragseingang?status=" + status : "/auftragseingang"}
            style={{
              background: data.activeStatus === status ? "#0f766e" : "white",
              color: data.activeStatus === status ? "white" : "#07111f",
              border: "1px solid #dbe5ee",
              borderRadius: 24,
              padding: 20,
              textDecoration: "none",
              boxShadow: "0 12px 32px rgba(15, 23, 42, 0.07)"
            }}
          >
            <div style={{ color: data.activeStatus === status ? "#ccfbf1" : "#64748b", fontWeight: 900, fontSize: 13 }}>
              {label}
            </div>
            <div style={{ fontWeight: 950, fontSize: 36, letterSpacing: "-0.05em" }}>
              {count}
            </div>
          </a>
        ))}
      </section>

      <section style={{
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 22,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
        marginBottom: 20
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".10em",
            fontSize: 11,
            fontWeight: 950
          }}>
            Neuer Auftrag
          </div>
          <h2 style={{ margin: "5px 0 0", fontSize: 24, letterSpacing: "-0.04em" }}>
            Auftrag manuell erfassen
          </h2>
        </div>

        <Form method="post" style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="intent" value="createOrder" />

          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Quelle
              <select name="source" defaultValue="DIRECT" style={inputStyle}>
                {SOURCES.map((source) => (
                  <option key={source.value} value={source.value}>{source.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Externe Nummer optional
              <input name="externalOrderNumber" placeholder="z. B. Heycater ID" style={inputStyle} />
            </label>

            <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
              Kunde
              <input name="customerName" placeholder="Firma / Kunde" style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <input name="customerEmail" type="email" placeholder="Kunden-E-Mail" style={inputStyle} />
            <input name="customerPhone" placeholder="Kunden-Telefon" style={inputStyle} />
            <input name="eventName" placeholder="Event / Anlass" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "180px 160px 1fr", gap: 12 }}>
            <input name="deliveryDate" type="date" style={inputStyle} />
            <input name="deliveryTime" placeholder="Uhrzeit" style={inputStyle} />
            <input name="deliveryAddress" placeholder="Lieferadresse" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input name="contactName" placeholder="Ansprechpartner vor Ort" style={inputStyle} />
            <input name="contactPhone" placeholder="Telefon vor Ort" style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 160px", gap: 12 }}>
            <input name="itemName" placeholder="Position, z. B. Bowl Menü" style={inputStyle} />
            <input name="quantity" type="number" min="1" defaultValue="1" style={inputStyle} />
            <input name="unit" defaultValue="Stück" style={inputStyle} />
            <input name="unitPriceEuro" placeholder="Einzelpreis €" style={inputStyle} />
          </div>

          <textarea name="notes" placeholder="Notizen / Besonderheiten" rows={3} style={inputStyle} />

          <button type="submit" style={{
            border: "none",
            background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
            color: "white",
            borderRadius: 999,
            padding: "13px 18px",
            fontWeight: 950,
            cursor: "pointer",
            justifySelf: "start"
          }}>
            Auftrag anlegen
          </button>
        </Form>
      </section>

      <section style={{
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 22,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)"
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".10em",
            fontSize: 11,
            fontWeight: 950
          }}>
            Eingang
          </div>
          <h2 style={{ margin: "5px 0 0", fontSize: 24, letterSpacing: "-0.04em" }}>
            Aufträge
          </h2>
        </div>

        <div style={{ overflow: "auto", border: "1px solid #dbe5ee", borderRadius: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nummer</th>
                <th style={thStyle}>Kunde</th>
                <th style={thStyle}>Quelle</th>
                <th style={thStyle}>Lieferung</th>
                <th style={thStyle}>Positionen</th>
                <th style={thStyle}>Summe</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={8}>Noch keine Aufträge vorhanden.</td>
                </tr>
              ) : (
                data.orders.map((order) => {
                  const total = order.items.reduce((sum, item) => sum + (item.totalPriceCents || 0), 0);

                  return (
                    <tr key={order.id}>
                      <td style={tdStyle}>
                        <strong>{order.orderNumber}</strong>
                        {order.externalOrderNumber ? (
                          <div style={{ color: "#64748b", fontSize: 12 }}>{order.externalOrderNumber}</div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>
                        <strong>{order.customerName}</strong>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{order.customerEmail || "-"}</div>
                      </td>
                      <td style={tdStyle}>{sourceLabel(order.source)}</td>
                      <td style={tdStyle}>
                        {formatDate(order.deliveryDate)}
                        <div style={{ color: "#64748b", fontSize: 12 }}>{order.deliveryTime || "-"}</div>
                      </td>
                      <td style={tdStyle}>
                        {order.items.map((item) => (
                          <div key={item.id}>
                            {item.quantity} × {item.name}
                          </div>
                        ))}
                      </td>
                      <td style={tdStyle}>{centsToEuro(total)}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-flex",
                          borderRadius: 999,
                          padding: "5px 10px",
                          fontWeight: 950,
                          background: order.status === "CONFIRMED" ? "#ecfdf5" : order.status === "REJECTED" ? "#fef2f2" : "#fff7ed",
                          color: order.status === "CONFIRMED" ? "#047857" : order.status === "REJECTED" ? "#b91c1c" : "#c2410c",
                          border: "1px solid " + (order.status === "CONFIRMED" ? "#bbf7d0" : order.status === "REJECTED" ? "#fecaca" : "#fed7aa")
                        }}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Form method="post" style={{ display: "flex", gap: 8 }}>
                            <input type="hidden" name="intent" value="updateStatus" />
                            <input type="hidden" name="orderId" value={order.id} />
                            <select name="status" defaultValue={order.status} style={inputStyle}>
                              {STATUSES.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                            <button type="submit" style={smallButtonStyle}>Speichern</button>
                          </Form>

                          <Form method="post">
                            <input type="hidden" name="intent" value="deleteOrder" />
                            <input type="hidden" name="orderId" value={order.id} />
                            <button type="submit" style={{ ...smallButtonStyle, color: "#b91c1c" }}>Löschen</button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  font: "inherit",
  background: "white",
};

const thStyle = {
  textAlign: "left" as const,
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 11.5,
  textTransform: "uppercase" as const,
  letterSpacing: ".075em",
  padding: "14px 15px",
  borderBottom: "1px solid #dbe5ee",
  fontWeight: 950,
};

const tdStyle = {
  padding: "15px",
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "top" as const,
  fontWeight: 720,
};

const smallButtonStyle = {
  border: "1px solid #dbe5ee",
  background: "white",
  borderRadius: 999,
  padding: "9px 12px",
  fontWeight: 900,
  cursor: "pointer",
};
`;

fs.writeFileSync(file, content, "utf8");
console.log("Auftragseingang geschrieben:", file);
