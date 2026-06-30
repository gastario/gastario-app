import { Link } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

const packages = [
  {
    name: "Starter",
    code: "STARTER",
    price: "59 Ãƒ¢Ã¢€Å¡Ã‚¬",
    target: "FÃƒÆ’Ã‚¼r kleine Caterer, die AuftrÃƒÆ’Ã‚¤ge und Kunden sauber verwalten wollen.",
    limits: {
      brands: "1 Marke",
      emails: "1 Import-E-Mail",
      users: "1 Benutzer",
    },
    modules: [
      "AuftrÃƒÆ’Ã‚¤ge",
      "Kunden",
      "Produkte",
      "Packlisten",
      "Lieferscheine",
    ],
  },
  {
    name: "Professional",
    code: "PROFESSIONAL",
    price: "179 Ãƒ¢Ã¢€Å¡Ã‚¬",
    target: "FÃƒÆ’Ã‚¼r wachsende Caterer mit mehreren Marken, E-Mail-Eingang und operativer Planung.",
    limits: {
      brands: "bis 3 Marken",
      emails: "bis 3 Import-E-Mails",
      users: "bis 5 Benutzer",
    },
    modules: [
      "Auftragseingang",
      "PDF-Erkennung",
      "E-Mail-Automatik",
      "Einkauf",
      "Lager",
      "Lieferanten",
      "Rezepte",
      "Auswertungen",
      "Produkt-Mapping",
    ],
  },
  {
    name: "Premium",
    code: "PREMIUM",
    price: "299 Ãƒ¢Ã¢€Å¡Ã‚¬",
    target: "FÃƒÆ’Ã‚¼r grÃƒÆ’Ã‚¶ÃƒÆ’Ã…¸ere Caterer mit mehreren Marken, Integrationen und erweiterten Workflows.",
    limits: {
      brands: "unbegrenzt",
      emails: "unbegrenzt",
      users: "unbegrenzt",
    },
    modules: [
      "alle Module",
      "Fahreransicht",
      "Integrationen",
      "Lexware / DATEV / API spÃƒÆ’Ã‚¤ter",
      "erweitertes Produkt-Mapping",
      "priorisierter Support",
    ],
  },
];

export default function PaketePage() {
  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Pakete</h1>
          <p className="pageSubtitle">
            Verwalte die Paketlogik fÃƒÆ’Ã‚¼r Gastario. Die Paketzuweisung erfolgt pro Mandant in der Mandantenverwaltung.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">
            Mandanten verwalten
          </Link>
        </div>
      </header>

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 18,
        alignItems: "stretch"
      }}>
        {packages.map((pkg) => (
          <article key={pkg.code} className="panel" style={{
            display: "grid",
            alignContent: "start",
            gap: 18
          }}>
            <div>
              <div className="panelKicker">{pkg.code}</div>
              <h2 className="panelTitle" style={{ fontSize: 26 }}>{pkg.name}</h2>
              <div style={{
                marginTop: 10,
                fontSize: 38,
                fontWeight: 950,
                letterSpacing: "-0.05em"
              }}>
                {pkg.price}
                <span style={{
                  fontSize: 14,
                  color: "#64748b",
                  fontWeight: 800,
                  letterSpacing: 0,
                  marginLeft: 6
                }}>
                  / Monat
                </span>
              </div>
              <p style={{
                color: "#64748b",
                fontWeight: 700,
                lineHeight: 1.45,
                marginTop: 12
              }}>
                {pkg.target}
              </p>
            </div>

            <div style={{
              border: "1px solid #dbe5ee",
              borderRadius: 18,
              padding: 16,
              background: "#f8fafc"
            }}>
              <div style={{
                fontWeight: 950,
                marginBottom: 10,
                color: "#0f172a"
              }}>
                Limits
              </div>

              <div style={{ display: "grid", gap: 8, color: "#334155", fontWeight: 800 }}>
                <div>{pkg.limits.brands}</div>
                <div>{pkg.limits.emails}</div>
                <div>{pkg.limits.users}</div>
              </div>
            </div>

            <div>
              <div style={{
                fontWeight: 950,
                marginBottom: 10,
                color: "#0f172a"
              }}>
                Enthaltene Module
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {pkg.modules.map((module) => (
                  <span key={module} className="badge">
                    {module}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Hinweis</div>
            <h2 className="panelTitle">Pakete werden nicht ÃƒÆ’Ã‚¶ffentlich ausgewÃƒÆ’Ã‚¤hlt</h2>
          </div>
        </div>

        <p style={{
          color: "#334155",
          fontWeight: 750,
          lineHeight: 1.55,
          margin: 0
        }}>
          Neue Caterer registrieren sich nur mit Einladungscode. Das Paket wird danach durch den Super Admin
          beim Mandanten gesetzt. So kann niemand ÃƒÆ’Ã‚¶ffentlich einen Mandanten mit falschem Paket erstellen.
        </p>
      </section>
    </SuperAdminLayout>
  );
}
