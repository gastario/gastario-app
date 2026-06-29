import AppLayout from "../components/AppLayout";

const inventory = [
  {
    item: "Hähnchenbrust",
    category: "Zutaten",
    stock: "6 kg",
    minimum: "10 kg",
    supplier: "Metro",
    location: "Kühlhaus",
    status: "Unter Mindestbestand",
  },
  {
    item: "Reis",
    category: "Zutaten",
    stock: "4 kg",
    minimum: "8 kg",
    supplier: "Metro",
    location: "Trockenlager",
    status: "Nachbestellen",
  },
  {
    item: "Bowlschalen 1100 ml",
    category: "Verpackung",
    stock: "60 Stück",
    minimum: "300 Stück",
    supplier: "Verpackung24",
    location: "Verpackungslager",
    status: "Kritisch",
  },
  {
    item: "Bestecksets",
    category: "Verpackung",
    stock: "520 Stück",
    minimum: "300 Stück",
    supplier: "Verpackung24",
    location: "Verpackungslager",
    status: "Ausreichend",
  },
  {
    item: "Tomaten",
    category: "Zutaten",
    stock: "8 kg",
    minimum: "5 kg",
    supplier: "Gemüsehändler",
    location: "Kühlhaus",
    status: "Ausreichend",
  },
];

const statusClass: Record<string, string> = {
  "Unter Mindestbestand": "warning",
  Nachbestellen: "warning",
  Kritisch: "danger",
  Ausreichend: "success",
};

export function meta() {
  return [{ title: "Lager · Gastario" }];
}

export default function InventoryPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Einkauf & Lager</p>
          <h1>Lager</h1>
          <span className="pageSubline">
            Zutaten, Verpackungen, Getränke und Verbrauchsmaterial mit Bestand und Mindestmengen.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Inventur</button>
          <button className="primaryButton">Wareneingang buchen</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Lagerartikel</p>
            <strong>126</strong>
            <span>Zutaten, Verpackung, Verbrauchsmaterial</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Unter Mindestbestand</p>
            <strong>9</strong>
            <span>müssen geprüft werden</span>
          </div>
          <small data-trend="kritisch">kritisch</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Lagerwert</p>
            <strong>4.820 €</strong>
            <span>geschätzt nach Einkaufspreisen</span>
          </div>
          <small data-trend="bereit">stabil</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Bestände</p>
            <h2>Aktuelle Lagerartikel</h2>
          </div>

          <div className="filterActions">
            <button className="ghostButton">Kategorie</button>
            <button className="ghostButton">Mindestbestand</button>
          </div>
        </div>

        <div className="inventoryTable">
          <div className="inventoryHead">
            <span>Artikel</span>
            <span>Kategorie</span>
            <span>Bestand</span>
            <span>Mindestbestand</span>
            <span>Lieferant</span>
            <span>Lagerort</span>
            <span>Status</span>
          </div>

          {inventory.map((item) => (
            <div className="inventoryRow" key={item.item}>
              <strong>{item.item}</strong>
              <span>{item.category}</span>
              <span>{item.stock}</span>
              <span>{item.minimum}</span>
              <span>{item.supplier}</span>
              <span>{item.location}</span>
              <em className={statusClass[item.status] ?? "success"}>{item.status}</em>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
