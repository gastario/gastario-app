import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Lieferanten · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "SUPPLIERS");

  /*
   * gastario-supplier-connections-ui-20260729
   * Lieferanten inklusive Verbindungen, Katalogen und aktuellem Preisstand.
   */
  const suppliers = await prisma.supplier.findMany({
    where: {
      tenantId: access.tenantId,
    },
    include: {
      supplierConnections: {
        orderBy: [
          { active: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          syncRuns: {
            orderBy: {
              startedAt: "desc",
            },
            take: 1,
          },
          _count: {
            select: {
              catalogItems: true,
              syncRuns: true,
            },
          },
        },
      },
      supplierCatalogItems: {
        orderBy: {
          name: "asc",
        },
        include: {
          prices: {
            orderBy: {
              fetchedAt: "desc",
            },
            take: 1,
          },
        },
      },
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

  const freshnessLimit = Date.now() - 24 * 60 * 60 * 1000;

  const connections = suppliers.flatMap((supplier: any) => {
    return supplier.supplierConnections.map((connection: any) => ({
      ...connection,
      supplierName: supplier.name,
      supplierActive: supplier.active,
    }));
  });

  const catalogItems = suppliers.flatMap((supplier: any) => {
    return supplier.supplierCatalogItems.map((item: any) => ({
      ...item,
      supplierName: supplier.name,
    }));
  });

  const catalogItemsWithPrice = catalogItems.filter((item: any) => {
    return item.prices.length > 0;
  });

  const currentPriceItems = catalogItemsWithPrice.filter((item: any) => {
    const fetchedAt = new Date(item.prices[0].fetchedAt).getTime();

    return Number.isFinite(fetchedAt) && fetchedAt >= freshnessLimit;
  });

  const stalePriceItems = catalogItemsWithPrice.filter((item: any) => {
    const fetchedAt = new Date(item.prices[0].fetchedAt).getTime();

    return !Number.isFinite(fetchedAt) || fetchedAt < freshnessLimit;
  });

  return {
    tenant: access.tenant,
    suppliers,
    connections,
    catalogItems,
    currentPriceItems,
    stalePriceItems,
    stats: {
      total: suppliers.length,
      active: activeSuppliers.length,
      categories: mainCategories.length,
      inactive: suppliers.length - activeSuppliers.length,
      connections: connections.length,
      activeConnections: connections.filter(
        (connection: any) =>
          connection.active &&
          connection.status === "ACTIVE"
      ).length,
      catalogItems: catalogItems.length,
      currentPrices: currentPriceItems.length,
      stalePrices: stalePriceItems.length,
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

  if (intent === "createConnection") {
    const supplierId = String(
      formData.get("supplierId") || ""
    ).trim();

    const requestedType = String(
      formData.get("connectionType") || "MANUAL"
    ).trim();

    const allowedTypes = [
      "API",
      "PUNCHOUT",
      "BMECAT",
      "CXML",
      "EDI",
      "CSV",
      "EXCEL",
      "EMAIL",
      "MANUAL",
    ];

    if (!supplierId) {
      return { error: "Bitte einen Lieferanten auswählen." };
    }

    if (!allowedTypes.includes(requestedType)) {
      return { error: "Unbekannter Verbindungstyp." };
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

    const syncIntervalMinutes = Math.max(
      60,
      Number(
        formData.get("syncIntervalMinutes") || 1440
      ) || 1440
    );

    await prisma.supplierConnection.create({
      data: {
        tenantId: access.tenantId,
        supplierId: supplier.id,
        type: requestedType as any,
        status:
          requestedType === "MANUAL"
            ? "ACTIVE"
            : "CONFIGURED",
        label:
          String(formData.get("label") || "").trim() ||
          null,
        customerNumber:
          String(
            formData.get("customerNumber") || ""
          ).trim() || null,
        endpointUrl:
          String(formData.get("endpointUrl") || "").trim() ||
          null,
        syncIntervalMinutes,
        active: true,
      },
    });

    return {
      success:
        "Lieferantenverbindung wurde angelegt.",
    };
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

      <section
        className="orderSummaryGrid"
        style={{
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
        }}
      >
        <article className="metricCard">
          <div>
            <p>Lieferanten</p>
            <strong>{data.stats.total}</strong>
            <span>{data.stats.active} aktiv</span>
          </div>
          <small data-trend="aktiv">Stammdaten</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Verbindungen</p>
            <strong>{data.stats.connections}</strong>
            <span>
              {data.stats.activeConnections} live aktiv
            </span>
          </div>
          <small data-trend="bereit">Schnittstellen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Katalogartikel</p>
            <strong>{data.stats.catalogItems}</strong>
            <span>zugeordnete Lieferantenartikel</span>
          </div>
          <small data-trend="bereit">Katalog</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Aktuelle Preise</p>
            <strong>{data.stats.currentPrices}</strong>
            <span>innerhalb der letzten 24 Stunden</span>
          </div>
          <small data-trend="aktiv">Aktuell</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Veraltete Preise</p>
            <strong>{data.stats.stalePrices}</strong>
            <span>älter als 24 Stunden</span>
          </div>
          <small data-trend="pruefen">Prüfen</small>
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
            <p className="eyebrow">
              Tagespreise & Schnittstellen
            </p>
            <h2>Lieferantenverbindungen</h2>
            <span className="pageSubline">
              Verbinde Lieferantenkonten, Preislisten oder
              manuelle Kataloge mit Gastario.
            </span>
          </div>
        </div>

        {data.suppliers.length === 0 ? (
          <div className="noteBox">
            <strong>
              Zuerst einen Lieferanten anlegen
            </strong>
            <p>
              Eine Verbindung kann erst einem vorhandenen
              Lieferanten zugeordnet werden.
            </p>
          </div>
        ) : (
          <Form
            method="post"
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.1fr 1fr 1fr 1fr 1fr auto",
              gap: 12,
              alignItems: "end",
              padding: 18,
              border: "1px solid #dbe7e2",
              borderRadius: 16,
              background: "#f8fbfa",
            }}
          >
            <input
              type="hidden"
              name="intent"
              value="createConnection"
            />

            <label>
              Lieferant
              <select
                name="supplierId"
                style={inputStyle}
                required
              >
                <option value="">
                  Lieferant auswählen
                </option>

                {data.suppliers
                  .filter((supplier: any) => supplier.active)
                  .map((supplier: any) => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {supplier.name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Verbindungstyp
              <select
                name="connectionType"
                style={inputStyle}
                defaultValue="MANUAL"
              >
                <option value="API">API</option>
                <option value="PUNCHOUT">
                  PunchOut
                </option>
                <option value="BMECAT">BMEcat</option>
                <option value="CXML">cXML</option>
                <option value="EDI">EDI</option>
                <option value="CSV">CSV</option>
                <option value="EXCEL">Excel</option>
                <option value="EMAIL">E-Mail</option>
                <option value="MANUAL">Manuell</option>
              </select>
            </label>

            <label>
              Bezeichnung
              <input
                name="label"
                placeholder="z. B. Metro Berlin"
                style={inputStyle}
              />
            </label>

            <label>
              Kundennummer
              <input
                name="customerNumber"
                placeholder="optional"
                style={inputStyle}
              />
            </label>

            <label>
              Intervall
              <select
                name="syncIntervalMinutes"
                style={inputStyle}
                defaultValue="1440"
              >
                <option value="60">stündlich</option>
                <option value="360">alle 6 Stunden</option>
                <option value="720">alle 12 Stunden</option>
                <option value="1440">täglich</option>
              </select>
            </label>

            <button
              className="primaryButton"
              type="submit"
            >
              Verbindung anlegen
            </button>
          </Form>
        )}

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 18,
          }}
        >
          {data.connections.length === 0 ? (
            <div className="noteBox">
              <strong>
                Noch keine Verbindung eingerichtet
              </strong>
              <p>
                Lege zunächst eine manuelle Verbindung oder
                einen Preislisten-Import an.
              </p>
            </div>
          ) : (
            data.connections.map((connection: any) => {
              const lastSync =
                connection.syncRuns[0] || null;

              const statusLabel =
                connection.status === "ACTIVE"
                  ? "Aktiv"
                  : connection.status === "CONFIGURED"
                    ? "Eingerichtet"
                    : connection.status === "ERROR"
                      ? "Fehler"
                      : connection.status === "PAUSED"
                        ? "Pausiert"
                        : "Nicht verbunden";

              return (
                <article
                  key={connection.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px, 1fr) 130px 150px 150px minmax(180px, 1fr)",
                    gap: 16,
                    alignItems: "center",
                    padding: 16,
                    border: "1px solid #dbe7e2",
                    borderRadius: 14,
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong>
                      {connection.supplierName}
                    </strong>
                    <span>
                      {connection.label ||
                        connection.type}
                    </span>
                    <small>
                      Kundennummer:{" "}
                      {connection.customerNumber || "-"}
                    </small>
                  </div>

                  <div>
                    <small>Typ</small>
                    <strong
                      style={{
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      {connection.type}
                    </strong>
                  </div>

                  <div>
                    <small>Status</small>
                    <strong
                      style={{
                        display: "block",
                        marginTop: 4,
                        color:
                          connection.status === "ACTIVE"
                            ? "#087b59"
                            : connection.status === "ERROR"
                              ? "#b91c1c"
                              : "#596d66",
                      }}
                    >
                      {statusLabel}
                    </strong>
                  </div>

                  <div>
                    <small>Katalogartikel</small>
                    <strong
                      style={{
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      {connection._count.catalogItems}
                    </strong>
                  </div>

                  <div>
                    <small>Letzte Synchronisierung</small>
                    <strong
                      style={{
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      {lastSync?.startedAt
                        ? new Date(
                            lastSync.startedAt
                          ).toLocaleString("de-DE")
                        : "Noch nicht synchronisiert"}
                    </strong>

                    {lastSync?.errorMessage ? (
                      <span
                        style={{
                          display: "block",
                          marginTop: 4,
                          color: "#b91c1c",
                        }}
                      >
                        {lastSync.errorMessage}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
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
