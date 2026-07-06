const fs = require("fs");

const path = "app/routes/auftrag-pruefung.$orderId.tsx";
let content = fs.readFileSync(path, "utf8");

if (!content.includes("function isHeycaterCorrectionItem")) {
  content = content.replace(
`function isPlaceholderOrderItem(item: any) {`,
`function isHeycaterCorrectionItem(item: any) {
  const name = normalizeText(item?.name);
  const notes = normalizeText(item?.notes);

  return (
    name.includes("fehlende position") ||
    name.includes("heycater-pdf") ||
    notes.includes("summenabgleich") ||
    notes.includes("gesamtbetrag netto aus der heycater-pdf")
  );
}

function isPlaceholderOrderItem(item: any) {`
  );
}

content = content.replace(
`  const total = order.items.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const reviewState = getOrderReviewState(order);
  const missingChecks = reviewState.missing;
  const canConfirmOrder = missingChecks.length === 0;
  const deliveryHref = "/lieferscheine" + (order.deliveryDate ? "?date=" + formatDateInput(order.deliveryDate) : "");`,
`  const total = order.items.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const correctionItems = order.items.filter((item) => isHeycaterCorrectionItem(item));
  const visibleItems = order.items.filter((item) => !isHeycaterCorrectionItem(item));
  const visibleItemsTotal = visibleItems.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const correctionTotal = correctionItems.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const hasHeycaterCorrection = correctionTotal > 0;
  const reviewState = getOrderReviewState(order);
  const missingChecks = reviewState.missing;
  const canConfirmOrder = missingChecks.length === 0;
  const deliveryHref = "/lieferscheine" + (order.deliveryDate ? "?date=" + formatDateInput(order.deliveryDate) : "");`
);

content = content.replaceAll(
`Bitte vor Uebernahme pruefen: Kunde, Lieferadresse, Datum, Uhrzeit und Positionen.`,
`Bitte vor Übernahme prüfen: Kunde, Lieferadresse, Datum, Uhrzeit und Positionen.`
);

content = content.replaceAll(
`Nicht uebernehmen: Erst Daten ergaenzen.`,
`Nicht übernehmen: Erst Daten ergänzen.`
);

content = content.replaceAll(
`geprueft`,
`geprüft`
);

content = content.replaceAll(
`pruefen`,
`prüfen`
);

content = content.replaceAll(
`uebernommen`,
`übernommen`
);

content = content.replace(
`              <span style={countBadgeStyle}>{order.items.length} Positionen</span>`,
`              <span style={countBadgeStyle}>{visibleItems.length} Positionen</span>`
);

content = content.replace(
`                {order.items.map((item) => (`,
`                {visibleItems.map((item) => (`
);

content = content.replace(
`                    <td style={tdMutedStyle}>{item.notes || "-"}</td>`,
`                    <td style={tdMutedStyle}>
                      {item.notes
                        ? String(item.notes).length > 180
                          ? String(item.notes).slice(0, 180) + "..."
                          : item.notes
                        : "-"}
                    </td>`
);

content = content.replace(
`            </table>
          </section>`,
`            </table>

            {hasHeycaterCorrection ? (
              <div style={{
                marginTop: 18,
                border: "1px solid #fed7aa",
                background: "#fff7ed",
                borderRadius: 18,
                padding: 16,
                display: "grid",
                gap: 12,
              }}>
                <div>
                  <div style={{
                    color: "#9a3412",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    fontSize: 11,
                    fontWeight: 950,
                    marginBottom: 4,
                  }}>
                    Heycater-Summenabgleich
                  </div>

                  <strong style={{ fontSize: 16, color: "#7c2d12" }}>
                    Die PDF-Endsumme ist höher als die einzeln erkannten Positionen.
                  </strong>

                  <p style={{
                    margin: "6px 0 0",
                    color: "#9a3412",
                    fontWeight: 750,
                    lineHeight: 1.45,
                  }}>
                    Gastario hat eine technische Kontrollsumme ergänzt, damit der Auftrag mit dem
                    Gesamtbetrag Netto aus der Heycater-PDF übereinstimmt. Bitte im PDF prüfen,
                    welche Positionen vom Parser übersehen wurden.
                  </p>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                }}>
                  <div style={{
                    background: "#ffffff",
                    border: "1px solid #fed7aa",
                    borderRadius: 14,
                    padding: 12,
                  }}>
                    <div style={{ color: "#9a3412", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
                      Erkannte Positionen
                    </div>
                    <strong style={{ display: "block", marginTop: 4 }}>
                      {centsToEuro(visibleItemsTotal)}
                    </strong>
                  </div>

                  <div style={{
                    background: "#ffffff",
                    border: "1px solid #fed7aa",
                    borderRadius: 14,
                    padding: 12,
                  }}>
                    <div style={{ color: "#9a3412", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
                      Automatisch ergänzt
                    </div>
                    <strong style={{ display: "block", marginTop: 4 }}>
                      {centsToEuro(correctionTotal)}
                    </strong>
                  </div>

                  <div style={{
                    background: "#ffffff",
                    border: "1px solid #fed7aa",
                    borderRadius: 14,
                    padding: 12,
                  }}>
                    <div style={{ color: "#9a3412", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>
                      Auftragssumme
                    </div>
                    <strong style={{ display: "block", marginTop: 4 }}>
                      {centsToEuro(total)}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}
          </section>`
);

fs.writeFileSync(path, content, "utf8");
console.log("Auftragsprüfung: Heycater-Korrekturposition als Summenbox dargestellt.");
