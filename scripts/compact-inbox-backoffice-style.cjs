const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

if (!content.includes("/* inbox-compact-backoffice-v2 */")) {
  const css = `
      <style>{\`
        /* inbox-compact-backoffice-v2 */

        /* Seite dichter und professioneller */
        h1 {
          font-size: 30px !important;
          font-weight: 600 !important;
          letter-spacing: -0.035em !important;
        }

        h2 {
          font-size: 21px !important;
          font-weight: 600 !important;
        }

        p {
          font-weight: 450 !important;
        }

        /* obere Headline-Karte kompakter */
        header,
        section:first-of-type {
          padding-top: 22px !important;
          padding-bottom: 22px !important;
        }

        /* KPI-Karten kleiner und weniger dominant */
        article {
          min-height: 78px !important;
          padding: 18px 18px !important;
          border-radius: 16px !important;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.03) !important;
        }

        article strong {
          font-size: 25px !important;
          font-weight: 600 !important;
          letter-spacing: -0.035em !important;
        }

        article p,
        article span,
        article small {
          font-size: 13px !important;
          font-weight: 500 !important;
        }

        /* aktive große grüne KPI weniger laut */
        article[style*="#0f9f7a"],
        article[style*="rgb(15, 159, 122)"] {
          box-shadow: none !important;
        }

        /* E-Mail-Karte kompakter */
        section {
          padding: 22px !important;
          border-radius: 17px !important;
        }

        /* Header in der E-Mail-Karte */
        section h2 {
          margin-bottom: 4px !important;
        }

        section h2 + p {
          margin-top: 0 !important;
          font-size: 14px !important;
          color: #64748b !important;
        }

        /* Suchleiste als flache Toolbar */
        form[method="get"] {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 13px !important;
          padding: 8px !important;
          gap: 8px !important;
        }

        form[method="get"] label {
          gap: 4px !important;
          font-size: 10.5px !important;
          font-weight: 650 !important;
          letter-spacing: .07em !important;
        }

        form[method="get"] input,
        form[method="get"] select {
          height: 36px !important;
          min-height: 36px !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          font-weight: 450 !important;
          padding: 0 11px !important;
        }

        form[method="get"] button,
        form[method="get"] a {
          height: 36px !important;
          min-height: 36px !important;
          border-radius: 8px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
        }

        /* Kategorie-Karten deutlich kompakter */
        a[href*="emailCategory"] {
          min-height: 68px !important;
          padding: 14px 15px !important;
          border-radius: 14px !important;
          box-shadow: none !important;
          background: #f8fafc !important;
          border: 1px solid #dbe5ec !important;
        }

        a[href*="emailCategory"]:hover {
          background: #f5faf8 !important;
          border-color: #bfded6 !important;
        }

        a[href*="emailCategory"] strong,
        a[href*="emailCategory"] b {
          font-size: 15px !important;
          font-weight: 600 !important;
          letter-spacing: -0.01em !important;
        }

        a[href*="emailCategory"] span,
        a[href*="emailCategory"] p,
        a[href*="emailCategory"] div {
          font-size: 12.5px !important;
          font-weight: 450 !important;
          line-height: 1.35 !important;
        }

        /* aktive Kategorie ruhiger, nicht so klobig */
        a[href*="emailCategory"][style*="#0f9f7a"],
        a[href*="emailCategory"][style*="rgb(15, 159, 122)"] {
          background: #0f8f70 !important;
          border-color: #0f8f70 !important;
          box-shadow: none !important;
        }

        a[href*="emailCategory"][style*="#0f9f7a"] *,
        a[href*="emailCategory"][style*="rgb(15, 159, 122)"] * {
          font-weight: 600 !important;
        }

        /* kleine Count-Badges */
        a[href*="emailCategory"] small,
        a[href*="emailCategory"] em {
          min-width: 22px !important;
          height: 22px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }

        /* Empty-State weniger schwer */
        div[style*="Keine ungeprüften"],
        div[style*="Keine E-Mails"] {
          min-height: 52px !important;
          border-radius: 13px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          color: #475569 !important;
          background: #f8fafc !important;
        }

        /* Auftragstabelle unten näher dran, weniger massiv */
        section + section {
          margin-top: 18px !important;
        }

        table th {
          height: 40px !important;
          font-size: 11.5px !important;
          font-weight: 700 !important;
        }

        table td {
          padding-top: 14px !important;
          padding-bottom: 14px !important;
          font-size: 14px !important;
        }

        /* globale Button-Beruhigung auf dieser Seite */
        button,
        a {
          box-shadow: none !important;
        }

        /* Header Button rechts weniger hoch */
        a[href*="email-import"],
        button[type="submit"] {
          min-height: 38px !important;
          border-radius: 9px !important;
          font-size: 13.5px !important;
          font-weight: 600 !important;
        }

        @media (max-width: 1100px) {
          form[method="get"] {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          a[href*="emailCategory"] {
            min-height: 62px !important;
          }
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang kompakter und hochwertiger gemacht.");
