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
  GastarioEmptyState,
  GastarioField,
  GastarioHeader,
  GastarioMetric,
  GastarioMetricGrid,
  GastarioNotice,
  GastarioPage,
  GastarioPanel,
  GastarioSection,
  GastarioSelect,
  GastarioStack,
  GastarioToolbar,
  GastarioWorkflow,
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
            value={
              data.stats.positions
            }
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
          description="Positionen und Zusatzkontrollen werden zentral gespeichert und sind für alle Mitarbeiter identisch sichtbar."
          action={
            <Form
              method="get"
              className="g-ui-section-control"
            >
              <GastarioToolbar align="start">

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

                <GastarioButton
                  variant="primary"
                  type="submit"
                >
                  Anzeigen
                </GastarioButton>

              </GastarioToolbar>
            </Form>
          }
        >

          {data.packingItems.length === 0 ? (

            <GastarioEmptyState
              title="Keine Packlisten gefunden"
            >
              Für den ausgewählten Tag wurden
              noch keine Aufträge an die
              Packstation übergeben.
            </GastarioEmptyState>

          ) : (

            <GastarioStack>

              {data.packingItems.map(
                (order: any) => (

                  <GastarioPanel
                    key={order.id}
                  >

                    <GastarioToolbar
                      align="between"
                    >

                      <div className="g-ui-data-row-copy">

                        <strong className="g-ui-data-row-title">
                          {order.customerName}
                        </strong>

                        <span className="g-ui-data-row-description">
                          Auftrag {order.orderNumber}
                          {" · "}
                          {formatDate(
                            order.deliveryDate
                          )}
                          {" · "}
                          {order.deliveryAddress ||
                            "Keine Adresse"}
                        </span>

                      </div>


                      <div className="g-ui-data-row-meta">

                        <span>
                          {order.deliveryTime ||
                            "-"}
                          {" Uhr"}
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

                    </GastarioToolbar>


                    <GastarioWorkflow
                      items={[
                        {
                          id: "items",
                          label:
                            "Positionen gepackt",
                          description:
                            "Alle Auftragspositionen einzeln bestätigen",
                          state:
                            order.isPacked ||
                            (
                              order.items.length > 0 &&
                              order.items.every(
                                (item: any) =>
                                  item.checked
                              )
                            )
                              ? "done"
                              : "current",
                        },
                        {
                          id: "checks",
                          label:
                            "Packkontrolle",
                          description:
                            "Ware, Lieferschein, Besteck und Equipment prüfen",
                          state:
                            !(
                              order.items.length > 0 &&
                              order.items.every(
                                (item: any) =>
                                  item.checked
                              )
                            )
                              ? "locked"
                              : order.isPacked ||
                                  (
                                    order.tasks.length > 0 &&
                                    order.tasks.every(
                                      (task: any) =>
                                        task.checked
                                    )
                                  )
                                ? "done"
                                : "current",
                        },
                        {
                          id: "ready",
                          label:
                            "Lieferbereit",
                          description:
                            "Auftrag für die Lieferung freigeben",
                          state:
                            order.isPacked
                              ? "done"
                              : (
                                  order.items.length > 0 &&
                                  order.items.every(
                                    (item: any) =>
                                      item.checked
                                  ) &&
                                  order.tasks.length > 0 &&
                                  order.tasks.every(
                                    (task: any) =>
                                      task.checked
                                  )
                                )
                                ? "current"
                                : "locked",
                        },
                      ]}
                    />


                    <div className="g-ui-detail-meta">

                      <div>
                        <span>Kontakt</span>
                        <strong>
                          {order.contactName ||
                            "-"}
                          {" · "}
                          {order.contactPhone ||
                            "-"}
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
                        <strong>
                          {order.totalQuantity}
                        </strong>
                      </div>

                    </div>


                    {order.unresolvedItems.length > 0 ? (

                      <GastarioNotice type="warning">

                        <GastarioToolbar
                          align="between"
                        >

                          <span>
                            <strong>
                              Operative Zuordnung fehlt.
                            </strong>
                            {" "}
                            {order.unresolvedItems.length}
                            {" "}
                            Position(en) müssen vor
                            dem Packstart geprüft werden.
                          </span>

                          <Link
                            to={
                              `/auftrag-pruefung/${
                                order.id
                              }`
                            }
                            className={
                              gastarioButtonClass(
                                "secondary"
                              )
                            }
                          >
                            Zuordnungen prüfen
                          </Link>

                        </GastarioToolbar>

                      </GastarioNotice>

                    ) : null}


                    {order.logisticsItems.length > 0 ? (

                      <GastarioNotice type="neutral">
                        <strong>
                          Logistik:
                        </strong>
                        {" "}
                        {order.logisticsItems
                          .map(
                            (item: any) =>
                              `${item.quantity} × ${item.name}`
                          )
                          .join(", ")}
                      </GastarioNotice>

                    ) : null}


                    {!order.packingStarted &&
                    !order.isPacked ? (

                      <GastarioNotice type="info">

                        <GastarioToolbar
                          align="between"
                        >

                          <span>
                            <strong>
                              Packliste ist vorbereitet.
                            </strong>
                            {" "}
                            Starte den Packvorgang,
                            damit alle Häkchen
                            zentral gespeichert werden.
                          </span>

                          {order.unresolvedItems.length > 0 ? (

                            <Link
                              to={
                                `/auftrag-pruefung/${
                                  order.id
                                }`
                              }
                              className={
                                gastarioButtonClass(
                                  "secondary"
                                )
                              }
                            >
                              Erst Zuordnung prüfen
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
                                value={order.id}
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

                          )}

                        </GastarioToolbar>

                      </GastarioNotice>

                    ) : null}


                    <GastarioStack compact>

                      <div className="g-ui-section-eyebrow">
                        Positionen
                      </div>

                      {order.items.length === 0 ? (

                        <GastarioEmptyState
                          title="Keine Positionen"
                        >
                          Dieser Auftrag hat keine
                          Packpositionen.
                        </GastarioEmptyState>

                      ) : (

                        order.items.map(
                          (item: any) => (

                            <PackingCheckbox
                              key={
                                item.checkKey
                              }
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
                        )

                      )}

                    </GastarioStack>


                    <GastarioStack compact>

                      <div className="g-ui-section-eyebrow">
                        Packkontrolle
                      </div>

                      {order.tasks.map(
                        (task: any) => (

                          <PackingCheckbox
                            key={
                              task.checkKey
                            }
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

                        )
                      )}

                    </GastarioStack>


                    <GastarioToolbar
                      align="between"
                    >

                      <div className="g-ui-data-row-copy">

                        <strong className="g-ui-data-row-title">
                          {order.checkedCount}
                          {" / "}
                          {order.totalChecks}
                          {" Prüfungen erledigt"}
                        </strong>

                        <span className="g-ui-data-row-description">
                          {order.progress}% abgeschlossen
                        </span>

                      </div>


                      <GastarioToolbar align="end">

                        {order.isPacked ? (

                          <>
                            <GastarioBadge
                              variant="success"
                            >
                              Lieferbereit
                            </GastarioBadge>

                            {order.status !==
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
                                  value={order.id}
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
                          </>

                        ) : order.packingStarted ? (

                          <Form method="post">

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

                            <GastarioButton
                              type="submit"
                              variant="primary"
                              disabled={
                                !order.canComplete
                              }
                            >
                              Packen abschließen
                            </GastarioButton>

                          </Form>

                        ) : null}

                      </GastarioToolbar>

                    </GastarioToolbar>

                  </GastarioPanel>

                )
              )}

            </GastarioStack>

          )}

        </GastarioSection>

      </GastarioPage>

    </AppLayout>
  );
}
