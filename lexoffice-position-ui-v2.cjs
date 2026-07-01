const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Positions-Card flacher und mehr wie Lexoffice
text = text.replaceAll(
  `border: "1px solid #dbe3ec",
              borderRadius: 14,
              background: "#ffffff",
              overflow: "hidden"`,
  `border: "1px solid #d6d6d6",
              borderRadius: 4,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)"`
);

// Positionszeile weniger hoch / ruhiger
text = text.replaceAll(
  `gap: 8,
                  alignItems: "start",
                  padding: "16px 18px",`,
  `gap: 8,
                  alignItems: "center",
                  padding: "14px 16px",`
);

// Grid mehr wie Lexoffice: Artikel breit, Felder kompakter
text = text.replaceAll(
  `"42px minmax(360px, 1.6fr) 88px 116px 138px 88px 92px 105px 40px"`,
  `"42px minmax(300px, 1fr) 86px 110px 130px 86px 88px 98px 34px"`
);

// Nummernkreis grauer wie Lexoffice
text = text.replaceAll(
  `background: "#eef3f7",
                    color: "#64748b",`,
  `background: "#eeeeee",
                    color: "#555555",`
);

// Labels dezenter
text = text.replaceAll(
  `color: "#64748b", fontSize: 12, fontWeight: 850`,
  `color: "#777777", fontSize: 11, fontWeight: 700`
);

// Button löschen mehr wie Icon
text = text.replaceAll(
  `background: "#fff1f2",
                          color: "#991b1b",
                          borderRadius: 10,
                          minHeight: 40,`,
  `background: "transparent",
                          color: "#777777",
                          borderRadius: 4,
                          minHeight: 36,`
);

// Gesamtbetrag rechts stärker wie Lexoffice
text = text.replaceAll(
  `minHeight: 42,
                          borderRadius: 12,
                          background: "#ffffff",
                          border: "1px solid #dbe3ec",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          padding: "0 12px",
                          color: "#07111f",
                          fontWeight: 950`,
  `minHeight: 36,
                          borderRadius: 0,
                          background: "transparent",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          padding: "0 4px",
                          color: "#111111",
                          fontWeight: 900`
);

// Freitext-Details schmaler / dezenter
text = text.replaceAll(
  `border: "1px dashed #cbd5e1",
                          borderRadius: 12,
                          padding: "9px 11px",
                          background: "#f8fafc"`,
  `border: "none",
                          borderRadius: 4,
                          padding: "4px 0",
                          background: "transparent"`
);

text = text.replaceAll(
  `color: "#0f766e",
                            fontWeight: 900,
                            fontSize: 13`,
  `color: "#333333",
                            fontWeight: 700,
                            fontSize: 13`
);

// Buttonleiste mehr wie Lexoffice
text = text.replaceAll(
  `display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 12px",
                borderTop: "1px solid #e5edf5",
                background: "#f8fafc"`,
  `display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                padding: "18px 12px 22px",
                borderTop: "1px solid #e0e0e0",
                background: "#ffffff"`
);

// Buttonfarben Lexoffice-ähnlicher
text = text.replaceAll(
  `border: "1px solid #0f766e",
                      background: "#ecfdf5",
                      color: "#0f766e",
                      borderRadius: 999,
                      padding: "10px 14px",`,
  `border: "1px solid #10a66a",
                      background: "#ffffff",
                      color: "#10a66a",
                      borderRadius: 3,
                      padding: "8px 14px",`
);

text = text.replaceAll(
  `border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#334155",
                      borderRadius: 999,
                      padding: "10px 14px",`,
  `border: "none",
                      background: "#ffffff",
                      color: "#333333",
                      borderRadius: 3,
                      padding: "8px 10px",`
);

text = text.replaceAll(
  `border: "1px solid #e5e7eb",
                      background: "#f3f4f6",
                      color: "#9ca3af",
                      borderRadius: 999,
                      padding: "10px 14px",`,
  `border: "none",
                      background: "#ffffff",
                      color: "#333333",
                      borderRadius: 3,
                      padding: "8px 10px",`
);

// Disabled nicht grau blockig, sondern wie Lexoffice Menüpunkt
text = text.replaceAll(
  `cursor: "not-allowed"`,
  `cursor: "pointer"`
);

text = text.replaceAll(
  `disabled
                    style=`,
  `style=`
);

// Summenleiste unten statt schwarzer Pill rechts
text = text.replaceAll(
  `minWidth: 210,
                  borderRadius: 12,
                  background: "#07111f",
                  color: "white",
                  padding: "10px 14px",
                  fontWeight: 950,
                  textAlign: "right"`,
  `position: "absolute",
                  right: 0,
                  bottom: -44,
                  minWidth: 260,
                  borderRadius: "4px 4px 0 0",
                  background: "#555555",
                  color: "white",
                  padding: "12px 18px",
                  fontWeight: 800,
                  textAlign: "center"`
);

// Container für Summenposition relativ machen
text = text.replaceAll(
  `background: "#ffffff"
              }}>`,
  `background: "#ffffff",
              position: "relative",
              marginBottom: 44
              }}>`
);

fs.writeFileSync(file, text, "utf8");
