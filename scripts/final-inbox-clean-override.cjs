const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// Sortierung: ab jetzt kommende Lieferungen zuerst, alte Lieferungen danach
const sortStart = content.indexOf("  const sortedOrders = [...data.orders].sort((a: any, b: any) => {");
if (sortStart !== -1) {
  const returnStart = content.indexOf("\n  return (", sortStart);

  if (returnStart !== -1) {
    const newSort = `  const sortedOrders = [...data.orders].sort((a: any, b: any) => {
    const now = Date.now();

    const getDateTime = (order: any) => {
      const date = order.deliveryDate ? new Date(order.deliveryDate) : null;

      if (!date || Number.isNaN(date.getTime())) {
        return Number.MAX_SAFE_INTEGER;
      }

      const match = String(order.deliveryTimeText || "").match(/(\\d{1,2})[:.](\\d{2})/);

      if (match) {
        date.setHours(Number(match[1]), Number(match[2]), 0, 0);
      } else {
        date.setHours(23, 59, 0, 0);
      }

      return date.getTime();
    };

    const timeA = getDateTime(a);
    const timeB = getDateTime(b);

    const aIsPast = timeA < now;
    const bIsPast = timeB < now;

    if (aIsPast !== bIsPast) {
      return aIsPast ? 1 : -1;
    }

    return timeA - timeB;
  });
`;

    content = content.slice(0, sortStart) + newSort + content.slice(returnStart);
  }
}

// Finale Styles wirklich ganz hinten setzen, damit alte Styles nicht mehr gewinnen
const oldMarker = "/* inbox-final-clean-override-v7 */";
if (!content.includes(oldMarker)) {
  const css = `
      <style>{\`
        /* inbox-final-clean-override-v7 */

        .inboxPage {
          max-width: 1120px !important;
          padding: 0 18px 34px !important;
        }

        .inboxHero {
          padding: 14px 17px !important;
          border-radius: 8px !important;
          box-shadow: 0 3px 10px rgba(15, 23, 42, 0.025) !important;
        }

        .inboxHero h1 {
          font-size: 24px !important;
          font-weight: 600 !important;
        }

        .inboxHero p {
          font-size: 13px !important;
          font-weight: 450 !important;
        }

        .compactStats {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 7px !important;
          margin: 8px 0 10px !important;
        }

        .statCard {
          min-height: 42px !important;
          padding: 8px 11px !important;
          border-radius: 7px !important;
          box-shadow: none !important;
        }

        .statCard span {
          font-size: 11px !important;
          font-weight: 600 !important;
        }

        .statCard strong {
          font-size: 18px !important;
          font-weight: 600 !important;
        }

        .inboxPanel,
        .ordersPanel {
          padding: 12px 14px !important;
          border-radius: 8px !important;
          box-shadow: 0 3px 10px rgba(15, 23, 42, 0.025) !important;
        }

        .panelTop {
          display: grid !important;
          grid-template-columns: 1fr minmax(520px, 620px) !important;
          gap: 12px !important;
          align-items: start !important;
          margin-bottom: 9px !important;
        }

        .panelTop h2 {
          font-size: 18px !important;
          font-weight: 600 !important;
          margin: 2px 0 0 !important;
        }

        .panelTop p {
          font-size: 12.5px !important;
          margin-top: 4px !important;
        }

        .filterBar {
          display: grid !important;
          grid-template-columns: minmax(220px, 1fr) 178px auto auto !important;
          gap: 6px !important;
          padding: 6px !important;
          border-radius: 8px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
        }

        .filterBar label {
          font-size: 9.5px !important;
          font-weight: 700 !important;
          gap: 3px !important;
        }

        .filterBar input,
        .filterBar select {
          min-width: 0 !important;
          width: 100% !important;
          height: 30px !important;
          min-height: 30px !important;
          border-radius: 6px !important;
          font-size: 12px !important;
        }

        .filterBar .primaryBtn,
        .filterBar .secondaryBtn {
          height: 30px !important;
          min-height: 30px !important;
          border-radius: 6px !important;
          padding: 0 9px !important;
          font-size: 12px !important;
        }

        /* Kategorien endgültig als kleine Pills */
        .bucketNav {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 5px !important;
          margin: 8px 0 9px !important;
        }

        .bucket {
          flex: 0 0 auto !important;
          width: auto !important;
          min-width: 0 !important;
          max-width: none !important;
          min-height: 0 !important;
          height: 30px !important;
          padding: 0 8px 0 10px !important;
          border-radius: 999px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 6px !important;
          background: #ffffff !important;
          border: 1px solid #dbe5ec !important;
          color: #111827 !important;
          overflow: visible !important;
          box-shadow: none !important;
        }

        .bucket.active {
          background: #0f8f70 !important;
          border-color: #0f8f70 !important;
          color: #ffffff !important;
        }

        .bucket span {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0 !important;
        }

        .bucket strong {
          font-size: 12px !important;
          line-height: 1 !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
        }

        .bucket small {
          display: none !important;
        }

        .bucket b {
          position: static !important;
          min-width: 17px !important;
          height: 17px !important;
          padding: 0 5px !important;
          border-radius: 999px !important;
          background: #f1f5f9 !important;
          color: #0f172a !important;
          font-size: 10px !important;
          font-weight: 650 !important;
          z-index: auto !important;
        }

        .bucket.active b {
          background: rgba(255, 255, 255, .22) !important;
          color: #ffffff !important;
        }

        .emptyState {
          padding: 9px 11px !important;
          border-radius: 7px !important;
          font-size: 12.5px !important;
        }

        .ordersHead,
        .ordersRow {
          grid-template-columns: 1.15fr 1.2fr .85fr 1.45fr .7fr .7fr auto !important;
          gap: 8px !important;
        }

        .ordersHead {
          padding: 7px 9px !important;
          font-size: 9.5px !important;
        }

        .ordersRow {
          padding: 8px 9px !important;
          font-size: 12.3px !important;
          min-height: 50px !important;
        }

        .ordersRow strong {
          font-size: 12.5px !important;
          font-weight: 600 !important;
        }

        .ordersRow small {
          font-size: 10.8px !important;
          margin-top: 2px !important;
        }

        .primaryBtn,
        .secondaryBtn,
        .softBtn,
        .dangerBtn,
        .statusPill {
          min-height: 29px !important;
          height: 29px !important;
          border-radius: 6px !important;
          padding: 0 9px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }

        .statusBadge {
          font-size: 10.8px !important;
          padding: 3px 7px !important;
        }

        @media (max-width: 1000px) {
          .panelTop {
            grid-template-columns: 1fr !important;
          }

          .filterBar {
            grid-template-columns: 1fr !important;
          }

          .compactStats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
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
console.log("Finaler Auftragseingang-Override und echte Zukunftssortierung gesetzt.");
