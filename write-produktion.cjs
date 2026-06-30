const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes", "produktion.tsx");

const content = String.raw`
import { useLoaderData } from "react-router";

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
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
  const today = formatDateInput(new Date());
  const selectedDate = url.searchParams.get("date") || today;

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

  const groupedItems = new Map();

  for (const order of filteredOrders) {
    for (const item of order.items) {
      const key = item.name + "||" + item.unit;
      const existing = groupedItems.get(key);

      if (existing) {
        existing.quantity += Number(item.quantity || 0);
        existing.orders.push(order);
      } else {
        groupedItems.set(key, {
          name: item.name,
          unit: item.unit || "Stück",
          quantity: Number(item.quantity || 0),
          orders: [order],
        });
      }
    }
  }

  const productionItems = Array.from(groupedItems.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de")
  );

  const availableDates = Array.from(
    new Set(
      orders.map((order) => order.deliveryDate ? normalizeDate(order.deliveryDate) : "ohne-datum")
    )
  ).sort();

  return {
    tenant: tenantUser.tenant,
    selectedDate,
    availableDates,
    orders: filteredOrders,
    productionItems,
  };
}

export default function ProduktionPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="page">
      <style>{`
        body {
          margin: 0;
          background: #edf2f6;
          color: #07111f;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .page {
          min-height: 100vh;
          padding: 32px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .kicker {
          color: #0f766e;
          text-transform: uppercase;
          letter-spacing: .11em;
          font-size: 11px;
          font-weight: 950;
          margin-bottom: 8px;
        }

        h1 {
          margin: 0;
          font-size: 44px;
          line-height: .95;
          letter-spacing: -0.065em;
        }

        .subtitle {
          margin: 12px 0 0;
          color: #64748b;
          font-weight: 700;
        }

        .btn {
          border: 1px solid #dbe5ee;
          background: white;
          color: #07111f;
          border-radius: 999px;
          padding: 11px 16px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        }

        .btnPrimary {
          background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
          border-color: transparent;
          color: white;
        }

        .panel {
          background: white;
          border: 1px solid #dbe5ee;
          border-radius: 28px;
          padding: 22px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
          margin-bottom: 20px;
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .panelKicker {
          color: #0f766e;
          text-transform: uppercase;
          letter-spacing: .10em;
          font-size: 11px;
          font-weight: 950;
        }

        .panelTitle {
          margin: 5px 0 0;
          font-size: 24px;
          letter-spacing: -0.04em;
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .statCard {
          background: white;
          border: 1px solid #dbe5ee;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.07);
        }

        .statLabel {
          color: #64748b;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .statValue {
          font-size: 36px;
          line-height: 1;
          letter-spacing: -0.05em;
          font-weight: 950;
        }

        .tableWrap {
          overflow: auto;
          border: 1px solid #dbe5ee;
          border-radius: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }

        th {
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: .075em;
          padding: 14px 15px;
          border-bottom: 1px solid #dbe5ee;
          font-weight: 950;
        }

        td {
          padding: 15px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: top;
          font-weight: 720;
        }

        tr:last-child td {
          border-bottom: none;
        }

        .tenantName {
          font-weight: 950;
          color: #07111f;
        }

        select,
        input {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 11px 12px;
          font: inherit;
          background: white;
        }

        .printOnly {
          display: none;
        }

        @media print {
          .noPrint {
            display: none !important;
          }

          .printOnly {
            display: block;
          }

          body {
            background: white;
          }

          .page {
            padding: 0;
          }

          .panel {
            box-shadow: none;
            border-radius: 0;
            border: none;
            padding: 0;
          }

          .statGrid {
            display: none;
          }
        }
      `}</style>

      <header className="topbar">
        <div>
          <div className="kicker">Gastario</div>
          <h1>Produktion</h1>
          <p className="subtitle">
            Produktionsliste aus übernommenen Aufträgen für {data.tenant.name}.
          </p>
        </div>

        <div className="noPrint" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <form method="get" style={{ display: "flex", gap: 10 }}>
            <select name="date" defaultValue={data.selectedDate}>
              {data.availableDates.length === 0 ? (
                <option value={data.selectedDate}>{data.selectedDate}</option>
              ) : (
                data.availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date === "ohne-datum" ? "Ohne Datum" : new Date(date + "T00:00:00").toLocaleDateString("de-DE")}
                  </option>
                ))
              )}
            </select>
            <button className="btn" type="submit">Anzeigen</button>
          </form>

          <button className="btn btnPrimary" type="button" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </header>

      <div className="printOnly">
        <h2>Produktionsliste</h2>
        <p>
          Datum: {data.selectedDate === "ohne-datum" ? "Ohne Datum" : new Date(data.selectedDate + "T00:00:00").toLocaleDateString("de-DE")}
        </p>
      </div>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Aufträge</div>
          <div className="statValue">{data.orders.length}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Produktionspositionen</div>
          <div className="statValue">{data.productionItems.length}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Datum</div>
          <div className="statValue" style={{ fontSize: 24 }}>
            {data.selectedDate === "ohne-datum" ? "Ohne Datum" : new Date(data.selectedDate + "T00:00:00").toLocaleDateString("de-DE")}
          </div>
        </article>

        <article className="statCard">
          <div className="statLabel">Status</div>
          <div className="statValue" style={{ fontSize: 24 }}>Übernommen</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Zusammenfassung</div>
            <h2 className="panelTitle">Produktionsmengen</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Produkt / Gericht</th>
                <th>Menge gesamt</th>
                <th>Einheit</th>
                <th>Aufträge</th>
              </tr>
            </thead>
            <tbody>
              {data.productionItems.length === 0 ? (
                <tr>
                  <td colSpan={4}>Keine übernommenen Aufträge für dieses Datum vorhanden.</td>
                </tr>
              ) : (
                data.productionItems.map((item) => (
                  <tr key={item.name + item.unit}>
                    <td className="tenantName">{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td>
                      {item.orders.map((order) => (
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

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Details</div>
            <h2 className="panelTitle">Aufträge für die Produktion</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Auftrag</th>
                <th>Kunde</th>
                <th>Lieferung</th>
                <th>Adresse</th>
                <th>Positionen</th>
                <th>Notizen</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td colSpan={6}>Keine Aufträge vorhanden.</td>
                </tr>
              ) : (
                data.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="tenantName">{order.orderNumber}</td>
                    <td>
                      {order.customerName}
                      <div style={{ color: "#64748b", fontSize: 12 }}>{order.customerEmail || "-"}</div>
                    </td>
                    <td>
                      {formatDate(order.deliveryDate)}
                      <div style={{ color: "#64748b", fontSize: 12 }}>{order.deliveryTime || "-"}</div>
                    </td>
                    <td>{order.deliveryAddress || "-"}</td>
                    <td>
                      {order.items.map((item) => (
                        <div key={item.id}>
                          {item.quantity} × {item.name}
                        </div>
                      ))}
                    </td>
                    <td>{order.notes || "-"}</td>
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
`;

fs.writeFileSync(file, content, "utf8");
console.log("Produktion geschrieben:", file);
