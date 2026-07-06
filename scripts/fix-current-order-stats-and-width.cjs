const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// 1) Nach visibleOrders zusätzliche aktuelle Zählungen einfügen
if (!content.includes("const currentOrdersForStats = sortedOrders.filter")) {
  const marker = "  const hiddenPastOrderCount = sortedOrders.length - visibleOrders.length;";
  const index = content.indexOf(marker);

  if (index === -1) {
    throw new Error("hiddenPastOrderCount Marker nicht gefunden.");
  }

  const insert = `
  const currentOrdersForStats = sortedOrders.filter((order: any) => {
    if (!order.deliveryDate) return true;

    const deliveryDate = new Date(order.deliveryDate);

    if (Number.isNaN(deliveryDate.getTime())) return true;

    const match = String(order.deliveryTimeText || "").match(/(\\d{1,2})[:.](\\d{2})/);

    if (match) {
      deliveryDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
    } else {
      deliveryDate.setHours(23, 59, 59, 999);
    }

    return deliveryDate.getTime() >= Date.now();
  });

  const currentOrderStats = {
    all: currentOrdersForStats.length,
    review: currentOrdersForStats.filter((order: any) => order.status === "AUTO_CREATED").length,
    confirmed: currentOrdersForStats.filter((order: any) => order.status === "CONFIRMED").length,
    rejected: currentOrdersForStats.filter((order: any) => order.status === "REJECTED").length,
  };
`;

  content = content.slice(0, index + marker.length) + "\n" + insert + content.slice(index + marker.length);
}

// 2) Alte obere Karten-Zahlen ersetzen
content = content.replace('["Alle Aufträge", data.counts.all, ""]', '["Alle Aufträge", currentOrderStats.all, ""]');
content = content.replace('["Zu prüfen", data.counts.review, "AUTO_CREATED"]', '["Zu prüfen", currentOrderStats.review, "AUTO_CREATED"]');
content = content.replace('["Übernommen", data.counts.confirmed, "CONFIRMED"]', '["Übernommen", currentOrderStats.confirmed, "CONFIRMED"]');
content = content.replace('["Abgelehnt", data.counts.rejected, "REJECTED"]', '["Abgelehnt", currentOrderStats.rejected, "REJECTED"]');

// 3) Kleine Infozeilen unter den KPI-Karten erzwingen
content = content.replace(
  /<div style=\{\{ fontSize: 12, fontWeight: 900, color: active \? "rgba\(255,255,255,\.8\)" : "#64748b" \}\}>\{label\}<\/div>\s*<strong[^>]*>\{count\}<\/strong>/,
  `<div style={{ fontSize: 12, fontWeight: 700, color: active ? "rgba(255,255,255,.85)" : "#64748b" }}>{label}</div>
                  <strong style={{ fontSize: 22, lineHeight: 1.05, fontWeight: 650 }}>{count}</strong>
                  <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 500, color: active ? "rgba(255,255,255,.85)" : "#64748b" }}>
                    {status === "AUTO_CREATED" ? "aktuell zu prüfen" : status === "CONFIRMED" ? "bevorstehend" : status === "REJECTED" ? "nicht übernommen" : "aktuelle Aufträge"}
                  </div>`
);

// 4) Breite und KPI-Look nochmal sauber final überschreiben
const cssMarker = "/* inbox-stats-current-and-wide-v17 */";

if (!content.includes(cssMarker)) {
  const css = `
      <style>{\`
        ${cssMarker}

        .inboxPage {
          max-width: 1360px !important;
          width: 100% !important;
          padding-left: 22px !important;
          padding-right: 22px !important;
        }

        .compactStats,
        section[style*="repeat(4"] {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 8px !important;
          margin-bottom: 10px !important;
        }

        .statCard,
        section[style*="repeat(4"] a {
          min-height: 52px !important;
          height: auto !important;
          padding: 9px 12px !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }

        .statCard strong,
        section[style*="repeat(4"] a strong {
          font-size: 22px !important;
          font-weight: 650 !important;
          line-height: 1.05 !important;
        }

        .ordersPanel,
        .inboxPanel,
        .inboxHero {
          max-width: none !important;
          width: 100% !important;
        }

        .ordersHead,
        .ordersRow {
          grid-template-columns: 1.15fr 1.25fr .85fr 1.55fr .72fr .72fr auto !important;
          gap: 12px !important;
        }

        @media (min-width: 1500px) {
          .inboxPage {
            max-width: 1420px !important;
          }
        }
      \`}</style>
`;

  const insertAt = content.lastIndexOf("</AppLayout>");

  if (insertAt === -1) {
    throw new Error("AppLayout-Ende nicht gefunden.");
  }

  content = content.slice(0, insertAt) + css + "\n    " + content.slice(insertAt);
}

fs.writeFileSync(path, content, "utf8");
console.log("Obere Auftrags-Karten auf aktuelle Aufträge umgestellt und Layout verbreitert.");
