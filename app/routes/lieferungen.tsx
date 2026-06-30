import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function cleanPhone(value: string | null | undefined) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function mapsUrl(address: string | null | undefined) {
  if (!address) return "#";
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);
}

function routeUrl(addresses: string[]) {
  const clean = addresses.filter(Boolean);

  if (clean.length === 0) return "#";
  if (clean.length === 1) return mapsUrl(clean[0]);

  const destination = clean[clean.length - 1];
  const waypoints = clean.slice(0, -1);

  return (
    "https://www.google.com/maps/dir/?api=1" +
    "&destination=" + encodeURIComponent(destination) +
    "&waypoints=" + encodeURIComponent(waypoints.join("|"))
  );
}

function orderSummary(order: any) {
  if (!order.items || order.items.length === 0) return "Keine Positionen";

  return order.items
    .slice(0, 3)
    .map((item: any) => `${item.quantity} x ${item.name}`)
    .join(", ");
}

function mailBody(order: any) {
  const lines = [
    `Lieferung: ${order.orderNumber}`,
    `Kunde: ${order.customerName}`,
    `Datum: ${formatDate(order.deliveryDate)}`,
    `Uhrzeit: ${order.deliveryTime || "-"}`,
    `Adresse: ${order.deliveryAddress || "-"}`,
    `Kontakt: ${order.contactName || "-"}`,
    `Telefon: ${order.contactPhone || order.customerPhone || "-"}`,
    "",
    "Positionen:",
    ...(order.items || []).map((item: any) => `- ${item.quantity} ${item.unit || "Stueck"} ${item.name}`),
    "",
    "Route:",
    mapsUrl(order.deliveryAddress),
  ];

  return lines.join("\n");
}

function tourMailBody(orders: any[]) {
  const lines = [
    "Fahrertour Gastario",
    "",
    ...orders.flatMap((order: any, index: number) => [
      `${index + 1}. ${order.deliveryTime || "-"} Uhr · ${order.customerName}`,
      `Adresse: ${order.deliveryAddress || "-"}`,
      `Telefon: ${order.contactPhone || order.customerPhone || "-"}`,
      `Positionen: ${orderSummary(order)}`,
      "",
    ]),
    "Komplette Route:",
    routeUrl(orders.map((order: any) => order.deliveryAddress).filter(Boolean)),
  ];

  return lines.join("\n");
}

export function meta() {
  return [{ title: "Lieferungen · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "DELIVERIES");

  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "today";
  const selectedDate = url.searchParams.get("date") || todayInput();

  const tours = await prisma.deliveryTour.findMany({
    where: {
      tenantId: access.tenantId,
    },
    include: {
      stops: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: [
      { deliveryDate: "desc" },
      { createdAt: "desc" },
    ],
    take: 50,
  }).catch(() => []);

  const orders = await prisma.order.findMany({
    where: {
      tenantId: access.tenantId,
      status: "CONFIRMED" as any,
    },
    include: {
      items: true,
      customer: true,
    },
    orderBy: [
      { deliveryDate: "asc" },
      { deliveryTime: "asc" },
      { createdAt: "desc" },
    ],
    take: 500,
  });

  const today = todayInput();

  const filteredOrders = orders.filter((order: any) => {
    const date = normalizeDate(order.deliveryDate);

    if (range === "all") return true;
    if (range === "past") return date && date < today;
    if (range === "future") return date && date > today;
    if (range === "date") return date === selectedDate;

    return date === today;
  });

  const todayOrders = orders.filter((order: any) => normalizeDate(order.deliveryDate) === today);
  const futureOrders = orders.filter((order: any) => {
    const date = normalizeDate(order.deliveryDate);
    return date && date > today;
  });
  const pastOrders = orders.filter((order: any) => {
    const date = normalizeDate(order.deliveryDate);
    return date && date < today;
  });

  const availableDates = Array.from(
    new Set(
      orders
        .map((order: any) => normalizeDate(order.deliveryDate))
        .filter(Boolean)
    )
  ).sort();

  return {
    tenant: access.tenant,
    range,
    selectedDate,
    availableDates,
    orders: filteredOrders,
    stats: {
      today: todayOrders.length,
      future: futureOrders.length,
      past: pastOrders.length,
      all: orders.length,
      withoutAddress: filteredOrders.filter((order: any) => !order.deliveryAddress).length,
      withoutPhone: filteredOrders.filter((order: any) => !(order.contactPhone || order.customerPhone)).length,
    },
    tourMapUrl: routeUrl(filteredOrders.map((order: any) => order.deliveryAddress).filter(Boolean)),
    tourMailBody: tourMailBody(filteredOrders),
    tours,
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "DELIVERIES");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createTour") {
    const name = String(formData.get("name") || "").trim();
    const driverName = String(formData.get("driverName") || "").trim();
    const driverEmail = String(formData.get("driverEmail") || "").trim().toLowerCase();
    const driverPhone = String(formData.get("driverPhone") || "").trim();
    const deliveryDateRaw = String(formData.get("deliveryDate") || "").trim();

    if (!name) {
      return { error: "Tourname fehlt." };
    }

    const deliveryDate = deliveryDateRaw ? new Date(deliveryDateRaw + "T00:00:00") : null;

    await prisma.deliveryTour.create({
      data: {
        tenantId: access.tenantId,
        name,
        driverName: driverName || null,
        driverEmail: driverEmail || null,
        driverPhone: driverPhone || null,
        deliveryDate,
        status: "OPEN",
      },
    });

    return { success: "Tour wurde angelegt." };
  }

  if (intent === "addStop") {
    const tourId = String(formData.get("tourId") || "");
    const orderId = String(formData.get("orderId") || "");
    const sortOrder = Number(formData.get("sortOrder") || 0);
    const plannedTime = String(formData.get("plannedTime") || "").trim();

    if (!tourId || !orderId) {
      return { error: "Tour oder Auftrag fehlt." };
    }

    const tour = await prisma.deliveryTour.findFirst({
      where: {
        id: tourId,
        tenantId: access.tenantId,
      },
    });

    if (!tour) {
      return { error: "Tour nicht gefunden." };
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

    await prisma.deliveryStop.upsert({
      where: {
        tourId_orderId: {
          tourId,
          orderId,
        },
      },
      update: {
        sortOrder,
        plannedTime: plannedTime || order.deliveryTime || null,
      },
      create: {
        tenantId: access.tenantId,
        tourId,
        orderId,
        sortOrder,
        plannedTime: plannedTime || order.deliveryTime || null,
        status: "OPEN",
      },
    });

    return { success: "Stopp wurde zur Tour hinzugefuegt." };
  }

  if (intent === "updateStopStatus") {
    const stopId = String(formData.get("stopId") || "");
    const status = String(formData.get("status") || "OPEN");

    if (!stopId) {
      return { error: "Stopp fehlt." };
    }

    await prisma.deliveryStop.updateMany({
      where: {
        id: stopId,
        tenantId: access.tenantId,
      },
      data: {
        status,
      },
    });

    return { success: "Stopp-Status wurde gespeichert." };
  }

  if (intent === "deleteTour") {
    const tourId = String(formData.get("tourId") || "");

    if (!tourId) {
      return { error: "Tour fehlt." };
    }

    await prisma.deliveryTour.deleteMany({
      where: {
        id: tourId,
        tenantId: access.tenantId,
      },
    });

    return { success: "Tour wurde geloescht." };
  }

  return { error: "Unbekannte Aktion." };
}

const pillButton = {
  border: "1px solid #dbe5ee",
  background: "white",
  color: "#07111f",
  borderRadius: 999,
  padding: "10px 13px",
  fontWeight: 950,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  whiteSpace: "nowrap" as const,
};

const primaryPill = {
  ...pillButton,
  background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
  color: "white",
  borderColor: "transparent",
};

export default function DeliveriesPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Lieferungen</h1>
          <span className="pageSubline">
            {data.tenant.name} · echte Lieferungen aus bestaetigten Auftraegen mit Route, Anruf, WhatsApp und Fahrermail.
          </span>
        </div>

        <div className="topActions">
          <a
            className="secondaryButton"
            href={`mailto:?subject=${encodeURIComponent("Gastario Fahrertour")}&body=${encodeURIComponent(data.tourMailBody)}`}
          >
            Tour per Mail
          </a>

          <a
            className="primaryButton"
            href={data.tourMapUrl}
            target="_blank"
            rel="noreferrer"
          >
            Tourenmappe oeffnen
          </a>
        </div>
      </header>

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
            <p>Heute</p>
            <strong>{data.stats.today}</strong>
            <span>Lieferungen heute</span>
          </div>
          <small data-trend="aktiv">heute</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Kuenftig</p>
            <strong>{data.stats.future}</strong>
            <span>kommende Lieferungen</span>
          </div>
          <small data-trend="bereit">Planung</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Vergangen</p>
            <strong>{data.stats.past}</strong>
            <span>abgeschlossene Tage</span>
          </div>
          <small data-trend="pruefen">Archiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Fehlende Daten</p>
            <strong>{data.stats.withoutAddress + data.stats.withoutPhone}</strong>
            <span>Adresse oder Telefon fehlt</span>
          </div>
          <small data-trend="kritisch">Pruefen</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filter</p>
            <h2>Lieferungen anzeigen</h2>
          </div>

          <div className="filterActions">
            <a className="ghostButton" href="/lieferungen?range=today">Heute</a>
            <a className="ghostButton" href="/lieferungen?range=future">Kuenftig</a>
            <a className="ghostButton" href="/lieferungen?range=past">Vergangen</a>
            <a className="ghostButton" href="/lieferungen?range=all">Alle</a>
          </div>
        </div>

        <Form method="get" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
          <input type="hidden" name="range" value="date" />

          <select
            name="date"
            defaultValue={data.selectedDate}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "11px 12px",
              font: "inherit",
              background: "white",
            }}
          >
            {data.availableDates.length === 0 ? (
              <option value={data.selectedDate}>Keine Lieferdaten</option>
            ) : (
              data.availableDates.map((date: string) => (
                <option key={date} value={date}>
                  {new Date(date + "T00:00:00").toLocaleDateString("de-DE")}
                </option>
              ))
            )}
          </select>

          <button className="secondaryButton" type="submit">
            Datum anzeigen
          </button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Tourenplanung</p>
            <h2>Neue Fahrertour anlegen</h2>
          </div>
        </div>

        <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 170px auto", gap: 12, alignItems: "end" }}>
          <input type="hidden" name="intent" value="createTour" />

          <label>
            Tourname
            <input name="name" placeholder="Tour Vormittag" style={inputStyle} required />
          </label>

          <label>
            Fahrer
            <input name="driverName" placeholder="Mehmet" style={inputStyle} />
          </label>

          <label>
            Fahrer E-Mail
            <input name="driverEmail" type="email" placeholder="fahrer@..." style={inputStyle} />
          </label>

          <label>
            Fahrer Telefon
            <input name="driverPhone" placeholder="0176..." style={inputStyle} />
          </label>

          <label>
            Datum
            <input name="deliveryDate" type="date" defaultValue={data.selectedDate} style={inputStyle} />
          </label>

          <button className="primaryButton" type="submit">
            Tour anlegen
          </button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Gespeicherte Touren</p>
            <h2>Fahrertouren</h2>
          </div>
        </div>

        {data.tours.length === 0 ? (
          <div className="noteBox">
            <strong>Noch keine Tour angelegt.</strong>
            <p>Lege oben eine Tour an und fuege dann Lieferungen als Stopps hinzu.</p>
          </div>
        ) : (
          <div className="compactList">
            {data.tours.map((tour: any) => (
              <div className="compactItem" key={tour.id}>
                <div>
                  <strong>{tour.name}</strong>
                  <span>
                    Fahrer: {tour.driverName || "-"} · Stopps: {tour.stops.length}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {tour.driverEmail ? (
                    <a
                      className="ghostButton"
                      href={`mailto:${tour.driverEmail}?subject=${encodeURIComponent("Gastario Tour " + tour.name)}&body=${encodeURIComponent("Hallo, deine Tour ist in Gastario vorbereitet. Bitte im System die Stopps prüfen.")}`}
                    >
                      Mail
                    </a>
                  ) : null}

                  <Form method="post">
                    <input type="hidden" name="intent" value="deleteTour" />
                    <input type="hidden" name="tourId" value={tour.id} />
                    <button className="ghostButton" type="submit" style={{ color: "#b91c1c" }}>
                      Loeschen
                    </button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Fahrerplan</p>
              <h2>
                {data.range === "today"
                  ? "Heutige Lieferungen"
                  : data.range === "future"
                    ? "Kuenftige Lieferungen"
                    : data.range === "past"
                      ? "Vergangene Lieferungen"
                      : "Lieferungen"}
              </h2>
            </div>

            <a
              className="ghostButton"
              href={data.tourMapUrl}
              target="_blank"
              rel="noreferrer"
            >
              Komplette Route
            </a>
          </div>

          <div className="deliveryRouteList">
            {data.orders.length === 0 ? (
              <article className="deliveryRouteCard">
                <div className="routeTime">
                  <strong>-</strong>
                  <span>Uhr</span>
                </div>

                <div className="routeContent">
                  <div className="routeHeader">
                    <div>
                      <strong>Keine Lieferungen gefunden</strong>
                      <span>Keine bestaetigten Auftraege fuer diesen Filter.</span>
                    </div>
                    <em className="warning">Leer</em>
                  </div>
                </div>
              </article>
            ) : (
              data.orders.map((order: any, index: number) => {
                const phone = cleanPhone(order.contactPhone || order.customerPhone);
                const address = order.deliveryAddress || "";
                const map = mapsUrl(address);
                const whatsappUrl = phone
                  ? `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(`Hallo, hier ist der Fahrer fuer die Lieferung ${order.orderNumber} von Gastario.`)}`
                  : "#";

                return (
                  <article className="deliveryRouteCard" key={order.id}>
                    <div className="routeTime">
                      <strong>{order.deliveryTime || "-"}</strong>
                      <span>Uhr</span>
                    </div>

                    <div className="routeContent">
                      <div className="routeHeader">
                        <div>
                          <strong>{index + 1}. {order.customerName}</strong>
                          <span>{orderSummary(order)} · {formatDate(order.deliveryDate)}</span>
                        </div>
                        <em className={address && phone ? "success" : "warning"}>
                          {address && phone ? "Bereit" : "Daten fehlen"}
                        </em>
                      </div>

                      <div className="routeDetails">
                        <p>
                          <b>Adresse</b>
                          <span>{address || "Keine Adresse eingetragen"}</span>
                        </p>
                        <p>
                          <b>Kontakt</b>
                          <span>
                            {order.contactName || "-"} · {order.contactPhone || order.customerPhone || "Keine Telefonnummer"}
                          </span>
                        </p>
                        <p>
                          <b>Auftrag</b>
                          <span>{order.orderNumber} · {order.eventName || "Kein Eventname"}</span>
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                        <a style={primaryPill} href={map} target="_blank" rel="noreferrer">
                          Route oeffnen
                        </a>

                        {phone ? (
                          <a style={pillButton} href={`tel:${phone}`}>
                            Anrufen
                          </a>
                        ) : (
                          <span style={{ ...pillButton, opacity: .55 }}>
                            Keine Nummer
                          </span>
                        )}

                        {phone ? (
                          <a style={pillButton} href={whatsappUrl} target="_blank" rel="noreferrer">
                            WhatsApp
                          </a>
                        ) : null}

                        <a
                          style={pillButton}
                          href={`mailto:?subject=${encodeURIComponent(`Lieferung ${order.orderNumber}`)}&body=${encodeURIComponent(mailBody(order))}`}
                        >
                          Fahrer-Mail
                        </a>

                        <a style={pillButton} href={`/lieferscheine?date=${normalizeDate(order.deliveryDate)}`}>
                          Lieferschein
                        </a>

                        <a style={pillButton} href={`/fahrerzettel?date=${normalizeDate(order.deliveryDate)}`}>
                          Fahrerzettel
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Tourenlogik</p>
                <h2>Naechster Ausbau</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Automatische Touren</strong>
              <p>
                Als naechstes bauen wir Fahrer, Touren und Stopps als echte Datenbank-Modelle.
                Dann kann Gastario Auftraege nach Lieferzeit sortieren, einem Fahrer zuordnen
                und eine Google-Maps-Tour mit mehreren Stopps erstellen.
              </p>
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Fahrer</p>
                <h2>Checkliste</h2>
              </div>
            </div>

            <div className="taskList">
              {[
                "Ware vollstaendig geladen",
                "Lieferschein und Fahrerzettel dabei",
                "Telefonnummer vor Ort geprueft",
                "Equipment gezaehlt",
                "Rueckholung dokumentiert",
              ].map((item) => (
                <label key={item}>
                  <input type="checkbox" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Apps</p>
                <h2>Direkt eingebunden</h2>
              </div>
            </div>

            <div className="compactList">
              <div className="compactItem">
                <div>
                  <strong>Google Maps</strong>
                  <span>Route und komplette Tourenmappe.</span>
                </div>
                <small>aktiv</small>
              </div>

              <div className="compactItem">
                <div>
                  <strong>Telefon / WhatsApp</strong>
                  <span>Anruf oder Nachricht direkt vom Handy.</span>
                </div>
                <small>aktiv</small>
              </div>

              <div className="compactItem">
                <div>
                  <strong>Mail-App</strong>
                  <span>Fahrertour als vorbereitete E-Mail.</span>
                </div>
                <small>aktiv</small>
              </div>

              <div className="compactItem">
                <div>
                  <strong>Mailjet</strong>
                  <span>Automatischer Versand kommt als Server-Aktion.</span>
                </div>
                <small>naechster Schritt</small>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontWeight: 750,
  width: "100%",
};
