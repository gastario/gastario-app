import { Form, Link, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

const STATUSES = [
  { value: "", label: "Alle" },
  { value: "AUTO_CREATED", label: "Prüfen" },
  { value: "CONFIRMED", label: "Bestätigt" },
  { value: "REJECTED", label: "Abgelehnt" },
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

function statusLabel(status: string) {
  if (status === "AUTO_CREATED") return "Prüfen";
  if (status === "CONFIRMED") return "Bestätigt";
  if (status === "REJECTED") return "Abgelehnt";
  return status;
}

function statusClass(status: string) {
  if (status === "CONFIRMED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export function meta() {
  return [{ title: "Aufträge · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId || !access.tenant) {
    return {
      tenant: null,
      setupError: access.setupError || "Kein Mandant gefunden.",
      activeStatus: "",
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

  const url = new URL(request.url);
  const activeStatus = url.searchParams.get("status") || "";

  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
        ...(activeStatus
          ? { status: activeStatus as any }
          : {
              status: {
                in: [
                  "CONFIRMED",
                  "IN_PRODUCTION",
                  "PACKING_OPEN",
                  "DELIVERED",
                ] as any,
              },
            }),
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
      take: 300,
    });

    const allOrders = await prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
      },
      include: {
        items: true,
      },
      take: 1000,
    });

    const totalValueCents = allOrders.reduce((sum, order) => {
      return sum + order.items.reduce((itemSum, item) => itemSum + (item.totalCents || item.totalPriceCents || 0), 0);
    }, 0);

    return {
      tenant: access.tenant,
      setupError: null,
      activeStatus,
      orders,
      counts: {
        all: allOrders.length,
        review: allOrders.filter((order) => order.status === "AUTO_CREATED").length,
        confirmed: allOrders.filter((order) => order.status === "CONFIRMED").length,
        rejected: allOrders.filter((order) => order.status === "REJECTED").length,
        totalValueCents,
      },
    };
  } catch (error) {
    console.error("Aufträge loader failed:", error);

    return {
      tenant: access.tenant,
      setupError: "Aufträge konnten nicht geladen werden. Bitte Datenbank/Schema pruefen.",
      activeStatus,
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
          <Link className="secondaryButton" to="/import-pruefen">Import pruefen</Link>
          <Link className="primaryButton" to="/auftragseingang">Neuer Auftrag</Link>
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
            <p>Prüfen</p>
            <strong>{data.counts.review}</strong>
            <span>im Auftragseingang</span>
          </div>
          <small data-trend="pruefen">offen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Abgelehnt</p>
            <strong>{data.counts.rejected}</strong>
            <span>nicht uebernommen</span>
          </div>
          <small data-trend="kritisch">Archiv</small>
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
            <h2>Aktuelle Aufträge</h2>
          </div>

          <div className="ordersFilterWrap">
            <Form method="get" className="ordersFilterForm">
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

              <Link className="ghostButton" to={data.activeStatus ? "/auftraege?status=" + data.activeStatus : "/auftraege"}>
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
                      Prüfen
                    </Link>

                    <Link
                      className="ghostButton"
                      to={"/lieferscheine?date=" + String(order.deliveryDate || "").slice(0, 10)}
                    >
                      Lieferschein
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
        /* orders-page-polish */
        .metricCard {
          border-radius: 24px !important;
          border: 1px solid #dbe7ee !important;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.065) !important;
          min-height: 112px !important;
        }

        .metricCard strong {
          letter-spacing: -0.055em;
        }

        .sectionActions {
          align-items: center !important;
        }

        .ghostButton {
          min-height: 36px !important;
          border-radius: 999px !important;
          padding: 8px 13px !important;
          border: 1px solid #d6e1ea !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 900 !important;
          text-decoration: none !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
        }

        .primaryGhostButton {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        .orderStatus {
          border-radius: 999px !important;
          padding: 7px 11px !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }

        .ordersTable,
        .ordersList,
        .orderTable {
          border-radius: 22px !important;
          overflow: hidden !important;
        }

        .orderRow {
          min-height: 112px !important;
          align-items: center !important;
        }

        .orderRow > div {
          align-self: center !important;
        }

        .orderRow strong {
          letter-spacing: -0.015em;
        }

        .orderRow small {
          color: #64748b !important;
          line-height: 1.35 !important;
        }

        .orderRow form button {
          min-height: 36px !important;
          border-radius: 999px !important;
          border: 1px solid #fecaca !important;
          background: #fff7f7 !important;
          color: #b91c1c !important;
          font-weight: 950 !important;
          padding: 8px 13px !important;
          cursor: pointer !important;
        }

        @media (max-width: 1100px) {
          .orderRow {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }
      `}</style>

    
      <style>{`
        /* auftraege-polish-v2 */
        .niceFilterBar {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
        }

        .dateFilterForm {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
        }

        .dateFilterInput {
          height: 38px !important;
          border: 1px solid #d6e1ea !important;
          border-radius: 999px !important;
          padding: 0 13px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 850 !important;
          outline: none !important;
        }

        .ghostButton {
          min-height: 38px !important;
          border-radius: 999px !important;
          padding: 8px 14px !important;
          border: 1px solid #d6e1ea !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 950 !important;
          text-decoration: none !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
          cursor: pointer !important;
          white-space: nowrap !important;
        }

        .ghostButton:hover {
          border-color: #0f9f7a !important;
          color: #047857 !important;
          background: #f0fdf4 !important;
        }

        .activeFilter {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        .primaryGhostButton {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        .orderStatus {
          border-radius: 999px !important;
          padding: 7px 11px !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }

        .orderRow {
          min-height: 96px !important;
          align-items: center !important;
        }

        .orderRow small {
          color: #64748b !important;
          line-height: 1.35 !important;
        }

        .orderRow form button {
          min-height: 38px !important;
          border-radius: 999px !important;
          border: 1px solid #fecaca !important;
          background: #fff7f7 !important;
          color: #b91c1c !important;
          font-weight: 950 !important;
          padding: 8px 14px !important;
          cursor: pointer !important;
        }

        .orderRow form button:hover {
          background: #fee2e2 !important;
        }

        @media (max-width: 1100px) {
          .niceFilterBar {
            justify-content: flex-start !important;
          }
        }
      `}</style>

    
      <style>{`
        /* orders-filter-redesign */
        .niceOrdersFilterBar {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 14px !important;
          align-items: end !important;
          margin-top: 14px !important;
        }

        .ordersFilterForm {
          display: flex !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
          align-items: end !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 20px !important;
          padding: 10px !important;
        }

        .statusFilterGroup {
          display: flex !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
          justify-content: flex-end !important;
        }

        .filterLabel {
          display: grid !important;
          gap: 5px !important;
          color: #64748b !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          text-transform: uppercase !important;
          letter-spacing: .06em !important;
        }

        .filterInput {
          min-width: 210px !important;
          height: 42px !important;
          border: 1px solid #d6e1ea !important;
          border-radius: 16px !important;
          padding: 0 13px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 850 !important;
          outline: none !important;
        }

        .filterInput:focus {
          border-color: #99d5ca !important;
          box-shadow: 0 0 0 4px rgba(15, 159, 122, 0.10) !important;
        }

        .ghostButton {
          min-height: 42px !important;
          border-radius: 999px !important;
          padding: 9px 15px !important;
          border: 1px solid #d6e1ea !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 950 !important;
          text-decoration: none !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
          cursor: pointer !important;
          white-space: nowrap !important;
        }

        .primaryGhostButton,
        .activeFilter {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        @media (max-width: 1150px) {
          .niceOrdersFilterBar {
            grid-template-columns: 1fr !important;
          }

          .statusFilterGroup {
            justify-content: flex-start !important;
          }
        }
      `}</style>

    
      <style>{`
        /* orders-filter-final */
        .panelHeader {
          align-items: flex-start !important;
          gap: 18px !important;
        }

        .ordersFilterWrap {
          display: grid !important;
          gap: 10px !important;
          justify-items: end !important;
          max-width: 780px !important;
        }

        .ordersFilterForm {
          display: flex !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
          align-items: end !important;
          justify-content: flex-end !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 20px !important;
          padding: 10px !important;
        }

        .statusFilterGroup {
          display: flex !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
          justify-content: flex-end !important;
        }

        .filterLabel {
          display: grid !important;
          gap: 5px !important;
          color: #64748b !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          text-transform: uppercase !important;
          letter-spacing: .06em !important;
        }

        .filterInput {
          min-width: 210px !important;
          height: 42px !important;
          border: 1px solid #d6e1ea !important;
          border-radius: 16px !important;
          padding: 0 13px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 850 !important;
          outline: none !important;
        }

        .filterInput:focus {
          border-color: #99d5ca !important;
          box-shadow: 0 0 0 4px rgba(15, 159, 122, 0.10) !important;
        }

        .activeFilter,
        .primaryGhostButton {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        @media (max-width: 1180px) {
          .panelHeader {
            display: grid !important;
          }

          .ordersFilterWrap {
            justify-items: stretch !important;
            max-width: none !important;
          }

          .ordersFilterForm,
          .statusFilterGroup {
            justify-content: flex-start !important;
          }
        }
      `}</style>

    
      <style>{`
        /* gastario-orders-page-redesign-20260713 */

        .topbar {
          display: flex !important;
          align-items: flex-start !important;
          justify-content: space-between !important;
          gap: 32px !important;
          margin-bottom: 20px !important;
          padding: 4px 0 0 !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .topbar h1 {
          margin: 2px 0 5px !important;
          color: #10211c !important;
          font-size: 32px !important;
          font-weight: 780 !important;
          letter-spacing: -0.035em !important;
        }

        .topbar .eyebrow {
          margin: 0 !important;
          color: #078563 !important;
          font-size: 10px !important;
          font-weight: 850 !important;
          letter-spacing: 0.12em !important;
          text-transform: uppercase !important;
        }

        .pageSubline {
          display: block !important;
          max-width: 780px !important;
          color: #647871 !important;
          font-size: 13px !important;
          font-weight: 560 !important;
          line-height: 1.5 !important;
        }

        .topActions {
          display: flex !important;
          align-items: center !important;
          gap: 9px !important;
          flex: 0 0 auto !important;
        }

        .topActions .primaryButton,
        .topActions .secondaryButton {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 40px !important;
          padding: 0 15px !important;
          border-radius: 10px !important;
          font-size: 12px !important;
          font-weight: 750 !important;
          text-decoration: none !important;
          box-shadow: none !important;
        }

        .topActions .secondaryButton {
          border: 1px solid #d5e1dd !important;
          background: #ffffff !important;
          color: #344c45 !important;
        }

        .topActions .secondaryButton:hover {
          border-color: #afc9c0 !important;
          background: #f7faf9 !important;
          color: #08705a !important;
        }

        .topActions .primaryButton {
          border: 1px solid #0b9472 !important;
          background: #10a37f !important;
          color: #ffffff !important;
          box-shadow: 0 6px 14px rgba(15, 164, 126, 0.15) !important;
        }

        .orderSummaryGrid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 12px !important;
          margin-bottom: 18px !important;
        }

        .orderSummaryGrid .metricCard {
          display: flex !important;
          align-items: flex-start !important;
          justify-content: space-between !important;
          min-height: 124px !important;
          padding: 18px !important;
          border: 1px solid #dce6e2 !important;
          border-radius: 17px !important;
          background: #ffffff !important;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035) !important;
        }

        .metricCard p {
          margin: 0 0 7px !important;
          color: #61756e !important;
          font-size: 11px !important;
          font-weight: 750 !important;
        }

        .metricCard strong {
          display: block !important;
          margin-bottom: 6px !important;
          color: #10211c !important;
          font-size: 27px !important;
          font-weight: 800 !important;
          line-height: 1 !important;
          letter-spacing: -0.035em !important;
        }

        .metricCard span {
          color: #71827c !important;
          font-size: 11px !important;
          font-weight: 600 !important;
        }

        .metricCard small {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 24px !important;
          padding: 0 8px !important;
          border: 1px solid #d8e7e2 !important;
          border-radius: 999px !important;
          background: #f3f8f6 !important;
          color: #527067 !important;
          font-size: 9px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
        }

        .metricCard small[data-trend="aktiv"],
        .metricCard small[data-trend="bereit"] {
          border-color: #bde4d5 !important;
          background: #edf9f4 !important;
          color: #08705a !important;
        }

        .metricCard small[data-trend="pruefen"] {
          border-color: #cfe1ee !important;
          background: #eff7fc !important;
          color: #376b91 !important;
        }

        .metricCard small[data-trend="kritisch"] {
          border-color: #efc3c3 !important;
          background: #fff5f5 !important;
          color: #b04444 !important;
        }

        .panel {
          overflow: hidden !important;
          border: 1px solid #dce6e2 !important;
          border-radius: 20px !important;
          background: #ffffff !important;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04) !important;
        }

        .panelHeader {
          display: flex !important;
          align-items: flex-start !important;
          justify-content: space-between !important;
          gap: 24px !important;
          padding: 18px !important;
          border-bottom: 1px solid #e9f0ed !important;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfc 100%) !important;
        }

        .panelHeader h2 {
          margin: 2px 0 0 !important;
          color: #10211c !important;
          font-size: 23px !important;
          font-weight: 780 !important;
          letter-spacing: -0.025em !important;
        }

        .panelHeader .eyebrow {
          margin: 0 !important;
          color: #078563 !important;
          font-size: 9px !important;
          font-weight: 850 !important;
          letter-spacing: 0.1em !important;
          text-transform: uppercase !important;
        }

        .ordersFilterWrap {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-end !important;
          gap: 9px !important;
          min-width: min(610px, 100%) !important;
        }

        .ordersFilterForm {
          display: grid !important;
          grid-template-columns: minmax(190px, 1fr) 180px auto auto !important;
          align-items: end !important;
          gap: 8px !important;
          width: 100% !important;
          padding: 10px !important;
          border: 1px solid #dce6e2 !important;
          border-radius: 14px !important;
          background: #f8faf9 !important;
        }

        .filterLabel {
          display: flex !important;
          flex-direction: column !important;
          gap: 5px !important;
          color: #60736d !important;
          font-size: 9px !important;
          font-weight: 800 !important;
          letter-spacing: 0.06em !important;
          text-transform: uppercase !important;
        }

        .filterInput {
          width: 100% !important;
          min-height: 38px !important;
          padding: 0 12px !important;
          border: 1px solid #d4dfdb !important;
          border-radius: 9px !important;
          background: #ffffff !important;
          color: #253c35 !important;
          font-family: inherit !important;
          font-size: 12px !important;
          outline: none !important;
        }

        .filterInput:focus {
          border-color: #7fc7b4 !important;
          box-shadow: 0 0 0 3px rgba(15, 164, 126, 0.08) !important;
        }

        .ordersFilterForm .ghostButton {
          min-height: 38px !important;
          padding: 0 13px !important;
          border-radius: 9px !important;
          white-space: nowrap !important;
        }

        .statusFilterGroup {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 7px !important;
        }

        .statusFilterGroup .ghostButton {
          min-height: 34px !important;
          padding: 0 13px !important;
          border: 1px solid #d6e1dd !important;
          border-radius: 9px !important;
          background: #ffffff !important;
          color: #425850 !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          box-shadow: none !important;
        }

        .statusFilterGroup .ghostButton.activeFilter {
          border-color: #65bda4 !important;
          background: #e7f5f0 !important;
          color: #08705a !important;
        }

        .ordersTable {
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          overflow: hidden !important;
        }

        .ordersHead,
        .ordersRow {
          display: grid !important;
          grid-template-columns:
            minmax(95px, 0.72fr)
            minmax(150px, 1fr)
            minmax(95px, 0.72fr)
            minmax(210px, 1.45fr)
            105px
            115px
            132px !important;
          align-items: center !important;
          gap: 14px !important;
        }

        .ordersHead {
          min-height: 42px !important;
          padding: 0 16px !important;
          border-bottom: 1px solid #dfe8e5 !important;
          background: #f4f7f6 !important;
          color: #61756e !important;
          font-size: 9px !important;
          font-weight: 850 !important;
          letter-spacing: 0.06em !important;
          text-transform: uppercase !important;
        }

        .ordersRow {
          min-height: 112px !important;
          padding: 16px !important;
          border-bottom: 1px solid #e7eeeb !important;
          background: #ffffff !important;
          transition:
            background 0.15s ease,
            box-shadow 0.15s ease !important;
        }

        .ordersRow:last-child {
          border-bottom: 0 !important;
        }

        .ordersRow:hover {
          background: #fbfdfc !important;
          box-shadow: inset 3px 0 0 #10a37f !important;
        }

        .ordersRow > div > strong,
        .ordersRow > strong {
          display: block !important;
          color: #12221d !important;
          font-size: 13px !important;
          font-weight: 760 !important;
          line-height: 1.3 !important;
        }

        .ordersRow > div > small {
          display: block !important;
          margin-top: 3px !important;
          overflow: hidden !important;
          color: #71827c !important;
          font-size: 10px !important;
          font-weight: 560 !important;
          line-height: 1.35 !important;
          text-overflow: ellipsis !important;
        }

        .orderStatus {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: fit-content !important;
          min-height: 27px !important;
          padding: 0 9px !important;
          border-radius: 999px !important;
          font-size: 9px !important;
          font-weight: 800 !important;
          white-space: nowrap !important;
        }

        .orderStatus.success {
          border: 1px solid #b8e1d2 !important;
          background: #edf9f4 !important;
          color: #08705a !important;
        }

        .orderStatus.warning {
          border: 1px solid #f1d4a8 !important;
          background: #fff8ed !important;
          color: #a36208 !important;
        }

        .orderStatus.danger {
          border: 1px solid #edc4c4 !important;
          background: #fff4f4 !important;
          color: #ae3f3f !important;
        }

        .orderActions {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 6px !important;
          width: 100% !important;
        }

        .orderActions form {
          display: block !important;
          width: 100% !important;
          margin: 0 !important;
        }

        .orderActions .ghostButton {
          width: 100% !important;
          min-height: 32px !important;
          padding: 0 10px !important;
          border-radius: 8px !important;
          font-size: 10px !important;
          font-weight: 750 !important;
          box-shadow: none !important;
        }

        .orderActions .primaryGhostButton {
          border-color: #0b9472 !important;
          background: #10a37f !important;
          color: #ffffff !important;
        }

        .orderActions .ghostButton:not(.primaryGhostButton):not(.deleteOrderButton) {
          border-color: #d6e1dd !important;
          background: #ffffff !important;
          color: #40564f !important;
        }

        .deleteOrderButton {
          border: 1px solid #edc9c9 !important;
          background: #fff7f7 !important;
          color: #b34242 !important;
        }

        .deleteOrderButton:hover {
          border-color: #de9f9f !important;
          background: #ffeded !important;
          color: #9f2828 !important;
        }

        @media (max-width: 1250px) {
          .orderSummaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .panelHeader {
            flex-direction: column !important;
          }

          .ordersFilterWrap {
            align-items: stretch !important;
            width: 100% !important;
          }

          .ordersHead,
          .ordersRow {
            grid-template-columns:
              minmax(90px, .75fr)
              minmax(130px, 1fr)
              90px
              minmax(170px, 1.3fr)
              95px
              105px
              120px !important;
            gap: 10px !important;
          }
        }

        @media (max-width: 900px) {
          .topbar {
            flex-direction: column !important;
          }

          .orderSummaryGrid {
            grid-template-columns: 1fr !important;
          }

          .ordersFilterForm {
            grid-template-columns: 1fr 1fr !important;
          }

          .ordersHead {
            display: none !important;
          }

          .ordersRow {
            grid-template-columns: 1fr 1fr !important;
          }

          .orderActions {
            flex-direction: row !important;
            grid-column: 1 / -1 !important;
          }
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


