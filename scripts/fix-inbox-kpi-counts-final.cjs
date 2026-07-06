const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// 1) Im Loader: heutiges Datum für aktuelle/bevorstehende Zählung ergänzen
if (!content.includes("const currentOrdersDateStart = new Date();")) {
  const marker = `  const dateRange = url.searchParams.get("dateRange") || "last7";

`;
  const insert = `  const currentOrdersDateStart = new Date();
  currentOrdersDateStart.setHours(0, 0, 0, 0);

`;

  if (!content.includes(marker)) {
    throw new Error("dateRange Marker nicht gefunden.");
  }

  content = content.replace(marker, marker + insert);
}

// 2) Counts im Loader auf aktuelle/bevorstehende Aufträge begrenzen, aber unabhängig vom aktiven Status
content = content.replace(
`      Promise.all([
        prisma.order.count({ where: { tenantId: tenantUser.tenantId } }),
        prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "AUTO_CREATED" as any } }),
        prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "CONFIRMED" as any } }),
        prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "REJECTED" as any } }),
      ]),`,
`      Promise.all([
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            OR: [{ deliveryDate: null }, { deliveryDate: { gte: currentOrdersDateStart } }],
          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "AUTO_CREATED" as any,
            OR: [{ deliveryDate: null }, { deliveryDate: { gte: currentOrdersDateStart } }],
          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "CONFIRMED" as any,
            OR: [{ deliveryDate: null }, { deliveryDate: { gte: currentOrdersDateStart } }],
          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "REJECTED" as any,
            OR: [{ deliveryDate: null }, { deliveryDate: { gte: currentOrdersDateStart } }],
          },
        }),
      ]),`
);

// 3) Frontend: currentOrderStats nicht mehr aus gefilterten orders berechnen
const statsStart = content.indexOf("  const currentOrdersForStats = sortedOrders.filter((order: any) => {");
const statsEnd = content.indexOf("\n\n  return (", statsStart);

if (statsStart !== -1 && statsEnd !== -1) {
  const replacement = `  const currentOrderStats = {
    all: data.counts?.all || 0,
    review: data.counts?.review || 0,
    confirmed: data.counts?.confirmed || 0,
    rejected: data.counts?.rejected || 0,
  };
`;

  content = content.slice(0, statsStart) + replacement + content.slice(statsEnd);
}

// 4) Obere Karten mit Infozeile ausstatten
const oldCard = `              <a key={String(label)} href={href} className={active ? "statCard active" : "statCard"}>
                <span>{label}</span>
                <strong>{count}</strong>
              </a>`;

const newCard = `              <a key={String(label)} href={href} className={active ? "statCard active" : "statCard"}>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>
                  {status === "AUTO_CREATED"
                    ? "aktuell offen"
                    : status === "CONFIRMED"
                      ? "bevorstehend"
                      : status === "REJECTED"
                        ? "nicht übernommen"
                        : "aktuell / kommend"}
                </small>
              </a>`;

if (content.includes(oldCard)) {
  content = content.replace(oldCard, newCard);
}

// 5) Kleine Infozeilen sichtbar und ruhiger stylen
const markerCss = "/* stat-card-info-lines-v18 */";

if (!content.includes(markerCss)) {
  const css = `
      <style>{\`
        ${markerCss}

        .statCard small {
          display: block !important;
          margin-top: 3px !important;
          font-size: 10.8px !important;
          line-height: 1.2 !important;
          font-weight: 500 !important;
          color: inherit !important;
          opacity: .72 !important;
        }

        .statCard {
          align-content: center !important;
          gap: 1px !important;
        }

        .statCard strong {
          font-weight: 600 !important;
          letter-spacing: -0.02em !important;
        }
      \`}</style>
`;

  const insertAt = content.lastIndexOf("</AppLayout>");
  if (insertAt === -1) throw new Error("AppLayout Ende nicht gefunden.");

  content = content.slice(0, insertAt) + css + "\n    " + content.slice(insertAt);
}

fs.writeFileSync(path, content, "utf8");
console.log("KPI-Karten zählen jetzt unabhängig vom aktiven Filter und haben Infozeilen.");
