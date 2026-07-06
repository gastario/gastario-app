const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// 1) Sortierte Auftragsliste direkt vor return einfügen
if (!content.includes("const sortedOrders = [...data.orders].sort")) {
  content = content.replace(
`  const emailResetHref = "/auftragseingang?emailCategory=" + data.selectedEmailCategory + "&dateRange=last7";

  return (`,
`  const emailResetHref = "/auftragseingang?emailCategory=" + data.selectedEmailCategory + "&dateRange=last7";

  const sortedOrders = [...data.orders].sort((a: any, b: any) => {
    const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;

    if (dateA !== dateB) return dateA - dateB;

    const timeToMinutes = (value: string | null | undefined) => {
      const match = String(value || "").match(/(\\d{1,2})[:.](\\d{2})/);
      if (!match) return 9999;
      return Number(match[1]) * 60 + Number(match[2]);
    };

    return timeToMinutes(a.deliveryTimeText) - timeToMinutes(b.deliveryTimeText);
  });

  return (`
  );
}

// 2) JSX auf sortedOrders umstellen
content = content.replaceAll("data.orders.length === 0", "sortedOrders.length === 0");
content = content.replaceAll("data.orders.map((order: any) => {", "sortedOrders.map((order: any) => {");

// 3) Ruhigere, neue Darstellung für E-Mail-Bereich/Karten/Filter
if (!content.includes("/* inbox-layout-clean-v5 */")) {
  const css = `
      <style>{\`
        /* inbox-layout-clean-v5 */

        .inboxPage {
          max-width: 1160px !important;
        }

        .inboxHero {
          border-radius: 10px !important;
          padding: 16px 18px !important;
          margin-bottom: 10px !important;
        }

        .inboxHero h1 {
          font-size: 26px !important;
          font-weight: 600 !important;
        }

        .heroActions {
          gap: 6px !important;
        }

        .primaryBtn,
        .secondaryBtn,
        .softBtn,
        .dangerBtn,
        .statusPill {
          min-height: 31px !important;
          height: 31px !important;
          border-radius: 7px !important;
          padding: 0 10px !important;
          font-size: 12.5px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }

        .compactStats {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 8px !important;
          margin-bottom: 12px !important;
        }

        .statCard {
          min-height: 48px !important;
          padding: 9px 12px !important;
          border-radius: 8px !important;
        }

        .statCard strong {
          font-size: 21px !important;
        }

        .statCard span {
          font-size: 11.5px !important;
        }

        .inboxPanel {
          padding: 14px !important;
          border-radius: 10px !important;
        }

        .panelTop {
          display: grid !important;
          grid-template-columns: minmax(260px, 1fr) minmax(520px, 640px) !important;
          align-items: start !important;
          gap: 14px !important;
          margin-bottom: 12px !important;
        }

        .panelTop h2 {
          font-size: 20px !important;
          margin-top: 3px !important;
        }

        .panelTop p {
          font-size: 13px !important;
        }

        .filterBar {
          width: 100% !important;
          display: grid !important;
          grid-template-columns: minmax(190px, 1.2fr) minmax(170px, .8fr) auto auto !important;
          gap: 7px !important;
          align-items: end !important;
          padding: 7px !important;
          border-radius: 9px !important;
          background: #f8fafc !important;
        }

        .filterBar input,
        .filterBar select {
          width: 100% !important;
          min-width: 0 !important;
          height: 32px !important;
          min-height: 32px !important;
          font-size: 12.5px !important;
          border-radius: 7px !important;
        }

        .filterBar label {
          font-size: 9.8px !important;
          gap: 3px !important;
          min-width: 0 !important;
        }

        .bucketNav {
          display: grid !important;
          grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
          gap: 7px !important;
          margin-bottom: 10px !important;
        }

        .bucket {
          position: relative !important;
          overflow: hidden !important;
          min-height: 48px !important;
          padding: 9px 34px 9px 10px !important;
          border-radius: 8px !important;
          align-items: flex-start !important;
        }

        .bucket strong {
          font-size: 12.8px !important;
          line-height: 1.1 !important;
          white-space: normal !important;
        }

        .bucket small {
          font-size: 10.7px !important;
          line-height: 1.15 !important;
          margin-top: 3px !important;
          max-height: 25px !important;
          overflow: hidden !important;
        }

        .bucket b {
          position: absolute !important;
          right: 8px !important;
          top: 8px !important;
          min-width: 20px !important;
          height: 18px !important;
          padding: 0 5px !important;
          font-size: 10.5px !important;
          z-index: 2 !important;
        }

        .emptyState {
          padding: 11px 12px !important;
          font-size: 12.8px !important;
          border-radius: 8px !important;
        }

        .ordersPanel {
          padding: 14px !important;
          border-radius: 10px !important;
        }

        .ordersHead,
        .ordersRow {
          grid-template-columns: 1.15fr 1.25fr .85fr 1.35fr .75fr .75fr auto !important;
          gap: 10px !important;
        }

        .ordersHead {
          padding: 8px 10px !important;
          font-size: 10px !important;
        }

        .ordersRow {
          padding: 10px !important;
          font-size: 12.8px !important;
        }

        .ordersRow strong {
          font-weight: 600 !important;
        }

        .ordersRow small {
          font-size: 11.5px !important;
        }

        .statusBadge {
          font-size: 11.5px !important;
          padding: 3px 8px !important;
        }

        @media (max-width: 1250px) {
          .bucketNav {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .panelTop {
            grid-template-columns: 1fr !important;
          }

          .filterBar {
            grid-template-columns: 1fr 1fr auto auto !important;
          }
        }

        @media (max-width: 800px) {
          .compactStats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .bucketNav {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .filterBar {
            grid-template-columns: 1fr !important;
          }
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang: Sortierung und kompaktere E-Mail-Karten gefixt.");
