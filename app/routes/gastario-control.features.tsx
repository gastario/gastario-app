import SuperAdminLayout from "../components/SuperAdminLayout";

const features = [
  ["DASHBOARD", "Dashboard", "Basis"],
  ["ORDERS", "Auftraege", "Basis"],
  ["CUSTOMERS", "Kunden", "Basis"],
  ["PRODUCTS", "Produkte", "Basis"],
  ["QUOTES", "Angebote", "Basis"],
  ["INCOMING_ORDERS", "Auftragseingang", "Automatisierung"],
  ["PDF_EXTRACTION", "PDF-Erkennung", "Automatisierung"],
  ["EMAIL_AUTOMATION", "E-Mail-Automatik", "Automatisierung"],
  ["PRODUCT_MAPPING", "Produkt-Mapping", "Automatisierung"],
  ["PRODUCTION", "Produktion", "Betrieb"],
  ["PACKING_LISTS", "Packlisten", "Betrieb"],
  ["DELIVERY_NOTES", "Lieferscheine", "Betrieb"],
  ["DELIVERIES", "Lieferungen", "Betrieb"],
  ["PURCHASING", "Einkauf", "Warenwirtschaft"],
  ["INVENTORY", "Lager", "Warenwirtschaft"],
  ["SUPPLIERS", "Lieferanten", "Warenwirtschaft"],
  ["RECIPES", "Rezepte", "Warenwirtschaft"],
  ["REPORTS", "Auswertungen", "Auswertung"],
  ["MULTI_USER", "Mehrere Benutzer", "Premium"],
  ["DRIVER_VIEW", "Fahreransicht", "Premium"],
  ["INTEGRATIONS", "Integrationen", "Premium"],
];

export default function FeaturesPage() {
  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Features</h1>
          <p className="pageSubtitle">Uebersicht aller Module, die spaeter pro Mandant freigeschaltet werden koennen.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Module</div>
            <h2 className="panelTitle">Feature-Codes</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Modul</th>
                <th>Gruppe</th>
              </tr>
            </thead>
            <tbody>
              {features.map(([code, label, group]) => (
                <tr key={code}>
                  <td style={{ fontFamily: "monospace", fontWeight: 950, color: "#0f766e" }}>{code}</td>
                  <td className="tenantName">{label}</td>
                  <td>{group}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </SuperAdminLayout>
  );
}
