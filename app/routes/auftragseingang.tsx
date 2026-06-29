import AppLayout from "../components/AppLayout";

const incomingOrders = [
  {
    orderNumber: "GA-1042",
    source: "Heycater",
    brand: "Let Me Bowl Catering",
    mailbox: "info@letmebowl-catering.de",
    subject: "Fast Track Order bestätigt",
    customer: "Tech Office GmbH",
    delivery: "02.07.2026 · 11:30 Uhr",
    address: "Alexanderstraße 7, 10178 Berlin",
    items: "60 Bowls, 60 Bestecksets",
    value: "960,00 €",
    pdf: "Auftragsbestaetigung_1042.pdf",
    confidence: "94 %",
    status: "Automatisch angelegt",
    issue: "Keine Auffälligkeiten",
  },
  {
    orderNumber: "GA-1043",
    source: "Egora",
    brand: "Mixie Catering",
    mailbox: "info@mixiecatering.de",
    subject: "Auftragsbestätigung",
    customer: "Event Service Berlin",
    delivery: "05.07.2026 · 18:00 Uhr",
    address: "Köpenicker Straße 40, 10997 Berlin",
    items: "Fingerfood für 120 Personen",
    value: "2.180,00 €",
    pdf: "egora_order_88721.pdf",
    confidence: "81 %",
    status: "Prüfung nötig",
    issue: "Produktnamen müssen zugeordnet werden",
  },
  {
    orderNumber: "GA-1044",
    source: "Heycater",
    brand: "Let Me Bowl",
    mailbox: "info@letmebowl.de",
    subject: "Bitte bestätige den Auftrag",
    customer: "Startup Hub Berlin",
    delivery: "08.07.2026 · 12:00 Uhr",
    address: "Invalidenstraße 21, 10115 Berlin",
    items: "Frühstück und Lunch für 45 Personen",
    value: "1.485,00 €",
    pdf: "order_confirmation.pdf",
    confidence: "67 %",
    status: "Unvollständig",
    issue: "Telefonnummer fehlt, Lieferdetails prüfen",
  },
  {
    orderNumber: "GA-1045",
    source: "Heycater",
    brand: "Let Me Bowl Catering",
    mailbox: "info@letmebowl-catering.de",
    subject: "Fast Track Order bestätigt",
    customer: "Tech Office GmbH",
    delivery: "02.07.2026 · 11:30 Uhr",
    address: "Alexanderstraße 7, 10178 Berlin",
    items: "60 Bowls, 60 Bestecksets",
    value: "960,00 €",
    pdf: "Auftragsbestaetigung_1042_kopie.pdf",
    confidence: "92 %",
    status: "Mögliches Duplikat",
    issue: "Ähnlicher Auftrag bereits vorhanden",
  },
];

const mailboxRules = [
  {
    mailbox: "info@mixiecatering.de",
    brand: "Mixie Catering",
    rule: "Alle bestätigten Plattform-Aufträge automatisch anlegen",
  },
  {
    mailbox: "info@letmebowl-catering.de",
    brand: "Let Me Bowl Catering",
    rule: "Heycater und Egora erkennen, PDF auslesen",
  },
  {
    mailbox: "info@letmebowl.de",
    brand: "Let Me Bowl",
    rule: "Bestätigungen erkennen, Prüfung bei unklaren Daten",
  },
];

const statusClass: Record<string, string> = {
  "Automatisch angelegt": "success",
  "Prüfung nötig": "warning",
  Unvollständig: "danger",
  "Mögliches Duplikat": "duplicate",
};

export function meta() {
  return [{ title: "Auftragseingang · Gastario" }];
}

export default function IncomingOrdersPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Automatisierung</p>
          <h1>Auftragseingang</h1>
          <span className="pageSubline">
            Gastario erkennt bestätigte Aufträge aus E-Mails und PDFs und legt sie automatisch an.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">E-Mail-Regeln</button>
          <button className="primaryButton">Postfach prüfen</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Automatisch angelegt</p>
            <strong>7</strong>
            <span>heute aus E-Mail/PDF erstellt</span>
          </div>
          <small data-trend="bereit">sauber</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Prüfung nötig</p>
            <strong>2</strong>
            <span>Produkt oder Kundendaten prüfen</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Duplikate</p>
            <strong>1</strong>
            <span>ähnlicher Auftrag erkannt</span>
          </div>
          <small data-trend="kritisch">Achtung</small>
        </article>
      </section>

      <section className="incomingToolbar">
        <button className="incomingFilter active">Alle</button>
        <button className="incomingFilter">Automatisch angelegt</button>
        <button className="incomingFilter">Prüfung nötig</button>
        <button className="incomingFilter">Unvollständig</button>
        <button className="incomingFilter">Duplikate</button>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Neue Aufträge</p>
              <h2>Automatisch erkannte Aufträge</h2>
            </div>
            <button className="ghostButton">Nur offene Prüfungen</button>
          </div>

          <div className="incomingOrderList">
            {incomingOrders.map((order) => (
              <article className="incomingOrderCard" key={order.orderNumber}>
                <div className="incomingOrderTop">
                  <div>
                    <strong>{order.orderNumber} · {order.customer}</strong>
                    <span>{order.delivery} · {order.source}</span>
                  </div>

                  <em className={statusClass[order.status] ?? "success"}>{order.status}</em>
                </div>

                <div className="incomingMeta">
                  <p>
                    <b>Marke</b>
                    <span>{order.brand}</span>
                  </p>
                  <p>
                    <b>Postfach</b>
                    <span>{order.mailbox}</span>
                  </p>
                  <p>
                    <b>Betreff</b>
                    <span>{order.subject}</span>
                  </p>
                  <p>
                    <b>Adresse</b>
                    <span>{order.address}</span>
                  </p>
                  <p>
                    <b>Positionen</b>
                    <span>{order.items}</span>
                  </p>
                  <p>
                    <b>PDF</b>
                    <span>{order.pdf}</span>
                  </p>
                </div>

                <div className="incomingFooter">
                  <div>
                    <small>Erkennung</small>
                    <strong>{order.confidence}</strong>
                  </div>

                  <div>
                    <small>Wert</small>
                    <strong>{order.value}</strong>
                  </div>

                  <div className="incomingIssue">
                    <small>Hinweis</small>
                    <strong>{order.issue}</strong>
                  </div>
                </div>

                <div className="documentActions">
                  <button className="ghostButton">Auftrag öffnen</button>
                  <button className="ghostButton">PDF anzeigen</button>
                  <button className="ghostButton">Daten korrigieren</button>
                  <button className="ghostButton">Als geprüft markieren</button>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Regeln</p>
                <h2>Postfächer & Marken</h2>
              </div>
            </div>

            <div className="mailboxRuleList">
              {mailboxRules.map((rule) => (
                <article className="mailboxRule" key={rule.mailbox}>
                  <strong>{rule.mailbox}</strong>
                  <span>{rule.brand}</span>
                  <p>{rule.rule}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Erkennung</p>
                <h2>Was Gastario prüft</h2>
              </div>
            </div>

            <div className="taskList">
              <label>
                <input type="checkbox" checked readOnly />
                <span>Marke über Empfängeradresse erkennen</span>
              </label>
              <label>
                <input type="checkbox" checked readOnly />
                <span>Quelle über Absender und Betreff erkennen</span>
              </label>
              <label>
                <input type="checkbox" checked readOnly />
                <span>PDF-Anhang auslesen</span>
              </label>
              <label>
                <input type="checkbox" checked readOnly />
                <span>Duplikate vor Erstellung markieren</span>
              </label>
              <label>
                <input type="checkbox" checked readOnly />
                <span>Produkte gegen interne Artikel matchen</span>
              </label>
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Prinzip</p>
                <h2>Direkt anlegen</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Kein Mail-Chaos mehr</strong>
              <p>
                Bestätigte Aufträge werden direkt als Auftrag angelegt. Unsichere Fälle bleiben sichtbar
                im Auftragseingang und werden mit Prüfung, Duplikat oder Unvollständig markiert.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
