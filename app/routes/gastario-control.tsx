import SuperAdminLayout from "../components/SuperAdminLayout";

const tenants = [
  { name: "Let Me Bowl / Mixie", plan: "Professional", status: "Aktiv", brands: "3", emails: "3" },
  { name: "Muster Catering", plan: "Starter", status: "Testphase", brands: "1", emails: "1" },
  { name: "Berlin Buffet", plan: "Premium", status: "Aktiv", brands: "4", emails: "7" },
];

const platformStats = [
  { label: "Mandanten", value: "3", detail: "aktive Caterer" },
  { label: "Monatsumsatz SaaS", value: "537 ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬", detail: "wiederkehrend geplant" },
  { label: "Testphasen", value: "1", detail: "lÃƒÆ’Ã‚Â¤uft aktuell" },
  { label: "Gesperrt", value: "0", detail: "keine Sperren" },
];

export function meta() {
  return [{ title: "Gastario Control Center" }];
}

export default function ControlCenterPage() {
  return (
    <SuperAdminLayout>
      <header className="controlTopbar">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1>Control Center</h1>
          <span className="pageSubline">
            Mandanten, Pakete, Module, Limits und Freischaltungen zentral verwalten.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">System prÃƒÆ’Ã‚Â¼fen</button>
          <button className="primaryButton">Neuer Mandant</button>
        </div>
      </header>

      <section className="controlMetrics">
        {platformStats.map((stat) => (
          <article className="metricCard" key={stat.label}>
            <div>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              <span>{stat.detail}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Mandanten</p>
            <h2>Aktuelle SaaS-Kunden</h2>
          </div>
          <button className="ghostButton">Alle Mandanten ÃƒÆ’Ã‚Â¶ffnen</button>
        </div>

        <div className="controlTenantTable">
          <div className="controlTenantHead">
            <span>Firma</span>
            <span>Paket</span>
            <span>Status</span>
            <span>Marken</span>
            <span>E-Mails</span>
            <span>Aktion</span>
          </div>

          {tenants.map((tenant) => (
            <div className="controlTenantRow" key={tenant.name}>
              <strong>{tenant.name}</strong>
              <span>{tenant.plan}</span>
              <em>{tenant.status}</em>
              <span>{tenant.brands}</span>
              <span>{tenant.emails}</span>
              <button className="ghostButton">Verwalten</button>
            </div>
          ))}
        </div>
      </section>
    </SuperAdminLayout>
  );
}
