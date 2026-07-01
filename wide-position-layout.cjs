const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Seite breiter nutzen
text = text.replaceAll("maxWidth: 1080", "maxWidth: 1360");
text = text.replaceAll("maxWidth: 1180", "maxWidth: 1360");
text = text.replaceAll("maxWidth: 1240", "maxWidth: 1360");

// Datum wieder mit Auswahl, falls noch Textfeld drin ist
text = text.replace(
`<input
              name="deliveryDate"
              type="text"
              inputMode="numeric"
              placeholder="Datum, z. B. 01.07.2026"
              style={{ ...inputStyle, borderRadius: 3 }}
            />`,
`<input
              name="deliveryDate"
              type="date"
              style={inputStyle}
            />`
);

// Positionszeile breiter, Artikel deutlich größer, Summe+MwSt rechts als eigene Box
text = text.replaceAll(
  `"34px minmax(330px, 1fr) 78px 100px 120px 82px 142px 30px"`,
  `"34px minmax(520px, 1fr) 82px 110px 130px 90px 170px 30px"`
);

text = text.replaceAll(
  `"34px minmax(360px, 1fr) 78px 108px 126px 82px 150px 30px"`,
  `"34px minmax(520px, 1fr) 82px 110px 130px 90px 170px 30px"`
);

// Positionsbox luftiger, aber nicht riesig
text = text.replaceAll(
  `padding: "14px",`,
  `padding: "16px 18px",`
);

// Artikel-Feld größer und ruhiger
text = text.replaceAll(
  `placeholder="Bezeichnung des Artikels" style={inputStyle}`,
  `placeholder="Bezeichnung des Artikels" style={{ ...inputStyle, minHeight: 44 }}`
);

// Gesamtsumme unten nicht mitten in die Positionen quetschen
text = text.replaceAll(
  `minWidth: 390,`,
  `minWidth: 470,`
);

text = text.replaceAll(
  `background: "#555",
                    color: "white",
                    padding: "11px 16px",
                    fontWeight: 800,
                    textAlign: "center",
                    fontSize: 13,`,
  `background: "#555",
                    color: "white",
                    padding: "12px 18px",
                    fontWeight: 850,
                    textAlign: "center",
                    fontSize: 14,`
);

// Bottom-Leiste sauberer über volle Breite
text = text.replaceAll(
  `justifyContent: "space-between", gap: 14, padding: "14px", borderTop: "1px solid #d2d2d2"`,
  `justifyContent: "space-between", gap: 18, padding: "16px 18px", borderTop: "1px solid #d2d2d2", background: "#fafafa"`
);

// MwSt-Select unter dem Zeilenbetrag schöner wie Badge
text = text.replaceAll(
  `height: 27,
                              border: "none",
                              borderRadius: 999,
                              background: "#444",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 850,
                              padding: "2px 8px",
                              cursor: "pointer",`,
  `height: 28,
                              border: "none",
                              borderRadius: 999,
                              background: "#444",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 850,
                              padding: "2px 10px",
                              cursor: "pointer",
                              width: "100%",`
);

// Zeilenbetrag rechts stärker
text = text.replaceAll(
  `fontWeight: 950,
                              fontSize: 14,`,
  `fontWeight: 950,
                              fontSize: 15,`
);

// Formularfelder oben etwas harmonischer
text = text.replaceAll(
  `gridTemplateColumns: "1fr 1fr", gap: 18`,
  `gridTemplateColumns: "1fr 1fr", gap: 22`
);

text = text.replaceAll(
  `gridTemplateColumns: "160px 1fr", gap: 12`,
  `gridTemplateColumns: "170px 1fr", gap: 12`
);

text = text.replaceAll(
  `gridTemplateColumns: "160px 140px 1fr", gap: 12`,
  `gridTemplateColumns: "170px 140px 1fr", gap: 12`
);

fs.writeFileSync(file, text, "utf8");
