const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const marker = "/* inbox-nav-and-danger-final-v11 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        /* Kategorie-Navigation etwas größer und sauberer */
        .bucketNav {
          gap: 7px !important;
          margin: 10px 0 11px !important;
        }

        .bucket {
          height: 34px !important;
          min-height: 34px !important;
          padding: 0 10px 0 12px !important;
          border-radius: 999px !important;
          border: 1px solid #d4e0e8 !important;
          background: #ffffff !important;
          color: #111827 !important;
        }

        .bucket strong {
          font-size: 12.8px !important;
          font-weight: 600 !important;
          letter-spacing: -0.01em !important;
        }

        .bucket b {
          height: 18px !important;
          min-width: 18px !important;
          padding: 0 6px !important;
          font-size: 10.5px !important;
          font-weight: 650 !important;
          background: #f1f5f9 !important;
          color: #0f172a !important;
        }

        .bucket.active {
          background: #0f8f70 !important;
          border-color: #0f8f70 !important;
          color: #ffffff !important;
        }

        .bucket.active b {
          background: rgba(255,255,255,.22) !important;
          color: #ffffff !important;
        }

        /* Löschen-Buttons klar rot */
        .dangerBtn,
        .mailActions .dangerBtn,
        .orderActions .dangerBtn,
        button.dangerBtn,
        a.dangerBtn {
          background: #fff5f5 !important;
          border: 1px solid #fecaca !important;
          color: #b91c1c !important;
          box-shadow: none !important;
        }

        .dangerBtn:hover,
        .mailActions .dangerBtn:hover,
        .orderActions .dangerBtn:hover,
        button.dangerBtn:hover,
        a.dangerBtn:hover {
          background: #fee2e2 !important;
          border-color: #fca5a5 !important;
          color: #991b1b !important;
        }

        /* Prüfen bleibt grün, aber nicht zu schwer */
        .orderActions .primaryBtn,
        .mailActions .primaryBtn {
          background: #0f9f7a !important;
          border-color: #0f9f7a !important;
          color: #ffffff !important;
        }

        /* Buttons in Tabellen minimal besser lesbar */
        .mailActions .primaryBtn,
        .mailActions .secondaryBtn,
        .mailActions .softBtn,
        .mailActions .dangerBtn,
        .orderActions .primaryBtn,
        .orderActions .secondaryBtn,
        .orderActions .softBtn,
        .orderActions .dangerBtn {
          height: 32px !important;
          min-height: 32px !important;
          border-radius: 7px !important;
          padding: 0 11px !important;
          font-size: 12.4px !important;
          font-weight: 600 !important;
        }
      \`}</style>
`;

  const insertAt = content.lastIndexOf("</AppLayout>");

  if (insertAt === -1) {
    throw new Error("AppLayout-Ende nicht gefunden.");
  }

  content = content.slice(0, insertAt) + css + "\n    " + content.slice(insertAt);
}

fs.writeFileSync(path, content, "utf8");
console.log("Navigation vergroessert und Loeschen-Buttons rot gesetzt.");
