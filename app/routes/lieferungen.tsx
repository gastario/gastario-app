import { useState } from "react";

import {
  Form,
  Link,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioBadge,
  GastarioButton,
  GastarioDataList,
  GastarioDataRow,
  GastarioDetailDialog,
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
  value:
    | string
    | Date
    | null
    | undefined
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
  value:
    | string
    | Date
    | null
    | undefined
) {
  if (!value) {
    return "Kein Datum";
  }

  try {
    return new Date(value).toLocaleDateString(
      "de-DE",
      {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  } catch {
    return "Kein Datum";
  }
}

function formatSelectDate(value: string) {
  try {
    return new Date(
      value + "T00:00:00"
    ).toLocaleDateString("de-DE");
  } catch {
    return value;
  }
}

function cleanPhone(
  value: string | null | undefined
) {
  return String(value || "")
    .replace(/[^\d+]/g, "");
}

function mapsUrl(
  address: string | null | undefined
) {
  const clean = String(address || "")
    .trim();

  if (!clean) {
    return "#";
  }

  return (
    "https://www.google.com/maps/search/" +
    "?api=1&query=" +
    encodeURIComponent(clean)
  );
}

function routeUrl(addresses: string[]) {
  const clean = addresses
    .map((item) =>
      String(item || "").trim()
    )
    .filter(Boolean);

  if (clean.length === 0) {
    return "#";
  }

  if (clean.length === 1) {
    return mapsUrl(clean[0]);
  }

  const destination =
    clean[clean.length - 1];

  const waypoints =
    clean.slice(0, -1);

  return (
    "https://www.google.com/maps/dir/" +
    "?api=1" +
    "&destination=" +
    encodeURIComponent(destination) +
    "&waypoints=" +
    encodeURIComponent(
      waypoints.join("|")
    )
  );
}

function orderSummary(order: any) {
  if (
    !order.items ||
    order.items.length === 0
  ) {
    return "Keine Positionen";
  }

  const visibleItems = order.items
    .slice(0, 3)
    .map(
      (item: any) =>
        `${item.quantity || 0} × ${
          item.name || "Position"
        }`
    );

  const remainingCount =
    order.items.length -
    visibleItems.length;

  if (remainingCount > 0) {
    visibleItems.push(
      `+ ${remainingCount} weitere`
    );
  }

  return visibleItems.join(", ");
}

function statusLabel(
  value: string | null | undefined
) {
  const status = String(value || "")
    .toUpperCase();

  if (status === "CONFIRMED") {
    return "Bestätigt";
  }

  if (status === "IN_PRODUCTION") {
    return "Produktion";
  }

  if (status === "PACKING_OPEN") {
    return "Packen offen";
  }

  if (status === "DELIVERED") {
    return "Geliefert";
  }

  return "Offen";
}

function rangeTitle(range: string) {
  if (range === "future") {
    return "Künftige Lieferungen";
  }

  if (range === "past") {
    return "Vergangene Lieferungen";
  }

  if (range === "all") {
    return "Alle Lieferungen";
  }

  if (range === "date") {
    return "Lieferungen am ausgewählten Datum";
  }

  return "Heutige Lieferungen";
}

function buildDriverMail(
  order: any,
  address: string,
  map: string
) {
  return [
    `Lieferung: ${
      order.orderNumber || order.id
    }`,
    `Kunde: ${
      order.customerName || "-"
    }`,
    `Datum: ${formatDate(
      order.deliveryDate
    )}`,
    `Uhrzeit: ${
      order.deliveryTimeText || "-"
    }`,
    `Adresse: ${address || "-"}`,
    `Kontakt: ${
      order.contactName || "-"
    }`,
    `Telefon: ${
      order.contactPhone || "-"
    }`,
    "",
    "Positionen:",
    ...(order.items || []).map(
      (item: any) =>
        `- ${item.quantity || 0} ${
          item.unit || "Stück"
        } ${item.name || "Position"}`
    ),
    "",
    "Route:",
    map,
  ].join("\n");
}

function emptyData(
  error: string | null = null
) {
  return {
    tenantName: "Gastario",
    range: "today",
    selectedDate: todayInput(),
    availableDates: [] as string[],
    orders: [] as any[],
    stats: {
      today: 0,
      future: 0,
      past: 0,
      all: 0,
      incomplete: 0,
    },
    tourMapUrl: "#",
    error,
  };
}

export function meta() {
  return [
    {
      title:
        "Lieferungen · Gastario",
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
        "Kein Mandant gefunden. Bitte prüfe, ob dein Benutzer einem Mandanten zugeordnet ist."
      );
    }

    const url = new URL(request.url);

    const range =
      url.searchParams.get("range") ||
      "today";

    const selectedDate =
      url.searchParams.get("date") ||
      todayInput();

    const today = todayInput();

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

    const deliveryStatuses = new Set([
      "CONFIRMED",
      "IN_PRODUCTION",
      "PACKING_OPEN",
      "DELIVERED",
    ]);

    const deliveryOrders =
      orders.filter((order: any) => {
        const status = String(
          order.status || ""
        ).toUpperCase();

        return deliveryStatuses.has(
          status
        );
      });

    const filteredOrders =
      deliveryOrders.filter(
        (order: any) => {
          const date = normalizeDate(
            order.deliveryDate
          );

          if (range === "all") {
            return true;
          }

          if (range === "past") {
            return (
              Boolean(date) &&
              date < today
            );
          }

          if (range === "future") {
            return (
              Boolean(date) &&
              date > today
            );
          }

          if (range === "date") {
            return (
              date === selectedDate
            );
          }

          return date === today;
        }
      );

    const todayOrders =
      deliveryOrders.filter(
        (order: any) =>
          normalizeDate(
            order.deliveryDate
          ) === today
      );

    const futureOrders =
      deliveryOrders.filter(
        (order: any) => {
          const date = normalizeDate(
            order.deliveryDate
          );

          return (
            Boolean(date) &&
            date > today
          );
        }
      );

    const pastOrders =
      deliveryOrders.filter(
        (order: any) => {
          const date = normalizeDate(
            order.deliveryDate
          );

          return (
            Boolean(date) &&
            date < today
          );
        }
      );

    const availableDates =
      Array.from(
        new Set(
          deliveryOrders
            .map((order: any) =>
              normalizeDate(
                order.deliveryDate
              )
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        )
      ).sort();

    const incomplete =
      filteredOrders.filter(
        (order: any) =>
          !String(
            order.deliveryAddress || ""
          ).trim() ||
          !String(
            order.contactPhone || ""
          ).trim() ||
          (
            !order.packingCompletedAt &&
            String(
              order.status || ""
            ).toUpperCase() !==
              "DELIVERED"
          )
      ).length;

    return {
      tenantName:
        access.tenant?.name ||
        "Gastario",

      range,
      selectedDate,
      availableDates,
      orders: filteredOrders,

      stats: {
        today: todayOrders.length,
        future: futureOrders.length,
        past: pastOrders.length,
        all: deliveryOrders.length,
        incomplete,
      },

      tourMapUrl: routeUrl(
        filteredOrders
          .map((order: any) =>
            String(
              order.deliveryAddress || ""
            ).trim()
          )
          .filter(Boolean)
      ),

      error: null,
    };
  } catch (error: any) {
    console.error(
      "Lieferungen loader error:",
      error
    );

    return emptyData(
      error?.message ||
        "Lieferungen konnten wegen eines Serverfehlers nicht geladen werden."
    );
  }
}

export default function DeliveriesPage() {
  const data =
    useLoaderData<typeof loader>();

  const [
    selectedOrderId,
    setSelectedOrderId,
  ] =
    useState<string | null>(
      null
    );

  const selectedOrder =
    data.orders.find(
      (order: any) =>
        order.id ===
        selectedOrderId
    ) || null;

  const routeAvailable =
    data.tourMapUrl !== "#";


  const selectedAddress =
    selectedOrder
      ? String(
          selectedOrder.deliveryAddress ||
            ""
        ).trim()
      : "";


  const selectedPhone =
    selectedOrder
      ? cleanPhone(
          selectedOrder.contactPhone
        )
      : "";


  const selectedMap =
    mapsUrl(
      selectedAddress
    );


  const selectedWhatsapp =
    selectedPhone
      ? `https://wa.me/${selectedPhone.replace(
          "+",
          ""
        )}?text=${encodeURIComponent(
          `Hallo, hier ist der Fahrer für die Lieferung ${
            selectedOrder?.orderNumber ||
            ""
          } von Gastario.`
        )}`
      : "#";


  const selectedMailBody =
    selectedOrder
      ? buildDriverMail(
          selectedOrder,
          selectedAddress,
          selectedMap
        )
      : "";


  const selectedPackingReady =
    selectedOrder
      ? (
          Boolean(
            selectedOrder.packingCompletedAt
          ) ||
          String(
            selectedOrder.status ||
            ""
          ).toUpperCase() ===
            "DELIVERED"
        )
      : false;


  const selectedComplete =
    Boolean(
      selectedAddress &&
      selectedPhone &&
      selectedPackingReady
    );


  return (
    <AppLayout>

      <GastarioPage>

        <GastarioHeader
          eyebrow="Betrieb"
          title="Lieferungen"
          subtitle={
            <>
              {data.tenantName}
              {" · "}
              Fahrerplanung, Routen,
              Kontakte und Lieferscheine
              zentral verwalten.
            </>
          }
          actions={
            <>

              <GastarioButton
                type="button"
                variant="secondary"
                onClick={() =>
                  window.print()
                }
              >
                Drucken
              </GastarioButton>


              {routeAvailable ? (

                <a
                  className={
                    gastarioButtonClass(
                      "primary"
                    )
                  }
                  href={
                    data.tourMapUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Tagesroute öffnen
                </a>

              ) : (

                <GastarioButton
                  type="button"
                  variant="primary"
                  disabled
                >
                  Keine Route verfügbar
                </GastarioButton>

              )}

            </>
          }
        />


        {data.error ? (

          <GastarioNotice type="danger">

            <strong>
              Lieferungen konnten
              nicht geladen werden.
            </strong>

            {" "}

            {data.error}

          </GastarioNotice>

        ) : null}


        <GastarioMetricGrid>

          <GastarioMetric
            label="Heute"
            value={
              data.stats.today
            }
            description="Lieferungen für heute"
            badge="Heute"
          />

          <GastarioMetric
            label="Künftig"
            value={
              data.stats.future
            }
            description="Kommende Lieferungen"
            badge="Planung"
          />

          <GastarioMetric
            label="Gesamt"
            value={
              data.stats.all
            }
            description="Operative Lieferaufträge"
            badge="Touren"
          />

          <GastarioMetric
            label="Daten prüfen"
            value={
              data.stats.incomplete
            }
            description={
              data.stats.incomplete > 0
                ? "Adresse, Telefon oder Packstatus prüfen"
                : "Alle Lieferdaten vollständig"
            }
            badge={
              data.stats.incomplete > 0
                ? "Prüfen"
                : "Bereit"
            }
          />

        </GastarioMetricGrid>


        <GastarioSection
          eyebrow="Fahrerplan"
          title={
            rangeTitle(
              data.range
            )
          }
          description={
            data.orders.length === 1
              ? "1 Lieferung im ausgewählten Zeitraum."
              : `${data.orders.length} Lieferungen im ausgewählten Zeitraum.`
          }
          action={
            <GastarioBadge variant="neutral">
              {data.orders.length}
              {" "}
              {data.orders.length === 1
                ? "Lieferung"
                : "Lieferungen"}
            </GastarioBadge>
          }
        >

          <Form method="get">

            <GastarioFilterBar
              actions={
                <>

                  <GastarioButton
                    type="submit"
                    variant="primary"
                  >
                    Anzeigen
                  </GastarioButton>

                  <Link
                    to="/lieferungen?range=today"
                    className={
                      gastarioButtonClass(
                        "secondary"
                      )
                    }
                  >
                    Zurücksetzen
                  </Link>

                </>
              }
            >

              <GastarioField
                label="Zeitraum"
              >

                <GastarioSelect
                  name="range"
                  defaultValue={
                    data.range
                  }
                >

                  <option value="today">
                    Heute
                  </option>

                  <option value="future">
                    Künftig
                  </option>

                  <option value="past">
                    Vergangen
                  </option>

                  <option value="all">
                    Alle
                  </option>

                  <option value="date">
                    Bestimmtes Datum
                  </option>

                </GastarioSelect>

              </GastarioField>


              <GastarioField
                label="Lieferdatum"
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
                          {formatSelectDate(
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
                      Keine Lieferdaten
                    </option>

                  )}

                </GastarioSelect>

              </GastarioField>

            </GastarioFilterBar>

          </Form>


          {data.orders.length === 0 ? (

            <GastarioEmptyState
              title="Keine Lieferungen gefunden"
            >
              Für diesen Filter sind
              aktuell keine Lieferungen
              vorhanden.
            </GastarioEmptyState>

          ) : (

            <GastarioDataList>

              {data.orders.map(
                (
                  order: any,
                  index: number
                ) => {

                  const address =
                    String(
                      order.deliveryAddress ||
                      ""
                    ).trim();

                  const phone =
                    cleanPhone(
                      order.contactPhone
                    );

                  const packingReady =
                    Boolean(
                      order.packingCompletedAt
                    ) ||
                    String(
                      order.status ||
                      ""
                    ).toUpperCase() ===
                      "DELIVERED";

                  const complete =
                    Boolean(
                      address &&
                      phone &&
                      packingReady
                    );


                  return (

                    <GastarioDataRow
                      key={
                        order.id
                      }
                      onClick={() =>
                        setSelectedOrderId(
                          order.id
                        )
                      }
                    >

                      <div className="g-ui-data-row-main">

                        <strong className="g-ui-data-row-title">
                          {order.customerName ||
                            "Kunde unbekannt"}
                        </strong>

                        <span className="g-ui-data-row-description">
                          Stopp {index + 1}
                          {" · "}
                          {order.orderNumber ||
                            order.id}
                          {" · "}
                          {address ||
                            "Keine Lieferadresse"}
                        </span>

                        <span className="g-ui-data-row-description">
                          {orderSummary(
                            order
                          )}
                        </span>

                      </div>


                      <div className="g-ui-data-row-meta">

                        <span>
                          {formatDate(
                            order.deliveryDate
                          )}
                        </span>

                        <strong>
                          {order.deliveryTimeText ||
                            "–"}
                        </strong>

                        <GastarioBadge
                          variant={
                            complete
                              ? "success"
                              : "warning"
                          }
                        >
                          {complete
                            ? "Fahrbereit"
                            : "Daten prüfen"}
                        </GastarioBadge>

                        <GastarioBadge
                          variant="neutral"
                        >
                          {statusLabel(
                            order.status
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

                  );

                }
              )}

            </GastarioDataList>

          )}

        </GastarioSection>


        <GastarioDetailDialog
          open={
            Boolean(
              selectedOrder
            )
          }
          size="lg"
          title={
            selectedOrder?.customerName ||
            "Lieferung"
          }
          description={
            selectedOrder
              ? `${
                  selectedOrder.orderNumber ||
                  selectedOrder.id
                } · ${
                  formatDate(
                    selectedOrder.deliveryDate
                  )
                } · ${
                  selectedOrder.deliveryTimeText ||
                  "–"
                }`
              : undefined
          }
          onClose={() =>
            setSelectedOrderId(
              null
            )
          }
          footer={
            selectedOrder ? (

              <GastarioToolbar>

                <GastarioButton
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setSelectedOrderId(
                      null
                    )
                  }
                >
                  Schließen
                </GastarioButton>


                {selectedAddress ? (

                  <a
                    className={
                      gastarioButtonClass(
                        "primary"
                      )
                    }
                    href={
                      selectedMap
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Route öffnen
                  </a>

                ) : (

                  <GastarioButton
                    type="button"
                    variant="primary"
                    disabled
                  >
                    Adresse fehlt
                  </GastarioButton>

                )}


                {selectedPhone ? (

                  <a
                    className={
                      gastarioButtonClass(
                        "secondary"
                      )
                    }
                    href={
                      `tel:${selectedPhone}`
                    }
                  >
                    Anrufen
                  </a>

                ) : null}


                {selectedPhone ? (

                  <a
                    className={
                      gastarioButtonClass(
                        "secondary"
                      )
                    }
                    href={
                      selectedWhatsapp
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>

                ) : null}


                <a
                  className={
                    gastarioButtonClass(
                      "secondary"
                    )
                  }
                  href={
                    `mailto:?subject=${encodeURIComponent(
                      `Lieferung ${
                        selectedOrder.orderNumber ||
                        selectedOrder.id
                      }`
                    )}&body=${encodeURIComponent(
                      selectedMailBody
                    )}`
                  }
                >
                  Fahrer-Mail
                </a>


                <Link
                  className={
                    gastarioButtonClass(
                      "secondary"
                    )
                  }
                  to={
                    `/lieferscheine?date=${normalizeDate(
                      selectedOrder.deliveryDate
                    )}`
                  }
                >
                  Lieferschein
                </Link>

              </GastarioToolbar>

            ) : null
          }
        >

          {selectedOrder ? (

            <GastarioSection
              eyebrow="Lieferung"
              title="Lieferdaten"
              description="Alle wichtigen Informationen für die Auslieferung."
              action={
                <GastarioBadge
                  variant={
                    selectedComplete
                      ? "success"
                      : "warning"
                  }
                >
                  {selectedComplete
                    ? "Fahrbereit"
                    : "Daten prüfen"}
                </GastarioBadge>
              }
            >

              <GastarioDataList>


                <GastarioDataRow>

                  <div className="g-ui-data-row-main">

                    <strong className="g-ui-data-row-title">
                      Lieferzeit
                    </strong>

                    <span className="g-ui-data-row-description">
                      Geplanter Liefertermin
                    </span>

                  </div>

                  <div className="g-ui-data-row-meta">

                    <strong>
                      {selectedOrder.deliveryTimeText ||
                        "–"}
                    </strong>

                    <span>
                      {formatDate(
                        selectedOrder.deliveryDate
                      )}
                    </span>

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
                      {selectedAddress ||
                        "Keine Lieferadresse eingetragen"}
                    </span>

                  </div>

                </GastarioDataRow>


                <GastarioDataRow>

                  <div className="g-ui-data-row-main">

                    <strong className="g-ui-data-row-title">
                      Ansprechpartner
                    </strong>

                    <span className="g-ui-data-row-description">
                      Kontakt vor Ort
                    </span>

                  </div>

                  <div className="g-ui-data-row-meta">

                    <span>
                      {selectedOrder.contactName ||
                        "Kein Ansprechpartner"}
                    </span>

                    <span>
                      {selectedOrder.contactPhone ||
                        "Keine Telefonnummer"}
                    </span>

                  </div>

                </GastarioDataRow>


                <GastarioDataRow>

                  <div className="g-ui-data-row-main">

                    <strong className="g-ui-data-row-title">
                      Auftrag
                    </strong>

                    <span className="g-ui-data-row-description">
                      {selectedOrder.eventName ||
                        "Kein Veranstaltungsname"}
                    </span>

                  </div>

                  <div className="g-ui-data-row-meta">

                    <strong>
                      {selectedOrder.orderNumber ||
                        selectedOrder.id}
                    </strong>

                    <GastarioBadge variant="neutral">
                      {statusLabel(
                        selectedOrder.status
                      )}
                    </GastarioBadge>

                  </div>

                </GastarioDataRow>


                <GastarioDataRow>

                  <div className="g-ui-data-row-main">

                    <strong className="g-ui-data-row-title">
                      Packstatus
                    </strong>

                    <span className="g-ui-data-row-description">
                      Voraussetzung für die Auslieferung
                    </span>

                  </div>

                  <div className="g-ui-data-row-meta">

                    <GastarioBadge
                      variant={
                        selectedPackingReady
                          ? "success"
                          : "warning"
                      }
                    >
                      {selectedPackingReady
                        ? "Packen abgeschlossen"
                        : "Noch nicht lieferbereit"}
                    </GastarioBadge>

                  </div>

                </GastarioDataRow>


              </GastarioDataList>


              {!selectedComplete ? (

                <GastarioNotice type="warning">
                  <strong>
                    Lieferdaten unvollständig.
                  </strong>
                  {" "}
                  Prüfe Lieferadresse,
                  Telefonnummer und Packstatus,
                  bevor der Fahrer startet.
                </GastarioNotice>

              ) : null}

            </GastarioSection>

          ) : null}

        </GastarioDetailDialog>

      </GastarioPage>

    </AppLayout>
  );
}


export function ErrorBoundary({
  error,
}: {
  error: any;
}) {
  const message =
    error?.data ||
    error?.message ||
    "Unbekannter Fehler.";

  const status =
    error?.status || 500;

  return (
    <AppLayout>

      <GastarioPage>

        <GastarioHeader
          eyebrow={
            `Fehler ${status}`
          }
          title="Lieferungen konnten nicht geladen werden"
          subtitle="Beim Laden des Fahrerplans ist ein Fehler aufgetreten."
        />


        <GastarioNotice type="danger">

          <strong>
            Technischer Fehler
          </strong>

          {" "}

          {String(message)}

        </GastarioNotice>


        <GastarioToolbar align="start">

          <Link
            to="/"
            className={
              gastarioButtonClass(
                "primary"
              )
            }
          >
            Zum Dashboard
          </Link>

          <Link
            to="/auftragseingang"
            className={
              gastarioButtonClass(
                "secondary"
              )
            }
          >
            Auftragseingang
          </Link>

          <a
            href="/logout"
            className={
              gastarioButtonClass(
                "secondary"
              )
            }
          >
            Ausloggen
          </a>

        </GastarioToolbar>

      </GastarioPage>

    </AppLayout>
  );
}
