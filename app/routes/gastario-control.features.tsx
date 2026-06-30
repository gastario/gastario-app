
import SuperAdminLayout from "../components/SuperAdminLayout";

const features = [
  ["DASHBOARD", "Dashboard", "Basis"],
  ["ORDERS", "Aufträge", "Basis"],
  ["CUSTOMERS", "Kunden", "Basis"],
  ["PRODUCTS", "Produkte", "Basis"],
  ["QUOTES", "Angebote", "Basis"],
  ["PRODUCTION", "Produktion", "Betrieb"],
  ["PACKING_LISTS", "Packlisten", "Betrieb"],
  ["DELIVERY_NOTES", "Lieferscheine", "Betrieb"],
  ["DELIVERIES", "Lieferungen", "Betrieb"],
  ["INCOMING_ORDERS", "Auftragseingang", "Automatisierung"],
  ["PDF_EXTRACTION", "PDF-Erkennung", "Automatisierung"],
  ["EMAIL_AUTOMATION", "E-Mail-Automatik", "Automatisierung"],
  ["PURCHASING", "Einkauf", "Warenwirtschaft"],
  ["INVENTORY", "Lager", "Warenwirtschaft"],
  ["SUPPLIERS", "Lieferanten", "Warenwirtschaft"],
  ["RECIPES", "Rezepte", "Warenwirtschaft"],
  ["REPORTS", "Auswertungen", "Auswertung"],
  ["MULTI_USER", "Mehrere Benutzer", "Premium"],
  ["DRIVER_VIEW", "Fahreransicht", "Premium"],
  ["PRODUCT_MAPPING", "Produkt-Mapping", "Premium"],
  ["INTEGRATIONS", "Integrationen", "Premium"],
];

export default function FeaturesPage() {
  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Features</h1>
          <p className="pageSubtitle">
            Übersicht aller Module, die pro Mandant freigeschaltet werden können.
          </p>
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
