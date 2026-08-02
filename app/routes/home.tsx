import { Link, useLoaderData } from "react-router";
import { useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";

import "../styles/gastario-dashboard.css";

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
    { title: "Dashboard – Gastario" },
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
      operationalTasks: {
        review: 0,
        incomplete: 0,
        duplicates: 0,
        production: 0,
        packing: 0,
        missingTime: 0,
        missingAddress: 0,
        missingDeliveryNote: 0,
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
    upcomingOrders,
    openOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        deliveryDate: {
          gte: start,
          lt: end,
        },
        status: {
          in: [
            "CONFIRMED",
            "IN_PRODUCTION",
            "PACKING_OPEN",
          ] as any,
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
        status: {
          in: [
            "CONFIRMED",
            "IN_PRODUCTION",
            "PACKING_OPEN",
          ] as any,
        },
},
      include: {
        items: true,
        customer: true,
      },
      orderBy: [
        { deliveryTimeText: "asc" },
        { createdAt: "desc" },
      ],
      take: 8,
    }).catch(() => []),

    /*
     * gastario-dashboard-upcoming-orders-20260726
     * Alle zukünftigen und nicht stornierten Lieferungen für die Planung.
     */
    prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
        deliveryDate: {
          gte: end,
        },
        status: {
          in: [
            "CONFIRMED",
            "IN_PRODUCTION",
            "PACKING_OPEN",
          ] as any,
        },
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: [
        { deliveryDate: "asc" },
        { deliveryTimeText: "asc" },
        { createdAt: "desc" },
      ],
      take: 1000,
    }).catch((error) => {
      console.error(
        "Dashboard: kommende Lieferungen konnten nicht geladen werden:",
        error
      );

      return [];
    }),
  ]);

  const lowItems = lowInventoryItems.filter((item: any) => {
    return item.minStock > 0 && item.currentStock <= item.minStock;
  });

  /*
   * gastario-dashboard-real-task-counts-20260726
   * Mandantenweite operative Aufgaben direkt aus der Datenbank.
   */
  const activeTaskStatuses = [
    "AUTO_CREATED",
    "REVIEW_NEEDED",
    "INCOMPLETE",
    "POSSIBLE_DUPLICATE",
    "CONFIRMED",
    "IN_PRODUCTION",
    "PACKING_OPEN",
  ] as any;

  const [
    taskReviewOrders,
    taskIncompleteOrders,
    taskDuplicateOrders,
    taskProductionOrders,
    taskPackingOrders,
    taskMissingTimeOrders,
    taskMissingAddressOrders,
    taskMissingDeliveryNoteOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: {
          in: [
            "AUTO_CREATED",
            "REVIEW_NEEDED",
          ] as any,
        },
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: "INCOMPLETE" as any,
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: "POSSIBLE_DUPLICATE" as any,
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: "IN_PRODUCTION" as any,
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: "PACKING_OPEN" as any,
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: {
          in: activeTaskStatuses,
        },
        OR: [
          { deliveryTimeText: null },
          { deliveryTimeText: "" },
        ],
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: {
          in: activeTaskStatuses,
        },
        OR: [
          { deliveryAddress: null },
          { deliveryAddress: "" },
        ],
      },
    }).catch(() => 0),

    prisma.order.count({
      where: {
        tenantId: access.tenantId,
        status: {
          in: [
            "CONFIRMED",
            "IN_PRODUCTION",
            "PACKING_OPEN",
          ] as any,
        },
        deliveryNote: {
          is: null,
        },
      },
    }).catch(() => 0),
  ]);

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
    upcomingOrders,
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
    operationalTasks: {
      review:
        taskReviewOrders +
        emailInbox.length,
      incomplete:
        taskIncompleteOrders,
      duplicates:
        taskDuplicateOrders,
      production:
        taskProductionOrders,
      packing:
        taskPackingOrders,
      missingTime:
        taskMissingTimeOrders,
      missingAddress:
        taskMissingAddressOrders,
      missingDeliveryNote:
        taskMissingDeliveryNoteOrders,
    },
  };
}

export default function Home() {
  const data = useLoaderData<typeof loader>();

  /*
   * gastario-dashboard-safe-loader-arrays-20260726
   * Fehlende Loader-Listen dürfen das Dashboard nicht zum Absturz bringen.
   */
  const safeTodayOrders =
    Array.isArray(data.todayOrders)
      ? data.todayOrders
      : [];

  const safeUpcomingOrders =
    Array.isArray(data.upcomingOrders)
      ? data.upcomingOrders
      : [];

  const safeOpenOrders =
    Array.isArray(data.openOrders)
      ? data.openOrders
      : [];

  const safeEmailInbox =
    Array.isArray(data.emailInbox)
      ? data.emailInbox
      : [];

  const safeLowInventoryItems =
    Array.isArray(data.lowInventoryItems)
      ? data.lowInventoryItems
      : [];

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
   * gastario-dashboard-control-center-20260726
   * Operative Leitstelle für heutige und kommende Lieferungen.
   */
  const todayOrdersSorted = [
    ...safeTodayOrders,
  ].sort((left: any, right: any) => {
    return String(
      left.deliveryTimeText || ""
    ).localeCompare(
      String(right.deliveryTimeText || ""),
      "de"
    );
  });

  const upcomingOrdersSorted = [
    ...safeUpcomingOrders,
  ].sort((left: any, right: any) => {
    const leftDate = left.deliveryDate
      ? new Date(left.deliveryDate).getTime()
      : Number.MAX_SAFE_INTEGER;

    const rightDate = right.deliveryDate
      ? new Date(right.deliveryDate).getTime()
      : Number.MAX_SAFE_INTEGER;

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return String(
      left.deliveryTimeText || ""
    ).localeCompare(
      String(right.deliveryTimeText || ""),
      "de"
    );
  });

  const openReviewCount =
    safeOpenOrders.length +
    safeEmailInbox.length;
  /*
   * gastario-dashboard-navigation-filters-20260726
   * Navigation, Zeitraum, Status und Suche der Betriebsleitstelle.
   */
  type DashboardView =
    | "overview"
    | "planning"
    | "tasks"
    | "finance";

  type DashboardPeriod =
    | "today"
    | "tomorrow"
    | "week"
    | "month"
    | "all";

  type DashboardStatus =
    | "all"
    | "CONFIRMED"
    | "IN_PRODUCTION"
    | "PACKING_OPEN";

  const [dashboardView, setDashboardView] =
    useState<DashboardView>("overview");

  const [dashboardPeriod, setDashboardPeriod] =
    useState<DashboardPeriod>("week");

  const [dashboardStatus, setDashboardStatus] =
    useState<DashboardStatus>("all");

  const [dashboardSearch, setDashboardSearch] =
    useState("");

  const [dashboardSidePanel, setDashboardSidePanel] =
    useState<"tasks" | "inventory" | "quick">(
      "tasks"
    );

  const allPlanningOrders = useMemo(
    () => [
      ...todayOrdersSorted,
      ...upcomingOrdersSorted,
    ],
    [
      todayOrdersSorted,
      upcomingOrdersSorted,
    ]
  );

  const filteredPlanningOrders = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    const weekEnd = new Date(now);
    weekEnd.setDate(
      weekEnd.getDate() + 7
    );

    const monthEnd = new Date(now);
    monthEnd.setDate(
      monthEnd.getDate() + 30
    );

    const normalizedSearch =
      dashboardSearch
        .trim()
        .toLowerCase();

    return allPlanningOrders.filter(
      (order: any) => {
        const deliveryDate =
          order.deliveryDate
            ? new Date(order.deliveryDate)
            : null;

        if (
          !deliveryDate ||
          Number.isNaN(
            deliveryDate.getTime()
          )
        ) {
          return dashboardPeriod === "all";
        }

        deliveryDate.setHours(
          0,
          0,
          0,
          0
        );

        const matchesPeriod =
          dashboardPeriod === "all" ||
          (
            dashboardPeriod === "today" &&
            deliveryDate.getTime() ===
              now.getTime()
          ) ||
          (
            dashboardPeriod === "tomorrow" &&
            deliveryDate.getTime() ===
              tomorrow.getTime()
          ) ||
          (
            dashboardPeriod === "week" &&
            deliveryDate >= now &&
            deliveryDate < weekEnd
          ) ||
          (
            dashboardPeriod === "month" &&
            deliveryDate >= now &&
            deliveryDate < monthEnd
          );

        if (!matchesPeriod) {
          return false;
        }

        const matchesStatus =
          dashboardStatus === "all" ||
          String(order.status) ===
            dashboardStatus;

        if (!matchesStatus) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableText = [
          order.customerName,
          order.orderNumber,
          order.eventName,
          order.deliveryAddress,
          order.contactName,
          order.customer?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          normalizedSearch
        );
      }
    );
  }, [
    allPlanningOrders,
    dashboardPeriod,
    dashboardSearch,
    dashboardStatus,
  ]);

  const filteredOrdersByDate =
    useMemo(() => {
      return filteredPlanningOrders.reduce<
        Record<string, any[]>
      >((groups, order: any) => {
        const key = planningDateKey(
          order.deliveryDate
        );

        if (!groups[key]) {
          groups[key] = [];
        }

        groups[key].push(order);

        return groups;
      }, {});
    }, [filteredPlanningOrders]);

  const filteredOrderGroups =
    useMemo(
      () =>
        Object.entries(
          filteredOrdersByDate
        ) as Array<[string, any[]]>,
      [filteredOrdersByDate]
    );

  function resetDashboardFilters() {
    setDashboardPeriod("week");
    setDashboardStatus("all");
    setDashboardSearch("");
  }

  /*
   * gastario-dashboard-distinct-overview-tasks-20260726
   * Übersicht und operativer Arbeitskorb aus vorhandenen Auftragsdaten.
   */
  const overviewNextOrders =
    filteredPlanningOrders.slice(0, 3);

  const dashboardTaskCounts = {
    review:
      data.operationalTasks.review,
    incomplete:
      data.operationalTasks.incomplete,
    duplicates:
      data.operationalTasks.duplicates,
    production:
      data.operationalTasks.production,
    packing:
      data.operationalTasks.packing,
    missingTime:
      data.operationalTasks.missingTime,
    missingAddress:
      data.operationalTasks.missingAddress,
    missingDeliveryNote:
      data.operationalTasks.missingDeliveryNote,
    withoutInvoice:
      data.finance.ordersWithoutInvoice,
    missingInvoiceSettings:
      data.taxAdvisor.missingInvoiceSettings,
    inventory:
      data.counts.lowInventory,
  };

  const dashboardTotalTasks =
    dashboardTaskCounts.review +
    dashboardTaskCounts.incomplete +
    dashboardTaskCounts.duplicates +
    dashboardTaskCounts.missingTime +
    dashboardTaskCounts.missingAddress +
    dashboardTaskCounts.inventory;

  const nextPlannedOrder =
    todayOrdersSorted[0] ||
    upcomingOrdersSorted[0] ||
    null;

  function planningDateKey(
    value: Date | string | null | undefined
  ) {
    if (!value) {
      return "ohne-datum";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "ohne-datum";
    }

    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function planningDateLabel(
    value: Date | string | null | undefined
  ) {
    if (!value) {
      return "Datum noch offen";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Datum noch offen";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    const comparisonDate = new Date(date);
    comparisonDate.setHours(0, 0, 0, 0);

    if (
      comparisonDate.getTime() ===
      tomorrow.getTime()
    ) {
      return "Morgen";
    }

    return comparisonDate.toLocaleDateString(
      "de-DE",
      {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  const upcomingOrdersByDate =
    upcomingOrdersSorted.reduce<
      Record<string, any[]>
    >((groups, order: any) => {
      const key = planningDateKey(
        order.deliveryDate
      );

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(order);

      return groups;
    }, {});

  const upcomingOrderGroups =
    Object.entries(
      upcomingOrdersByDate
    ) as Array<[string, any[]]>;
  return (
    <AppLayout>
      <div
        className="dashPage"
        data-view={dashboardView}
      >
        <header className="dashHeader">
          <div>
            <p className="dashEyebrow">
              Dashboard
            </p>

            <h1>Betriebsübersicht</h1>

            <p className="dashSubtitle">
              {data.tenant?.name}
              {" · "}
              {new Date().toLocaleDateString(
                "de-DE",
                {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }
              )}
            </p>
          </div>

          <div className="dashHeaderActions">
            <Link to="/auftragseingang">
              Auftragseingang
            </Link>

            <Link
              to="/neuer-auftrag"
              className="dashPrimaryAction"
            >
              Neuer Auftrag
            </Link>
          </div>
        </header>

        {/* gastario-dashboard-workspace-controls-20260726 */}

        <nav
          className="dashWorkspaceTabs"
          aria-label="Dashboard-Bereiche"
        >
          <button
            type="button"
            data-active={
              dashboardView === "overview"
                ? "true"
                : "false"
            }
            onClick={() =>
              setDashboardView("overview")
            }
          >
            Übersicht
          </button>

          <button
            type="button"
            data-active={
              dashboardView === "planning"
                ? "true"
                : "false"
            }
            onClick={() =>
              setDashboardView("planning")
            }
          >
            Lieferplan
          </button>


          <button
            type="button"
            data-active={
              dashboardView === "finance"
                ? "true"
                : "false"
            }
            onClick={() =>
              setDashboardView("finance")
            }
          >
            Finanzen
          </button>
        </nav>

        {dashboardView === "planning" ? (
          <section className="dashFilterBar">
            <div className="dashPeriodFilter">
              <button
                type="button"
                data-active={
                  dashboardPeriod === "today"
                    ? "true"
                    : "false"
                }
                onClick={() =>
                  setDashboardPeriod("today")
                }
              >
                Heute
              </button>

              <button
                type="button"
                data-active={
                  dashboardPeriod === "tomorrow"
                    ? "true"
                    : "false"
                }
                onClick={() =>
                  setDashboardPeriod("tomorrow")
                }
              >
                Morgen
              </button>

              <button
                type="button"
                data-active={
                  dashboardPeriod === "week"
                    ? "true"
                    : "false"
                }
                onClick={() =>
                  setDashboardPeriod("week")
                }
              >
                7 Tage
              </button>

              <button
                type="button"
                data-active={
                  dashboardPeriod === "month"
                    ? "true"
                    : "false"
                }
                onClick={() =>
                  setDashboardPeriod("month")
                }
              >
                30 Tage
              </button>

              <button
                type="button"
                data-active={
                  dashboardPeriod === "all"
                    ? "true"
                    : "false"
                }
                onClick={() =>
                  setDashboardPeriod("all")
                }
              >
                Alle
              </button>
            </div>

            <div className="dashFilterControls">
              <select
                value={dashboardStatus}
                onChange={(event) =>
                  setDashboardStatus(
                    event.target.value as DashboardStatus
                  )
                }
                aria-label="Auftragsstatus filtern"
              >
                <option value="all">
                  Alle Status
                </option>

                <option value="CONFIRMED">
                  Bestätigt
                </option>

                <option value="IN_PRODUCTION">
                  In Produktion
                </option>

                <option value="PACKING_OPEN">
                  Packen offen
                </option>
              </select>

              <label className="dashSearchField">
                <span>⌕</span>

                <input
                  type="search"
                  value={dashboardSearch}
                  onChange={(event) =>
                    setDashboardSearch(
                      event.target.value
                    )
                  }
                  placeholder="Kunde, Auftrag oder Adresse suchen"
                />
              </label>

              <button
                type="button"
                className="dashResetButton"
                onClick={resetDashboardFilters}
                disabled={
                  dashboardPeriod === "week" &&
                  dashboardStatus === "all" &&
                  dashboardSearch === ""
                }
              >
                Zurücksetzen
              </button>
            </div>
          </section>
        ) : null}
        <section
          className="dashIntelligenceCard"
          aria-label="Gastario Intelligence"
        >
          <div
            className="dashIntelligenceIcon"
            aria-hidden="true"
          >
            ✦
          </div>

          <div className="dashIntelligenceCopy">
            <p>Gastario Intelligence</p>

            <strong>
              {dashboardTotalTasks > 0
                ? `${dashboardTotalTasks} Punkte benötigen deine Aufmerksamkeit.`
                : "Dein Betrieb ist aktuell aufgeräumt."}
            </strong>

            <span>
              {dashboardTaskCounts.review > 0
                ? `${dashboardTaskCounts.review} Eingänge sind zu prüfen.`
                : "Keine neuen Eingänge zur Prüfung."}
              {" "}
              {dashboardTaskCounts.inventory > 0
                ? `${dashboardTaskCounts.inventory} Lagerwarnungen sind offen.`
                : "Der Lagerstatus ist unauffällig."}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setDashboardView("tasks")
            }
          >
            {dashboardTotalTasks > 0
              ? "Hinweise prüfen"
              : "Arbeitsbereich öffnen"}
          </button>
        </section>

        <nav
          className="dashKpiBar"
          aria-label="Dashboard-Kennzahlen"
        >
          <Link to="/lieferungen">
            <span>Heute</span>

            <strong>
              {todayOrdersSorted.length}
            </strong>

            <small>
              Lieferungen
            </small>
          </Link>

          <Link to="/auftraege">
            <span>Kommend</span>

            <strong>
              {upcomingOrdersSorted.length}
            </strong>

            <small>
              geplante Aufträge
            </small>
          </Link>

          <Link to="/rechnungen">
            <span>Finanzen</span>

            <strong className="dashKpiMoney">
              {centsToEuro(
                data.finance.currentMonthGrossCents
              )}
            </strong>

            <small>
              Monatsumsatz
            </small>
          </Link>

          <Link to="/auftragseingang">
            <span>Offen</span>

            <strong>
              {openReviewCount}
            </strong>

            <small>
              Prüfungen
            </small>
          </Link>

          {data.counts.lowInventory > 0 ? (
            <Link
              to="/lager"
              className="dashKpiWarning"
            >
              <span>Lager</span>

              <strong>
                {data.counts.lowInventory}
              </strong>

              <small>
                Warnungen
              </small>
            </Link>
          ) : null}
        </nav>

        {dashboardView === "overview" ? (
          <section className="dashOverviewHome">
            <section className="dashPanel dashOverviewDeliveries">
              <div className="dashPanelHead">
                <div>
                  <p className="dashEyebrow">
                    Nächste Auslieferungen
                  </p>

                  <h2>Betriebsplan</h2>

                  <span>
                    Die nächsten drei geplanten Lieferungen
                    im direkten Überblick.
                  </span>
                </div>

                <button
                  type="button"
                  className="dashOverviewTextButton"
                  onClick={() => setDashboardView("planning")}
                >
                  Vollständigen Lieferplan öffnen
                </button>
              </div>

              {overviewNextOrders.length === 0 ? (
                <div className="dashSimpleEmpty">
                  <strong>Keine Lieferung geplant</strong>

                  <span>
                    Aktuell sind keine zukünftigen
                    Auslieferungen erfasst.
                  </span>
                </div>
              ) : (
                <div className="dashOverviewDeliveryList">
                  {overviewNextOrders.map(
                    (order: any) => (
                      <Link
                        className="dashOverviewDelivery"
                        to={
                          "/auftrag-pruefung/" +
                          order.id
                        }
                        key={order.id}
                      >
                        <div className="dashOverviewDate">
                          <strong>
                            {planningDateLabel(
                              order.deliveryDate
                            )}
                          </strong>

                          <span>
                            {order.deliveryTimeText ||
                              "Zeit offen"}
                          </span>
                        </div>

                        <div>
                          <strong>
                            {order.customerName ||
                              "Kunde nicht erkannt"}
                          </strong>

                          <span>
                            {order.eventName ||
                              order.orderNumber}
                          </span>

                          <small>
                            {order.deliveryAddress ||
                              "Lieferadresse noch offen"}
                          </small>
                        </div>

                        <em>
                          {order.items.length}
                          {" Positionen"}
                        </em>

                        <b>›</b>
                      </Link>
                    )
                  )}
                </div>
              )}
            </section>

            <section className="dashOverviewOperations">
              <div className="dashPanel dashOverviewStatus">
                <div className="dashPanelHead">
                  <div>
                    <p className="dashEyebrow">
                      Operativer Stand
                    </p>

                    <h2>Heute im Betrieb</h2>
                  </div>
                </div>

                <div className="dashOverviewStatusGrid">
                  <Link to=
"/produktion"
>
                    <strong>
                      {dashboardTaskCounts.production}
                    </strong>
                    <span>In Produktion</span>
                    <small>Produktion bearbeiten</small>
                  </Link>

                  <Link to=
"/packlisten"
>
                    <strong>
                      {dashboardTaskCounts.packing}
                    </strong>
                    <span>Packen offen</span>
                    <small>Packlisten bearbeiten</small>
                  </Link>

                  <Link to=
"/auftragseingang"
>
                    <strong>
                      {dashboardTaskCounts.review}
                    </strong>
                    <span>Prüfung offen</span>
                    <small>Eingänge kontrollieren</small>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setDashboardView("tasks")}
                  >
                    <strong>{dashboardTotalTasks}</strong>
                    <span>Alle Aufgaben</span>
                    <small>Arbeitskorb öffnen</small>
                  </button>
                </div>
              </div>

              <div className="dashPanel dashOverviewQuickActions">
                <div className="dashPanelHead">
                  <div>
                    <p className="dashEyebrow">
                      Schnellzugriff
                    </p>

                    <h2>Direkt öffnen</h2>
                  </div>
                </div>

                <div>
                  <Link to="/produktion">
                    <strong>Produktion</strong>
                    <span>Planung und Mengen</span>
                  </Link>

                  <Link to="/packlisten">
                    <strong>Packlisten</strong>
                    <span>Kommissionierung</span>
                  </Link>

                  <Link to="/lieferungen">
                    <strong>Lieferungen</strong>
                    <span>Touren und Fahrer</span>
                  </Link>

                  <Link to="/lieferscheine">
                    <strong>Lieferscheine</strong>
                    <span>Dokumente vorbereiten</span>
                  </Link>

                  <Link to="/rechnungen">
                    <strong>Rechnungen</strong>
                    <span>Abrechnung öffnen</span>
                  </Link>

                  <Link to="/lager">
                    <strong>Lager</strong>
                    <span>Bestände prüfen</span>
                  </Link>
                </div>
              </div>
            </section>
          </section>
        ) : null}

        <section className="dashControlGrid">
          <main className="dashPlanning">
            <section className="dashPanel dashTodayPanel">
              <div className="dashPanelHead">
                <div>
                  <p className="dashEyebrow">
                    Tagesplan
                  </p>

                  <h2>Heutige Lieferungen</h2>

                  <span>
                    Alle für heute geplanten
                    Auslieferungen nach Uhrzeit.
                  </span>
                </div>

                <Link to="/auftraege">
                  Alle Aufträge
                </Link>
              </div>

              {todayOrdersSorted.length === 0 ? (
                <div className="dashTodayEmpty">
                  <div>
                    <strong>
                      Heute keine Lieferungen
                    </strong>

                    <span>
                      Für heute ist kein Auftrag
                      mit Lieferdatum geplant.
                    </span>
                  </div>

                  {nextPlannedOrder ? (
                    <Link
                      to={
                        "/auftrag-pruefung/" +
                        nextPlannedOrder.id
                      }
                    >
                      <small>
                        Nächster Auftrag
                      </small>

                      <strong>
                        {planningDateLabel(
                          nextPlannedOrder
                            .deliveryDate
                        )}
                        {" · "}
                        {formatTime(
                          nextPlannedOrder
                            .deliveryTimeText
                        )}
                        {" Uhr"}
                      </strong>

                      <span>
                        {
                          nextPlannedOrder
                            .customerName
                        }
                      </span>
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className="dashOrderTable">
                  <div className="dashOrderTableHead">
                    <span>Zeit</span>
                    <span>Kunde und Auftrag</span>
                    <span>Umfang</span>
                    <span>Status</span>
                  </div>

                  {todayOrdersSorted.map(
                    (order: any) => (
                      <Link
                        className="dashOrderRow"
                        to={
                          "/auftrag-pruefung/" +
                          order.id
                        }
                        key={order.id}
                      >
                        <div className="dashOrderTime">
                          <strong>
                            {formatTime(
                              order.deliveryTimeText
                            )}
                          </strong>

                          <span>Uhr</span>
                        </div>

                        <div className="dashOrderIdentity">
                          <strong>
                            {order.customerName ||
                              "Kunde nicht erkannt"}
                          </strong>

                          <span>
                            {order.eventName ||
                              order.orderNumber}
                          </span>

                          <small>
                            {order.deliveryAddress ||
                              "Lieferadresse noch offen"}
                          </small>
                        </div>

                        <div className="dashOrderQuantity">
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
            </section>

            <section className="dashPanel dashUpcomingPanel">
              <div className="dashPanelHead">
                <div>
                  <p className="dashEyebrow">
                    Planung
                  </p>

                  <h2>Lieferplan</h2>

                  <span>
                    Alle geplanten Lieferungen
                    nach Zeitraum und Filter gruppiert.
                  </span>
                </div>

                <strong className="dashPanelCount">
                  {filteredPlanningOrders.length}
                </strong>
              </div>

              {filteredOrderGroups.length === 0 ? (
                <div className="dashSimpleEmpty">
                  <strong>
                    Keine kommenden Lieferungen
                  </strong>

                  <span>
                    Aktuell sind keine zukünftigen
                    Aufträge eingeplant.
                  </span>
                </div>
              ) : (
                <div className="dashUpcomingScroll">
                  {filteredOrderGroups.map(
                    ([dateKey, orders]) => (
                      <section
                        className="dashDateGroup"
                        key={dateKey}
                      >
                        <header>
                          <div>
                            <strong>
                              {planningDateLabel(
                                orders[0]
                                  ?.deliveryDate
                              )}
                            </strong>

                            <span>
                              {orders.length === 1
                                ? "1 Lieferung"
                                : `${orders.length} Lieferungen`}
                            </span>
                          </div>
                        </header>

                        <div className="dashDateOrders">
                          {orders.map(
                            (order: any) => (
                              <Link
                                className="dashCompactOrder"
                                to={
                                  "/auftrag-pruefung/" +
                                  order.id
                                }
                                key={order.id}
                              >
                                {/* gastario-dashboard-delivery-time-text-20260726 */}
                                <strong className="dashCompactTime">
                                  {order.deliveryTimeText ||
                                    "Zeit offen"}
                                </strong>

                                <div>
                                  <strong>
                                    {order.customerName ||
                                      "Kunde nicht erkannt"}
                                  </strong>

                                  <span>
                                    {order.eventName ||
                                      order.orderNumber}
                                  </span>
                                </div>

                                <small>
                                  {order.items.length}
                                  {" Positionen"}
                                </small>

                                <em>
                                  {String(order.status)
                                    .replaceAll(
                                      "_",
                                      " "
                                    )}
                                </em>
                              </Link>
                            )
                          )}
                        </div>
                      </section>
                    )
                  )}
                </div>
              )}
            </section>
          </main>

          <aside className="dashAttention">
            {/* gastario-dashboard-compact-workbar-20260726 */}

            <section className="dashPanel dashWorkbar">
              <div className="dashWorkbarHeader">
                <div>
                  <p className="dashEyebrow">
                    Betriebssteuerung
                  </p>

                  <h2>Arbeitsbereich</h2>
                </div>

                <span>
                  {openReviewCount +
                    data.finance.ordersWithoutInvoice +
                    data.taxAdvisor.missingInvoiceSettings +
                    data.counts.lowInventory}
                </span>
              </div>

              <nav
                className="dashWorkbarTabs"
                aria-label="Arbeitsbereich auswählen"
              >
                <button
                  type="button"
                  data-active={
                    dashboardSidePanel === "tasks"
                      ? "true"
                      : "false"
                  }
                  onClick={() =>
                    setDashboardSidePanel("tasks")
                  }
                >
                  Aufgaben
                </button>

                <button
                  type="button"
                  data-active={
                    dashboardSidePanel === "inventory"
                      ? "true"
                      : "false"
                  }
                  onClick={() =>
                    setDashboardSidePanel("inventory")
                  }
                >
                  Lager
                </button>

                <button
                  type="button"
                  data-active={
                    dashboardSidePanel === "quick"
                      ? "true"
                      : "false"
                  }
                  onClick={() =>
                    setDashboardSidePanel("quick")
                  }
                >
                  Schnellzugriff
                </button>
              </nav>

              {dashboardSidePanel === "tasks" ? (
                <div className="dashWorkbarList dashWorkbarTaskGrid">
                  <Link to="/auftragseingang">
                    <strong>
                      {dashboardTaskCounts.review}
                    </strong>
                    <div>
                      <span>Auftragseingänge prüfen</span>
                      <small>Neue Aufträge und E-Mails</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/auftraege">
                    <strong>
                      {dashboardTaskCounts.incomplete}
                    </strong>
                    <div>
                      <span>Unvollständige Aufträge</span>
                      <small>Fehlende Auftragsangaben</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/auftragseingang">
                    <strong>
                      {dashboardTaskCounts.duplicates}
                    </strong>
                    <div>
                      <span>Mögliche Duplikate</span>
                      <small>Doppelte Eingänge kontrollieren</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/produktion">
                    <strong>
                      {dashboardTaskCounts.production}
                    </strong>
                    <div>
                      <span>Produktion bearbeiten</span>
                      <small>Aufträge in Produktion</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/packlisten">
                    <strong>
                      {dashboardTaskCounts.packing}
                    </strong>
                    <div>
                      <span>Packen offen</span>
                      <small>Packlisten fertigstellen</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/auftraege">
                    <strong>
                      {dashboardTaskCounts.missingTime}
                    </strong>
                    <div>
                      <span>Lieferzeit fehlt</span>
                      <small>Uhrzeiten ergänzen</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/auftraege">
                    <strong>
                      {dashboardTaskCounts.missingAddress}
                    </strong>
                    <div>
                      <span>Lieferadresse fehlt</span>
                      <small>Lieferdaten vervollständigen</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/rechnungen">
                    <strong>
                      {dashboardTaskCounts.withoutInvoice}
                    </strong>
                    <div>
                      <span>Aufträge ohne Rechnung</span>
                      <small>Abrechnung noch offen</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/einstellungen/rechnungen">
                    <strong>
                      {dashboardTaskCounts.missingInvoiceSettings}
                    </strong>
                    <div>
                      <span>Rechnungsstammdaten fehlen</span>
                      <small>Einstellungen vervollständigen</small>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/lager">
                    <strong>
                      {dashboardTaskCounts.inventory}
                    </strong>
                    <div>
                      <span>Lagerwarnungen</span>
                      <small>Mindestbestände kontrollieren</small>
                    </div>
                    <b>›</b>
                  </Link>
                </div>
              ) : null}

              {dashboardSidePanel === "inventory" ? (
                <div className="dashWorkbarInventory">
                  <div className="dashWorkbarInventoryStatus">
                    <strong>
                      {data.counts.lowInventory}
                    </strong>

                    <div>
                      <span>Lagerwarnungen</span>
                      <small>Artikel unter Mindestbestand</small>
                    </div>
                  </div>

                  {safeLowInventoryItems.length === 0 ? (
                    <div className="dashWorkbarOkay">
                      <strong>Keine Lagerwarnung</strong>

                      <span>
                        Alle Bestände liegen über dem Mindestbestand.
                      </span>
                    </div>
                  ) : (
                    <div className="dashWorkbarStockList">
                      {safeLowInventoryItems.map(
                        (item: any) => (
                          <Link
                            to="/lager"
                            key={item.id}
                          >
                            <strong>{item.name}</strong>

                            <span>
                              {item.currentStock}
                              {" / Mindest "}
                              {item.minStock}
                              {" "}
                              {item.unit}
                            </span>
                          </Link>
                        )
                      )}
                    </div>
                  )}

                  <Link
                    className="dashWorkbarOpenButton"
                    to="/lager"
                  >
                    Lager öffnen
                  </Link>
                </div>
              ) : null}

              {dashboardSidePanel === "quick" ? (
                <div className="dashWorkbarQuick">
                  <Link to="/produktion">
                    <div>
                      <strong>Produktion</strong>
                      <span>Produktionsplanung öffnen</span>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/packlisten">
                    <div>
                      <strong>Packlisten</strong>
                      <span>Kommissionierung vorbereiten</span>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/lieferungen">
                    <div>
                      <strong>Lieferungen</strong>
                      <span>Fahrer und Touren verwalten</span>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/auftragseingang">
                    <div>
                      <strong>Neuer Auftrag</strong>
                      <span>Auftrag manuell anlegen</span>
                    </div>
                    <b>›</b>
                  </Link>

                  <Link to="/rechnungen">
                    <div>
                      <strong>Rechnungen</strong>
                      <span>Abrechnung bearbeiten</span>
                    </div>
                    <b>›</b>
                  </Link>
                </div>
              ) : null}
            </section>
          </aside>
        </section>

        <section className="dashFinanceStrip">
          <div>
            <p className="dashEyebrow">
              Finanzen
            </p>

            <h2>Abrechnungsstand</h2>
          </div>

          <Link to="/rechnungen">
            <span>Monatsumsatz</span>

            <strong>
              {centsToEuro(
                data.finance
                  .currentMonthGrossCents
              )}
            </strong>
          </Link>

          <Link to="/rechnungen">
            <span>Offene Rechnungen</span>

            <strong>
              {data.finance.openInvoiceCount}
            </strong>
          </Link>

          <Link to="/auftraege">
            <span>Ohne Rechnung</span>

            <strong>
              {data.finance
                .ordersWithoutInvoice}
            </strong>
          </Link>

          <Link to="/rechnungen">
            <span>Entwürfe</span>

            <strong>
              {data.taxAdvisor.draftInvoices}
            </strong>
          </Link>

          <Link
            to="/rechnungen"
            className="dashFinanceOpen"
          >
            Finanzen öffnen
          </Link>
        </section>
      </div>
    </AppLayout>
  );
}
