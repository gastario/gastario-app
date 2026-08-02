import {
  Form,
  Link,
  redirect,
  useActionData,
  useFetcher,
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

const PACKING_STATUSES = new Set([
  "PACKING_OPEN",
  "DELIVERED",
]);

const PACKING_TASKS = [
  {
    key: "goods-complete",
    label: "Ware vollständig gepackt",
  },
  {
    key: "delivery-note",
    label: "Lieferschein beigelegt",
  },
  {
    key: "cutlery",
    label: "Besteck / Servietten geprüft",
  },
  {
    key: "equipment",
    label: "Equipment gezählt",
  },
];

type OperationalAreaCode =
  | "REVIEW"
  | "KITCHEN"
  | "PACKING"
  | "LOGISTICS"
  | "NON_OPERATIONAL";

function effectiveOperationalArea(
  item: any
): OperationalAreaCode {
  const value = String(
    item?.operationalArea ||
      item?.product?.operationalArea ||
      "REVIEW"
  ).toUpperCase();

  if (
    value === "KITCHEN" ||
    value === "PACKING" ||
    value === "LOGISTICS" ||
    value === "NON_OPERATIONAL"
  ) {
    return value;
  }

  return "REVIEW";
}

function effectiveOperationalName(
  item: any
) {
  return String(
    item?.product?.name ||
      item?.name ||
      "Position"
  ).trim();
}

function effectiveOperationalQuantity(
  item: any
) {
  const override =
    item?.operationalQuantity;

  if (
    override !== null &&
    override !== undefined &&
    Number.isFinite(Number(override))
  ) {
    return Number(override);
  }

  return Number(
    item?.quantity || 0
  );
}

function effectiveOperationalUnit(
  item: any
) {
  return String(
    item?.operationalUnit ||
      item?.product?.unit ||
      item?.unit ||
      "Stück"
  ).trim();
}

function isPackableItem(
  item: any
) {
  const area =
    effectiveOperationalArea(item);

  return (
    area === "KITCHEN" ||
    area === "PACKING"
  );
}

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

function checklistObject(
  value: unknown
): Record<string, boolean> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      value as Record<string, unknown>
    ).map(([key, checked]) => [
      key,
      Boolean(checked),
    ])
  );
}

function expectedCheckKeys(
  order: any
) {
  return [
    ...(order.items || [])
      .filter(isPackableItem)
      .map(
        (item: any) =>
          `item:${item.id}`
      ),
    ...PACKING_TASKS.map(
      (task) =>
        `task:${task.key}`
    ),
  ];
}

function packingStatusLabel(
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
    return "Packen";
  }

  if (status === "IN_PRODUCTION") {
    return "Produktion";
  }

  return "Bestätigt";
}

function packingStatusClass(
  order: any
) {
  const status = String(
    order.status || ""
  ).toUpperCase();

  if (
    order.packingCompletedAt ||
    status === "DELIVERED"
  ) {
    return "is-ready";
  }

  if (status === "PACKING_OPEN") {
    return "is-packing";
  }

  if (status === "IN_PRODUCTION") {
    return "is-production";
  }

  return "is-open";
}

function emptyData(
  error: string | null = null
) {
  return {
    tenantName: "Gastario",
    selectedDate: todayInput(),
    availableDates: [] as string[],
    orders: [] as any[],
    packingItems: [] as any[],
    stats: {
      orders: 0,
      positions: 0,
      pieces: 0,
      ready: 0,
    },
    error,
  };
}

export function meta() {
  return [
    {
      title: "Packlisten · Gastario",
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
          items: {
            include: {
              product: true,
            },
          },
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

        const packingOrders =
      orders.filter((order: any) => {
        const status = String(
          order.status || ""
        ).toUpperCase();

        return (
          PACKING_STATUSES.has(status) ||
          Boolean(order.packingStartedAt) ||
          Boolean(order.packingCompletedAt)
        );
      });

    const availableDates =
      Array.from(
        new Set(
          packingOrders
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
      packingOrders.filter(
        (order: any) =>
          normalizeDate(
            order.deliveryDate
          ) === selectedDate
      );

    const packingItems =
      relevantOrders.map(
        (order: any) => {
          const checklist =
            checklistObject(
              order.packingChecklist
            );

          const unresolvedItems =
            (order.items || []).filter(
              (item: any) =>
                effectiveOperationalArea(
                  item
                ) === "REVIEW"
            );

          const items =
            (order.items || [])
              .filter(isPackableItem)
              .map(
                (item: any) => {
                  const checkKey =
                    `item:${item.id}`;

                  return {
                    ...item,
                    name:
                      effectiveOperationalName(
                        item
                      ),
                    quantity:
                      effectiveOperationalQuantity(
                        item
                      ),
                    unit:
                      effectiveOperationalUnit(
                        item
                      ),
                    operationalArea:
                      effectiveOperationalArea(
                        item
                      ),
                    checkKey,
                    checked:
                      Boolean(
                        checklist[
                          checkKey
                        ]
                      ),
                  };
                }
              );

          const logisticsItems =
            (order.items || [])
              .filter(
                (item: any) =>
                  effectiveOperationalArea(
                    item
                  ) === "LOGISTICS"
              )
              .map(
                (item: any) => ({
                  ...item,
                  name:
                    effectiveOperationalName(
                      item
                    ),
                  quantity:
                    effectiveOperationalQuantity(
                      item
                    ),
                  unit:
                    effectiveOperationalUnit(
                      item
                    ),
                })
              );

          const tasks =
            PACKING_TASKS.map(
              (task) => {
                const checkKey =
                  `task:${task.key}`;

                return {
                  ...task,
                  checkKey,
                  checked:
                    Boolean(
                      checklist[
                        checkKey
                      ]
                    ),
                };
              }
            );

          const totalChecks =
            items.length +
            tasks.length;

          const checkedCount = [
            ...items,
            ...tasks,
          ].filter(
            (entry) =>
              entry.checked
          ).length;

          const status = String(
            order.status || ""
          ).toUpperCase();

          const isPacked =
            Boolean(
              order.packingCompletedAt
            ) ||
            status ===
              "DELIVERED";

          const packingStarted =
            status ===
              "PACKING_OPEN" ||
            Boolean(
              order.packingStartedAt
            );

          return {
            id: order.id,
            orderNumber:
              order.orderNumber ||
              order.id,
            customerName:
              order.customerName ||
              "Ohne Kunde",
            deliveryDate:
              order.deliveryDate,
            deliveryTime:
              order.deliveryTimeText,
            deliveryAddress:
              order.deliveryAddress,
            contactName:
              order.contactName,
            contactPhone:
              order.contactPhone,
            status,
            productionStartedAt:
              order.productionStartedAt,
            productionCompletedAt:
              order.productionCompletedAt,
            packingStartedAt:
              order.packingStartedAt,
            packingCompletedAt:
              order.packingCompletedAt,
            items,
            tasks,
            logisticsItems,
            unresolvedItems,
            totalQuantity:
              items.reduce(
                (
                  sum: number,
                  item: any
                ) =>
                  sum +
                  Number(
                    item.quantity ||
                      0
                  ),
                0
              ),
            totalChecks,
            checkedCount,
            progress:
              totalChecks > 0
                ? Math.round(
                    checkedCount /
                      totalChecks *
                      100
                  )
                : 0,
            packingStarted,
            isPacked,
            canCheck:
              packingStarted &&
              !isPacked &&
              status !==
                "DELIVERED" &&
              unresolvedItems.length === 0,
            canComplete:
              packingStarted &&
              !isPacked &&
              totalChecks > 0 &&
              checkedCount ===
                totalChecks &&
              unresolvedItems.length === 0,
          };
        }
      );

    const pieces =
      packingItems.reduce(
        (
          sum: number,
          order: any
        ) =>
          sum +
          Number(
            order.totalQuantity ||
              0
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
      packingItems,
      stats: {
        orders:
          relevantOrders.length,
        positions:
          packingItems.reduce(
            (
              sum: number,
              order: any
            ) =>
              sum +
              Number(
                order.items.length ||
                  0
              ),
            0
          ),
        pieces,
        ready:
          packingItems.filter(
            (order: any) =>
              order.isPacked
          ).length,
      },
      error: null,
    };
  } catch (error: any) {
    console.error(
      "Packlisten loader error:",
      error
    );

    return emptyData(
      error?.message ||
        "Packlisten konnten nicht geladen werden."
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
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

  if (!order) {
    return {
      error:
        "Der Auftrag wurde nicht gefunden.",
    };
  }

  const unresolvedOperationalItems =
    (order.items || []).filter(
      (item: any) =>
        effectiveOperationalArea(
          item
        ) === "REVIEW"
    );

  if (
    unresolvedOperationalItems.length >
      0 &&
    (
      intent === "start-packing" ||
      intent === "complete-packing"
    )
  ) {
    return {
      error:
        `${unresolvedOperationalItems.length} Position(en) müssen zuerst operativ zugeordnet werden.`,
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
    "start-packing"
  ) {
    if (
      order.status ===
      "DELIVERED"
    ) {
      return {
        error:
          "Gelieferte Aufträge können nicht erneut gepackt werden.",
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
          order.productionCompletedAt ||
          now,
        packingStartedAt:
          order.packingStartedAt ||
          now,
        packingCompletedAt:
          null,
      },
    });

    return redirect(
      `/packlisten?date=${encodeURIComponent(
        returnDate
      )}`
    );
  }

  if (
    intent ===
    "toggle-check"
  ) {
    if (
      order.status ===
        "DELIVERED" ||
      order.packingCompletedAt
    ) {
      return {
        error:
          "Die abgeschlossene Packliste ist schreibgeschützt.",
      };
    }

    const checkKey = String(
      formData.get("checkKey") ||
        ""
    );

    const checked =
      String(
        formData.get("checked") ||
          ""
      ) === "true";

    const allowedKeys =
      new Set(
        expectedCheckKeys(
          order
        )
      );

    if (
      !allowedKeys.has(
        checkKey
      )
    ) {
      return {
        error:
          "Der Packlistenpunkt wurde nicht erkannt.",
      };
    }

    const nextChecklist = {
      ...checklistObject(
        order.packingChecklist
      ),
      [checkKey]:
        checked,
    };

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
          order.productionCompletedAt ||
          now,
        packingStartedAt:
          order.packingStartedAt ||
          now,
        packingChecklist:
          nextChecklist,
      },
    });

    return {
      ok: true,
    };
  }

  if (
    intent ===
    "complete-packing"
  ) {
    const checklist =
      checklistObject(
        order.packingChecklist
      );

    const expectedKeys =
      expectedCheckKeys(
        order
      );

    const allChecked =
      expectedKeys.length > 0 &&
      expectedKeys.every(
        (key) =>
          checklist[key] ===
          true
      );

    if (!allChecked) {
      return {
        error:
          "Bitte zuerst alle Positionen und Packkontrollen abhaken.",
      };
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status:
          "PACKING_OPEN",
        packingStartedAt:
          order.packingStartedAt ||
          now,
        packingCompletedAt:
          now,
      },
    });

    return redirect(
      `/packlisten?date=${encodeURIComponent(
        returnDate
      )}`
    );
  }

  if (
    intent ===
    "reopen-packing"
  ) {
    if (
      order.status ===
      "DELIVERED"
    ) {
      return {
        error:
          "Gelieferte Aufträge können nicht wieder geöffnet werden.",
      };
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status:
          "PACKING_OPEN",
        packingCompletedAt:
          null,
      },
    });

    return redirect(
      `/packlisten?date=${encodeURIComponent(
        returnDate
      )}`
    );
  }

  return {
    error:
      "Die Packlistenaktion ist unbekannt.",
  };
}

type PackingCheckboxProps = {
  orderId: string;
  checkKey: string;
  initialChecked: boolean;
  disabled: boolean;
  selectedDate: string;
  label: string;
};

function PackingCheckbox({
  orderId,
  checkKey,
  initialChecked,
  disabled,
  selectedDate,
  label,
}: PackingCheckboxProps) {
  const fetcher =
    useFetcher<
      typeof action
    >();

  const submittedValue =
    fetcher.formData?.get(
      "checked"
    );

  const checked =
    submittedValue === null ||
    submittedValue ===
      undefined
      ? initialChecked
      : submittedValue ===
        "true";

  const busy =
    fetcher.state !== "idle";

  return (
    <input
      className="packingCheckbox"
      type="checkbox"
      checked={checked}
      disabled={
        disabled || busy
      }
      aria-label={label}
      onChange={() => {
        fetcher.submit(
          {
            intent:
              "toggle-check",
            orderId,
            checkKey,
            checked:
              String(!checked),
            date: selectedDate,
          },
          {
            method: "post",
          }
        );
      }}
    />
  );
}

export default function PackingListsPage() {
  const data =
    useLoaderData<typeof loader>();

  const actionData =
    useActionData<
      typeof action
    >() as any;

  return (
    <AppLayout>
      <PageShell className="operationsMasterPage packingMasterPage">
        <PageHeader
          eyebrow="Betrieb"
          title="Packlisten"
          subtitle={
            <>
              {data.tenantName}
              {" · "}
                            Aufträge erscheinen hier automatisch,
              sobald sie aus der Produktion an
              die Packstation übergeben wurden.
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
                to="/lieferungen"
              >
                Zu Lieferungen
              </Link>
            </>
          }
        />

        {data.error ? (
          <Notice type="danger">
            <strong>
              Die Packlisten konnten
              nicht vollständig geladen
              werden.
            </strong>

            <span>{data.error}</span>
          </Notice>
        ) : null}

        {actionData?.error ? (
          <Notice type="danger">
            <strong>
              Packlistenaktion konnte
              nicht ausgeführt werden.
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
            label="Positionen"
            value={
              data.stats.positions
            }
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
            label="Lieferbereit"
            value={data.stats.ready}
            description="vollständig gepackte Aufträge"
            badge="Fertig"
          />
        </MetricGrid>

        <PageSection
          className="operationsPrimarySection packingOrdersSection"
          eyebrow="Packlisten"
          title="Nach Auftrag"
          description="Positionen und Zusatzkontrollen werden zentral gespeichert und sind für alle Mitarbeiter identisch sichtbar."
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
          {data.packingItems
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
                  Keine Packlisten
                  gefunden
                </strong>

                <p>
                                    Für den ausgewählten
                  Tag wurden noch keine
                  Aufträge an die
                  Packstation übergeben.
                </p>
              </div>
            </div>
          ) : (
            <div className="packingOrderList">
              {data.packingItems.map(
                (order: any) => (
                  <article
                    className={
                      "packingOrderCard " +
                      (
                        order.isPacked
                          ? "is-packed"
                          : ""
                      )
                    }
                    key={order.id}
                  >
                    <header className="packingOrderHeader">
                      <div className="packingOrderTime">
                        <strong>
                          {order.deliveryTime ||
                            "-"}
                        </strong>

                        <span>Uhr</span>
                      </div>

                      <div className="packingOrderIdentity">
                        <p>
                          Auftrag{" "}
                          {order.orderNumber}
                        </p>

                        <h3>
                          {order.customerName}
                        </h3>

                        <span>
                          {formatDate(
                            order.deliveryDate
                          )}
                          {" · "}
                          {order.deliveryAddress ||
                            "Keine Adresse"}
                        </span>
                      </div>

                      <span
                        className={
                          `operationsStatus ${packingStatusClass(
                            order
                          )}`
                        }
                      >
                        {packingStatusLabel(
                          order
                        )}
                      </span>
                    </header>

                    <div className="packingOrderMeta">
                      <div>
                        <span>
                          Kontakt
                        </span>

                        <strong>
                          {order.contactName ||
                            "-"}
                          {" · "}
                          {order.contactPhone ||
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Lieferadresse
                        </span>

                        <strong>
                          {order.deliveryAddress ||
                            "Keine Adresse eingetragen"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Gesamtmenge
                        </span>

                        <strong>
                          {order.totalQuantity}
                        </strong>
                      </div>
                    </div>

                    {order.unresolvedItems.length > 0 ? (
                      <div className="packingOperationalWarning">
                        <div>
                          <strong>
                            Operative Zuordnung fehlt
                          </strong>
                          <span>
                            {order.unresolvedItems.length} Position(en)
                            müssen vor dem Packstart geprüft werden.
                          </span>
                        </div>

                        <Link
                          to={`/auftrag-pruefung/${order.id}`}
                          className="g-ops-button g-ops-button--secondary g-ops-button--compact"
                        >
                          Zuordnungen prüfen
                        </Link>
                      </div>
                    ) : null}

                    {order.logisticsItems.length > 0 ? (
                      <div className="packingLogisticsInfo">
                        <strong>
                          Logistik
                        </strong>
                        <span>
                          {order.logisticsItems
                            .map(
                              (item: any) =>
                                `${item.quantity} × ${item.name}`
                            )
                            .join(", ")}
                        </span>
                      </div>
                    ) : null}

                    {!order.packingStarted &&
                    !order.isPacked ? (
                      <div className="packingStartPanel">
                        <div>
                          <strong>
                            Packliste ist
                            vorbereitet
                          </strong>

                          <span>
                            Starte den Packvorgang,
                            damit alle Häkchen
                            zentral gespeichert
                            werden.
                          </span>
                        </div>

                        {order.unresolvedItems.length > 0 ? (
                          <Link
                            to={`/auftrag-pruefung/${order.id}`}
                            className="g-ops-button g-ops-button--secondary"
                          >
                            Erst Zuordnung prüfen
                          </Link>
                        ) : (
                          <Form
                            method="post"
                            className="operationsInlineForm"
                          >
                            <input
                              type="hidden"
                              name="intent"
                              value="start-packing"
                            />

                            <input
                              type="hidden"
                              name="orderId"
                              value={order.id}
                            />

                            <input
                              type="hidden"
                              name="date"
                              value={
                                data.selectedDate
                              }
                            />

                            <button
                              type="submit"
                              className="g-ops-button g-ops-button--primary"
                            >
                              Packen starten
                            </button>
                          </Form>
                        )}
                      </div>
                    ) : null}

                    <div
                      className={
                        "packingItemsList " +
                        (
                          !order.canCheck
                            ? "is-readonly"
                            : ""
                        )
                      }
                    >
                      {order.items
                        .length === 0 ? (
                        <div className="operationsCompactEmpty">
                          <strong>
                            Keine Positionen
                          </strong>

                          <span>
                            Dieser Auftrag
                            hat keine
                            Positionen.
                          </span>
                        </div>
                      ) : (
                        order.items.map(
                          (item: any) => (
                            <label
                              className="packingItemRow"
                              key={
                                item.checkKey
                              }
                            >
                              <PackingCheckbox
                                orderId={
                                  order.id
                                }
                                checkKey={
                                  item.checkKey
                                }
                                initialChecked={
                                  item.checked
                                }
                                disabled={
                                  !order.canCheck
                                }
                                selectedDate={
                                  data.selectedDate
                                }
                                label={`${item.name || "Position"} gepackt`}
                              />

                              <span className="packingItemName">
                                <strong>
                                  {item.name ||
                                    "Position"}
                                </strong>

                                <small>
                                  {item.unit ||
                                    "Stück"}
                                  {" · "}
                                  {item.operationalArea ===
                                  "PACKING"
                                    ? "Equipment"
                                    : "Küche"}
                                </small>
                              </span>

                              <span className="packingItemQuantity">
                                {item.quantity ||
                                  0}
                                {" ×"}
                              </span>
                            </label>
                          )
                        )
                      )}
                    </div>

                    <div
                      className={
                        "packingTaskGrid " +
                        (
                          !order.canCheck
                            ? "is-readonly"
                            : ""
                        )
                      }
                    >
                      {order.tasks.map(
                        (task: any) => (
                          <label
                            className="packingTaskCard"
                            key={
                              task.checkKey
                            }
                          >
                            <PackingCheckbox
                              orderId={
                                order.id
                              }
                              checkKey={
                                task.checkKey
                              }
                              initialChecked={
                                task.checked
                              }
                              disabled={
                                !order.canCheck
                              }
                              selectedDate={
                                data.selectedDate
                              }
                              label={
                                task.label
                              }
                            />

                            <span>
                              {task.label}
                            </span>
                          </label>
                        )
                      )}
                    </div>

                    <footer className="packingWorkflowFooter">
                      <div className="packingProgress">
                        <div>
                          <strong>
                            {order.checkedCount}
                            {" / "}
                            {order.totalChecks}
                          </strong>

                          <span>
                            Prüfungen erledigt
                          </span>
                        </div>

                        <div className="packingProgressTrack">
                          <span
                            style={{
                              width:
                                `${order.progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="packingActionArea">
                        {order.isPacked ? (
                          <>
                            <span className="operationsStatus is-ready">
                              Lieferbereit
                            </span>

                            {order.status !==
                            "DELIVERED" ? (
                              <Form
                                method="post"
                                className="operationsInlineForm"
                              >
                                <input
                                  type="hidden"
                                  name="intent"
                                  value="reopen-packing"
                                />

                                <input
                                  type="hidden"
                                  name="orderId"
                                  value={order.id}
                                />

                                <input
                                  type="hidden"
                                  name="date"
                                  value={
                                    data.selectedDate
                                  }
                                />

                                <button
                                  type="submit"
                                  className="g-ops-button g-ops-button--secondary g-ops-button--compact"
                                >
                                  Wieder öffnen
                                </button>
                              </Form>
                            ) : null}

                            <Link
                              to={`/lieferungen?range=date&date=${encodeURIComponent(
                                data.selectedDate
                              )}`}
                              className="g-ops-button g-ops-button--primary g-ops-button--compact"
                            >
                              Zur Lieferung
                            </Link>
                          </>
                        ) : order.packingStarted ? (
                          <Form
                            method="post"
                            className="operationsInlineForm"
                          >
                            <input
                              type="hidden"
                              name="intent"
                              value="complete-packing"
                            />

                            <input
                              type="hidden"
                              name="orderId"
                              value={order.id}
                            />

                            <input
                              type="hidden"
                              name="date"
                              value={
                                data.selectedDate
                              }
                            />

                            <button
                              type="submit"
                              className="g-ops-button g-ops-button--primary"
                              disabled={
                                !order.canComplete
                              }
                            >
                              Als lieferbereit markieren
                            </button>
                          </Form>
                        ) : null}
                      </div>
                    </footer>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}
