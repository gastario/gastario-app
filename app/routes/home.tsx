import AppLayout from "../components/AppLayout";

const metrics = [
  { label: "Aufträge heute", value: "3", detail: "180 Portionen geplant", trend: "bereit" },
  { label: "Offene Angebote", value: "7", detail: "2 warten auf Rückmeldung", trend: "prüfen" },
  { label: "Lieferungen", value: "4", detail: "nächste Tour 11:30 Uhr", trend: "aktiv" },
  { label: "Einkauf offen", value: "9", detail: "Positionen unter Bedarf", trend: "kritisch" },
];

const schedule = [
  {
    time: "11:30",
    customer: "Muster GmbH",
    order: "Lunch Catering",
    products: "80 Bowls",
    status: "Bestätigt",
    owner: "Küche",
  },
  {
    time: "12:15",
    customer: "ABC Consulting",
    order: "Frühstück",
    products: "45 Personen",
    status: "In Produktion",
    owner: "Produktion",
  },
  {
    time: "16:00",
    customer: "Eventagentur Berlin",
    order: "Fingerfood",
    products: "120 Portionen",
    status: "Packliste offen",
    owner: "Büro",
  },
];

const purchaseItems = [
  { supplier: "Metro", item: "Hähnchenbrust", amount: "12 kg" },
  { supplier: "Verpackung24", item: "Bowlschalen 1100 ml", amount: "1 Karton" },
  { supplier: "Bäckerei", item: "Mini-Brötchen", amount: "80 Stück" },
];

const importItems = [
  { source: "Heycater", customer: "Tech Office GmbH", status: "Prüfung erforderlich" },
  { source: "Direkt", customer: "Müller & Partner", status: "Bereit zur Übernahme" },
  { source: "Egora", customer: "Event Service Berlin", status: "Duplikat prüfen" },
];

export function meta() {
  return [
    { title: "Gastario" },
    {
      name: "description",
      content:
        "Gastario ist die Betriebssoftware für Caterer: Aufträge, Produktion, Einkauf, Lager und Lieferung an einem Ort.",
    },
  ];
}

export default function Home() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Betriebszentrale</h1>
          <span className="pageSubline">
            Heute · Aufträge, Produktion, Einkauf und Lieferungen im Überblick
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Import prüfen</button>
          <button className="primaryButton">Neuer Auftrag</button>
        </div>
      </header>

      <section className="commandCenter">
        <div className="commandCopy">
          <p className="eyebrow">Tagessteuerung</p>
          <h2>3 Aufträge, 180 Portionen, 4 Lieferungen</h2>
          <p>
            Gastario bereitet aus bestätigten Aufträgen automatisch Produktion, Einkauf,
            Packlisten, Lieferscheine und Fahrerunterlagen vor.
          </p>
        </div>

        <div className="workflowRail" aria-label="Workflow">
          <span>Import</span>
          <span>Angebot</span>
          <span>Auftrag</span>
          <span>Produktion</span>
          <span>Einkauf</span>
          <span>Lieferung</span>
        </div>
      </section>

      <section className="metricsGrid" aria-label="Kennzahlen">
        {metrics.map((metric) => (
          <article className="metricCard" key={metric.label}>
            <div>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.detail}</span>
            </div>
            <small data-trend={metric.trend}>{metric.trend}</small>
          </article>
        ))}
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Tagesplan</p>
              <h2>Nächste Aufträge</h2>
            </div>
            <button className="ghostButton">Alle Aufträge</button>
          </div>

          <div className="table">
            <div className="tableHead">
              <span>Zeit</span>
              <span>Kunde</span>
              <span>Auftrag</span>
              <span>Status</span>
              <span>Bereich</span>
            </div>

            {schedule.map((item) => (
              <div className="tableRow" key={`${item.time}-${item.customer}`}>
                <span className="timeCell">{item.time}</span>
                <strong>{item.customer}</strong>
                <span>{item.order} · {item.products}</span>
                <em>{item.status}</em>
                <span>{item.owner}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Importe</p>
                <h2>Prüfen</h2>
              </div>
            </div>

            <div className="compactList">
              {importItems.map((item) => (
                <div className="compactItem" key={`${item.source}-${item.customer}`}>
                  <div>
                    <strong>{item.customer}</strong>
                    <span>{item.source}</span>
                  </div>
                  <small>{item.status}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Einkauf</p>
                <h2>Nach Lieferant</h2>
              </div>
            </div>

            <div className="compactList">
              {purchaseItems.map((item) => (
                <div className="compactItem" key={`${item.supplier}-${item.item}`}>
                  <div>
                    <strong>{item.item}</strong>
                    <span>{item.supplier}</span>
                  </div>
                  <small>{item.amount}</small>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
