import {
  Link,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-administration.css";

const companySettings = [
  {
    label: "Firmenname",
    value:
      "Gastario Demo Catering GmbH",
  },
  {
    label: "Adresse",
    value:
      "Goerzallee 299, 14167 Berlin",
  },
  {
    label: "E-Mail",
    value:
      "office@gastario.de",
  },
  {
    label: "Telefon",
    value:
      "030 123456789",
  },
  {
    label: "Steuernummer",
    value:
      "27/000/00000",
  },
  {
    label: "USt-ID",
    value:
      "DE000000000",
  },
];

const documentSettings = [
  {
    title: "Angebote",
    text:
      "Nummernkreis, Zahlungsziel, Standardtext und PDF-Layout",
  },
  {
    title:
      "Auftragsbestätigungen",
    text:
      "Bestätigungstext, Hinweise, Allergene und interne Notizen",
  },
  {
    title: "Lieferscheine",
    text:
      "Unterschriftsfeld, Equipment, Fahrerhinweise und Kundenansicht",
  },
  {
    title: "Rechnungen",
    text:
      "Rechnungsdaten, Nummernkreise und Export",
  },
];

const users = [
  {
    name: "Edis Mutluer",
    role: "Inhaber",
    access: "Vollzugriff",
  },
  {
    name: "Büro",
    role: "Disposition",
    access:
      "Aufträge, Kunden, Angebote",
  },
  {
    name: "Küche",
    role: "Produktion",
    access:
      "Produktion, Packlisten, Lager",
  },
  {
    name: "Fahrer",
    role: "Lieferung",
    access:
      "Lieferungen, Fahrerzettel",
  },
];

const integrations = [
  {
    name: "Heycater",
    status: "Vorbereitet",
    description:
      "Bestellungen aus E-Mails erkennen und importieren",
  },
  {
    name: "Egora",
    status: "Vorbereitet",
    description:
      "Anfragen und Aufträge später automatisiert übernehmen",
  },
  {
    name: "Lexware",
    status: "Geplant",
    description:
      "Rechnungen und Kundendaten später synchronisieren",
  },
  {
    name: "Mailjet",
    status: "Geplant",
    description:
      "Angebote und Bestätigungen aus Gastario versenden",
  },
];

export function meta() {
  return [
    {
      title:
        "Einstellungen · Gastario",
    },
  ];
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageShell className="adminPage settingsPage">
        <PageHeader
          eyebrow="Verwaltung"
          title="Einstellungen"
          subtitle="Firma, Dokumente, Benutzer, Nummernkreise und Integrationen zentral konfigurieren."
          actions={
            <>
              <Link
                to="/einstellungen/rechnungen"
                className="adminButton adminButtonSecondary"
              >
                Rechnungsdaten
              </Link>

              <Link
                to="/konto/abo"
                className="adminButton adminButtonPrimary"
              >
                Plan und Abo
              </Link>
            </>
          }
        />

        <MetricGrid className="adminMetricGrid">
          <MetricCard
            label="Mandant"
            value="Demo"
            description="aktuell ausgewählter Betrieb"
            badge="Aktiv"
          />

          <MetricCard
            label="Benutzer"
            value={users.length}
            description="mit unterschiedlichen Rollen"
            badge="Team"
          />

          <MetricCard
            label="Integrationen"
            value={integrations.length}
            description="geplant oder vorbereitet"
            badge="System"
          />
        </MetricGrid>

        <div className="adminDashboardGrid">
          <PageSection
            eyebrow="Firma"
            title="Unternehmensdaten"
            description="Zentrale Stammdaten des Mandanten."
            actions={
              <span className="adminSoftBadge">
                Stammdaten
              </span>
            }
          >
            <div className="adminDefinitionList">
              {companySettings.map(
                (item) => (
                  <div key={item.label}>
                    <span>
                      {item.label}
                    </span>

                    <strong>
                      {item.value}
                    </strong>
                  </div>
                )
              )}
            </div>
          </PageSection>

          <PageSection
            eyebrow="Dokumente"
            title="Vorlagen"
            description="Dokumentarten und ihre zentralen Einstellungen."
            actions={
              <Link
                to="/einstellungen/rechnungen"
                className="adminTextLink"
              >
                Rechnungen öffnen
              </Link>
            }
          >
            <div className="adminListCards">
              {documentSettings.map(
                (item) => (
                  <article key={item.title}>
                    <strong>
                      {item.title}
                    </strong>

                    <span>
                      {item.text}
                    </span>
                  </article>
                )
              )}
            </div>
          </PageSection>

          <PageSection
            eyebrow="Team"
            title="Benutzer und Rollen"
            description="Geplante Arbeitsbereiche und Zugriffsrechte."
            actions={
              <span className="adminSoftBadge">
                {users.length} Benutzer
              </span>
            }
          >
            <div className="adminListCards">
              {users.map((user) => (
                <article key={user.name}>
                  <div className="adminCardRow">
                    <strong>
                      {user.name}
                    </strong>

                    <em>
                      {user.role}
                    </em>
                  </div>

                  <span>
                    {user.access}
                  </span>
                </article>
              ))}
            </div>
          </PageSection>

          <PageSection
            eyebrow="Anbindungen"
            title="Integrationen"
            description="Vorbereitete und geplante Verbindungen."
            actions={
              <span className="adminSoftBadge">
                Übersicht
              </span>
            }
          >
            <div className="adminListCards">
              {integrations.map(
                (item) => (
                  <article key={item.name}>
                    <div className="adminCardRow">
                      <strong>
                        {item.name}
                      </strong>

                      <em>
                        {item.status}
                      </em>
                    </div>

                    <span>
                      {item.description}
                    </span>
                  </article>
                )
              )}
            </div>
          </PageSection>
        </div>

        <PageSection
          eyebrow="Mandantenfähigkeit"
          title="Grundlage für Gastario SaaS"
          description="Jeder Betrieb benötigt getrennte Daten, Benutzer, Dokumente und Einstellungen."
          soft
          flat
        >
          <div className="adminArchitectureNote">
            <strong>
              Saubere Trennung je Caterer
            </strong>

            <p>
              Kunden, Produkte, Aufträge, Benutzer,
              Nummernkreise, Dokumentvorlagen und
              Konfigurationen bleiben je Mandant
              voneinander getrennt.
            </p>
          </div>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}
