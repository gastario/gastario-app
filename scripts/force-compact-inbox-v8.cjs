const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const marker = "/* inbox-actual-compact-final-v8 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        .inboxPage {
          max-width: 1080px !important;
          padding: 0 16px 32px !important;
        }

        .inboxHero {
          padding: 12px 16px !important;
          border-radius: 8px !important;
          margin-bottom: 8px !important;
        }

        .inboxHero h1 {
          font-size: 23px !important;
          line-height: 1.08 !important;
          font-weight: 600 !important;
        }

        .inboxHero p {
          font-size: 12.5px !important;
          margin-top: 5px !important;
        }

        .liveInfo {
          font-size: 11.5px !important;
          margin-bottom: 7px !important;
        }

        .compactStats {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 7px !important;
          margin-bottom: 10px !important;
        }

        .statCard {
          min-height: 38px !important;
          padding: 7px 10px !important;
          border-radius: 7px !important;
        }

        .statCard span {
          font-size: 10.8px !important;
        }

        .statCard strong {
          font-size: 17px !important;
          margin-top: 1px !important;
        }

        .inboxPanel,
        .ordersPanel {
          padding: 11px 12px !important;
          border-radius: 8px !important;
          margin-bottom: 10px !important;
        }

        .panelTop {
          display: grid !important;
          grid-template-columns: 1fr minmax(500px, 600px) !important;
          gap: 10px !important;
          margin-bottom: 8px !important;
        }

        .panelTop h2 {
          font-size: 17px !important;
          margin: 2px 0 0 !important;
        }

        .panelTop p {
          font-size: 12px !important;
          margin-top: 3px !important;
        }

        .filterBar {
          display: grid !important;
          grid-template-columns: minmax(210px, 1fr) 165px auto auto !important;
          gap: 5px !important;
          padding: 5px !important;
          border-radius: 7px !important;
        }

        .filterBar input,
        .filterBar select {
          height: 28px !important;
          min-height: 28px !important;
          font-size: 11.8px !important;
          border-radius: 6px !important;
        }

        .filterBar label {
          font-size: 9px !important;
        }

        .bucketNav {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 5px !important;
          margin: 7px 0 8px !important;
        }

        .bucket {
          height: 28px !important;
          min-height: 0 !important;
          padding: 0 8px !important;
          border-radius: 999px !important;
          display: inline-flex !important;
          align-items: center !important;
          width: auto !important;
          flex: 0 0 auto !important;
          background: #ffffff !important;
        }

        .bucket.active {
          background: #0f8f70 !important;
          color: #ffffff !important;
        }

        .bucket strong {
          font-size: 11.5px !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        .bucket small {
          display: none !important;
        }

        .bucket b {
          position: static !important;
          height: 16px !important;
          min-width: 16px !important;
          font-size: 9.5px !important;
          padding: 0 5px !important;
        }

        .emptyState {
          padding: 8px 10px !important;
          font-size: 12px !important;
        }

        .ordersHead,
        .ordersRow {
          grid-template-columns: 1.1fr 1.15fr .8fr 1.35fr .7fr .65fr auto !important;
          gap: 8px !important;
        }

        .ordersHead {
          padding: 7px 9px !important;
          font-size: 9.2px !important;
        }

        .ordersRow {
          padding: 8px 9px !important;
          min-height: 46px !important;
          font-size: 12px !important;
        }

        .ordersRow strong {
          font-size: 12px !important;
        }

        .ordersRow small {
          font-size: 10.5px !important;
        }

        .primaryBtn,
        .secondaryBtn,
        .softBtn,
        .dangerBtn,
        .statusPill {
          height: 28px !important;
          min-height: 28px !important;
          border-radius: 6px !important;
          padding: 0 8px !important;
          font-size: 11.8px !important;
        }

        @media (max-width: 1000px) {
          .panelTop {
            grid-template-columns: 1fr !important;
          }

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
console.log("Finaler sichtbarer Compact-Style v8 eingefügt.");
