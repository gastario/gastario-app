const fs = require("fs");

const path = "app/routes/auftraege.tsx";
let content = fs.readFileSync(path, "utf8");

// Kaputte Zeichen / Texte reparieren
const replacements = [
  ["Â·", "·"],
  ["Auftraege", "Aufträge"],
  ["Aktuelle Auftraege", "Aktuelle Aufträge"],
  ["Auftraege gesamt", "Aufträge gesamt"],
  ["Auftragsuebersicht", "Auftragsübersicht"],
  ["AUFTRAGSUEBERSICHT", "AUFTRAGSÜBERSICHT"],
  ["Pruefen", "Prüfen"],
  ["Pruefseite", "Prüfseite"],
  ["Bestaetigt", "Bestätigt"],
  ["bestaetigt", "bestätigt"],
  ["uebernommene", "übernommene"],
  ["Oeffnen", "Öffnen"],
  ["Loeschen", "Löschen"],
  ["Auftraege", "Aufträge"],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

// Doppelaktion entfernen: Öffnen und Prüfseite zeigen auf dieselbe Seite.
// Wir behalten nur "Prüfen".
content = content.replace(
`                    <Link className="ghostButton" to={"/auftrag-pruefung/" + order.id}>
                      Öffnen
                    </Link>

                    <Link className="ghostButton" to={"/auftrag-pruefung/" + order.id}>
                      Prüfseite
                    </Link>`,
`                    <Link className="ghostButton primaryGhostButton" to={"/auftrag-pruefung/" + order.id}>
                      Prüfen
                    </Link>`
);

// Falls der Text noch anders steht
content = content.replace(
`                    <Link className="ghostButton" to={"/auftrag-pruefung/" + order.id}>
                      Öffnen
                    </Link>`,
``
);

content = content.replace(
`                    <Link className="ghostButton" to={"/auftrag-pruefung/" + order.id}>
                      Prüfseite
                    </Link>`,
`                    <Link className="ghostButton primaryGhostButton" to={"/auftrag-pruefung/" + order.id}>
                      Prüfen
                    </Link>`
);

// CSS-Politur ergänzen
if (!content.includes("/* orders-page-polish */")) {
  const css = `
      <style>{\`
        /* orders-page-polish */
        .metricCard {
          border-radius: 24px !important;
          border: 1px solid #dbe7ee !important;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.065) !important;
          min-height: 112px !important;
        }

        .metricCard strong {
          letter-spacing: -0.055em;
        }

        .sectionActions {
          align-items: center !important;
        }

        .ghostButton {
          min-height: 36px !important;
          border-radius: 999px !important;
          padding: 8px 13px !important;
          border: 1px solid #d6e1ea !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 900 !important;
          text-decoration: none !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
        }

        .primaryGhostButton {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        .orderStatus {
          border-radius: 999px !important;
          padding: 7px 11px !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }

        .ordersTable,
        .ordersList,
        .orderTable {
          border-radius: 22px !important;
          overflow: hidden !important;
        }

        .orderRow {
          min-height: 112px !important;
          align-items: center !important;
        }

        .orderRow > div {
          align-self: center !important;
        }

        .orderRow strong {
          letter-spacing: -0.015em;
        }

        .orderRow small {
          color: #64748b !important;
          line-height: 1.35 !important;
        }

        .orderRow form button {
          min-height: 36px !important;
          border-radius: 999px !important;
          border: 1px solid #fecaca !important;
          background: #fff7f7 !important;
          color: #b91c1c !important;
          font-weight: 950 !important;
          padding: 8px 13px !important;
          cursor: pointer !important;
        }

        @media (max-width: 1100px) {
          .orderRow {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

// Betrag sicher aus totalCents lesen
content = content.replaceAll("(item.totalPriceCents || 0)", "(item.totalCents || item.totalPriceCents || 0)");

fs.writeFileSync(path, content, "utf8");
console.log("Aufträge-Ansicht optisch verbessert.");
