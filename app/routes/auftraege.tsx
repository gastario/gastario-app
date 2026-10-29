import { Form, Link, redirect, useActionData, useLoaderData, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import NewOrderDialog from "../components/orders/NewOrderDialog";
import {
  GastarioPage,
  GastarioEmptyState,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioNotice,
  gastarioButtonClass,
  GastarioBadge,
  GastarioButton,
  GastarioField,
  GastarioFilterBar,
  GastarioInput,
  GastarioPanel,
  GastarioSection,
  GastarioSelect,
  GastarioDataList,
  GastarioDataRow,
  GastarioDetailDialog,
  GastarioDetailTabs,
  GastarioDetailPane,
  GastarioToolbar,
  GastarioTabs,
  GastarioStack,
} from "../components/ui";
import DeliveryNoteButton from "../components/DeliveryNoteButton";
import deliveryNoteDocumentStyles from "../styles/delivery-note-document.css?url";

const STATUSES = [
  { value: "", label: "Alle" },
  { value: "CONFIRMED", label: "Bestätigt" },
  { value: "IN_PRODUCTION", label: "In Produktion" },
  { value: "PACKING_OPEN", label: "Packen" },
];

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}


function formatDateInput(
  value: string | Date | null | undefined
) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function getOrderDeliveryDateTime(order: any) {
  if (!order?.deliveryDate) return null;

  const result = new Date(order.deliveryDate);

  if (Number.isNaN(result.getTime())) {
    return null;
  }

  const timeMatch = String(order.deliveryTimeText || "").match(
    /(\d{1,2})\s*[:.]\s*(\d{2})/
  );

  if (timeMatch) {
    result.setHours(
      Math.min(23, Number(timeMatch[1])),
      Math.min(59, Number(timeMatch[2])),
      0,
      0
    );
  } else {
    result.setHours(23, 59, 59, 999);
  }

  return result;
}

function startOfLocalDay(value = new Date()) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addLocalDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function statusLabel(status: string) {
  if (status === "CONFIRMED") return "Bestätigt";
  if (status === "IN_PRODUCTION") return "In Produktion";
  if (status === "PACKING_OPEN") return "Packen";
  if (status === "DELIVERED") return "Ausgeliefert";
  if (status === "REJECTED") return "Abgelehnt";
  return status;
}

function statusClass(status: string) {
  if (status === "CONFIRMED") return "success";
  if (status === "IN_PRODUCTION") return "production";
  if (status === "PACKING_OPEN") return "packing";
  if (status === "REJECTED") return "danger";
  return "neutral";
}
function isOperationalAssignmentComplete(
  item: any
) {
  const area = String(
    item?.operationalArea || ""
  ).toUpperCase();

  if (
    !area ||
    area === "REVIEW"
  ) {
    return false;
  }

  if (
    area ===
    "NON_OPERATIONAL"
  ) {
    return true;
  }

  if (
    !String(
      item?.productId || ""
    ).trim()
  ) {
    return false;
  }

  const quantity = Number(
    item?.operationalQuantity
  );

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return false;
  }

  if (
    !String(
      item?.operationalUnit || ""
    ).trim()
  ) {
    return false;
  }

  return true;
}

export function links() {
  return [
    {
      rel: "stylesheet",
      href: deliveryNoteDocumentStyles,
    },
  ];
}

export function meta() {
  return [{ title: "Aufträge · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);
  const url = new URL(request.url);

  const activeStatus = url.searchParams.get("status") || "";
  const view =
    url.searchParams.get("view") === "past"
      ? "past"
      : "upcoming";

  const searchQuery =
    url.searchParams.get("q")?.trim() || "";

  const dateRange =
    url.searchParams.get("dateRange") || "";

  if (!access.tenantId || !access.tenant) {
    return {
      tenant: null,
      setupError:
        access.setupError || "Kein Mandant gefunden.",
      activeStatus,
      view,
      searchQuery,
      dateRange,
      orders: [],
      counts: {
        all: 0,
        review: 0,
        confirmed: 0,
        rejected: 0,
        totalValueCents: 0,
      },
    };
  }

  try {
    const operationalStatuses = [
      "CONFIRMED",
      "IN_PRODUCTION",
      "PACKING_OPEN",
      "DELIVERED",
    ];

    const requestedStatuses = activeStatus
      ? [activeStatus]
      : operationalStatuses;

    const loadedOrders = await prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
        status: {
          in: requestedStatuses as any,
        },
      },
      include: {
        items: true,
        customer: true,
        invoices: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: [
        { deliveryDate: "asc" },
        { deliveryTimeText: "asc" },
        { createdAt: "desc" },
      ],
      take: 1000,
    });

    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const tomorrowStart = addLocalDays(todayStart, 1);
    const dayAfterTomorrowStart = addLocalDays(todayStart, 2);
    const weekEnd = addLocalDays(todayStart, 7);

    const orders = loadedOrders.filter((order: any) => {
      const deliveryDateTime =
        getOrderDeliveryDateTime(order);

      const status =
        String(order.status || "").toUpperCase();

      const isPast =
        status === "DELIVERED" ||
        Boolean(
          deliveryDateTime &&
          deliveryDateTime.getTime() < now.getTime()
        );

      if (view === "past" && !isPast) {
        return false;
      }

      if (view === "upcoming" && isPast) {
        return false;
      }

      if (searchQuery) {
        const haystack = [
          order.orderNumber,
          order.externalOrderNumber,
          order.customerName,
          order.customer?.email,
          order.deliveryAddress,
          order.eventName,
          order.contactName,
          order.platformName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("de-DE");

        if (
          !haystack.includes(
            searchQuery.toLocaleLowerCase("de-DE")
          )
        ) {
          return false;
        }
      }

      if (dateRange) {
        if (!deliveryDateTime) {
          return false;
        }

        const timestamp = deliveryDateTime.getTime();

        /* gastario-past-date-range-filter-20260722 */
        if (view === "past") {
          const pastRangeStart =
            dateRange === "past7"
              ? addLocalDays(todayStart, -7)
              : dateRange === "past30"
                ? addLocalDays(todayStart, -30)
                : dateRange === "currentMonth"
                  ? new Date(
                      todayStart.getFullYear(),
                      todayStart.getMonth(),
                      1
                    )
                  : dateRange === "currentYear"
                    ? new Date(
                        todayStart.getFullYear(),
                        0,
                        1
                      )
                    : null;

          if (
            pastRangeStart &&
            timestamp < pastRangeStart.getTime()
          ) {
            return false;
          }
        }

        if (
          dateRange === "today" &&
          !(
            timestamp >= todayStart.getTime() &&
            timestamp < tomorrowStart.getTime()
          )
        ) {
          return false;
        }

        if (
          dateRange === "tomorrow" &&
          !(
            timestamp >= tomorrowStart.getTime() &&
            timestamp < dayAfterTomorrowStart.getTime()
          )
        ) {
          return false;
        }

        if (
          dateRange === "week" &&
          !(
            timestamp >= todayStart.getTime() &&
            timestamp < weekEnd.getTime()
          )
        ) {
          return false;
        }
      }

      return true;
    });

    const allOperationalOrders =
      await prisma.order.findMany({
        where: {
          tenantId: access.tenantId,
          status: {
            in: operationalStatuses as any,
          },
        },
        include: {
          items: true,
        },
        take: 2000,
      });

    const ordersForCurrentView =
      allOperationalOrders.filter((order: any) => {
        const deliveryDateTime =
          getOrderDeliveryDateTime(order);

        const status =
          String(order.status || "").toUpperCase();

        const isPast =
          status === "DELIVERED" ||
          Boolean(
            deliveryDateTime &&
            deliveryDateTime.getTime() < now.getTime()
          );

        return view === "past" ? isPast : !isPast;
      });

    const totalValueCents =
      ordersForCurrentView.reduce(
        (sum: number, order: any) => {
          const itemTotal = order.items.reduce(
            (itemSum: number, item: any) =>
              itemSum +
              Number(
                item.totalCents ||
                  item.totalPriceCents ||
                  0
              ),
            0
          );

          return sum + Number(order.totalCents || itemTotal);
        },
        0
      );

    return {
      tenant: access.tenant,
      setupError: null,
      activeStatus,
      view,
      searchQuery,
      dateRange,
      orders,
      counts: {
        all: ordersForCurrentView.length,
        review: 0,
        confirmed: ordersForCurrentView.filter(
          (order: any) =>
            order.status === "CONFIRMED"
        ).length,
        rejected: 0,
        totalValueCents,
      },
    };
  } catch (error) {
    console.error("Aufträge loader failed:", error);

    return {
      tenant: access.tenant,
      setupError:
        "Aufträge konnten nicht geladen werden. Bitte Datenbank/Schema prüfen.",
      activeStatus,
      view,
      searchQuery,
      dateRange,
      orders: [],
      counts: {
        all: 0,
        review: 0,
        confirmed: 0,
        rejected: 0,
        totalValueCents: 0,
      },
    };
  }
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId) {
    return { error: access.setupError || "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const orderId = String(formData.get("orderId") || "");

  if (!orderId) {
    return { error: "Auftrag fehlt." };
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      tenantId: access.tenantId,
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    return { error: "Auftrag nicht gefunden." };
  }

  if (intent === "updateBillingMode") {
    const requestedMode = String(
      formData.get("billingMode") || "UNDECIDED"
    );

    const billingConfiguration: Record<
      string,
      {
        billingMode: string;
        billingStatus: string;
      }
    > = {
      UNDECIDED: {
        billingMode: "UNDECIDED",
        billingStatus: "NOT_BILLED",
      },
      DIRECT_INVOICE: {
        billingMode: "DIRECT_INVOICE",
        billingStatus: "READY_TO_INVOICE",
      },
      EXTERNAL_INVOICE: {
        billingMode: "EXTERNAL_INVOICE",
        billingStatus: "INVOICED_EXTERNALLY",
      },
      PLATFORM_CREDIT: {
        billingMode: "PLATFORM_CREDIT",
        billingStatus: "WAITING_FOR_CREDIT",
      },
      NO_INVOICE: {
        billingMode: "NO_INVOICE",
        billingStatus: "NOT_RELEVANT",
      },
    };

    const configuration =
      billingConfiguration[requestedMode] ||
      billingConfiguration.UNDECIDED;

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        billingMode: configuration.billingMode as any,
        billingStatus: configuration.billingStatus as any,
      },
    });
    if (configuration.billingMode === "DIRECT_INVOICE") {
      return redirect(
        "/rechnungen/neu?orderId=" +
          encodeURIComponent(order.id)
      );
    }

    return {
      success: "Abrechnungsart wurde gespeichert.",
    };
  }

  if (intent === "updateStatus") {
    const status = String(
      formData.get("status") || "AUTO_CREATED"
    );
    if (
      status === "IN_PRODUCTION"
    ) {
      const incompleteItems =
        Array.isArray(order.items)
          ? order.items.filter(
              (item: any) =>
                !isOperationalAssignmentComplete(
                  item
                )
            )
          : [];

      if (
        incompleteItems.length > 0
      ) {
        return {
          error:
            "Operative Zuordnung ist noch nicht vollständig. Bitte zuerst alle Positionen Produkt, Arbeitsbereich, Menge und Einheit zuordnen.",
        };
      }
    }

    const now = new Date();

    const workflowData: Record<
      string,
      any
    > = {};

    if (status === "IN_PRODUCTION") {
      workflowData.productionStartedAt =
        order.productionStartedAt || now;
    }

    if (status === "PACKING_OPEN") {
      workflowData.productionStartedAt =
        order.productionStartedAt || now;

      workflowData.productionCompletedAt =
        order.productionCompletedAt || now;

      workflowData.packingStartedAt =
        order.packingStartedAt || now;

      workflowData.packingCompletedAt = null;
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: status as any,
        ...workflowData,
      },
    });

    return {
      success: "Status wurde gespeichert.",
    };
  }

  if (intent === "deleteOrder") {
    await prisma.orderItem.deleteMany({
      where: {
        orderId: order.id,
        tenantId: access.tenantId,
      },
    });

    await prisma.order.delete({
      where: { id: order.id },
    });

    return { success: "Auftrag wurde geloescht." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function OrdersPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  /*
   * gastario-inline-order-details-20260714
   * Auftragsdetails bleiben direkt auf der Auftragsseite.
   */
  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);

  const [
    newOrderOpen,
    setNewOrderOpen,
  ] = useState(false);

  const [selectedOrderDetailTab, setSelectedOrderDetailTab] =
    useState("overview");

  useEffect(() => {
    setSelectedOrderDetailTab("overview");
  }, [selectedOrderId]);

  const selectedOrder =
    data.orders.find(
      (order: any) => order.id === selectedOrderId
    ) || null;

  const selectedOrderItems = selectedOrder
    ? (Array.isArray(selectedOrder.items)
        ? selectedOrder.items
        : []
      ).filter(
        (item: any) =>
          !String(item.name || "")
            .toLowerCase()
            .includes("fehlende position")
      )
    : [];
  const selectedOrderIncompleteOperationalItems =
    selectedOrderItems.filter(
      (item: any) =>
        !isOperationalAssignmentComplete(
          item
        )
    );

  const selectedOrderOperationalReady =
    selectedOrderItems.length > 0 &&
    selectedOrderIncompleteOperationalItems.length === 0;

  const selectedOrderOperationalMissingCount =
    selectedOrderIncompleteOperationalItems.length;

  const selectedOrderTotal = selectedOrder
    ? (Array.isArray(selectedOrder.items)
        ? selectedOrder.items
        : []
      ).reduce(
        (sum: number, item: any) =>
          sum +
          Number(
            item.totalCents ||
              item.totalPriceCents ||
              0
          ),
        0
      )
    : 0;

  return (
    <AppLayout>

      <GastarioPage>
      <GastarioHeader
        eyebrow="Verkauf"
        title="Aufträge"
        subtitle={
          <>
            {data.tenant?.name || "Kein Mandant"} ·{" "}
            {data.view === "past"
              ? "abgeschlossene und vergangene Catering-Aufträge."
              : "kommende Lieferungen, Produktion und Packstatus auf einen Blick."}
          </>
        }
        actions={
          <>
            <Link
              className={gastarioButtonClass("secondary")}
              to="/auftragseingang"
            >
              Eingangszentrale
            </Link>

            <GastarioButton
              type="button"
              variant="primary"
              onClick={() =>
                setNewOrderOpen(true)
              }
            >
              + Neuer Auftrag
            </GastarioButton>
          </>
        }
      />

      {data.setupError ? (
        <GastarioNotice type="danger">
          {data.setupError}
        </GastarioNotice>
      ) : null}

      {actionData?.success ? (
        <GastarioNotice type="success">
          {actionData.success}
        </GastarioNotice>
      ) : null}

      {actionData?.error ? (
        <GastarioNotice type="danger">
          {actionData.error}
        </GastarioNotice>
      ) : null}

      {data.view === "past" ? (

        <GastarioMetricGrid>

          <GastarioMetric
            label="Vergangene Aufträge"
            value={data.orders.length}
            description="Abgeschlossene und vergangene Lieferungen"
            badge="Archiv"
          />

          <GastarioMetric
            label="Auftragswert"
            value={centsToEuro(
              data.counts.totalValueCents
            )}
            description="Wert der vergangenen Lieferungen"
            badge="EUR"
          />

        </GastarioMetricGrid>

      ) : (

        <GastarioMetricGrid>

          <GastarioMetric
            label="Aufträge gesamt"
            value={data.counts.all}
            description={`${data.counts.confirmed} bestätigt`}
            badge="echt"
          />

          <GastarioMetric
            label="Bestätigt"
            value={data.counts.confirmed}
            description="für die Ausführung vorgesehen"
            badge="aktiv"
          />

          <GastarioMetric
            label="Operative Aufträge"
            value={data.orders.length}
            description="aktuell in dieser Ansicht"
            badge="live"
          />

          <GastarioMetric
            label="Auftragswert"
            value={centsToEuro(
              data.counts.totalValueCents
            )}
            description="Summe aller Positionen"
            badge="EUR"
          />

        </GastarioMetricGrid>

      )}

      <GastarioStack>
        <GastarioSection
          eyebrow="Auftragsübersicht"
          title={
            data.view === "past"
              ? "Vergangene Aufträge"
              : "Bevorstehende Aufträge"
          }
          description={
            data.view === "past"
              ? "Abgeschlossene und vergangene Catering-Aufträge."
              : "Kommende Lieferungen, Produktion und Packstatus verwalten."
          }
          action={
            <GastarioBadge variant="neutral">
              {data.orders.length === 1
                ? "1 Auftrag"
                : `${data.orders.length} Aufträge`}
            </GastarioBadge>
          }
        >

          <Form method="get">

            {data.view === "past" ? (
              <input
                type="hidden"
                name="view"
                value="past"
              />
            ) : null}

            {data.activeStatus ? (
              <input
                type="hidden"
                name="status"
                value={data.activeStatus}
              />
            ) : null}

            <GastarioFilterBar
              actions={
                <>
                  <GastarioButton
                    variant="primary"
                    type="submit"

                      disabled={
                        !selectedOrderOperationalReady
                      }
                      title={
                        selectedOrderOperationalReady
                          ? "Produktion starten"
                          : `${selectedOrderOperationalMissingCount} Position(en) müssen zuerst operativ zugeordnet werden.`
                      }
                    >
                    Anzeigen
                  </GastarioButton>

                  <Link
                    className={gastarioButtonClass(
                      "secondary"
                    )}
                    to={
                      data.view === "past"
                        ? "/auftraege?view=past"
                        : "/auftraege"
                    }
                  >
                    Zurücksetzen
                  </Link>
                </>
              }
            >

              <GastarioField label="Suche">
                <GastarioInput
                  type="search"
                  name="q"
                  defaultValue={
                    data.searchQuery || ""
                  }
                  placeholder="Kunde, Nummer oder Adresse"
                />
              </GastarioField>

              {data.view !== "past" ? (
                <GastarioField label="Lieferzeitraum">
                  <GastarioSelect
                    name="dateRange"
                    defaultValue={
                      data.dateRange || ""
                    }
                  >
                    <option value="">
                      Alle Lieferungen
                    </option>

                    <option value="today">
                      Heute
                    </option>

                    <option value="tomorrow">
                      Morgen
                    </option>

                    <option value="week">
                      Nächste 7 Tage
                    </option>
                  </GastarioSelect>
                </GastarioField>
              ) : (
                <GastarioField label="Zeitraum">
                  <GastarioSelect
                    name="dateRange"
                    defaultValue={
                      data.dateRange || ""
                    }
                  >
                    <option value="">
                      Alle vergangenen Lieferungen
                    </option>

                    <option value="past7">
                      Letzte 7 Tage
                    </option>

                    <option value="past30">
                      Letzte 30 Tage
                    </option>

                    <option value="currentMonth">
                      Dieser Monat
                    </option>

                    <option value="currentYear">
                      Dieses Jahr
                    </option>
                  </GastarioSelect>
                </GastarioField>
              )}

            </GastarioFilterBar>

          </Form>


          {data.view !== "past" ? (

            <GastarioTabs
              items={STATUSES.map((status) => ({
                id: status.value || "all",
                label: status.label,
              }))}
              activeId={data.activeStatus || "all"}
              onChange={(id) => {
                const params = new URLSearchParams();

                if (id !== "all") {
                  params.set("status", id);
                }

                if (data.searchQuery) {
                  params.set("q", data.searchQuery);
                }

                if (data.dateRange) {
                  params.set("dateRange", data.dateRange);
                }

                const query = params.toString();

                navigate(
                  query
                    ? `/auftraege?${query}`
                    : "/auftraege"
                );
              }}
            />

          ) : (

            <GastarioNotice type="neutral">
              Vergangene Lieferungen werden hier unabhängig vom
              Produktions- oder Packstatus angezeigt.
            </GastarioNotice>

          )}

          <GastarioDataList>

            {data.orders.length === 0 ? (

              <GastarioEmptyState title="Keine Aufträge vorhanden">
                {data.activeStatus
                  ? "Für diesen Filter wurden keine Aufträge gefunden."
                  : data.view === "past"
                    ? "Es sind noch keine vergangenen Aufträge vorhanden."
                    : "Es stehen aktuell keine Lieferungen bevor."}
              </GastarioEmptyState>

            ) : (

              data.orders.map((order: any) => {

                const items = Array.isArray(order.items)
                  ? order.items
                  : [];

                const visibleItems = items.filter(
                  (item: any) =>
                    !String(item.name || "")
                      .toLowerCase()
                      .includes("fehlende position")
                );

                const previewItems =
                  visibleItems.slice(0, 3);

                const total = items.reduce(
                  (sum: number, item: any) =>
                    sum +
                    Number(
                      item.totalCents ||
                      item.totalPriceCents ||
                      0
                    ),
                  0
                );

                const previewText =
                  previewItems
                    .map(
                      (item: any) =>
                        `${Number(item.quantity || 1)}x ${
                          item.name || "Position"
                        }`
                    )
                    .join(" · ");

                return (

                  <GastarioDataRow
                    key={order.id}
                    onClick={() =>
                      setSelectedOrderId(order.id)
                    }
                  >

                    <div className="g-ui-data-row-main">

                      <strong className="g-ui-data-row-title">
                        {order.customerName ||
                          order.customer?.name ||
                          "Kunde unbekannt"}
                      </strong>

                      <span className="g-ui-data-row-description">
                        {order.orderNumber}
                        {" · "}
                        {order.contactName ||
                          order.customer?.email ||
                          order.customerEmail ||
                          "Keine Kontaktperson erkannt"}
                      </span>

                      {previewText ? (
                        <span className="g-ui-data-row-description">
                          {previewText}

                          {visibleItems.length >
                          previewItems.length
                            ? ` · +${
                                visibleItems.length -
                                previewItems.length
                              } weitere`
                            : ""}
                        </span>
                      ) : null}

                    </div>


                    <div className="g-ui-data-row-meta">

                      <span>
                        {String(
                          order.source || "Direkt"
                        )}
                      </span>

                      <span>
                        {formatDate(
                          order.deliveryDate
                        )}
                      </span>

                      <span>
                        {order.deliveryTimeText ||
                          "Uhrzeit offen"}
                      </span>

                      <span>
                        {statusLabel(order.status)}
                      </span>

                      <span>
                        {centsToEuro(total)}
                      </span>

                    </div>


                    <div
                      className="g-ui-data-row-actions"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                      onKeyDown={(event) =>
                        event.stopPropagation()
                      }
                    >

                      <DeliveryNoteButton
                        orderId={order.id}
                        compact
                      />

                      <Form method="post">

                        <input
                          type="hidden"
                          name="intent"
                          value="deleteOrder"
                        />

                        <input
                          type="hidden"
                          name="orderId"
                          value={order.id}
                        />

                        <GastarioButton
                          variant="danger"
                          type="submit"
                        >
                          Löschen
                        </GastarioButton>

                      </Form>

                    </div>


                    <span
                      className="g-ui-data-row-chevron"
                      aria-hidden="true"
                    >
                      →
                    </span>

                  </GastarioDataRow>
                );
              })
            )}

          </GastarioDataList>

        </GastarioSection>


        <GastarioDetailDialog
          open={Boolean(selectedOrder)}
          title={
            selectedOrder
              ? (
                  selectedOrder.customerName ||
                  selectedOrder.customer?.name ||
                  "Kunde unbekannt"
                )
              : "Auftrag"
          }
          description={
            selectedOrder
              ? `${selectedOrder.orderNumber} · ${
                  selectedOrder.contactName ||
                  "Keine Kontaktperson"
                }`
              : undefined
          }
          onClose={() => {
            setSelectedOrderId(null);
            setSelectedOrderDetailTab(
              "overview"
            );
          }}
          footer={
            selectedOrder ? (
              <GastarioToolbar>
                <GastarioButton
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(null);
                    setSelectedOrderDetailTab(
                      "overview"
                    );
                  }}
                >
                  Schließen
                </GastarioButton>
              </GastarioToolbar>
            ) : null
          }
        >
          {selectedOrder ? (
            <GastarioStack key={selectedOrder.id}>

              <GastarioDetailTabs
                items={[
                  {
                    id: "overview",
                    label: "Übersicht",
                  },
                  {
                    id: "items",
                    label: "Positionen",
                  },
                  {
                    id: "billing",
                    label: "Abrechnung",
                  },
                ]}
                activeId={selectedOrderDetailTab}
                onChange={setSelectedOrderDetailTab}
              />


              <GastarioDetailPane
                active={
                  selectedOrderDetailTab ===
                  "overview"
                }
              >
                <GastarioSection
                  eyebrow="Auftragsübersicht"
                  title="Auftrag auf einen Blick"
                  description={
                    data.view === "past"
                      ? "Die wichtigsten Daten des vergangenen Auftrags."
                      : "Die wichtigsten Daten für die operative Bearbeitung."
                  }
                >
                  <GastarioToolbar>
                    <GastarioBadge variant="neutral">
                      {String(
                        selectedOrder.platformName ||
                        selectedOrder.source ||
                        "Direkt"
                      )}
                    </GastarioBadge>
                  </GastarioToolbar>

                  <GastarioMetricGrid>
                    <GastarioMetric
                      label="Lieferdatum"
                      value={formatDate(
                        selectedOrder.deliveryDate
                      )}
                      description={
                        data.view === "past"
                          ? "Vergangene Lieferung"
                          : "Geplanter Liefertag"
                      }
                    />

                    <GastarioMetric
                      label="Lieferuhrzeit"
                      value={
                        selectedOrder.deliveryTimeText ||
                        "Uhrzeit offen"
                      }
                      description="Anlieferung vor Ort"
                    />

                    <GastarioMetric
                      label="Gesamt"
                      value={centsToEuro(
                        selectedOrderTotal
                      )}
                      description={
                        data.view === "past"
                          ? "Vergangener Auftrag"
                          : "Aktueller Auftragswert"
                      }
                      badge="EUR"
                    />
                  </GastarioMetricGrid>

                  <GastarioPanel variant="soft">
                    <strong>Lieferadresse</strong>

                    <div>
                      {selectedOrder.deliveryAddress ||
                        "Keine Lieferadresse eingetragen"}
                    </div>

                    {selectedOrder.contactPhone ? (
                      <div>
                        Telefon:{" "}
                        {selectedOrder.contactPhone}
                      </div>
                    ) : null}
                  </GastarioPanel>
                </GastarioSection>


                <GastarioSection
                  eyebrow="Bearbeitung"
                  title="Auftrag weiterführen"
                  description="Operative Zuordnung, Produktion und Ausgabedokumente zentral steuern."
                >

                  {!selectedOrderOperationalReady ? (
                    <GastarioNotice type="warning">
                      <strong>
                        Vor Produktion noch zuzuordnen:
                      </strong>{" "}
                      {selectedOrderOperationalMissingCount} Position(en).
                      Vervollständige Produkt, Arbeitsbereich,
                      operative Menge und Einheit.
                    </GastarioNotice>
                  ) : (
                    <GastarioNotice type="success">
                      Die operative Zuordnung ist vollständig.
                    </GastarioNotice>
                  )}


                  <GastarioToolbar
                    align="start"
                  >

                    <Link
                      className={gastarioButtonClass(
                        "secondary"
                      )}
                      to={
                        `/auftrag-pruefung/${selectedOrder.id}`
                      }
                    >
                      Operative Zuordnung
                    </Link>


                    {String(
                      selectedOrder.status ||
                      ""
                    ) === "CONFIRMED" ? (

                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="updateStatus"
                        />

                        <input
                          type="hidden"
                          name="orderId"
                          value={
                            selectedOrder.id
                          }
                        />

                        <input
                          type="hidden"
                          name="status"
                          value="IN_PRODUCTION"
                        />

                        <GastarioButton
                          variant="primary"
                          type="submit"
                        >
                          In Produktion
                        </GastarioButton>
                      </Form>

                    ) : null}


                    {String(
                      selectedOrder.status ||
                      ""
                    ) === "IN_PRODUCTION" ? (

                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="updateStatus"
                        />

                        <input
                          type="hidden"
                          name="orderId"
                          value={
                            selectedOrder.id
                          }
                        />

                        <input
                          type="hidden"
                          name="status"
                          value="PACKING_OPEN"
                        />

                        <GastarioButton
                          variant="primary"
                          type="submit"
                        >
                          An Packstation
                        </GastarioButton>
                      </Form>

                    ) : null}


                    {String(
                      selectedOrder.status ||
                      ""
                    ) === "PACKING_OPEN" ? (

                      <Link
                        className={gastarioButtonClass(
                          "primary"
                        )}
                        to={
                          "/packlisten?date=" +
                          encodeURIComponent(
                            formatDateInput(
                              selectedOrder.deliveryDate
                            )
                          )
                        }
                      >
                        Packliste öffnen
                      </Link>

                    ) : null}


                    <DeliveryNoteButton
                      orderId={
                        selectedOrder.id
                      }
                    />


                    <Link
                      className={gastarioButtonClass(
                        "secondary"
                      )}
                      to={
                        "/auftraege/" +
                        selectedOrder.id +
                        "/foodlabels"
                      }
                    >
                      Foodlabels
                    </Link>

                  </GastarioToolbar>


                  <GastarioToolbar
                    align="start"
                  >

                    <Form
                      method="post"
                      onSubmit={(event) => {
                        if (
                          !window.confirm(
                            "Diesen Auftrag wirklich löschen?"
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >

                      <input
                        type="hidden"
                        name="intent"
                        value="deleteOrder"
                      />

                      <input
                        type="hidden"
                        name="orderId"
                        value={
                          selectedOrder.id
                        }
                      />

                      <GastarioButton
                        variant="danger"
                        type="submit"
                      >
                        Auftrag löschen
                      </GastarioButton>

                    </Form>

                  </GastarioToolbar>

                </GastarioSection>

              </GastarioDetailPane>


              <GastarioDetailPane
                active={
                  selectedOrderDetailTab ===
                  "items"
                }
              >
                <GastarioSection
                  eyebrow="Auftragsinhalt"
                  title="Positionen im Auftrag"
                  description={
                    selectedOrderItems.length === 1
                      ? "1 Position"
                      : `${selectedOrderItems.length} Positionen`
                  }
                >
                  {selectedOrderItems.length === 0 ? (
                    <GastarioEmptyState title="Keine Positionen">
                      Für diesen Auftrag sind keine Positionen hinterlegt.
                    </GastarioEmptyState>
                  ) : (
                    <GastarioDataList>
                      {selectedOrderItems.map(
                        (item: any) => (
                          <GastarioDataRow
                            key={
                              item.id ||
                              item.name
                            }
                          >
                            <div className="g-ui-data-row-main">
                              <strong className="g-ui-data-row-title">
                                {item.quantity || 1}x{" "}
                                {item.name || "Position"}
                              </strong>

                              {item.notes ||
                              item.itemNotes ? (
                                <span className="g-ui-data-row-description">
                                  {item.notes ||
                                    item.itemNotes}
                                </span>
                              ) : null}
                            </div>

                            <div className="g-ui-data-row-meta">
                              <strong>
                                {centsToEuro(
                                  Number(
                                    item.totalCents ||
                                    item.totalPriceCents ||
                                    0
                                  )
                                )}
                              </strong>
                            </div>
                          </GastarioDataRow>
                        )
                      )}
                    </GastarioDataList>
                  )}
                </GastarioSection>
              </GastarioDetailPane>


              <GastarioDetailPane
                active={
                  selectedOrderDetailTab ===
                  "billing"
                }
              >
                <GastarioSection
                  eyebrow="Finanzen"
                  title="Abrechnung"
                  description="Lege fest, wie dieser Auftrag fakturiert wird."
                >
                  <GastarioPanel variant="soft">
                    <GastarioStack>
                      <GastarioBadge variant="neutral">
                        {selectedOrder.billingStatus ===
                        "READY_TO_INVOICE"
                          ? "Rechnung vorbereiten"
                          : selectedOrder.billingStatus ===
                              "INVOICED_EXTERNALLY"
                            ? "Extern abgerechnet"
                            : selectedOrder.billingStatus ===
                                "WAITING_FOR_CREDIT"
                              ? "Gutschrift ausstehend"
                              : selectedOrder.billingStatus ===
                                  "CREDIT_RECEIVED"
                                ? "Gutschrift erhalten"
                                : selectedOrder.billingStatus ===
                                    "NOT_RELEVANT"
                                  ? "Nicht erforderlich"
                                  : selectedOrder.billingStatus ===
                                      "INVOICED"
                                    ? "Rechnung erstellt"
                                    : "Noch offen"}
                      </GastarioBadge>

                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="updateBillingMode"
                        />

                        <input
                          type="hidden"
                          name="orderId"
                          value={selectedOrder.id}
                        />

                        <GastarioField label="Abrechnungsart">
                          <GastarioSelect
                            name="billingMode"
                            defaultValue={
                              selectedOrder.billingMode ||
                              "UNDECIDED"
                            }
                          >
                            <option value="UNDECIDED">
                              Noch nicht entschieden
                            </option>

                            <option value="DIRECT_INVOICE">
                              Eigene Rechnung mit Gastario
                            </option>

                            <option value="EXTERNAL_INVOICE">
                              Über anderes System abgerechnet
                            </option>

                            <option value="PLATFORM_CREDIT">
                              Plattformgutschrift
                            </option>

                            <option value="NO_INVOICE">
                              Keine Rechnung erforderlich
                            </option>
                          </GastarioSelect>
                        </GastarioField>

                        <GastarioToolbar align="end">
                          <GastarioButton
                            variant="primary"
                            type="submit"
                          >
                            Abrechnungsart speichern
                          </GastarioButton>
                        </GastarioToolbar>
                      </Form>
                    </GastarioStack>
                  </GastarioPanel>

                  {selectedOrder.billingMode ===
                  "DIRECT_INVOICE" ? (
                    <GastarioPanel variant="soft">
                      <GastarioStack>
                        {Array.isArray(
                          selectedOrder.invoices
                        ) &&
                        selectedOrder.invoices.length > 0 ? (
                          <>
                            <strong>
                              Rechnung bereits vorhanden
                            </strong>

                            <div>
                              {selectedOrder.invoices[0]
                                .externalInvoiceNumber ||
                                "Rechnungsentwurf ohne Nummer"}
                            </div>

                            <Link
                              className={gastarioButtonClass(
                                "secondary"
                              )}
                              to={
                                "/rechnungen/" +
                                selectedOrder.invoices[0].id
                              }
                            >
                              Rechnung öffnen
                            </Link>
                          </>
                        ) : (
                          <>
                            <strong>
                              Rechnungsentwurf vorbereiten
                            </strong>

                            <div>
                              Kunde und Positionen werden in den
                              Rechnungseditor übernommen.
                            </div>

                            <Link
                              className={gastarioButtonClass(
                                "secondary"
                              )}
                              to={
                                "/rechnungen/neu?orderId=" +
                                selectedOrder.id
                              }
                            >
                              Rechnungsentwurf vorbereiten
                            </Link>
                          </>
                        )}
                      </GastarioStack>
                    </GastarioPanel>
                  ) : null}

                  {selectedOrder.billingMode ===
                  "PLATFORM_CREDIT" ? (
                    <GastarioPanel variant="soft">
                      <strong>Plattformgutschrift</strong>
                      <div>
                        Gastario erzeugt für diesen Auftrag keine eigene Rechnung.
                      </div>
                    </GastarioPanel>
                  ) : null}

                  {selectedOrder.billingMode ===
                  "EXTERNAL_INVOICE" ? (
                    <GastarioPanel variant="soft">
                      <strong>Extern abgerechnet</strong>
                      <div>
                        Der Auftrag wird in einem anderen System fakturiert.
                      </div>
                    </GastarioPanel>
                  ) : null}

                  {selectedOrder.billingMode ===
                  "NO_INVOICE" ? (
                    <GastarioPanel variant="soft">
                      <strong>Keine Rechnung erforderlich</strong>
                      <div>
                        Der Auftrag wird nicht in die offene Rechnungsbearbeitung aufgenommen.
                      </div>
                    </GastarioPanel>
                  ) : null}
                </GastarioSection>
              </GastarioDetailPane>

            </GastarioStack>
          ) : null}
        </GastarioDetailDialog>

      </GastarioStack>

      <NewOrderDialog
        open={newOrderOpen}
        onClose={() =>
          setNewOrderOpen(false)
        }
        formAction="/neuer-auftrag"
      />
</GastarioPage>
</AppLayout>
  );
}
