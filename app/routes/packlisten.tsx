import { useState } from "react";

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
  GastarioBadge,
  GastarioButton,
  GastarioCheckRow,
  GastarioDataList,
  GastarioDataRow,
  GastarioDialog,
  GastarioTabs,
  GastarioEmptyState,
  GastarioField,
  GastarioFilterBar,
  GastarioHeader,
  GastarioMetric,
  GastarioMetricGrid,
  GastarioNotice,
  GastarioPage,
  GastarioSection,
  GastarioSelect,
  GastarioToolbar,
  gastarioButtonClass,
} from "../components/ui";

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
    if (
      order.status !== "PACKING_OPEN" ||
      order.packingCompletedAt
    ) {
      return {
        error:
          "Nur eine aktive Packliste kann als lieferbereit abgeschlossen werden.",
      };
    }
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
  description?: string;
};

function PackingCheckbox({
  orderId,
  checkKey,
  initialChecked,
  disabled,
  selectedDate,
  label,
  description,
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
    submittedValue === undefined
      ? initialChecked
      : submittedValue === "true";

  const busy =
    fetcher.state !== "idle";

  return (
    <GastarioCheckRow
      title={label}
      description={description}
      checked={checked}
      disabled={
        disabled ||
        busy
      }
      onCheckedChange={(
        nextChecked
      ) => {
        fetcher.submit(
          {
            intent:
              "toggle-check",
            orderId,
            checkKey,
            checked:
              String(nextChecked),
            date:
              selectedDate,
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

  const [
    selectedOrderId,
    setSelectedOrderId,
  ] =
    useState<string | null>(
      null
    );

  const [
    selectedDetailTab,
    setSelectedDetailTab,
  ] =
    useState("overview");

  const selectedOrder =
    data.packingItems.find(
      (order: any) =>
        order.id ===
        selectedOrderId
    ) || null;


  return (
    <AppLayout>

      <GastarioPage>

        <GastarioHeader
          eyebrow="Betrieb"
          title="Packlisten"
          subtitle={
            <>
              {data.tenantName}
              {" · "}
              Aufträge erscheinen automatisch,
              sobald sie aus der Produktion an
              die Packstation übergeben wurden.
            </>
          }
          actions={
            <>
              <GastarioButton
                variant="secondary"
                type="button"
                onClick={() =>
                  window.print()
                }
              >
                Drucken
              </GastarioButton>

              <Link
                className={
                  gastarioButtonClass(
                    "primary"
                  )
                }
                to="/lieferungen"
              >
                Zu Lieferungen
              </Link>
            </>
          }
        />


        {data.error ? (
          <GastarioNotice type="danger">
            <strong>
              Die Packlisten konnten nicht
              vollständig geladen werden.
            </strong>
            {" "}
            {data.error}
          </GastarioNotice>
        ) : null}


        {actionData?.error ? (
          <GastarioNotice type="danger">
            <strong>
              Packlistenaktion konnte nicht
              ausgeführt werden.
            </strong>
            {" "}
            {actionData.error}
          </GastarioNotice>
        ) : null}


        <GastarioMetricGrid>

          <GastarioMetric
            label="Aufträge"
            value={data.stats.orders}
            description="für diesen Planungstag"
            badge="Automatisch"
          />

          <GastarioMetric
            label="Positionen"
            value={data.stats.positions}
            description="in allen Packlisten"
            badge="Liste"
          />

          <GastarioMetric
            label="Gesamtmenge"
            value={data.stats.pieces}
            description="über alle Positionen"
            badge="Check"
          />

          <GastarioMetric
            label="Lieferbereit"
            value={data.stats.ready}
            description="vollständig gepackte Aufträge"
            badge="Fertig"
          />

        </GastarioMetricGrid>


        <GastarioSection
          eyebrow="Packlisten"
          title="Nach Auftrag"
          description="Wähle einen Auftrag aus, um Positionen und Packkontrolle zu bearbeiten."
          action={
            <GastarioBadge variant="neutral">
              {data.packingItems.length}
              {" "}
              {data.packingItems.length === 1
                ? "Packliste"
                : "Packlisten"}
            </GastarioBadge>
          }
        >

          <Form method="get">

            <GastarioFilterBar
              actions={
                <GastarioButton
                  variant="primary"
                  type="submit"
                >
                  Anzeigen
                </GastarioButton>
              }
            >

              <GastarioField
                label="Planungstag"
              >
                <GastarioSelect
                  name="date"
                  defaultValue={
                    data.selectedDate
                  }
                >

                  {data.availableDates.length > 0 ? (

                    data.availableDates.map(
                      (date: string) => (
                        <option
                          key={date}
                          value={date}
                        >
                          {formatDate(date)}
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

                </GastarioSelect>
              </GastarioField>

            </GastarioFilterBar>

          </Form>


          {data.packingItems.length === 0 ? (

            <GastarioEmptyState
              title="Keine Packlisten gefunden"
            >
              Für den ausgewählten Tag wurden
              noch keine Aufträge an die
              Packstation übergeben.
            </GastarioEmptyState>

          ) : (

            <GastarioDataList>

              {data.packingItems.map(
                (order: any) => (

                  <GastarioDataRow
                    key={order.id}
                    onClick={() => {
                      setSelectedOrderId(
                        order.id
                      );

                      setSelectedDetailTab(
                        "overview"
                      );
                    }}
                  >

                    <div className="g-ui-data-row-main">

                      <strong className="g-ui-data-row-title">
                        {order.customerName ||
                          "Kunde unbekannt"}
                      </strong>

                      <span className="g-ui-data-row-description">
                        Auftrag {order.orderNumber}
                        {" · "}
                        {formatDate(
                          order.deliveryDate
                        )}
                        {" · "}
                        {order.deliveryAddress ||
                          "Keine Lieferadresse"}
                      </span>

                    </div>


                    <div className="g-ui-data-row-meta">

                      <span>
                        {order.deliveryTime ||
                          "-"}
                        {" Uhr"}
                      </span>

                      <span>
                        {order.totalQuantity}
                        {" gesamt"}
                      </span>

                      <span>
                        {order.checkedCount}
                        {" / "}
                        {order.totalChecks}
                      </span>

                      <GastarioBadge
                        variant={
                          order.isPacked
                            ? "success"
                            : order.packingStarted
                              ? "info"
                              : "neutral"
                        }
                      >
                        {packingStatusLabel(
                          order
                        )}
                      </GastarioBadge>

                    </div>


                    <span
                      className="g-ui-data-row-chevron"
                      aria-hidden="true"
                    >
                      →
                    </span>

                  </GastarioDataRow>

                )
              )}

            </GastarioDataList>

          )}

        </GastarioSection>


        <GastarioDialog
          open={Boolean(selectedOrder)}
          title={
            selectedOrder?.customerName ||
            "Packliste"
          }
          description={
            selectedOrder
              ? `Auftrag ${
                  selectedOrder.orderNumber
                } · ${
                  formatDate(
                    selectedOrder.deliveryDate
                  )
                } · ${
                  selectedOrder.deliveryTime ||
                  "-"
                } Uhr`
              : undefined
          }
          size="xl"
          onClose={() => {
            setSelectedOrderId(null);
            setSelectedDetailTab(
              "overview"
            );
          }}
          footer={
            selectedOrder ? (
              <>

                <GastarioButton
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(
                      null
                    );

                    setSelectedDetailTab(
                      "overview"
                    );
                  }}
                >
                  Schließen
                </GastarioButton>


                {!selectedOrder.packingStarted &&
                !selectedOrder.isPacked ? (

                  selectedOrder.unresolvedItems
                    .length > 0 ? (

                    <Link
                      to={
                        `/auftrag-pruefung/${
                          selectedOrder.id
                        }`
                      }
                      className={
                        gastarioButtonClass(
                          "secondary"
                        )
                      }
                    >
                      Operative Zuordnung
                    </Link>

                  ) : (

                    <Form method="post">

                      <input
                        type="hidden"
                        name="intent"
                        value="start-packing"
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
                        name="date"
                        value={
                          data.selectedDate
                        }
                      />

                      <GastarioButton
                        type="submit"
                        variant="primary"
                      >
                        Packen starten
                      </GastarioButton>

                    </Form>

                  )

                ) : null}


                {selectedOrder.packingStarted &&
                !selectedOrder.isPacked ? (

                  <Form method="post">

                    <input
                      type="hidden"
                      name="intent"
                      value="complete-packing"
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
                      name="date"
                      value={
                        data.selectedDate
                      }
                    />

                    <GastarioButton
                      type="submit"
                      variant="primary"
                      disabled={
                        !selectedOrder.canComplete
                      }
                    >
                      Packen abschließen
                    </GastarioButton>

                  </Form>

                ) : null}


                {selectedOrder.isPacked &&
                selectedOrder.status !==
                  "DELIVERED" ? (

                  <Form method="post">

                    <input
                      type="hidden"
                      name="intent"
                      value="reopen-packing"
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
                      name="date"
                      value={
                        data.selectedDate
                      }
                    />

                    <GastarioButton
                      type="submit"
                      variant="secondary"
                    >
                      Wieder öffnen
                    </GastarioButton>

                  </Form>

                ) : null}


                {selectedOrder.isPacked ? (

                  <Link
                    to={
                      `/lieferungen?range=date&date=${
                        encodeURIComponent(
                          data.selectedDate
                        )
                      }`
                    }
                    className={
                      gastarioButtonClass(
                        "primary"
                      )
                    }
                  >
                    Weiter zur Lieferung
                  </Link>

                ) : null}

              </>
            ) : null
          }
        >

          {selectedOrder ? (
            <>

              <GastarioTabs
                activeId={
                  selectedDetailTab
                }
                onChange={
                  setSelectedDetailTab
                }
                items={[
                  {
                    id: "overview",
                    label: "Übersicht",
                  },
                  {
                    id: "positions",
                    label: "Positionen",
                    badge:
                      selectedOrder.items.length,
                  },
                  {
                    id: "checks",
                    label: "Packkontrolle",
                    badge:
                      selectedOrder.tasks.length,
                  },
                ]}
              />


              <div className="g-ui-dialog-form">


                <div
                  className="g-ui-form-section"
                  hidden={
                    selectedDetailTab !==
                    "overview"
                  }
                >

                  <div className="g-ui-form-section-heading">
                    <h3>
                      Übersicht
                    </h3>

                    <p>
                      Die wichtigsten Daten und
                      der aktuelle Packstatus.
                    </p>
                  </div>


                  <GastarioDataList>


                    <GastarioDataRow>

                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          Status
                        </strong>

                        <span className="g-ui-data-row-description">
                          Aktueller Packstatus
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <GastarioBadge
                          variant={
                            selectedOrder.isPacked
                              ? "success"
                              : selectedOrder.packingStarted
                                ? "info"
                                : "neutral"
                          }
                        >
                          {packingStatusLabel(
                            selectedOrder
                          )}
                        </GastarioBadge>
                      </div>

                    </GastarioDataRow>


                    <GastarioDataRow>

                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          Lieferzeit
                        </strong>

                        <span className="g-ui-data-row-description">
                          Anlieferung vor Ort
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <strong>
                          {selectedOrder.deliveryTime ||
                            "-"}
                          {" Uhr"}
                        </strong>
                      </div>

                    </GastarioDataRow>


                    <GastarioDataRow>

                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          Lieferadresse
                        </strong>

                        <span className="g-ui-data-row-description">
                          Ziel der Lieferung
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <span>
                          {selectedOrder.deliveryAddress ||
                            "Keine Lieferadresse eingetragen"}
                        </span>
                      </div>

                    </GastarioDataRow>


                    <GastarioDataRow>

                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          Kontakt
                        </strong>

                        <span className="g-ui-data-row-description">
                          Ansprechpartner vor Ort
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <span>
                          {selectedOrder.contactName ||
                            "Kein Ansprechpartner"}
                        </span>

                        {selectedOrder.contactPhone ? (
                          <span>
                            {selectedOrder.contactPhone}
                          </span>
                        ) : null}
                      </div>

                    </GastarioDataRow>


                    <GastarioDataRow>

                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          Gesamtmenge
                        </strong>

                        <span className="g-ui-data-row-description">
                          Packpositionen
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <strong>
                          {selectedOrder.totalQuantity}
                        </strong>
                      </div>

                    </GastarioDataRow>


                    <GastarioDataRow>

                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          Packfortschritt
                        </strong>

                        <span className="g-ui-data-row-description">
                          Prüfungen dieses Auftrags
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">

                        <strong>
                          {selectedOrder.checkedCount}
                          {" / "}
                          {selectedOrder.totalChecks}
                        </strong>

                        <GastarioBadge
                          variant={
                            selectedOrder.isPacked
                              ? "success"
                              : "neutral"
                          }
                        >
                          {selectedOrder.progress} %
                        </GastarioBadge>

                      </div>

                    </GastarioDataRow>


                    {selectedOrder.logisticsItems.length > 0 ? (

                      <GastarioDataRow>

                        <div className="g-ui-data-row-main">
                          <strong className="g-ui-data-row-title">
                            Logistik
                          </strong>

                          <span className="g-ui-data-row-description">
                            Lieferung und Abholung
                          </span>
                        </div>

                        <div className="g-ui-data-row-meta">
                          <span>
                            {selectedOrder.logisticsItems
                              .map(
                                (item: any) =>
                                  `${item.quantity} × ${item.name}`
                              )
                              .join(", ")}
                          </span>
                        </div>

                      </GastarioDataRow>

                    ) : null}


                  </GastarioDataList>


                  {selectedOrder.unresolvedItems.length > 0 ? (

                    <GastarioNotice type="warning">
                      <strong>
                        Operative Zuordnung fehlt.
                      </strong>
                      {" "}
                      {selectedOrder.unresolvedItems.length}
                      {" "}
                      Position(en) müssen zuerst geprüft werden.
                    </GastarioNotice>

                  ) : null}


                  {!selectedOrder.packingStarted &&
                  !selectedOrder.isPacked &&
                  selectedOrder.unresolvedItems.length === 0 ? (

                    <GastarioNotice type="info">
                      Die Packliste ist vorbereitet
                      und kann gestartet werden.
                    </GastarioNotice>

                  ) : null}


                </div>


                <div
                  className="g-ui-form-section"
                  hidden={
                    selectedDetailTab !==
                    "positions"
                  }
                >

                  <div className="g-ui-form-section-heading">
                    <h3>
                      Positionen
                    </h3>

                    <p>
                      Alle Positionen dieses
                      Auftrags einzeln bestätigen.
                    </p>
                  </div>


                  {selectedOrder.items.length === 0 ? (

                    <GastarioEmptyState
                      title="Keine Positionen"
                    >
                      Dieser Auftrag enthält
                      keine Packpositionen.
                    </GastarioEmptyState>

                  ) : (

                    <div className="g-ui-check-list">

                      {selectedOrder.items.map(
                        (item: any) => (

                          <PackingCheckbox
                            key={
                              item.checkKey
                            }
                            orderId={
                              selectedOrder.id
                            }
                            checkKey={
                              item.checkKey
                            }
                            initialChecked={
                              item.checked
                            }
                            disabled={
                              !selectedOrder.canCheck
                            }
                            selectedDate={
                              data.selectedDate
                            }
                            label={
                              item.name ||
                              "Position"
                            }
                            description={
                              `${item.quantity || 0} × ${
                                item.unit || "Stück"
                              } · ${
                                item.operationalArea ===
                                "PACKING"
                                  ? "Equipment"
                                  : "Küche"
                              }`
                            }
                          />

                        )
                      )}

                    </div>

                  )}


                </div>


                <div
                  className="g-ui-form-section"
                  hidden={
                    selectedDetailTab !==
                    "checks"
                  }
                >

                  <div className="g-ui-form-section-heading">
                    <h3>
                      Packkontrolle
                    </h3>

                    <p>
                      Ware, Dokumente und Equipment
                      vor der Freigabe prüfen.
                    </p>
                  </div>


                  <div className="g-ui-check-list">

                    {selectedOrder.tasks.map(
                      (task: any) => (

                        <PackingCheckbox
                          key={
                            task.checkKey
                          }
                          orderId={
                            selectedOrder.id
                          }
                          checkKey={
                            task.checkKey
                          }
                          initialChecked={
                            task.checked
                          }
                          disabled={
                            !selectedOrder.canCheck
                          }
                          selectedDate={
                            data.selectedDate
                          }
                          label={
                            task.label
                          }
                        />

                      )
                    )}

                  </div>


                </div>


              </div>

            </>
          ) : null}

        </GastarioDialog>

      </GastarioPage>

    </AppLayout>
  );
}
