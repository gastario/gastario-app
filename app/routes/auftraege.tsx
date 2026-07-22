import { Form, Link, useActionData, useLoaderData } from "react-router";
import { useState } from "react";
import AppLayout from "../components/AppLayout";
import {
  PageHeader,
  PageShell,
} from "../components/ui/PageShell";
import DeliveryNoteButton from "../components/DeliveryNoteButton";
import auftraegeStyles from "../styles/auftraege.css?url";
import auftragseingangStyles from "../styles/auftragseingang.css?url";
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

export function links() {
  return [
    {
      rel: "stylesheet",
      href: auftraegeStyles,
    },
    {
      rel: "stylesheet",
      href: auftragseingangStyles,
    },
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

    return {
      success: "Abrechnungsart wurde gespeichert.",
    };
  }

  if (intent === "updateStatus") {
    const status = String(formData.get("status") || "AUTO_CREATED");

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: status as any,
      },
    });

    return { success: "Status wurde gespeichert." };
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

  /*
   * gastario-inline-order-details-20260714
   * Auftragsdetails bleiben direkt auf der Auftragsseite.
   */
  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);

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
      <div
        className={
          "ordersPage ordersReferencePage " +
          (data.view === "past"
            ? "ordersPagePast"
            : "ordersPageUpcoming")
        }
      >
      <header className="topbar g-ui-page-header">
        <div>
          <p className="eyebrow g-ui-eyebrow">Verkauf</p>
          <h1 className="g-ui-page-title">Aufträge</h1>
          <span className="pageSubline g-ui-page-subtitle">
            {data.tenant?.name || "Kein Mandant"} · {data.view === "past"
              ? "abgeschlossene und vergangene Catering-Aufträge."
              : "kommende Lieferungen, Produktion und Packstatus auf einen Blick."}
          </span>
        </div>

        <div className="topActions">
          <Link className="secondaryButton g-ui-button g-ui-button--secondary" to="/auftragseingang">Eingangszentrale</Link>
          <Link className="primaryButton g-ui-button g-ui-button--primary" to="/neuer-auftrag">+ Neuer Auftrag</Link>
        </div>
      </header>

      {data.setupError ? (
        <div style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {data.setupError}
        </div>
      ) : null}

      {actionData?.success ? (
        <div style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          color: "#065f46",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.success}
        </div>
      ) : null}

      {actionData?.error ? (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.error}
        </div>
      ) : null}

      <section className="orderSummaryGrid g-ui-metrics">
        <article className="metricCard g-ui-card g-ui-card--flat">
          <div>
            <p>
              {data.view === "past"
                ? "Vergangene Aufträge"
                : "Aufträge gesamt"}
            </p>

            <strong>{data.counts.all}</strong>

            <span>
              {data.view === "past"
                ? "bereits vergangene Lieferungen"
                : data.counts.confirmed + " bestätigt"}
            </span>
          </div>

          <small data-trend="aktiv">
            {data.view === "past" ? "Archiv" : "echt"}
          </small>
        </article>

        <article className="metricCard g-ui-card g-ui-card--flat">
          <div>
            <p>
              {data.view === "past"
                ? "Archivierte Aufträge"
                : "Bestätigt"}
            </p>

            <strong>
              {data.view === "past"
                ? data.orders.length
                : data.counts.confirmed}
            </strong>

            <span>
              {data.view === "past"
                ? "aktuell in dieser Archivansicht"
                : "für die Ausführung vorgesehen"}
            </span>
          </div>

          <small data-trend="aktiv">
            {data.view === "past" ? "Historie" : "aktiv"}
          </small>
        </article>

        <article className="metricCard g-ui-card g-ui-card--flat">
          <div>
            <p>
              {data.view === "past"
                ? "Lieferungen im Archiv"
                : "Operative Aufträge"}
            </p>

            <strong>{data.orders.length}</strong>

            <span>
              {data.view === "past"
                ? "vergangene Lieferungen sichtbar"
                : "aktuell in dieser Ansicht"}
            </span>
          </div>

          <small data-trend="bereit">
            {data.view === "past" ? "Archiv" : "live"}
          </small>
        </article>

        <article className="metricCard g-ui-card g-ui-card--flat">
          <div>
            <p>Auftragswert</p>

            <strong>
              {centsToEuro(data.counts.totalValueCents)}
            </strong>

            <span>
              {data.view === "past"
                ? "Wert der vergangenen Lieferungen"
                : "Summe aller Positionen"}
            </span>
          </div>

          <small data-trend="bereit">EUR</small>
        </article>
      </section>

      <section className="panel g-ui-card">
        <div className="ordersWorkspaceHeader">
          <div>
            <p className="eyebrow g-ui-eyebrow">Auftragsübersicht</p>
            <h2>
              {data.view === "past"
                ? "Vergangene Aufträge"
                : "Bevorstehende Aufträge"}
            </h2>
            <span>
              {data.view === "past"
                ? "Abgeschlossene und vergangene Catering-Aufträge."
                : "Kommende Lieferungen, Produktion und Packstatus verwalten."}
            </span>
          </div>

          <div className="ordersWorkspaceCount">
            <strong>{data.orders.length}</strong>
            <small>
              {data.orders.length === 1 ? "von 1 Auftrag" : `von ${data.orders.length} Aufträgen`}
            </small>
          </div>
        </div>

        <div className="ordersWorkspaceFilters">
          <Form method="get" className="ordersFilterForm">
            {data.view === "past" ? (
              <input type="hidden" name="view" value="past" />
            ) : null}

            {data.activeStatus ? (
              <input type="hidden" name="status" value={data.activeStatus} />
            ) : null}

            <label className="ordersSearchField">
              <span>Suche</span>
              <input
                type="search"
                name="q"
                defaultValue={data.searchQuery || ""}
                placeholder="Kunde, Nummer oder Adresse"
              />
            </label>

            {data.view !== "past" ? (
              <label className="ordersFilterField">
                <span>Lieferzeitraum</span>

                <select
                  name="dateRange"
                  defaultValue={data.dateRange || ""}
                >
                  <option value="">Alle Lieferungen</option>
                  <option value="today">Heute</option>
                  <option value="tomorrow">Morgen</option>
                  <option value="week">Nächste 7 Tage</option>
                </select>
              </label>
            ) : (
              <div className="pastOrdersFilterInformation">
                <span>Zeitraum</span>
                <strong>
                  Alle vergangenen Lieferungen
                </strong>
              </div>
            )}

            <button
              className="productsPrimaryButton g-ui-button g-ui-button--primary"
              type="submit"
            >
              Anzeigen
            </button>

            <Link
              className="productsSecondaryButton g-ui-button g-ui-button--secondary"
              to={data.view === "past" ? "/auftraege?view=past" : "/auftraege"}
            >
              Zurücksetzen
            </Link>
          </Form>

          {data.view !== "past" ? (
            <nav
              className="ordersStatusTabs"
              aria-label="Auftragsstatus"
            >
              {STATUSES.map((status) => {
                const params = new URLSearchParams();

                if (status.value) {
                  params.set("status", status.value);
                }

                if (data.searchQuery) {
                  params.set("q", data.searchQuery);
                }

                if (data.dateRange) {
                  params.set(
                    "dateRange",
                    data.dateRange
                  );
                }

                const href = params.toString()
                  ? "/auftraege?" + params.toString()
                  : "/auftraege";

                return (
                  <Link
                    key={status.value || "all"}
                    className={
                      data.activeStatus === status.value
                        ? "ordersStatusTab active"
                        : "ordersStatusTab"
                    }
                    to={href}
                  >
                    {status.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <div className="pastOrdersArchiveNotice">
              <div>
                <strong>Auftragsarchiv</strong>

                <span>
                  Bereits vergangene Lieferungen werden
                  unabhängig vom Produktions- oder
                  Packstatus angezeigt.
                </span>
              </div>

              <span className="pastOrdersArchiveBadge">
                {data.orders.length} archiviert
              </span>
            </div>
          )}
        </div>

        {selectedOrder ? (
          <div className="finalOrdersGrid selectedFocusMode">
            <aside
              className="finalSelectedPanel g-ui-card"
              key={selectedOrder.id}
            >
              <div className="finalSelectedTop">
                <div>
                  <div className="finalSelectedKicker">
                    Ausgewählt
                  </div>

                  <div className="finalOrderNumber">
                    {selectedOrder.orderNumber}
                  </div>

                  <h3>
                    {selectedOrder.customerName ||
                      selectedOrder.customer?.name ||
                      "Kunde unbekannt"}
                  </h3>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#71817a",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {selectedOrder.contactName ||
                      "Keine Kontaktperson eingetragen"}
                  </p>
                </div>

                <span className="finalSourceBadge big g-ui-pill">
                  {String(
                    selectedOrder.platformName ||
                      selectedOrder.source ||
                      "Direkt"
                  )}
                </span>
              </div>

              <div className="finalSelectedFacts g-ui-fact-grid">
                <div>
                  <span>Lieferung</span>

                  <strong>
                    {formatDate(
                      selectedOrder.deliveryDate
                    )}
                  </strong>

                  <small>
                    {selectedOrder.deliveryTimeText ||
                      "Uhrzeit offen"}
                  </small>
                </div>

                <div>
                  <span>Lieferadresse</span>

                  <strong>
                    {selectedOrder.customerName ||
                      selectedOrder.customer?.name ||
                      "Kunde unbekannt"}
                  </strong>

                  <small>
                    {selectedOrder.deliveryAddress ||
                      "Keine Lieferadresse eingetragen"}
                  </small>

                  {selectedOrder.contactPhone ? (
                    <small
                      style={{
                        marginTop: 6,
                        color: "#087158",
                      }}
                    >
                      Telefon:{" "}
                      {selectedOrder.contactPhone}
                    </small>
                  ) : null}
                </div>

                <div>
                  <span>Gesamt</span>

                  <strong>
                    {centsToEuro(selectedOrderTotal)}
                  </strong>

                  <small>
                    {data.view === "past"
                      ? "Vergangener Auftrag"
                      : "Bestätigter Auftrag"}
                  </small>
                </div>
              </div>

              <div className="finalSelectedItems g-ui-card g-ui-card--flat">
                <h4>Positionen</h4>

                {selectedOrderItems
                  .slice(0, 8)
                  .map((item: any) => (
                    <div
                      className="finalSelectedItem"
                      key={item.id || item.name}
                    >
                      <span>
                        <strong>
                          {item.quantity || 1}x
                        </strong>

                        {item.name || "Position"}
                      </span>

                      <b>
                        {centsToEuro(
                          Number(
                            item.totalCents ||
                              item.totalPriceCents ||
                              0
                          )
                        )}
                      </b>
                    </div>
                  ))}

                {selectedOrderItems.length > 8 ? (
                  <div className="finalSelectedMore">
                    +{" "}
                    {selectedOrderItems.length - 8}{" "}
                    weitere Positionen
                  </div>
                ) : null}
              </div>

              <section className="orderBillingPanel g-ui-card g-ui-card--flat g-ui-card--soft">
                <div className="orderBillingHeader">
                  <div>
                    <p className="eyebrow g-ui-eyebrow">Abrechnung</p>
                    <h4>Wie soll dieser Auftrag abgerechnet werden?</h4>
                    <span>
                      Gastario erstellt nur dann eine Rechnung, wenn du
                      ausdrücklich „Eigene Gastario-Rechnung“ auswählst.
                    </span>
                  </div>

                  <div className="orderBillingStatus">
                    {selectedOrder.billingStatus === "READY_TO_INVOICE"
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
                  </div>
                </div>

                <Form method="post" className="orderBillingForm">
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

                  <label>
                    <span>Abrechnungsart</span>
                    <select
                      name="billingMode"
                      defaultValue={
                        selectedOrder.billingMode || "UNDECIDED"
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
                    </select>
                  </label>

                  <button type="submit">
                    Abrechnungsart speichern
                  </button>
                </Form>

                {selectedOrder.billingMode === "DIRECT_INVOICE" ? (
                  <div className="orderBillingInvoiceAction">
                    {Array.isArray(selectedOrder.invoices) &&
                    selectedOrder.invoices.length > 0 ? (
                      <>
                        <div>
                          <strong>Rechnung bereits vorhanden</strong>
                          <span>
                            {selectedOrder.invoices[0]
                              .externalInvoiceNumber ||
                              "Rechnungsentwurf ohne Nummer"}
                          </span>
                        </div>

                        <Link
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
                        <div>
                          <strong>Rechnungsentwurf vorbereiten</strong>
                          <span>
                            Kunde, Auftragsdatum und Positionen werden
                            im nächsten Schritt in den Rechnungseditor
                            übernommen. Es wird noch keine endgültige
                            Rechnung erzeugt.
                          </span>
                        </div>

                        <Link
                          to={
                            "/rechnungen/neu?orderId=" +
                            selectedOrder.id
                          }
                        >
                          Rechnungsentwurf vorbereiten
                        </Link>
                      </>
                    )}
                  </div>
                ) : null}

                {selectedOrder.billingMode === "PLATFORM_CREDIT" ? (
                  <div className="orderBillingInformation">
                    <strong>Plattformgutschrift</strong>
                    <span>
                      Für diesen Auftrag erzeugt Gastario keine eigene
                      Rechnung. Die Abrechnung erfolgt über die
                      Plattformgutschrift.
                    </span>
                  </div>
                ) : null}

                {selectedOrder.billingMode === "EXTERNAL_INVOICE" ? (
                  <div className="orderBillingInformation">
                    <strong>Extern abgerechnet</strong>
                    <span>
                      Der Auftrag wird in einem anderen System
                      fakturiert. Gastario erzeugt dafür keine Rechnung.
                    </span>
                  </div>
                ) : null}

                {selectedOrder.billingMode === "NO_INVOICE" ? (
                  <div className="orderBillingInformation">
                    <strong>Keine Rechnung erforderlich</strong>
                    <span>
                      Dieser Auftrag wird nicht in die offene
                      Rechnungsbearbeitung aufgenommen.
                    </span>
                  </div>
                ) : null}
              </section>

              <div className="finalSelectedActions">
                <div className="finalSelectedActionsMain">
                  <button
                    type="button"
                    className="finalBackButton g-ui-button g-ui-button--secondary"
                    onClick={() =>
                      setSelectedOrderId(null)
                    }
                  >
                    Zurück zur Liste
                  </button>

                  <DeliveryNoteButton
                    orderId={selectedOrder.id}
                  />

                  <Link
                    className="finalFoodlabelsButton"
                    to={
                      "/auftraege/" +
                      selectedOrder.id +
                      "/foodlabels"
                    }
                  >
                    Foodlabels erstellen
                  </Link>
                </div>

                <Form
                  method="post"
                  className="finalSelectedDeleteForm"
                >
                  <input
                    type="hidden"
                    name="intent"
                    value="deleteOrder"
                  />

                  <input
                    type="hidden"
                    name="orderId"
                    value={selectedOrder.id}
                  />

                  <button
                    type="submit"
                    className="finalSelectedDeleteButton"
                  >
                    Auftrag löschen
                  </button>
                </Form>
              </div>
            </aside>
          </div>
        ) : (
          <div className="finalOrderRows operationalOrderRows">
          {data.orders.length === 0 ? (
            <div className="ordersCardEmpty">
              <strong>Keine Aufträge vorhanden.</strong>

              <span>
                {data.activeStatus
                  ? "Für diesen Filter wurden keine Aufträge gefunden."
                  : data.view === "past"
                    ? "Es sind noch keine vergangenen Aufträge vorhanden."
                    : "Es stehen aktuell keine Lieferungen bevor."}
              </span>
            </div>
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

              const previewItems = visibleItems.slice(0, 3);

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

              return (
                <article
                  className={
                    "finalOrderRow operationalOrderRow " +
                    (data.view === "past"
                      ? "operationalOrderRowPast"
                      : "operationalOrderRowUpcoming")
                  }
                  key={order.id}
                  /* gastario-clickable-order-card-20260714 */
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedOrderId(order.id)
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      setSelectedOrderId(order.id);
                    }
                  }}
                >
                  <div className="finalOrderIcon">
                    <span aria-hidden="true">✉</span>
                  </div>

                  <div className="finalOrderCustomer">
                    <div className="finalOrderNumber">
                      {order.orderNumber}
                    </div>

                    <h3>
                      {order.customerName ||
                        order.customer?.name ||
                        "Kunde unbekannt"}
                    </h3>

                    <p>
                      {order.contactName ||
                        order.customer?.email ||
                        order.customerEmail ||
                        "Keine Kontaktperson erkannt"}
                    </p>

                    <span className="finalSourceBadge">
                      {String(order.source || "Direkt")}
                    </span>
                  </div>

                  <div className="finalOrderItems">
                    {previewItems.map(
                      (item: any, index: number) => (
                        <div
                          key={
                            item.id ||
                            item.name + "-" + index
                          }
                        >
                          <strong>
                            {Number(item.quantity || 1)}x
                          </strong>

                          <span>
                            {item.name || "Position"}
                          </span>
                        </div>
                      )
                    )}

                    {visibleItems.length >
                    previewItems.length ? (
                      <small>
                        +{" "}
                        {visibleItems.length -
                          previewItems.length}{" "}
                        weitere Position
                        {visibleItems.length -
                          previewItems.length ===
                        1
                          ? ""
                          : "en"}
                      </small>
                    ) : null}
                  </div>

                  <div className="finalOrderDate operationalOrderDate">
                    <strong>
                      {formatDate(order.deliveryDate)}
                    </strong>

                    <span>
                      {order.deliveryTimeText ||
                        "Uhrzeit offen"}
                    </span>

                    {order.deliveryAddress ? (
                      <small>
                        {order.deliveryAddress}
                      </small>
                    ) : null}
                  </div>

                  <div className="operationalOrderStatus">
                    <span
                      className={
                        "orderStatus " +
                        statusClass(order.status)
                      }
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <div className="finalOrderTotal">
                    <strong>{centsToEuro(total)}</strong>

                    <span>
                      {data.view === "past"
                        ? "Auftragswert"
                        : "Gesamt"}
                    </span>
                  </div>

                  <div
                    className="finalOrderActions operationalOrderActions"
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

                      <button
                        className="operationalDeleteButton"
                        type="submit"
                        aria-label="Auftrag löschen"
                        title="Auftrag löschen"
                      >
                        ×
                      </button>
                    </Form>
                  </div>
                </article>
              );
            })
          )}
        </div>

        )}
      </section>
      </div>
</AppLayout>
  );
}

const selectStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "9px 11px",
  fontWeight: 850,
  background: "white",
};



