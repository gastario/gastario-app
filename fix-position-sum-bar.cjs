const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Floating-Summenleiste entfernen und wieder sauber in die Positionsbox setzen
text = text.replaceAll(
  `position: "absolute",
                  right: 0,
                  bottom: -44,
                  minWidth: 260,
                  borderRadius: "4px 4px 0 0",
                  background: "#555555",
                  color: "white",
                  padding: "12px 18px",
                  fontWeight: 800,
                  textAlign: "center"`,
  `minWidth: 260,
                  borderRadius: 0,
                  background: "#555555",
                  color: "white",
                  padding: "12px 18px",
                  fontWeight: 800,
                  textAlign: "center"`
);

// marginBottom/position aus Positionscontainer wieder entfernen
text = text.replaceAll(
  `background: "#ffffff",
              position: "relative",
              marginBottom: 44
              }}>`,
  `background: "#ffffff"
              }}>`
);

// Button-/Summenzeile wie Lexoffice: Buttons mittig, Summe unten rechts
text = text.replaceAll(
  `display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                padding: "18px 12px 22px",
                borderTop: "1px solid #e0e0e0",
                background: "#ffffff"`,
  `display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
                padding: "18px 12px 0",
                borderTop: "1px solid #e0e0e0",
                background: "#ffffff"`
);

// Untere Summenleiste optisch mehr wie Lexoffice
text = text.replaceAll(
  `Summe Netto: {formatEuroCents(liveNetTotalCents)}`,
  `Summe Netto&nbsp;&nbsp; {formatEuroCents(liveNetTotalCents)}`
);

fs.writeFileSync(file, text, "utf8");
