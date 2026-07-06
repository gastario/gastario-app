const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const marker = "/* inbox-unified-tables-and-select-fix-v9 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        /* Filter oben: Select nicht abschneiden */
        .filterBar {
          align-items: end !important;
          overflow: visible !important;
        }

        .filterBar select,
        .filterBar input {
          height: 36px !important;
          min-height: 36px !important;
          line-height: 36px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
          border-radius: 8px !important;
          box-sizing: border-box !important;
        }

        .filterBar select {
          appearance: auto !important;
          -webkit-appearance: menulist !important;
          padding-right: 28px !important;
          background-color: #ffffff !important;
        }

        .filterBar .primaryBtn,
        .filterBar .secondaryBtn {
          height: 36px !important;
          min-height: 36px !important;
          line-height: 36px !important;
          border-radius: 8px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
        }

        /* Beide unteren Bereiche gleich breit und gleich ruhig */
        .inboxPanel,
        .ordersPanel {
          border-radius: 10px !important;
          padding: 14px !important;
          margin-bottom: 12px !important;
        }

        .panelTop {
          margin-bottom: 12px !important;
        }

        /* E-Mail-Liste wie Tabelle darstellen */
        .mailList {
          display: grid !important;
          gap: 0 !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .mailRow {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 12px !important;
          align-items: center !important;
          border: 0 !important;
          border-bottom: 1px solid #edf2f7 !important;
          border-radius: 0 !important;
          padding: 11px 12px !important;
          box-shadow: none !important;
          background: #ffffff !important;
          min-height: 62px !important;
        }

        .mailRow:last-child {
          border-bottom: 0 !important;
        }

        .mailRow h3 {
          font-size: 14px !important;
          font-weight: 600 !important;
          line-height: 1.25 !important;
          margin: 5px 0 4px !important;
        }

        .mailMeta,
        .mailSub {
          font-size: 11.5px !important;
          line-height: 1.25 !important;
          gap: 8px !important;
        }

        .mailMeta span {
          font-size: 10.5px !important;
          padding: 2px 7px !important;
          border-radius: 999px !important;
        }

        .mailHint {
          font-size: 11.5px !important;
          margin-top: 5px !important;
          line-height: 1.3 !important;
        }

        .mailActions {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 6px !important;
          flex-wrap: nowrap !important;
        }

        /* Auftragsliste optisch passend zur Mail-Liste */
        .ordersTable {
          border-radius: 10px !important;
          border: 1px solid #e2e8f0 !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .ordersHead {
          padding: 9px 12px !important;
          background: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
          color: #64748b !important;
          font-size: 10.5px !important;
          font-weight: 700 !important;
          letter-spacing: .055em !important;
        }

        .ordersRow {
          padding: 11px 12px !important;
          min-height: 62px !important;
          border-bottom: 1px solid #edf2f7 !important;
          background: #ffffff !important;
          font-size: 12.8px !important;
        }

        .ordersRow:last-child {
          border-bottom: 0 !important;
        }

        .ordersRow strong {
          font-size: 12.8px !important;
          line-height: 1.25 !important;
          font-weight: 600 !important;
        }

        .ordersRow small {
          font-size: 11.4px !important;
          line-height: 1.25 !important;
          color: #64748b !important;
        }

        .ordersHead,
        .ordersRow {
          grid-template-columns: 1.15fr 1.15fr .85fr 1.35fr .72fr .72fr auto !important;
          gap: 10px !important;
        }

        /* Buttons überall gleich */
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
          padding: 0 10px !important;
          font-size: 12.3px !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
        }

        .orderActions {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 6px !important;
          flex-wrap: nowrap !important;
        }

        .statusBadge {
          font-size: 11.5px !important;
          height: 24px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 8px !important;
          border-radius: 999px !important;
          white-space: nowrap !important;
        }

        /* Kategorie-Pills oben nicht mehr wie Karten */
        .bucketNav {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          margin: 10px 0 11px !important;
        }

        .bucket {
          height: 31px !important;
          min-height: 31px !important;
          border-radius: 999px !important;
          padding: 0 9px 0 11px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
          width: auto !important;
          flex: 0 0 auto !important;
          background: #ffffff !important;
        }

        .bucket strong {
          font-size: 12.2px !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
        }

        .bucket small {
          display: none !important;
        }

        .bucket b {
          position: static !important;
          height: 17px !important;
          min-width: 17px !important;
          font-size: 10px !important;
          padding: 0 5px !important;
        }

        @media (max-width: 1050px) {
          .mailRow,
          .ordersRow {
            grid-template-columns: 1fr !important;
          }

          .mailActions,
          .orderActions {
            justify-content: flex-start !important;
            flex-wrap: wrap !important;
          }

          .ordersHead {
            display: none !important;
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
console.log("E-Mail-Liste und Auftragsliste vereinheitlicht, Zeitraum-Select repariert.");
