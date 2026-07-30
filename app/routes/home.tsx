import { Link, useLoaderData } from "react-router";
import { useMemo, useState } from "react";
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
    dashboardTaskCounts.production +
    dashboardTaskCounts.packing +
    dashboardTaskCounts.missingTime +
    dashboardTaskCounts.missingAddress +
    dashboardTaskCounts.withoutInvoice +
    dashboardTaskCounts.missingInvoiceSettings +
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
      <style>{dashboardCss}</style>

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
              to="/auftragseingang"
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
              dashboardView === "tasks"
                ? "true"
                : "false"
            }
            onClick={() =>
              setDashboardView("tasks")
            }
          >
            Offene Aufgaben

            {openReviewCount > 0 ? (
              <span>{openReviewCount}</span>
            ) : null}
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

        {(dashboardView === "overview" ||
          dashboardView === "planning") ? (
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
        <nav
          className="dashKpiBar"
          aria-label="Dashboard-Kennzahlen"
        >
          <Link to="/auftraege">
            <span>Heute</span>
            <strong>
              {todayOrdersSorted.length}
            </strong>
            <small>Lieferungen</small>
          </Link>

          <Link to="/auftraege">
            <span>Kommend</span>
            <strong>
              {upcomingOrdersSorted.length}
            </strong>
            <small>geplante Aufträge</small>
          </Link>

          <Link to="/auftragseingang">
            <span>Zu prüfen</span>
            <strong>{openReviewCount}</strong>
            <small>Aufträge und E-Mails</small>
          </Link>

          <Link to="/auftraege">
            <span>Bestätigt</span>
            <strong>
              {data.counts.confirmedOrders}
            </strong>
            <small>operative Aufträge</small>
          </Link>

          <Link to="/lager">
            <span>Lager</span>
            <strong>
              {data.counts.lowInventory}
            </strong>
            <small>Warnungen</small>
          </Link>
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





const dashboardCss = `
  .dashPage {
    display: grid;
    gap: 16px;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .dashHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
  }

  .dashHeader h1 {
    margin: 5px 0 7px;
    color: #102135;
    font-size: 40px;
    line-height: 1.04;
    letter-spacing: -0.035em;
  }

  .dashSubtitle {
    margin: 0;
    color: #63768a;
    font-size: 14px;
    font-weight: 650;
  }

  .dashEyebrow {
    margin: 0;
    color: #07865f;
    font-size: 10px;
    font-weight: 900;
    line-height: 1.2;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .dashHeaderActions {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
  }

  .dashHeaderActions a,
  .dashPanelHead > a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 42px;
    padding: 0 16px;
    border: 1px solid #d7e2de;
    border-radius: 10px;
    background: #ffffff;
    color: #203d36;
    font-size: 13px;
    font-weight: 820;
    text-decoration: none;
    white-space: nowrap;
  }

  .dashHeaderActions .dashPrimaryAction {
    border-color: #07865f;
    background: #07865f;
    color: #ffffff;
  }

  .dashKpiBar {
    display: grid;
    grid-template-columns:
      repeat(5, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid #d9e4e0;
    border-radius: 13px;
    background: #ffffff;
  }

  .dashKpiBar a {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
    min-width: 0;
    padding: 15px 17px;
    border-right: 1px solid #e1e9e6;
    color: inherit;
    text-decoration: none;
  }

  .dashKpiBar a:last-child {
    border-right: 0;
  }

  .dashKpiBar span {
    color: #6b7f78;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .dashKpiBar strong {
    grid-row: 1 / span 2;
    grid-column: 2;
    align-self: center;
    color: #11263a;
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
  }

  .dashKpiBar small {
    overflow: hidden;
    color: #526a62;
    font-size: 12px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashControlGrid {
    display: grid;
    grid-template-columns:
      minmax(0, 1.65fr)
      minmax(310px, 0.68fr);
    gap: 16px;
    align-items: start;
  }

  .dashPlanning,
  .dashAttention {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .dashPanel {
    min-width: 0;
    padding: 19px;
    border: 1px solid #d9e4e0;
    border-radius: 15px;
    background: #ffffff;
    box-shadow: 0 8px 22px rgba(16, 33, 53, 0.04);
    box-sizing: border-box;
  }

  .dashPanelHead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 15px;
  }

  .dashPanelHead h2 {
    margin: 4px 0 4px;
    color: #102338;
    font-size: 23px;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .dashPanelHead > div > span {
    color: #6a7f78;
    font-size: 12px;
    font-weight: 620;
    line-height: 1.45;
  }

  .dashPanelCount {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    height: 34px;
    padding: 0 10px;
    border-radius: 999px;
    background: #edf7f3;
    color: #087b59;
    font-size: 15px;
    font-weight: 900;
  }

  .dashTodayEmpty {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr)
      minmax(245px, 0.72fr);
    gap: 12px;
    align-items: stretch;
  }

  .dashTodayEmpty > div,
  .dashTodayEmpty > a,
  .dashSimpleEmpty {
    display: grid;
    align-content: center;
    gap: 5px;
    min-height: 105px;
    padding: 16px;
    border: 1px solid #dfe8e4;
    border-radius: 11px;
    background: #fafcfb;
    box-sizing: border-box;
  }

  .dashTodayEmpty > a {
    border-color: #bcdccb;
    background: #f1faf6;
    color: inherit;
    text-decoration: none;
  }

  .dashTodayEmpty strong,
  .dashSimpleEmpty strong {
    color: #12273b;
    font-size: 17px;
    font-weight: 850;
  }

  .dashTodayEmpty span,
  .dashSimpleEmpty span {
    color: #667b74;
    font-size: 12px;
    font-weight: 620;
    line-height: 1.45;
  }

  .dashTodayEmpty small {
    color: #07805d;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .dashOrderTable {
    display: grid;
    overflow: hidden;
    border: 1px solid #dce6e2;
    border-radius: 11px;
  }

  .dashOrderTableHead,
  .dashOrderRow {
    display: grid;
    grid-template-columns:
      88px
      minmax(0, 1fr)
      90px
      128px;
    gap: 14px;
    align-items: center;
  }

  .dashOrderTableHead {
    min-height: 36px;
    padding: 0 14px;
    background: #edf6f2;
    color: #577068;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .dashOrderRow {
    min-height: 82px;
    padding: 11px 14px;
    border-top: 1px solid #e2e9e6;
    background: #ffffff;
    color: inherit;
    text-decoration: none;
    box-sizing: border-box;
  }

  .dashOrderRow:hover,
  .dashCompactOrder:hover,
  .dashAttentionList a:hover {
    background: #f5faf8;
  }

  .dashOrderTime {
    display: grid;
    gap: 2px;
  }

  .dashOrderTime strong {
    color: #087b59;
    font-size: 22px;
    font-weight: 900;
    line-height: 1;
  }

  .dashOrderTime span {
    color: #778a84;
    font-size: 10px;
    font-weight: 700;
  }

  .dashOrderIdentity {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .dashOrderIdentity strong,
  .dashOrderIdentity span,
  .dashOrderIdentity small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashOrderIdentity strong {
    color: #13283c;
    font-size: 15px;
    font-weight: 850;
  }

  .dashOrderIdentity span {
    color: #3c554e;
    font-size: 12px;
    font-weight: 700;
  }

  .dashOrderIdentity small {
    color: #758882;
    font-size: 10px;
    font-weight: 620;
  }

  .dashOrderQuantity {
    display: grid;
    gap: 2px;
    text-align: center;
  }

  .dashOrderQuantity strong {
    color: #172e42;
    font-size: 19px;
    font-weight: 900;
  }

  .dashOrderQuantity span {
    color: #748780;
    font-size: 9px;
    font-weight: 700;
  }

  .dashOrderRow em,
  .dashCompactOrder em {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    padding: 0 9px;
    border: 1px solid #c9e3d9;
    border-radius: 999px;
    background: #edf8f4;
    color: #087b5b;
    font-size: 9px;
    font-weight: 850;
    font-style: normal;
    text-align: center;
  }

  .dashUpcomingScroll {
    display: grid;
    gap: 14px;
    max-height: 650px;
    padding-right: 6px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .dashUpcomingScroll {
    scrollbar-width: thin;
    scrollbar-color: #93c8b7 #edf5f2;
  }

  .dashUpcomingScroll::-webkit-scrollbar {
    width: 8px;
  }

  .dashUpcomingScroll::-webkit-scrollbar-track {
    background: #edf5f2;
    border-radius: 999px;
  }

  .dashUpcomingScroll::-webkit-scrollbar-thumb {
    border: 2px solid #edf5f2;
    border-radius: 999px;
    background: #93c8b7;
  }

  .dashDateGroup {
    display: grid;
    gap: 7px;
  }

  .dashDateGroup > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 34px;
    padding: 0 11px;
    border-left: 3px solid #0a966e;
    background: #f1f7f5;
  }

  .dashDateGroup > header > div {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dashDateGroup > header strong {
    color: #163128;
    font-size: 12px;
    font-weight: 850;
    text-transform: capitalize;
  }

  .dashDateGroup > header span {
    color: #6a7e77;
    font-size: 10px;
    font-weight: 700;
  }

  .dashDateOrders {
    display: grid;
    overflow: hidden;
    border: 1px solid #dfe7e4;
    border-radius: 9px;
  }

  .dashCompactOrder {
    display: grid;
    grid-template-columns:
      62px
      minmax(0, 1fr)
      82px
      116px;
    gap: 12px;
    align-items: center;
    min-height: 61px;
    padding: 9px 12px;
    border-bottom: 1px solid #e4eae8;
    background: #ffffff;
    color: inherit;
    text-decoration: none;
  }

  .dashCompactOrder:last-child {
    border-bottom: 0;
  }

  .dashCompactTime {
    color: #087b59;
    font-size: 16px;
    font-weight: 900;
  }

  .dashCompactOrder > div {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .dashCompactOrder > div strong,
  .dashCompactOrder > div span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashCompactOrder > div strong {
    color: #152a3d;
    font-size: 13px;
    font-weight: 830;
  }

  .dashCompactOrder > div span,
  .dashCompactOrder > small {
    color: #6c8079;
    font-size: 10px;
    font-weight: 650;
  }

  .dashAttentionList {
    display: grid;
    overflow: hidden;
    border: 1px solid #dfe7e4;
    border-radius: 10px;
  }

  .dashAttentionList a {
    display: grid;
    grid-template-columns:
      46px
      minmax(0, 1fr)
      18px;
    gap: 11px;
    align-items: center;
    min-height: 68px;
    padding: 10px 12px;
    border-bottom: 1px solid #e3e9e7;
    color: inherit;
    text-decoration: none;
  }

  .dashAttentionList a:last-child {
    border-bottom: 0;
  }

  .dashAttentionList > a > strong {
    color: #0a7959;
    font-size: 24px;
    font-weight: 900;
    text-align: center;
  }

  .dashAttentionList a > div {
    display: grid;
    gap: 3px;
  }

  .dashAttentionList span {
    color: #152b3e;
    font-size: 13px;
    font-weight: 820;
  }

  .dashAttentionList small {
    color: #748780;
    font-size: 10px;
    font-weight: 620;
  }

  .dashAttentionList b {
    color: #7b8e87;
    font-size: 22px;
    font-weight: 500;
  }

  .dashNextPanel {
    background: #075540;
  }

  .dashNextPanel .dashEyebrow,
  .dashNextPanel .dashPanelHead h2 {
    color: #ffffff;
  }

  .dashNextPanel .dashEyebrow {
    color: #8be0c3;
  }

  .dashNextOrder {
    display: grid;
    gap: 6px;
    color: #ffffff;
    text-decoration: none;
  }

  .dashNextOrder > span {
    color: #a3dfcc;
    font-size: 10px;
    font-weight: 850;
    text-transform: uppercase;
  }

  .dashNextOrder > strong {
    font-size: 30px;
    font-weight: 900;
    line-height: 1;
  }

  .dashNextOrder h3 {
    margin: 6px 0 0;
    color: #ffffff;
    font-size: 18px;
  }

  .dashNextOrder p,
  .dashNextOrder small {
    margin: 0;
    color: #d5ebe3;
    font-size: 11px;
    font-weight: 620;
    line-height: 1.45;
  }

  .dashInventoryOkay,
  .dashInventoryList a {
    display: grid;
    gap: 4px;
    padding: 13px;
    border: 1px solid #dfe7e4;
    border-radius: 9px;
    background: #fafcfb;
  }

  .dashInventoryOkay strong,
  .dashInventoryList strong {
    color: #152a3e;
    font-size: 13px;
    font-weight: 830;
  }

  .dashInventoryOkay span,
  .dashInventoryList span {
    color: #71857e;
    font-size: 10px;
    font-weight: 620;
  }

  .dashInventoryList {
    display: grid;
    gap: 7px;
  }

  .dashInventoryList a {
    color: inherit;
    text-decoration: none;
  }

  .dashFinanceStrip {
    display: grid;
    grid-template-columns:
      minmax(170px, 1.25fr)
      repeat(4, minmax(120px, 0.8fr))
      auto;
    gap: 0;
    overflow: hidden;
    border: 1px solid #d9e4e0;
    border-radius: 13px;
    background: #ffffff;
  }

  .dashFinanceStrip > div,
  .dashFinanceStrip > a {
    display: grid;
    align-content: center;
    gap: 4px;
    min-height: 78px;
    padding: 12px 16px;
    border-right: 1px solid #e1e9e6;
    color: inherit;
    text-decoration: none;
  }

  .dashFinanceStrip h2 {
    margin: 2px 0 0;
    color: #12273b;
    font-size: 18px;
  }

  .dashFinanceStrip > a span {
    color: #6b8078;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .dashFinanceStrip > a strong {
    color: #13283c;
    font-size: 19px;
    font-weight: 900;
  }

  .dashFinanceStrip .dashFinanceOpen {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 138px;
    border-right: 0;
    background: #f1f8f5;
    color: #087a59;
    font-size: 12px;
    font-weight: 850;
  }

  @media (max-width: 1180px) {
    .dashControlGrid {
      grid-template-columns: 1fr;
    }

    .dashAttention {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .dashAttention > .dashPanel:first-child {
      grid-column: 1 / -1;
    }

    .dashFinanceStrip {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .dashFinanceStrip > div {
      grid-column: 1 / -1;
    }

    .dashFinanceStrip .dashFinanceOpen {
      min-width: 0;
    }
  }

  @media (max-width: 780px) {
    .dashPage {
      padding: 20px 16px 34px;
    }

    .dashHeader {
      flex-direction: column;
    }

    .dashHeader h1 {
      font-size: 34px;
    }

    .dashHeaderActions,
    .dashHeaderActions a {
      width: 100%;
    }

    .dashKpiBar {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .dashKpiBar a {
      border-bottom: 1px solid #e1e9e6;
    }

    .dashTodayEmpty,
    .dashAttention {
      grid-template-columns: 1fr;
    }

    .dashAttention > .dashPanel:first-child {
      grid-column: auto;
    }

    .dashOrderTableHead {
      display: none;
    }

    .dashOrderRow,
    .dashCompactOrder {
      grid-template-columns:
        72px
        minmax(0, 1fr);
    }

    .dashOrderQuantity,
    .dashOrderRow em,
    .dashCompactOrder > small,
    .dashCompactOrder em {
      justify-self: start;
    }

    .dashUpcomingScroll {
      max-height: none;
      overflow: visible;
      scrollbar-gutter: auto;
    }
  }

  @media (max-width: 520px) {
    .dashKpiBar,
    .dashFinanceStrip {
      grid-template-columns: 1fr;
    }

    .dashKpiBar a,
    .dashFinanceStrip > div,
    .dashFinanceStrip > a {
      border-right: 0;
      border-bottom: 1px solid #e1e9e6;
    }

    .dashFinanceStrip .dashFinanceOpen {
      width: auto;
    }
  }

  /* gastario-dashboard-workspace-controls-20260726 */

  .dashWorkspaceTabs {
    display: flex;
    align-items: center;
    gap: 5px;
    min-height: 48px;
    padding: 5px;
    overflow-x: auto;
    border: 1px solid #d9e4e0;
    border-radius: 12px;
    background: #ffffff;
  }

  .dashWorkspaceTabs button {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 38px;
    padding: 0 18px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #5d716a;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
  }

  .dashWorkspaceTabs button:hover {
    background: #f2f7f5;
    color: #173b32;
  }

  .dashWorkspaceTabs button[data-active="true"] {
    background: #e6f5ef;
    color: #087b59;
    box-shadow:
      inset 0 0 0 1px #c3e3d7;
  }

  .dashWorkspaceTabs button span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 21px;
    height: 21px;
    padding: 0 6px;
    border-radius: 999px;
    background: #07865f;
    color: #ffffff;
    font-size: 10px;
    font-weight: 900;
  }

  .dashFilterBar {
    display: grid;
    grid-template-columns:
      auto
      minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 11px 13px;
    border: 1px solid #d9e4e0;
    border-radius: 12px;
    background: #ffffff;
  }

  .dashPeriodFilter {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border: 1px solid #dce6e2;
    border-radius: 9px;
    background: #f2f7f5;
  }

  .dashPeriodFilter button {
    min-height: 34px;
    padding: 0 13px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #657970;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .dashPeriodFilter button[data-active="true"] {
    background: #ffffff;
    color: #087b59;
    box-shadow:
      0 2px 8px rgba(16, 33, 53, 0.08),
      inset 0 0 0 1px #d2e3dc;
  }

  .dashFilterControls {
    display: grid;
    grid-template-columns:
      minmax(145px, 185px)
      minmax(220px, 1fr)
      auto;
    gap: 9px;
    min-width: 0;
  }

  .dashFilterControls select,
  .dashSearchField,
  .dashResetButton {
    min-height: 40px;
    border: 1px solid #d6e1dd;
    border-radius: 9px;
    background: #ffffff;
    box-sizing: border-box;
  }

  .dashFilterControls select {
    width: 100%;
    padding: 0 31px 0 12px;
    color: #304b43;
    font-size: 12px;
    font-weight: 750;
  }

  .dashSearchField {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    padding: 0 12px;
  }

  .dashSearchField > span {
    flex: 0 0 auto;
    color: #778d85;
    font-size: 20px;
    line-height: 1;
  }

  .dashSearchField input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #203b34;
    font-size: 12px;
    font-weight: 650;
  }

  .dashSearchField input::placeholder {
    color: #8da099;
  }

  .dashResetButton {
    padding: 0 14px;
    color: #496159;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .dashResetButton:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .dashPage[data-view="planning"]
  .dashAttention {
    display: none;
  }

  .dashPage[data-view="planning"]
  .dashControlGrid {
    grid-template-columns: 1fr;
  }

  .dashPage[data-view="tasks"]
  .dashPlanning {
    display: none;
  }

  .dashPage[data-view="tasks"]
  .dashControlGrid {
    grid-template-columns: 1fr;
  }

  .dashPage[data-view="tasks"]
  .dashAttention {
    grid-template-columns:
      repeat(3, minmax(0, 1fr));
  }

  .dashPage[data-view="finance"]
  .dashControlGrid {
    display: none;
  }

  .dashPage[data-view="planning"]
  .dashFinanceStrip,
  .dashPage[data-view="tasks"]
  .dashFinanceStrip {
    display: none;
  }

  @media (max-width: 980px) {
    .dashFilterBar {
      grid-template-columns: 1fr;
    }

    .dashPeriodFilter {
      overflow-x: auto;
    }

    .dashPage[data-view="tasks"]
    .dashAttention {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 700px) {
    .dashFilterControls {
      grid-template-columns: 1fr;
    }
  }
  /* gastario-dashboard-focused-planning-20260726 */

  .dashTodayPanel {
    display: none;
  }

  .dashNextPanel {
    display: none;
  }

  .dashUpcomingPanel {
    min-height: auto;
  }

  .dashUpcomingScroll {
    max-height: none;
    padding-right: 0;
    overflow: visible;
    scrollbar-gutter: auto;
  }

  .dashPlanning,
  .dashAttention {
    align-content: start;
  }

  .dashControlGrid {
    grid-template-columns:
      minmax(0, 1.75fr)
      minmax(300px, 0.62fr);
  }

  .dashDateGroup > header {
    min-height: 40px;
  }

  .dashCompactOrder {
    min-height: 68px;
  }

  @media (max-width: 1180px) {
    .dashControlGrid {
      grid-template-columns: 1fr;
    }
  }
  /* gastario-dashboard-planning-scroll-20260726 */

  .dashUpcomingScroll {
    max-height: 620px;
    padding-right: 7px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: #8fc7b5 #edf5f2;
  }

  .dashUpcomingScroll::-webkit-scrollbar {
    width: 8px;
  }

  .dashUpcomingScroll::-webkit-scrollbar-track {
    border-radius: 999px;
    background: #edf5f2;
  }

  .dashUpcomingScroll::-webkit-scrollbar-thumb {
    border: 2px solid #edf5f2;
    border-radius: 999px;
    background: #8fc7b5;
  }

  .dashDateGroup > header {
    position: sticky;
    top: 0;
    z-index: 3;
    box-shadow: 0 1px 0 #dce7e2;
  }

  @media (max-width: 780px) {
    .dashUpcomingScroll {
      max-height: none;
      padding-right: 0;
      overflow: visible;
      scrollbar-gutter: auto;
    }

    .dashDateGroup > header {
      position: static;
    }
  }
  /* gastario-dashboard-compact-workbar-20260726 */

  .dashControlGrid {
    grid-template-columns:
      minmax(0, 1.9fr)
      minmax(290px, 0.55fr);
  }

  .dashWorkbar {
    padding: 15px;
  }

  .dashWorkbarHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .dashWorkbarHeader h2 {
    margin: 4px 0 0;
    color: #102338;
    font-size: 21px;
    line-height: 1.15;
  }

  .dashWorkbarHeader > span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 34px;
    padding: 0 8px;
    border-radius: 999px;
    background: #eaf6f1;
    color: #087b59;
    font-size: 14px;
    font-weight: 900;
  }

  .dashWorkbarTabs {
    display: grid;
    grid-template-columns:
      repeat(3, minmax(0, 1fr));
    gap: 3px;
    padding: 3px;
    margin-bottom: 11px;
    border: 1px solid #dbe5e1;
    border-radius: 9px;
    background: #f3f7f5;
  }

  .dashWorkbarTabs button {
    min-height: 34px;
    padding: 0 6px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #687b74;
    font-size: 10px;
    font-weight: 850;
    cursor: pointer;
  }

  .dashWorkbarTabs button[data-active="true"] {
    background: #ffffff;
    color: #087b59;
    box-shadow:
      0 2px 7px rgba(16, 33, 53, 0.07),
      inset 0 0 0 1px #d1e2dc;
  }

  .dashWorkbarList,
  .dashWorkbarQuick,
  .dashWorkbarStockList {
    display: grid;
    overflow: hidden;
    border: 1px solid #dfe7e4;
    border-radius: 9px;
  }

  .dashWorkbarList a {
    display: grid;
    grid-template-columns:
      40px
      minmax(0, 1fr)
      16px;
    gap: 10px;
    align-items: center;
    min-height: 61px;
    padding: 9px 11px;
    border-bottom: 1px solid #e3eae7;
    color: inherit;
    text-decoration: none;
  }

  .dashWorkbarList a:last-child,
  .dashWorkbarQuick a:last-child,
  .dashWorkbarStockList a:last-child {
    border-bottom: 0;
  }

  .dashWorkbarList a:hover,
  .dashWorkbarQuick a:hover,
  .dashWorkbarStockList a:hover {
    background: #f5faf8;
  }

  .dashWorkbarList > a > strong {
    color: #087b59;
    font-size: 22px;
    font-weight: 900;
    text-align: center;
  }

  .dashWorkbarList a > div,
  .dashWorkbarQuick a > div {
    display: grid;
    gap: 2px;
  }

  .dashWorkbarList span,
  .dashWorkbarQuick strong {
    color: #152b3e;
    font-size: 12px;
    font-weight: 830;
  }

  .dashWorkbarList small,
  .dashWorkbarQuick span {
    color: #748780;
    font-size: 9px;
    font-weight: 620;
  }

  .dashWorkbarList b,
  .dashWorkbarQuick b {
    color: #81938c;
    font-size: 20px;
    font-weight: 500;
  }

  .dashWorkbarInventory {
    display: grid;
    gap: 10px;
  }

  .dashWorkbarInventoryStatus {
    display: grid;
    grid-template-columns:
      44px
      minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 11px;
    border: 1px solid #dfe7e4;
    border-radius: 9px;
    background: #f8fbfa;
  }

  .dashWorkbarInventoryStatus > strong {
    color: #087b59;
    font-size: 23px;
    font-weight: 900;
    text-align: center;
  }

  .dashWorkbarInventoryStatus > div,
  .dashWorkbarOkay {
    display: grid;
    gap: 3px;
  }

  .dashWorkbarInventoryStatus span,
  .dashWorkbarOkay strong {
    color: #152b3e;
    font-size: 12px;
    font-weight: 830;
  }

  .dashWorkbarInventoryStatus small,
  .dashWorkbarOkay span {
    color: #748780;
    font-size: 9px;
    font-weight: 620;
    line-height: 1.4;
  }

  .dashWorkbarOkay {
    padding: 12px;
    border: 1px solid #dfe7e4;
    border-radius: 9px;
    background: #ffffff;
  }

  .dashWorkbarStockList a {
    display: grid;
    gap: 3px;
    padding: 10px 12px;
    border-bottom: 1px solid #e3eae7;
    color: inherit;
    text-decoration: none;
  }

  .dashWorkbarStockList strong {
    color: #173044;
    font-size: 11px;
    font-weight: 820;
  }

  .dashWorkbarStockList span {
    color: #72857e;
    font-size: 9px;
    font-weight: 620;
  }

  .dashWorkbarOpenButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    border: 1px solid #cde1d9;
    border-radius: 9px;
    background: #eff8f4;
    color: #087b59;
    font-size: 11px;
    font-weight: 850;
    text-decoration: none;
  }

  .dashWorkbarQuick a {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr)
      16px;
    gap: 10px;
    align-items: center;
    min-height: 55px;
    padding: 9px 11px;
    border-bottom: 1px solid #e3eae7;
    color: inherit;
    text-decoration: none;
  }

  .dashFinanceStrip {
    display: none;
  }

  .dashPage[data-view="finance"]
  .dashFinanceStrip {
    display: grid;
  }

  .dashPage[data-view="finance"]
  .dashControlGrid {
    display: none;
  }

  @media (max-width: 1120px) {
    .dashControlGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 520px) {
    .dashWorkbarTabs {
      grid-template-columns: 1fr;
    }
  }
  /* gastario-dashboard-fullwidth-overview-tasks-20260726 */

  /*
   * Übersicht:
   * Lieferplan über die volle Breite.
   * Rechte Arbeitsleiste vollständig ausblenden.
   */
  .dashPage[data-view="overview"]
  .dashControlGrid {
    grid-template-columns: minmax(0, 1fr);
  }

  .dashPage[data-view="overview"]
  .dashAttention {
    display: none !important;
  }

  .dashPage[data-view="overview"]
  .dashPlanning {
    width: 100%;
    min-width: 0;
  }

  .dashPage[data-view="overview"]
  .dashUpcomingPanel {
    width: 100%;
  }

  /*
   * Lieferplan:
   * Ebenfalls maximale Breite ohne rechte Seitenleiste.
   */
  .dashPage[data-view="planning"]
  .dashControlGrid {
    grid-template-columns: minmax(0, 1fr);
  }

  .dashPage[data-view="planning"]
  .dashAttention {
    display: none !important;
  }

  /*
   * Offene Aufgaben:
   * Eigener großer Arbeitsbereich statt kleiner Karte links.
   */
  .dashPage[data-view="tasks"]
  .dashControlGrid {
    display: block;
    width: 100%;
  }

  .dashPage[data-view="tasks"]
  .dashPlanning {
    display: none !important;
  }

  .dashPage[data-view="tasks"]
  .dashAttention {
    display: block !important;
    width: 100%;
    max-width: none;
    margin: 0;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbar {
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
    padding: 24px;
    border-radius: 18px;
    box-sizing: border-box;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarHeader {
    align-items: center;
    margin-bottom: 18px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarHeader h2 {
    margin-top: 5px;
    font-size: 28px;
    letter-spacing: -0.025em;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarHeader > span {
    min-width: 42px;
    height: 42px;
    font-size: 16px;
  }

  /*
   * Arbeitsbereich-Navigation:
   * Breiter und ruhiger.
   */
  .dashPage[data-view="tasks"]
  .dashWorkbarTabs {
    grid-template-columns:
      repeat(3, minmax(0, 1fr));
    width: 100%;
    max-width: none;
    gap: 5px;
    padding: 5px;
    margin-bottom: 18px;
    border-radius: 12px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarTabs button {
    min-height: 42px;
    padding: 0 14px;
    border-radius: 9px;
    font-size: 12px;
  }

  /*
   * Aufgabenliste:
   * Größere Zeilen und bessere Lesbarkeit.
   */
  .dashPage[data-view="tasks"]
  .dashWorkbarList {
    border-radius: 13px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarList a {
    grid-template-columns:
      64px
      minmax(0, 1fr)
      24px;
    gap: 16px;
    min-height: 84px;
    padding: 14px 18px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarList > a > strong {
    font-size: 30px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarList span {
    font-size: 14px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarList small {
    margin-top: 2px;
    font-size: 11px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarList b {
    font-size: 25px;
  }

  /*
   * Lagerbereich:
   * Nutzt ebenfalls die volle verfügbare Breite.
   */
  .dashPage[data-view="tasks"]
  .dashWorkbarInventory {
    gap: 14px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarInventoryStatus {
    grid-template-columns:
      64px
      minmax(0, 1fr);
    min-height: 82px;
    padding: 14px 18px;
    border-radius: 13px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarInventoryStatus > strong {
    font-size: 30px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarInventoryStatus span {
    font-size: 14px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarInventoryStatus small {
    font-size: 11px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarOkay {
    min-height: 70px;
    justify-content: center;
    padding: 16px 18px;
    border-radius: 13px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarStockList {
    border-radius: 13px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarStockList a {
    min-height: 62px;
    justify-content: center;
    padding: 12px 18px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarOpenButton {
    min-height: 44px;
    border-radius: 11px;
    font-size: 12px;
  }

  /*
   * Schnellzugriff:
   * Gleichmäßige breite Funktionszeilen.
   */
  .dashPage[data-view="tasks"]
  .dashWorkbarQuick {
    border-radius: 13px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarQuick a {
    grid-template-columns:
      minmax(0, 1fr)
      24px;
    min-height: 72px;
    padding: 12px 18px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarQuick strong {
    font-size: 14px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarQuick span {
    margin-top: 2px;
    font-size: 11px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarQuick b {
    font-size: 25px;
  }

  /*
   * Finanzansicht:
   * Nur die Finanzleiste anzeigen.
   */
  .dashPage[data-view="finance"]
  .dashControlGrid {
    display: none !important;
  }

  .dashPage[data-view="finance"]
  .dashFinanceStrip {
    display: grid;
  }

  /*
   * Responsive Darstellung.
   */
  @media (max-width: 760px) {
    .dashPage[data-view="tasks"]
    .dashWorkbar {
      padding: 16px;
      border-radius: 14px;
    }

    .dashPage[data-view="tasks"]
    .dashWorkbarHeader h2 {
      font-size: 24px;
    }

    .dashPage[data-view="tasks"]
    .dashWorkbarTabs {
      grid-template-columns: 1fr;
    }

    .dashPage[data-view="tasks"]
    .dashWorkbarList a {
      grid-template-columns:
        48px
        minmax(0, 1fr)
        20px;
      min-height: 72px;
      padding: 12px;
    }
  }
  /* gastario-dashboard-distinct-overview-tasks-20260726 */

  .dashOverviewHome {
    display: grid;
    gap: 16px;
  }

  .dashOverviewDeliveries {
    padding: 22px;
  }

  .dashOverviewTextButton {
    min-height: 40px;
    padding: 0 15px;
    border: 1px solid #d6e4df;
    border-radius: 10px;
    background: #ffffff;
    color: #087b59;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .dashOverviewDeliveryList {
    display: grid;
    overflow: hidden;
    border: 1px solid #dce6e2;
    border-radius: 13px;
  }

  .dashOverviewDelivery {
    display: grid;
    grid-template-columns:
      170px
      minmax(0, 1fr)
      110px
      20px;
    gap: 16px;
    align-items: center;
    min-height: 82px;
    padding: 13px 17px;
    border-bottom: 1px solid #e6ece9;
    color: inherit;
    text-decoration: none;
  }

  .dashOverviewDelivery:last-child {
    border-bottom: 0;
  }

  .dashOverviewDelivery:hover {
    background: #f7fbf9;
  }

  .dashOverviewDate,
  .dashOverviewDelivery > div:nth-child(2) {
    display: grid;
    gap: 3px;
  }

  .dashOverviewDate strong {
    color: #183445;
    font-size: 12px;
    font-weight: 800;
  }

  .dashOverviewDate span {
    color: #087b59;
    font-size: 18px;
    font-weight: 900;
  }

  .dashOverviewDelivery > div:nth-child(2) > strong {
    color: #102536;
    font-size: 14px;
    font-weight: 850;
  }

  .dashOverviewDelivery > div:nth-child(2) > span {
    color: #4e6960;
    font-size: 11px;
    font-weight: 700;
  }

  .dashOverviewDelivery > div:nth-child(2) > small {
    color: #84958f;
    font-size: 10px;
    font-weight: 600;
  }

  .dashOverviewDelivery > em {
    color: #637870;
    font-size: 11px;
    font-style: normal;
    font-weight: 750;
    text-align: right;
  }

  .dashOverviewDelivery > b {
    color: #82958d;
    font-size: 22px;
    font-weight: 500;
  }

  .dashOverviewOperations {
    display: grid;
    grid-template-columns:
      minmax(0, 1.45fr)
      minmax(300px, 0.7fr);
    gap: 16px;
  }

  .dashOverviewStatus,
  .dashOverviewQuickActions {
    padding: 20px;
  }

  .dashOverviewStatusGrid {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid #dce6e2;
    border-radius: 13px;
  }

  .dashOverviewStatusGrid a,
  .dashOverviewStatusGrid button {
    display: grid;
    gap: 4px;
    min-height: 118px;
    padding: 17px;
    border: 0;
    border-right: 1px solid #e3ebe7;
    background: #ffffff;
    color: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .dashOverviewStatusGrid > :last-child {
    border-right: 0;
  }

  .dashOverviewStatusGrid a:hover,
  .dashOverviewStatusGrid button:hover {
    background: #f6fbf9;
  }

  .dashOverviewStatusGrid strong {
    color: #087b59;
    font-size: 30px;
    line-height: 1;
    font-weight: 900;
  }

  .dashOverviewStatusGrid span {
    color: #153043;
    font-size: 12px;
    font-weight: 830;
  }

  .dashOverviewStatusGrid small {
    color: #7b8e87;
    font-size: 10px;
    font-weight: 600;
  }

  .dashOverviewQuickActions > div:last-child {
    display: grid;
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .dashOverviewQuickActions a {
    display: grid;
    gap: 3px;
    min-height: 62px;
    padding: 11px 13px;
    border: 1px solid #dce6e2;
    border-radius: 10px;
    background: #ffffff;
    text-decoration: none;
  }

  .dashOverviewQuickActions a:hover {
    background: #f6fbf9;
  }

  .dashOverviewQuickActions strong {
    color: #153043;
    font-size: 12px;
    font-weight: 830;
  }

  .dashOverviewQuickActions span {
    color: #788b84;
    font-size: 9px;
    font-weight: 620;
  }

  .dashPage[data-view="overview"]
  .dashControlGrid {
    display: none !important;
  }

  .dashPage:not([data-view="overview"])
  .dashOverviewHome {
    display: none;
  }

  .dashPage[data-view="planning"]
  .dashControlGrid {
    display: grid;
  }

  .dashPage[data-view="planning"]
  .dashAttention {
    display: none !important;
  }

  .dashPage[data-view="planning"]
  .dashPlanning {
    width: 100%;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarTaskGrid {
    display: grid;
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 0;
    overflow: visible;
    border: 0;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarTaskGrid a {
    min-height: 86px;
    border: 1px solid #dce6e2;
    border-radius: 12px;
  }

  .dashPage[data-view="tasks"]
  .dashWorkbarTaskGrid a:last-child {
    border-bottom: 1px solid #dce6e2;
  }

  @media (max-width: 1050px) {
    .dashOverviewOperations {
      grid-template-columns: 1fr;
    }

    .dashOverviewStatusGrid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .dashOverviewStatusGrid a,
    .dashOverviewStatusGrid button {
      border-bottom: 1px solid #e3ebe7;
    }
  }

  @media (max-width: 760px) {
    .dashOverviewDelivery {
      grid-template-columns: 1fr;
    }

    .dashOverviewDelivery > em {
      text-align: left;
    }

    .dashOverviewStatusGrid,
    .dashPage[data-view="tasks"]
    .dashWorkbarTaskGrid {
      grid-template-columns: 1fr;
    }

    .dashOverviewQuickActions > div:last-child {
      grid-template-columns: 1fr;
    }
  }
  /* gastario-dashboard-mobile-final-20260729 */
  @media (max-width: 780px) {
    .dashPage {
      width: 100%;
      max-width: 100%;
      gap: 12px;
      padding: 16px 12px 30px;
      overflow-x: hidden;
    }

    .dashPage,
    .dashPage * {
      box-sizing: border-box;
    }

    .dashHeader {
      gap: 14px;
    }

    .dashHeader h1 {
      margin-top: 4px;
      font-size: 30px;
      line-height: 1.08;
    }

    .dashSubtitle {
      font-size: 12px;
      line-height: 1.45;
    }

    .dashHeaderActions {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
    }

    .dashHeaderActions a {
      width: auto;
      min-width: 0;
      min-height: 46px;
      padding: 0 10px;
      text-align: center;
      white-space: normal;
    }

    .dashWorkspaceTabs {
      display: flex;
      gap: 6px;
      width: 100%;
      padding: 5px;
      overflow-x: auto;
      overflow-y: hidden;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }

    .dashWorkspaceTabs::-webkit-scrollbar,
    .dashPeriodFilter::-webkit-scrollbar {
      display: none;
    }

    .dashWorkspaceTabs button {
      flex: 0 0 auto;
      min-height: 42px;
      padding: 0 14px;
      scroll-snap-align: start;
      white-space: nowrap;
    }

    .dashFilterBar {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      padding: 10px;
    }

    .dashPeriodFilter {
      display: flex;
      gap: 5px;
      width: 100%;
      padding-bottom: 2px;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }

    .dashPeriodFilter button {
      flex: 0 0 auto;
      min-width: 72px;
      min-height: 42px;
      padding: 0 13px;
      white-space: nowrap;
    }

    .dashFilterControls {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      width: 100%;
    }

    .dashFilterControls select,
    .dashSearchField,
    .dashResetButton {
      width: 100%;
      min-width: 0;
      min-height: 44px;
    }

    .dashSearchField input {
      width: 100%;
      min-width: 0;
    }

    .dashKpiBar {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 8px;
      overflow: visible;
      border: 0;
      background: transparent;
    }

    .dashKpiBar a {
      min-height: 92px;
      padding: 13px;
      border: 1px solid #d9e4e0;
      border-radius: 12px;
      background: #ffffff;
    }

    .dashKpiBar a:last-child {
      grid-column: 1 / -1;
    }

    .dashKpiBar strong {
      font-size: 25px;
    }

    .dashKpiBar small {
      overflow: visible;
      line-height: 1.25;
      text-overflow: clip;
      white-space: normal;
    }

    .dashOverviewHome,
    .dashOverviewOperations,
    .dashControlGrid,
    .dashPlanning,
    .dashAttention {
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
      min-width: 0;
    }

    .dashPanel {
      width: 100%;
      min-width: 0;
      padding: 15px;
      border-radius: 13px;
    }

    .dashPanelHead {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      margin-bottom: 13px;
    }

    .dashPanelHead h2 {
      font-size: 21px;
    }

    .dashPanelHead > a,
    .dashPanelHead > button,
    .dashOverviewTextButton {
      width: 100%;
      min-height: 42px;
      justify-content: center;
    }

    .dashOverviewDeliveryList {
      display: grid;
      gap: 9px;
    }

    .dashOverviewDelivery {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      padding: 13px;
      border: 1px solid #dfe8e4;
      border-radius: 11px;
      background: #fbfdfc;
    }

    .dashOverviewDate {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding-bottom: 9px;
      border-bottom: 1px solid #e4ece9;
    }

    .dashOverviewDate strong,
    .dashOverviewDate span {
      min-width: 0;
    }

    .dashOverviewDelivery > div:nth-child(2) {
      min-width: 0;
    }

    .dashOverviewDelivery > div:nth-child(2) strong,
    .dashOverviewDelivery > div:nth-child(2) span,
    .dashOverviewDelivery > div:nth-child(2) small {
      display: block;
      overflow-wrap: anywhere;
    }

    .dashOverviewStatusGrid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .dashOverviewStatusGrid a,
    .dashOverviewStatusGrid button {
      min-width: 0;
      min-height: 108px;
      padding: 12px;
    }

    .dashOverviewQuickActions > div:last-child {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .dashOverviewQuickActions a {
      min-width: 0;
      min-height: 76px;
      padding: 12px;
    }

    .dashDateGroup {
      min-width: 0;
      overflow: hidden;
    }

    .dashDateGroup > header {
      align-items: flex-start;
      gap: 8px;
    }

    .dashOrderRow,
    .dashCompactOrder {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      min-width: 0;
      padding: 12px;
    }

    .dashOrderRow > *,
    .dashCompactOrder > * {
      min-width: 0;
      justify-self: stretch;
    }

    .dashOrderRow strong,
    .dashOrderRow span,
    .dashOrderRow small,
    .dashCompactOrder strong,
    .dashCompactOrder span,
    .dashCompactOrder small {
      overflow-wrap: anywhere;
    }

    .dashUpcomingScroll {
      width: 100%;
      min-width: 0;
      overflow: visible;
    }

    .dashWorkbarTabs {
      display: flex;
      gap: 5px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .dashWorkbarTabs::-webkit-scrollbar {
      display: none;
    }

    .dashWorkbarTabs button {
      flex: 0 0 auto;
      min-height: 42px;
      white-space: nowrap;
    }
  }

  @media (max-width: 520px) {
    .dashPage {
      padding-right: 10px;
      padding-left: 10px;
    }

    .dashHeaderActions {
      grid-template-columns: 1fr;
    }

    .dashKpiBar {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .dashKpiBar a:last-child {
      grid-column: 1 / -1;
    }

    .dashOverviewStatusGrid,
    .dashOverviewQuickActions > div:last-child {
      grid-template-columns: 1fr;
    }

    .dashOverviewStatusGrid a,
    .dashOverviewStatusGrid button {
      min-height: 86px;
    }

    .dashPanel {
      padding: 13px;
    }
  }
/*
 * gastario-dashboard-mobile-full-width-20260729
 * Gleiche mobile Inhaltsbreite wie die Eingangszentrale.
 */
@media (max-width: 780px) {
  .dashPage {
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 14px 7px 36px !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
  }

  .dashPage,
  .dashPage * {
    box-sizing: border-box;
  }

  .dashHeader,
  .dashWorkspaceTabs,
  .dashFilterBar,
  .dashKpiBar,
  .dashOverviewHome,
  .dashOverviewDeliveries,
  .dashOverviewOperations,
  .dashControlGrid,
  .dashPlanning,
  .dashAttention,
  .dashPanel,
  .dashTodayPanel,
  .dashUpcomingPanel,
  .dashWorkbar {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin-right: 0 !important;
    margin-left: 0 !important;
  }

  .dashHeader {
    padding-right: 5px !important;
    padding-left: 5px !important;
  }

  .dashHeaderActions {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .dashHeaderActions > * {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .dashWorkspaceTabs {
    padding-right: 2px !important;
    padding-left: 2px !important;
  }

  .dashFilterBar {
    padding: 11px !important;
    border-radius: 16px !important;
  }

  .dashPeriodFilter {
    width: 100% !important;
    min-width: 0 !important;
  }

  .dashPeriodFilter > * {
    min-width: 0 !important;
  }

  .dashKpiBar {
    gap: 10px !important;
  }

  .dashKpiBar > * {
    min-width: 0 !important;
  }

  .dashPanel {
    padding-right: 12px !important;
    padding-left: 12px !important;
    border-radius: 16px !important;
  }

  .dashOverviewDelivery,
  .dashOverviewStatusGrid > *,
  .dashOverviewQuickActions > * {
    min-width: 0 !important;
    max-width: 100% !important;
  }
}

@media (max-width: 390px) {
  .dashPage {
    padding-right: 5px !important;
    padding-left: 5px !important;
  }

  .dashFilterBar,
  .dashPanel {
    padding-right: 10px !important;
    padding-left: 10px !important;
  }
}

/*
 * gastario-dashboard-mobile-width-reference-20260730
 * Dashboard verwendet mobil dieselbe Breite wie der Auftragseingang.
 */
@media (max-width: 980px) {
  .dashPage {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 12px 6px 34px !important;
    gap: 12px !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
  }

  .dashPage,
  .dashPage * {
    box-sizing: border-box;
  }

  .dashPage > *,
  .dashHeader,
  .dashWorkspaceTabs,
  .dashFilterBar,
  .dashControlGrid,
  .dashAttention,
  .dashKpiBar,
  .dashFinanceStrip,
  .dashPanel,
  .dashUpcomingPanel,
  .dashUpcomingScroll,
  .dashDateGroup,
  .dashOrderList,
  .dashCompactOrder {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    margin-right: 0;
    margin-left: 0;
  }

  .dashHeader {
    gap: 12px !important;
  }

  .dashHeader h1,
  .dashPanel h2,
  .dashPanel h3,
  .dashCompactOrder strong,
  .dashCompactOrder span,
  .dashCompactOrder small {
    min-width: 0;
    max-width: 100%;
    word-break: normal;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  .dashControlGrid,
  .dashAttention,
  .dashKpiBar,
  .dashFinanceStrip {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .dashAttention > *,
  .dashKpiBar > *,
  .dashFinanceStrip > *,
  .dashControlGrid > * {
    grid-column: auto !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }

  .dashUpcomingScroll {
    padding-right: 0 !important;
    overflow-x: hidden !important;
  }

  .dashCompactOrder {
    overflow: hidden;
  }

  .dashWorkspaceTabs,
  .dashPeriodFilter {
    max-width: 100% !important;
    overflow-x: auto !important;
    overscroll-behavior-inline: contain;
    -webkit-overflow-scrolling: touch;
  }
}

@media (max-width: 520px) {
  .dashPage {
    padding: 12px 6px 30px !important;
  }

  .dashHeader h1 {
    font-size: 28px !important;
    line-height: 1.12 !important;
  }

  .dashPanel {
    padding-right: 12px !important;
    padding-left: 12px !important;
  }
}
`;