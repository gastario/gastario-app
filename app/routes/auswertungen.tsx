import AppLayout from "../components/AppLayout";

const revenueBySource = [
  { source: "Direkt", revenue: "12.840 €", orders: "18 Aufträge", share: "46 %" },
  { source: "Heycater", revenue: "8.260 €", orders: "11 Aufträge", share: "30 %" },
  { source: "Egora", revenue: "4.120 €", orders: "5 Aufträge", share: "15 %" },
  { source: "E-Mail", revenue: "2.480 €", orders: "4 Aufträge", share: "9 %" },
];

const topProducts = [
  { product: "Chicken Bowl", quantity: "420 Stück", revenue: "4.578 €", margin: "71 %" },
  { product: "Falafel Bowl", quantity: "310 Stück", revenue: "3.255 €", margin: "74 %" },
  { product: "Frühstücksbox", quantity: "180 Personen", revenue: "2.502 €", margin: "63 %" },
  { product: "Fingerfood Platte", quantity: "74 Platten", revenue: "2.146 €", margin: "59 %" },
];

const weeklyNumbers = [
  { label: "Montag", value: "3.240 €" },
  { label: "Dienstag", value: "4.120 €" },
  { label: "Mittwoch", value: "5.680 €" },
  { label: "Donnerstag", value: "6.210 €" },
  { label: "Freitag", value: "8.450 €" },
];

export function meta() {
  return [{ title: "Auswertungen · Gastario" }];
}

export default function ReportsPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">System</p>
          <h1>Auswertungen</h1>
          <span className="pageSubline">
            Umsatz, Aufträge, Plattformen, Wareneinsatz und Top-Produkte auswerten.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Zeitraum wählen</button>
          <button className="primaryButton">Exportieren</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Umsatz Monat</p>
            <strong>27.700 €</strong>
            <span>+18 % zum Vormonat</span>
          </div>
          <small data-trend="aktiv">wachsend</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Aufträge</p>
            <strong>38</strong>
            <span>Ø 729 € Auftragswert</span>
          </div>
          <small data-trend="bereit">stabil</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Wareneinsatz</p>
            <strong>31%</strong>
            <span>über kalkulierte Produkte</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>
      </section>

      <section className="analyticsGrid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Umsatz</p>
              <h2>Nach Quelle</h2>
            </div>
            <button className="ghostButton">Monat</button>
          </div>

          <div className="analyticsList">
            {revenueBySource.map((item) => (
              <div className="analyticsItem" key={item.source}>
                <div>
                  <strong>{item.source}</strong>
                  <span>{item.orders}</span>
                </div>
                <div className="analyticsValue">
                  <strong>{item.revenue}</strong>
                  <span>{item.share}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Produkte</p>
              <h2>Top-Produkte</h2>
            </div>
            <button className="ghostButton">Marge</button>
          </div>

          <div className="analyticsList">
            {topProducts.map((item) => (
              <div className="analyticsItem" key={item.product}>
                <div>
                  <strong>{item.product}</strong>
                  <span>{item.quantity}</span>
                </div>
                <div className="analyticsValue">
                  <strong>{item.revenue}</strong>
                  <span>{item.margin}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Wochenverlauf</p>
            <h2>Umsatz nach Liefertag</h2>
          </div>
          <button className="ghostButton">Details anzeigen</button>
        </div>

        <div className="weeklyBars">
          {weeklyNumbers.map((day) => (
            <div className="weeklyBar" key={day.label}>
              <span>{day.label}</span>
              <div>
                <strong style={{ width: day.label === "Freitag" ? "100%" : day.label === "Donnerstag" ? "74%" : day.label === "Mittwoch" ? "67%" : day.label === "Dienstag" ? "49%" : "38%" }} />
              </div>
              <b>{day.value}</b>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
