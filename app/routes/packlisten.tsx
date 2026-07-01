import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import { useEffect, useState } from "react";

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
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Packlisten</h1>
          <span className="pageSubline">
            {data.tenantName} · Packlisten je Auftrag mit abhakbarer Fahrer- und Pack-Checkliste.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton" type="button" onClick={() => window.print()}>
            Drucken
          </button>
          <Link className="primaryButton" to="/lieferungen">
            Zu Lieferungen
          </Link>
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
            <p>Auftraege</p>
            <strong>{data.stats.orders}</strong>
            <span>zu packen</span>
          </div>
          <small data-trend="aktiv">Packen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Positionen</p>
            <strong>{data.stats.positions}</strong>
            <span>in Packlisten</span>
          </div>
          <small data-trend="bereit">Liste</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Menge</p>
            <strong>{data.stats.pieces}</strong>
            <span>gesamt</span>
          </div>
          <small data-trend="pruefen">Check</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Packlisten</p>
            <h2>Nach Auftrag</h2>
          </div>
        </div>

        <div className="deliveryRouteList">
          {data.packingItems.length === 0 ? (
            <article className="deliveryRouteCard">
              <div className="routeTime">
                <strong>-</strong>
                <span>Uhr</span>
              </div>
              <div className="routeContent">
                <div className="routeHeader">
                  <div>
                    <strong>Keine Packlisten gefunden</strong>
                    <span>Keine passenden Auftraege fuer diesen Tag.</span>
                  </div>
                  <em className="warning">Leer</em>
                </div>
              </div>
            </article>
          ) : (
            data.packingItems.map((order: any) => (
              <article className="deliveryRouteCard" key={order.id}>
                <div className="routeTime">
                  <strong>{order.deliveryTime || "-"}</strong>
                  <span>Uhr</span>
                </div>

                <div className="routeContent">
                  <div className="routeHeader">
                    <div>
                      <strong>{order.customerName}</strong>
                      <span>{formatDate(order.deliveryDate)} · {order.deliveryAddress || "Keine Adresse"}</span>
                    </div>
                    <em className="warning">Packen</em>
                  </div>

                  <div className="routeDetails">
                    <p>
                      <b>Auftrag</b>
                      <span>{order.orderNumber}</span>
                    </p>
                    <p>
                      <b>Kontakt</b>
                      <span>{order.contactName || "-"} · {order.contactPhone || "-"}</span>
                    </p>
                    <p>
                      <b>Adresse</b>
                      <span>{order.deliveryAddress || "Keine Adresse eingetragen"}</span>
                    </p>
                  </div>

                  <div className="compactList" style={{ marginTop: 12 }}>
                    {order.items.length === 0 ? (
                      <div className="compactItem">
                        <div>
                          <strong>Keine Positionen</strong>
                          <span>Dieser Auftrag hat keine Positionen.</span>
                        </div>
                        <small>-</small>
                      </div>
                    ) : (
                      order.items.map((item: any) => (
                        <div className="compactItem" key={`${order.id}-${item.id || item.name}`}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <PackingCheckbox id={`pack-${order.id}-${item.id || item.name}`} />
                            <div>
                              <strong>{item.name || "Position"}</strong>
                              <span>{item.unit || "Stueck"}</span>
                            </div>
                          </div>
                          <small>{item.quantity || 0} x</small>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12
                  }}>
                    {[
                      "Ware vollstaendig gepackt",
                      "Lieferschein beigelegt",
                      "Besteck / Servietten geprueft",
                      "Equipment gezaehlt",
                    ].map((task) => (
                      <label key={task} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "#f8fafc",
                        border: "1px solid #dbe5ee",
                        borderRadius: 14,
                        padding: 12,
                        fontWeight: 850
                      }}>
                        <PackingCheckbox id={`task-${order.id}-${task}`} />
                        <span>{task}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </AppLayout>
  );
}
