const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const start = content.indexOf('            <div className="ordersTable emailTable">');
const endMarker = '          )}\n        </section>';
const end = content.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error("EmailTable Block nicht gefunden.");
}

const cleanEmailTable = `            <div className="ordersTable emailTable">
              <div className="ordersHead">
                <span>Betreff</span>
                <span>Absender</span>
                <span>Eingang</span>
                <span>Typ</span>
                <span></span>
                <span>Status</span>
                <span>Aktion</span>
              </div>

              {sortedEmails.map((mail: any) => {
                const category = classifyIncomingEmail(mail);
                const receivedDate = new Date(mail.receivedAt || mail.createdAt);
                const isInquiry = category === "inquiries";

                return (
                  <div className="ordersRow emailRow" key={mail.id}>
                    <div>
                      <strong>{mail.subject || "Ohne Betreff"}</strong>
                      <small>{emailCategoryLabel(category)}</small>
                    </div>

                    <div>
                      <strong>{mail.sender || "-"}</strong>
                      <small>{mail.account?.email || mail.accountEmail || "-"}</small>
                    </div>

                    <div>
                      <strong>{receivedDate.toLocaleDateString("de-DE")}</strong>
                      <small>{receivedDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</small>
                    </div>

                    <div>
                      <strong>{isInquiry ? "Anfrage" : "E-Mail"}</strong>
                      <small>{mail.attachments?.length || 0} Anhänge</small>
                    </div>

                    <strong>-</strong>

                    <span className="statusBadge">{mail.status === "IGNORED" ? "Ausgeblendet" : "Ungeprüft"}</span>

                    <div className="orderActions">
                      <a
                        href={(isInquiry ? "/angebot-vorbereiten/" : "/email-pruefung/") + mail.id}
                        className="primaryBtn small"
                      >
                        {isInquiry ? "Angebot" : "Prüfen"}
                      </a>

                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteIncomingEmail" />
                        <input type="hidden" name="emailId" value={mail.id} />
                        <button type="submit" className="dangerBtn small">Löschen</button>
                      </Form>
                    </div>
                  </div>
                );
              })}
            </div>
`;

content = content.slice(0, start) + cleanEmailTable + content.slice(end);

const marker = "/* email-table-identical-to-orders-v16 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        .emailTable .ordersHead,
        .emailTable .ordersRow {
          grid-template-columns: 1.15fr 1.25fr .85fr 1.45fr .75fr .7fr auto !important;
          gap: 9px !important;
        }

        .emailTable .ordersRow {
          min-height: 50px !important;
          padding: 8px 9px !important;
        }

        .emailTable .ordersRow strong {
          font-size: 12.5px !important;
          font-weight: 600 !important;
          line-height: 1.2 !important;
        }

        .emailTable .ordersRow small {
          font-size: 10.8px !important;
          margin-top: 2px !important;
          line-height: 1.2 !important;
          color: #64748b !important;
        }

        .emailTable .orderActions {
          display: flex !important;
          justify-content: flex-end !important;
          align-items: center !important;
          flex-wrap: nowrap !important;
          gap: 6px !important;
        }

        .emailTable .primaryBtn,
        .emailTable .dangerBtn,
        .ordersTable .primaryBtn,
        .ordersTable .dangerBtn {
          height: 30px !important;
          min-height: 30px !important;
          border-radius: 7px !important;
          padding: 0 10px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
          white-space: nowrap !important;
        }

        .emailTable .dangerBtn,
        .ordersTable .dangerBtn {
          background: #fff5f5 !important;
          border: 1px solid #fecaca !important;
          color: #b91c1c !important;
        }

        .emailTable .dangerBtn:hover,
        .ordersTable .dangerBtn:hover {
          background: #fee2e2 !important;
          border-color: #fca5a5 !important;
          color: #991b1b !important;
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
console.log("E-Mail-Tabelle auf gleiche Struktur wie Auftragstabelle reduziert.");
