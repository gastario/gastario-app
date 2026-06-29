import AppLayout from "../components/AppLayout";

const deliveries = [
  {
    time: "11:30",
    customer: "Muster GmbH",
    driver: "Fahrer offen",
    address: "Musterstraße 12, 10115 Berlin",
    contact: "Frau Schulz · 030 123456",
    products: "80 Bowls",
    equipment: "4 Thermoboxen",
    status: "Gepackt",
  },
  {
    time: "12:15",
    customer: "ABC Consulting",
    driver: "Mehmet",
    address: "Friedrichstraße 88, 10117 Berlin",
    contact: "Herr Wagner · 030 987654",
    products: "45 Frühstücksboxen",
    equipment: "2 Thermoboxen, 1 Kaffeekanne",
    status: "Unterwegs",
  },
  {
    time: "16:00",
    customer: "Eventagentur Berlin",
    driver: "Cem",
    address: "Köpenicker Straße 40, 10997 Berlin",
    contact: "Jana Keller · 0176 555555",
    products: "120 Fingerfood-Portionen",
    equipment: "2 Chafing Dishes, 4 GN-Behälter",
    status: "Offen",
  },
];

const driverChecklist = [
  "Ware vollständig geladen",
  "Lieferschein und Fahrerzettel dabei",
  "Telefonnummer vor Ort geprüft",
  "Equipment gezählt",
  "Rückholung dokumentiert",
];

const statusClass: Record<string, string> = {
  Gepackt: "success",
  Unterwegs: "info",
  Offen: "warning",
};

export function meta() {
  return [{ title: "Lieferungen · Gastario" }];
}

export default function DeliveriesPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Lieferungen</h1>
          <span className="pageSubline">
            Fahrer, Adressen, Ansprechpartner, Produkte, Equipment und Lieferstatus an einem Ort.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Touren drucken</button>
          <button className="primaryButton">Lieferung planen</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Lieferungen heute</p>
            <strong>4</strong>
            <span>davon 1 Fahrer offen</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Unterwegs</p>
            <strong>1</strong>
            <span>aktuelle Tour aktiv</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Rückholungen</p>
            <strong>3</strong>
            <span>Equipment beim Kunden</span>
          </div>
          <small data-trend="kritisch">prüfen</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Fahrerplan</p>
              <h2>Heutige Lieferungen</h2>
            </div>
            <button className="ghostButton">Fahreransicht</button>
          </div>

          <div className="deliveryRouteList">
            {deliveries.map((delivery) => (
              <article className="deliveryRouteCard" key={`${delivery.time}-${delivery.customer}`}>
                <div className="routeTime">
                  <strong>{delivery.time}</strong>
                  <span>Uhr</span>
                </div>

                <div className="routeContent">
                  <div className="routeHeader">
                    <div>
                      <strong>{delivery.customer}</strong>
                      <span>{delivery.products} · {delivery.driver}</span>
                    </div>
                    <em className={statusClass[delivery.status] ?? "success"}>{delivery.status}</em>
                  </div>

                  <div className="routeDetails">
                    <p>
                      <b>Adresse</b>
                      <span>{delivery.address}</span>
                    </p>
                    <p>
                      <b>Kontakt</b>
                      <span>{delivery.contact}</span>
                    </p>
                    <p>
                      <b>Equipment</b>
                      <span>{delivery.equipment}</span>
                    </p>
                  </div>

                  <div className="documentActions">
                    <button className="ghostButton">Route öffnen</button>
                    <button className="ghostButton">Anrufen</button>
                    <button className="ghostButton">Geliefert markieren</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Fahrer</p>
                <h2>Checkliste</h2>
              </div>
            </div>

            <div className="taskList">
              {driverChecklist.map((item) => (
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
                <p className="eyebrow">Mobile Ansicht</p>
                <h2>Später</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Fahrer-App</strong>
              <p>
                Fahrer sehen später nur ihre Lieferungen: Route öffnen, Kunde anrufen, Checkliste abhaken,
                Lieferung bestätigen und Equipment-Rückholung markieren.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
