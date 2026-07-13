import { Form, Link, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

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

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Aufträge</h1>
          <span className="pageSubline">
            {data.tenant?.name || "Kein Mandant"} · übernommene und operative Aufträge. Neue PDF-Importe zuerst im Auftragseingang pruefen.
          </span>
        </div>

        <div className="topActions">
          <Link className="secondaryButton" to="/auftragseingang">Eingangszentrale</Link>
          <Link className="primaryButton" to="/neuer-auftrag">+ Neuer Auftrag</Link>
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

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Aufträge gesamt</p>
            <strong>{data.counts.all}</strong>
            <span>{data.counts.confirmed} bestätigt</span>
          </div>
          <small data-trend="aktiv">echt</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Bestätigt</p>
            <strong>{data.counts.confirmed}</strong>
            <span>für die Ausführung vorgesehen</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Operative Aufträge</p>
            <strong>{data.orders.length}</strong>
            <span>aktuell in dieser Ansicht</span>
          </div>
          <small data-trend="bereit">live</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Auftragswert</p>
            <strong>{centsToEuro(data.counts.totalValueCents)}</strong>
            <span>Summe aller Positionen</span>
          </div>
          <small data-trend="bereit">EUR</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Auftragsübersicht</p>
            <h2>
              {data.view === "past"
                ? "Vergangene Aufträge"
                : "Bevorstehende Aufträge"}
            </h2>
          </div>

          <div className="ordersFilterWrap">
            <Form method="get" className="ordersFilterForm">
              {data.view === "past" ? (
                <input
                  type="hidden"
                  name="view"
                  value="past"
                />
              ) : null}
              {data.activeStatus ? (
                <input type="hidden" name="status" value={data.activeStatus} />
              ) : null}

              <label className="filterLabel">
                Suche
                <input
                  type="search"
                  name="q"
                  defaultValue={data.searchQuery || ""}
                  placeholder="Kunde, Nummer, Adresse..."
                  className="filterInput"
                />
              </label>

              <label className="filterLabel">
                Lieferzeitraum
                <select
                  name="dateRange"
                  defaultValue={data.dateRange || ""}
                  className="filterInput"
                >
                  <option value="">Alle Lieferungen</option>
                  <option value="today">Heute</option>
                  <option value="tomorrow">Morgen</option>
                  <option value="week">Nächste 7 Tage</option>
                </select>
              </label>

              <button className="ghostButton primaryGhostButton" type="submit">
                Filtern
              </button>

              <Link
                className="ghostButton"
                to={
                  data.view === "past"
                    ? "/auftraege?view=past"
                    : "/auftraege"
                }
              >
                Zurücksetzen
              </Link>
            </Form>

            <div className="statusFilterGroup">
              {STATUSES.map((status) => {
                const params = new URLSearchParams();

                if (status.value) params.set("status", status.value);
                if (data.searchQuery) params.set("q", data.searchQuery);
                if (data.dateRange) params.set("dateRange", data.dateRange);

                const href = params.toString() ? "/auftraege?" + params.toString() : "/auftraege";

                return (
                  <Link
                    key={status.value || "all"}
                    className={"ghostButton " + (data.activeStatus === status.value ? "activeFilter" : "")}
                    to={href}
                  >
                    {status.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ordersTable">
          <div className="ordersHead">
            <span>Auftrag</span>
            <span>Kunde</span>
            <span>Lieferung</span>
            <span>Positionen</span>
            <span>Status</span>
            <span>Betrag</span>
            <span>Aktion</span>
          </div>

          {data.orders.length === 0 ? (
            <div className="ordersRow">
              <div>
                <strong>Keine Aufträge vorhanden.</strong>
                <small>{data.activeStatus ? "Filter aktiv" : "Noch leer"}</small>
              </div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <span className="orderStatus warning">Leer</span>
              <strong>{centsToEuro(0)}</strong>
              <span>-</span>
            </div>
          ) : (
            data.orders.map((order: any) => {
              const total = order.items.reduce((sum: number, item: any) => {
                return sum + (item.totalCents || item.totalPriceCents || 0);
              }, 0);

              return (
                <div className="ordersRow" key={order.id}>
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <small>{order.source}</small>
                  </div>

                  <div>
                    <strong>{order.customerName}</strong>
                    <small>{order.customerEmail || "-"}</small>
                  </div>

                  <div>
                    <strong>{formatDate(order.deliveryDate)}</strong>
                    <small>{order.deliveryTimeText || "-"}</small>
                  </div>

                  <div>
                    <strong>{order.items.length} Positionen</strong>
                    <small>
                      {order.items.slice(0, 2).map((item: any) => item.name).join(", ") || "-"}
                    </small>
                  </div>

                  <span className={`orderStatus ${statusClass(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>

                  <strong>{centsToEuro(total)}</strong>

                  <div className="orderActions">
                    <Link className="ghostButton primaryGhostButton" to={"/auftrag-pruefung/" + order.id}>
                      Öffnen
                    </Link>

                    <Link
                      className="ghostButton"
                      to={"/lieferscheine/" + order.id + "/pdf"}
                    >
                      Lieferschein PDF
                    </Link>

                    <Form method="post">
                      <input type="hidden" name="intent" value="deleteOrder" />
                      <input type="hidden" name="orderId" value={order.id} />
                      <button className="ghostButton deleteOrderButton" type="submit">
                        Löschen
                      </button>
                    </Form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <style>{`
        /* gastario-orders-final-clean-design-20260713 */

        .topbar {
          display: flex !important;
          align-items: flex-start !important;
          justify-content: space-between !important;
          gap: 30px !important;
          margin-bottom: 24px !important;
          padding: 2px 0 0 !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .topbar .eyebrow {
          margin: 0 0 5px !important;
          color: #07805f !important;
          font-size: 10px !important;
          font-weight: 850 !important;
          letter-spacing: .12em !important;
          text-transform: uppercase !important;
        }

        .topbar h1 {
          margin: 0 0 7px !important;
          color: #10211c !important;
          font-size: 36px !important;
          font-weight: 790 !important;
          line-height: 1.05 !important;
          letter-spacing: -.045em !important;
        }

        .pageSubline {
          display: block !important;
          max-width: 760px !important;
          color: #687b75 !important;
          font-size: 13px !important;
          line-height: 1.5 !important;
        }

        .topActions {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
        }

        .topActions .secondaryButton,
        .topActions .primaryButton {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 43px !important;
          padding: 0 17px !important;
          border-radius: 10px !important;
          font-size: 12px !important;
          font-weight: 750 !important;
          text-decoration: none !important;
        }

        .topActions .secondaryButton {
          border: 1px solid #d7e2de !important;
          background: #ffffff !important;
          color: #344c45 !important;
        }

        .topActions .primaryButton {
          border: 1px solid #087c60 !important;
          background: #087c60 !important;
          color: #ffffff !important;
          box-shadow: 0 8px 18px rgba(8,124,96,.16) !important;
        }

        .orderSummaryGrid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 14px !important;
          margin-bottom: 22px !important;
        }

        .orderSummaryGrid .metricCard {
          position: relative !important;
          min-height: 128px !important;
          padding: 20px !important;
          border: 1px solid #dce6e2 !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 10px 26px rgba(15,23,42,.04) !important;
          overflow: hidden !important;
        }

        .orderSummaryGrid .metricCard::before {
          content: "" !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          height: 3px !important;
          background: #78c7af !important;
        }

        .orderSummaryGrid .metricCard:nth-child(2)::before {
          background: #55b99d !important;
        }

        .orderSummaryGrid .metricCard:nth-child(3)::before {
          background: #7db3d2 !important;
        }

        .orderSummaryGrid .metricCard:nth-child(4)::before {
          background: #d4b36d !important;
        }

        .metricCard p {
          margin: 0 0 9px !important;
          color: #536962 !important;
          font-size: 11px !important;
          font-weight: 760 !important;
        }

        .metricCard strong {
          display: block !important;
          margin-bottom: 8px !important;
          color: #10211c !important;
          font-size: 29px !important;
          font-weight: 820 !important;
          line-height: 1 !important;
          letter-spacing: -.045em !important;
        }

        .metricCard span {
          color: #71827c !important;
          font-size: 11px !important;
        }

        .metricCard small {
          position: absolute !important;
          top: 17px !important;
          right: 17px !important;
          display: inline-flex !important;
          align-items: center !important;
          min-height: 23px !important;
          padding: 0 8px !important;
          border: 1px solid #cce4da !important;
          border-radius: 999px !important;
          background: #eff8f4 !important;
          color: #08705a !important;
          font-size: 8.5px !important;
          font-weight: 820 !important;
          text-transform: uppercase !important;
        }

        .panel {
          overflow: hidden !important;
          border: 1px solid #dce6e2 !important;
          border-radius: 21px !important;
          background: #ffffff !important;
          box-shadow: 0 14px 34px rgba(15,23,42,.045) !important;
        }

        .panelHeader {
          display: block !important;
          padding: 22px 22px 0 !important;
          border: 0 !important;
          background: #ffffff !important;
        }

        .panelHeader > div:first-child {
          display: block !important;
          margin-bottom: 17px !important;
        }

        .panelHeader .eyebrow {
          margin: 0 0 4px !important;
          color: #08785e !important;
          font-size: 9px !important;
          font-weight: 850 !important;
          letter-spacing: .11em !important;
          text-transform: uppercase !important;
        }

        .panelHeader h2 {
          margin: 0 !important;
          color: #10211c !important;
          font-size: 24px !important;
          font-weight: 790 !important;
          letter-spacing: -.03em !important;
        }

        .ordersFilterWrap {
          display: flex !important;
          flex-direction: column !important;
          gap: 13px !important;
          width: 100% !important;
        }

        .ordersFilterForm {
          display: grid !important;
          grid-template-columns:
            minmax(280px, 1.45fr)
            minmax(220px, .85fr)
            145px
            145px !important;
          align-items: end !important;
          gap: 10px !important;
          width: 100% !important;
          padding: 13px !important;
          border: 1px solid #dce6e2 !important;
          border-radius: 14px !important;
          background: #f7faf9 !important;
        }

        .filterLabel {
          display: flex !important;
          flex-direction: column !important;
          gap: 5px !important;
          color: #647871 !important;
          font-size: 9px !important;
          font-weight: 820 !important;
          letter-spacing: .06em !important;
          text-transform: uppercase !important;
        }

        .filterInput {
          width: 100% !important;
          min-height: 44px !important;
          padding: 0 14px !important;
          border: 1px solid #d3dfda !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          color: #263d36 !important;
          font-family: inherit !important;
          font-size: 12px !important;
          outline: none !important;
        }

        .filterInput:focus {
          border-color: #72bea9 !important;
          box-shadow: 0 0 0 3px rgba(15,164,126,.08) !important;
        }

        .ghostButton {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 38px !important;
          padding: 0 13px !important;
          border: 1px solid #d5e1dd !important;
          border-radius: 9px !important;
          background: #ffffff !important;
          color: #40564f !important;
          font-size: 11px !important;
          font-weight: 730 !important;
          text-decoration: none !important;
          cursor: pointer !important;
          box-shadow: none !important;
        }

        .ordersFilterForm .ghostButton {
          min-height: 44px !important;
        }

        .ordersFilterForm .primaryGhostButton {
          border-color: #087c60 !important;
          background: #087c60 !important;
          color: #ffffff !important;
        }

        .statusFilterGroup {
          display: flex !important;
          align-items: center !important;
          gap: 7px !important;
          padding-bottom: 15px !important;
          border-bottom: 1px solid #e8efec !important;
        }

        .statusFilterGroup .ghostButton {
          min-width: 108px !important;
          min-height: 37px !important;
        }

        .statusFilterGroup .ghostButton.activeFilter {
          border-color: #65bda4 !important;
          background: #e7f5f0 !important;
          color: #08705a !important;
        }

        .ordersTable {
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
          margin: 0 !important;
          padding: 16px 22px 22px !important;
          border: 0 !important;
          background: #f8faf9 !important;
          overflow: visible !important;
        }

        .ordersHead,
        .ordersRow {
          display: grid !important;
          grid-template-columns:
            minmax(150px, .9fr)
            minmax(145px, .85fr)
            105px
            minmax(210px, 1.3fr)
            105px
            105px
            285px !important;
          align-items: center !important;
          gap: 15px !important;
        }

        .ordersHead {
          min-height: 34px !important;
          padding: 0 17px !important;
          color: #71827c !important;
          font-size: 8.5px !important;
          font-weight: 850 !important;
          letter-spacing: .07em !important;
          text-transform: uppercase !important;
        }

        .ordersRow {
          min-height: 98px !important;
          padding: 16px 17px !important;
          border: 1px solid #dce6e2 !important;
          border-radius: 14px !important;
          background: #ffffff !important;
          box-shadow: 0 3px 10px rgba(15,23,42,.025) !important;
        }

        .ordersRow:hover {
          border-color: #b8d2c8 !important;
          box-shadow: 0 8px 20px rgba(15,23,42,.055) !important;
        }

        .ordersRow > div > strong,
        .ordersRow > strong {
          display: block !important;
          color: #13231e !important;
          font-size: 12.5px !important;
          font-weight: 770 !important;
          line-height: 1.3 !important;
        }

        .ordersRow > div > small {
          display: block !important;
          margin-top: 4px !important;
          color: #74857f !important;
          font-size: 9.5px !important;
          line-height: 1.4 !important;
        }

        .orderStatus {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: fit-content !important;
          min-height: 27px !important;
          padding: 0 9px !important;
          border-radius: 7px !important;
          font-size: 9px !important;
          font-weight: 820 !important;
        }

        .orderStatus.success {
          border: 1px solid #b8e1d2 !important;
          background: #edf9f4 !important;
          color: #08705a !important;
        }

        .orderStatus.production {
          border: 1px solid #c6dbef !important;
          background: #eff7fd !important;
          color: #356d98 !important;
        }

        .orderStatus.packing {
          border: 1px solid #ead8a8 !important;
          background: #fff8e7 !important;
          color: #916b13 !important;
        }

        .orderActions {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 7px !important;
          width: 100% !important;
        }

        .orderActions form {
          width: 100% !important;
          margin: 0 !important;
        }

        .orderActions .ghostButton {
          width: 100% !important;
          min-height: 35px !important;
          padding: 0 9px !important;
          border-radius: 8px !important;
          font-size: 10px !important;
          font-weight: 750 !important;
        }

        .orderActions .primaryGhostButton {
          border-color: #087c60 !important;
          background: #087c60 !important;
          color: #ffffff !important;
        }

        .deleteOrderButton {
          border: 1px solid #edc5c5 !important;
          background: #fff6f6 !important;
          color: #b43d3d !important;
        }

        @media (max-width: 1080px) {
          .orderSummaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .ordersFilterForm {
            grid-template-columns: 1fr 1fr !important;
          }

          .ordersHead {
            display: none !important;
          }

          .ordersRow {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .orderActions {
            grid-column: 1 / -1 !important;
          }
        }


        /* gastario-orders-final-visual-polish-20260713 */

        .ordersHead {
          min-height: 39px !important;
          padding: 0 16px !important;
          border: 1px solid #dde7e3 !important;
          border-radius: 11px !important;
          background: #f1f5f3 !important;
          color: #52665f !important;
          font-size: 9px !important;
          font-weight: 850 !important;
        }

        .ordersRow {
          min-height: 104px !important;
          padding: 17px 16px !important;
          border-color: #d7e3de !important;
          border-radius: 15px !important;
          box-shadow: 0 3px 12px rgba(15, 23, 42, .032) !important;
        }

        .ordersRow:hover {
          transform: translateY(-1px) !important;
          border-color: #9fc9bc !important;
          background: #fcfefd !important;
          box-shadow:
            inset 3px 0 0 #0a8a6a,
            0 9px 22px rgba(15, 23, 42, .06) !important;
        }

        .ordersRow > div:first-child strong {
          color: #12372c !important;
          font-size: 13px !important;
          font-weight: 820 !important;
          letter-spacing: .01em !important;
        }

        .ordersRow > div:nth-child(2) strong {
          color: #14241f !important;
          font-size: 13px !important;
          font-weight: 780 !important;
        }

        .ordersRow > div:nth-child(3) strong {
          font-size: 12.5px !important;
          font-weight: 780 !important;
        }

        .ordersRow > div:nth-child(4) strong {
          margin-bottom: 3px !important;
          font-size: 12.5px !important;
          font-weight: 780 !important;
        }

        .ordersRow > div:nth-child(4) small {
          display: -webkit-box !important;
          overflow: hidden !important;
          -webkit-box-orient: vertical !important;
          -webkit-line-clamp: 2 !important;
          color: #6b7d77 !important;
          font-size: 9.5px !important;
          line-height: 1.45 !important;
        }

        .ordersRow > strong {
          color: #10211c !important;
          font-size: 13.5px !important;
          font-weight: 820 !important;
          white-space: nowrap !important;
        }

        .orderStatus {
          min-height: 29px !important;
          padding: 0 10px !important;
          border-radius: 8px !important;
          font-size: 9px !important;
          letter-spacing: .01em !important;
        }

        .orderActions {
          grid-template-columns: 1fr 1.15fr 1fr !important;
          gap: 7px !important;
        }

        .orderActions .ghostButton {
          min-height: 37px !important;
          border-radius: 9px !important;
          font-size: 10px !important;
          font-weight: 770 !important;
          transition:
            background .15s ease,
            border-color .15s ease,
            color .15s ease !important;
        }

        .orderActions .primaryGhostButton {
          border: 1px solid #087c60 !important;
          background: #087c60 !important;
          color: #ffffff !important;
        }

        .orderActions .primaryGhostButton:hover {
          border-color: #066b52 !important;
          background: #066f56 !important;
        }

        .orderActions .ghostButton:not(.primaryGhostButton):not(.deleteOrderButton) {
          border: 1px solid #cfdcd7 !important;
          background: #ffffff !important;
          color: #364d46 !important;
        }

        .orderActions .ghostButton:not(.primaryGhostButton):not(.deleteOrderButton):hover {
          border-color: #a9c7bc !important;
          background: #f4f9f7 !important;
          color: #08705a !important;
        }

        .orderActions .deleteOrderButton,
        .orderActions form .deleteOrderButton {
          border: 1px solid #e8bcbc !important;
          background: #fff5f5 !important;
          color: #b32f2f !important;
          box-shadow: none !important;
        }

        .orderActions .deleteOrderButton:hover,
        .orderActions form .deleteOrderButton:hover {
          border-color: #d98f8f !important;
          background: #ffe9e9 !important;
          color: #972020 !important;
        }

        .statusFilterGroup .ghostButton {
          min-height: 39px !important;
          padding: 0 17px !important;
          border-radius: 10px !important;
          font-size: 11px !important;
        }

        .statusFilterGroup .ghostButton.activeFilter {
          border-color: #58b69c !important;
          background: #dff2eb !important;
          color: #076b54 !important;
          box-shadow: inset 0 0 0 1px rgba(8, 124, 96, .05) !important;
        }

        .ordersFilterForm {
          padding: 14px !important;
          border-color: #d7e3de !important;
          background: #f5f8f7 !important;
        }

        .filterInput {
          border-color: #cfdcd7 !important;
          background: #ffffff !important;
        }


        /* gastario-orders-premium-depth-20260713 */

        .orderSummaryGrid .metricCard {
          border-color: #d8e4df !important;
          box-shadow:
            0 12px 30px rgba(15, 23, 42, .055),
            inset 0 1px 0 rgba(255,255,255,.95) !important;
          transition:
            transform .18s ease,
            box-shadow .18s ease,
            border-color .18s ease !important;
        }

        .orderSummaryGrid .metricCard:hover {
          transform: translateY(-2px) !important;
          border-color: #bad2c9 !important;
          box-shadow:
            0 17px 38px rgba(15, 23, 42, .075),
            inset 0 1px 0 rgba(255,255,255,.95) !important;
        }

        .orderSummaryGrid .metricCard:nth-child(1) {
          background:
            radial-gradient(circle at 100% 0%, rgba(16,163,127,.10), transparent 38%),
            #ffffff !important;
        }

        .orderSummaryGrid .metricCard:nth-child(2) {
          background:
            radial-gradient(circle at 100% 0%, rgba(63,167,132,.11), transparent 38%),
            #ffffff !important;
        }

        .orderSummaryGrid .metricCard:nth-child(3) {
          background:
            radial-gradient(circle at 100% 0%, rgba(73,138,184,.11), transparent 38%),
            #ffffff !important;
        }

        .orderSummaryGrid .metricCard:nth-child(4) {
          background:
            radial-gradient(circle at 100% 0%, rgba(209,164,73,.12), transparent 38%),
            #ffffff !important;
        }

        .metricCard p {
          color: #4a625a !important;
          font-size: 11.5px !important;
        }

        .metricCard strong {
          font-size: 31px !important;
          color: #0b2119 !important;
        }

        .metricCard small {
          box-shadow: 0 3px 8px rgba(15,23,42,.045) !important;
        }

        .panel {
          border-color: #d7e3de !important;
          background:
            linear-gradient(180deg, #ffffff 0%, #fbfdfc 100%) !important;
          box-shadow:
            0 18px 45px rgba(15,23,42,.06),
            inset 0 1px 0 rgba(255,255,255,.95) !important;
        }

        .panelHeader {
          padding: 24px 24px 0 !important;
        }

        .panelHeader h2 {
          font-size: 26px !important;
          color: #0c2119 !important;
        }

        .ordersFilterForm {
          padding: 15px !important;
          border-color: #d5e2dd !important;
          background:
            linear-gradient(180deg, #f9fbfa 0%, #f2f7f5 100%) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.95),
            0 5px 15px rgba(15,23,42,.035) !important;
        }

        .filterInput {
          border-color: #cbdad4 !important;
          background: #ffffff !important;
          box-shadow: inset 0 1px 2px rgba(15,23,42,.025) !important;
        }

        .ordersFilterForm .primaryGhostButton {
          background:
            linear-gradient(180deg, #0d8b6b 0%, #08775b 100%) !important;
          box-shadow: 0 8px 17px rgba(8,124,96,.18) !important;
        }

        .statusFilterGroup {
          width: fit-content !important;
          padding: 5px !important;
          margin-bottom: 14px !important;
          border: 1px solid #d9e4e0 !important;
          border-radius: 12px !important;
          background: #f3f7f5 !important;
        }

        .statusFilterGroup .ghostButton {
          min-width: 112px !important;
          min-height: 39px !important;
          border: 1px solid transparent !important;
          border-radius: 9px !important;
          background: transparent !important;
          color: #52675f !important;
        }

        .statusFilterGroup .ghostButton:hover {
          border-color: #d1dfda !important;
          background: rgba(255,255,255,.75) !important;
        }

        .statusFilterGroup .ghostButton.activeFilter {
          border-color: #8dceb9 !important;
          background: #ffffff !important;
          color: #076b54 !important;
          box-shadow:
            0 4px 11px rgba(15,23,42,.07),
            inset 0 -2px 0 #10a37f !important;
        }

        .ordersTable {
          gap: 12px !important;
          padding: 18px 24px 24px !important;
          background:
            linear-gradient(180deg, #f5f8f7 0%, #f8faf9 100%) !important;
        }

        .ordersHead {
          min-height: 40px !important;
          padding: 0 18px !important;
          border: 1px solid #d8e3df !important;
          border-radius: 11px !important;
          background: #ffffff !important;
          color: #596e66 !important;
          box-shadow: 0 3px 9px rgba(15,23,42,.025) !important;
        }

        .ordersRow {
          position: relative !important;
          min-height: 108px !important;
          padding: 18px 18px 18px 21px !important;
          overflow: hidden !important;
          border-color: #d8e4df !important;
          border-radius: 16px !important;
          background:
            linear-gradient(90deg, rgba(236,248,243,.7) 0, #ffffff 13%, #ffffff 100%) !important;
          box-shadow:
            0 6px 17px rgba(15,23,42,.038),
            inset 0 1px 0 rgba(255,255,255,.95) !important;
        }

        .ordersRow::before {
          content: "" !important;
          position: absolute !important;
          top: 13px !important;
          bottom: 13px !important;
          left: 0 !important;
          width: 4px !important;
          border-radius: 0 6px 6px 0 !important;
          background: #5eb99f !important;
        }

        .ordersRow:hover {
          transform: translateY(-2px) !important;
          border-color: #9fc8bb !important;
          background:
            linear-gradient(90deg, rgba(226,245,238,.85) 0, #ffffff 14%, #ffffff 100%) !important;
          box-shadow:
            0 14px 30px rgba(15,23,42,.075),
            inset 0 1px 0 rgba(255,255,255,.95) !important;
        }

        .ordersRow > div:first-child strong {
          color: #0c4d3b !important;
          font-size: 13.5px !important;
        }

        .ordersRow > div:first-child small {
          display: inline-flex !important;
          align-items: center !important;
          width: fit-content !important;
          min-height: 20px !important;
          margin-top: 6px !important;
          padding: 0 7px !important;
          border: 1px solid #d7e5df !important;
          border-radius: 999px !important;
          background: #eef5f2 !important;
          color: #507067 !important;
          font-size: 8px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
        }

        .ordersRow > div:nth-child(2) strong {
          font-size: 13.5px !important;
          color: #11241d !important;
        }

        .ordersRow > div:nth-child(3) strong {
          color: #183329 !important;
        }

        .ordersRow > div:nth-child(4) strong {
          color: #14291f !important;
          font-size: 13px !important;
        }

        .ordersRow > div:nth-child(4) small {
          color: #687c74 !important;
          line-height: 1.5 !important;
        }

        .ordersRow > strong {
          padding: 8px 10px !important;
          border-radius: 9px !important;
          background: #f2f7f5 !important;
          color: #0d2a20 !important;
          font-size: 14px !important;
          text-align: center !important;
        }

        .orderStatus {
          min-height: 30px !important;
          padding: 0 11px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.8) !important;
        }

        .orderActions {
          gap: 8px !important;
        }

        .orderActions .ghostButton {
          min-height: 39px !important;
          border-radius: 10px !important;
          font-size: 10.5px !important;
        }

        .orderActions .primaryGhostButton {
          border-color: #07775b !important;
          background:
            linear-gradient(180deg, #0c8a69 0%, #077458 100%) !important;
          box-shadow: 0 6px 13px rgba(8,124,96,.17) !important;
        }

        .orderActions .primaryGhostButton:hover {
          background:
            linear-gradient(180deg, #08775b 0%, #056449 100%) !important;
        }

        .orderActions .ghostButton:not(.primaryGhostButton):not(.deleteOrderButton) {
          border-color: #cad9d3 !important;
          background:
            linear-gradient(180deg, #ffffff 0%, #f6f9f8 100%) !important;
          color: #344d45 !important;
        }

        .orderActions .deleteOrderButton,
        .orderActions form .deleteOrderButton {
          border-color: #e5b3b3 !important;
          background:
            linear-gradient(180deg, #fffafa 0%, #fff0f0 100%) !important;
          color: #b12d2d !important;
        }

        .orderActions .deleteOrderButton:hover,
        .orderActions form .deleteOrderButton:hover {
          border-color: #d58181 !important;
          background: #ffe5e5 !important;
          color: #912020 !important;
        }
      `}</style>
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



