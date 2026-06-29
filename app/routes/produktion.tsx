import AppLayout from "../components/AppLayout";

const productionItems = [
  {
    time: "08:30",
    product: "Frühstücksbox",
    quantity: "45 Personen",
    customer: "ABC Consulting",
    notes: "10 vegetarisch, Obst separat",
    status: "In Produktion",
  },
  {
    time: "10:00",
    product: "Chicken Bowl",
    quantity: "40 Stück",
    customer: "Muster GmbH",
    notes: "Sauce separat, 2 ohne Koriander",
    status: "Vorbereiten",
  },
  {
    time: "10:00",
    product: "Falafel Bowl",
    quantity: "25 Stück",
    customer: "Muster GmbH",
    notes: "vegan, Hummus extra",
    status: "Vorbereiten",
  },
  {
    time: "14:00",
    product: "Fingerfood Platte",
    quantity: "8 Platten",
    customer: "Eventagentur Berlin",
    notes: "gemischte Auswahl, Allergenkarten beilegen",
    status: "Offen",
  },
];

const ingredientNeeds = [
  { item: "Hähnchenbrust", amount: "12 kg", area: "Küche", status: "bereit" },
  { item: "Reis", amount: "9 kg", area: "Küche", status: "bereit" },
  { item: "Falafel", amount: "80 Stück", area: "Küche", status: "prüfen" },
  { item: "Bowlschalen", amount: "120 Stück", area: "Verpackung", status: "kritisch" },
];

const statusClass: Record<string, string> = {
  "In Produktion": "info",
  Vorbereiten: "warning",
  Offen: "warning",
};

export function meta() {
  return [{ title: "Produktion · Gastario" }];
}

export default function ProductionPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Produktion</h1>
          <span className="pageSubline">
            Tagesproduktion nach Uhrzeit, Kunde, Produkt und Sonderwünschen planen.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Küchenliste PDF</button>
          <button className="primaryButton">Produktion aktualisieren</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Produktion heute</p>
            <strong>180</strong>
            <span>Portionen und Einheiten</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Sonderwünsche</p>
            <strong>14</strong>
            <span>Allergene und Anpassungen</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Verpackung</p>
            <strong>120</strong>
            <span>Bowlschalen geplant</span>
          </div>
          <small data-trend="kritisch">kritisch</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Küchenliste</p>
              <h2>Heutige Produktion</h2>
            </div>
            <button className="ghostButton">Nach Produkt gruppieren</button>
          </div>

          <div className="productionList">
            {productionItems.map((item) => (
              <div className="productionItem" key={`${item.time}-${item.product}-${item.customer}`}>
                <div className="timeCell">{item.time}</div>
                <div>
                  <strong>{item.product}</strong>
                  <span>{item.quantity} · {item.customer}</span>
                </div>
                <p>{item.notes}</p>
                <em className={statusClass[item.status] ?? "success"}>{item.status}</em>
              </div>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Bedarf</p>
                <h2>Zutaten & Verpackung</h2>
              </div>
            </div>

            <div className="compactList">
              {ingredientNeeds.map((item) => (
                <div className="compactItem" key={item.item}>
                  <div>
                    <strong>{item.item}</strong>
                    <span>{item.area}</span>
                  </div>
                  <small>{item.amount}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Hinweise</p>
                <h2>Für die Küche</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Wichtig</strong>
              <p>
                Allergenkarten für Eventagentur Berlin beilegen. Bei Muster GmbH
                Saucen separat verpacken und 2 Bowls ohne Koriander markieren.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
