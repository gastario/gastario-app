import { Form, useLoaderData } from "react-router";
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

export function meta() {
  return [{ title: "Einkauf · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "PURCHASING");

  const url = new URL(request.url);
  const selectedDate = url.searchParams.get("date") || todayInput();

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
    take: 300,
  });

  const filteredOrders = orders.filter((order) => {
    if (!order.deliveryDate) return selectedDate === "ohne-datum";
    return normalizeDate(order.deliveryDate) === selectedDate;
  });

  const availableDates = Array.from(
    new Set(
      orders.map((order) =>
        order.deliveryDate ? normalizeDate(order.deliveryDate) : "ohne-datum"
      )
    )
  ).sort();

  if (!availableDates.includes(selectedDate)) {
    availableDates.unshift(selectedDate);
  }

  const grouped = new Map<string, any>();

  for (const order of filteredOrders) {
    for (const item of order.items) {
      const unit = item.unit || "Stueck";
      const key = `${item.name}__${unit}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          name: item.name,
          unit,
          quantity: 0,
          orders: [],
        });
      }

      const row = grouped.get(key);
      row.quantity += Number(item.quantity || 0);
      row.orders.push({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
      });
    }
  }

  const demandItems = Array.from(grouped.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de")
  );

  return {
    tenant: access.tenant,
    selectedDate,
    availableDates,
    orders: filteredOrders,
    demandItems,
  };
}

export default function PurchasingPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Einkauf & Lager</p>
          <h1>Einkauf</h1>
          <span className="pageSubline">
            Einkaufsvorschlaege aus uebernommenen Auftraegen fuer {data.tenant.name}.
          </span>
        </div>

        <div className="topActions">
          <Form method="get" style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
              {data.availableDates.map((date: string) => (
                <option key={date} value={date}>
                  {date === "ohne-datum"
                    ? "Ohne Datum"
                    : new Date(date + "T00:00:00").toLocaleDateString("de-DE")}
                </option>
              ))}
            </select>

            <button className="secondaryButton" type="submit">
              Anzeigen
            </button>
          </Form>

          <button className="primaryButton" type="button" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Auftraege</p>
            <strong>{data.orders.length}</strong>
            <span>fuer dieses Datum</span>
          </div>
          <small data-trend="aktiv">bestaetigt</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Einkaufspositionen</p>
            <strong>{data.demandItems.length}</strong>
            <span>aus Auftragspositionen</span>
          </div>
          <small data-trend="pruefen">MVP</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Datum</p>
            <strong style={{ fontSize: 26 }}>
              {data.selectedDate === "ohne-datum"
                ? "Ohne Datum"
                : new Date(data.selectedDate + "T00:00:00").toLocaleDateString("de-DE")}
            </strong>
            <span>ausgewaehlter Liefertag</span>
          </div>
          <small data-trend="info">Filter</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Bedarf</p>
              <h2>Automatische Einkaufsvorschlaege</h2>
            </div>
            <button className="ghostButton" type="button" onClick={() => window.print()}>
              Druckansicht
            </button>
          </div>

          <div className="purchaseDemandTable">
            <div className="purchaseDemandHead">
              <span>Artikel / Produkt</span>
              <span>Benoetigt</span>
              <span>Einheit</span>
              <span>Quelle</span>
              <span>Auftraege</span>
            </div>

            {data.demandItems.length === 0 ? (
              <div className="purchaseDemandRow">
                <strong>Keine Einkaufsvorschlaege vorhanden.</strong>
                <span>-</span>
                <span>-</span>
                <span>-</span>
                <span>-</span>
              </div>
            ) : (
              data.demandItems.map((item: any) => (
                <div className="purchaseDemandRow" key={`${item.name}-${item.unit}`}>
                  <strong>{item.name}</strong>
                  <span>{item.quantity}</span>
                  <span>{item.unit}</span>
                  <em>Auftrag</em>
                  <span>
                    {item.orders.map((order: any) => (
                      <span key={order.id} style={{ display: "block" }}>
                        {order.orderNumber} · {order.customerName}
                      </span>
                    ))}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">MVP</p>
                <h2>Aktueller Stand</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Einfache Einkaufsliste</strong>
              <p>
                Aktuell werden Auftragspositionen zusammengefasst. Im naechsten Schritt
                verknuepfen wir Produkte mit Rezepten, Zutaten, Einheiten und Lieferanten.
              </p>
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Naechster Schritt</p>
                <h2>Rezepturen</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Produkt → Zutaten</strong>
              <p>
                Sobald Rezepte gepflegt sind, berechnet Gastario automatisch den echten
                Zutatenbedarf und gruppiert die Einkaufsliste nach Lieferanten.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
