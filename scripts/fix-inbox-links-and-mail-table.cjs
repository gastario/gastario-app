const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// Link import ergänzen
content = content.replace(
  /import\s*\{([^}]+)\}\s*from\s*"react-router";/,
  (match, imports) => {
    if (imports.includes("Link")) return match;
    return `import {${imports.trim()}, Link} from "react-router";`;
  }
);

// Normale interne Links auf React-Router Link umstellen
content = content.replaceAll("<a href=", "<Link to=");
content = content.replaceAll("</a>", "</Link>");

// E-Mail-Liste optisch näher an Tabellen bringen
const marker = "/* inbox-mail-table-match-v12 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        /* E-Mail-Liste näher an Auftrags-Tabelle */
        .mailList {
          border: 1px solid #e2e8f0 !important;
          border-radius: 9px !important;
          overflow: hidden !important;
          background: #ffffff !important;
          gap: 0 !important;
        }

        .mailList::before {
          content: "BETREFF / ABSENDER    STATUS    AKTION";
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          padding: 8px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .055em;
          white-space: pre;
        }

        .mailRow {
          border: 0 !important;
          border-bottom: 1px solid #edf2f7 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          padding: 10px 12px !important;
          min-height: 58px !important;
          background: #ffffff !important;
        }

        .mailRow:last-child {
          border-bottom: 0 !important;
        }

        .mailRow h3 {
          font-size: 13.2px !important;
          font-weight: 600 !important;
          margin: 4px 0 3px !important;
          line-height: 1.25 !important;
        }

        .mailMeta {
          font-size: 11px !important;
          gap: 8px !important;
        }

        .mailMeta span {
          font-size: 10.5px !important;
          padding: 2px 7px !important;
        }

        .mailSub {
          font-size: 11.2px !important;
          gap: 8px !important;
        }

        .mailHint {
          font-size: 11.2px !important;
          margin-top: 4px !important;
          color: #9a3412 !important;
        }

        /* Alle Tabellen/Listen-Buttons gleich */
        .mailActions,
        .orderActions {
          gap: 6px !important;
          flex-wrap: nowrap !important;
        }

        .mailActions .primaryBtn,
        .mailActions .secondaryBtn,
        .mailActions .softBtn,
        .mailActions .dangerBtn,
        .orderActions .primaryBtn,
        .orderActions .secondaryBtn,
        .orderActions .softBtn,
        .orderActions .dangerBtn {
          height: 31px !important;
          min-height: 31px !important;
          border-radius: 6px !important;
          padding: 0 10px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }

        .dangerBtn,
        button.dangerBtn {
          background: #fff5f5 !important;
          border: 1px solid #fecaca !important;
          color: #b91c1c !important;
        }

        .dangerBtn:hover,
        button.dangerBtn:hover {
          background: #fee2e2 !important;
          border-color: #fca5a5 !important;
          color: #991b1b !important;
        }

        /* Kategorie Navigation stabiler, damit nichts springt */
        .bucketNav {
          min-height: 34px !important;
          align-items: center !important;
        }

        .bucket {
          transition: none !important;
        }

        .statCard,
        .bucket,
        .primaryBtn,
        .secondaryBtn,
        .softBtn,
        .dangerBtn {
          transition: none !important;
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
console.log("Links auf React-Router umgestellt und E-Mail-Liste tabellarischer gemacht.");
