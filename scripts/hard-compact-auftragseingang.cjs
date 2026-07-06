const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

if (!content.includes("/* inbox-density-hard-compact */")) {
  const css = `
      <style>{\`
        /* inbox-density-hard-compact */

        /* komplette Arbeitsfläche kompakter */
        main,
        .appShell {
          font-size: 14px !important;
        }

        /* Header-Karte kleiner */
        header {
          padding: 18px 22px !important;
          border-radius: 14px !important;
          margin-bottom: 14px !important;
        }

        header h1 {
          font-size: 28px !important;
          line-height: 1.05 !important;
          margin: 4px 0 0 !important;
        }

        header p {
          font-size: 14px !important;
          margin-top: 8px !important;
        }

        /* Live Text kompakter */
        header + p,
        div[style*="Live-Abruf"] {
          font-size: 13px !important;
          margin: 8px 0 12px !important;
        }

        /* obere KPI-Karten deutlich kleiner */
        article {
          min-height: 62px !important;
          padding: 13px 16px !important;
          border-radius: 13px !important;
        }

        article strong {
          font-size: 23px !important;
          line-height: 1 !important;
        }

        article p,
        article span,
        article small {
          font-size: 12px !important;
          line-height: 1.25 !important;
        }

        /* grid-Abstände der KPI-Karten reduzieren */
        div[style*="grid-template-columns"][style*="repeat"] {
          gap: 12px !important;
        }

        /* große Karten / Sections kompakter */
        section {
          padding: 18px 20px !important;
          border-radius: 14px !important;
          margin-top: 14px !important;
        }

        section h2 {
          font-size: 20px !important;
          line-height: 1.1 !important;
          margin: 0 0 4px !important;
        }

        section p {
          font-size: 13px !important;
          line-height: 1.35 !important;
        }

        /* Filterleiste kleiner */
        form[method="get"] {
          padding: 6px !important;
          border-radius: 10px !important;
          gap: 6px !important;
        }

        form[method="get"] label {
          font-size: 10px !important;
          gap: 3px !important;
        }

        form[method="get"] input,
        form[method="get"] select {
          height: 32px !important;
          min-height: 32px !important;
          border-radius: 7px !important;
          font-size: 13px !important;
          padding: 0 10px !important;
        }

        form[method="get"] button,
        form[method="get"] a {
          height: 32px !important;
          min-height: 32px !important;
          border-radius: 7px !important;
          padding: 0 11px !important;
          font-size: 13px !important;
        }

        /* Kategorie-Karten wirklich kleiner */
        a[href*="emailCategory"] {
          min-height: 54px !important;
          padding: 10px 12px !important;
          border-radius: 11px !important;
        }

        a[href*="emailCategory"] strong,
        a[href*="emailCategory"] b {
          font-size: 14px !important;
          line-height: 1.1 !important;
        }

        a[href*="emailCategory"] span,
        a[href*="emailCategory"] p,
        a[href*="emailCategory"] div {
          font-size: 11.5px !important;
          line-height: 1.25 !important;
        }

        a[href*="emailCategory"] small,
        a[href*="emailCategory"] em {
          min-width: 18px !important;
          height: 18px !important;
          font-size: 11px !important;
          padding: 0 5px !important;
        }

        /* Empty-State kleiner */
        div[style*="Keine ungeprüften"],
        div[style*="Keine E-Mails"] {
          min-height: 42px !important;
          padding: 12px 14px !important;
          border-radius: 10px !important;
          font-size: 13px !important;
        }

        /* Buttons allgemein kleiner */
        button,
        a {
          font-size: 13px !important;
        }

        a[href*="email-import"],
        button[type="submit"] {
          min-height: 34px !important;
          height: 34px !important;
          border-radius: 8px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
        }

        /* Auftragstabelle unten kompakter */
        table th {
          height: 34px !important;
          font-size: 11px !important;
          padding-top: 8px !important;
          padding-bottom: 8px !important;
        }

        table td {
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          font-size: 13px !important;
        }

        /* große Abstände zwischen Bereichen reduzieren */
        section + section,
        article + article {
          margin-top: 12px !important;
        }

        /* Inhalt nicht so breit-luftig wirken lassen */
        div[style*="max-width: 1180"],
        div[style*="maxWidth: 1180"] {
          max-width: 1120px !important;
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang hart kompakter gemacht.");
