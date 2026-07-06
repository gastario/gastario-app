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
  return [{ title: "Aufträge Â· Gastario" }];
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
            {data.tenant?.name || "Kein Mandant"} Â· übernommene und operative Aufträge. Neue PDF-Importe zuerst im Auftragseingang pruefen.
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

          <div className="filterActions">
            {STATUSES.map((status) => (
              <Link
                key={status.value || "all"}
                className="ghostButton"
                to={status.value ? `/auftraege?status=${status.value}` : "/auftraege"}
              >
                {status.label}
              </Link>
            ))}
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

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link className="ghostButton" to={"/auftrag-pruefung/" + order.id}>
                      Öffnen
                    </Link>

                    <Link className="ghostButton" to={"/auftrag-pruefung/" + order.id}>
                      Prüfseite
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
                      <button className="ghostButton" type="submit" style={{ color: "#b91c1c" }}>
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

