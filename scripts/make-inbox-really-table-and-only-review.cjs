const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// 1) Auftragseingang: nur noch AUTO_CREATED + nicht vergangen anzeigen
const visibleStart = content.indexOf("  const visibleOrders = sortedOrders.filter((order: any) => {");
if (visibleStart !== -1) {
  const visibleEnd = content.indexOf("\n\n  const hiddenPastOrderCount", visibleStart);

  if (visibleEnd !== -1) {
    const newVisibleBlock = `  const visibleOrders = sortedOrders.filter((order: any) => {
    if (order.status !== "AUTO_CREATED") return false;

    if (!order.deliveryDate) return true;

    const deliveryDate = new Date(order.deliveryDate);

    if (Number.isNaN(deliveryDate.getTime())) return true;

    const match = String(order.deliveryTimeText || "").match(/(\\d{1,2})[:.](\\d{2})/);

    if (match) {
      deliveryDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
    } else {
      deliveryDate.setHours(23, 59, 59, 999);
    }

    return deliveryDate.getTime() >= Date.now();
  });
`;

    content = content.slice(0, visibleStart) + newVisibleBlock + content.slice(visibleEnd);
  }
}

// Falls noch kein visibleOrders-Block existiert
if (!content.includes("const visibleOrders = sortedOrders.filter")) {
  const returnMarker = "\n  return (\n    <AppLayout>";
  const index = content.indexOf(returnMarker);

  if (index === -1) {
    throw new Error("Return-Marker nicht gefunden.");
  }

  const insert = `
  const visibleOrders = sortedOrders.filter((order: any) => {
    if (order.status !== "AUTO_CREATED") return false;

    if (!order.deliveryDate) return true;

    const deliveryDate = new Date(order.deliveryDate);

    if (Number.isNaN(deliveryDate.getTime())) return true;

    const match = String(order.deliveryTimeText || "").match(/(\\d{1,2})[:.](\\d{2})/);

    if (match) {
      deliveryDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
    } else {
      deliveryDate.setHours(23, 59, 59, 999);
    }

    return deliveryDate.getTime() >= Date.now();
  });

  const hiddenPastOrderCount = sortedOrders.length - visibleOrders.length;
`;

  content = content.slice(0, index) + insert + content.slice(index);
}

// 2) Sicherstellen, dass die Tabelle visibleOrders nutzt
content = content.replaceAll("sortedOrders.length === 0", "visibleOrders.length === 0");
content = content.replaceAll("sortedOrders.map((order: any) => {", "visibleOrders.map((order: any) => {");

// 3) E-Mail-Liste wirklich tabellarisch wie Auftragsliste stylen
const marker = "/* inbox-mail-real-table-v14 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        .mailList {
          display: grid !important;
          gap: 0 !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .mailList::before {
          content: "BETREFF    DATUM    ABSENDER    ANHANG    AKTION";
          display: grid !important;
          grid-template-columns: 1.35fr .75fr 1.15fr .55fr auto !important;
          gap: 12px !important;
          padding: 9px 12px !important;
          background: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
          color: #64748b !important;
          font-size: 10.5px !important;
          font-weight: 700 !important;
          letter-spacing: .055em !important;
          white-space: pre !important;
        }

        .mailRow {
          display: grid !important;
          grid-template-columns: 1.35fr .75fr 1.15fr .55fr auto !important;
          gap: 12px !important;
          align-items: center !important;
          border: 0 !important;
          border-bottom: 1px solid #edf2f7 !important;
          border-radius: 0 !important;
          padding: 11px 12px !important;
          min-height: 62px !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        .mailRow:last-child {
          border-bottom: 0 !important;
        }

        .mailMain {
          display: contents !important;
        }

        .mailMeta {
          display: contents !important;
        }

        .mailMeta span {
          grid-column: 1 !important;
          width: fit-content !important;
          font-size: 10.5px !important;
          padding: 2px 7px !important;
          border-radius: 999px !important;
          background: #ecfdf5 !important;
          color: #047857 !important;
          font-weight: 650 !important;
        }

        .mailMeta time {
          grid-column: 2 !important;
          grid-row: 1 / span 2 !important;
          align-self: center !important;
          font-size: 11.5px !important;
          color: #64748b !important;
          font-weight: 500 !important;
        }

        .mailRow h3 {
          grid-column: 1 !important;
          margin: 5px 0 0 !important;
          font-size: 13px !important;
          line-height: 1.25 !important;
          font-weight: 600 !important;
          letter-spacing: -0.01em !important;
        }

        .mailSub {
          display: contents !important;
        }

        .mailSub span {
          font-size: 11.5px !important;
          line-height: 1.25 !important;
          color: #64748b !important;
          font-weight: 450 !important;
        }

        .mailSub span:nth-child(1) {
          grid-column: 3 !important;
          grid-row: 1 / span 2 !important;
          align-self: center !important;
        }

        .mailSub span:nth-child(2) {
          display: none !important;
        }

        .mailSub span:nth-child(3) {
          grid-column: 4 !important;
          grid-row: 1 / span 2 !important;
          align-self: center !important;
        }

        .mailHint {
          display: none !important;
        }

        .mailActions {
          grid-column: 5 !important;
          grid-row: 1 / span 2 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
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
          height: 32px !important;
          min-height: 32px !important;
          border-radius: 7px !important;
          padding: 0 10px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
          white-space: nowrap !important;
        }

        .dangerBtn,
        button.dangerBtn,
        a.dangerBtn {
          background: #fff5f5 !important;
          border: 1px solid #fecaca !important;
          color: #b91c1c !important;
        }

        .dangerBtn:hover,
        button.dangerBtn:hover,
        a.dangerBtn:hover {
          background: #fee2e2 !important;
          border-color: #fca5a5 !important;
          color: #991b1b !important;
        }

        @media (max-width: 1150px) {
          .mailList::before {
            display: none !important;
          }

          .mailRow {
            grid-template-columns: 1fr !important;
          }

          .mailMain,
          .mailMeta,
          .mailSub {
            display: block !important;
          }

          .mailSub span:nth-child(2) {
            display: inline !important;
          }

          .mailHint {
            display: block !important;
          }

          .mailActions {
            grid-column: auto !important;
            grid-row: auto !important;
            justify-content: flex-start !important;
            flex-wrap: wrap !important;
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

// 4) Empty-State klarer machen
content = content.replace(
  "Keine aktuellen Aufträge im Auftragseingang. Vergangene Lieferungen findest du unter „Vergangene Aufträge“.",
  "Keine ungeprüften aktuellen Aufträge. Übernommene Aufträge findest du unter „Bevorstehende Aufträge“, vergangene unter „Vergangene Aufträge“."
);

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang: nur ungeprüfte aktuelle Aufträge und E-Mails tabellarisch angepasst.");
