import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Lieferanten · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "SUPPLIERS");

  const suppliers = await prisma.supplier.findMany({
    where: {
      tenantId: access.tenantId,
    },
    orderBy: [
      { active: "desc" },
      { name: "asc" },
    ],
  });

  const activeSuppliers = suppliers.filter((supplier) => supplier.active);
  const mainCategories = Array.from(
    new Set(activeSuppliers.map((supplier) => supplier.category).filter(Boolean))
  );

  return {
    tenant: access.tenant,
    suppliers,
    stats: {
      total: suppliers.length,
      active: activeSuppliers.length,
      categories: mainCategories.length,
      inactive: suppliers.length - activeSuppliers.length,
    },
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "SUPPLIERS");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createSupplier") {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      return { error: "Lieferantenname fehlt." };
    }

    await prisma.supplier.create({
      data: {
        tenantId: access.tenantId,
        name,
        category: String(formData.get("category") || "").trim() || null,
        contactName: String(formData.get("contactName") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        items: String(formData.get("items") || "").trim() || null,
        orderDays: String(formData.get("orderDays") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
        active: true,
      },
    });

    return { success: "Lieferant wurde angelegt." };
  }

  const supplierId = String(formData.get("supplierId") || "");

  if (!supplierId) {
    return { error: "Lieferant fehlt." };
  }

  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      tenantId: access.tenantId,
    },
  });

  if (!supplier) {
    return { error: "Lieferant nicht gefunden." };
  }

  if (intent === "updateSupplier") {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      return { error: "Lieferantenname fehlt." };
    }

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        name,
        category: String(formData.get("category") || "").trim() || null,
        contactName: String(formData.get("contactName") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        items: String(formData.get("items") || "").trim() || null,
        orderDays: String(formData.get("orderDays") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
      },
    });

    return { success: "Lieferant wurde gespeichert." };
  }

  if (intent === "toggleActive") {
    const active = String(formData.get("active") || "") === "true";

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { active },
    });

    return { success: active ? "Lieferant wurde aktiviert." : "Lieferant wurde deaktiviert." };
  }

  if (intent === "deleteSupplier") {
    await prisma.supplier.delete({
      where: { id: supplier.id },
    });

    return { success: "Lieferant wurde geloescht." };
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

export default function SuppliersPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Einkauf & Lager</p>
          <h1>Lieferanten</h1>
          <span className="pageSubline">
            Lieferantenverwaltung fuer {data.tenant.name}: Ansprechpartner, Bestelltage und Artikelgruppen.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton" type="button" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </header>

      {actionData?.success ? (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: 16, borderRadius: 16, fontWeight: 900, marginBottom: 16 }}>
          {actionData.success}
        </div>
      ) : null}

      {actionData?.error ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 16, borderRadius: 16, fontWeight: 900, marginBottom: 16 }}>
          {actionData.error}
        </div>
      ) : null}

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Lieferanten</p>
            <strong>{data.stats.total}</strong>
            <span>{data.stats.active} aktiv</span>
          </div>
          <small data-trend="aktiv">echt</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Kategorien</p>
            <strong>{data.stats.categories}</strong>
            <span>aktive Lieferantenbereiche</span>
          </div>
          <small data-trend="bereit">bereit</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Inaktiv</p>
            <strong>{data.stats.inactive}</strong>
            <span>deaktivierte Lieferanten</span>
          </div>
          <small data-trend="pruefen">Archiv</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Neuer Lieferant</p>
            <h2>Lieferant anlegen</h2>
          </div>
        </div>

        <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
          <input type="hidden" name="intent" value="createSupplier" />

          <label>
            Name
            <input name="name" placeholder="Metro" style={inputStyle} required />
          </label>

          <label>
            Kategorie
            <input name="category" placeholder="Lebensmittel" style={inputStyle} />
          </label>

          <label>
            Ansprechpartner
            <input name="contactName" placeholder="Herr/Frau..." style={inputStyle} />
          </label>

          <label>
            Bestelltage
            <input name="orderDays" placeholder="Mo-Fr" style={inputStyle} />
          </label>

          <label>
            E-Mail
            <input name="email" type="email" placeholder="bestellung@..." style={inputStyle} />
          </label>

          <label>
            Telefon
            <input name="phone" placeholder="030..." style={inputStyle} />
          </label>

          <label style={{ gridColumn: "span 2" }}>
            Artikel / Sortiment
            <input name="items" placeholder="Reis, Huhn, Gemuese..." style={inputStyle} />
          </label>

          <label style={{ gridColumn: "1 / -2" }}>
            Notiz
            <input name="notes" placeholder="optional" style={inputStyle} />
          </label>

          <button className="primaryButton" type="submit">
            Anlegen
          </button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Lieferantenuebersicht</p>
            <h2>Alle Lieferanten</h2>
          </div>
        </div>

        {data.suppliers.length === 0 ? (
          <div className="noteBox">
            <strong>Noch keine Lieferanten angelegt.</strong>
            <p>Lege oben deinen ersten Lieferanten an, zum Beispiel Metro, Verpackung24 oder Baeckerei.</p>
          </div>
        ) : (
          <div className="suppliersGrid">
            {data.suppliers.map((supplier: any) => (
              <article className="supplierCard" key={supplier.id}>
                <div className="supplierTop">
                  <div>
                    <strong>{supplier.name}</strong>
                    <span>
                      {supplier.category || "Ohne Kategorie"} · {supplier.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>
                  <small>{supplier.orderDays || "-"}</small>
                </div>

                <div className="supplierDetails">
                  <p>
                    <b>Ansprechpartner</b>
                    <span>{supplier.contactName || "-"}</span>
                  </p>
                  <p>
                    <b>E-Mail</b>
                    <span>{supplier.email || "-"}</span>
                  </p>
                  <p>
                    <b>Telefon</b>
                    <span>{supplier.phone || "-"}</span>
                  </p>
                  <p>
                    <b>Artikel</b>
                    <span>{supplier.items || "-"}</span>
                  </p>
                  <p>
                    <b>Notiz</b>
                    <span>{supplier.notes || "-"}</span>
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggleActive" />
                    <input type="hidden" name="supplierId" value={supplier.id} />
                    <input type="hidden" name="active" value={supplier.active ? "false" : "true"} />
                    <button className="ghostButton" type="submit">
                      {supplier.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </Form>

                  <details>
                    <summary className="ghostButton" style={{ listStyle: "none", cursor: "pointer" }}>
                      Bearbeiten
                    </summary>

                    <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                      <input type="hidden" name="intent" value="updateSupplier" />
                      <input type="hidden" name="supplierId" value={supplier.id} />

                      <input name="name" defaultValue={supplier.name} style={inputStyle} />
                      <input name="category" defaultValue={supplier.category || ""} style={inputStyle} />
                      <input name="contactName" defaultValue={supplier.contactName || ""} style={inputStyle} />
                      <input name="orderDays" defaultValue={supplier.orderDays || ""} style={inputStyle} />
                      <input name="email" type="email" defaultValue={supplier.email || ""} style={inputStyle} />
                      <input name="phone" defaultValue={supplier.phone || ""} style={inputStyle} />
                      <input name="items" defaultValue={supplier.items || ""} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
                      <input name="notes" defaultValue={supplier.notes || ""} style={{ ...inputStyle, gridColumn: "1 / -1" }} />

                      <button className="primaryButton" type="submit" style={{ gridColumn: "1 / -1" }}>
                        Speichern
                      </button>
                    </Form>
                  </details>

                  <Form method="post">
                    <input type="hidden" name="intent" value="deleteSupplier" />
                    <input type="hidden" name="supplierId" value={supplier.id} />
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
