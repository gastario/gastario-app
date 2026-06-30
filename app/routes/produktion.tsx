import { useLoaderData } from "react-router";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "PRODUCTION");

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

  const grouped = new Map<string, any>();

  for (const order of filteredOrders) {
    for (const item of order.items) {
      const key = `${item.name}__${item.unit || "Stueck"}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          name: item.name,
          unit: item.unit || "Stueck",
          quantity: 0,
          orders: [],
        });
      }

      const row = grouped.get(key);
      row.quantity += Number(item.quantity || 0);
      row.orders.push(order);
    }
  }

  const productionItems = Array.from(grouped.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de")
  );

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
    tenant: access.tenant,
    selectedDate,
    availableDates,
    orders: filteredOrders,
    productionItems,
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

const statGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const statCardStyle = {
  background: "white",
  border: "1px solid #dbe5ee",
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.07)",
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

const buttonStyle = {
  border: "1px solid #dbe5ee",
  background: "white",
  color: "#07111f",
  borderRadius: 999,
  padding: "11px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

export default function ProduktionPage() {
  const data = useLoaderData() as any;

  return (
    <div style={pageStyle}>
      <header style={{
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
            Produktion
          </h1>

          <p style={{
            margin: "12px 0 0",
            color: "#64748b",
            fontWeight: 700,
          }}>
            Produktionsliste aus uebernommenen Auftraegen fuer {data.tenant.name}.
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

      <section style={statGridStyle}>
        <article style={statCardStyle}>
          <div style={{ color: "#64748b", fontWeight: 900, marginBottom: 8 }}>Auftraege</div>
          <div style={{ fontSize: 36, fontWeight: 950 }}>{data.orders.length}</div>
        </article>

        <article style={statCardStyle}>
          <div style={{ color: "#64748b", fontWeight: 900, marginBottom: 8 }}>Produktionspositionen</div>
          <div style={{ fontSize: 36, fontWeight: 950 }}>{data.productionItems.length}</div>
        </article>

        <article style={statCardStyle}>
          <div style={{ color: "#64748b", fontWeight: 900, marginBottom: 8 }}>Datum</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>
            {data.selectedDate === "ohne-datum"
              ? "Ohne Datum"
              : new Date(data.selectedDate + "T00:00:00").toLocaleDateString("de-DE")}
          </div>
        </article>

        <article style={statCardStyle}>
          <div style={{ color: "#64748b", fontWeight: 900, marginBottom: 8 }}>Status</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>Uebernommen</div>
        </article>
      </section>

      <section style={panelStyle}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".10em",
            fontSize: 11,
            fontWeight: 950,
          }}>
            Zusammenfassung
          </div>

          <h2 style={{ margin: "5px 0 0", fontSize: 24, letterSpacing: "-0.04em" }}>
            Produktionsmengen
          </h2>
        </div>

        <div style={{ overflow: "auto", border: "1px solid #dbe5ee", borderRadius: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={thStyle}>Produkt / Gericht</th>
                <th style={thStyle}>Menge gesamt</th>
                <th style={thStyle}>Einheit</th>
                <th style={thStyle}>Auftraege</th>
              </tr>
            </thead>

            <tbody>
              {data.productionItems.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={4}>
                    Keine uebernommenen Auftraege fuer dieses Datum vorhanden.
                  </td>
                </tr>
              ) : (
                data.productionItems.map((item: any) => (
                  <tr key={item.name + item.unit}>
                    <td style={{ ...tdStyle, fontWeight: 950 }}>{item.name}</td>
                    <td style={tdStyle}>{item.quantity}</td>
                    <td style={tdStyle}>{item.unit}</td>
                    <td style={tdStyle}>
                      {item.orders.map((order: any) => (
                        <div key={order.id}>
                          {order.orderNumber} · {order.customerName}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".10em",
            fontSize: 11,
            fontWeight: 950,
          }}>
            Details
          </div>

          <h2 style={{ margin: "5px 0 0", fontSize: 24, letterSpacing: "-0.04em" }}>
            Auftraege fuer die Produktion
          </h2>
        </div>

        <div style={{ overflow: "auto", border: "1px solid #dbe5ee", borderRadius: 20 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
            <thead>
              <tr>
                <th style={thStyle}>Auftrag</th>
                <th style={thStyle}>Kunde</th>
                <th style={thStyle}>Lieferung</th>
                <th style={thStyle}>Adresse</th>
                <th style={thStyle}>Positionen</th>
                <th style={thStyle}>Notizen</th>
              </tr>
            </thead>

            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>
                    Keine Auftraege vorhanden.
                  </td>
                </tr>
              ) : (
                data.orders.map((order: any) => (
                  <tr key={order.id}>
                    <td style={{ ...tdStyle, fontWeight: 950 }}>{order.orderNumber}</td>
                    <td style={tdStyle}>
                      {order.customerName}
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {order.customerEmail || "-"}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {formatDate(order.deliveryDate)}
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        {order.deliveryTime || "-"}
                      </div>
                    </td>
                    <td style={tdStyle}>{order.deliveryAddress || "-"}</td>
                    <td style={tdStyle}>
                      {order.items.map((item: any) => (
                        <div key={item.id}>
                          {item.quantity} × {item.name}
                        </div>
                      ))}
                    </td>
                    <td style={tdStyle}>{order.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
