import { Form, Link, redirect, useLoaderData } from "react-router";
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
  const clean = String(address || "").trim();
  if (!clean) return "#";
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(clean);
}

function routeUrl(addresses: string[]) {
  const clean = addresses.map((item) => String(item || "").trim()).filter(Boolean);

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
    .slice(0, 4)
    .map((item: any) => `${item.quantity} x ${item.name}`)
    .join(", ");
}

export function meta() {
  return [{ title: "Lieferungen · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getUserId } = await import("../lib/auth.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: {
      userId,
    },
    include: {
      tenant: true,
    },
  });

  if (!tenantUser) {
    return {
      tenantName: "Kein Mandant",
      range: "today",
      selectedDate: todayInput(),
      orders: [],
      stats: {
        today: 0,
        future: 0,
        past: 0,
        all: 0,
        withoutAddress: 0,
        withoutPhone: 0,
      },
      tourMapUrl: "#",
      error: "Dein Benutzer ist noch keinem Mandanten zugeordnet.",
    };
  }

  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "today";
  const selectedDate = url.searchParams.get("date") || todayInput();
  const today = todayInput();

  const orders = await prisma.order.findMany({
    where: {
      tenantId: tenantUser.tenantId,
      status: "CONFIRMED" as any,
    },
    include: {
      items: true,
    },
    orderBy: [
      { deliveryDate: "asc" },
      { deliveryTime: "asc" },
      { createdAt: "desc" },
    ],
    take: 500,
  });

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
    tenantName: tenantUser.tenant.name,
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
    error: null,
  };
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontWeight: 750,
  width: "100%",
  background: "white",
};

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

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Lieferungen</h1>
          <span className="pageSubline">
            {data.tenantName} · Lieferungen aus bestaetigten Auftraegen mit Route, Anruf, WhatsApp und Fahrermail.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton" type="button" onClick={() => window.print()}>
            Drucken
          </button>

          <a className="primaryButton" href={data.tourMapUrl} target="_blank" rel="noreferrer">
            Tagesroute oeffnen
          </a>
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
            <span>alte Lieferungen</span>
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
            <Link className="ghostButton" to="/lieferungen?range=today">Heute</Link>
            <Link className="ghostButton" to="/lieferungen?range=future">Kuenftig</Link>
            <Link className="ghostButton" to="/lieferungen?range=past">Vergangen</Link>
            <Link className="ghostButton" to="/lieferungen?range=all">Alle</Link>
          </div>
        </div>

        <Form method="get" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
          <input type="hidden" name="range" value="date" />

          <select name="date" defaultValue={data.selectedDate} style={inputStyle}>
            {data.availableDates && data.availableDates.length > 0 ? (
              data.availableDates.map((date: string) => (
                <option key={date} value={date}>
                  {new Date(date + "T00:00:00").toLocaleDateString("de-DE")}
                </option>
              ))
            ) : (
              <option value={data.selectedDate}>Keine Lieferdaten</option>
            )}
          </select>

          <button className="secondaryButton" type="submit">
            Datum anzeigen
          </button>
        </Form>
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

            <a className="ghostButton" href={data.tourMapUrl} target="_blank" rel="noreferrer">
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
                const whatsapp = phone
                  ? `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(`Hallo, hier ist der Fahrer fuer die Lieferung ${order.orderNumber} von Gastario.`)}`
                  : "#";

                const mailBody = [
                  `Lieferung: ${order.orderNumber}`,
                  `Kunde: ${order.customerName}`,
                  `Datum: ${formatDate(order.deliveryDate)}`,
                  `Uhrzeit: ${order.deliveryTime || "-"}`,
                  `Adresse: ${address || "-"}`,
                  `Kontakt: ${order.contactName || "-"}`,
                  `Telefon: ${order.contactPhone || order.customerPhone || "-"}`,
                  "",
                  "Positionen:",
                  ...(order.items || []).map((item: any) => `- ${item.quantity} ${item.unit || "Stueck"} ${item.name}`),
                  "",
                  "Route:",
                  map,
                ].join("\n");

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
                          <a style={pillButton} href={whatsapp} target="_blank" rel="noreferrer">
                            WhatsApp
                          </a>
                        ) : null}

                        <a
                          style={pillButton}
                          href={`mailto:?subject=${encodeURIComponent(`Lieferung ${order.orderNumber}`)}&body=${encodeURIComponent(mailBody)}`}
                        >
                          Fahrer-Mail
                        </a>

                        <Link style={pillButton} to={`/lieferscheine?date=${normalizeDate(order.deliveryDate)}`}>
                          Lieferschein
                        </Link>
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
                <p className="eyebrow">Apps</p>
                <h2>Direkt nutzbar</h2>
              </div>
            </div>

            <div className="compactList">
              <div className="compactItem">
                <div>
                  <strong>Google Maps</strong>
                  <span>Route oder Tagesroute oeffnen.</span>
                </div>
                <small>ohne API</small>
              </div>

              <div className="compactItem">
                <div>
                  <strong>Telefon</strong>
                  <span>Anrufen direkt vom Handy.</span>
                </div>
                <small>aktiv</small>
              </div>

              <div className="compactItem">
                <div>
                  <strong>WhatsApp</strong>
                  <span>Nachricht an Ansprechpartner vorbereiten.</span>
                </div>
                <small>aktiv</small>
              </div>

              <div className="compactItem">
                <div>
                  <strong>Fahrermail</strong>
                  <span>Tourdaten per Mail-App senden.</span>
                </div>
                <small>aktiv</small>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Naechster Schritt</p>
                <h2>Public Fahrerlink</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Fahrer ohne Login</strong>
              <p>
                Als naechstes bauen wir einen sicheren Fahrerlink. Dann bekommt der Fahrer eine Tour aufs Handy
                und kann Route oeffnen, anrufen und geliefert markieren.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}

export function ErrorBoundary({ error }: { error: any }) {
  const message =
    error?.data ||
    error?.message ||
    "Unbekannter Fehler.";

  const status = error?.status || 500;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#edf2f6",
      padding: 32,
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#07111f"
    }}>
      <section style={{
        maxWidth: 820,
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 28,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)"
      }}>
        <div style={{
          color: "#b91c1c",
          textTransform: "uppercase",
          letterSpacing: ".11em",
          fontSize: 11,
          fontWeight: 950,
          marginBottom: 8
        }}>
          Fehler {status}
        </div>

        <h1 style={{
          margin: 0,
          fontSize: 38,
          lineHeight: 1,
          letterSpacing: "-0.055em"
        }}>
          Lieferungen konnten nicht geladen werden
        </h1>

        <p style={{
          margin: "14px 0 0",
          color: "#475569",
          fontWeight: 750,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap"
        }}>
          {String(message)}
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <a href="/" style={{
            border: "none",
            background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
            color: "white",
            borderRadius: 999,
            padding: "12px 16px",
            fontWeight: 950,
            textDecoration: "none"
          }}>
            Zum Dashboard
          </a>

          <a href="/auftragseingang" style={{
            border: "1px solid #dbe5ee",
            background: "white",
            color: "#07111f",
            borderRadius: 999,
            padding: "12px 16px",
            fontWeight: 950,
            textDecoration: "none"
          }}>
            Auftragseingang
          </a>

          <a href="/logout" style={{
            border: "1px solid #dbe5ee",
            background: "white",
            color: "#07111f",
            borderRadius: 999,
            padding: "12px 16px",
            fontWeight: 950,
            textDecoration: "none"
          }}>
            Ausloggen
          </a>
        </div>
      </section>
    </div>
  );
}
