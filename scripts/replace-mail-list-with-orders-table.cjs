const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const start = content.indexOf('            <div className="mailList">');
const endMarker = '          )}\n        </section>';
const end = content.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error("Mail-Liste Block nicht gefunden.");
}

const newMailTable = `            <div className="ordersTable emailTable">
              <div className="ordersHead emailHead">
                <span>Betreff</span>
                <span>Absender</span>
                <span>Datum</span>
                <span>Kategorie</span>
                <span>Anhang</span>
                <span>Status</span>
                <span>Aktion</span>
              </div>

              {sortedEmails.map((mail: any) => {
                const category = classifyIncomingEmail(mail);
                const receivedDate = new Date(mail.receivedAt || mail.createdAt);

                return (
                  <div className="ordersRow emailRow" key={mail.id}>
                    <div>
                      <strong>{mail.subject || "Ohne Betreff"}</strong>
                      {mail.errorMessage ? <small className="emailErrorText">{mail.errorMessage}</small> : null}
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
                      <strong>{emailCategoryLabel(category)}</strong>
                      <small>{category === "inquiries" ? "Angebot vorbereiten" : "E-Mail prüfen"}</small>
                    </div>

                    <strong>{mail.attachments?.length || 0}</strong>

                    <span className="statusBadge">{mail.status === "IGNORED" ? "Ausgeblendet" : "Ungeprüft"}</span>

                    <div className="orderActions">
                      <a href={"/email-pruefung/" + mail.id} className="primaryBtn small">Prüfen</a>

                      {category === "inquiries" ? (
                        <a href={"/angebot-vorbereiten/" + mail.id} className="softBtn small">
                          Angebot
                        </a>
                      ) : null}

                      {mail.status !== "IGNORED" ? (
                        <Form method="post">
                          <input type="hidden" name="intent" value="hideIncomingEmail" />
                          <input type="hidden" name="emailId" value={mail.id} />
                          <button type="submit" className="secondaryBtn small">Ausblenden</button>
                        </Form>
                      ) : (
                        <Form method="post">
                          <input type="hidden" name="intent" value="unhideIncomingEmail" />
                          <input type="hidden" name="emailId" value={mail.id} />
                          <button type="submit" className="secondaryBtn small">Einblenden</button>
                        </Form>
                      )}

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

content = content.slice(0, start) + newMailTable + content.slice(end);

const marker = "/* email-table-uses-orders-table-v15 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        .emailTable .ordersHead,
        .emailTable .ordersRow {
          grid-template-columns: 1.35fr 1.35fr .75fr 1fr .45fr .7fr auto !important;
        }

        .emailTable .ordersRow {
          min-height: 62px !important;
        }

        .emailTable .orderActions {
          justify-content: flex-end !important;
          flex-wrap: nowrap !important;
          gap: 6px !important;
        }

        .emailTable .softBtn {
          background: #ecfdf5 !important;
          border: 1px solid #bbf7d0 !important;
          color: #047857 !important;
        }

        .emailErrorText {
          color: #9a3412 !important;
          font-size: 11px !important;
          line-height: 1.25 !important;
          margin-top: 3px !important;
          max-width: 360px !important;
        }

        .emailTable .statusBadge {
          justify-self: start !important;
        }

        @media (max-width: 1150px) {
          .emailTable .ordersHead {
            display: none !important;
          }

          .emailTable .ordersRow {
            grid-template-columns: 1fr !important;
          }

          .emailTable .orderActions {
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
console.log("E-Mail-/Anfragen-Liste nutzt jetzt dieselbe Tabellenstruktur wie die Auftragsliste.");
