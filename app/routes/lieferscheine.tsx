import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("de-DE");
  } catch {
    return "-";
  }
}

function emptyData(error: string | null = null) {
  return {
    tenantName: "Gastario",
    orders: [],
    stats: {
      orders: 0,
      positions: 0,
    },
    error,
  };
}

export function meta() {
  return [{ title: "Lieferscheine · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  try {
    const { prisma } = await import("../lib/prisma.server");
    const { getTenantAccess } = await import("../lib/features.server");

    const access = await getTenantAccess(request);

    if (!access?.tenantId) {
      return emptyData("Kein Mandant gefunden.");
    }

    const url = new URL(request.url);

    const requestedDate =
      url.searchParams.get("date") || "";

    const requestedOrderId =
      url.searchParams.get("orderId") || "";

    const orders = await prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
        ...(requestedOrderId
          ? { id: requestedOrderId }
          : {}),
        status: {
          in: [
            "CONFIRMED",
            "IN_PRODUCTION",
            "PACKING_OPEN",
            "DELIVERED",
          ] as any,
        },
      },
      include: {
        items: true,
      },
      orderBy: [
        { deliveryDate: "asc" },
        { deliveryTimeText: "asc" },
        { createdAt: "desc" },
      ],
      take: requestedOrderId ? 1 : 300,
    });

    const selectedDate =
      requestedDate ||
      normalizeDate(
        orders.find(
          (order: any) =>
            normalizeDate(order.deliveryDate)
        )?.deliveryDate
      ) ||
      todayInput();

    const relevantOrders = requestedOrderId
      ? orders
      : orders.filter((order: any) => {
          const date =
            normalizeDate(order.deliveryDate);

          return date === selectedDate;
        });

    return {
      tenantName:
        access.tenant?.name || "Gastario",
      selectedDate,
      orders: relevantOrders,
      stats: {
        orders: relevantOrders.length,
        positions: relevantOrders.reduce(
          (sum: number, order: any) =>
            sum +
            Number((order.items || []).length),
          0
        ),
      },
      error: null,
    };
  } catch (error: any) {
    console.error(
      "Lieferscheine loader error:",
      error
    );

    return emptyData(
      error?.message ||
        "Lieferscheine konnten nicht geladen werden."
    );
  }
}

function CheckItem({ text }: { text: string }) {
  return (
    <div style={checkItemStyle}>
      <span style={checkBoxStyle}></span>
      <span>{text}</span>
    </div>
  );
}

export default function DeliveryNotesPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <style>{printCss}</style>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Lieferscheine</h1>
          <span className="pageSubline">
            {data.tenantName} · einfache Lieferscheine aus Auftraegen.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton" type="button" onClick={() => window.print()}>
            Drucken
          </button>
          <Link className="primaryButton" to="/lieferungen">
            Zu Lieferungen
          </Link>
        </div>
      </header>

      {data.error ? (
        <section className="panel">
          <div className="noteBox">
            <strong>Hinweis</strong>
            <p>{data.error}</p>
          </div>
        </section>
      ) : null}

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Lieferscheine</p>
            <strong>{data.stats.orders}</strong>
            <span>fuer diesen Tag</span>
          </div>
          <small data-trend="aktiv">Dokument</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Positionen</p>
            <strong>{data.stats.positions}</strong>
            <span>gesamt</span>
          </div>
          <small data-trend="bereit">Liste</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Dokumente</p>
            <h2>Lieferscheine</h2>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {data.orders.length === 0 ? (
            <div className="noteBox">
              <strong>Keine Lieferscheine gefunden.</strong>
              <p>Es gibt keine passenden Auftraege fuer diesen Tag.</p>
            </div>
          ) : (
            data.orders.map((order: any) => (
              <article key={order.id} style={{
                background: "white",
                border: "1px solid #dbe5ee",
                borderRadius: 22,
                padding: 22
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 18,
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: 16,
                  marginBottom: 16,
                  alignItems: "flex-start"
                }}>
                  <div>
                    <p className="eyebrow">Lieferschein</p>
                    <h2 style={{ margin: 0 }}>{order.orderNumber || order.id}</h2>
                    <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 800 }}>
                      {formatDate(order.deliveryDate)} ? {order.deliveryTimeText || "-"} Uhr
                    </p>

                    {String(order.status || "").toUpperCase() === "AUTO_CREATED" ? (
                      <div style={{
                        display: "inline-flex",
                        marginTop: 10,
                        border: "1px solid #fed7aa",
                        background: "#fff7ed",
                        color: "#9a3412",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 900
                      }}>
                        Automatisch aus Import vorbereitet
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                    <strong>{data.tenantName}</strong>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Link className="ghostButton" to={"/auftrag-pruefung/" + order.id}>
                        Auftrag oeffnen
                      </Link>

                      <button className="secondaryButton" type="button" onClick={() => window.print()}>
                        Drucken
                      </button>
                    </div>
                  </div>
                </div>

                <div className="routeDetails">
                  <p>
                    <b>Kunde</b>
                    <span>{order.customerName || "Ohne Kunde"}</span>
                  </p>
                  <p>
                    <b>Adresse</b>
                    <span>{order.deliveryAddress || "Keine Adresse eingetragen"}</span>
                  </p>
                  <p>
                    <b>Kontakt</b>
                    <span>{order.contactName || "-"} · {order.contactPhone || order.customerPhone || "-"}</span>
                  </p>
                </div>

                {String(order.status || "").toUpperCase() === "AUTO_CREATED" ? (
                  <div className="noteBox" style={{ marginTop: 16 }}>
                    <strong>Noch nicht uebernommen</strong>
                    <p>
                      Dieser Lieferschein wurde automatisch aus dem Import vorbereitet.
                      Bitte den Auftrag auf der Pruefseite kontrollieren und danach uebernehmen.
                    </p>
                  </div>
                ) : null}

                <div className="purchaseDemandTable" style={{ marginTop: 16 }}>
                  <div className="purchaseDemandHead">
                    <span>Position</span>
                    <span>Menge</span>
                    <span>Einheit</span>
                    <span></span>
                    <span></span>
                  </div>

                  {(order.items || []).map((item: any) => (
                    <div className="purchaseDemandRow" key={item.id || item.name}>
                      <strong>{item.name || "Position"}</strong>
                      <span>{item.quantity || 0}</span>
                      <span>{item.unit || "Stueck"}</span>
                      <span></span>
                      <span></span>
                    </div>
                  ))}
                </div>

                <section style={deliveryCheckSectionStyle}>
                  <h3 style={checkTitleStyle}>Vor der Lieferung pr?fen</h3>

                  <div style={checkGridStyle}>
                    <CheckItem text="Alle Positionen laut Liste gepackt" />
                    <CheckItem text="Mengen kontrolliert" />
                    <CheckItem text="Kalte Speisen gek?hlt" />
                    <CheckItem text="Warme Speisen transportbereit" />
                    <CheckItem text="Allergene / Hinweise gepr?ft" />
                    <CheckItem text="Besteck / Servietten / Zubeh?r gepr?ft" />
                    <CheckItem text="Lieferadresse gepr?ft" />
                    <CheckItem text="Ansprechpartner / Telefonnummer gepr?ft" />
                  </div>
                </section>

                <section style={deliveryCheckSectionStyle}>
                  <h3 style={checkTitleStyle}>Fahrer-Check</h3>

                  <div style={checkGridStyle}>
                    <CheckItem text="Fahrzeug beladen" />
                    <CheckItem text="Ware transportsicher verstaut" />
                    <CheckItem text="Lieferzeit eingehalten" />
                    <CheckItem text="Kunde bei Ankunft informiert" />
                  </div>
                </section>

                <section style={deliveryCheckSectionStyle}>
                  <h3 style={checkTitleStyle}>?bergabe beim Kunden</h3>

                  <div style={checkGridStyle}>
                    <CheckItem text="Ware vollst?ndig ?bergeben" />
                    <CheckItem text="Aufbau / Ablageort abgestimmt" />
                    <CheckItem text="Besonderheiten notiert" />
                    <CheckItem text="Empfang best?tigt" />
                  </div>
                </section>

                <div style={signatureGridStyle}>
                  <div style={signatureBoxStyle}>
                    <span>Fahrer / ?bergabe</span>
                  </div>

                  <div style={signatureBoxStyle}>
                    <span>Kunde / Empfang</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </AppLayout>
  );
}


const deliveryCheckSectionStyle: React.CSSProperties = {
  marginTop: 22,
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  background: "#ffffff",
};

const checkTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
};

const checkGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const checkItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#0f172a",
  fontWeight: 750,
  fontSize: 13,
};

const checkBoxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  border: "2px solid #0f766e",
  borderRadius: 4,
  display: "inline-block",
  flex: "0 0 auto",
};

const signatureGridStyle: React.CSSProperties = {
  marginTop: 30,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
};

const signatureBoxStyle: React.CSSProperties = {
  borderTop: "1px solid #64748b",
  paddingTop: 10,
  minHeight: 54,
  color: "#475569",
  fontWeight: 850,
};


const printCss = `
@media print {
  body {
    background: #ffffff !important;
  }

  aside,
  nav,
  .sidebar,
  .topActions,
  .orderSummaryGrid,
  .panelHeader {
    display: none !important;
  }

  main,
  section,
  article {
    box-shadow: none !important;
  }

  article {
    page-break-inside: avoid;
  }

  .panel {
    border: none !important;
    padding: 0 !important;
  }

  @page {
    size: A4;
    margin: 14mm;
  }
}
`;
