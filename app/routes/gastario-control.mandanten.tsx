import SuperAdminLayout from "../components/SuperAdminLayout";

const tenants = [
  {
    name: "Let Me Bowl / Mixie",
    owner: "Edis Mutluer",
    email: "mutluer.edis@gmail.com",
    plan: "Professional",
    status: "Aktiv",
    brands: "3 / 3",
    emails: "3 / 3",
    users: "1 / 5",
    features: "Auftragseingang, PDF, Einkauf, Lager",
  },
  {
    name: "Muster Catering",
    owner: "Max Muster",
    email: "max@muster-catering.de",
    plan: "Starter",
    status: "Testphase",
    brands: "1 / 1",
    emails: "1 / 1",
    users: "1 / 1",
    features: "Aufträge, Kunden, Produkte, Packlisten",
  },
  {
    name: "Berlin Buffet",
    owner: "Sarah Klein",
    email: "sarah@berlin-buffet.de",
    plan: "Premium",
    status: "Aktiv",
    brands: "4 / 99",
    emails: "7 / 99",
    users: "8 / 99",
    features: "Alle Module",
  },
];

export function meta() {
  return [{ title: "Mandanten · Gastario Control" }];
}

export default function ControlTenantsPage() {
  return (
    <SuperAdminLayout>
      <header className="controlTopbar">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1>Mandanten</h1>
          <span className="pageSubline">
            Caterer-Accounts, Pakete, Limits, Status und Freischaltungen verwalten.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Export</button>
          <button className="primaryButton">Mandant anlegen</button>
        </div>
      </header>

      <section className="controlTenantCards">
        {tenants.map((tenant) => (
          <article className="controlTenantCard" key={tenant.name}>
            <div className="controlTenantCardTop">
              <div>
                <strong>{tenant.name}</strong>
                <span>{tenant.owner} · {tenant.email}</span>
              </div>
              <em>{tenant.status}</em>
            </div>

            <div className="controlLimitGrid">
              <p>
                <b>Paket</b>
                <span>{tenant.plan}</span>
              </p>
              <p>
                <b>Marken</b>
                <span>{tenant.brands}</span>
              </p>
              <p>
                <b>E-Mails</b>
                <span>{tenant.emails}</span>
              </p>
              <p>
                <b>Benutzer</b>
                <span>{tenant.users}</span>
              </p>
            </div>

            <div className="controlFeatureLine">
              <b>Features</b>
              <span>{tenant.features}</span>
            </div>

            <div className="documentActions">
              <button className="ghostButton">Paket ändern</button>
              <button className="ghostButton">Module freischalten</button>
              <button className="ghostButton">Mandant sperren</button>
            </div>
          </article>
        ))}
      </section>
    </SuperAdminLayout>
  );
}
