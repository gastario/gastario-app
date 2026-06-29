import AppLayout from "../components/AppLayout";

const companySettings = [
  { label: "Firmenname", value: "Gastario Demo Catering GmbH" },
  { label: "Adresse", value: "Goerzallee 299, 14167 Berlin" },
  { label: "E-Mail", value: "office@gastario.de" },
  { label: "Telefon", value: "030 123456789" },
  { label: "Steuernummer", value: "27/000/00000" },
  { label: "USt-ID", value: "DE000000000" },
];

const documentSettings = [
  { title: "Angebote", text: "Nummernkreis, Zahlungsziel, Standardtext und PDF-Layout" },
  { title: "Auftragsbestätigungen", text: "Bestätigungstext, Hinweise, Allergene und interne Notizen" },
  { title: "Lieferscheine", text: "Unterschriftsfeld, Equipment, Fahrerhinweise und Kundenansicht" },
  { title: "Rechnungen", text: "Lexware-Anbindung, Rechnungsnummern und Export später" },
];

const users = [
  { name: "Edis Mutluer", role: "Inhaber", access: "Vollzugriff" },
  { name: "Büro", role: "Disposition", access: "Aufträge, Kunden, Angebote" },
  { name: "Küche", role: "Produktion", access: "Produktion, Packlisten, Lager" },
  { name: "Fahrer", role: "Lieferung", access: "Lieferungen, Fahrerzettel" },
];

const integrations = [
  { name: "Heycater", status: "Vorbereitet", description: "Bestellungen aus E-Mails erkennen und importieren" },
  { name: "Egora", status: "Vorbereitet", description: "Anfragen und Aufträge später automatisiert übernehmen" },
  { name: "Lexware", status: "Geplant", description: "Rechnungen und Kundendaten später synchronisieren" },
  { name: "Mailjet", status: "Geplant", description: "Angebote und Bestätigungen aus Gastario versenden" },
];

export function meta() {
  return [{ title: "Einstellungen · Gastario" }];
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">System</p>
          <h1>Einstellungen</h1>
          <span className="pageSubline">
            Firma, Dokumente, Benutzer, Nummernkreise und Integrationen zentral konfigurieren.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Änderungen prüfen</button>
          <button className="primaryButton">Speichern</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Mandant</p>
            <strong>Demo</strong>
            <span>später je Caterer getrennt</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Benutzer</p>
            <strong>4</strong>
            <span>mit unterschiedlichen Rollen</span>
          </div>
          <small data-trend="bereit">bereit</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Integrationen</p>
            <strong>4</strong>
            <span>geplant oder vorbereitet</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>
      </section>

      <section className="settingsGrid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Firma</p>
              <h2>Unternehmensdaten</h2>
            </div>
            <button className="ghostButton">Bearbeiten</button>
          </div>

          <div className="settingsList">
            {companySettings.map((item) => (
              <div className="settingsItem" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Dokumente</p>
              <h2>Vorlagen</h2>
            </div>
            <button className="ghostButton">Vorlagen öffnen</button>
          </div>

          <div className="settingsCards">
            {documentSettings.map((item) => (
              <article className="settingsCard" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="settingsGrid">
        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Team</p>
              <h2>Benutzer & Rollen</h2>
            </div>
            <button className="ghostButton">Benutzer einladen</button>
          </div>

          <div className="settingsCards">
            {users.map((user) => (
              <article className="settingsCard" key={user.name}>
                <strong>{user.name}</strong>
                <span>{user.role}</span>
                <small>{user.access}</small>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Anbindungen</p>
              <h2>Integrationen</h2>
            </div>
            <button className="ghostButton">Verbinden</button>
          </div>

          <div className="settingsCards">
            {integrations.map((item) => (
              <article className="settingsCard" key={item.name}>
                <div className="settingsCardTop">
                  <strong>{item.name}</strong>
                  <em>{item.status}</em>
                </div>
                <span>{item.description}</span>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Mandantenfähigkeit</p>
            <h2>Grundlage für SaaS</h2>
          </div>
          <button className="ghostButton">Technische Einrichtung später</button>
        </div>

        <div className="noteBox">
          <strong>Wichtig für den Verkauf an andere Caterer</strong>
          <p>
            Gastario muss später jede Firma sauber trennen: eigene Kunden, Produkte, Aufträge,
            Benutzer, Nummernkreise, Dokumentenvorlagen und Einstellungen. Technisch wird das später
            über Mandanten und tenantId gelöst.
          </p>
        </div>
      </section>
    </AppLayout>
  );
}
