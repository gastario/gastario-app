const stats = [
  { label: "Aufträge heute", value: "3", note: "180 Portionen geplant" },
  { label: "Offene Angebote", value: "7", note: "2 warten auf Rückmeldung" },
  { label: "Lieferungen offen", value: "4", note: "nächste Lieferung 11:30 Uhr" },
  { label: "Einkauf prüfen", value: "9", note: "Artikel unter Bedarf" },
];

const deliveries = [
  {
    time: "11:30",
    customer: "Muster GmbH",
    type: "Lunch Catering",
    items: "80 Bowls",
    status: "Bestätigt",
  },
  {
    time: "12:15",
    customer: "ABC Consulting",
    type: "Frühstück",
    items: "45 Personen",
    status: "In Produktion",
  },
  {
    time: "16:00",
    customer: "Eventagentur Berlin",
    type: "Fingerfood",
    items: "120 Portionen",
    status: "Packliste offen",
  },
];

const tasks = [
  "Einkaufsliste für morgen prüfen",
  "Auftragsbestätigung für Müller GmbH versenden",
  "Packliste für Eventagentur Berlin abschließen",
  "Lieferantenpreise für Bowlschalen aktualisieren",
];

const modules = [
  "Aufträge",
  "Angebote",
  "Kunden",
  "Produkte",
  "Produktion",
  "Packlisten",
  "Lieferscheine",
  "Einkauf",
  "Lager",
  "Lieferanten",
  "Importe",
  "Auswertungen",
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
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">G</div>
          <div>
            <strong>Gastario</strong>
            <span>Betriebssoftware für Caterer</span>
          </div>
        </div>

        <nav className="navGroups" aria-label="Hauptnavigation">
          <div className="navGroup">
            <p>Übersicht</p>
            <a className="active" href="/">Dashboard</a>
          </div>

          <div className="navGroup">
            <p>Verkauf</p>
            <a href="/">Aufträge</a>
            <a href="/">Angebote</a>
            <a href="/">Kunden</a>
            <a href="/">Produkte</a>
          </div>

          <div className="navGroup">
            <p>Betrieb</p>
            <a href="/">Produktion</a>
            <a href="/">Packlisten</a>
            <a href="/">Lieferscheine</a>
            <a href="/">Lieferungen</a>
          </div>

          <div className="navGroup">
            <p>Einkauf & Lager</p>
            <a href="/">Einkauf</a>
            <a href="/">Lager</a>
            <a href="/">Lieferanten</a>
            <a href="/">Rezepte</a>
          </div>

          <div className="navGroup">
            <p>System</p>
            <a href="/">Importe</a>
            <a href="/">Auswertungen</a>
            <a href="/">Einstellungen</a>
          </div>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Heute in deinem Cateringbetrieb</h1>
          </div>

          <div className="topActions">
            <button className="secondaryButton">Import prüfen</button>
            <button className="primaryButton">Neuer Auftrag</button>
          </div>
        </header>

        <section className="heroCard">
          <div>
            <p className="eyebrow">Gastario Workflow</p>
            <h2>Aus bestätigten Aufträgen werden Produktion, Einkauf, Packlisten und Lieferscheine.</h2>
            <p>
              Gastario verbindet Angebote, Aufträge, Küchenplanung, Lieferanten,
              Warenwirtschaft und Fahrerunterlagen in einer zentralen Oberfläche.
            </p>
          </div>
          <div className="heroFlow">
            <span>Angebot</span>
            <span>Auftrag</span>
            <span>Produktion</span>
            <span>Einkauf</span>
            <span>Lieferung</span>
          </div>
        </section>

        <section className="statsGrid" aria-label="Kennzahlen">
          {stats.map((stat) => (
            <article className="statCard" key={stat.label}>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              <span>{stat.note}</span>
            </article>
          ))}
        </section>

        <section className="contentGrid">
          <article className="panel largePanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Lieferungen</p>
                <h2>Nächste Aufträge</h2>
              </div>
              <button className="ghostButton">Alle anzeigen</button>
            </div>

            <div className="deliveryList">
              {deliveries.map((delivery) => (
                <div className="deliveryItem" key={`${delivery.time}-${delivery.customer}`}>
                  <div className="timeBadge">{delivery.time}</div>
                  <div>
                    <strong>{delivery.customer}</strong>
                    <span>{delivery.type} · {delivery.items}</span>
                  </div>
                  <span className="statusBadge">{delivery.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Aufgaben</p>
                <h2>Heute wichtig</h2>
              </div>
            </div>

            <div className="taskList">
              {tasks.map((task) => (
                <label key={task}>
                  <input type="checkbox" />
                  <span>{task}</span>
                </label>
              ))}
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Module</p>
              <h2>Gastario Bereiche</h2>
            </div>
          </div>

          <div className="moduleGrid">
            {modules.map((module) => (
              <div className="moduleCard" key={module}>
                <strong>{module}</strong>
                <span>Bereich öffnen</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
