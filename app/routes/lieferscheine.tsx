import { useLoaderData } from "react-router";

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

export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw new Response("Nicht angemeldet", { status: 401 });
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!tenantUser) {
    throw new Response("Kein Mandant gefunden", { status: 403 });
  }

  const url = new URL(request.url);
  const selectedDate = url.searchParams.get("date") || todayInput();

  const orders = await prisma.order.findMany({
    where: {
      tenantId: tenantUser.tenantId,
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

  return {
    tenant: tenantUser.tenant,
    selectedDate,
    availableDates,
    orders: filteredOrders,
  };
}

const pageStyle = {
  minHeight: "100vh",
  background: "#edf2f6",
  padding: 32,
  fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  color: "#07111f",
};

const panelStyle = {
  background: "white",
  border: "1px solid #dbe5ee",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
  marginBottom: 20,
};

const buttonStyle = {
  border: "1px solid #dbe5ee",
  background: "white",
  color: "#07111f",
  borderRadius: 999,
  padding: "11px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const thStyle = {
  textAlign: "left" as const,
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 11.5,
  textTransform: "uppercase" as const,
  letterSpacing: ".075em",
  padding: "14px 15px",
  borderBottom: "1px solid #dbe5ee",
  fontWeight: 950,
};

const tdStyle = {
  padding: 15,
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "top" as const,
  fontWeight: 720,
};

export default function LieferscheinePage() {
  const data = useLoaderData() as any;

  return (
    <div style={pageStyle}>
      <style>{`
        @media print {
          body {
            background: white !important;
          }

          .noPrint {
            display: none !important;
          }

          .deliveryCard {
            page-break-after: always;
            box-shadow: none !important;
            border: 1px solid #111827 !important;
            border-radius: 0 !important;
          }

          .deliveryCard:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      <header className="noPrint" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 20,
        marginBottom: 24,
      }}>
        <div>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".11em",
            fontSize: 11,
            fontWeight: 950,
            marginBottom: 8,
          }}>
            Gastario
          </div>

          <h1 style={{
            margin: 0,
            fontSize: 44,
            lineHeight: .95,
            letterSpacing: "-0.065em",
          }}>
            Lieferscheine & Fahrerzettel
          </h1>

          <p style={{
            margin: "12px 0 0",
            color: "#64748b",
            fontWeight: 700,
          }}>
            Lieferunterlagen aus übernommenen Aufträgen für {data.tenant.name}.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <form method="get" style={{ display: "flex", gap: 10 }}>
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

            <button style={buttonStyle} type="submit">
              Anzeigen
            </button>
          </form>

          <button
            style={{
              ...buttonStyle,
              background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
              color: "white",
              borderColor: "transparent",
            }}
            type="button"
            onClick={() => window.print()}
          >
            Drucken
          </button>
        </div>
      </header>

      <section className="noPrint" style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 16,
        marginBottom: 20,
      }}>
        <article style={panelStyle}>
          <div style={{ color: "#64748b", fontWeight: 900, marginBottom: 8 }}>Lieferungen</div>
          <div style={{ fontSize: 36, fontWeight: 950 }}>{data.orders.length}</div>
        </article>

        <article style={panelStyle}>
          <div style={{ color: "#64748b", fontWeight: 900, marginBottom: 8 }}>Datum</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>
            {data.selectedDate === "ohne-datum"
              ? "Ohne Datum"
              : new Date(data.selectedDate + "T00:00:00").toLocaleDateString("de-DE")}
          </div>
        </article>

        <article style={panelStyle}>
          <div style={{ color: "#64748b", fontWeight: 900, marginBottom: 8 }}>Status</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>Übernommen</div>
        </article>
      </section>

      {data.orders.length === 0 ? (
        <section style={panelStyle}>
          Keine übernommenen Aufträge für dieses Datum vorhanden.
        </section>
      ) : (
        data.orders.map((order: any) => (
          <section key={order.id} className="deliveryCard" style={panelStyle}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              alignItems: "flex-start",
              borderBottom: "1px solid #dbe5ee",
              paddingBottom: 18,
              marginBottom: 18,
            }}>
              <div>
                <div style={{
                  color: "#0f766e",
                  textTransform: "uppercase",
                  letterSpacing: ".10em",
                  fontSize: 11,
                  fontWeight: 950,
                }}>
                  Lieferschein / Fahrerzettel
                </div>

                <h2 style={{
                  margin: "5px 0 0",
                  fontSize: 30,
                  letterSpacing: "-0.04em",
                }}>
                  {order.orderNumber}
                </h2>

                <p style={{
                  margin: "8px 0 0",
                  color: "#64748b",
                  fontWeight: 750,
                }}>
                  {order.customerName} · {order.eventName || "Kein Eventname"}
                </p>
              </div>

              <div style={{
                border: "1px solid #dbe5ee",
                borderRadius: 18,
                padding: 14,
                background: "#f8fafc",
                fontWeight: 850,
                minWidth: 220,
              }}>
                <div>Datum: {formatDate(order.deliveryDate)}</div>
                <div>Uhrzeit: {order.deliveryTime || "-"}</div>
                <div>Quelle: {order.source}</div>
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 18,
            }}>
              <div style={{
                border: "1px solid #dbe5ee",
                borderRadius: 18,
                padding: 16,
                background: "#f8fafc",
              }}>
                <strong>Lieferadresse</strong>
                <div style={{ marginTop: 8, color: "#334155", fontWeight: 750, whiteSpace: "pre-wrap" }}>
                  {order.deliveryAddress || "-"}
                </div>
              </div>

              <div style={{
                border: "1px solid #dbe5ee",
                borderRadius: 18,
                padding: 16,
                background: "#f8fafc",
              }}>
                <strong>Ansprechpartner vor Ort</strong>
                <div style={{ marginTop: 8, color: "#334155", fontWeight: 750 }}>
                  {order.contactName || "-"}
                  <br />
                  {order.contactPhone || "-"}
                  <br />
                  {order.customerEmail || "-"}
                </div>
              </div>
            </div>

            <div style={{ overflow: "auto", border: "1px solid #dbe5ee", borderRadius: 20, marginBottom: 18 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Position</th>
                    <th style={thStyle}>Menge</th>
                    <th style={thStyle}>Einheit</th>
                    <th style={thStyle}>Notiz</th>
                  </tr>
                </thead>

                <tbody>
                  {order.items.map((item: any) => (
                    <tr key={item.id}>
                      <td style={{ ...tdStyle, fontWeight: 950 }}>{item.name}</td>
                      <td style={tdStyle}>{item.quantity}</td>
                      <td style={tdStyle}>{item.unit || "Stück"}</td>
                      <td style={tdStyle}>{item.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {order.notes ? (
              <div style={{
                border: "1px solid #fed7aa",
                borderRadius: 18,
                padding: 16,
                background: "#fff7ed",
                color: "#9a3412",
                fontWeight: 850,
                marginBottom: 18,
              }}>
                <strong>Auftragsnotiz:</strong> {order.notes}
              </div>
            ) : null}

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
              marginTop: 24,
            }}>
              <div style={{
                borderTop: "1px solid #111827",
                paddingTop: 8,
                fontWeight: 850,
              }}>
                Fahrer / Übergabe
              </div>

              <div style={{
                borderTop: "1px solid #111827",
                paddingTop: 8,
                fontWeight: 850,
              }}>
                Kunde / Empfang
              </div>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
