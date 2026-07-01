const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Überschrift schlanker wie Lexoffice
text = text.replaceAll(
  "Artikel, Freitext, Rabatt und MwSt",
  "Positionen"
);

// Breitere Artikelspalte, kompaktere Nebenfelder
text = text.replaceAll(
  '? "46px 1fr 42px"',
  '? "42px minmax(0, 1fr) 42px"'
);

text = text.replaceAll(
  ': "46px minmax(220px, 1fr) 90px 110px 135px 95px 105px 110px 42px"',
  ': "42px minmax(360px, 1.6fr) 88px 116px 138px 88px 92px 105px 40px"'
);

// Zeilen luftiger, aber nicht so riesig
text = text.replaceAll(
  'padding: "14px 12px"',
  'padding: "16px 18px"'
);

// Nummern kleiner wie Lexoffice
text = text.replaceAll(
  "width: 28,\n                    height: 28,",
  "width: 26,\n                    height: 26,"
);

// Gesamtfeld eher wie Lexoffice
text = text.replaceAll(
  "wird berechnet",
  "0,00 €"
);

text = text.replaceAll(
  'background: "#f8fafc",\n                          border: "1px solid #dbe3ec",',
  'background: "#ffffff",\n                          border: "1px solid #dbe3ec",'
);

// Buttons unten mehr Lexoffice-Style
text = text.replaceAll(
  "+ Artikel",
  "+ ARTIKEL"
);

text = text.replaceAll(
  "+ Freitext",
  "≡ FREITEXT"
);

text = text.replaceAll(
  "Optional später",
  "◉ OPTIONAL"
);

text = text.replaceAll(
  "% Gesamtrabatt später",
  "% GESAMTRABATT"
);

// Summe unten wie feste dunkle Leiste
text = text.replaceAll(
  "Summe wird nach Speichern berechnet",
  "Summe Netto: 0,00 €"
);

// Card etwas flacher
text = text.replaceAll(
  'borderRadius: 18,',
  'borderRadius: 14,'
);

fs.writeFileSync(file, text, "utf8");
