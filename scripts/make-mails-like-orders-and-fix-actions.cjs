const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// 1) E-Mails chronologisch sortieren: neueste zuerst
if (!content.includes("const sortedEmails = [...data.emailInbox].sort")) {
  content = content.replace(
`  return (
    <AppLayout>`,
`  const sortedEmails = [...data.emailInbox].sort((a: any, b: any) => {
    const dateA = new Date(a.receivedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.receivedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return (
    <AppLayout>`
  );
}

content = content.replaceAll("data.emailInbox.map((mail: any) => {", "sortedEmails.map((mail: any) => {");

// 2) Bei übernommenen/abgelehnten Aufträgen nicht mehr „Prüfen“, sondern „Öffnen“
content = content.replace(
`<a href={"/auftrag-pruefung/" + order.id} className="primaryBtn small">Prüfen</a>`,
`<a href={"/auftrag-pruefung/" + order.id} className={order.status === "AUTO_CREATED" ? "primaryBtn small" : "secondaryBtn small"}>
                        {order.status === "AUTO_CREATED" ? "Prüfen" : "Öffnen"}
                      </a>`
);

// 3) Anfragen/E-Mail-Liste optisch wie Auftrags-Tabelle darstellen
const marker = "/* inbox-emails-like-orders-v13 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        /* E-Mail/Anfragen-Liste exakt ruhiger wie die Auftragstabelle */
        .mailList {
          display: grid !important;
          gap: 0 !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .mailList::before {
          content: "";
          display: grid !important;
          grid-template-columns: 1.45fr 1.05fr .7fr auto !important;
          gap: 12px !important;
          padding: 9px 12px !important;
          background: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }

        .mailList::before {
          content: "BETREFF    ABSENDER    ANHANG    AKTION";
          color: #64748b !important;
          font-size: 10.5px !important;
          font-weight: 700 !important;
          letter-spacing: .055em !important;
          white-space: pre !important;
        }

        .mailRow {
          display: grid !important;
          grid-template-columns: 1.45fr 1.05fr .7fr auto !important;
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
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 1fr .45fr !important;
          gap: 12px !important;
          align-items: center !important;
          min-width: 0 !important;
        }

        .mailMeta {
          grid-column: 1 / 2 !important;
          display: flex !important;
          gap: 8px !important;
          align-items: center !important;
          margin-bottom: 4px !important;
        }

        .mailMeta time {
          font-size: 11px !important;
          color: #64748b !important;
          font-weight: 500 !important;
        }

        .mailMeta span {
          font-size: 10.5px !important;
          padding: 2px 7px !important;
          border-radius: 999px !important;
          background: #ecfdf5 !important;
          color: #047857 !important;
          font-weight: 650 !important;
        }

        .mailRow h3 {
          grid-column: 1 / 2 !important;
          margin: 0 !important;
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
          grid-column: 2 / 3 !important;
        }

        .mailSub span:nth-child(2) {
          display: none !important;
        }

        .mailSub span:nth-child(3) {
          grid-column: 3 / 4 !important;
        }

        .mailHint {
          grid-column: 1 / 4 !important;
          margin: 5px 0 0 !important;
          color: #9a3412 !important;
          font-size: 11.2px !important;
          line-height: 1.25 !important;
          font-weight: 500 !important;
        }

        .mailActions {
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

        /* Status/Öffnen bei übernommenen Aufträgen ruhiger */
        .orderActions .secondaryBtn {
          background: #ffffff !important;
          border: 1px solid #d6e1ea !important;
          color: #0f172a !important;
        }

        /* Tabellen nicht springen */
        .mailRow,
        .ordersRow {
          transition: none !important;
        }

        @media (max-width: 1100px) {
          .mailList::before {
            display: none !important;
          }

          .mailRow,
          .mailMain {
            grid-template-columns: 1fr !important;
          }

          .mailSub {
            display: flex !important;
            flex-wrap: wrap !important;
          }

          .mailSub span:nth-child(2) {
            display: inline !important;
          }

          .mailHint {
            grid-column: auto !important;
          }

          .mailActions {
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

fs.writeFileSync(path, content, "utf8");
console.log("Anfragen wie Auftrags-Tabelle gestylt, chronologisch sortiert und Prüfen/Öffnen angepasst.");
