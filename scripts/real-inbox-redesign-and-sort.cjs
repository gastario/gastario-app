const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// Sortierung: Zukunft zuerst, dann Datum/Uhrzeit
const oldSort = `  const sortedOrders = [...data.orders].sort((a: any, b: any) => {
    const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;

    if (dateA !== dateB) return dateA - dateB;

    const timeToMinutes = (value: string | null | undefined) => {
      const match = String(value || "").match(/(\\d{1,2})[:.](\\d{2})/);
      if (!match) return 9999;
      return Number(match[1]) * 60 + Number(match[2]);
    };

    return timeToMinutes(a.deliveryTimeText) - timeToMinutes(b.deliveryTimeText);
  });`;

const newSort = `  const sortedOrders = [...data.orders].sort((a: any, b: any) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

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

    const aIsPast = timeA < startOfToday.getTime();
    const bIsPast = timeB < startOfToday.getTime();

    if (aIsPast !== bIsPast) {
      return aIsPast ? 1 : -1;
    }

    return timeA - timeB;
  });`;

if (content.includes(oldSort)) {
  content = content.replace(oldSort, newSort);
} else {
  console.log("Sortierblock nicht exakt gefunden. CSS wird trotzdem gepatcht.");
}

if (!content.includes("/* inbox-real-redesign-v6 */")) {
  const css = `
      <style>{\`
        /* inbox-real-redesign-v6 */

        .inboxPage {
          max-width: 1140px !important;
          padding: 0 20px 36px !important;
        }

        .inboxHero {
          padding: 14px 18px !important;
          border-radius: 9px !important;
          margin-bottom: 8px !important;
        }

        .inboxHero h1 {
          font-size: 25px !important;
          font-weight: 600 !important;
          letter-spacing: -0.03em !important;
        }

        .inboxHero p {
          font-size: 13px !important;
          margin-top: 5px !important;
        }

        .liveInfo {
          font-size: 12px !important;
          margin-bottom: 8px !important;
        }

        .compactStats {
          display: flex !important;
          gap: 8px !important;
          margin-bottom: 10px !important;
        }

        .statCard {
          flex: 1 !important;
          min-height: 44px !important;
          padding: 8px 11px !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }

        .statCard.active {
          background: #0f8f70 !important;
        }

        .statCard span {
          font-size: 11px !important;
          font-weight: 600 !important;
        }

        .statCard strong {
          font-size: 19px !important;
          margin-top: 2px !important;
          font-weight: 600 !important;
        }

        .inboxPanel {
          padding: 13px 14px !important;
          border-radius: 9px !important;
          margin-bottom: 12px !important;
        }

        .panelTop {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          margin-bottom: 10px !important;
        }

        .panelTop h2 {
          font-size: 19px !important;
          margin: 3px 0 0 !important;
        }

        .panelTop p {
          font-size: 12.5px !important;
          margin-top: 4px !important;
        }

        .filterBar {
          display: grid !important;
          grid-template-columns: minmax(260px, 1fr) 190px auto auto !important;
          width: 100% !important;
          padding: 6px !important;
          gap: 6px !important;
          border-radius: 8px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
        }

        .filterBar label {
          font-size: 9.5px !important;
          letter-spacing: .06em !important;
          gap: 3px !important;
        }

        .filterBar input,
        .filterBar select {
          height: 31px !important;
          min-height: 31px !important;
          border-radius: 6px !important;
          font-size: 12.5px !important;
          padding: 0 9px !important;
        }

        .filterBar .primaryBtn,
        .filterBar .secondaryBtn {
          height: 31px !important;
          min-height: 31px !important;
          border-radius: 6px !important;
          padding: 0 10px !important;
          font-size: 12px !important;
        }

        /* Kategorien ab jetzt wie kleine Segment-Pills, keine großen Karten */
        .bucketNav {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          margin: 8px 0 10px !important;
        }

        .bucket {
          width: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          height: 34px !important;
          padding: 0 9px 0 11px !important;
          border-radius: 999px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
          background: #ffffff !important;
          border: 1px solid #dbe5ec !important;
          overflow: visible !important;
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
          font-size: 12.5px !important;
          line-height: 1 !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
        }

        .bucket small {
          display: none !important;
        }

        .bucket b {
          position: static !important;
          min-width: 18px !important;
          height: 18px !important;
          padding: 0 6px !important;
          border-radius: 999px !important;
          background: #f1f5f9 !important;
          color: #0f172a !important;
          font-size: 10.5px !important;
          font-weight: 650 !important;
        }

        .bucket.active b {
          background: rgba(255,255,255,.22) !important;
          color: #ffffff !important;
        }

        .emptyState {
          padding: 10px 12px !important;
          border-radius: 8px !important;
          font-size: 12.5px !important;
          margin-top: 6px !important;
        }

        .ordersPanel {
          padding: 13px 14px !important;
          border-radius: 9px !important;
        }

        .ordersPanel .panelTop h2 {
          font-size: 19px !important;
        }

        .ordersHead,
        .ordersRow {
          grid-template-columns: 1.15fr 1.25fr .85fr 1.45fr .75fr .7fr auto !important;
          gap: 9px !important;
        }

        .ordersHead {
          padding: 8px 10px !important;
          font-size: 9.8px !important;
        }

        .ordersRow {
          padding: 9px 10px !important;
          font-size: 12.5px !important;
          min-height: 54px !important;
        }

        .ordersRow strong {
          font-size: 12.8px !important;
          font-weight: 600 !important;
        }

        .ordersRow small {
          font-size: 11px !important;
          margin-top: 2px !important;
        }

        .orderActions {
          gap: 5px !important;
        }

        .orderActions .primaryBtn,
        .orderActions .dangerBtn {
          height: 30px !important;
          min-height: 30px !important;
          padding: 0 9px !important;
          font-size: 12px !important;
          border-radius: 6px !important;
        }

        .statusBadge {
          font-size: 11px !important;
          padding: 3px 7px !important;
        }

        @media (max-width: 900px) {
          .compactStats {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .filterBar {
            grid-template-columns: 1fr !important;
          }

          .bucket {
            height: 32px !important;
          }
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang: echtes ruhigeres Redesign und Zukunftssortierung eingefuegt.");
