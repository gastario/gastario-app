const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Dokumentkarte etwas breiter machen, damit die Positionszeile nicht gequetscht ist
text = text.replaceAll("maxWidth: 1040", "maxWidth: 1180");

// Header oben ebenfalls zentrieren, nicht links am Browserrand kleben lassen
text = text.replace(
  `<header style={{ marginBottom: 28 }}>`,
  `<header style={{ margin: "0 auto 24px", maxWidth: 1180, width: "100%" }}>`
);

// Titel kleiner und ruhiger
text = text.replaceAll(
  `fontSize: 32,
            lineHeight: 1.05,
            letterSpacing: "-0.045em"`,
  `fontSize: 30,
            lineHeight: 1.05,
            letterSpacing: "-0.04em"`
);

// Tenant-Badge oben rechts nicht so weit außen wirken lassen
text = text.replaceAll(
  `position: "absolute",
            top: 32,
            right: 32,`,
  `position: "absolute",
            top: 28,
            right: 50,
            zIndex: 2,`
);

// Positionsgrid etwas besser verteilen
text = text.replaceAll(
  `"34px minmax(300px, 1fr) 80px 110px 125px 80px 84px 96px 28px"`,
  `"34px minmax(360px, 1fr) 76px 96px 118px 74px 82px 92px 26px"`
);

// Positionsblock nicht mittig klein, sondern volle Dokumentbreite
text = text.replaceAll(
  `width: "100%", marginTop: 8`,
  `width: "100%", marginTop: 10`
);

// Felder etwas niedriger wie Lexoffice
text = text.replaceAll("minHeight: 42", "minHeight: 38");
text = text.replaceAll("minHeight: 38", "minHeight: 38");

// Labelabstände kompakter
text = text.replaceAll(
  `gap: 4, color: "#777", fontSize: 11, fontWeight: 650`,
  `gap: 3, color: "#777", fontSize: 10, fontWeight: 650`
);

// Positionszeile kompakter
text = text.replaceAll(
  `padding: "13px 14px"`,
  `padding: "12px 14px"`
);

// Summe unten voller und sauberer, nicht gequetscht
text = text.replaceAll(
  `minWidth: 360,`,
  `minWidth: 420,`
);

text = text.replaceAll(
  `fontSize: 13`,
  `fontSize: 13`
);

// Notizfeld unter Positionen etwas näher an Lexoffice
text = text.replace(
  `<textarea name="notes" placeholder="Notizen / Besonderheiten" rows={3} style={{ ...inputStyle, borderRadius: 3 }} />`,
  `<textarea
            name="notes"
            placeholder="Nachbemerkung / interne Hinweise"
            rows={4}
            style={{ ...inputStyle, borderRadius: 3, minHeight: 90, resize: "vertical" }}
          />`
);

fs.writeFileSync(file, text, "utf8");
