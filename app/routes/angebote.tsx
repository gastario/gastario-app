import AppLayout from "../components/AppLayout";

const quotes = [
  {
    number: "AN-2026-0041",
    customer: "Muster GmbH",
    event: "Office Lunch",
    date: "02.07.2026",
    persons: "80 Personen",
    status: "Versendet",
    value: "1.280,00 €",
    nextStep: "Rückmeldung abwarten",
  },
  {
    number: "AN-2026-0042",
    customer: "Eventagentur Berlin",
    event: "Fingerfood Empfang",
    date: "05.07.2026",
    persons: "120 Personen",
    status: "Entwurf",
    value: "2.180,00 €",
    nextStep: "Positionen prüfen",
  },
  {
    number: "AN-2026-0043",
    customer: "ABC Consulting",
    event: "Frühstück",
    date: "08.07.2026",
    persons: "45 Personen",
    status: "Bestätigt",
    value: "765,00 €",
    nextStep: "Auftrag erstellen",
  },
  {
    number: "AN-2026-0044",
    customer: "Müller & Partner",
    event: "Meeting Catering",
    date: "10.07.2026",
    persons: "35 Personen",
    status: "Wartet auf Rückmeldung",
    value: "595,00 €",
    nextStep: "Nachfassen",
  },
];

const statusClass: Record<string, string> = {
  Entwurf: "info",
  Versendet: "success",
  Bestätigt: "success",
  "Wartet auf Rückmeldung": "warning",
};

export function meta() {
  return [{ title: "Angebote · Gastario" }];
}

export default function QuotesPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Angebote</h1>
          <span className="pageSubline">
            Angebote erstellen, versenden, bestätigen und in Aufträge umwandeln.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Vorlagen</button>
          <button className="primaryButton">Neues Angebot</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Offene Angebote</p>
            <strong>7</strong>
            <span>2 warten auf Rückmeldung</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Angebotsvolumen</p>
            <strong>8.420 €</strong>
            <span>offen und versendet</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Bestätigt</p>
            <strong>3</strong>
            <span>bereit für Auftragserstellung</span>
          </div>
          <small data-trend="bereit">bereit</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Angebotsübersicht</p>
            <h2>Aktuelle Angebote</h2>
          </div>

          <div className="filterActions">
            <button className="ghostButton">Status filtern</button>
            <button className="ghostButton">PDF exportieren</button>
          </div>
        </div>

        <div className="quotesTable">
          <div className="quotesHead">
            <span>Angebot</span>
            <span>Kunde</span>
            <span>Event</span>
            <span>Datum</span>
            <span>Status</span>
            <span>Nächster Schritt</span>
            <span>Betrag</span>
          </div>

          {quotes.map((quote) => (
            <div className="quotesRow" key={quote.number}>
              <div>
                <strong>{quote.number}</strong>
                <small>{quote.persons}</small>
              </div>
              <strong>{quote.customer}</strong>
              <span>{quote.event}</span>
              <span>{quote.date}</span>
              <em className={statusClass[quote.status] ?? "success"}>{quote.status}</em>
              <span>{quote.nextStep}</span>
              <strong>{quote.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
