import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Lager · Gastario" }];
}

function toNumber(value: FormDataEntryValue | null, fallback = 0) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "INVENTORY");

  const items = await prisma.inventoryItem.findMany({
    where: {
      tenantId: access.tenantId,
    },
    orderBy: [
      { active: "desc" },
      { name: "asc" },
    ],
  });

  const activeItems = items.filter((item) => item.active);
  const lowItems = activeItems.filter((item) => item.minStock > 0 && item.currentStock <= item.minStock);

  const estimatedValue = activeItems.reduce((sum, item) => sum + item.currentStock, 0);

  return {
    tenant: access.tenant,
    items,
    stats: {
      total: items.length,
      active: activeItems.length,
      low: lowItems.length,
      stockSum: estimatedValue,
    },
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "INVENTORY");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createItem") {
    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const unit = String(formData.get("unit") || "Stueck").trim() || "Stueck";
    const currentStock = toNumber(formData.get("currentStock"));
    const minStock = toNumber(formData.get("minStock"));
    const supplierName = String(formData.get("supplierName") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!name) {
      return { error: "Artikelname fehlt." };
    }

    await prisma.inventoryItem.create({
      data: {
        tenantId: access.tenantId,
        name,
        category: category || null,
        unit,
        currentStock,
        minStock,
        supplierName: supplierName || null,
        location: location || null,
        notes: notes || null,
        active: true,
      },
    });

    return { success: "Lagerartikel wurde angelegt." };
  }

  const itemId = String(formData.get("itemId") || "");

  if (!itemId) {
    return { error: "Lagerartikel fehlt." };
  }

  const item = await prisma.inventoryItem.findFirst({
    where: {
      id: itemId,
      tenantId: access.tenantId,
    },
  });

  if (!item) {
    return { error: "Lagerartikel nicht gefunden." };
  }

  if (intent === "adjustStock") {
    const change = toNumber(formData.get("change"));
    const nextStock = Math.max(0, item.currentStock + change);

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        currentStock: nextStock,
      },
    });

    return { success: "Bestand wurde aktualisiert." };
  }

  if (intent === "updateItem") {
    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const unit = String(formData.get("unit") || "Stueck").trim() || "Stueck";
    const currentStock = toNumber(formData.get("currentStock"));
    const minStock = toNumber(formData.get("minStock"));
    const supplierName = String(formData.get("supplierName") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!name) {
      return { error: "Artikelname fehlt." };
    }

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        name,
        category: category || null,
        unit,
        currentStock,
        minStock,
        supplierName: supplierName || null,
        location: location || null,
        notes: notes || null,
      },
    });

    return { success: "Lagerartikel wurde gespeichert." };
  }

  if (intent === "toggleActive") {
    const active = String(formData.get("active") || "") === "true";

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { active },
    });

    return { success: active ? "Lagerartikel wurde aktiviert." : "Lagerartikel wurde deaktiviert." };
  }

  if (intent === "deleteItem") {
    await prisma.inventoryItem.delete({
      where: { id: item.id },
    });

    return { success: "Lagerartikel wurde geloescht." };
  }

  return { error: "Unbekannte Aktion." };
}

function stockStatus(item: any) {
  if (!item.active) return "Inaktiv";
  if (item.minStock > 0 && item.currentStock <= item.minStock) return "Unter Mindestbestand";
  return "Ausreichend";
}

function statusClass(item: any) {
  const status = stockStatus(item);
  if (status === "Inaktiv") return "warning";
  if (status === "Unter Mindestbestand") return "danger";
  return "success";
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontWeight: 750,
  width: "100%",
};

export default function InventoryPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Einkauf & Lager</p>
          <h1>Lager</h1>
          <span className="pageSubline">
            Echte Lagerverwaltung fuer {data.tenant.name}: Bestand, Mindestbestand, Lieferant und Lagerort.
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
            <p>Lagerartikel</p>
            <strong>{data.stats.total}</strong>
            <span>{data.stats.active} aktiv</span>
          </div>
          <small data-trend="aktiv">echt</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Unter Mindestbestand</p>
            <strong>{data.stats.low}</strong>
            <span>muss nachbestellt werden</span>
          </div>
          <small data-trend="kritisch">kritisch</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Bestandssumme</p>
            <strong>{data.stats.stockSum}</strong>
            <span>alle aktiven Mengen addiert</span>
          </div>
          <small data-trend="bereit">MVP</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Neuer Artikel</p>
            <h2>Lagerartikel anlegen</h2>
          </div>
        </div>

        <Form method="post" style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr .6fr .6fr .6fr .9fr .9fr", gap: 12, alignItems: "end" }}>
          <input type="hidden" name="intent" value="createItem" />

          <label>
            Artikel
            <input name="name" placeholder="z.B. Reis" style={inputStyle} required />
          </label>

          <label>
            Kategorie
            <input name="category" placeholder="Zutaten" style={inputStyle} />
          </label>

          <label>
            Einheit
            <input name="unit" placeholder="kg" defaultValue="Stueck" style={inputStyle} />
          </label>

          <label>
            Bestand
            <input name="currentStock" type="number" step="0.01" defaultValue="0" style={inputStyle} />
          </label>

          <label>
            Mindest
            <input name="minStock" type="number" step="0.01" defaultValue="0" style={inputStyle} />
          </label>

          <label>
            Lieferant
            <input name="supplierName" placeholder="Metro" style={inputStyle} />
          </label>

          <label>
            Lagerort
            <input name="location" placeholder="Trockenlager" style={inputStyle} />
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
            <p className="eyebrow">Bestaende</p>
            <h2>Aktuelle Lagerartikel</h2>
          </div>
        </div>

        <div className="inventoryTable">
          <div className="inventoryHead">
            <span>Artikel</span>
            <span>Kategorie</span>
            <span>Bestand</span>
            <span>Mindest</span>
            <span>Lieferant</span>
            <span>Lagerort</span>
            <span>Status</span>
          </div>

          {data.items.length === 0 ? (
            <div className="inventoryRow">
              <strong>Noch keine Lagerartikel angelegt.</strong>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <em className="warning">Leer</em>
            </div>
          ) : (
            data.items.map((item: any) => (
              <div className="inventoryRow" key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.category || "-"}</span>
                <span>{item.currentStock} {item.unit}</span>
                <span>{item.minStock} {item.unit}</span>
                <span>{item.supplierName || "-"}</span>
                <span>{item.location || "-"}</span>
                <em className={statusClass(item)}>{stockStatus(item)}</em>

                <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, marginTop: 10 }}>
                  <Form method="post" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="hidden" name="intent" value="adjustStock" />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input name="change" type="number" step="0.01" placeholder="+ Menge / - Menge" style={{ ...inputStyle, width: 160 }} />
                    <button className="ghostButton" type="submit">Bestand buchen</button>
                  </Form>

                  <Form method="post">
                    <input type="hidden" name="intent" value="toggleActive" />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="active" value={item.active ? "false" : "true"} />
                    <button className="ghostButton" type="submit">
                      {item.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </Form>

                  <details>
                    <summary className="ghostButton" style={{ listStyle: "none", cursor: "pointer" }}>Bearbeiten</summary>
                    <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 100px 1fr 1fr", gap: 8, marginTop: 10 }}>
                      <input type="hidden" name="intent" value="updateItem" />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input name="name" defaultValue={item.name} style={inputStyle} />
                      <input name="category" defaultValue={item.category || ""} style={inputStyle} />
                      <input name="unit" defaultValue={item.unit} style={inputStyle} />
                      <input name="currentStock" type="number" step="0.01" defaultValue={item.currentStock} style={inputStyle} />
                      <input name="minStock" type="number" step="0.01" defaultValue={item.minStock} style={inputStyle} />
                      <input name="supplierName" defaultValue={item.supplierName || ""} style={inputStyle} />
                      <input name="location" defaultValue={item.location || ""} style={inputStyle} />
                      <input name="notes" defaultValue={item.notes || ""} style={{ ...inputStyle, gridColumn: "1 / -2" }} />
                      <button className="primaryButton" type="submit">Speichern</button>
                    </Form>
                  </details>

                  <Form method="post">
                    <input type="hidden" name="intent" value="deleteItem" />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="ghostButton" type="submit" style={{ color: "#b91c1c" }}>
                      Loeschen
                    </button>
                  </Form>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AppLayout>
  );
}
