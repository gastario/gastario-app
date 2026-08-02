import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import "../styles/gastario-page-shell.css";
import "../styles/gastario-operations.css";

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
    selectedDate: todayInput(),
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
      <PageShell className="operationsMasterPage productionMasterPage">
        <PageHeader
          eyebrow="Betrieb"
          title="Produktion"
          subtitle={
            <>
              {data.tenantName} · Produktionsmengen, Auftragsbasis und
              Planungstag in einem Arbeitsbereich.
            </>
          }
          actions={
            <>
              <button
                className="g-ops-button g-ops-button--secondary"
                type="button"
                onClick={() => window.print()}
              >
                Drucken
              </button>

              <Link
                className="g-ops-button g-ops-button--primary"
                to="/auftragseingang"
              >
                Auftrag anlegen
              </Link>
            </>
          }
        />

        {data.error ? (
          <Notice type="danger">
            <strong>Die Produktionsdaten konnten nicht vollständig geladen werden.</strong>
            <span>{data.error}</span>
          </Notice>
        ) : null}

        <MetricGrid className="operationsMetricGrid">
          <MetricCard
            label="Aufträge"
            value={data.stats.orders}
            description="für die Produktion"
            badge="Plan"
          />

          <MetricCard
            label="Positionen"
            value={data.stats.positions}
            description="nach Produkt gruppiert"
            badge="Liste"
          />

          <MetricCard
            label="Gesamtmenge"
            value={data.stats.portions}
            description="über alle Positionen"
            badge="Menge"
          />

          <MetricCard
            label="Planungstag"
            value={formatDate(data.selectedDate)}
            description="aktuell ausgewählter Tag"
            badge="Datum"
          />
        </MetricGrid>

        <div className="operationsWorkspaceGrid">
          <PageSection
            className="operationsPrimarySection"
            eyebrow="Produktionsliste"
            title="Zu produzieren"
            description="Gleiche Produkte werden automatisch zusammengefasst. Die Auftragsnummern zeigen, woher die Mengen stammen."
            actions={
              <form className="operationsDateFilter" method="get">
                <label>
                  <span>Planungstag</span>
                  <input
                    type="date"
                    name="date"
                    defaultValue={data.selectedDate}
                  />
                </label>

                <button
                  className="g-ops-button g-ops-button--secondary"
                  type="submit"
                >
                  Anzeigen
                </button>
              </form>
            }
          >
            {data.productionItems.length === 0 ? (
              <div className="operationsEmptyState">
                <span className="operationsEmptyIcon" aria-hidden="true">
                  0
                </span>

                <div>
                  <strong>Keine Produktionspositionen gefunden</strong>
                  <p>
                    Für den ausgewählten Tag sind noch keine passenden
                    operativen Aufträge vorhanden.
                  </p>
                </div>
              </div>
            ) : (
              <div className="operationsTable" role="table">
                <div
                  className="operationsTableHead operationsProductionColumns"
                  role="row"
                >
                  <span role="columnheader">Produkt</span>
                  <span role="columnheader">Menge</span>
                  <span role="columnheader">Einheit</span>
                  <span role="columnheader">Aufträge</span>
                  <span role="columnheader">Status</span>
                </div>

                {data.productionItems.map((item: any) => (
                  <div
                    className="operationsTableRow operationsProductionColumns"
                    role="row"
                    key={`${item.name}-${item.unit}`}
                  >
                    <div data-label="Produkt" role="cell">
                      <strong>{item.name}</strong>
                    </div>

                    <div data-label="Menge" role="cell">
                      <strong className="operationsQuantity">
                        {item.quantity}
                      </strong>
                    </div>

                    <div data-label="Einheit" role="cell">
                      {item.unit}
                    </div>

                    <div data-label="Aufträge" role="cell">
                      <span className="operationsOrderReferences">
                        {item.orders.slice(0, 3).join(", ")}
                        {item.orders.length > 3
                          ? ` +${item.orders.length - 3}`
                          : ""}
                      </span>
                    </div>

                    <div data-label="Status" role="cell">
                      <span className="operationsStatus is-open">
                        Offen
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PageSection>

          <PageSection
            className="operationsSecondarySection"
            eyebrow="Auftragsbasis"
            title="Verwendete Aufträge"
            description="Diese Aufträge bilden die Grundlage der Produktionsmengen."
          >
            {data.orders.length === 0 ? (
              <div className="operationsCompactEmpty">
                <strong>Keine Aufträge</strong>
                <span>Für diesen Tag wurde keine Auftragsbasis gefunden.</span>
              </div>
            ) : (
              <div className="operationsOrderList">
                {data.orders.map((order: any) => (
                  <article className="operationsOrderCard" key={order.id}>
                    <div>
                      <strong>{order.customerName || "Ohne Kunde"}</strong>
                      <span>
                        {formatDate(order.deliveryDate)} ·{" "}
                        {orderSummary(order)}
                      </span>
                    </div>

                    <time>{order.deliveryTime || "-"}</time>
                  </article>
                ))}
              </div>
            )}
          </PageSection>
        </div>
      </PageShell>
    </AppLayout>
  );
}
