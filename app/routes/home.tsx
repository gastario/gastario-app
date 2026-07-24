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


function isLikelyOrderEmail(mail: any) {
  const subject = String(mail?.subject || "").toLowerCase();

  const positiveSignals = [
    "fast track order best?tigt",
    "fast track order bestaetigt",
    "order best?tigt",
    "order bestaetigt",
    "auftrag best?tigt",
    "auftrag bestaetigt",
    "auftragsbest?tigung",
    "auftragsbestaetigung",
  ];

  return positiveSignals.some((signal) => subject.includes(signal));
}


function centsToEuro(value: number | null | undefined) {
  const amount = Number(value || 0) / 100;

  return amount.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function percentChange(current: number, previous: number) {
  if (!previous) {
    return current > 0 ? "+100%" : "0%";
  }

  const value = ((current - previous) / previous) * 100;
  const sign = value > 0 ? "+" : "";

  return sign + value.toFixed(1).replace(".", ",") + "%";
}

export function meta() {
  return [
    { title: "Dashboard ? Gastario" },
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
      emailInbox: [],
      finance: {
        currentMonthGrossCents: 0,
        previousMonthGrossCents: 0,
        monthChangeLabel: "0%",
        openInvoiceCount: 0,
        openInvoiceGrossCents: 0,
        ordersWithoutInvoice: 0,
      },
      taxAdvisor: {
        draftInvoices: 0,
        missingInvoiceSettings: 0,
        readyScore: 0,
      },
    };
  }

  const { start, end } = todayRange();

  const reviewPeriodStart = new Date();
  reviewPeriodStart.setDate(
    reviewPeriodStart.getDate() - 7
  );
  reviewPeriodStart.setHours(0, 0, 0, 0);

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
        status: {
          in: [
            "AUTO_CREATED",
            "REVIEW_NEEDED",
          ] as any,
        },
        createdAt: {
          gte: reviewPeriodStart,
        },
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
        status: {
          in: [
            "AUTO_CREATED",
            "REVIEW_NEEDED",
          ] as any,
        },
        createdAt: {
          gte: reviewPeriodStart,
        },
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

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    currentMonthInvoices,
    previousMonthInvoices,
    openInvoices,
    ordersWithoutInvoice,
    draftInvoices,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        tenantId: access.tenantId,
        invoiceDate: {
          gte: currentMonthStart,
          lt: nextMonthStart,
        },
        cancelledAt: null,
      },
      _sum: {
        grossTotalCents: true,
      },
    }).catch(() => ({ _sum: { grossTotalCents: 0 } })),

    prisma.invoice.aggregate({
      where: {
        tenantId: access.tenantId,
        invoiceDate: {
          gte: previousMonthStart,
          lt: currentMonthStart,
        },
        cancelledAt: null,
      },
      _sum: {
        grossTotalCents: true,
      },
    }).catch(() => ({ _sum: { grossTotalCents: 0 } })),

    prisma.invoice.findMany({
      where: {
        tenantId: access.tenantId,
        paidAt: null,
        cancelledAt: null,
      },
      select: {
        grossTotalCents: true,
      },
      take: 1000,
    }).catch(() => []),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: {
          in: ["CONFIRMED", "IN_PRODUCTION", "PACKING_OPEN", "DELIVERED"] as any,
        },
        billingMode: {
          in: [
            "UNDECIDED",
            "DIRECT_INVOICE",
          ] as any,
        },
        billingStatus: {
          in: [
            "NOT_BILLED",
            "READY_TO_INVOICE",
          ] as any,
        },
        invoices: {
          none: {},
        },
      },
    }).catch(() => 0),

    prisma.invoice.count({
      where: {
        tenantId: access.tenantId,
        status: "DRAFT" as any,
      },
    }).catch(() => 0),
  ]);

  const currentMonthGrossCents = Number(currentMonthInvoices._sum.grossTotalCents || 0);
  const previousMonthGrossCents = Number(previousMonthInvoices._sum.grossTotalCents || 0);
  const openInvoiceGrossCents = openInvoices.reduce(
    (sum: number, invoice: any) => sum + Number(invoice.grossTotalCents || 0),
    0
  );

  const requiredInvoiceSettings = [
    access.tenant.invoiceSellerName,
    access.tenant.invoiceSellerAddress,
    access.tenant.invoiceIban,
    access.tenant.invoiceBic,
  ];

  const hasTaxNumber = Boolean(access.tenant.invoiceTaxNumber || access.tenant.invoiceVatId);

  const missingInvoiceSettings =
    requiredInvoiceSettings.filter((value: any) => !String(value || "").trim()).length +
    (hasTaxNumber ? 0 : 1);

  const openTaxTasks =
    Number(ordersWithoutInvoice || 0) +
    Number(openInvoices.length || 0) +
    Number(draftInvoices || 0) +
    Number(missingInvoiceSettings || 0);

  const readyScore = Math.max(0, Math.min(100, 100 - openTaxTasks * 10));

  const rawEmailInbox = await prisma.incomingEmail.findMany({
    where: {
      tenantId: access.tenantId,
      status: {
        in: ["RECEIVED", "REVIEW_NEEDED", "FAILED"] as any,
      },
      orders: {
        none: {},
      },
    },
    orderBy: {
      receivedAt: "desc",
    },
    take: 25,
  }).catch(() => []);

  const emailInbox = rawEmailInbox.filter(isLikelyOrderEmail).slice(0, 5);

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
    emailInbox,
    finance: {
      currentMonthGrossCents,
      previousMonthGrossCents,
      monthChangeLabel: percentChange(currentMonthGrossCents, previousMonthGrossCents),
      openInvoiceCount: openInvoices.length,
      openInvoiceGrossCents,
      ordersWithoutInvoice,
    },
    taxAdvisor: {
      draftInvoices,
      missingInvoiceSettings,
      readyScore,
    },
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
            <h1>Betriebsüberblick</h1>
            <p>
              {data.tenant?.name} – alles Wichtige für heute an einem Ort.
            </p>
          </div>

          <div className="dashActions">
            <Link to="/auftragseingang">Auftragseingang</Link>
            <Link to="/auftragseingang" data-primary="true">Neuer Auftrag</Link>
          </div>
        </header>

        <section className="todayStrip">
          <Link to="/auftragseingang" className="todayItem" data-highlight="true">
            <span>Zu prüfen</span>
            <strong>{data.counts.openOrders}</strong>
            <small>Neue und ungeprüfte Aufträge</small>
          </Link>

          <Link to="/auftraege" className="todayItem">
            <span>Heute</span>
            <strong>{data.counts.ordersToday}</strong>
            <small>Aufträge nach Lieferdatum</small>
          </Link>

          <Link to="/auftraege" className="todayItem">
            <span>Bestätigt</span>
            <strong>{data.counts.confirmedOrders}</strong>
            <small>operative Aufträge</small>
          </Link>

          <Link to="/lager" className="todayItem">
            <span>Lager</span>
            <strong>{data.counts.lowInventory}</strong>
            <small>Warnungen</small>
          </Link>
        </section>

        <section className="managementGrid">
        <section className="financePanel">
          <div className="financeHead">
            <div>
              <p className="eyebrow">Finanzen</p>
              <h2>Finanzen</h2>
              <span>Umsatz, offene Rechnungen und Abrechnungsstand.</span>
            </div>
            <Link to="/rechnungen">Rechnungen öffnen</Link>
          </div>

          <div className="financeGrid">
            <div>
              <span>Umsatz diesen Monat</span>
              <strong>{centsToEuro(data.finance.currentMonthGrossCents)}</strong>
              <small>nach Rechnungsdatum</small>
            </div>

            <div>
              <span>Vormonat</span>
              <strong>{centsToEuro(data.finance.previousMonthGrossCents)}</strong>
              <small>{data.finance.monthChangeLabel} zum Vormonat</small>
            </div>

            <div>
              <span>Offene Rechnungen</span>
              <strong>{data.finance.openInvoiceCount}</strong>
              <small>{centsToEuro(data.finance.openInvoiceGrossCents)} offen</small>
            </div>

            <div>
              <span>Ohne Rechnung</span>
              <strong>{data.finance.ordersWithoutInvoice}</strong>
              <small>übernommene Aufträge</small>
            </div>
          </div>
        </section>

        <section className="taxPanel">
          <div className="taxHead">
            <div>
              <p className="eyebrow">Steuerberater</p>
              <h2>Monatsabschluss</h2>
              <span>Was noch offen ist, bevor der Monat sauber übergeben werden kann.</span>
            </div>

            <Link to="/einstellungen/rechnungen">Rechnungsdaten prüfen</Link>
          </div>

          <div className="taxGrid">
            <Link to="/auftraege" className="taxTask">
              <span>Aufträge ohne Rechnung</span>
              <strong>{data.finance.ordersWithoutInvoice}</strong>
              <small>übernommene Aufträge</small>
            </Link>

            <Link to="/rechnungen" className="taxTask">
              <span>Offene Rechnungen</span>
              <strong>{data.finance.openInvoiceCount}</strong>
              <small>{centsToEuro(data.finance.openInvoiceGrossCents)} offen</small>
            </Link>

            <Link to="/rechnungen" className="taxTask">
              <span>Entwurfsrechnungen</span>
              <strong>{data.taxAdvisor.draftInvoices}</strong>
              <small>noch nicht finalisiert</small>
            </Link>

            <Link to="/einstellungen/rechnungen" className="taxTask">
              <span>Fehlende Stammdaten</span>
              <strong>{data.taxAdvisor.missingInvoiceSettings}</strong>
              <small>Rechnungsdaten prüfen</small>
            </Link>
          </div>
        </section>

        </section>

        <section className="dashGrid">
          <article className="dashCard">
            <div className="cardHead">
              <div>
                <p className="eyebrow">Tagesplan</p>
                <h2>Nächste Aufträge heute</h2>
              </div>
              <Link to="/auftraege">Bevorstehende öffnen</Link>
            </div>

            {data.todayOrders.length === 0 ? (
              <div className="emptyState">
                <strong>Keine Aufträge heute</strong>
                <span>Heute ist kein Auftrag mit Lieferdatum geplant.</span>
              </div>
            ) : (
              <div className="cleanTable">
                <div className="cleanTableHead">
                  <span>Zeit</span>
                  <span>Kunde</span>
                  <span>Auftrag</span>
                  <span>Status</span>
                </div>

                {data.todayOrders.map((order: any) => (
                  <Link className="cleanTableRow" to={"/auftrag-pruefung/" + order.id} key={order.id}>
                    <span>{formatTime(order.deliveryTime)}</span>
                    <strong>{order.customerName}</strong>
                    <span>{order.eventName || order.orderNumber} ? {order.items.length} Positionen</span>
                    <em>{order.status}</em>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <aside className="rightColumn">
            <article className="dashCard">
              <div className="cardHead">
                <div>
                  <p className="eyebrow">Auftragseingang</p>
                  <h2>Prüfung offen</h2>
                </div>
                <Link to="/auftragseingang">Alle</Link>
              </div>

              <div className="inboxList">
                {data.openOrders.length === 0 && data.emailInbox.length === 0 ? (
                  <div className="inboxItem">
                    <strong>Nichts offen</strong>
                    <span>Keine neuen Aufträge oder E-Mails in Prüfung.</span>
                  </div>
                ) : null}

                {data.openOrders.map((order: any) => (
                  <Link className="inboxItem" to={"/auftrag-pruefung/" + order.id} key={order.id}>
                    <strong>{order.customerName || "Prüfauftrag"}</strong>
                    <span>{order.source} ? {order.orderNumber}</span>
                  </Link>
                ))}

                {data.emailInbox.map((mail: any) => (
                  <Link className="inboxItem" to={"/email-pruefung/" + mail.id} key={mail.id} data-mail="true">
                    <strong>{mail.subject || "E-Mail ohne Betreff"}</strong>
                    <span>{mail.sender || "Unbekannter Absender"} ? Erkennung nötig</span>
                  </Link>
                ))}
              </div>
            </article>

            <article className="dashCard compactCard">
              <div className="cardHead">
                <div>
                  <p className="eyebrow">Lager</p>
                  <h2>Mindestbestand</h2>
                </div>
                <Link to="/lager">Öffnen</Link>
              </div>

              <div className="inboxList">
                {data.lowInventoryItems.length === 0 ? (
                  <div className="inboxItem">
                    <strong>Keine Warnung</strong>
                    <span>Alle Lagerartikel sind über dem Mindestbestand.</span>
                  </div>
                ) : (
                  data.lowInventoryItems.map((item: any) => (
                    <Link className="inboxItem" to="/lager" key={item.id}>
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
    gap: 16px;
    width: 100%;
  }

  .dashHeader {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
  }

  .dashHeader h1 {
    margin: 3px 0 0;
    color: #0f172a;
    font-size: clamp(30px, 3vw, 38px);
    line-height: 1.05;
    letter-spacing: -0.045em;
    font-weight: 800;
  }

  .dashHeader p:not(.eyebrow) {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 14px;
    font-weight: 600;
  }

  .dashActions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    flex-wrap: wrap;
  }

  .dashActions a,
  .cardHead a,
  .financeHead a,
  .taxHead a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    border: 1px solid #d5dee5;
    background: #ffffff;
    color: #0f172a;
    border-radius: 10px;
    padding: 8px 13px;
    font-size: 13px;
    line-height: 1;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    box-shadow: 0 3px 10px rgba(15, 23, 42, 0.035);
    transition:
      border-color 160ms ease,
      background 160ms ease,
      transform 160ms ease;
  }

  .dashActions a:hover,
  .cardHead a:hover,
  .financeHead a:hover,
  .taxHead a:hover {
    border-color: #94a3b8;
    background: #f8fafc;
    transform: translateY(-1px);
  }

  .dashActions a[data-primary="true"] {
    border-color: #087f6c;
    background: #087f6c;
    color: #ffffff;
  }

  .dashActions a[data-primary="true"]:hover {
    border-color: #066b5c;
    background: #066b5c;
  }

  .todayStrip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .todayItem {
    position: relative;
    display: grid;
    align-content: start;
    gap: 6px;
    min-height: 108px;
    padding: 16px 17px;
    border: 1px solid #dce5ea;
    border-radius: 14px;
    background: #ffffff;
    color: #0f172a;
    text-decoration: none;
    box-shadow: 0 7px 20px rgba(15, 23, 42, 0.035);
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      transform 160ms ease;
  }

  .todayItem:hover {
    border-color: #b8c6cf;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
    transform: translateY(-1px);
  }

  .todayItem[data-highlight="true"] {
    border-color: #9dd7ec;
    background: linear-gradient(145deg, #f0faff 0%, #ffffff 100%);
  }

  .todayItem span {
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  .todayItem strong {
    color: #0f172a;
    font-size: 30px;
    line-height: 1;
    letter-spacing: -0.045em;
    font-weight: 800;
  }

  .todayItem small {
    color: #64748b;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 600;
  }

  .managementGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    align-items: stretch;
  }

  .financePanel,
  .taxPanel,
  .dashCard {
    border: 1px solid #dce5ea;
    border-radius: 16px;
    background: #ffffff;
    padding: 18px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  }

  .taxPanel {
    border-color: #efd9ae;
  }

  .financeHead,
  .taxHead,
  .cardHead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    margin-bottom: 14px;
  }

  .financeHead h2,
  .taxHead h2,
  .cardHead h2 {
    margin: 3px 0 0;
    color: #0f172a;
    font-size: 20px;
    line-height: 1.15;
    letter-spacing: -0.025em;
    font-weight: 800;
  }

  .financeHead span,
  .taxHead span {
    display: block;
    margin-top: 5px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.4;
    font-weight: 600;
  }

  .taxHead a {
    border-color: #e8bc61;
    color: #8a4b08;
  }

  .financeGrid,
  .taxGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .financeGrid > div,
  .taxTask {
    display: grid;
    align-content: start;
    gap: 5px;
    min-height: 86px;
    padding: 13px 14px;
    border: 1px solid #e1e8ed;
    border-radius: 12px;
    background: #f8fafc;
  }

  .taxTask {
    border-color: #f0d6a7;
    background: #fffaf2;
    color: #0f172a;
    text-decoration: none;
    transition:
      border-color 160ms ease,
      background 160ms ease;
  }

  .taxTask:hover {
    border-color: #e6b85e;
    background: #fff7e8;
  }

  .financeGrid span,
  .taxTask span {
    color: #64748b;
    font-size: 12px;
    line-height: 1.25;
    font-weight: 800;
  }

  .taxTask span {
    color: #92500b;
  }

  .financeGrid strong,
  .taxTask strong {
    color: #0f172a;
    font-size: 23px;
    line-height: 1;
    letter-spacing: -0.035em;
    font-weight: 800;
  }

  .financeGrid small,
  .taxTask small {
    color: #64748b;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 600;
  }

  .dashGrid {
    display: grid;
    grid-template-columns:
      minmax(0, 1.65fr)
      minmax(390px, 0.85fr);
    gap: 16px;
    align-items: start;
  }

  .rightColumn {
    display: grid;
    gap: 16px;
  }

  .compactCard {
    padding-bottom: 16px;
  }

  .emptyState {
    display: grid;
    gap: 5px;
    min-height: 84px;
    padding: 18px 20px;
    border: 1px dashed #cbd5df;
    border-radius: 12px;
    background: #f8fafc;
  }

  .emptyState strong {
    color: #0f172a;
    font-size: 16px;
    line-height: 1.3;
    font-weight: 750;
  }

  .emptyState span {
    color: #64748b;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 600;
  }

  .cleanTable {
    overflow: hidden;
    border: 1px solid #e1e8ed;
    border-radius: 12px;
  }

  .cleanTableHead,
  .cleanTableRow {
    display: grid;
    grid-template-columns:
      76px
      minmax(130px, 1fr)
      minmax(180px, 1.5fr)
      105px;
    gap: 12px;
    align-items: center;
  }

  .cleanTableHead {
    padding: 11px 13px;
    background: #f8fafc;
    color: #64748b;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.045em;
  }

  .cleanTableRow {
    padding: 13px;
    border-top: 1px solid #e5ebef;
    color: #0f172a;
    font-size: 13px;
    font-weight: 650;
    text-decoration: none;
    transition: background 150ms ease;
  }

  .cleanTableRow:hover {
    background: #f8fafc;
  }

  .cleanTableRow em {
    justify-self: start;
    padding: 5px 8px;
    border-radius: 7px;
    background: #edf9f3;
    color: #17704e;
    font-size: 11px;
    font-style: normal;
    font-weight: 800;
  }

  .inboxList {
    display: grid;
    gap: 8px;
  }

  .inboxItem {
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 12px 13px;
    border: 1px solid #e1e8ed;
    border-radius: 11px;
    background: #f8fafc;
    color: #0f172a;
    text-decoration: none;
    transition:
      border-color 150ms ease,
      background 150ms ease,
      transform 150ms ease;
  }

  .inboxItem:hover {
    border-color: #b9c7d0;
    background: #ffffff;
    transform: translateY(-1px);
  }

  .inboxItem strong {
    overflow: hidden;
    color: #0f172a;
    font-size: 14px;
    line-height: 1.35;
    font-weight: 750;
    text-overflow: ellipsis;
  }

  .inboxItem span {
    overflow: hidden;
    color: #64748b;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 650;
    text-overflow: ellipsis;
  }

  .inboxItem[data-mail="true"] {
    border-color: #eed6ac;
    background: #fffaf2;
  }

  .inboxItem[data-mail="true"] strong {
    color: #80460b;
  }

  @media (max-width: 1180px) {
    .dashGrid {
      grid-template-columns:
        minmax(0, 1.45fr)
        minmax(320px, 0.8fr);
    }

    .todayStrip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 980px) {
    .managementGrid,
    .dashGrid {
      grid-template-columns: 1fr;
    }

    .rightColumn {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .dashHeader {
      display: grid;
    }

    .dashActions {
      justify-content: flex-start;
    }

    .todayStrip,
    .financeGrid,
    .taxGrid,
    .rightColumn {
      grid-template-columns: 1fr;
    }

    .cleanTableHead {
      display: none;
    }

    .cleanTableRow {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .financeHead,
    .taxHead,
    .cardHead {
      align-items: stretch;
      flex-direction: column;
    }

    .financeHead a,
    .taxHead a,
    .cardHead a {
      align-self: flex-start;
    }
  }
`;