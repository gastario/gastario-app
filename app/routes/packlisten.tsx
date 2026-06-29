import AppLayout from "../components/AppLayout";

const packingLists = [
  {
    order: "GA-1001",
    customer: "Muster GmbH",
    time: "11:30",
    products: "80 Bowls",
    food: "80 Speisen",
    packaging: "80 Deckel, 80 Bestecksets, 80 Servietten",
    equipment: "4 Thermoboxen",
    status: "Offen",
  },
  {
    order: "GA-1002",
    customer: "ABC Consulting",
    time: "12:15",
    products: "45 Frühstücksboxen",
    food: "45 Boxen",
    packaging: "45 Bestecksets, 45 Servietten",
    equipment: "2 Thermoboxen, 1 Kaffeekanne",
    status: "In Arbeit",
  },
  {
    order: "GA-1003",
    customer: "Eventagentur Berlin",
    time: "16:00",
    products: "120 Fingerfood-Portionen",
    food: "8 Platten, 6 Dips",
    packaging: "Teller, Servietten, Allergenkarten",
    equipment: "2 Chafing Dishes, 4 GN-Behälter",
    status: "Prüfen",
  },
];

const checklist = [
  "Speisen vollständig vorbereitet",
  "Saucen und Dips eingepackt",
  "Besteck und Servietten ergänzt",
  "Lieferschein gedruckt",
  "Fahrerzettel beigelegt",
  "Equipment gezählt",
];

const statusClass: Record<string, string> = {
  Offen: "warning",
  "In Arbeit": "info",
  Prüfen: "warning",
};

export function meta() {
  return [{ title: "Packlisten · Gastario" }];
}

export default function PackingListsPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Packlisten</h1>
          <span className="pageSubline">
            Speisen, Verpackung, Dokumente und Equipment je Auftrag vollständig prüfen.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Packliste PDF</button>
          <button className="primaryButton">Neue Packliste</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Packlisten offen</p>
            <strong>3</strong>
            <span>für heutige Lieferungen</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Equipment reserviert</p>
            <strong>13</strong>
            <span>Boxen und GN-Behälter</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Lieferscheine</p>
            <strong>2</strong>
            <span>noch nicht gedruckt</span>
          </div>
          <small data-trend="kritisch">kritisch</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Kommissionierung</p>
              <h2>Heutige Packlisten</h2>
            </div>
            <button className="ghostButton">Alle drucken</button>
          </div>

          <div className="packingList">
            {packingLists.map((list) => (
              <article className="packingCard" key={list.order}>
                <div className="packingHeader">
                  <div>
                    <strong>{list.order} · {list.customer}</strong>
                    <span>{list.time} Uhr · {list.products}</span>
                  </div>
                  <em className={statusClass[list.status] ?? "success"}>{list.status}</em>
                </div>

                <div className="packingDetails">
                  <p>
                    <b>Speisen</b>
                    <span>{list.food}</span>
                  </p>
                  <p>
                    <b>Verpackung</b>
                    <span>{list.packaging}</span>
                  </p>
                  <p>
                    <b>Equipment</b>
                    <span>{list.equipment}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Standardprüfung</p>
                <h2>Checkliste</h2>
              </div>
            </div>

            <div className="taskList">
              {checklist.map((item) => (
                <label key={item}>
                  <input type="checkbox" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Dokumente</p>
                <h2>Automatisch erzeugen</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Nächster Schritt</strong>
              <p>
                Aus jeder Packliste werden später automatisch Lieferschein,
                Fahrerzettel und Rückholschein für Equipment erstellt.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
