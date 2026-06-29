import AppLayout from "../components/AppLayout";

const purchaseLists = [
  {
    date: "29.06.2026",
    supplier: "Metro",
    items: "Hähnchenbrust, Reis, Tomaten, Gurken",
    amount: "12 Positionen",
    value: "286,40 €",
    status: "Offen",
  },
  {
    date: "29.06.2026",
    supplier: "Verpackung24",
    items: "Bowlschalen, Deckel, Bestecksets",
    amount: "5 Positionen",
    value: "164,00 €",
    status: "Prüfen",
  },
  {
    date: "30.06.2026",
    supplier: "Bäckerei",
    items: "Brötchen, Croissants, Mini-Gebäck",
    amount: "4 Positionen",
    value: "92,50 €",
    status: "Geplant",
  },
];

const demandItems = [
  { item: "Hähnchenbrust", needed: "18 kg", stock: "6 kg", buy: "12 kg", supplier: "Metro" },
  { item: "Bowlschalen 1100 ml", needed: "180 Stück", stock: "60 Stück", buy: "1 Karton", supplier: "Verpackung24" },
  { item: "Mini-Brötchen", needed: "80 Stück", stock: "0 Stück", buy: "80 Stück", supplier: "Bäckerei" },
  { item: "Reis", needed: "12 kg", stock: "4 kg", buy: "8 kg", supplier: "Metro" },
];

const statusClass: Record<string, string> = {
  Offen: "warning",
  Prüfen: "warning",
  Geplant: "info",
};

export function meta() {
  return [{ title: "Einkauf · Gastario" }];
}

export default function PurchasingPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Einkauf & Lager</p>
          <h1>Einkauf</h1>
          <span className="pageSubline">
            Einkaufslisten aus Aufträgen erstellen und automatisch nach Lieferanten sortieren.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">PDF exportieren</button>
          <button className="primaryButton">Einkaufsliste erstellen</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Einkaufslisten offen</p>
            <strong>3</strong>
            <span>für heute und morgen</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Nachkaufbedarf</p>
            <strong>21</strong>
            <span>Positionen unter Bedarf</span>
          </div>
          <small data-trend="kritisch">kritisch</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Geplanter Einkauf</p>
            <strong>542 €</strong>
            <span>geschätzter Warenwert</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Bedarf</p>
              <h2>Automatische Einkaufsvorschläge</h2>
            </div>
            <button className="ghostButton">Nach Lieferant gruppieren</button>
          </div>

          <div className="purchaseDemandTable">
            <div className="purchaseDemandHead">
              <span>Artikel</span>
              <span>Benötigt</span>
              <span>Bestand</span>
              <span>Einkaufen</span>
              <span>Lieferant</span>
            </div>

            {demandItems.map((item) => (
              <div className="purchaseDemandRow" key={item.item}>
                <strong>{item.item}</strong>
                <span>{item.needed}</span>
                <span>{item.stock}</span>
                <em>{item.buy}</em>
                <span>{item.supplier}</span>
              </div>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Listen</p>
                <h2>Nach Lieferant</h2>
              </div>
            </div>

            <div className="compactList">
              {purchaseLists.map((list) => (
                <div className="compactItem" key={`${list.date}-${list.supplier}`}>
                  <div>
                    <strong>{list.supplier}</strong>
                    <span>{list.items}</span>
                  </div>
                  <small>{list.amount}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Ablauf</p>
                <h2>Wareneingang</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Nach dem Einkauf</strong>
              <p>
                Eingekaufte Mengen und Preise werden später direkt als Wareneingang gebucht.
                Dadurch aktualisiert Gastario automatisch Lagerbestand und Einkaufspreise.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
