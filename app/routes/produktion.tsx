import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("de-DE");
  } catch {
    return "-";
  }
}

function emptyData(error: string | null = null) {
  return {
    tenantName: "Gastario",
    orders: [],
    productionItems: [],
    stats: {
      orders: 0,
      positions: 0,
      portions: 0,
    },
    error,
  };
}

function orderSummary(order: any) {
  if (!order.items || order.items.length === 0) return "Keine Positionen";

  return order.items
    .map((item: any) => `${item.quantity || 0} x ${item.name || "Position"}`)
    .join(", ");
}

export function meta() {
  return [{ title: "Produktion · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  try {
    const { prisma } = await import("../lib/prisma.server");
    const { getTenantAccess } = await import("../lib/features.server");

    const access = await getTenantAccess(request);

    if (!access?.tenantId) {
      return emptyData("Kein Mandant gefunden.");
    }

    const url = new URL(request.url);
    const selectedDate = url.searchParams.get("date") || todayInput();

    const orders = await prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 300,
    });

    const relevantOrders = orders.filter((order: any) => {
      const status = String(order.status || "").toUpperCase();
      const date = normalizeDate(order.deliveryDate);

      return (
        date === selectedDate &&
        (
          status === "CONFIRMED" ||
          status === "PAID" ||
          status === "INVOICE_APPROVED" ||
          status === "MANUAL"
        )
      );
    });

    const grouped = new Map<string, any>();

    for (const order of relevantOrders as any[]) {
      for (const item of order.items || []) {
        const name = String(item.name || "Position");
        const unit = String(item.unit || "Stueck");
        const key = `${name}__${unit}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            name,
            unit,
            quantity: 0,
            orders: [],
          });
        }

        const row = grouped.get(key);
        row.quantity += Number(item.quantity || 0);
        row.orders.push(order.orderNumber || order.id);
      }
    }

    const productionItems = Array.from(grouped.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "de")
    );

    const portions = productionItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

    return {
      tenantName: access.tenant?.name || "Gastario",
      selectedDate,
      orders: relevantOrders,
      productionItems,
      stats: {
        orders: relevantOrders.length,
        positions: productionItems.length,
        portions,
      },
      error: null,
    };
  } catch (error: any) {
    console.error("Produktion loader error:", error);
    return emptyData(error?.message || "Produktion konnte nicht geladen werden.");
  }
}

export default function ProductionPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Produktion</h1>
          <span className="pageSubline">
            {data.tenantName} · Produktionsliste aus Auftraegen fuer den gewaehlten Tag.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton" type="button" onClick={() => window.print()}>
            Drucken
          </button>
          <Link className="primaryButton" to="/auftragseingang">
            Auftrag anlegen
          </Link>
        </div>
      </header>

      {data.error ? (
        <section className="panel">
          <div className="noteBox">
            <strong>Hinweis</strong>
            <p>{data.error}</p>
          </div>
        </section>
      ) : null}

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Auftraege</p>
            <strong>{data.stats.orders}</strong>
            <span>fuer Produktion</span>
          </div>
          <small data-trend="aktiv">heute</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Positionen</p>
            <strong>{data.stats.positions}</strong>
            <span>gruppiert</span>
          </div>
          <small data-trend="bereit">Liste</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Mengen</p>
            <strong>{data.stats.portions}</strong>
            <span>gesamt</span>
          </div>
          <small data-trend="pruefen">Produktion</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Produktionsliste</p>
              <h2>Zu produzieren</h2>
            </div>
          </div>

          <div className="purchaseDemandTable">
            <div className="purchaseDemandHead">
              <span>Produkt</span>
              <span>Menge</span>
              <span>Einheit</span>
              <span>Auftraege</span>
              <span>Status</span>
            </div>

            {data.productionItems.length === 0 ? (
              <div className="purchaseDemandRow">
                <strong>Keine Produktionspositionen gefunden</strong>
                <span>-</span>
                <span>-</span>
                <span>-</span>
                <span>-</span>
              </div>
            ) : (
              data.productionItems.map((item: any) => (
                <div className="purchaseDemandRow" key={`${item.name}-${item.unit}`}>
                  <strong>{item.name}</strong>
                  <span>{item.quantity}</span>
                  <span>{item.unit}</span>
                  <span>{item.orders.slice(0, 3).join(", ")}</span>
                  <em className="warning">Offen</em>
                </div>
              ))
            )}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Auftraege</p>
                <h2>Basis</h2>
              </div>
            </div>

            <div className="compactList">
              {data.orders.length === 0 ? (
                <div className="compactItem">
                  <div>
                    <strong>Keine Auftraege</strong>
                    <span>Keine passenden Auftraege gefunden.</span>
                  </div>
                  <small>-</small>
                </div>
              ) : (
                data.orders.map((order: any) => (
                  <div className="compactItem" key={order.id}>
                    <div>
                      <strong>{order.customerName || "Ohne Kunde"}</strong>
                      <span>{formatDate(order.deliveryDate)} · {orderSummary(order)}</span>
                    </div>
                    <small>{order.deliveryTime || "-"}</small>
                  </div>
                ))
              )}
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
