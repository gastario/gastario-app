import AppLayout from "../components/AppLayout";

const imports = [
  {
    source: "Heycater",
    customer: "Tech Office GmbH",
    received: "Heute · 08:42",
    delivery: "02.07.2026 · 11:30 Uhr",
    items: "60 Bowls, 60 Bestecksets",
    confidence: "86 %",
    status: "Prüfung erforderlich",
    action: "Daten prüfen",
  },
  {
    source: "Direkt",
    customer: "Müller & Partner",
    received: "Heute · 09:15",
    delivery: "03.07.2026 · 10:00 Uhr",
    items: "35 Personen Meeting Lunch",
    confidence: "98 %",
    status: "Bereit zur Übernahme",
    action: "Auftrag übernehmen",
  },
  {
    source: "Egora",
    customer: "Event Service Berlin",
    received: "Gestern · 16:20",
    delivery: "05.07.2026 · 18:00 Uhr",
    items: "Fingerfood für 120 Personen",
    confidence: "72 %",
    status: "Duplikat prüfen",
    action: "Abgleichen",
  },
  {
    source: "E-Mail",
    customer: "Startup Hub Berlin",
    received: "Gestern · 11:05",
    delivery: "08.07.2026 · 12:00 Uhr",
    items: "Frühstück und Lunch für 45 Personen",
    confidence: "64 %",
    status: "Unvollständig",
    action: "Nachbearbeiten",
  },
];

const importSources = [
  { name: "Heycater", method: "E-Mail-Erkennung", status: "Vorbereitet" },
  { name: "Egora", method: "E-Mail / CSV", status: "Vorbereitet" },
  { name: "Direkt", method: "Website / Formular", status: "Aktiv" },
  { name: "Lexware", method: "API später", status: "Geplant" },
];

const statusClass: Record<string, string> = {
  "Prüfung erforderlich": "warning",
  "Bereit zur Übernahme": "success",
  "Duplikat prüfen": "warning",
  Unvollständig: "danger",
};

export function meta() {
  return [{ title: "Importe · Gastario" }];
}

export default function ImportsPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">System</p>
          <h1>Importe</h1>
          <span className="pageSubline">
            Erkannte Bestellungen aus Heycater, Egora, E-Mail und Direktanfragen prüfen und übernehmen.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Textimport</button>
          <button className="primaryButton">Import prüfen</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Neue Importe</p>
            <strong>4</strong>
            <span>müssen geprüft werden</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Bereit zur Übernahme</p>
            <strong>1</strong>
            <span>mit hoher Erkennung</span>
          </div>
          <small data-trend="bereit">bereit</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Mögliche Duplikate</p>
            <strong>1</strong>
            <span>vor Auftragserstellung abgleichen</span>
          </div>
          <small data-trend="kritisch">kritisch</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Import-Zentrale</p>
              <h2>Erkannte Bestellungen</h2>
            </div>
            <button className="ghostButton">Alle Quellen</button>
          </div>

          <div className="importsTable">
            <div className="importsHead">
              <span>Quelle</span>
              <span>Kunde</span>
              <span>Lieferung</span>
              <span>Inhalt</span>
              <span>Sicherheit</span>
              <span>Status</span>
              <span>Aktion</span>
            </div>

            {imports.map((item) => (
              <div className="importsRow" key={`${item.source}-${item.customer}`}>
                <div>
                  <strong>{item.source}</strong>
                  <small>{item.received}</small>
                </div>
                <strong>{item.customer}</strong>
                <span>{item.delivery}</span>
                <span>{item.items}</span>
                <strong>{item.confidence}</strong>
                <em className={statusClass[item.status] ?? "success"}>{item.status}</em>
                <span>{item.action}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Quellen</p>
                <h2>Anbindungen</h2>
              </div>
            </div>

            <div className="compactList">
              {importSources.map((source) => (
                <div className="compactItem" key={source.name}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.method}</span>
                  </div>
                  <small>{source.status}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Ablauf</p>
                <h2>Sicher übernehmen</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Kein Blindimport</strong>
              <p>
                Erkannte Bestellungen landen zuerst in der Prüfung. Erst nach Freigabe werden Kunde, Auftrag,
                Auftragsbestätigung, Produktion, Einkauf, Packliste und Lieferschein erzeugt.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
