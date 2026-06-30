import { Link } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

const featureGroups = [
  {
    title: "Basis",
    description: "Grundfunktionen fÃƒÆ’Ã‚Â¼r jeden Caterer.",
    features: [
      {
        name: "AuftrÃƒÆ’Ã‚Â¤ge",
        code: "ORDERS",
        starter: true,
        professional: true,
        premium: true,
        description: "AuftrÃƒÆ’Ã‚Â¤ge erfassen, anzeigen und bearbeiten.",
      },
      {
        name: "Kunden",
        code: "CUSTOMERS",
        starter: true,
        professional: true,
        premium: true,
        description: "Kundendaten und Lieferadressen verwalten.",
      },
      {
        name: "Produkte",
        code: "PRODUCTS",
        starter: true,
        professional: true,
        premium: true,
        description: "Produkte, Preise und Kategorien verwalten.",
      },
      {
        name: "Packlisten",
        code: "PACKING_LISTS",
        starter: true,
        professional: true,
        premium: true,
        description: "Packlisten fÃƒÆ’Ã‚Â¼r AuftrÃƒÆ’Ã‚Â¤ge vorbereiten.",
      },
      {
        name: "Lieferscheine",
        code: "DELIVERY_NOTES",
        starter: true,
        professional: true,
        premium: true,
        description: "Lieferscheine und Fahrerzettel erzeugen.",
      },
    ],
  },
  {
    title: "Automatisierung",
    description: "Module fÃƒÆ’Ã‚Â¼r Auftragseingang, E-Mail und PDF-Erkennung.",
    features: [
      {
        name: "Auftragseingang",
        code: "ORDER_INBOX",
        starter: false,
        professional: true,
        premium: true,
        description: "Zentrale fÃƒÆ’Ã‚Â¼r eingehende AuftrÃƒÆ’Ã‚Â¤ge aus verschiedenen Quellen.",
      },
      {
        name: "PDF-Erkennung",
        code: "PDF_EXTRACTION",
        starter: false,
        professional: true,
        premium: true,
        description: "AuftragsbestÃƒÆ’Ã‚Â¤tigungen aus PDFs auslesen.",
      },
      {
        name: "E-Mail-Automatik",
        code: "EMAIL_AUTOMATION",
        starter: false,
        professional: true,
        premium: true,
        description: "E-Mails erkennen und automatisch AuftrÃƒÆ’Ã‚Â¤ge vorbereiten.",
      },
      {
        name: "Produkt-Mapping",
        code: "PRODUCT_MAPPING",
        starter: false,
        professional: true,
        premium: true,
        description: "Externe Produktnamen internen Produkten zuordnen.",
      },
    ],
  },
  {
    title: "Betrieb",
    description: "Module fÃƒÆ’Ã‚Â¼r KÃƒÆ’Ã‚Â¼che, Einkauf, Lager und operative Planung.",
    features: [
      {
        name: "Produktion",
        code: "PRODUCTION",
        starter: false,
        professional: true,
        premium: true,
        description: "Produktionslisten fÃƒÆ’Ã‚Â¼r KÃƒÆ’Ã‚Â¼che und Vorbereitung.",
      },
      {
        name: "Einkauf",
        code: "PURCHASING",
        starter: false,
        professional: true,
        premium: true,
        description: "Einkaufslisten aus AuftrÃƒÆ’Ã‚Â¤gen und Rezepturen vorbereiten.",
      },
      {
        name: "Lager",
        code: "WAREHOUSE",
        starter: false,
        professional: true,
        premium: true,
        description: "BestÃƒÆ’Ã‚Â¤nde und Verbrauch kontrollieren.",
      },
      {
        name: "Lieferanten",
        code: "SUPPLIERS",
        starter: false,
        professional: true,
        premium: true,
        description: "Lieferanten und Bestellinformationen verwalten.",
      },
      {
        name: "Rezepte",
        code: "RECIPES",
        starter: false,
        professional: true,
        premium: true,
        description: "Rezepturen und Mengenberechnung vorbereiten.",
      },
    ],
  },
  {
    title: "Premium",
    description: "Erweiterungen fÃƒÆ’Ã‚Â¼r grÃƒÆ’Ã‚Â¶ÃƒÆ’Ã…Â¸ere Caterer und Integrationen.",
    features: [
      {
        name: "Fahreransicht",
        code: "DRIVER_VIEW",
        starter: false,
        professional: false,
        premium: true,
        description: "Mobile Ansicht fÃƒÆ’Ã‚Â¼r Fahrer, Lieferungen und Routen.",
      },
      {
        name: "Integrationen",
        code: "INTEGRATIONS",
        starter: false,
        professional: false,
        premium: true,
        description: "Anbindung an externe Systeme und Plattformen.",
      },
      {
        name: "Lexware / DATEV / API",
        code: "ACCOUNTING_API",
        starter: false,
        professional: false,
        premium: true,
        description: "SpÃƒÆ’Ã‚Â¤tere Schnittstellen fÃƒÆ’Ã‚Â¼r Buchhaltung und Export.",
      },
      {
        name: "Priorisierter Support",
        code: "PRIORITY_SUPPORT",
        starter: false,
        professional: false,
        premium: true,
        description: "Schnellerer Support fÃƒÆ’Ã‚Â¼r Premium-Kunden.",
      },
    ],
  },
];

function FeatureCheck({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 999,
        fontWeight: 950,
        background: enabled ? "#ecfdf5" : "#f1f5f9",
        color: enabled ? "#047857" : "#94a3b8",
        border: enabled ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
      }}
    >
      {enabled ? "ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“" : "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“"}
    </span>
  );
}

export default function FeaturesPage() {
  const totalFeatures = featureGroups.reduce((sum, group) => sum + group.features.length, 0);

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Features</h1>
          <p className="pageSubtitle">
            ÃƒÆ’Ã…â€œbersicht aller Gastario-Module. SpÃƒÆ’Ã‚Â¤ter kannst du Module pro Mandant einzeln freischalten.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn" to="/gastario-control/pakete">
            Pakete ansehen
          </Link>
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">
            Mandanten verwalten
          </Link>
        </div>
      </header>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Module</div>
          <div className="statValue">{totalFeatures}</div>
          <div className="statHint">geplante Feature-Codes</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Starter</div>
          <div className="statValue">
            {featureGroups.flatMap((group) => group.features).filter((feature) => feature.starter).length}
          </div>
          <div className="statHint">Basisfunktionen</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Professional</div>
          <div className="statValue">
            {featureGroups.flatMap((group) => group.features).filter((feature) => feature.professional).length}
          </div>
          <div className="statHint">operative Module</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Premium</div>
          <div className="statValue">
            {featureGroups.flatMap((group) => group.features).filter((feature) => feature.premium).length}
          </div>
          <div className="statHint">alle Erweiterungen</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Feature-Matrix</div>
            <h2 className="panelTitle">Module nach Paket</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Modul</th>
                <th>Code</th>
                <th>Beschreibung</th>
                <th>Starter</th>
                <th>Professional</th>
                <th>Premium</th>
              </tr>
            </thead>
            <tbody>
              {featureGroups.map((group) => (
                <>
                  <tr key={group.title}>
                    <td colSpan={6} style={{ background: "#f8fafc" }}>
                      <strong>{group.title}</strong>
                      <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
                        {group.description}
                      </div>
                    </td>
                  </tr>

                  {group.features.map((feature) => (
                    <tr key={feature.code}>
                      <td className="tenantName">{feature.name}</td>
                      <td
                        style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          color: "#0f766e",
                          fontWeight: 950,
                        }}
                      >
                        {feature.code}
                      </td>
                      <td style={{ color: "#475569", fontWeight: 650 }}>
                        {feature.description}
                      </td>
                      <td>
                        <FeatureCheck enabled={feature.starter} />
                      </td>
                      <td>
                        <FeatureCheck enabled={feature.professional} />
                      </td>
                      <td>
                        <FeatureCheck enabled={feature.premium} />
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panelHeader">
          <div>
            <div className="panelKicker">NÃƒÆ’Ã‚Â¤chster Ausbauschritt</div>
            <h2 className="panelTitle">Einzelfreischaltung pro Mandant</h2>
          </div>
        </div>

        <p style={{
          color: "#334155",
          fontWeight: 750,
          lineHeight: 1.55,
          margin: 0
        }}>
          Als NÃƒÆ’Ã‚Â¤chstes verbinden wir diese Feature-Matrix mit den echten TenantFeature-Daten.
          Dann kannst du unabhÃƒÆ’Ã‚Â¤ngig vom Paket einzelne Module aktivieren oder deaktivieren.
        </p>
      </section>
    </SuperAdminLayout>
  );
}
