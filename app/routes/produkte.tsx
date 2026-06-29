import AppLayout from "../components/AppLayout";

const products = [
  {
    name: "Chicken Bowl",
    category: "Bowls",
    price: "10,90 €",
    tax: "7 %",
    unit: "Portion",
    diet: "mit Fleisch",
    production: "Reis, Hähnchen, Gemüse, Sauce, Bowlschale",
    status: "Aktiv",
  },
  {
    name: "Falafel Bowl",
    category: "Bowls",
    price: "10,50 €",
    tax: "7 %",
    unit: "Portion",
    diet: "vegan",
    production: "Reis, Falafel, Hummus, Gemüse, Sauce",
    status: "Aktiv",
  },
  {
    name: "Frühstücksbox",
    category: "Frühstück",
    price: "13,90 €",
    tax: "7 %",
    unit: "Person",
    diet: "gemischt",
    production: "Brötchen, Aufschnitt, Käse, Obst, Dessert",
    status: "Aktiv",
  },
  {
    name: "Fingerfood Platte",
    category: "Fingerfood",
    price: "29,00 €",
    tax: "7 %",
    unit: "Platte",
    diet: "gemischt",
    production: "Mini-Wraps, Spieße, Canapés, Dips",
    status: "Aktiv",
  },
  {
    name: "Lieferpauschale Berlin",
    category: "Service",
    price: "35,00 €",
    tax: "19 %",
    unit: "Pauschale",
    diet: "-",
    production: "Lieferung innerhalb Berlin",
    status: "Aktiv",
  },
];

export function meta() {
  return [{ title: "Produkte · Gastario" }];
}

export default function ProductsPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Produkte</h1>
          <span className="pageSubline">
            Speisen, Getränke, Leistungen und Pauschalen mit Preisen, Steuersätzen und Produktionsnotizen.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Kategorien</button>
          <button className="primaryButton">Neues Produkt</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Produkte aktiv</p>
            <strong>64</strong>
            <span>in 9 Kategorien</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Mit Rezeptur</p>
            <strong>28</strong>
            <span>für Einkauf & Kalkulation</span>
          </div>
          <small data-trend="prüfen">ausbauen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Ø Wareneinsatz</p>
            <strong>31%</strong>
            <span>über kalkulierte Produkte</span>
          </div>
          <small data-trend="bereit">stabil</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Produktübersicht</p>
            <h2>Aktive Produkte</h2>
          </div>

          <div className="filterActions">
            <button className="ghostButton">Kategorie</button>
            <button className="ghostButton">Steuersatz</button>
          </div>
        </div>

        <div className="productsTable">
          <div className="productsHead">
            <span>Produkt</span>
            <span>Kategorie</span>
            <span>Preis</span>
            <span>Einheit</span>
            <span>Ernährung</span>
            <span>Produktion</span>
            <span>Status</span>
          </div>

          {products.map((product) => (
            <div className="productsRow" key={product.name}>
              <div>
                <strong>{product.name}</strong>
                <small>MwSt {product.tax}</small>
              </div>
              <span>{product.category}</span>
              <strong>{product.price}</strong>
              <span>{product.unit}</span>
              <span>{product.diet}</span>
              <span>{product.production}</span>
              <em>{product.status}</em>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
