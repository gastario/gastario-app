const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const marker = "  const currentBucket = EMAIL_BUCKETS.find((bucket) => bucket.key === data.selectedEmailCategory) || EMAIL_BUCKETS[0];";
const start = content.indexOf(marker);

if (start === -1) {
  throw new Error("Start-Marker currentBucket nicht gefunden.");
}

const end = content.lastIndexOf("\n}");

if (end === -1 || end < start) {
  throw new Error("Dateiende der Component nicht gefunden.");
}

const tail = `  const currentBucket = EMAIL_BUCKETS.find((bucket) => bucket.key === data.selectedEmailCategory) || EMAIL_BUCKETS[0];

  const emailResetHref = "/auftragseingang?emailCategory=" + data.selectedEmailCategory + "&dateRange=last7";

  return (
    <AppLayout>
      <div className="inboxPage">
        <header className="inboxHero">
          <div>
            <div className="inboxOverline">Arbeitsbereich</div>
            <h1>Auftragseingang</h1>
            <p>E-Mails abrufen, Anfragen vorbereiten, Aufträge prüfen und Lieferscheine trennen.</p>
          </div>

          <div className="heroActions">
            <button
              type="button"
              className={liveEnabled ? "statusPill isLive" : "statusPill"}
              onClick={() => setLiveEnabled((value) => !value)}
              title={lastAutoImportAt ? "Letzter Auto-Abruf: " + lastAutoImportAt : "Automatischer Abruf"}
            >
              {liveEnabled ? "Live an" : "Live aus"}
            </button>

            <button
              type="button"
              className="primaryBtn"
              onClick={runEmailImportAndReload}
              disabled={isImportingNow}
            >
              {isImportingNow ? "Abrufen..." : "E-Mails abrufen"}
            </button>
          </div>
        </header>

        <div className="liveInfo">
          {liveEnabled ? "Live-Abruf aktiv: neue E-Mails werden automatisch geprüft." : "Live-Abruf ist aus."}
          {lastAutoImportAt ? <span>Letzter Abruf: {lastAutoImportAt}</span> : null}
        </div>

        <section className="compactStats">
          {[
            ["Alle Aufträge", data.counts.all, ""],
            ["Zu prüfen", data.counts.review, "AUTO_CREATED"],
            ["Übernommen", data.counts.confirmed, "CONFIRMED"],
            ["Abgelehnt", data.counts.rejected, "REJECTED"],
          ].map(([label, count, status]) => {
            const active = data.activeStatus === status || (!data.activeStatus && !status);
            const href = status ? "/auftragseingang?status=" + status : "/auftragseingang";

            return (
              <a key={String(label)} href={href} className={active ? "statCard active" : "statCard"}>
                <span>{label}</span>
                <strong>{count}</strong>
              </a>
            );
          })}
        </section>

        {actionData?.error ? (
          <div className="alertBox error">{actionData.error}</div>
        ) : null}

        {actionData?.success ? (
          <div className="alertBox success">{actionData.success}</div>
        ) : null}

        <section className="inboxPanel">
          <div className="panelTop">
            <div>
              <div className="inboxOverline">E-Mail Eingang</div>
              <h2>{emailCategoryLabel(data.selectedEmailCategory)}</h2>
              <p>{currentBucket.help}</p>
            </div>

            <Form method="get" className="filterBar">
              <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />

              <label>
                Suche
                <input
                  name="q"
                  defaultValue={data.searchQuery || ""}
                  placeholder="Betreff, Absender, Kunde"
                />
              </label>

              <label>
                Postfach-Zeitraum
                <select name="dateRange" defaultValue={data.dateRange || "last7"}>
                  <option value="last7">Letzte 7 Tage</option>
                  <option value="today">Heute</option>
                  <option value="yesterday">Gestern</option>
                </select>
              </label>

              <button type="submit" className="primaryBtn small">Filtern</button>
              <a href={emailResetHref} className="secondaryBtn small">Zurücksetzen</a>
            </Form>
          </div>

          <div className="bucketNav">
            {EMAIL_BUCKETS.map((bucket) => {
              const count = data.emailBuckets[bucket.key as keyof typeof data.emailBuckets] ?? 0;
              const params = new URLSearchParams();

              if (data.searchQuery) params.set("q", data.searchQuery);
              if (data.dateRange) params.set("dateRange", data.dateRange);
              if (data.selectedDate) params.set("date", data.selectedDate);
              params.set("emailCategory", bucket.key);

              const active = data.selectedEmailCategory === bucket.key;

              return (
                <a
                  key={bucket.key}
                  href={"/auftragseingang?" + params.toString()}
                  className={active ? "bucket active" : "bucket"}
                >
                  <span>
                    <strong>{bucket.label}</strong>
                    <small>{bucket.help}</small>
                  </span>
                  <b>{count}</b>
                </a>
              );
            })}
          </div>

          {data.emailInbox.length === 0 ? (
            <div className="emptyState">Keine ungeprüften E-Mails in dieser Kategorie.</div>
          ) : (
            <div className="mailList">
              {data.emailInbox.map((mail: any) => {
                const category = classifyIncomingEmail(mail);

                return (
                  <article className="mailRow" key={mail.id}>
                    <div className="mailMain">
                      <div className="mailMeta">
                        <span>{emailCategoryLabel(category)}</span>
                        <time>{new Date(mail.receivedAt || mail.createdAt).toLocaleString("de-DE")}</time>
                      </div>

                      <h3>{mail.subject || "Ohne Betreff"}</h3>

                      <div className="mailSub">
                        <span>Von: {mail.sender || "-"}</span>
                        <span>Postfach: {mail.account?.email || mail.accountEmail || "-"}</span>
                        <span>{mail.attachments?.length || 0} Anhänge</span>
                      </div>

                      {mail.errorMessage ? <p className="mailHint">{mail.errorMessage}</p> : null}
                    </div>

                    <div className="mailActions">
                      <a href={"/email-pruefung/" + mail.id} className="primaryBtn small">Prüfen</a>

                      {category === "inquiries" ? (
                        <a href={"/angebot-vorbereiten/" + mail.id} className="softBtn small">
                          Angebot vorbereiten
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
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="ordersPanel">
          <div className="panelTop slim">
            <div>
              <div className="inboxOverline">Aufträge</div>
              <h2>Zu prüfende Aufträge</h2>
            </div>
          </div>

          <div className="ordersTable">
            <div className="ordersHead">
              <span>Nummer</span>
              <span>Kunde</span>
              <span>Lieferung</span>
              <span>Positionen</span>
              <span>Summe</span>
              <span>Status</span>
              <span>Aktion</span>
            </div>

            {data.orders.length === 0 ? (
              <div className="ordersEmpty">Keine Aufträge im aktuellen Filter.</div>
            ) : (
              data.orders.map((order: any) => {
                const total = order.items.reduce((sum: number, item: any) => sum + (item.totalCents || item.totalPriceCents || 0), 0);

                return (
                  <div className="ordersRow" key={order.id}>
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <small>{sourceLabel(order.source)}</small>
                    </div>

                    <div>
                      <strong>{order.customerName || order.customer?.name || "-"}</strong>
                      <small>{order.contactName || "-"}</small>
                    </div>

                    <div>
                      <strong>{formatDate(order.deliveryDate)}</strong>
                      <small>{order.deliveryTimeText || "-"}</small>
                    </div>

                    <div>
                      <strong>{order.items.length} Positionen</strong>
                      <small>{order.items.slice(0, 2).map((item: any) => item.name).join(", ") || "-"}</small>
                    </div>

                    <strong>{centsToEuro(total)}</strong>

                    <span className="statusBadge">{statusLabel(order.status)}</span>

                    <div className="orderActions">
                      <a href={"/auftrag-pruefung/" + order.id} className="primaryBtn small">Prüfen</a>

                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteOrder" />
                        <input type="hidden" name="orderId" value={order.id} />
                        <button type="submit" className="dangerBtn small">Löschen</button>
                      </Form>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <style>{\`
        .inboxPage {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 22px 40px;
          color: #111827;
        }

        .inboxHero,
        .inboxPanel,
        .ordersPanel {
          background: #ffffff;
          border: 1px solid #dbe5ec;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.035);
        }

        .inboxHero {
          padding: 18px 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 10px;
        }

        .inboxOverline {
          color: #047857;
          text-transform: uppercase;
          letter-spacing: .09em;
          font-size: 10px;
          font-weight: 700;
        }

        .inboxHero h1 {
          margin: 5px 0 0;
          font-size: 28px !important;
          line-height: 1.08;
          font-weight: 600 !important;
          letter-spacing: -0.035em;
        }

        .inboxHero p,
        .panelTop p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
          font-weight: 450;
        }

        .heroActions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .liveInfo {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
          margin: 0 0 10px;
        }

        .compactStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .statCard {
          min-height: 58px;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid #dbe5ec;
          background: #ffffff;
          text-decoration: none;
          color: #111827;
          display: grid;
          align-content: center;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.025);
        }

        .statCard.active {
          background: #0f8f70;
          border-color: #0f8f70;
          color: white;
        }

        .statCard span {
          font-size: 12px;
          color: inherit;
          opacity: .84;
          font-weight: 600;
        }

        .statCard strong {
          font-size: 24px;
          line-height: 1;
          margin-top: 3px;
          font-weight: 600;
          letter-spacing: -0.035em;
        }

        .inboxPanel,
        .ordersPanel {
          padding: 16px;
          margin-bottom: 14px;
        }

        .panelTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        .panelTop.slim {
          margin-bottom: 10px;
        }

        .panelTop h2 {
          margin: 4px 0 0;
          font-size: 21px !important;
          font-weight: 600 !important;
          letter-spacing: -0.03em;
        }

        .filterBar {
          display: flex;
          align-items: end;
          gap: 8px;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          flex-wrap: wrap;
        }

        .filterBar label {
          display: grid;
          gap: 4px;
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: .065em;
          font-weight: 700;
        }

        .filterBar input,
        .filterBar select {
          height: 34px !important;
          min-height: 34px !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          min-width: 190px;
        }

        .filterBar input {
          min-width: 260px;
        }

        .bucketNav {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .bucket {
          min-height: 52px;
          padding: 10px 12px;
          border: 1px solid #dbe5ec;
          border-radius: 10px;
          background: #f8fafc;
          text-decoration: none;
          color: #111827;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .bucket.active {
          background: #0f8f70;
          border-color: #0f8f70;
          color: #ffffff;
        }

        .bucket strong {
          display: block;
          font-size: 14px;
          line-height: 1.15;
          font-weight: 600;
        }

        .bucket small {
          display: block;
          margin-top: 4px;
          font-size: 11.5px;
          line-height: 1.25;
          color: inherit;
          opacity: .76;
          font-weight: 450;
        }

        .bucket b {
          min-width: 22px;
          height: 20px;
          padding: 0 7px;
          border-radius: 999px;
          background: rgba(255,255,255,.85);
          color: #111827;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 650;
        }

        .bucket.active b {
          background: rgba(255,255,255,.2);
          color: #ffffff;
        }

        .emptyState,
        .ordersEmpty {
          padding: 14px;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          background: #f8fafc;
          color: #475569;
          font-size: 13px;
          font-weight: 500;
        }

        .mailList {
          display: grid;
          gap: 9px;
        }

        .mailRow {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
        }

        .mailMeta,
        .mailSub {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
        }

        .mailMeta span {
          color: #047857;
          background: #ecfdf5;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 650;
        }

        .mailRow h3 {
          margin: 7px 0 5px;
          font-size: 15px;
          line-height: 1.25;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .mailHint {
          margin: 8px 0 0;
          color: #9a3412;
          font-size: 12px;
          font-weight: 500;
        }

        .mailActions,
        .orderActions {
          display: flex;
          gap: 7px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .primaryBtn,
        .secondaryBtn,
        .softBtn,
        .dangerBtn,
        .statusPill {
          min-height: 34px;
          border-radius: 8px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          white-space: nowrap;
        }

        .primaryBtn {
          background: #0f9f7a;
          border-color: #0f9f7a;
          color: #ffffff;
        }

        .secondaryBtn,
        .statusPill {
          background: #ffffff;
          border-color: #d6e1ea;
          color: #111827;
        }

        .statusPill.isLive,
        .softBtn {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #047857;
        }

        .dangerBtn {
          background: #fffafa;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .small {
          min-height: 32px;
          padding: 0 10px;
          font-size: 12.5px;
        }

        .ordersTable {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          background: #ffffff;
        }

        .ordersHead,
        .ordersRow {
          display: grid;
          grid-template-columns: 1.1fr 1.25fr .9fr 1.25fr .75fr .75fr auto;
          gap: 12px;
          align-items: center;
        }

        .ordersHead {
          padding: 10px 12px;
          background: #f8fafc;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          border-bottom: 1px solid #e2e8f0;
        }

        .ordersRow {
          padding: 12px;
          border-bottom: 1px solid #edf2f7;
          font-size: 13px;
        }

        .ordersRow:last-child {
          border-bottom: 0;
        }

        .ordersRow strong {
          display: block;
          font-weight: 600;
          line-height: 1.25;
        }

        .ordersRow small {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.25;
          font-weight: 450;
        }

        .statusBadge {
          width: fit-content;
          border-radius: 999px;
          padding: 4px 9px;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #bbf7d0;
          font-size: 12px;
          font-weight: 600;
        }

        .alertBox {
          padding: 11px 13px;
          border-radius: 9px;
          margin-bottom: 12px;
          font-size: 13px;
          font-weight: 600;
        }

        .alertBox.error {
          background: #fff7ed;
          border: 1px solid #fdba74;
          color: #9a3412;
        }

        .alertBox.success {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #047857;
        }

        @media (max-width: 1100px) {
          .inboxHero,
          .panelTop,
          .mailRow {
            grid-template-columns: 1fr;
            display: grid;
          }

          .compactStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ordersHead {
            display: none;
          }

          .ordersRow {
            grid-template-columns: 1fr;
          }

          .filterBar,
          .filterBar input,
          .filterBar select {
            width: 100%;
            min-width: 0;
          }

          .mailActions,
          .orderActions {
            justify-content: flex-start;
          }
        }
      \`}</style>
    </AppLayout>
  );
}
`;

content = content.slice(0, start) + tail + content.slice(end + 2);

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang sichtbar neu aufgebaut.");
