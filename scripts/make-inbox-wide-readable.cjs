const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const marker = "/* inbox-wide-readable-v10 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        .inboxPage {
          max-width: 1320px !important;
          width: 100% !important;
          margin: 0 auto !important;
          padding-left: 22px !important;
          padding-right: 22px !important;
        }

        .inboxHero,
        .inboxPanel,
        .ordersPanel {
          width: 100% !important;
          box-sizing: border-box !important;
        }

        .panelTop {
          grid-template-columns: minmax(260px, 1fr) minmax(620px, 760px) !important;
        }

        .filterBar {
          grid-template-columns: minmax(280px, 1fr) 190px auto auto !important;
        }

        .ordersHead,
        .ordersRow {
          grid-template-columns: 1.1fr 1.25fr .85fr 1.65fr .75fr .72fr auto !important;
          gap: 12px !important;
        }

        .ordersRow small {
          max-width: 100% !important;
        }

        .mailRow {
          grid-template-columns: minmax(0, 1fr) auto !important;
        }

        .mailMain {
          min-width: 0 !important;
        }

        .mailActions,
        .orderActions {
          min-width: max-content !important;
        }

        @media (min-width: 1500px) {
          .inboxPage {
            max-width: 1380px !important;
          }
        }

        @media (max-width: 1200px) {
          .inboxPage {
            max-width: 100% !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .panelTop {
            grid-template-columns: 1fr !important;
          }

          .filterBar {
            grid-template-columns: 1fr 190px auto auto !important;
          }
        }

        @media (max-width: 900px) {
          .filterBar {
            grid-template-columns: 1fr !important;
          }
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
console.log("Auftragseingang breiter und lesbarer gemacht.");
