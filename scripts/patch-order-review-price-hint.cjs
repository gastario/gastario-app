const fs = require("fs");

const path = "app/routes/auftrag-pruefung.$orderId.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
`function getMissingOrderChecks(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const totalCents = items.reduce((sum: number, item: any) => sum + (item?.totalCents || 0), 0);
  const realItems = items.filter((item: any) => !isPlaceholderOrderItem(item));

  const missing: string[] = [];

  if (!String(order?.deliveryAddress || "").trim()) {
    missing.push("Lieferadresse fehlt");
  }

  if (!String(order?.deliveryTimeText || "").trim()) {
    missing.push("Lieferzeit fehlt");
  }

  if (realItems.length === 0) {
    missing.push("Keine echten bestellten Produkte erkannt");
  }

  if (totalCents <= 0) {
    missing.push("Summe ist 0 Euro");
  }

  return missing;
}`,
`function getOrderReviewState(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const totalCents = items.reduce((sum: number, item: any) => sum + (item?.totalCents || 0), 0);
  const realItems = items.filter((item: any) => !isPlaceholderOrderItem(item));
  const isHeycater = normalizeText(order?.platformName || order?.source).includes("heycater");

  const missing: string[] = [];
  const hints: string[] = [];

  if (!String(order?.deliveryAddress || "").trim()) {
    missing.push("Lieferadresse fehlt");
  }

  if (!String(order?.deliveryTimeText || "").trim()) {
    missing.push("Lieferzeit fehlt");
  }

  if (realItems.length === 0) {
    missing.push("Keine echten bestellten Produkte erkannt");
  }

  if (totalCents <= 0) {
    if (isHeycater && realItems.length > 0) {
      missing.push("Preise fehlen");
      hints.push("Die Positionen wurden aus einem Heycater-Lieferschein erkannt. Dieser Lieferschein enthaelt Mengen und Produkte, aber keine Preise.");
      hints.push("Bitte Preise ergaenzen oder die Heycater-Auftragsbestaetigung mit Preisen importieren.");
    } else {
      missing.push("Summe ist 0 Euro");
    }
  }

  return {
    missing,
    hints,
    totalCents,
    realItemCount: realItems.length,
    isHeycater,
  };
}

function getMissingOrderChecks(order: any) {
  return getOrderReviewState(order).missing;
}`
);

content = content.replace(
`  const missingChecks = getMissingOrderChecks(order);
  const canConfirmOrder = missingChecks.length === 0;`,
`  const reviewState = getOrderReviewState(order);
  const missingChecks = reviewState.missing;
  const canConfirmOrder = missingChecks.length === 0;`
);

content = content.replace(
`            {blocked ? (
              <div style={dangerSmallStyle}>
                Der Auftrag wurde nicht uebernommen, weil wichtige Daten fehlen.
              </div>
            ) : null}`,
`            {reviewState.hints.length > 0 ? (
              <div style={dangerHintBoxStyle}>
                {reviewState.hints.map((hint) => (
                  <div key={hint}>{hint}</div>
                ))}
              </div>
            ) : null}

            {blocked ? (
              <div style={dangerSmallStyle}>
                Der Auftrag wurde nicht uebernommen, weil wichtige Daten fehlen.
              </div>
            ) : null}`
);

content = content.replace(
`const dangerSmallStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  color: "#7f1d1d",
};`,
`const dangerSmallStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  color: "#7f1d1d",
};

const dangerHintBoxStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontSize: 13,
  lineHeight: 1.55,
};`
);

fs.writeFileSync(path, content, "utf8");
console.log("Auftragspruefung-Hinweis gepatcht.");
