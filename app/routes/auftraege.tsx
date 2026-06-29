import { Link } from "react-router";

const orders = [
  {
    number: "GA-1001",
    customer: "Muster GmbH",
    source: "Direkt",
    date: "29.06.2026",
    time: "11:30",
    type: "Lunch Catering",
    amount: "80 Bowls",
    status: "Bestätigt",
    nextStep: "Produktion vorbereiten",
    value: "1.280,00 €",
  },
  {
    number: "GA-1002",
    customer: "ABC Consulting",
    source: "Heycater",
    date: "29.06.2026",
    time: "12:15",
    type: "Frühstück",
    amount: "45 Personen",
    status: "In Produktion",
    nextStep: "Packliste prüfen",
    value: "765,00 €",
  },
  {
    number: "GA-1003",
    customer: "Eventagentur Berlin",
    source: "Egora",
    date: "29.06.2026",
    time: "16:00",
    type: "Fingerfood",
    amount: "120 Portionen",
    status: "Packliste offen",
    nextStep: "Fahrerzettel erstellen",
    value: "2.180,00 €",
  },
  {
    number: "GA-1004",
    customer: "Müller & Partner",
    source: "E-Mail",
    date: "30.06.2026",
    time: "10:00",
    type: "Meeting Lunch",
    amount: "35 Personen",
    status: "Auftragsbestätigung offen",
    nextStep: "Bestätigung versenden",
    value: "595,00 €",
  },
];

const statusClass: Record<string, string> = {
  "Bestätigt": "success",
  "In Produktion": "info",
  "Packliste offen": "warning",
  "Auftragsbestätigung offen": "warning",
};

export function meta() {
  return [{ title: "Aufträge · Gastario" }];
}

export default function OrdersPage() {
  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brandLogo" src="/brand/gastario-logo.png" alt="Gastario" />
        </div>

        <nav className="navGroups" aria-label="Hauptnavigation">
          <div className="navGroup">
            <p>Übersicht</p>
            <Link to="/">Dashboard</Link>
          </div>

          <div className="navGroup">
            <p>Verkauf</p>
            <Link className="active" to="/auftraege">Aufträge</Link>
            <Link to="/">Angebote</Link>
            <Link to="/">Kunden</Link>
            <Link to="/">Produkte</Link>
          </div>

          <div className="navGroup">
            <p>Betrieb</p>
            <Link to="/">Produktion</Link>
            <Link to="/">Packlisten</Link>
            <Link to="/">Lieferscheine</Link>
            <Link to="/">Lieferungen</Link>
          </div>

          <div className="navGroup">
            <p>Einkauf & Lager</p>
            <Link to="/">Einkauf</Link>
            <Link to="/">Lager</Link>
            <Link to="/">Lieferanten</Link>
            <Link to="/">Rezepte</Link>
          </div>

          <div className="navGroup">
            <p>System</p>
            <Link to="/">Importe</Link>
            <Link to="/">Auswertungen</Link>
            <Link to="/">Einstellungen</Link>
          </div>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Verkauf</p>
            <h1>Aufträge</h1>
            <span className="pageSubline">
              Bestätigte und geplante Catering-Aufträge mit Produktion, Einkauf und Lieferung.
            </span>
          </div>

          <div className="topActions">
            <button className="secondaryButton">Import prüfen</button>
            <button className="primaryButton">Neuer Auftrag</button>
          </div>
        </header>

        <section className="orderSummaryGrid">
          <article className="metricCard">
            <div>
              <p>Aufträge diese Woche</p>
              <strong>18</strong>
              <span>davon 11 bestätigt</span>
            </div>
            <small data-trend="aktiv">aktiv</small>
          </article>

          <article className="metricCard">
            <div>
              <p>Portionen geplant</p>
              <strong>940</strong>
              <span>über alle bestätigten Aufträge</span>
            </div>
            <small data-trend="bereit">bereit</small>
          </article>

          <article className="metricCard">
            <div>
              <p>Auftragsbestätigungen</p>
              <strong>4</strong>
              <span>müssen noch versendet werden</span>
            </div>
            <small data-trend="prüfen">prüfen</small>
          </article>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Auftragsübersicht</p>
              <h2>Aktuelle Aufträge</h2>
            </div>

            <div className="filterActions">
              <button className="ghostButton">Alle Quellen</button>
              <button className="ghostButton">Status filtern</button>
            </div>
          </div>

          <div className="ordersTable">
            <div className="ordersHead">
              <span>Auftrag</span>
              <span>Kunde</span>
              <span>Lieferung</span>
              <span>Leistung</span>
              <span>Status</span>
              <span>Nächster Schritt</span>
              <span>Betrag</span>
            </div>

            {orders.map((order) => (
              <div className="ordersRow" key={order.number}>
                <div>
                  <strong>{order.number}</strong>
                  <small>{order.source}</small>
                </div>
                <div>
                  <strong>{order.customer}</strong>
                  <small>{order.type}</small>
                </div>
                <div>
                  <strong>{order.date}</strong>
                  <small>{order.time} Uhr</small>
                </div>
                <div>
                  <strong>{order.amount}</strong>
                  <small>{order.type}</small>
                </div>
                <span className={`orderStatus ${statusClass[order.status] ?? "success"}`}>
                  {order.status}
                </span>
                <span>{order.nextStep}</span>
                <strong>{order.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

