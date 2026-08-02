import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";

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

const OPERATIONAL_STATUSES = new Set([
  "CONFIRMED",
  "IN_PRODUCTION",
  "PACKING_OPEN",
  "DELIVERED",
]);

function todayInput() {
  const now = new Date();

  const localDate = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60_000
  );

  return localDate
    .toISOString()
    .slice(0, 10);
}

function normalizeDate(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "";
  }

  try {
    return new Date(value)
      .toISOString()
      .slice(0, 10);
  } catch {
    return "";
  }
}

function formatDate(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "-";
  }

  try {
    return new Date(value).toLocaleDateString(
      "de-DE"
    );
  } catch {
    return "-";
  }
}

function selectedPlanningDate(
  requestedDate: string | null,
  availableDates: string[]
) {
  if (requestedDate) {
    return requestedDate;
  }

  const today = todayInput();

  if (availableDates.includes(today)) {
    return today;
  }

  return (
    availableDates.find(
      (date) => date >= today
    ) ||
    availableDates[0] ||
    today
  );
}

function emptyData(
  error: string | null = null
) {
  return {
    tenantName: "Gastario",
    selectedDate: todayInput(),
    availableDates: [] as string[],
    orders: [] as any[],
    productionItems: [] as any[],
    stats: {
      orders: 0,
      positions: 0,
      portions: 0,
      confirmed: 0,
      inProduction: 0,
      packingOpen: 0,
    },
    error,
  };
}

function orderSummary(order: any) {
  if (
    !order.items ||
    order.items.length === 0
  ) {
    return "Keine Positionen";
  }

  return order.items
    .map(
      (item: any) =>
        `${item.quantity || 0} × ${
          item.name || "Position"
        }`
    )
    .join(", ");
}

function orderStatusLabel(
  order: any
) {
  const status = String(
    order.status || ""
  ).toUpperCase();

  if (
    order.packingCompletedAt ||
    status === "DELIVERED"
  ) {
    return "Lieferbereit";
  }

  if (status === "PACKING_OPEN") {
    return "An Packstation";
  }

  if (status === "IN_PRODUCTION") {
    return "In Produktion";
  }

  return "Bestätigt";
}

function groupedStatus(
  statuses: Set<string>
) {
  if (statuses.has("CONFIRMED")) {
    return {
      label: "Offen",
      className: "is-open",
    };
  }

  if (statuses.has("IN_PRODUCTION")) {
    return {
      label: "In Produktion",
      className: "is-production",
    };
  }

  if (statuses.has("PACKING_OPEN")) {
    return {
      label: "An Packstation",
      className: "is-packing",
    };
  }

  return {
    label: "Abgeschlossen",
    className: "is-ready",
  };
}

export function meta() {
  return [
    {
      title: "Produktion · Gastario",
    },
  ];
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  try {
    const { prisma } =
      await import(
        "../lib/prisma.server"
      );

    const { getTenantAccess } =
      await import(
        "../lib/features.server"
      );

    const access =
      await getTenantAccess(request);

    if (!access?.tenantId) {
      return emptyData(
        "Kein Mandant gefunden."
      );
    }

    const url = new URL(request.url);

    const orders =
      await prisma.order.findMany({
        where: {
          tenantId: access.tenantId,
        },
        include: {
          items: true,
        },
        orderBy: [
          {
            deliveryDate: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
        take: 500,
      });

    const operationalOrders =
      orders.filter((order: any) =>
        OPERATIONAL_STATUSES.has(
          String(
            order.status || ""
          ).toUpperCase()
        )
      );

    const availableDates =
      Array.from(
        new Set(
          operationalOrders
            .map((order: any) =>
              normalizeDate(
                order.deliveryDate
              )
            )
            .filter(Boolean)
        )
      ).sort();

    const selectedDate =
      selectedPlanningDate(
        url.searchParams.get("date"),
        availableDates
      );

    const relevantOrders =
      operationalOrders.filter(
        (order: any) =>
          normalizeDate(
            order.deliveryDate
          ) === selectedDate
      );

    const grouped =
      new Map<string, any>();

    for (
      const order of relevantOrders as any[]
    ) {
      const orderStatus = String(
        order.status || ""
      ).toUpperCase();

      for (
        const item of order.items || []
      ) {
        const name = String(
          item.name || "Position"
        );

        const unit = String(
          item.unit || "Stück"
        );

        const key =
          `${name}__${unit}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            name,
            unit,
            quantity: 0,
            orders: [] as string[],
            statuses:
              new Set<string>(),
          });
        }

        const row = grouped.get(key);

        row.quantity += Number(
          item.quantity || 0
        );

        row.orders.push(
          order.orderNumber ||
            order.id
        );

        row.statuses.add(
          orderStatus
        );
      }
    }

    const productionItems =
      Array.from(
        grouped.values()
      )
        .map((item: any) => {
          const status =
            groupedStatus(
              item.statuses
            );

          return {
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            orders: Array.from(
              new Set(item.orders)
            ),
            statusLabel:
              status.label,
            statusClassName:
              status.className,
          };
        })
        .sort((left, right) =>
          left.name.localeCompare(
            right.name,
            "de"
          )
        );

    const portions =
      productionItems.reduce(
        (
          sum: number,
          item: any
        ) =>
          sum +
          Number(
            item.quantity || 0
          ),
        0
      );

    return {
      tenantName:
        access.tenant?.name ||
        "Gastario",
      selectedDate,
      availableDates,
      orders: relevantOrders,
      productionItems,
      stats: {
        orders:
          relevantOrders.length,
        positions:
          productionItems.length,
        portions,
        confirmed:
          relevantOrders.filter(
            (order: any) =>
              order.status ===
              "CONFIRMED"
          ).length,
        inProduction:
          relevantOrders.filter(
            (order: any) =>
              order.status ===
              "IN_PRODUCTION"
          ).length,
        packingOpen:
          relevantOrders.filter(
            (order: any) =>
              order.status ===
                "PACKING_OPEN" ||
              Boolean(
                order.packingCompletedAt
              )
          ).length,
      },
      error: null,
    };
  } catch (error: any) {
    console.error(
      "Produktion loader error:",
      error
    );

    return emptyData(
      error?.message ||
        "Produktion konnte nicht geladen werden."
    );
  }
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import(
      "../lib/prisma.server"
    );

  const { getTenantAccess } =
    await import(
      "../lib/features.server"
    );

  const access =
    await getTenantAccess(request);

  if (!access?.tenantId) {
    return {
      error:
        "Kein Mandant gefunden.",
    };
  }

  const formData =
    await request.formData();

  const intent = String(
    formData.get("intent") || ""
  );

  const orderId = String(
    formData.get("orderId") || ""
  );

  const requestedDate = String(
    formData.get("date") || ""
  );

  if (!orderId) {
    return {
      error:
        "Der Auftrag wurde nicht erkannt.",
    };
  }

  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: access.tenantId,
      },
    });

  if (!order) {
    return {
      error:
        "Der Auftrag wurde nicht gefunden.",
    };
  }

  const returnDate =
    requestedDate ||
    normalizeDate(
      order.deliveryDate
    ) ||
    todayInput();

  const now = new Date();

  if (
    intent ===
    "start-production"
  ) {
    if (
      order.status !==
      "CONFIRMED"
    ) {
      return redirect(
        `/produktion?date=${encodeURIComponent(
          returnDate
        )}`
      );
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status:
          "IN_PRODUCTION",
        productionStartedAt:
          order.productionStartedAt ||
          now,
      },
    });

    return redirect(
      `/produktion?date=${encodeURIComponent(
        returnDate
      )}`
    );
  }

  if (
    intent ===
    "complete-production"
  ) {
    if (
      order.status !==
      "IN_PRODUCTION"
    ) {
      return {
        error:
          "Nur Aufträge in Produktion können an die Packstation übergeben werden.",
      };
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status:
          "PACKING_OPEN",
        productionStartedAt:
          order.productionStartedAt ||
          now,
        productionCompletedAt:
          now,
        packingStartedAt:
          order.packingStartedAt ||
          now,
        packingCompletedAt:
          null,
      },
    });

    return redirect(
      `/produktion?date=${encodeURIComponent(
        returnDate
      )}`
    );
  }

  return {
    error:
      "Die Produktionsaktion ist unbekannt.",
  };
}

export default function ProductionPage() {
  const data =
    useLoaderData<typeof loader>();

  const actionData =
    useActionData<
      typeof action
    >() as any;

  return (
    <AppLayout>
      <PageShell className="operationsMasterPage productionMasterPage">
        <PageHeader
          eyebrow="Betrieb"
          title="Produktion"
          subtitle={
            <>
              {data.tenantName}
              {" · "}
              Bestätigte Aufträge werden
              automatisch nach Planungstag
              zusammengefasst.
            </>
          }
          actions={
            <>
              <button
                className="g-ops-button g-ops-button--secondary"
                type="button"
                onClick={() =>
                  window.print()
                }
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
            <strong>
              Die Produktionsdaten
              konnten nicht vollständig
              geladen werden.
            </strong>

            <span>{data.error}</span>
          </Notice>
        ) : null}

        {actionData?.error ? (
          <Notice type="danger">
            <strong>
              Aktion konnte nicht
              ausgeführt werden.
            </strong>

            <span>
              {actionData.error}
            </span>
          </Notice>
        ) : null}

        <MetricGrid className="operationsMetricGrid">
          <MetricCard
            label="Aufträge"
            value={data.stats.orders}
            description="für diesen Planungstag"
            badge="Automatisch"
          />

          <MetricCard
            label="Noch offen"
            value={data.stats.confirmed}
            description="Produktion noch nicht gestartet"
            badge="Start"
            attention={
              data.stats.confirmed > 0
            }
          />

          <MetricCard
            label="In Produktion"
            value={
              data.stats.inProduction
            }
            description="aktuell in Bearbeitung"
            badge="Küche"
          />

          <MetricCard
            label="An Packstation"
            value={
              data.stats.packingOpen
            }
            description="Produktion abgeschlossen"
            badge="Weiter"
          />
        </MetricGrid>

        <div className="operationsWorkspaceGrid">
          <PageSection
            className="operationsPrimarySection"
            eyebrow="Produktionsliste"
            title="Zu produzieren"
            description="Gleiche Produkte werden automatisch zusammengefasst. Die Auftragsnummern zeigen, woher die Mengen stammen."
            actions={
              <form
                className="operationsDateFilter"
                method="get"
              >
                <label>
                  <span>
                    Planungstag
                  </span>

                  <select
                    name="date"
                    defaultValue={
                      data.selectedDate
                    }
                  >
                    {data.availableDates
                      .length > 0 ? (
                      data.availableDates.map(
                        (date: string) => (
                          <option
                            key={date}
                            value={date}
                          >
                            {formatDate(
                              date
                            )}
                          </option>
                        )
                      )
                    ) : (
                      <option
                        value={
                          data.selectedDate
                        }
                      >
                        Keine Auftragsdaten
                      </option>
                    )}
                  </select>
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
            {data.productionItems
              .length === 0 ? (
              <div className="operationsEmptyState">
                <span
                  className="operationsEmptyIcon"
                  aria-hidden="true"
                >
                  0
                </span>

                <div>
                  <strong>
                    Keine Produktionspositionen
                    gefunden
                  </strong>

                  <p>
                    Für den ausgewählten Tag
                    sind noch keine bestätigten
                    oder laufenden Aufträge
                    vorhanden.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="operationsTable"
                role="table"
              >
                <div
                  className="operationsTableHead operationsProductionColumns"
                  role="row"
                >
                  <span role="columnheader">
                    Produkt
                  </span>

                  <span role="columnheader">
                    Menge
                  </span>

                  <span role="columnheader">
                    Einheit
                  </span>

                  <span role="columnheader">
                    Aufträge
                  </span>

                  <span role="columnheader">
                    Status
                  </span>
                </div>

                {data.productionItems.map(
                  (item: any) => (
                    <div
                      className="operationsTableRow operationsProductionColumns"
                      role="row"
                      key={`${item.name}-${item.unit}`}
                    >
                      <div
                        data-label="Produkt"
                        role="cell"
                      >
                        <strong>
                          {item.name}
                        </strong>
                      </div>

                      <div
                        data-label="Menge"
                        role="cell"
                      >
                        <strong className="operationsQuantity">
                          {item.quantity}
                        </strong>
                      </div>

                      <div
                        data-label="Einheit"
                        role="cell"
                      >
                        {item.unit}
                      </div>

                      <div
                        data-label="Aufträge"
                        role="cell"
                      >
                        <span className="operationsOrderReferences">
                          {item.orders
                            .slice(0, 3)
                            .join(", ")}

                          {item.orders
                            .length > 3
                            ? ` +${
                                item.orders
                                  .length -
                                3
                              }`
                            : ""}
                        </span>
                      </div>

                      <div
                        data-label="Status"
                        role="cell"
                      >
                        <span
                          className={
                            `operationsStatus ${item.statusClassName}`
                          }
                        >
                          {
                            item.statusLabel
                          }
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </PageSection>

                    <PageSection
            className="operationsSecondarySection productionWorkflowSection"
            eyebrow="Auftragsbasis"
            title="AuftrÃ¤ge im Ablauf"
            description="Jeden Auftrag einzeln von der BestÃ¤tigung bis zur Packstation weiterfÃ¼hren."
          >
            {data.orders.length === 0 ? (
              <div className="operationsCompactEmpty">
                <strong>Keine AuftrÃ¤ge</strong>

                <span>
                  FÃ¼r diesen Tag wurde keine
                  Auftragsbasis gefunden.
                </span>
              </div>
            ) : (
              <div className="productionWorkflowList">
                {data.orders.map(
                  (order: any) => {
                    const status = String(
                      order.status || ""
                    ).toUpperCase();

                    const isReady =
                      Boolean(
                        order.packingCompletedAt
                      ) ||
                      status === "DELIVERED";

                    const statusRank = isReady
                      ? 4
                      : status === "PACKING_OPEN"
                        ? 3
                        : status === "IN_PRODUCTION"
                          ? 2
                          : 1;

                    const statusClassName =
                      isReady
                        ? "is-ready"
                        : status === "PACKING_OPEN"
                          ? "is-packing"
                          : status === "IN_PRODUCTION"
                            ? "is-production"
                            : "is-open";

                    const itemCount =
                      Array.isArray(order.items)
                        ? order.items.length
                        : 0;

                    const totalQuantity =
                      (order.items || []).reduce(
                        (
                          sum: number,
                          item: any
                        ) =>
                          sum +
                          Number(
                            item.quantity || 0
                          ),
                        0
                      );

                    return (
                      <article
                        className={
                          "productionWorkflowCard " +
                          (isReady
                            ? "is-ready"
                            : "")
                        }
                        key={order.id}
                      >
                        <header className="productionWorkflowCardHeader">
                          <div className="productionWorkflowIdentity">
                            <p>
                              Auftrag {order.orderNumber}
                            </p>

                            <h3>
                              {order.customerName ||
                                "Ohne Kunde"}
                            </h3>

                            <span>
                              {itemCount} {itemCount === 1
                                ? "Position"
                                : "Positionen"}
                              {" Â· "}
                              {totalQuantity} Einheiten
                            </span>
                          </div>

                          <time className="productionWorkflowTime">
                            <strong>
                              {order.deliveryTimeText ||
                                "â€“"}
                            </strong>
                            <span>Uhr</span>
                          </time>
                        </header>

                        <div
                          className="productionWorkflowSteps"
                          aria-label="Arbeitsfortschritt"
                        >
                          <div
                            className="productionWorkflowStep"
                            data-state={
                              statusRank > 1
                                ? "done"
                                : "active"
                            }
                          >
                            <span className="productionWorkflowStepIndex">
                              1
                            </span>

                            <div>
                              <strong>BestÃ¤tigt</strong>
                              <small>Auftrag geprÃ¼ft</small>
                            </div>
                          </div>

                          <div
                            className="productionWorkflowStep"
                            data-state={
                              statusRank > 2
                                ? "done"
                                : statusRank === 2
                                  ? "active"
                                  : "pending"
                            }
                          >
                            <span className="productionWorkflowStepIndex">
                              2
                            </span>

                            <div>
                              <strong>Produktion</strong>
                              <small>KÃ¼che arbeitet</small>
                            </div>
                          </div>

                          <div
                            className="productionWorkflowStep"
                            data-state={
                              statusRank > 3
                                ? "done"
                                : statusRank === 3
                                  ? "active"
                                  : "pending"
                            }
                          >
                            <span className="productionWorkflowStepIndex">
                              3
                            </span>

                            <div>
                              <strong>Packstation</strong>
                              <small>Packliste prÃ¼fen</small>
                            </div>
                          </div>
                        </div>

                        <footer className="productionWorkflowFooter">
                          <span
                            className={
                              `operationsStatus ${statusClassName}`
                            }
                          >
                            {orderStatusLabel(order)}
                          </span>

                          <div className="productionWorkflowActions">
                            {status === "CONFIRMED" ? (
                              <Form
                                method="post"
                                className="operationsInlineForm"
                              >
                                <input
                                  type="hidden"
                                  name="intent"
                                  value="start-production"
                                />

                                <input
                                  type="hidden"
                                  name="orderId"
                                  value={order.id}
                                />

                                <input
                                  type="hidden"
                                  name="date"
                                  value={data.selectedDate}
                                />

                                <button
                                  type="submit"
                                  className="g-ops-button g-ops-button--primary g-ops-button--compact"
                                >
                                  Produktion starten
                                </button>
                              </Form>
                            ) : null}

                            {status === "IN_PRODUCTION" ? (
                              <Form
                                method="post"
                                className="operationsInlineForm"
                              >
                                <input
                                  type="hidden"
                                  name="intent"
                                  value="complete-production"
                                />

                                <input
                                  type="hidden"
                                  name="orderId"
                                  value={order.id}
                                />

                                <input
                                  type="hidden"
                                  name="date"
                                  value={data.selectedDate}
                                />

                                <button
                                  type="submit"
                                  className="g-ops-button g-ops-button--primary g-ops-button--compact"
                                >
                                  An Packstation
                                </button>
                              </Form>
                            ) : null}

                            {status === "PACKING_OPEN" ||
                            isReady ? (
                              <Link
                                to={`/packlisten?date=${encodeURIComponent(
                                  data.selectedDate
                                )}`}
                                className="g-ops-button g-ops-button--secondary g-ops-button--compact"
                              >
                                Packliste Ã¶ffnen
                              </Link>
                            ) : null}
                          </div>
                        </footer>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </PageSection>
        </div>
      </PageShell>
    </AppLayout>
  );
}
