const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Hauptformular-Card schmaler wie Lexoffice
text = text.replace(
  `<section style={{
        background: "white",
        borderRadius: 24,
        border: "1px solid #dbe3ec",
        padding: 24,
        marginBottom: 20,
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)"
      }}>`,
  `<section style={{
        background: "white",
        borderRadius: 8,
        border: "1px solid #d6d6d6",
        padding: 22,
        marginBottom: 20,
        maxWidth: 1180,
        marginLeft: "auto",
        marginRight: "auto",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.10)"
      }}>`
);

// Eingangs-Tabelle ebenfalls schmaler ausrichten
text = text.replace(
  `<section style={{
        background: "white",
        borderRadius: 24,
        border: "1px solid #dbe3ec",
        padding: 24,
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)"
      }}>`,
  `<section style={{
        background: "white",
        borderRadius: 8,
        border: "1px solid #d6d6d6",
        padding: 22,
        maxWidth: 1180,
        marginLeft: "auto",
        marginRight: "auto",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.10)"
      }}>`
);

// Top-Kacheln ebenfalls auf Dokumentbreite bringen
text = text.replace(
  `display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
        marginBottom: 20`,
  `display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
        marginBottom: 20,
        maxWidth: 1180,
        marginLeft: "auto",
        marginRight: "auto"`
);

// Positionsbox: keine riesige volle Breite, mehr Dokumentlook
text = text.replaceAll(
  `border: "1px solid #d6d6d6",
              borderRadius: 4,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)"`,
  `border: "1px solid #d6d6d6",
              borderRadius: 3,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "none"`
);

// Zeile kompakter
text = text.replaceAll(
  `padding: "14px 16px",`,
  `padding: "12px 14px",`
);

// Artikelspalte/Felder mehr wie Lexoffice
text = text.replaceAll(
  `"42px minmax(300px, 1fr) 86px 110px 130px 86px 88px 98px 34px"`,
  `"38px minmax(300px, 1fr) 78px 104px 124px 78px 84px 92px 30px"`
);

// Nummer kleiner
text = text.replaceAll(
  `width: 26,
                    height: 26,`,
  `width: 24,
                    height: 24,`
);

// Summenbox mehr unten bündig und kleiner
text = text.replaceAll(
  `minWidth: 260,
                  borderRadius: 0,
                  background: "#555555",
                  color: "white",
                  padding: "12px 18px",
                  fontWeight: 800,
                  textAlign: "center"`,
  `minWidth: 245,
                  borderRadius: 0,
                  background: "#575757",
                  color: "white",
                  padding: "10px 16px",
                  fontWeight: 800,
                  textAlign: "center"`
);

// Buttonleiste weniger hoch
text = text.replaceAll(
  `padding: "18px 12px 0",`,
  `padding: "14px 12px 0",`
);

// Allgemeines Notizfeld im Dokumentlook
text = text.replace(
  `<textarea name="notes" placeholder="Notizen / Besonderheiten" rows={3} style={inputStyle} />`,
  `<textarea name="notes" placeholder="Notizen / Besonderheiten" rows={3} style={{ ...inputStyle, borderRadius: 3 }} />`
);

fs.writeFileSync(file, text, "utf8");
