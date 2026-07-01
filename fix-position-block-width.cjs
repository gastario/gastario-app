const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Positionsbereich nicht mehr winzig mittig, sondern wie Dokumentblock breit
text = text.replaceAll(
  'maxWidth: 980, margin: "0 auto", width: "100%"',
  'width: "100%"'
);

// Artikelblock wieder breiter und ausgewogener
text = text.replaceAll(
  '"32px minmax(280px, 1fr) 78px 96px 118px 76px 78px 94px 28px"',
  '"36px minmax(420px, 1fr) 82px 105px 125px 82px 88px 105px 32px"'
);

// Freitext-Zeile passend breit
text = text.replaceAll(
  '"32px minmax(0, 1fr) 28px"',
  '"36px minmax(0, 1fr) 32px"'
);

// Positionsbox weniger klein und mehr wie Lexoffice-Editor
text = text.replaceAll(
  'padding: "13px 14px"',
  'padding: "15px 16px"'
);

// Feldhöhen etwas angenehmer
text = text.replaceAll(
  'minHeight: 34',
  'minHeight: 38'
);

// Artikel-Input nicht so winzig
text = text.replaceAll(
  'placeholder="Bezeichnung des Artikels"\n                            style={{ ...inputStyle, borderRadius: 3, fontWeight: 500 }}',
  'placeholder="Bezeichnung des Artikels"\n                            style={{ ...inputStyle, borderRadius: 3, fontWeight: 500, minHeight: 42 }}'
);

// Menge / Einheit / Preis auch sauberer
text = text.replaceAll(
  'style={{ ...inputStyle, borderRadius: 3 }}',
  'style={{ ...inputStyle, borderRadius: 3, minHeight: 42 }}'
);

text = text.replaceAll(
  'style={{ ...inputStyle, borderRadius: 3, textAlign: "right" }}',
  'style={{ ...inputStyle, borderRadius: 3, minHeight: 42, textAlign: "right" }}'
);

// MwSt Select sauberer
text = text.replaceAll(
  'style={{ ...inputStyle, borderRadius: 3 }}>',
  'style={{ ...inputStyle, borderRadius: 3, minHeight: 42 }}>'
);

// Summe unten nicht so gequetscht
text = text.replaceAll(
  'minWidth: 330,',
  'minWidth: 390,'
);

text = text.replaceAll(
  'padding: "10px 16px",',
  'padding: "12px 18px",'
);

// Buttonleiste wieder luftiger
text = text.replaceAll(
  'padding: "14px 14px"',
  'padding: "16px 16px"'
);

// Gesamtformular optisch ruhiger
text = text.replaceAll(
  'borderRadius: 8,',
  'borderRadius: 10,'
);

fs.writeFileSync(file, text, "utf8");
