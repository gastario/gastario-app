const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

if (!content.includes("/* inbox-lexoffice-polish-final */")) {
  const css = `
      <style>{\`
        /* inbox-lexoffice-polish-final */

        /* Seite insgesamt ruhiger */
        h1 {
          font-size: 32px !important;
          font-weight: 600 !important;
          letter-spacing: -0.04em !important;
        }

        h2 {
          font-size: 22px !important;
          font-weight: 600 !important;
          letter-spacing: -0.03em !important;
        }

        /* Header-Karte */
        div[style*="Arbeitsbereich"],
        header {
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035) !important;
        }

        /* Live Badge */
        a[href*="email-import"],
        button,
        .ghostButton,
        .primaryGhostButton {
          font-weight: 600 !important;
          border-radius: 10px !important;
          box-shadow: none !important;
        }

        /* KPI Karten oben */
        .metricCard,
        article {
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035) !important;
          border-radius: 18px !important;
        }

        .metricCard strong,
        article strong {
          font-weight: 600 !important;
          letter-spacing: -0.035em !important;
        }

        /* Auftragseingang Box */
        .emailInboxCard,
        section {
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035) !important;
          border-radius: 18px !important;
        }

        /* Such-/Filterleiste ruhiger */
        form[method="get"] {
          border-radius: 14px !important;
          box-shadow: none !important;
        }

        form[method="get"] label {
          font-size: 11px !important;
          font-weight: 650 !important;
          color: #64748b !important;
          letter-spacing: .06em !important;
        }

        form[method="get"] input,
        form[method="get"] select {
          min-height: 38px !important;
          border-radius: 9px !important;
          font-size: 14px !important;
          font-weight: 450 !important;
        }

        /* Kategorie-Karten kompakter */
        a[href*="emailCategory"] {
          border-radius: 14px !important;
          box-shadow: none !important;
          font-weight: 600 !important;
        }

        a[href*="emailCategory"] strong,
        a[href*="emailCategory"] span,
        a[href*="emailCategory"] div {
          font-weight: 600 !important;
        }

        /* Aktive Kategorie weniger massiv */
        a[href*="emailCategory"][style*="rgb(15, 159, 122)"],
        a[href*="emailCategory"][style*="#0f9f7a"] {
          box-shadow: none !important;
        }

        /* Kleine Zähler-Badges */
        a[href*="emailCategory"] small,
        a[href*="emailCategory"] em {
          font-weight: 600 !important;
        }

        /* Leere Box unten */
        div[style*="Keine ungeprüften"] {
          font-weight: 500 !important;
        }

        /* Tabellen / Listen */
        table th {
          font-weight: 650 !important;
          color: #64748b !important;
        }

        table td {
          font-weight: 450 !important;
        }

        /* Buttonfarben dezenter */
        button[type="submit"],
        a[href*="api/email-import/run"] {
          background: #0f9f7a !important;
          border-color: #0f9f7a !important;
          color: white !important;
          box-shadow: 0 6px 14px rgba(15, 159, 122, 0.10) !important;
        }

        /* Filterbutton nicht so fett */
        form[method="get"] button {
          height: 38px !important;
          padding: 0 14px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
        }

        /* Zurücksetzen Button */
        form[method="get"] a {
          height: 38px !important;
          padding: 0 14px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
        }

        /* Handy / kleinere Breite */
        @media (max-width: 1100px) {
          form[method="get"] {
            width: 100% !important;
          }

          form[method="get"] input,
          form[method="get"] select {
            min-width: 100% !important;
          }
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang optisch ruhiger gemacht.");
