import { Form, Link, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Kunden · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId || !access.tenant) {
    return {
      tenant: null,
      setupError: access.setupError || "Kein Mandant gefunden.",
      customers: [],
      stats: {
        total: 0,
        withEmail: 0,
        withPhone: 0,
        withOrders: 0,
      },
    };
  }

  try {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: access.tenantId,
      },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      tenant: access.tenant,
      setupError: null,
      customers,
      stats: {
        total: customers.length,
        withEmail: customers.filter((customer) => Boolean(customer.email)).length,
        withPhone: customers.filter((customer) => Boolean(customer.phone)).length,
        withOrders: customers.filter((customer: any) => customer._count.orders > 0).length,
      },
    };
  } catch (error) {
    console.error("Kunden loader failed:", error);

    return {
      tenant: access.tenant,
      setupError: "Kunden konnten nicht geladen werden. Bitte Datenbank/Schema pruefen.",
      customers: [],
      stats: {
        total: 0,
        withEmail: 0,
        withPhone: 0,
        withOrders: 0,
      },
    };
  }
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId) {
    return { error: access.setupError || "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createCustomer") {
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const contactName = String(formData.get("contactName") || "").trim();

    if (!name) {
      return { error: "Kundenname fehlt." };
    }

    await prisma.customer.create({
      data: {
        tenantId: access.tenantId,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        contactName: contactName || null,
      } as any,
    });

    return { success: "Kunde wurde angelegt." };
  }

  const customerId = String(formData.get("customerId") || "");

  if (!customerId) {
    return { error: "Kunde fehlt." };
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: access.tenantId,
    },
  });

  if (!customer) {
    return { error: "Kunde nicht gefunden." };
  }

  if (intent === "updateCustomer") {
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const contactName = String(formData.get("contactName") || "").trim();

    if (!name) {
      return { error: "Kundenname fehlt." };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        contactName: contactName || null,
      } as any,
    });

    return { success: "Kunde wurde gespeichert." };
  }

  if (intent === "deleteCustomer") {
    const orderCount = await prisma.order.count({
      where: {
        tenantId: access.tenantId,
        customerId: customer.id,
      },
    });

    if (orderCount > 0) {
      return { error: "Kunde kann nicht geloescht werden, weil Auftraege vorhanden sind." };
    }

    await prisma.customer.delete({
      where: { id: customer.id },
    });

    return { success: "Kunde wurde geloescht." };
  }

  return { error: "Unbekannte Aktion." };
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontWeight: 750,
  width: "100%",
};

export default function CustomersPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Kunden</h1>
          <span className="pageSubline">
            {data.tenant?.name || "Kein Mandant"} · echte Kunden, Ansprechpartner und Kontaktdaten.
          </span>
        </div>

        <div className="topActions">
          <Link className="secondaryButton" to="/auftragseingang">Auftrag erfassen</Link>
          <button className="primaryButton" type="button">Neuer Kunde</button>
        </div>
      </header>

      {data.setupError ? (
        <div style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {data.setupError}
        </div>
      ) : null}

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

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Kunden gesamt</p>
            <strong>{data.stats.total}</strong>
            <span>im Mandanten</span>
          </div>
          <small data-trend="aktiv">echt</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Mit E-Mail</p>
            <strong>{data.stats.withEmail}</strong>
            <span>kontaktierbar</span>
          </div>
          <small data-trend="bereit">E-Mail</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Mit Telefon</p>
            <strong>{data.stats.withPhone}</strong>
            <span>Rueckfragen moeglich</span>
          </div>
          <small data-trend="pruefen">Kontakt</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Mit Auftraegen</p>
            <strong>{data.stats.withOrders}</strong>
            <span>aktive Kunden</span>
          </div>
          <small data-trend="aktiv">Auftrag</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Neuer Kunde</p>
            <h2>Kunde anlegen</h2>
          </div>
        </div>

        <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
          <input type="hidden" name="intent" value="createCustomer" />

          <label>
            Kundenname
            <input name="name" placeholder="Firma / Kunde" style={inputStyle} required />
          </label>

          <label>
            Ansprechpartner
            <input name="contactName" placeholder="Frau/Herr..." style={inputStyle} />
          </label>

          <label>
            E-Mail
            <input name="email" type="email" placeholder="kunde@firma.de" style={inputStyle} />
          </label>

          <label>
            Telefon
            <input name="phone" placeholder="030..." style={inputStyle} />
          </label>

          <label style={{ gridColumn: "span 2" }}>
            Adresse
            <input name="address" placeholder="Strasse, PLZ Ort" style={inputStyle} />
          </label>

          <button className="primaryButton" type="submit">
            Anlegen
          </button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Kundenuebersicht</p>
            <h2>Aktuelle Kunden</h2>
          </div>
        </div>

        {data.customers.length === 0 ? (
          <div className="noteBox">
            <strong>Noch keine Kunden angelegt.</strong>
            <p>Lege oben deinen ersten Kunden an oder erstelle einen Auftrag im Auftragseingang.</p>
          </div>
        ) : (
          <div className="customersGrid">
            {data.customers.map((customer: any) => (
              <article className="customerCard" key={customer.id}>
                <div className="customerTop">
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{customer.contactName || "Kein Ansprechpartner"} · Aktiv</span>
                  </div>
                  <small>{customer._count?.orders || 0} Auftraege</small>
                </div>

                <div className="customerDetails">
                  <p>
                    <b>Ansprechpartner</b>
                    <span>{customer.contactName || "-"}</span>
                  </p>
                  <p>
                    <b>E-Mail</b>
                    <span>{customer.email || "-"}</span>
                  </p>
                  <p>
                    <b>Telefon</b>
                    <span>{customer.phone || "-"}</span>
                  </p>
                  <p>
                    <b>Adresse</b>
                    <span>{customer.address || "-"}</span>
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <details>
                    <summary className="ghostButton" style={{ listStyle: "none", cursor: "pointer" }}>
                      Bearbeiten
                    </summary>

                    <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                      <input type="hidden" name="intent" value="updateCustomer" />
                      <input type="hidden" name="customerId" value={customer.id} />

                      <input name="name" defaultValue={customer.name} style={inputStyle} />
                      <input name="contactName" defaultValue={customer.contactName || ""} style={inputStyle} />
                      <input name="email" type="email" defaultValue={customer.email || ""} style={inputStyle} />
                      <input name="phone" defaultValue={customer.phone || ""} style={inputStyle} />
                      <input name="address" defaultValue={customer.address || ""} style={{ ...inputStyle, gridColumn: "1 / -1" }} />

                      <button className="primaryButton" type="submit" style={{ gridColumn: "1 / -1" }}>
                        Speichern
                      </button>
                    </Form>
                  </details>

                  <Form method="post">
                    <input type="hidden" name="intent" value="deleteCustomer" />
                    <input type="hidden" name="customerId" value={customer.id} />
                    <button className="ghostButton" type="submit" style={{ color: "#b91c1c" }}>
                      Loeschen
                    </button>
                  </Form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
