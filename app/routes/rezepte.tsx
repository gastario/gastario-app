import AppLayout from "../components/AppLayout";

const recipes = [
  {
    product: "Chicken Bowl",
    category: "Bowls",
    portions: "1 Portion",
    cost: "3,12 €",
    margin: "71 %",
    ingredients: "120 g Reis, 120 g Hähnchen, Gemüse, Sauce, Bowlschale, Deckel",
    status: "Kalkuliert",
  },
  {
    product: "Falafel Bowl",
    category: "Bowls",
    portions: "1 Portion",
    cost: "2,74 €",
    margin: "74 %",
    ingredients: "120 g Reis, Falafel, Hummus, Gemüse, Sauce, Bowlschale, Deckel",
    status: "Kalkuliert",
  },
  {
    product: "Frühstücksbox",
    category: "Frühstück",
    portions: "1 Person",
    cost: "5,20 €",
    margin: "63 %",
    ingredients: "Brötchen, Käse, Aufschnitt, Obst, Dessert, Verpackung",
    status: "Prüfen",
  },
  {
    product: "Fingerfood Platte",
    category: "Fingerfood",
    portions: "1 Platte",
    cost: "11,80 €",
    margin: "59 %",
    ingredients: "Mini-Wraps, Spieße, Canapés, Dips, Platte, Servietten",
    status: "Unvollständig",
  },
];

const recipeItems = [
  { ingredient: "Reis", amount: "120 g", unit: "pro Bowl", supplier: "Metro" },
  { ingredient: "Hähnchenbrust", amount: "120 g", unit: "pro Bowl", supplier: "Metro" },
  { ingredient: "Bowlschale 1100 ml", amount: "1 Stück", unit: "pro Bowl", supplier: "Verpackung24" },
  { ingredient: "Deckel", amount: "1 Stück", unit: "pro Bowl", supplier: "Verpackung24" },
];

const statusClass: Record<string, string> = {
  Kalkuliert: "success",
  Prüfen: "warning",
  Unvollständig: "danger",
};

export function meta() {
  return [{ title: "Rezepte · Gastario" }];
}

export default function RecipesPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Einkauf & Lager</p>
          <h1>Rezepte</h1>
          <span className="pageSubline">
            Produkte mit Zutaten, Verpackung, Warenkosten und Lieferanten verbinden.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Kalkulation prüfen</button>
          <button className="primaryButton">Neues Rezept</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Rezepte angelegt</p>
            <strong>28</strong>
            <span>mit Zutaten und Verpackung</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Ø Wareneinsatz</p>
            <strong>31%</strong>
            <span>über kalkulierte Produkte</span>
          </div>
          <small data-trend="bereit">stabil</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Unvollständig</p>
            <strong>6</strong>
            <span>fehlende Zutaten oder Preise</span>
          </div>
          <small data-trend="kritisch">kritisch</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Rezepturen</p>
              <h2>Produktkalkulation</h2>
            </div>
            <button className="ghostButton">Alle Kategorien</button>
          </div>

          <div className="recipesTable">
            <div className="recipesHead">
              <span>Produkt</span>
              <span>Kategorie</span>
              <span>Einheit</span>
              <span>Wareneinsatz</span>
              <span>Marge</span>
              <span>Zutaten</span>
              <span>Status</span>
            </div>

            {recipes.map((recipe) => (
              <div className="recipesRow" key={recipe.product}>
                <strong>{recipe.product}</strong>
                <span>{recipe.category}</span>
                <span>{recipe.portions}</span>
                <strong>{recipe.cost}</strong>
                <span>{recipe.margin}</span>
                <span>{recipe.ingredients}</span>
                <em className={statusClass[recipe.status] ?? "success"}>{recipe.status}</em>
              </div>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Beispiel</p>
                <h2>Chicken Bowl</h2>
              </div>
            </div>

            <div className="compactList">
              {recipeItems.map((item) => (
                <div className="compactItem" key={item.ingredient}>
                  <div>
                    <strong>{item.ingredient}</strong>
                    <span>{item.unit} · {item.supplier}</span>
                  </div>
                  <small>{item.amount}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Automatik</p>
                <h2>Einkauf & Lager</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Rezept als Grundlage</strong>
              <p>
                Aus bestätigten Aufträgen berechnet Gastario später automatisch Zutatenbedarf,
                Verpackungsbedarf, Einkaufslisten, Warenkosten und Lagerverbrauch.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
