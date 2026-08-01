import {
  Form,
  Link,
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

import "../styles/gastario-deliveries.css";

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
          ).trim()
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

  const routeAvailable =
    data.tourMapUrl !== "#";

  return (
    <AppLayout>
      <PageShell className="deliveriesPage">
        <PageHeader
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
            <div className="deliveriesHeaderActions">
              <button
                type="button"
                className="deliveriesButton deliveriesButtonSecondary"
                onClick={() =>
                  window.print()
                }
              >
                Drucken
              </button>

              {routeAvailable ? (
                <a
                  className="deliveriesButton deliveriesButtonPrimary"
                  href={data.tourMapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tagesroute öffnen
                </a>
              ) : (
                <span
                  className="deliveriesButton deliveriesButtonPrimary isDisabled"
                  aria-disabled="true"
                >
                  Keine Route verfügbar
                </span>
              )}
            </div>
          }
        />

        {data.error ? (
          <Notice type="danger">
            <strong>
              Lieferungen konnten
              nicht geladen werden.
            </strong>

            <span>
              {data.error}
            </span>
          </Notice>
        ) : null}

        <MetricGrid className="deliveriesMetrics">
          <MetricCard
            label="Heute"
            value={data.stats.today}
            description="Lieferungen für heute"
            badge="Tagesplan"
          />

          <MetricCard
            label="Künftig"
            value={data.stats.future}
            description="Kommende Lieferungen"
            badge="Planung"
          />

          <MetricCard
            label="Gesamt"
            value={data.stats.all}
            description="Operative Lieferaufträge"
            badge="Aktiv"
          />

          <MetricCard
            label="Daten prüfen"
            value={data.stats.incomplete}
            description="Adresse oder Telefon fehlt"
            badge={
              data.stats.incomplete > 0
                ? "Prüfen"
                : "Vollständig"
            }
            attention={
              data.stats.incomplete > 0
            }
          />
        </MetricGrid>

        <PageSection
          className="deliveriesFilterSection"
          eyebrow="Filter"
          title="Lieferungen anzeigen"
          description="Zeitraum auswählen oder gezielt ein Lieferdatum öffnen."
          actions={
            <nav
              className="deliveriesRangeTabs"
              aria-label="Lieferzeitraum"
            >
              <Link
                to="/lieferungen?range=today"
                data-active={
                  data.range === "today"
                    ? "true"
                    : "false"
                }
              >
                Heute
              </Link>

              <Link
                to="/lieferungen?range=future"
                data-active={
                  data.range === "future"
                    ? "true"
                    : "false"
                }
              >
                Künftig
              </Link>

              <Link
                to="/lieferungen?range=past"
                data-active={
                  data.range === "past"
                    ? "true"
                    : "false"
                }
              >
                Vergangen
              </Link>

              <Link
                to="/lieferungen?range=all"
                data-active={
                  data.range === "all"
                    ? "true"
                    : "false"
                }
              >
                Alle
              </Link>
            </nav>
          }
        >
          <Form
            method="get"
            className="deliveriesDateForm"
          >
            <input
              type="hidden"
              name="range"
              value="date"
            />

            <label className="deliveriesDateField">
              <span>Lieferdatum</span>

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
              </select>
            </label>

            <button
              type="submit"
              className="deliveriesButton deliveriesButtonPrimary"
            >
              Datum anzeigen
            </button>
          </Form>
        </PageSection>

        <section className="deliveriesMainGrid">
          <PageSection
            className="deliveriesSchedulePanel"
            eyebrow="Fahrerplan"
            title={rangeTitle(data.range)}
            description={
              data.orders.length === 1
                ? "1 Lieferung im ausgewählten Zeitraum."
                : `${data.orders.length} Lieferungen im ausgewählten Zeitraum.`
            }
            actions={
              routeAvailable ? (
                <a
                  className="deliveriesButton deliveriesButtonSecondary"
                  href={data.tourMapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Komplette Route
                </a>
              ) : null
            }
          >
            <div className="deliveriesRouteList">
              {data.orders.length === 0 ? (
                <div className="deliveriesEmptyState">
                  <div
                    className="deliveriesEmptyIcon"
                    aria-hidden="true"
                  >
                    ↗
                  </div>

                  <div>
                    <strong>
                      Keine Lieferungen gefunden
                    </strong>

                    <span>
                      Für diesen Filter sind
                      aktuell keine Aufträge
                      vorhanden.
                    </span>
                  </div>

                  <Link
                    to="/lieferungen?range=future"
                    className="deliveriesButton deliveriesButtonSecondary"
                  >
                    Künftige anzeigen
                  </Link>
                </div>
              ) : (
                data.orders.map(
                  (
                    order: any,
                    index: number
                  ) => {
                    const phone =
                      cleanPhone(
                        order.contactPhone
                      );

                    const address =
                      String(
                        order.deliveryAddress ||
                          ""
                      ).trim();

                    const map =
                      mapsUrl(address);

                    const whatsapp =
                      phone
                        ? `https://wa.me/${phone.replace(
                            "+",
                            ""
                          )}?text=${encodeURIComponent(
                            `Hallo, hier ist der Fahrer für die Lieferung ${
                              order.orderNumber
                            } von Gastario.`
                          )}`
                        : "#";

                    const mailBody =
                      buildDriverMail(
                        order,
                        address,
                        map
                      );

                    const complete =
                      Boolean(
                        address && phone
                      );

                    return (
                      <article
                        className="deliveriesRouteCard"
                        key={order.id}
                      >
                        <div className="deliveriesRouteTime">
                          <small>
                            Stopp {index + 1}
                          </small>

                          <strong>
                            {order.deliveryTimeText ||
                              "–"}
                          </strong>

                          <span>Uhr</span>
                        </div>

                        <div className="deliveriesRouteContent">
                          <header className="deliveriesRouteHeader">
                            <div>
                              <p>
                                {formatDate(
                                  order.deliveryDate
                                )}
                              </p>

                              <h3>
                                {order.customerName ||
                                  "Ohne Kunde"}
                              </h3>

                              <span>
                                {orderSummary(
                                  order
                                )}
                              </span>
                            </div>

                            <div className="deliveriesStatusArea">
                              <span
                                className="deliveriesStatusBadge"
                                data-status={String(
                                  order.status ||
                                    ""
                                ).toLowerCase()}
                              >
                                {statusLabel(
                                  order.status
                                )}
                              </span>

                              <span
                                className={
                                  "deliveriesDataBadge " +
                                  (
                                    complete
                                      ? "isComplete"
                                      : "isIncomplete"
                                  )
                                }
                              >
                                {complete
                                  ? "Fahrbereit"
                                  : "Daten fehlen"}
                              </span>
                            </div>
                          </header>

                          <div className="deliveriesRouteDetails">
                            <div>
                              <small>
                                Adresse
                              </small>

                              <strong>
                                {address ||
                                  "Keine Adresse eingetragen"}
                              </strong>
                            </div>

                            <div>
                              <small>
                                Kontakt
                              </small>

                              <strong>
                                {order.contactName ||
                                  "Kein Ansprechpartner"}
                              </strong>

                              <span>
                                {order.contactPhone ||
                                  "Keine Telefonnummer"}
                              </span>
                            </div>

                            <div>
                              <small>
                                Auftrag
                              </small>

                              <strong>
                                {order.orderNumber ||
                                  order.id}
                              </strong>

                              <span>
                                {order.eventName ||
                                  "Kein Eventname"}
                              </span>
                            </div>
                          </div>

                          <footer className="deliveriesRouteActions">
                            {address ? (
                              <a
                                className="deliveriesButton deliveriesButtonPrimary"
                                href={map}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Route öffnen
                              </a>
                            ) : (
                              <span
                                className="deliveriesButton deliveriesButtonPrimary isDisabled"
                                aria-disabled="true"
                              >
                                Adresse fehlt
                              </span>
                            )}

                            {phone ? (
                              <a
                                className="deliveriesButton deliveriesButtonSecondary"
                                href={`tel:${phone}`}
                              >
                                Anrufen
                              </a>
                            ) : (
                              <span
                                className="deliveriesButton deliveriesButtonSecondary isDisabled"
                                aria-disabled="true"
                              >
                                Keine Nummer
                              </span>
                            )}

                            {phone ? (
                              <a
                                className="deliveriesButton deliveriesButtonSecondary"
                                href={whatsapp}
                                target="_blank"
                                rel="noreferrer"
                              >
                                WhatsApp
                              </a>
                            ) : null}

                            <a
                              className="deliveriesButton deliveriesButtonSecondary"
                              href={`mailto:?subject=${encodeURIComponent(
                                `Lieferung ${
                                  order.orderNumber ||
                                  order.id
                                }`
                              )}&body=${encodeURIComponent(
                                mailBody
                              )}`}
                            >
                              Fahrer-Mail
                            </a>

                            <Link
                              className="deliveriesButton deliveriesButtonSecondary"
                              to={`/lieferscheine?date=${normalizeDate(
                                order.deliveryDate
                              )}`}
                            >
                              Lieferschein
                            </Link>
                          </footer>
                        </div>
                      </article>
                    );
                  }
                )
              )}
            </div>
          </PageSection>

          <aside className="deliveriesSideStack">
            <PageSection
              className="deliveriesAppsPanel"
              eyebrow="Schnellzugriff"
              title="Direkt nutzbar"
              description="Fahreraktionen ohne zusätzliche App."
              flat
            >
              <div className="deliveriesUtilityList">
                <div className="deliveriesUtilityItem">
                  <div className="deliveriesUtilityIcon">
                    ↗
                  </div>

                  <div>
                    <strong>
                      Google Maps
                    </strong>

                    <span>
                      Einzelroute oder
                      Tagesroute öffnen.
                    </span>
                  </div>

                  <small>
                    Ohne API
                  </small>
                </div>

                <div className="deliveriesUtilityItem">
                  <div className="deliveriesUtilityIcon">
                    ☎
                  </div>

                  <div>
                    <strong>
                      Telefon
                    </strong>

                    <span>
                      Ansprechpartner direkt
                      anrufen.
                    </span>
                  </div>

                  <small>Aktiv</small>
                </div>

                <div className="deliveriesUtilityItem">
                  <div className="deliveriesUtilityIcon">
                    ◌
                  </div>

                  <div>
                    <strong>
                      WhatsApp
                    </strong>

                    <span>
                      Nachricht automatisch
                      vorbereiten.
                    </span>
                  </div>

                  <small>Aktiv</small>
                </div>

                <div className="deliveriesUtilityItem">
                  <div className="deliveriesUtilityIcon">
                    ✉
                  </div>

                  <div>
                    <strong>
                      Fahrer-Mail
                    </strong>

                    <span>
                      Tourdaten per Mail
                      übergeben.
                    </span>
                  </div>

                  <small>Aktiv</small>
                </div>
              </div>
            </PageSection>

            <PageSection
              className="deliveriesDriverPanel"
              eyebrow="Nächster Schritt"
              title="Mobiler Fahrerlink"
              description="Geplante Erweiterung für externe Fahrer."
              soft
              flat
            >
              <div className="deliveriesDriverPreview">
                <span>
                  In Vorbereitung
                </span>

                <strong>
                  Fahrer ohne Gastario-Login
                </strong>

                <p>
                  Der Fahrer erhält später
                  einen sicheren Tourlink und
                  kann Route öffnen, Kunden
                  anrufen und Lieferungen als
                  zugestellt markieren.
                </p>

                <div>
                  <small>
                    Mobile Touransicht
                  </small>

                  <small>
                    Lieferstatus
                  </small>

                  <small>
                    Navigation
                  </small>
                </div>
              </div>
            </PageSection>
          </aside>
        </section>
      </PageShell>
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
      <PageShell className="deliveriesPage">
        <PageHeader
          eyebrow={`Fehler ${status}`}
          title="Lieferungen konnten nicht geladen werden"
          subtitle="Beim Laden des Fahrerplans ist ein Fehler aufgetreten."
        />

        <Notice type="danger">
          <strong>
            Technischer Fehler
          </strong>

          <span>
            {String(message)}
          </span>
        </Notice>

        <div className="deliveriesErrorActions">
          <Link
            to="/"
            className="deliveriesButton deliveriesButtonPrimary"
          >
            Zum Dashboard
          </Link>

          <Link
            to="/auftragseingang"
            className="deliveriesButton deliveriesButtonSecondary"
          >
            Auftragseingang
          </Link>

          <a
            href="/logout"
            className="deliveriesButton deliveriesButtonSecondary"
          >
            Ausloggen
          </a>
        </div>
      </PageShell>
    </AppLayout>
  );
}