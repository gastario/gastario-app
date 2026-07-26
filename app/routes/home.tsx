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

  /*
   * gastario-dashboard-operations-redesign-20260726
   * Der operative Tagesablauf steht im Dashboard an erster Stelle.
   */
  const todayOrdersSorted = [
    ...data.todayOrders,
  ].sort((left: any, right: any) => {
    return String(
      left.deliveryTime || ""
    ).localeCompare(
      String(right.deliveryTime || ""),
      "de"
    );
  });

  const nextTodayOrder =
    todayOrdersSorted[0] || null;

  const openReviewCount =
    data.openOrders.length +
    data.emailInbox.length;
  return (
    <AppLayout>
      <style>{dashboardCss}</style>

      <div className="dashPage">
        <header className="dashHeader">
          <div>
            <p className="dashEyebrow">
              Dashboard
            </p>

            <h1>Betriebsüberblick</h1>

            <p className="dashIntro">
              {data.tenant?.name} – alle wichtigen
              Lieferungen und Aufgaben für heute.
            </p>
          </div>

          <div className="dashHeaderActions">
            <Link to="/auftragseingang">
              Auftragseingang
            </Link>

            <Link
              to="/auftragseingang"
              className="dashHeaderPrimary"
            >
              Neuer Auftrag
            </Link>
          </div>
        </header>

        <section className="dashTodayHero">
          <div className="dashTodayMain">
            <div className="dashTodayHeading">
              <div>
                <p className="dashEyebrow">
                  Heute im Fokus
                </p>

                <h2>
                  {todayOrdersSorted.length === 0
                    ? "Keine Lieferungen heute"
                    : todayOrdersSorted.length === 1
                      ? "1 Lieferung heute"
                      : `${todayOrdersSorted.length} Lieferungen heute`}
                </h2>

                <p>
                  {nextTodayOrder
                    ? `Die nächste Lieferung ist um ${formatTime(
                        nextTodayOrder.deliveryTime
                      )} Uhr für ${nextTodayOrder.customerName}.`
                    : "Für heute ist aktuell keine Lieferung eingeplant."}
                </p>
              </div>

              <span
                className="dashTodayCount"
                data-empty={
                  todayOrdersSorted.length === 0
                    ? "true"
                    : "false"
                }
              >
                {todayOrdersSorted.length}
              </span>
            </div>

            <div className="dashTodayMetrics">
              <div>
                <span>Nächste Lieferung</span>

                <strong>
                  {nextTodayOrder
                    ? formatTime(
                        nextTodayOrder.deliveryTime
                      )
                    : "–"}
                </strong>

                <small>
                  {nextTodayOrder
                    ? nextTodayOrder.customerName
                    : "Kein Auftrag heute"}
                </small>
              </div>

              <div>
                <span>Prüfung offen</span>
                <strong>{openReviewCount}</strong>
                <small>Aufträge und E-Mails</small>
              </div>

              <div>
                <span>Bestätigt</span>
                <strong>
                  {data.counts.confirmedOrders}
                </strong>
                <small>operative Aufträge</small>
              </div>

              <div>
                <span>Lager</span>
                <strong>
                  {data.counts.lowInventory}
                </strong>
                <small>Warnungen</small>
              </div>
            </div>

            <div className="dashTodayButtons">
              <Link
                to="/auftraege"
                className="dashPrimaryButton"
              >
                Bevorstehende Aufträge
              </Link>

              <Link
                to="/auftragseingang"
                className="dashSecondaryButton"
              >
                Offene Prüfungen
              </Link>
            </div>
          </div>

          <aside className="dashNextCard">
            <p className="dashNextLabel">
              Als Nächstes
            </p>

            {nextTodayOrder ? (
              <>
                <strong className="dashNextTime">
                  {formatTime(
                    nextTodayOrder.deliveryTime
                  )}
                </strong>

                <h3>
                  {nextTodayOrder.customerName}
                </h3>

                <p>
                  {nextTodayOrder.deliveryAddress ||
                    "Lieferadresse noch offen"}
                </p>

                <div className="dashNextTags">
                  <span>
                    {nextTodayOrder.items.length}
                    {" Positionen"}
                  </span>

                  <span>
                    {nextTodayOrder.orderNumber}
                  </span>
                </div>

                <Link
                  to={
                    "/auftrag-pruefung/" +
                    nextTodayOrder.id
                  }
                >
                  Auftrag öffnen
                </Link>
              </>
            ) : (
              <div className="dashNextEmpty">
                <strong>Kein Auftrag heute</strong>

                <span>
                  Der heutige Tagesplan enthält
                  aktuell keine Lieferung.
                </span>
              </div>
            )}
          </aside>
        </section>

        <section className="dashOperationsGrid">
          <article className="dashCard dashDeliveriesCard">
            <div className="dashCardHeader">
              <div>
                <p className="dashEyebrow">
                  Tagesplan
                </p>

                <h2>Heutige Lieferungen</h2>

                <span>
                  Nach Lieferzeit sortiert und direkt
                  für den Tagesbetrieb verfügbar.
                </span>
              </div>

              <Link to="/auftraege">
                Alle Aufträge
              </Link>
            </div>

            {todayOrdersSorted.length === 0 ? (
              <div className="dashEmpty">
                <strong>
                  Keine Aufträge heute
                </strong>

                <span>
                  Heute ist kein Auftrag mit
                  Lieferdatum geplant.
                </span>
              </div>
            ) : (
              <div className="dashDeliveryList">
                {todayOrdersSorted.map(
                  (order: any, index: number) => (
                    <Link
                      className="dashDeliveryRow"
                      to={
                        "/auftrag-pruefung/" +
                        order.id
                      }
                      key={order.id}
                      data-next={
                        index === 0
                          ? "true"
                          : "false"
                      }
                    >
                      <div className="dashDeliveryTime">
                        <strong>
                          {formatTime(
                            order.deliveryTime
                          )}
                        </strong>

                        <span>
                          {index === 0
                            ? "Als Nächstes"
                            : "Heute"}
                        </span>
                      </div>

                      <div className="dashDeliveryMain">
                        <strong>
                          {order.customerName}
                        </strong>

                        <span>
                          {order.eventName ||
                            order.orderNumber}
                        </span>

                        <small>
                          {order.deliveryAddress ||
                            "Lieferadresse offen"}
                        </small>
                      </div>

                      <div className="dashDeliveryAmount">
                        <strong>
                          {order.items.length}
                        </strong>

                        <span>Positionen</span>
                      </div>

                      <em>
                        {String(order.status)
                          .replaceAll("_", " ")}
                      </em>
                    </Link>
                  )
                )}
              </div>
            )}
          </article>

          <aside className="dashSideColumn">
            <article className="dashCard">
              <div className="dashCardHeader">
                <div>
                  <p className="dashEyebrow">
                    Auftragseingang
                  </p>

                  <h2>Prüfung offen</h2>

                  <span>
                    Neue Aufträge und E-Mails,
                    die kontrolliert werden müssen.
                  </span>
                </div>

                <Link to="/auftragseingang">
                  Alle
                </Link>
              </div>

              <div className="dashInboxList">
                {data.openOrders.length === 0 &&
                data.emailInbox.length === 0 ? (
                  <div className="dashInboxItem">
                    <strong>Nichts offen</strong>

                    <span>
                      Aktuell sind keine neuen
                      Aufträge oder E-Mails offen.
                    </span>
                  </div>
                ) : null}

                {data.openOrders.map(
                  (order: any) => (
                    <Link
                      className="dashInboxItem"
                      to={
                        "/auftrag-pruefung/" +
                        order.id
                      }
                      key={order.id}
                    >
                      <strong>
                        {order.customerName ||
                          "Prüfauftrag"}
                      </strong>

                      <span>
                        {order.source}
                        {" · "}
                        {order.orderNumber}
                      </span>
                    </Link>
                  )
                )}

                {data.emailInbox.map(
                  (mail: any) => (
                    <Link
                      className="dashInboxItem"
                      to={
                        "/email-pruefung/" +
                        mail.id
                      }
                      key={mail.id}
                    >
                      <strong>
                        {mail.subject ||
                          "E-Mail ohne Betreff"}
                      </strong>

                      <span>
                        {mail.sender ||
                          "Unbekannter Absender"}
                        {" · Erkennung nötig"}
                      </span>
                    </Link>
                  )
                )}
              </div>
            </article>

            <article className="dashCard">
              <div className="dashCardHeader">
                <div>
                  <p className="dashEyebrow">
                    Lager
                  </p>

                  <h2>Mindestbestand</h2>
                </div>

                <Link to="/lager">
                  Öffnen
                </Link>
              </div>

              <div className="dashInboxList">
                {data.lowInventoryItems.length === 0 ? (
                  <div className="dashInboxItem">
                    <strong>
                      Keine Warnung
                    </strong>

                    <span>
                      Alle Lagerartikel liegen
                      über dem Mindestbestand.
                    </span>
                  </div>
                ) : (
                  data.lowInventoryItems.map(
                    (item: any) => (
                      <Link
                        className="dashInboxItem"
                        to="/lager"
                        key={item.id}
                      >
                        <strong>
                          {item.name}
                        </strong>

                        <span>
                          {item.currentStock}
                          {" / Mindest "}
                          {item.minStock}
                          {" "}
                          {item.unit}
                        </span>
                      </Link>
                    )
                  )
                )}
              </div>
            </article>
          </aside>
        </section>

        <section className="dashManagementGrid">
          <article className="dashCard">
            <div className="dashCardHeader">
              <div>
                <p className="dashEyebrow">
                  Finanzen
                </p>

                <h2>Finanzüberblick</h2>

                <span>
                  Umsatz und offene Abrechnung.
                </span>
              </div>

              <Link to="/rechnungen">
                Rechnungen
              </Link>
            </div>

            <div className="dashFinanceGrid">
              <div>
                <span>Umsatz diesen Monat</span>

                <strong>
                  {centsToEuro(
                    data.finance
                      .currentMonthGrossCents
                  )}
                </strong>

                <small>
                  nach Rechnungsdatum
                </small>
              </div>

              <div>
                <span>Vormonat</span>

                <strong>
                  {centsToEuro(
                    data.finance
                      .previousMonthGrossCents
                  )}
                </strong>

                <small>
                  {data.finance.monthChangeLabel}
                  {" zum Vormonat"}
                </small>
              </div>

              <div>
                <span>Offene Rechnungen</span>

                <strong>
                  {data.finance.openInvoiceCount}
                </strong>

                <small>
                  {centsToEuro(
                    data.finance
                      .openInvoiceGrossCents
                  )}
                  {" offen"}
                </small>
              </div>

              <div>
                <span>Ohne Rechnung</span>

                <strong>
                  {data.finance
                    .ordersWithoutInvoice}
                </strong>

                <small>
                  übernommene Aufträge
                </small>
              </div>
            </div>
          </article>

          <article className="dashCard dashMonthCard">
            <div className="dashCardHeader">
              <div>
                <p className="dashEyebrow">
                  Steuerberater
                </p>

                <h2>Monatsabschluss</h2>

                <span>
                  Offene Punkte vor der Übergabe.
                </span>
              </div>

              <Link to="/einstellungen/rechnungen">
                Stammdaten
              </Link>
            </div>

            <div className="dashFinanceGrid">
              <Link to="/auftraege">
                <span>
                  Aufträge ohne Rechnung
                </span>

                <strong>
                  {data.finance
                    .ordersWithoutInvoice}
                </strong>

                <small>
                  übernommene Aufträge
                </small>
              </Link>

              <Link to="/rechnungen">
                <span>Offene Rechnungen</span>

                <strong>
                  {data.finance.openInvoiceCount}
                </strong>

                <small>
                  {centsToEuro(
                    data.finance
                      .openInvoiceGrossCents
                  )}
                  {" offen"}
                </small>
              </Link>

              <Link to="/rechnungen">
                <span>Entwürfe</span>

                <strong>
                  {data.taxAdvisor.draftInvoices}
                </strong>

                <small>
                  noch nicht finalisiert
                </small>
              </Link>

              <Link to="/einstellungen/rechnungen">
                <span>
                  Fehlende Stammdaten
                </span>

                <strong>
                  {data.taxAdvisor
                    .missingInvoiceSettings}
                </strong>

                <small>
                  Rechnungsdaten prüfen
                </small>
              </Link>
            </div>
          </article>
        </section>
      </div>
    </AppLayout>
  );
}





const dashboardCss = `
  .dashPage {
    display: grid;
    gap: 22px;
    width: 100%;
    max-width: 1580px;
    margin: 0 auto;
    padding: 28px 28px 44px;
    box-sizing: border-box;
  }

  .dashHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
  }

  .dashHeader h1 {
    margin: 6px 0 8px;
    color: #102135;
    font-size: 46px;
    line-height: 1.02;
    letter-spacing: -0.035em;
  }

  .dashIntro {
    max-width: 820px;
    margin: 0;
    color: #61768a;
    font-size: 16px;
    font-weight: 650;
    line-height: 1.5;
  }

  .dashEyebrow {
    margin: 0;
    color: #078660;
    font-size: 10px;
    font-weight: 900;
    line-height: 1.2;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .dashHeaderActions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .dashHeaderActions a,
  .dashCardHeader a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 17px;
    border: 1px solid #d7e3df;
    border-radius: 13px;
    background: #ffffff;
    color: #213f38;
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    white-space: nowrap;
  }

  .dashHeaderActions .dashHeaderPrimary {
    border-color: #078660;
    background: #078660;
    color: #ffffff;
    box-shadow: 0 10px 22px rgba(7, 134, 96, 0.2);
  }

  .dashTodayHero {
    display: grid;
    grid-template-columns:
      minmax(0, 1.65fr)
      minmax(300px, 0.72fr);
    gap: 16px;
  }

  .dashTodayMain,
  .dashNextCard,
  .dashCard {
    border: 1px solid #dbe7e3;
    border-radius: 23px;
    background: #ffffff;
    box-shadow: 0 14px 34px rgba(16, 33, 53, 0.055);
  }

  .dashTodayMain {
    padding: 25px 27px;
    background:
      radial-gradient(
        circle at 95% 8%,
        rgba(9, 157, 112, 0.15),
        transparent 31%
      ),
      linear-gradient(
        180deg,
        #ffffff 0%,
        #f4fbf8 100%
      );
  }

  .dashTodayHeading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .dashTodayHeading h2 {
    margin: 7px 0 8px;
    color: #102236;
    font-size: 36px;
    line-height: 1.08;
    letter-spacing: -0.03em;
  }

  .dashTodayHeading > div > p:not(.dashEyebrow) {
    max-width: 700px;
    margin: 0;
    color: #597169;
    font-size: 15px;
    font-weight: 680;
    line-height: 1.5;
  }

  .dashTodayCount {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    min-width: 76px;
    height: 76px;
    padding: 0 16px;
    border-radius: 21px;
    background: linear-gradient(
      180deg,
      #0ba277 0%,
      #067654 100%
    );
    color: #ffffff;
    font-size: 32px;
    font-weight: 900;
    box-shadow: 0 14px 28px rgba(6, 118, 84, 0.22);
  }

  .dashTodayCount[data-empty="true"] {
    background: #e8f0ed;
    color: #63766f;
    box-shadow: none;
  }

  .dashTodayMetrics {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 11px;
    margin-top: 20px;
  }

  .dashTodayMetrics > div {
    display: grid;
    gap: 5px;
    min-width: 0;
    padding: 14px 15px;
    border: 1px solid #dce8e3;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.92);
  }

  .dashTodayMetrics span,
  .dashFinanceGrid span {
    color: #667c75;
    font-size: 10px;
    font-weight: 850;
    line-height: 1.3;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .dashTodayMetrics strong {
    overflow: hidden;
    color: #112438;
    font-size: 23px;
    font-weight: 900;
    line-height: 1.12;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashTodayMetrics small,
  .dashFinanceGrid small {
    color: #6c817a;
    font-size: 12px;
    font-weight: 650;
    line-height: 1.4;
  }

  .dashTodayButtons {
    display: flex;
    gap: 11px;
    flex-wrap: wrap;
    margin-top: 19px;
  }

  .dashPrimaryButton,
  .dashSecondaryButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 46px;
    padding: 0 18px;
    border-radius: 13px;
    font-size: 14px;
    font-weight: 850;
    text-decoration: none;
  }

  .dashPrimaryButton {
    background: #078660;
    color: #ffffff;
    box-shadow: 0 10px 22px rgba(7, 134, 96, 0.2);
  }

  .dashSecondaryButton {
    border: 1px solid #d7e4df;
    background: #ffffff;
    color: #24443c;
  }

  .dashNextCard {
    display: flex;
    flex-direction: column;
    padding: 23px;
    background: linear-gradient(
      155deg,
      #073f32 0%,
      #075943 100%
    );
    color: #ffffff;
  }

  .dashNextLabel {
    margin: 0;
    color: #8de0c5;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .dashNextTime {
    margin-top: 13px;
    color: #ffffff;
    font-size: 45px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.035em;
  }

  .dashNextCard h3 {
    margin: 17px 0 5px;
    color: #ffffff;
    font-size: 22px;
    line-height: 1.2;
  }

  .dashNextCard > p:not(.dashNextLabel) {
    margin: 0;
    color: #d3e9e1;
    font-size: 13px;
    font-weight: 650;
    line-height: 1.5;
  }

  .dashNextTags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .dashNextTags span {
    padding: 7px 9px;
    border: 1px solid rgba(255, 255, 255, 0.17);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #e1f2ec;
    font-size: 11px;
    font-weight: 750;
  }

  .dashNextCard > a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    margin-top: auto;
    padding: 0 15px;
    border-radius: 12px;
    background: #ffffff;
    color: #07543f;
    font-size: 13px;
    font-weight: 850;
    text-decoration: none;
  }

  .dashNextEmpty {
    display: grid;
    align-content: center;
    gap: 7px;
    min-height: 160px;
  }

  .dashNextEmpty strong {
    font-size: 21px;
  }

  .dashNextEmpty span {
    color: #d3e9e1;
    font-size: 13px;
    line-height: 1.5;
  }

  .dashOperationsGrid {
    display: grid;
    grid-template-columns:
      minmax(0, 1.55fr)
      minmax(330px, 0.72fr);
    gap: 16px;
    align-items: start;
  }

  .dashSideColumn {
    display: grid;
    gap: 16px;
  }

  .dashCard {
    padding: 19px;
  }

  .dashDeliveriesCard {
    padding: 21px;
  }

  .dashCardHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 17px;
    margin-bottom: 16px;
  }

  .dashCardHeader h2 {
    margin: 5px 0 5px;
    color: #112438;
    font-size: 23px;
    line-height: 1.17;
    letter-spacing: -0.02em;
  }

  .dashCardHeader > div > span {
    color: #6a8079;
    font-size: 13px;
    font-weight: 620;
    line-height: 1.5;
  }

  .dashDeliveryList {
    display: grid;
    gap: 10px;
  }

  .dashDeliveryRow {
    display: grid;
    grid-template-columns:
      105px
      minmax(0, 1fr)
      82px
      128px;
    gap: 14px;
    align-items: center;
    min-height: 90px;
    padding: 13px 15px;
    border: 1px solid #dde7e3;
    border-radius: 16px;
    background: #fbfdfc;
    color: inherit;
    text-decoration: none;
    transition:
      transform 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .dashDeliveryRow:hover {
    transform: translateY(-1px);
    border-color: #bcd9ce;
    box-shadow: 0 10px 22px rgba(16, 33, 53, 0.06);
  }

  .dashDeliveryRow[data-next="true"] {
    border-color: #93cfbb;
    background: linear-gradient(
      90deg,
      #f0fbf7 0%,
      #ffffff 50%
    );
  }

  .dashDeliveryTime {
    display: grid;
    gap: 5px;
  }

  .dashDeliveryTime strong {
    color: #087a59;
    font-size: 25px;
    font-weight: 900;
    line-height: 1;
  }

  .dashDeliveryTime span {
    color: #71877f;
    font-size: 11px;
    font-weight: 750;
  }

  .dashDeliveryMain {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .dashDeliveryMain strong,
  .dashDeliveryMain span,
  .dashDeliveryMain small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashDeliveryMain strong {
    color: #13273b;
    font-size: 17px;
    font-weight: 850;
  }

  .dashDeliveryMain span {
    color: #38534c;
    font-size: 13px;
    font-weight: 720;
  }

  .dashDeliveryMain small {
    color: #788b85;
    font-size: 11px;
    font-weight: 620;
  }

  .dashDeliveryAmount {
    display: grid;
    gap: 3px;
    text-align: center;
  }

  .dashDeliveryAmount strong {
    color: #173044;
    font-size: 21px;
    font-weight: 900;
  }

  .dashDeliveryAmount span {
    color: #71847e;
    font-size: 10px;
    font-weight: 730;
  }

  .dashDeliveryRow em {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 11px;
    border: 1px solid #c7e4d8;
    border-radius: 999px;
    background: #edf8f4;
    color: #08795b;
    font-size: 10px;
    font-weight: 850;
    font-style: normal;
    text-align: center;
  }

  .dashInboxList {
    display: grid;
    gap: 9px;
  }

  .dashInboxItem {
    display: grid;
    gap: 4px;
    padding: 13px 14px;
    border: 1px solid #dfe8e4;
    border-radius: 14px;
    background: #fafcfb;
    color: inherit;
    text-decoration: none;
  }

  .dashInboxItem strong {
    color: #14283c;
    font-size: 15px;
    font-weight: 840;
    line-height: 1.25;
  }

  .dashInboxItem span {
    color: #6e837c;
    font-size: 11px;
    font-weight: 650;
    line-height: 1.4;
  }

  .dashEmpty {
    display: grid;
    align-content: center;
    gap: 7px;
    min-height: 210px;
    padding: 24px;
    border: 1px dashed #d1dfda;
    border-radius: 18px;
    background: #fafcfb;
  }

  .dashEmpty strong {
    color: #15293d;
    font-size: 21px;
    font-weight: 850;
  }

  .dashEmpty span {
    color: #6f847d;
    font-size: 14px;
    font-weight: 620;
  }

  .dashManagementGrid {
    display: grid;
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .dashFinanceGrid {
    display: grid;
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .dashFinanceGrid > div,
  .dashFinanceGrid > a {
    display: grid;
    gap: 6px;
    min-height: 105px;
    padding: 15px;
    border: 1px solid #dee7e3;
    border-radius: 16px;
    background: #fafcfb;
    color: inherit;
    text-decoration: none;
    box-sizing: border-box;
  }

  .dashFinanceGrid strong {
    color: #12263a;
    font-size: 23px;
    font-weight: 900;
    line-height: 1.1;
  }

  .dashMonthCard .dashFinanceGrid > a {
    border-color: #efd9af;
    background: #fff9ef;
  }

  @media (max-width: 1250px) {
    .dashTodayHero,
    .dashOperationsGrid,
    .dashManagementGrid {
      grid-template-columns: 1fr;
    }

    .dashNextCard > a {
      margin-top: 22px;
    }
  }

  @media (max-width: 900px) {
    .dashPage {
      padding: 21px 18px 36px;
    }

    .dashHeader {
      flex-direction: column;
    }

    .dashHeader h1 {
      font-size: 38px;
    }

    .dashTodayMetrics {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .dashDeliveryRow {
      grid-template-columns:
        90px
        minmax(0, 1fr);
    }

    .dashDeliveryAmount,
    .dashDeliveryRow em {
      justify-self: start;
    }
  }

  @media (max-width: 620px) {
    .dashTodayHeading {
      flex-direction: column;
    }

    .dashTodayMetrics,
    .dashFinanceGrid {
      grid-template-columns: 1fr;
    }

    .dashHeaderActions,
    .dashTodayButtons {
      width: 100%;
    }

    .dashHeaderActions a,
    .dashPrimaryButton,
    .dashSecondaryButton,
    .dashCardHeader a {
      width: 100%;
    }

    .dashCardHeader {
      flex-direction: column;
    }

    .dashDeliveryRow {
      grid-template-columns: 1fr;
    }
  }
`;