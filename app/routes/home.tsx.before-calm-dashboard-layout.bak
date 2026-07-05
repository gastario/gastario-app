import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function formatTime(value: string | null | undefined) {
  return value || "-";
}

export function meta() {
  return [
    { title: "Dashboard · Gastario" },
    {
      name: "description",
      content:
        "Gastario ist die Betriebssoftware fuer Caterer: Auftraege, Produktion, Einkauf, Lager und Lieferung an einem Ort.",
    },
  ];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId || !access.tenant) {
    return {
      tenant: null,
      setupError: access.setupError || "Kein Mandant gefunden.",
      counts: {
        ordersToday: 0,
        openOrders: 0,
        confirmedOrders: 0,
        customers: 0,
        products: 0,
        suppliers: 0,
        inventoryItems: 0,
        lowInventory: 0,
      },
      todayOrders: [],
      openOrders: [],
      lowInventoryItems: [],
      features: [],
    };
  }

  const { start, end } = todayRange();

  const [
    ordersToday,
    openOrdersCount,
    confirmedOrders,
    customers,
    products,
    suppliers,
    inventoryItems,
    lowInventoryItems,
    todayOrders,
    openOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        deliveryDate: {
          gte: start,
          lt: end,
        },
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: "AUTO_CREATED" as any,
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: "CONFIRMED" as any,
      },
    }).catch(() => 0),

    prisma.customer.count({
      where: {
        tenantId: access.tenantId,
      },
    }).catch(() => 0),

    prisma.product.count({
      where: {
        tenantId: access.tenantId,
      },
    }).catch(() => 0),

    prisma.supplier.count({
      where: {
        tenantId: access.tenantId,
        active: true,
      },
    }).catch(() => 0),

    prisma.inventoryItem.count({
      where: {
        tenantId: access.tenantId,
        active: true,
      },
    }).catch(() => 0),

    prisma.inventoryItem.findMany({
      where: {
        tenantId: access.tenantId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
      take: 50,
    }).catch(() => []),

    prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
        deliveryDate: {
          gte: start,
          lt: end,
        },
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: [
        { deliveryTime: "asc" },
        { createdAt: "desc" },
      ],
      take: 8,
    }).catch(() => []),

    prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
        status: "AUTO_CREATED" as any,
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
    }).catch(() => []),
  ]);

  const lowItems = lowInventoryItems.filter((item: any) => {
    return item.minStock > 0 && item.currentStock <= item.minStock;
  });

  return {
    tenant: access.tenant,
    setupError: null,
    counts: {
      ordersToday,
      openOrders: openOrdersCount,
      confirmedOrders,
      customers,
      products,
      suppliers,
      inventoryItems,
      lowInventory: lowItems.length,
    },
    todayOrders,
    openOrders,
    lowInventoryItems: lowItems.slice(0, 6),
    features: access.features,
  };
}

export default function Home() {
  const data = useLoaderData<typeof loader>();

  if (data.setupError) {
    return (
      <AppLayout>
        <header className="topbar">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Einrichtung fehlt</h1>
            <span className="pageSubline">{data.setupError}</span>
          </div>

          <div className="topActions">
            <a className="secondaryButton" href="/logout">Ausloggen</a>
            <a className="primaryButton" href="/login">Neu einloggen</a>
          </div>
        </header>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Hinweis</p>
              <h2>Benutzer ist noch keinem Mandanten zugeordnet</h2>
            </div>
          </div>

          <div className="noteBox">
            <strong>Was jetzt?</strong>
            <p>
              Lege im Super Admin einen Mandanten an oder fuege diesen Benutzer
              einem bestehenden Mandanten als OWNER hinzu.
            </p>
          </div>
        </section>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <style>{dashboardCss}</style>

      <div className="dashPage">
        <header className="dashHeader">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Heute im Betrieb</h1>
            <p>
              {data.tenant?.name} ? dein Tagesueberblick fuer Eingang, Auftraege, Produktion und Lieferung.
            </p>
          </div>

          <div className="dashHeaderActions">
            <Link to="/auftragseingang">Auftragseingang</Link>
            <Link to="/import-pruefen">PDF importieren</Link>
            <Link to="/auftragseingang" data-primary="true">Neuer Auftrag</Link>
          </div>
        </header>

        <section className="dashFocus">
          <div>
            <p className="eyebrow">Prioritaet heute</p>
            <h2>{data.counts.openOrders} Auftraege muessen geprueft werden</h2>
            <p>
              Neue PDF- und E-Mail-Importe zuerst kontrollieren. Erst danach werden sie zu echten Auftraegen
              fuer Produktion, Packlisten, Lieferscheine und Lieferung.
            </p>
          </div>

          <div className="dashFocusSteps">
            <span>Eingang</span>
            <span>Pruefung</span>
            <span>Auftrag</span>
            <span>Produktion</span>
            <span>Lieferung</span>
          </div>
        </section>

        <section className="dashMetrics">
          <Link to="/auftraege" className="dashMetric">
            <span>Heute</span>
            <strong>{data.counts.ordersToday}</strong>
            <small>Auftraege nach Lieferdatum</small>
          </Link>

          <Link to="/auftragseingang" className="dashMetric" data-warn="true">
            <span>Zu pruefen</span>
            <strong>{data.counts.openOrders}</strong>
            <small>offen im Auftragseingang</small>
          </Link>

          <Link to="/auftraege" className="dashMetric">
            <span>Bestaetigt</span>
            <strong>{data.counts.confirmedOrders}</strong>
            <small>operative Auftraege</small>
          </Link>

          <Link to="/lager" className="dashMetric">
            <span>Lager</span>
            <strong>{data.counts.lowInventory}</strong>
            <small>Warnungen unter Mindestbestand</small>
          </Link>
        </section>

        <section className="dashWorkGrid">
          <article className="dashPanel">
            <div className="dashPanelHeader">
              <div>
                <p className="eyebrow">Tagesplan</p>
                <h2>Naechste Auftraege heute</h2>
              </div>
              <Link to="/auftraege">Alle anzeigen</Link>
            </div>

            <div className="dashTable">
              <div className="dashTableHead">
                <span>Zeit</span>
                <span>Kunde</span>
                <span>Auftrag</span>
                <span>Status</span>
              </div>

              {data.todayOrders.length === 0 ? (
                <div className="dashEmpty">
                  <strong>Keine Auftraege heute</strong>
                  <span>Heute ist kein Auftrag mit Lieferdatum geplant.</span>
                </div>
              ) : (
                data.todayOrders.map((order: any) => (
                  <Link className="dashTableRow" to={"/auftrag-pruefung/" + order.id} key={order.id}>
                    <span>{formatTime(order.deliveryTime)}</span>
                    <strong>{order.customerName}</strong>
                    <span>{order.eventName || order.orderNumber} ? {order.items.length} Positionen</span>
                    <em>{order.status}</em>
                  </Link>
                ))
              )}
            </div>
          </article>

          <aside className="dashSide">
            <article className="dashPanel">
              <div className="dashPanelHeader">
                <div>
                  <p className="eyebrow">Auftragseingang</p>
                  <h2>Zu pruefen</h2>
                </div>
                <Link to="/auftragseingang">Oeffnen</Link>
              </div>

              <div className="dashList">
                {data.openOrders.length === 0 ? (
                  <div className="dashListItem">
                    <strong>Nichts offen</strong>
                    <span>Keine Auftraege in Pruefung.</span>
                  </div>
                ) : (
                  data.openOrders.map((order: any) => (
                    <Link className="dashListItem" to={"/auftrag-pruefung/" + order.id} key={order.id}>
                      <strong>{order.customerName}</strong>
                      <span>{order.source} ? {order.orderNumber}</span>
                    </Link>
                  ))
                )}
              </div>
            </article>

            <article className="dashPanel">
              <div className="dashPanelHeader">
                <div>
                  <p className="eyebrow">Lager</p>
                  <h2>Warnungen</h2>
                </div>
                <Link to="/lager">Oeffnen</Link>
              </div>

              <div className="dashList">
                {data.lowInventoryItems.length === 0 ? (
                  <div className="dashListItem">
                    <strong>Alles okay</strong>
                    <span>Keine Artikel unter Mindestbestand.</span>
                  </div>
                ) : (
                  data.lowInventoryItems.map((item: any) => (
                    <Link className="dashListItem" to="/lager" key={item.id}>
                      <strong>{item.name}</strong>
                      <span>{item.currentStock} / Mindest {item.minStock} {item.unit}</span>
                    </Link>
                  ))
                )}
              </div>
            </article>
          </aside>
        </section>
      </div>
    </AppLayout>
  );
}


const dashboardCss = `
  .dashPage {
    display: grid;
    gap: 20px;
  }

  .dashHeader {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
  }

  .dashHeader h1 {
    margin: 4px 0 0;
    font-size: 38px;
    line-height: 1;
    letter-spacing: -0.055em;
    color: #071426;
  }

  .dashHeader p:not(.eyebrow) {
    margin: 8px 0 0;
    color: #64748b;
    font-weight: 700;
    max-width: 820px;
  }

  .dashHeaderActions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .dashHeaderActions a,
  .dashPanelHeader a {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
    border-radius: 999px;
    padding: 10px 14px;
    font-weight: 900;
    text-decoration: none;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
  }

  .dashHeaderActions a[data-primary="true"] {
    border-color: #057a67;
    background: #057a67;
    color: #ffffff;
  }

  .dashFocus {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 20px;
    align-items: center;
    border: 1px solid #dbe5eb;
    background: linear-gradient(135deg, #ffffff 0%, #f4fbf8 100%);
    border-radius: 24px;
    padding: 24px;
    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.06);
  }

  .dashFocus h2 {
    margin: 4px 0 0;
    font-size: 28px;
    letter-spacing: -0.04em;
    color: #071426;
  }

  .dashFocus p:not(.eyebrow) {
    margin: 10px 0 0;
    color: #475569;
    font-weight: 750;
    max-width: 850px;
    line-height: 1.45;
  }

  .dashFocusSteps {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: 360px;
  }

  .dashFocusSteps span {
    background: #e7f5f1;
    color: #056354;
    border: 1px solid #cae9e2;
    border-radius: 999px;
    padding: 8px 11px;
    font-size: 12px;
    font-weight: 900;
  }

  .dashMetrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }

  .dashMetric {
    background: #ffffff;
    border: 1px solid #dbe5eb;
    border-radius: 20px;
    padding: 18px;
    color: #0f172a;
    text-decoration: none;
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
  }

  .dashMetric span {
    color: #64748b;
    font-weight: 900;
    font-size: 13px;
  }

  .dashMetric strong {
    display: block;
    margin-top: 8px;
    font-size: 34px;
    letter-spacing: -0.04em;
  }

  .dashMetric small {
    display: block;
    margin-top: 4px;
    color: #64748b;
    font-weight: 750;
  }

  .dashMetric[data-warn="true"] {
    border-color: #bae6fd;
    background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
  }

  .dashWorkGrid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
    gap: 18px;
    align-items: start;
  }

  .dashSide {
    display: grid;
    gap: 18px;
  }

  .dashPanel {
    background: #ffffff;
    border: 1px solid #dbe5eb;
    border-radius: 22px;
    padding: 20px;
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.06);
  }

  .dashPanelHeader {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .dashPanelHeader h2 {
    margin: 4px 0 0;
    color: #071426;
    font-size: 22px;
    letter-spacing: -0.035em;
  }

  .dashTable {
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    overflow: hidden;
  }

  .dashTableHead,
  .dashTableRow {
    display: grid;
    grid-template-columns: 90px 1.1fr 1.6fr 110px;
    gap: 12px;
    align-items: center;
  }

  .dashTableHead {
    background: #f8fafc;
    color: #64748b;
    padding: 12px 14px;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .dashTableRow {
    padding: 14px;
    border-top: 1px solid #e2e8f0;
    color: #0f172a;
    text-decoration: none;
    font-weight: 750;
  }

  .dashTableRow em {
    justify-self: start;
    background: #f0fdf4;
    color: #166534;
    border-radius: 999px;
    padding: 5px 9px;
    font-style: normal;
    font-size: 12px;
    font-weight: 900;
  }

  .dashEmpty {
    display: grid;
    gap: 4px;
    padding: 24px;
    color: #64748b;
  }

  .dashEmpty strong {
    color: #0f172a;
    font-size: 18px;
  }

  .dashList {
    display: grid;
    gap: 10px;
  }

  .dashListItem {
    display: grid;
    gap: 4px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    border-radius: 16px;
    padding: 14px;
    text-decoration: none;
    color: #0f172a;
  }

  .dashListItem strong {
    font-size: 16px;
  }

  .dashListItem span {
    color: #64748b;
    font-size: 13px;
    font-weight: 750;
  }
`;
