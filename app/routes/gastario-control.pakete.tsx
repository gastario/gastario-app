import SuperAdminLayout from "../components/SuperAdminLayout";

const plans = [
  {
    name: "Starter",
    price: "49 € / Monat",
    brands: "1 Marke",
    emails: "1 Import-E-Mail",
    users: "1 Benutzer",
    features: ["Aufträge", "Kunden", "Produkte", "Packlisten", "Lieferscheine"],
  },
  {
    name: "Professional",
    price: "129 € / Monat",
    brands: "2–3 Marken",
    emails: "3 Import-E-Mails",
    users: "5 Benutzer",
    features: [
      "Auftragseingang",
      "PDF-Erkennung",
      "E-Mail-Automatik",
      "Einkauf",
      "Lager",
      "Rezepte",
      "Auswertungen",
    ],
  },
  {
    name: "Premium",
    price: "249 € / Monat",
    brands: "unbegrenzt",
    emails: "unbegrenzt",
    users: "unbegrenzt",
    features: [
      "Alle Module",
      "Fahreransicht",
      "Produkt-Mapping",
      "Integrationen",
      "Mehrere Standorte später",
      "Priorisierter Support",
    ],
  },
];

export function meta() {
  return [{ title: "Pakete · Gastario Control" }];
}

export default function ControlPlansPage() {
  return (
    <SuperAdminLayout>
      <header className="controlTopbar">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1>Pakete</h1>
          <span className="pageSubline">
            Preisstufen, Marken-Limits, E-Mail-Limits und freigeschaltete Module definieren.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Preise prüfen</button>
          <button className="primaryButton">Paket anlegen</button>
        </div>
      </header>

      <section className="plansGrid">
        {plans.map((plan) => (
          <article className="planCard" key={plan.name}>
            <div className="planTop">
              <p>{plan.name}</p>
              <strong>{plan.price}</strong>
            </div>

            <div className="planLimits">
              <span>{plan.brands}</span>
              <span>{plan.emails}</span>
              <span>{plan.users}</span>
            </div>

            <div className="planFeatures">
              {plan.features.map((feature) => (
                <em key={feature}>{feature}</em>
              ))}
            </div>

            <button className="ghostButton">Paket bearbeiten</button>
          </article>
        ))}
      </section>
    </SuperAdminLayout>
  );
}
