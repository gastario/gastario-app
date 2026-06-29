import AppLayout from "../components/AppLayout";

const suppliers = [
  {
    name: "Metro",
    category: "Lebensmittel",
    contact: "Kundenservice",
    email: "bestellung@metro.de",
    phone: "030 000000",
    items: "Hähnchen, Reis, Gemüse, Getränke",
    orderDays: "Mo–Sa",
    status: "Hauptlieferant",
  },
  {
    name: "Verpackung24",
    category: "Verpackung",
    contact: "Herr Neumann",
    email: "sales@verpackung24.de",
    phone: "040 111111",
    items: "Bowlschalen, Deckel, Bestecksets",
    orderDays: "Mo–Fr",
    status: "Hauptlieferant",
  },
  {
    name: "Bäckerei",
    category: "Backwaren",
    contact: "Frau Becker",
    email: "info@baeckerei.de",
    phone: "030 222222",
    items: "Brötchen, Croissants, Mini-Gebäck",
    orderDays: "Mo–So",
    status: "Aktiv",
  },
  {
    name: "Gemüsehändler",
    category: "Frische Ware",
    contact: "Herr Kaya",
    email: "order@gemuesehandel.de",
    phone: "0176 333333",
    items: "Tomaten, Gurken, Salate, Kräuter",
    orderDays: "Mo–Sa",
    status: "Aktiv",
  },
];

export function meta() {
  return [{ title: "Lieferanten · Gastario" }];
}

export default function SuppliersPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Einkauf & Lager</p>
          <h1>Lieferanten</h1>
          <span className="pageSubline">
            Lieferanten, Ansprechpartner, Einkaufseinheiten und Artikel-Zuordnungen verwalten.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Artikel zuordnen</button>
          <button className="primaryButton">Neuer Lieferant</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Lieferanten</p>
            <strong>18</strong>
            <span>aktive Einkaufsquellen</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Zugeordnete Artikel</p>
            <strong>94</strong>
            <span>mit Hauptlieferant</span>
          </div>
          <small data-trend="bereit">bereit</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Ohne Lieferant</p>
            <strong>12</strong>
            <span>Artikel noch zuordnen</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Lieferantenübersicht</p>
            <h2>Aktive Lieferanten</h2>
          </div>

          <div className="filterActions">
            <button className="ghostButton">Kategorie</button>
            <button className="ghostButton">Bestelltage</button>
          </div>
        </div>

        <div className="suppliersGrid">
          {suppliers.map((supplier) => (
            <article className="supplierCard" key={supplier.name}>
              <div className="supplierTop">
                <div>
                  <strong>{supplier.name}</strong>
                  <span>{supplier.category} · {supplier.status}</span>
                </div>
                <small>{supplier.orderDays}</small>
              </div>

              <div className="supplierDetails">
                <p>
                  <b>Ansprechpartner</b>
                  <span>{supplier.contact}</span>
                </p>
                <p>
                  <b>E-Mail</b>
                  <span>{supplier.email}</span>
                </p>
                <p>
                  <b>Telefon</b>
                  <span>{supplier.phone}</span>
                </p>
                <p>
                  <b>Artikel</b>
                  <span>{supplier.items}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
