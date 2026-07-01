const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Seite mehr wie Lexoffice: ruhiger grauer Hintergrund, weniger Dashboard-Look
text = text.replace(
  `background: "#edf2f6",
      padding: 32,`,
  `background: "#f3f3f3",
      padding: "28px 0 48px",`
);

// 2) Header weniger dominant
text = text.replace(
  `fontSize: 52,
            lineHeight: .95,
            letterSpacing: "-0.065em"`,
  `fontSize: 32,
            lineHeight: 1.05,
            letterSpacing: "-0.045em"`
);

text = text.replace(
  `margin: "12px 0 0",
            color: "#64748b",
            fontWeight: 700`,
  `margin: "8px 0 0",
            color: "#6b7280",
            fontWeight: 500`
);

// 3) Statistik-Kacheln ausblenden, damit der Editor wie ein Dokument wirkt
const statsStart = text.indexOf(`      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",`);

if (statsStart !== -1) {
  const statsEnd = text.indexOf(`      </section>`, statsStart);
  if (statsEnd !== -1) {
    text = text.slice(0, statsStart) + text.slice(statsEnd + `      </section>`.length);
  }
}

// 4) Hauptformular als Lexoffice-Dokumentkarte
text = text.replace(
  `<section style={{
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 18,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)",
        marginBottom: 20
      }}>`,
  `<section style={{
        background: "#ffffff",
        border: "1px solid #d0d0d0",
        borderRadius: 3,
        padding: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        margin: "0 auto 18px",
        maxWidth: 1040
      }}>`
);

// 5) Formular-Überschrift flacher
text = text.replace(
  `<div style={{ marginBottom: 18 }}>
          <div style={{
            color: "#0f766e",
            textTransform: "uppercase",
            letterSpacing: ".08em",
            fontSize: 11,
            fontWeight: 950
          }}>
            Neuer Auftrag
          </div>
          <h2 style={{ margin: "5px 0 0", fontSize: 24, letterSpacing: "-0.04em" }}>
            Auftrag manuell erfassen
          </h2>
        </div>`,
  `<div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.03em", fontWeight: 800 }}>
            Auftrag manuell erfassen
          </h2>
        </div>`
);

// 6) Formularfelder wie Dokument, nicht wie SaaS-Karte
text = text.replaceAll(
  `borderRadius: 14`,
  `borderRadius: 3`
);

text = text.replaceAll(
  `borderRadius: 12`,
  `borderRadius: 3`
);

text = text.replaceAll(
  `borderRadius: 10`,
  `borderRadius: 3`
);

// 7) Positionsbereich breiter und ruhiger wie Lexoffice
text = text.replace(
  `<div style={{ display: "grid", gap: 10, width: "100%" }}>`,
  `<div style={{ display: "grid", gap: 10, width: "100%", marginTop: 8 }}>`
);

text = text.replace(
  `Artikel
                </h3>`,
  `Positionen
                </h3>`
);

// 8) Positionsbox mehr wie Lexoffice
text = text.replace(
  `border: "1px solid #d6d6d6",
              borderRadius: 4,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)"`,
  `border: "1px solid #cccccc",
              borderRadius: 3,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "none"`
);

// 9) Zeilenlayout: nicht gequetscht, aber kompakt
text = text.replaceAll(
  `"36px minmax(420px, 1fr) 82px 105px 125px 82px 88px 105px 32px"`,
  `"34px minmax(300px, 1fr) 80px 110px 125px 80px 84px 96px 28px"`
);

text = text.replaceAll(
  `"32px minmax(280px, 1fr) 78px 96px 118px 76px 78px 94px 28px"`,
  `"34px minmax(300px, 1fr) 80px 110px 125px 80px 84px 96px 28px"`
);

text = text.replaceAll(
  `padding: "15px 16px"`,
  `padding: "13px 14px"`
);

text = text.replaceAll(
  `padding: "13px 14px"`,
  `padding: "13px 14px"`
);

// 10) Summenleiste unten wie Lexoffice: voller dunkler Footer, nicht kleiner Klotz
text = text.replace(
  `<div style={{
                  minWidth: 390,
                  background: "#555",
                  color: "white",
                  padding: "12px 18px",
                  fontWeight: 750,
                  textAlign: "center",
                  fontSize: 13
                }}>
                  Netto {formatEuroCents(liveNetTotalCents)} · MwSt {formatEuroCents(liveTaxTotalCents)} · Gesamt {formatEuroCents(liveGrossTotalCents)}
                </div>`,
  `<div style={{
                  marginLeft: "auto",
                  minWidth: 360,
                  background: "#555",
                  color: "white",
                  padding: "12px 18px",
                  fontWeight: 750,
                  textAlign: "center",
                  fontSize: 13
                }}>
                  Netto {formatEuroCents(liveNetTotalCents)} · MwSt {formatEuroCents(liveTaxTotalCents)} · Gesamt {formatEuroCents(liveGrossTotalCents)}
                </div>`
);

// 11) Eingangsliste auch Dokumentbreite
text = text.replace(
  `<section style={{
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 18,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)"
      }}>`,
  `<section style={{
        background: "white",
        border: "1px solid #d0d0d0",
        borderRadius: 3,
        padding: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
        margin: "0 auto",
        maxWidth: 1040
      }}>`
);

fs.writeFileSync(file, text, "utf8");
