import { Link, useLoaderData } from "react-router";
import { useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import {
  GastarioButton,
  GastarioFilterBar,
  GastarioHeader,
  GastarioInput,
  GastarioSelect,
  GastarioTabs,
  gastarioButtonClass,
  GastarioMetric,
  GastarioMetricGrid,
  GastarioPanel,
  GastarioToolbar,
  GastarioInsight,
} from "../components/ui";
import { GastarioNotice } from "../components/ui";
import { GastarioMain, GastarioAside } from "../components/ui";
import { GastarioPage, GastarioStack, GastarioSplitView } from "../components/ui";
import { GastarioActionGrid, GastarioActionCard } from "../components/ui";
import { GastarioSection, GastarioDataList, GastarioDataRow, GastarioEmptyState } from "../components/ui";

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
        <GastarioPage>

          <GastarioHeader
            eyebrow="Dashboard"
            title="Einrichtung fehlt"
            description={data.setupError}
          />

          <GastarioSection
            eyebrow="Hinweis"
            title="Benutzer ist noch keinem Mandanten zugeordnet"
            description="Die Gastario-Einrichtung für diesen Benutzer ist noch nicht vollständig."
          >

            <GastarioNotice type="warning">
              <strong>Was jetzt?</strong>
              {" "}
              Lege im Super Admin einen Mandanten an oder füge diesen Benutzer
              einem bestehenden Mandanten als OWNER hinzu.
            </GastarioNotice>

            <GastarioToolbar>

              <a
                className={gastarioButtonClass("secondary")}
                href="/logout"
              >
                Ausloggen
              </a>

              <a
                className={gastarioButtonClass("primary")}
                href="/login"
              >
                Neu einloggen
              </a>

            </GastarioToolbar>

          </GastarioSection>

        </GastarioPage>
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
      <GastarioPage>
        <GastarioHeader
          eyebrow="Dashboard"
          title="Betriebsübersicht"
          subtitle={
            <>
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
            </>
          }
          actions={
            <>
              <Link
                to="/auftragseingang"
                className={gastarioButtonClass("secondary")}
              >
                Auftragseingang
              </Link>

              <Link
                to="/neuer-auftrag"
                className={gastarioButtonClass("primary")}
              >
                Neuer Auftrag
              </Link>
            </>
          }
        />

        {/* gastario-dashboard-workspace-controls-20260726 */}

        <GastarioTabs
          items={[
            {
              id: "overview",
              label: "Übersicht",
            },
            {
              id: "planning",
              label: "Lieferplan",
            },
            {
              id: "finance",
              label: "Finanzen",
            },
          ]}
          activeId={dashboardView}
          onChange={(id) =>
            setDashboardView(
              id as DashboardView
            )
          }
        />

        {dashboardView === "planning" ? (
          <GastarioFilterBar
            actions={
              <GastarioButton
                variant="ghost"
                type="button"
                onClick={resetDashboardFilters}
                disabled={
                  dashboardPeriod === "week" &&
                  dashboardStatus === "all" &&
                  dashboardSearch === ""
                }
              >
                Zurücksetzen
              </GastarioButton>
            }
          >

            <GastarioTabs
              items={[
                {
                  id: "today",
                  label: "Heute",
                },
                {
                  id: "tomorrow",
                  label: "Morgen",
                },
                {
                  id: "week",
                  label: "7 Tage",
                },
                {
                  id: "month",
                  label: "30 Tage",
                },
                {
                  id: "all",
                  label: "Alle",
                },
              ]}
              activeId={dashboardPeriod}
              onChange={(id) =>
                setDashboardPeriod(
                  id as DashboardPeriod
                )
              }
            />

            <GastarioSelect
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
            </GastarioSelect>

            <GastarioInput
              type="search"
              value={dashboardSearch}
              onChange={(event) =>
                setDashboardSearch(
                  event.target.value
                )
              }
              placeholder="Kunde, Auftrag oder Adresse suchen"
              aria-label="Dashboard durchsuchen"
            />

          </GastarioFilterBar>
        ) : null}

        <GastarioInsight
          eyebrow="Gastario Intelligence"
          title={
            dashboardTotalTasks > 0
              ? `${dashboardTotalTasks} Punkte benötigen deine Aufmerksamkeit.`
              : "Dein Betrieb ist aktuell aufgeräumt."
          }
          description={
            <>
              {dashboardTaskCounts.review > 0
                ? `${dashboardTaskCounts.review} Eingänge sind zu prüfen.`
                : "Keine neuen Eingänge zur Prüfung."}
              {" "}
              {dashboardTaskCounts.inventory > 0
                ? `${dashboardTaskCounts.inventory} Lagerwarnungen sind offen.`
                : "Der Lagerstatus ist unauffällig."}
            </>
          }
          actionLabel={
            dashboardTotalTasks > 0
              ? "Hinweise prüfen"
              : "Arbeitsbereich öffnen"
          }
          onAction={() =>
            setDashboardView("tasks")
          }
          tone={
            dashboardTotalTasks > 0
              ? "sand"
              : "sage"
          }
        />


        <GastarioMetricGrid>

          <Link
            to="/lieferungen"
            className="g-ui-metric-link"
          >
            <GastarioMetric
              label="Heute"
              value={todayOrdersSorted.length}
              description="Lieferungen"
            />
          </Link>


          <Link
            to="/auftraege"
            className="g-ui-metric-link"
          >
            <GastarioMetric
              label="Kommend"
              value={upcomingOrdersSorted.length}
              description="Geplante Aufträge"
            />
          </Link>


          <Link
            to="/rechnungen"
            className="g-ui-metric-link"
          >
            <GastarioMetric
              label="Finanzen"
              value={centsToEuro(
                data.finance.currentMonthGrossCents
              )}
              description="Monatsumsatz"
            />
          </Link>


          <Link
            to="/auftragseingang"
            className="g-ui-metric-link"
          >
            <GastarioMetric
              label="Offen"
              value={openReviewCount}
              description="Prüfungen"
            />
          </Link>


          {data.counts.lowInventory > 0 ? (

            <Link
              to="/lager"
              className="g-ui-metric-link"
            >
              <GastarioMetric
                label="Lager"
                value={data.counts.lowInventory}
                description="Warnungen"
              />
            </Link>

          ) : null}

        </GastarioMetricGrid>

        {dashboardView === "overview" ? (
          <GastarioStack>
            <GastarioSection
              eyebrow="Nächste Auslieferungen"
              title="Betriebsplan"
              description="Die nächsten drei geplanten Lieferungen im direkten Überblick."
              action={
                <GastarioButton
                  variant="secondary"
                  type="button"
                  onClick={() =>
                    setDashboardView("planning")
                  }
                >
                  Vollständigen Lieferplan öffnen
                </GastarioButton>
              }
            >

              {overviewNextOrders.length === 0 ? (

                <GastarioEmptyState title="Keine Lieferung geplant">
                  Aktuell sind keine zukünftigen Auslieferungen erfasst.
                </GastarioEmptyState>

              ) : (

                <GastarioDataList>

                  {overviewNextOrders.map(
                    (order: any) => (

                      <GastarioDataRow
                        key={order.id}
                        to={
                          "/auftrag-pruefung/" +
                          order.id
                        }
                      >

                        <div className="g-ui-data-row-main">

                          <strong className="g-ui-data-row-title">
                            {order.customerName ||
                              "Kunde nicht erkannt"}
                          </strong>

                          <span className="g-ui-data-row-description">
                            {order.eventName ||
                              order.orderNumber}
                          </span>

                          <span className="g-ui-data-row-description">
                            {order.deliveryAddress ||
                              "Lieferadresse noch offen"}
                          </span>

                        </div>


                        <div className="g-ui-data-row-meta">

                          <span>
                            {planningDateLabel(
                              order.deliveryDate
                            )}
                          </span>

                          <span>
                            {order.deliveryTimeText ||
                              "Zeit offen"}
                          </span>

                          <span>
                            {order.items.length}
                            {" Positionen"}
                          </span>

                        </div>


                        <div
                          className="g-ui-data-row-actions"
                          aria-hidden="true"
                        />


                        <span
                          className="g-ui-data-row-chevron"
                          aria-hidden="true"
                        >
                          →
                        </span>

                      </GastarioDataRow>
                    )
                  )}

                </GastarioDataList>

              )}

            </GastarioSection>

            <GastarioSplitView wide>
              <GastarioSection
                eyebrow="Operativer Stand"
                title="Heute im Betrieb"
              >

                <GastarioActionGrid columns={4}>

                  <GastarioActionCard
                    title="In Produktion"
                    description="Produktion bearbeiten"
                    meta={dashboardTaskCounts.production}
                    to="/produktion"
                    tone="sage"
                  />

                  <GastarioActionCard
                    title="Packen offen"
                    description="Packlisten bearbeiten"
                    meta={dashboardTaskCounts.packing}
                    to="/packlisten"
                    tone="sand"
                  />

                  <GastarioActionCard
                    title="Prüfung offen"
                    description="Eingänge kontrollieren"
                    meta={dashboardTaskCounts.review}
                    to="/auftragseingang"
                    tone="blue"
                  />

                  <GastarioActionCard
                    title="Alle Aufgaben"
                    description="Arbeitskorb öffnen"
                    meta={dashboardTotalTasks}
                    onClick={() =>
                      setDashboardView("tasks")
                    }
                    tone="neutral"
                  />

                </GastarioActionGrid>

              </GastarioSection>

              <GastarioSection
                eyebrow="Schnellzugriff"
                title="Direkt öffnen"
              >

                <GastarioActionGrid columns={2}>

                  <GastarioActionCard
                    title="Produktion"
                    description="Planung und Mengen"
                    to="/produktion"
                    tone="neutral"
                  />

                  <GastarioActionCard
                    title="Packlisten"
                    description="Kommissionierung"
                    to="/packlisten"
                    tone="neutral"
                  />

                  <GastarioActionCard
                    title="Lieferungen"
                    description="Touren und Fahrer"
                    to="/lieferungen"
                    tone="neutral"
                  />

                  <GastarioActionCard
                    title="Lieferscheine"
                    description="Dokumente vorbereiten"
                    to="/lieferscheine"
                    tone="neutral"
                  />

                  <GastarioActionCard
                    title="Rechnungen"
                    description="Abrechnung öffnen"
                    to="/rechnungen"
                    tone="neutral"
                  />

                  <GastarioActionCard
                    title="Lager"
                    description="Bestände prüfen"
                    to="/lager"
                    tone="neutral"
                  />

                </GastarioActionGrid>

              </GastarioSection>
            </GastarioSplitView>
          </GastarioStack>
        ) : null}

        <GastarioSplitView wide>
          <GastarioMain>
            <GastarioSection
              eyebrow="Tagesplan"
              title="Heutige Lieferungen"
              description="Alle für heute geplanten Auslieferungen nach Uhrzeit."
              action={
                <Link
                  to="/auftraege"
                  className={gastarioButtonClass("secondary")}
                >
                  Alle Aufträge
                </Link>
              }
            >

              {todayOrdersSorted.length === 0 ? (

                <GastarioStack compact>

                  <GastarioEmptyState title="Heute keine Lieferungen">
                    Für heute ist kein Auftrag mit Lieferdatum geplant.
                  </GastarioEmptyState>

                  {nextPlannedOrder ? (

                    <GastarioDataList>

                      <GastarioDataRow
                        to={
                          "/auftrag-pruefung/" +
                          nextPlannedOrder.id
                        }
                      >

                        <div className="g-ui-data-row-main">

                          <strong className="g-ui-data-row-title">
                            Nächster Auftrag
                          </strong>

                          <span className="g-ui-data-row-description">
                            {nextPlannedOrder.customerName ||
                              "Kunde nicht erkannt"}
                          </span>

                        </div>

                        <div className="g-ui-data-row-meta">

                          <span>
                            {planningDateLabel(
                              nextPlannedOrder.deliveryDate
                            )}
                          </span>

                          <span>
                            {formatTime(
                              nextPlannedOrder.deliveryTimeText
                            )}
                            {" Uhr"}
                          </span>

                        </div>

                        <span
                          className="g-ui-data-row-chevron"
                          aria-hidden="true"
                        >
                          →
                        </span>

                      </GastarioDataRow>

                    </GastarioDataList>

                  ) : null}

                </GastarioStack>

              ) : (

                <GastarioDataList>

                  {todayOrdersSorted.map(
                    (order: any) => (

                      <GastarioDataRow
                        key={order.id}
                        to={
                          "/auftrag-pruefung/" +
                          order.id
                        }
                      >

                        <div className="g-ui-data-row-main">

                          <strong className="g-ui-data-row-title">
                            {order.customerName ||
                              "Kunde nicht erkannt"}
                          </strong>

                          <span className="g-ui-data-row-description">
                            {order.eventName ||
                              order.orderNumber}
                          </span>

                          <span className="g-ui-data-row-description">
                            {order.deliveryAddress ||
                              "Lieferadresse noch offen"}
                          </span>

                        </div>


                        <div className="g-ui-data-row-meta">

                          <span>
                            {formatTime(
                              order.deliveryTimeText
                            )}
                            {" Uhr"}
                          </span>

                          <span>
                            {order.items.length}
                            {" Positionen"}
                          </span>

                          <span>
                            {String(order.status)
                              .replaceAll("_", " ")}
                          </span>

                        </div>


                        <span
                          className="g-ui-data-row-chevron"
                          aria-hidden="true"
                        >
                          →
                        </span>

                      </GastarioDataRow>
                    )
                  )}

                </GastarioDataList>

              )}

            </GastarioSection>

            <GastarioSection
              eyebrow="Planung"
              title="Lieferplan"
              description={
                filteredPlanningOrders.length === 1
                  ? "1 geplante Lieferung"
                  : `${filteredPlanningOrders.length} geplante Lieferungen`
              }
            >

              {filteredOrderGroups.length === 0 ? (

                <GastarioEmptyState title="Keine kommenden Lieferungen">
                  Aktuell sind keine zukünftigen Aufträge eingeplant.
                </GastarioEmptyState>

              ) : (

                <GastarioStack compact>

                  {filteredOrderGroups.map(
                    ([dateKey, orders]) => (

                      <GastarioSection
                        key={dateKey}
                        eyebrow="Lieferdatum"
                        title={planningDateLabel(
                          orders[0]?.deliveryDate
                        )}
                        description={
                          orders.length === 1
                            ? "1 Lieferung"
                            : `${orders.length} Lieferungen`
                        }
                      >

                        <GastarioDataList>

                          {orders.map(
                            (order: any) => (

                              <GastarioDataRow
                                key={order.id}
                                to={
                                  "/auftrag-pruefung/" +
                                  order.id
                                }
                              >

                                <div className="g-ui-data-row-main">

                                  <strong className="g-ui-data-row-title">
                                    {order.customerName ||
                                      "Kunde nicht erkannt"}
                                  </strong>

                                  <span className="g-ui-data-row-description">
                                    {order.eventName ||
                                      order.orderNumber}
                                  </span>

                                </div>


                                <div className="g-ui-data-row-meta">

                                  <span>
                                    {order.deliveryTimeText ||
                                      "Zeit offen"}
                                  </span>

                                  <span>
                                    {order.items.length}
                                    {" Positionen"}
                                  </span>

                                  <span>
                                    {String(order.status)
                                      .replaceAll("_", " ")}
                                  </span>

                                </div>


                                <span
                                  className="g-ui-data-row-chevron"
                                  aria-hidden="true"
                                >
                                  →
                                </span>

                              </GastarioDataRow>
                            )
                          )}

                        </GastarioDataList>

                      </GastarioSection>
                    )
                  )}

                </GastarioStack>

              )}

            </GastarioSection>
          </GastarioMain>

          <GastarioAside>
            {/* gastario-dashboard-compact-workbar-20260726 */}

            <GastarioSection
              eyebrow="Betriebssteuerung"
              title="Arbeitsbereich"
              description={`${openReviewCount +
                data.finance.ordersWithoutInvoice +
                data.taxAdvisor.missingInvoiceSettings +
                data.counts.lowInventory} offene Punkte`}
            >
              <GastarioTabs
                items={[
                  {
                    id: "tasks",
                    label: "Aufgaben",
                  },
                  {
                    id: "inventory",
                    label: "Lager",
                  },
                  {
                    id: "quick",
                    label: "Schnellzugriff",
                  },
                ]}
                activeId={dashboardSidePanel}
                onChange={(id) =>
                  setDashboardSidePanel(
                    id as "tasks" | "inventory" | "quick"
                  )
                }
              />

              {dashboardSidePanel === "tasks" ? (
                <GastarioDataList>

                  <GastarioDataRow to="/auftragseingang">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.review}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Auftragseingänge prüfen
                      </strong>
                      <span className="g-ui-data-row-description">
                        Neue Aufträge und E-Mails
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/auftraege">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.incomplete}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Unvollständige Aufträge
                      </strong>
                      <span className="g-ui-data-row-description">
                        Fehlende Auftragsangaben
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/auftragseingang">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.duplicates}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Mögliche Duplikate
                      </strong>
                      <span className="g-ui-data-row-description">
                        Doppelte Eingänge kontrollieren
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/produktion">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.production}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Produktion bearbeiten
                      </strong>
                      <span className="g-ui-data-row-description">
                        Aufträge in Produktion
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/packlisten">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.packing}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Packen offen
                      </strong>
                      <span className="g-ui-data-row-description">
                        Packlisten fertigstellen
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/auftraege">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.missingTime}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Lieferzeit fehlt
                      </strong>
                      <span className="g-ui-data-row-description">
                        Uhrzeiten ergänzen
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/auftraege">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.missingAddress}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Lieferadresse fehlt
                      </strong>
                      <span className="g-ui-data-row-description">
                        Lieferdaten vervollständigen
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/rechnungen">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.withoutInvoice}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Aufträge ohne Rechnung
                      </strong>
                      <span className="g-ui-data-row-description">
                        Abrechnung noch offen
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/einstellungen/rechnungen">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.missingInvoiceSettings}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Rechnungsstammdaten fehlen
                      </strong>
                      <span className="g-ui-data-row-description">
                        Einstellungen vervollständigen
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                  <GastarioDataRow to="/lager">
                    <div className="g-ui-data-row-meta">
                      <strong>{dashboardTaskCounts.inventory}</strong>
                    </div>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        Lagerwarnungen
                      </strong>
                      <span className="g-ui-data-row-description">
                        Mindestbestände kontrollieren
                      </span>
                    </div>
                    <span className="g-ui-data-row-chevron">→</span>
                  </GastarioDataRow>

                </GastarioDataList>
              ) : null}

              {dashboardSidePanel === "inventory" ? (
                <GastarioStack compact>

                  <GastarioNotice
                    type={
                      data.counts.lowInventory > 0
                        ? "warning"
                        : "success"
                    }
                  >
                    <strong>
                      {data.counts.lowInventory} Lagerwarnungen
                    </strong>
                    {" · "}
                    Artikel unter Mindestbestand
                  </GastarioNotice>

                  {safeLowInventoryItems.length === 0 ? (

                    <GastarioEmptyState title="Keine Lagerwarnung">
                      Alle Bestände liegen über dem Mindestbestand.
                    </GastarioEmptyState>

                  ) : (

                    <GastarioDataList>

                      {safeLowInventoryItems.map(
                        (item: any) => (

                          <GastarioDataRow
                            key={item.id}
                            to="/lager"
                          >

                            <div className="g-ui-data-row-main">

                              <strong className="g-ui-data-row-title">
                                {item.name}
                              </strong>

                              <span className="g-ui-data-row-description">
                                {item.currentStock}
                                {" / Mindest "}
                                {item.minStock}
                                {" "}
                                {item.unit}
                              </span>

                            </div>

                            <span
                              className="g-ui-data-row-chevron"
                              aria-hidden="true"
                            >
                              →
                            </span>

                          </GastarioDataRow>
                        )
                      )}

                    </GastarioDataList>

                  )}

                  <Link
                    to="/lager"
                    className={gastarioButtonClass("secondary")}
                  >
                    Lager öffnen
                  </Link>

                </GastarioStack>
              ) : null}

              {dashboardSidePanel === "quick" ? (
                <GastarioActionGrid columns={2}>

                  <GastarioActionCard
                    title="Produktion"
                    description="Produktionsplanung öffnen"
                    to="/produktion"
                    tone="sage"
                  />

                  <GastarioActionCard
                    title="Packlisten"
                    description="Kommissionierung vorbereiten"
                    to="/packlisten"
                    tone="sand"
                  />

                  <GastarioActionCard
                    title="Lieferungen"
                    description="Fahrer und Touren verwalten"
                    to="/lieferungen"
                    tone="blue"
                  />

                  <GastarioActionCard
                    title="Neuer Auftrag"
                    description="Auftrag manuell anlegen"
                    to="/auftragseingang"
                    tone="neutral"
                  />

                  <GastarioActionCard
                    title="Rechnungen"
                    description="Abrechnung bearbeiten"
                    to="/rechnungen"
                    tone="neutral"
                  />

                </GastarioActionGrid>
              ) : null}
            </GastarioSection>
          </GastarioAside>
        </GastarioSplitView>

        <GastarioSection
          eyebrow="Finanzen"
          title="Abrechnungsstand"
          description="Aktueller Überblick über Umsatz und offene Abrechnung."
          action={
            <Link
              to="/rechnungen"
              className={gastarioButtonClass("secondary")}
            >
              Finanzen öffnen
            </Link>
          }
        >

          <GastarioMetricGrid>

            <Link
              to="/rechnungen"
              className="g-ui-metric-link"
            >
              <GastarioMetric
                label="Monatsumsatz"
                value={centsToEuro(
                  data.finance.currentMonthGrossCents
                )}
                description="Aktueller Monat"
              />
            </Link>

            <Link
              to="/rechnungen"
              className="g-ui-metric-link"
            >
              <GastarioMetric
                label="Offene Rechnungen"
                value={data.finance.openInvoiceCount}
                description="Noch nicht abgeschlossen"
              />
            </Link>

            <Link
              to="/auftraege"
              className="g-ui-metric-link"
            >
              <GastarioMetric
                label="Ohne Rechnung"
                value={data.finance.ordersWithoutInvoice}
                description="Aufträge ohne Abrechnung"
              />
            </Link>

            <Link
              to="/rechnungen"
              className="g-ui-metric-link"
            >
              <GastarioMetric
                label="Entwürfe"
                value={data.taxAdvisor.draftInvoices}
                description="Rechnungsentwürfe"
              />
            </Link>

          </GastarioMetricGrid>

        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}
