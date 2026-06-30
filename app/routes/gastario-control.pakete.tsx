
import { Link } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

const packages = [
  {
    name: "Starter",
    price: "59 €",
    text: "Für kleine Caterer, die Aufträge und Kunden sauber verwalten wollen.",
    limits: ["1 Marke", "1 Import-E-Mail", "1 Benutzer"],
    modules: ["Aufträge", "Kunden", "Produkte", "Packlisten", "Lieferscheine"],
  },
  {
    name: "Professional",
    price: "179 €",
    text: "Für wachsende Caterer mit mehreren Marken, E-Mail-Eingang und operativer Planung.",
    limits: ["bis 3 Marken", "bis 3 Import-E-Mails", "bis 5 Benutzer"],
    modules: ["Auftragseingang", "PDF-Erkennung", "E-Mail-Automatik", "Einkauf", "Lager", "Lieferanten", "Rezepte", "Auswertungen"],
  },
  {
    name: "Premium",
    price: "299 €",
    text: "Für größere Caterer mit mehreren Marken, Integrationen und erweiterten Workflows.",
    limits: ["unbegrenzt", "unbegrenzt", "unbegrenzt"],
    modules: ["alle Module", "Fahreransicht", "Integrationen", "Lexware / DATEV / API später", "priorisierter Support"],
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
            Verwalte die Paketlogik für Gastario. Die Paketzuweisung erfolgt pro Mandant in der Mandantenverwaltung.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">
            Mandanten verwalten
          </Link>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
        {packages.map((pkg) => (
          <article className="panel" key={pkg.name}>
            <div className="panelKicker">{pkg.name}</div>
            <h2 className="panelTitle">{pkg.name}</h2>
            <div style={{ fontSize: 34, fontWeight: 950, marginTop: 16 }}>
              {pkg.price} <span style={{ fontSize: 14, color: "#64748b" }}>/ Monat</span>
            </div>
            <p style={{ color: "#64748b", fontWeight: 750, lineHeight: 1.5 }}>{pkg.text}</p>

            <div style={{ border: "1px solid #dbe5ee", borderRadius: 18, padding: 16, marginTop: 20 }}>
              <strong>Limits</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {pkg.limits.map((item) => <div key={item}>{item}</div>)}
              </div>
            </div>

            <h3 style={{ marginTop: 20 }}>Enthaltene Module</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pkg.modules.map((item) => (
                <span className="badge" key={item}>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panelKicker">Hinweis</div>
        <h2 className="panelTitle">Pakete werden nicht öffentlich ausgewählt</h2>
        <p style={{ color: "#334155", fontWeight: 750, lineHeight: 1.6 }}>
          Neue Caterer registrieren sich nur mit Einladungscode. Das Paket wird danach durch den Super Admin beim Mandanten gesetzt.
        </p>
      </section>
    </SuperAdminLayout>
  );
}
