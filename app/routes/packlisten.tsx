import { useEffect, useState } from "react";
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
    packingItems: [],
    stats: {
      orders: 0,
      positions: 0,
      pieces: 0,
    },
    error,
  };
}

export function meta() {
  return [{ title: "Packlisten · Gastario" }];
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

    const packingItems = relevantOrders.map((order: any) => ({
      id: order.id,
      orderNumber: order.orderNumber || order.id,
      customerName: order.customerName || "Ohne Kunde",
      deliveryDate: order.deliveryDate,
      deliveryTime: order.deliveryTime,
      deliveryAddress: order.deliveryAddress,
      contactName: order.contactName,
      contactPhone: order.contactPhone || order.customerPhone,
      items: order.items || [],
      totalQuantity: (order.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
    }));

    const pieces = packingItems.reduce((sum: number, item: any) => sum + Number(item.totalQuantity || 0), 0);

    return {
      tenantName: access.tenant?.name || "Gastario",
      selectedDate,
      orders: relevantOrders,
      packingItems,
      stats: {
        orders: relevantOrders.length,
        positions: packingItems.reduce((sum: number, order: any) => sum + Number(order.items.length || 0), 0),
        pieces,
      },
      error: null,
    };
  } catch (error: any) {
    console.error("Packlisten loader error:", error);
    return emptyData(error?.message || "Packlisten konnten nicht geladen werden.");
  }
}

function PackingCheckbox({ id }: { id: string }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const value = window.localStorage.getItem(id);
    setChecked(value === "1");
  }, [id]);

  function toggle() {
    const next = !checked;
    setChecked(next);
    window.localStorage.setItem(id, next ? "1" : "0");
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={toggle}
      style={{
        width: 20,
        height: 20,
        accentColor: "#0f766e",
      }}
    />
  );
}

export default function PackingListsPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PageShell className="operationsMasterPage packingMasterPage">
        <PageHeader
          eyebrow="Betrieb"
          title="Packlisten"
          subtitle={
            <>
              {data.tenantName} · Packlisten nach Auftrag mit dauerhaft
              gespeicherten Pack- und Fahrerchecks.
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
                to="/lieferungen"
              >
                Zu Lieferungen
              </Link>
            </>
          }
        />

        {data.error ? (
          <Notice type="danger">
            <strong>Die Packlisten konnten nicht vollständig geladen werden.</strong>
            <span>{data.error}</span>
          </Notice>
        ) : null}

        <MetricGrid className="operationsMetricGrid">
          <MetricCard
            label="Aufträge"
            value={data.stats.orders}
            description="für diesen Planungstag"
            badge="Packen"
          />

          <MetricCard
            label="Positionen"
            value={data.stats.positions}
            description="in allen Packlisten"
            badge="Liste"
          />

          <MetricCard
            label="Gesamtmenge"
            value={data.stats.pieces}
            description="über alle Positionen"
            badge="Check"
          />

          <MetricCard
            label="Planungstag"
            value={formatDate(data.selectedDate)}
            description="aktuell ausgewählter Tag"
            badge="Datum"
          />
        </MetricGrid>

        <PageSection
          className="operationsPrimarySection packingOrdersSection"
          eyebrow="Packlisten"
          title="Nach Auftrag"
          description="Positionen abhaken und anschließend die vollständige Packkontrolle durchführen."
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
          {data.packingItems.length === 0 ? (
            <div className="operationsEmptyState">
              <span className="operationsEmptyIcon" aria-hidden="true">
                0
              </span>

              <div>
                <strong>Keine Packlisten gefunden</strong>
                <p>
                  Für den ausgewählten Tag sind noch keine passenden
                  operativen Aufträge vorhanden.
                </p>
              </div>
            </div>
          ) : (
            <div className="packingOrderList">
              {data.packingItems.map((order: any) => (
                <article className="packingOrderCard" key={order.id}>
                  <header className="packingOrderHeader">
                    <div className="packingOrderTime">
                      <strong>{order.deliveryTime || "-"}</strong>
                      <span>Uhr</span>
                    </div>

                    <div className="packingOrderIdentity">
                      <p>Auftrag {order.orderNumber}</p>
                      <h3>{order.customerName}</h3>
                      <span>
                        {formatDate(order.deliveryDate)} ·{" "}
                        {order.deliveryAddress || "Keine Adresse"}
                      </span>
                    </div>

                    <span className="operationsStatus is-packing">
                      Packen
                    </span>
                  </header>

                  <div className="packingOrderMeta">
                    <div>
                      <span>Kontakt</span>
                      <strong>
                        {order.contactName || "-"} ·{" "}
                        {order.contactPhone || "-"}
                      </strong>
                    </div>

                    <div>
                      <span>Lieferadresse</span>
                      <strong>
                        {order.deliveryAddress ||
                          "Keine Adresse eingetragen"}
                      </strong>
                    </div>

                    <div>
                      <span>Gesamtmenge</span>
                      <strong>{order.totalQuantity}</strong>
                    </div>
                  </div>

                  <div className="packingItemsList">
                    {order.items.length === 0 ? (
                      <div className="operationsCompactEmpty">
                        <strong>Keine Positionen</strong>
                        <span>Dieser Auftrag hat keine Positionen.</span>
                      </div>
                    ) : (
                      order.items.map((item: any) => (
                        <label
                          className="packingItemRow"
                          key={`${order.id}-${item.id || item.name}`}
                        >
                          <PackingCheckbox
                            id={`pack-${order.id}-${item.id || item.name}`}
                          />

                          <span className="packingItemName">
                            <strong>{item.name || "Position"}</strong>
                            <small>{item.unit || "Stück"}</small>
                          </span>

                          <span className="packingItemQuantity">
                            {item.quantity || 0} ×
                          </span>
                        </label>
                      ))
                    )}
                  </div>

                  <div className="packingTaskGrid">
                    {[
                      "Ware vollständig gepackt",
                      "Lieferschein beigelegt",
                      "Besteck / Servietten geprüft",
                      "Equipment gezählt",
                    ].map((task) => (
                      <label className="packingTaskCard" key={task}>
                        <PackingCheckbox
                          id={`task-${order.id}-${task}`}
                        />
                        <span>{task}</span>
                      </label>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}
