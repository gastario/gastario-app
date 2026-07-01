const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Datum wieder als echte Datumauswahl
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
              style={{ ...inputStyle, borderRadius: 3 }}
            />`
);

// 2) Server-Parsing wieder kompatibel lassen, falls später doch Textdatum kommt
// bleibt unverändert, akzeptiert yyyy-mm-dd und tt.mm.jjjj

// 3) Positionsgrid entzerren: MwSt nicht mehr eigene breite Spalte
text = text.replaceAll(
  `"34px minmax(300px, 1fr) 80px 110px 125px 80px 84px 96px 28px"`,
  `"34px minmax(330px, 1fr) 76px 100px 118px 74px 122px 28px"`
);

text = text.replaceAll(
  `"36px minmax(420px, 1fr) 82px 105px 125px 82px 88px 105px 32px"`,
  `"34px minmax(330px, 1fr) 76px 100px 118px 74px 122px 28px"`
);

// 4) Das separate MwSt-Label/Feld aus der Zeile entfernen
text = text.replace(
`                      <label style={{ display: "grid", gap: 3, color: "#777", fontSize: 10, fontWeight: 650 }}>
                        MwSt
                        <select name="taxRate" defaultValue="19" style={{ ...inputStyle, borderRadius: 3, minHeight: 38 }}>
                          <option value="19">19 %</option>
                          <option value="7">7 %</option>
                          <option value="0">0 %</option>
                        </select>
                      </label>

                      <div style={{ display: "grid", gap: 3, color: "#777", fontSize: 10, fontWeight: 650 }}>
                        Netto
                        <div
                          data-line-total
                          style={{
                            minHeight: 38,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            color: "#111",
                            fontWeight: 800,
                            fontSize: 13
                          }}
                        >
                          0,00 €
                        </div>
                      </div>`,
`                      <div style={{ display: "grid", gap: 4, color: "#777", fontSize: 10, fontWeight: 650 }}>
                        Netto
                        <div
                          data-line-total
                          style={{
                            minHeight: 22,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            color: "#111",
                            fontWeight: 900,
                            fontSize: 14
                          }}
                        >
                          0,00 €
                        </div>
                        <select
                          name="taxRate"
                          defaultValue="19"
                          style={{
                            minHeight: 24,
                            border: "none",
                            borderRadius: 999,
                            background: "#3f3f3f",
                            color: "white",
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "2px 8px",
                            cursor: "pointer"
                          }}
                        >
                          <option value="19">USt 19 %</option>
                          <option value="7">USt 7 %</option>
                          <option value="0">USt 0 %</option>
                        </select>
                      </div>`
);

// 5) Header-Labels anpassen: MwSt-Spalte raus
text = text.replaceAll(
  "MwSt\n                        <select",
  "Netto\n                        <select"
);

// 6) Artikel-Input breiter und ruhiger
text = text.replaceAll(
  `placeholder="Bezeichnung des Artikels"
                            style={{ ...inputStyle, borderRadius: 3, fontWeight: 500, minHeight: 38 }}`,
  `placeholder="Bezeichnung des Artikels"
                            style={{ ...inputStyle, borderRadius: 3, fontWeight: 500, minHeight: 40 }}`
);

// 7) Positionsbereich etwas breiter, aber Dokument-Look behalten
text = text.replaceAll("maxWidth: 1180", "maxWidth: 1240");

// 8) Summenleiste unten nicht zu breit klotzig
text = text.replaceAll(
  `minWidth: 420,`,
  `minWidth: 390,`
);

// 9) Buttonleiste nicht gedrückt
text = text.replaceAll(
  `gap: 14, flexWrap: "wrap"`,
  `gap: 18, flexWrap: "wrap"`
);

fs.writeFileSync(file, text, "utf8");
