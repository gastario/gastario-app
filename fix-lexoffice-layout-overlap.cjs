const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Dokumentbereich schmaler, damit es mehr wie Lexoffice wirkt
text = text.replaceAll("maxWidth: 1180,", "maxWidth: 1060,");

// Positionsbox nicht so hoch/klobig
text = text.replaceAll('padding: "22"', 'padding: "18"');
text = text.replaceAll('padding: 22,', 'padding: 18,');

// Hauptgrid der Artikelzeile entschärfen: weniger Spaltenbreite, kein Überschneiden
text = text.replaceAll(
  '"38px minmax(300px, 1fr) 78px 104px 124px 78px 84px 92px 30px"',
  '"34px minmax(260px, 1fr) 70px 84px 98px 66px 72px 82px 26px"'
);

text = text.replaceAll(
  '"42px minmax(300px, 1fr) 86px 110px 130px 86px 88px 98px 34px"',
  '"34px minmax(260px, 1fr) 70px 84px 98px 66px 72px 82px 26px"'
);

// Freitext-Zeile kompakter
text = text.replaceAll(
  '? "42px minmax(0, 1fr) 42px"',
  '? "34px minmax(0, 1fr) 26px"'
);

text = text.replaceAll(
  '? "46px 1fr 42px"',
  '? "34px minmax(0, 1fr) 26px"'
);

// Zeilenhöhe reduzieren
text = text.replaceAll('padding: "12px 14px"', 'padding: "10px 12px"');
text = text.replaceAll('padding: "16px 18px"', 'padding: "10px 12px"');
text = text.replaceAll('gap: 8,', 'gap: 6,');

// Nummernkreis kleiner
text = text.replaceAll(
  `width: 24,
                    height: 24,`,
  `width: 22,
                    height: 22,`
);

text = text.replaceAll(
  `width: 26,
                    height: 26,`,
  `width: 22,
                    height: 22,`
);

// Labels kleiner wie Lexoffice
text = text.replaceAll(
  `fontSize: 11, fontWeight: 700`,
  `fontSize: 10, fontWeight: 650`
);

text = text.replaceAll(
  `fontSize: 12, fontWeight: 850`,
  `fontSize: 10, fontWeight: 650`
);

// Gesamtfeld rechts nicht als fettes Feld, sondern kleiner Text
text = text.replaceAll(
  `fontWeight: 900`,
  `fontWeight: 800`
);

// Summe unten ruhiger und nicht so dominant
text = text.replaceAll(
  `background: "#575757",
                  color: "white",
                  padding: "10px 16px",
                  fontWeight: 800,
                  textAlign: "center"`,
  `background: "#555555",
                  color: "white",
                  padding: "9px 14px",
                  fontWeight: 750,
                  textAlign: "center",
                  fontSize: 13`
);

// Buttonleiste kompakter
text = text.replaceAll(
  `padding: "14px 12px 0"`,
  `padding: "12px 10px 0"`
);

text = text.replaceAll(
  `gap: 18,`,
  `gap: 10,`
);

// Buttons kleiner
text = text.replaceAll(
  `padding: "8px 14px"`,
  `padding: "7px 11px"`
);

text = text.replaceAll(
  `padding: "8px 10px"`,
  `padding: "7px 9px"`
);

// Positionstitel weniger fett
text = text.replaceAll(
  "Artikel, Freitext, Rabatt und MwSt",
  "Positionen"
);

// Notizfeld nicht so riesig
text = text.replaceAll(
  `rows={4}
                            style={{ ...inputStyle, marginTop: 9, width: "100%", minHeight: 110, resize: "vertical" }}`,
  `rows={3}
                            style={{ ...inputStyle, marginTop: 7, width: "100%", minHeight: 72, resize: "vertical" }}`
);

text = text.replaceAll(
  `rows={4}
                        style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}`,
  `rows={3}
                        style={{ ...inputStyle, minHeight: 78, resize: "vertical" }}`
);

fs.writeFileSync(file, text, "utf8");
