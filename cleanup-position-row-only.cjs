const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Positionszeile sauberer: Artikel breit, Felder kompakt, Gesamt rechts als Box
text = text.replaceAll(
  `"34px minmax(520px, 1fr) 82px 110px 130px 90px 170px 30px"`,
  `"34px minmax(0, 1fr) 78px 104px 124px 82px 160px 28px"`
);

text = text.replaceAll(
  `"34px minmax(330px, 1fr) 78px 100px 120px 82px 142px 30px"`,
  `"34px minmax(0, 1fr) 78px 104px 124px 82px 160px 28px"`
);

// Positionszeile minimal ruhiger
text = text.replaceAll(
  `gap: 8,
                      alignItems: "start",
                      padding: "16px 18px",`,
  `gap: 8,
                      alignItems: "start",
                      padding: "15px 16px",`
);

text = text.replaceAll(
  `gap: 8,
                      alignItems: "start",
                      padding: "14px",`,
  `gap: 8,
                      alignItems: "start",
                      padding: "15px 16px",`
);

// Artikel-Freitext nicht zu dominant
text = text.replaceAll(
  `≡ FREITEXT zu dieser Position`,
  `≡ Freitext zu dieser Position`
);

// Gesamt/MwSt-Block rechts komplett neu stylen
text = text.replace(
/\s*<div style=\{\{ display: "grid", gap: 4, color: "#555", fontSize: 12, fontWeight: 700 \}\}>\r?\n\s*Gesamt\r?\n\s*<div\r?\n\s*data-line-total[\s\S]*?\r?\n\s*<\/select>\r?\n\s*<\/div>/,
`                        <div style={{
                          display: "grid",
                          gap: 6,
                          alignSelf: "stretch"
                        }}>
                          <div style={{
                            color: "#555",
                            fontSize: 11,
                            fontWeight: 750,
                            textAlign: "right"
                          }}>
                            Gesamt
                          </div>

                          <div style={{
                            display: "grid",
                            gap: 6,
                            justifyItems: "end",
                            alignContent: "start"
                          }}>
                            <div
                              data-line-total
                              style={{
                                minHeight: 24,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                color: "#111",
                                fontWeight: 950,
                                fontSize: 15,
                                lineHeight: 1
                              }}
                            >
                              0,00 €
                            </div>

                            <select
                              name="taxRate"
                              defaultValue="19"
                              style={{
                                height: 28,
                                width: 104,
                                border: "none",
                                borderRadius: 999,
                                background: "#444",
                                color: "white",
                                fontSize: 11,
                                fontWeight: 850,
                                padding: "2px 8px",
                                cursor: "pointer"
                              }}
                            >
                              <option value="19">USt 19 %</option>
                              <option value="7">USt 7 %</option>
                              <option value="0">USt 0 %</option>
                            </select>
                          </div>
                        </div>`
);

// Löschen-X sauber mittig rechts
text = text.replaceAll(
  `fontSize: 16, marginTop: 26`,
  `fontSize: 16, marginTop: 28`
);

// Buttonleiste unter den Positionen etwas höher trennen
text = text.replaceAll(
  `padding: "16px 18px", borderTop: "1px solid #d2d2d2", background: "#fafafa"`,
  `padding: "16px 18px", borderTop: "1px solid #d2d2d2", background: "#fafafa"`
);

fs.writeFileSync(file, text, "utf8");
