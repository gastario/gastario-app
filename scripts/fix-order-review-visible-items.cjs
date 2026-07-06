const fs = require("fs");

const path = "app/routes/auftrag-pruefung.$orderId.tsx";
let content = fs.readFileSync(path, "utf8");

if (!content.includes("const visibleItems = order.items.filter")) {
  const totalLineRegex = /  const total = order\.items\.reduce\(\(sum[^;]+;\r?\n/;

  const match = content.match(totalLineRegex);

  if (!match) {
    throw new Error("const total Zeile nicht gefunden.");
  }

  const insert = match[0] + `  const correctionItems = order.items.filter((item) => isHeycaterCorrectionItem(item));
  const visibleItems = order.items.filter((item) => !isHeycaterCorrectionItem(item));
  const visibleItemsTotal = visibleItems.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const correctionTotal = correctionItems.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const hasHeycaterCorrection = correctionTotal > 0;
`;

  content = content.replace(match[0], insert);
}

fs.writeFileSync(path, content, "utf8");
console.log("visibleItems/correctionItems robust eingefuegt.");
