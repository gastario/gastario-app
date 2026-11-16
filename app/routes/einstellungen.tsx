import { useState } from "react";
import { Link } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioPage,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioBadge,
  GastarioDataList,
  GastarioDataRow,
  GastarioDetailDialog,
  GastarioStack,
  GastarioNotice,
  GastarioButton,
  gastarioButtonClass,
} from "../components/ui";

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


type SettingsArea = "company" | "documents" | "users" | "integrations";
const areas: Array<{ id: SettingsArea; title: string; detail: string; badge: string }> = [
  { id: "company", title: "Unternehmensdaten", detail: "Firmendaten und Kontaktdaten des Betriebs einsehen", badge: "Stammdaten" },
  { id: "documents", title: "Dokumentvorlagen", detail: "Angebote, Auftragsbestätigungen, Lieferscheine und Rechnungen", badge: "Vorlagen" },
  { id: "users", title: "Benutzer und Rollen", detail: "Geplante Teamrollen und Zuständigkeiten", badge: "Team" },
  { id: "integrations", title: "Integrationen", detail: "Geplante und vorbereitete Anbindungen", badge: "System" },
];

export function meta() {
  return [{ title: "Einstellungen · Gastario" }];
}

export default function SettingsPage() {
  const [selectedArea, setSelectedArea] = useState<SettingsArea | null>(null);
  const activeArea = areas.find(area => area.id === selectedArea);
  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Verwaltung"
          title="Einstellungen"
          subtitle="Firma, Dokumente, Benutzer, Nummernkreise und Integrationen zentral konfigurieren."
          actions={
            <>
              <Link to="/einstellungen/rechnungen" className={gastarioButtonClass("secondary")}>
                Rechnungsdaten
              </Link>
              <Link to="/konto/abo" className={gastarioButtonClass("primary")}>
                Plan und Abo
              </Link>
            </>
          }
        />
        <GastarioMetricGrid>
          <GastarioMetric
            label="Mandant" value="Demo"
            description="Angezeigte Beispielkonfiguration" badge="Vorschau"
          />
          <GastarioMetric
            label="Benutzer" value={users.length}
            description="Beispielrollen in dieser Ansicht" badge="Team"
          />
          <GastarioMetric
            label="Integrationen" value={integrations.length}
            description="Geplante oder vorbereitete Anbieter" badge="System"
          />
        </GastarioMetricGrid>

        <GastarioSection
          eyebrow="Verwaltungsübersicht"
          title="Einstellungen verwalten"
          description="Bereich auswählen und Details im zentralen Gastario-Dialog öffnen."
          action={<GastarioBadge variant="neutral">4 Bereiche</GastarioBadge>}
        >
          <GastarioNotice type="info">
            Diese Übersicht zeigt teilweise Beispielwerte. Sie ändert keine realen Firmen- oder Benutzerstammdaten.
            Die Rechnungsdaten und dein Abo erreichst du über die vorhandenen Einstellungen.
          </GastarioNotice>
          <GastarioDataList>
            {areas.map(area => (
              <GastarioDataRow key={area.id} onClick={() => setSelectedArea(area.id)}>
                <div className="g-ui-data-row-main">
                  <strong className="g-ui-data-row-title">{area.title}</strong>
                  <span className="g-ui-data-row-description">{area.detail}</span>
                </div>
                <div className="g-ui-data-row-meta">
                  <GastarioBadge variant="neutral">{area.badge}</GastarioBadge>
                </div>
                <div className="g-ui-data-row-actions">
                  <GastarioButton variant="secondary" onClick={() => setSelectedArea(area.id)}>
                    Öffnen
                  </GastarioButton>
                </div>
              </GastarioDataRow>
            ))}
          </GastarioDataList>
        </GastarioSection>

        <GastarioDetailDialog
          open={selectedArea !== null}
          title={activeArea?.title || "Einstellungen"}
          description={activeArea?.detail}
          size="lg"
          onClose={() => setSelectedArea(null)}
          footer={
            <>
              {selectedArea === "documents" ? (
                <Link to="/einstellungen/rechnungen" className={gastarioButtonClass("primary")}>
                  Rechnungsdaten öffnen
                </Link>
              ) : null}
              <GastarioButton variant="secondary" onClick={() => setSelectedArea(null)}>
                Schließen
              </GastarioButton>
            </>
          }
        >
          {selectedArea === "company" ? (
            <GastarioStack>
              <GastarioNotice type="info">Die folgenden Werte sind Beispieldaten und hier nicht bearbeitbar.</GastarioNotice>
              <GastarioDataList>
                {companySettings.map(item => (
                  <GastarioDataRow key={item.label}>
                    <div className="g-ui-data-row-main">
                      <span className="g-ui-data-row-description">{item.label}</span>
                      <strong className="g-ui-data-row-title">{item.value}</strong>
                    </div>
                  </GastarioDataRow>
                ))}
              </GastarioDataList>
            </GastarioStack>
          ) : null}
          {selectedArea === "documents" ? (
            <GastarioDataList>
              {documentSettings.map(item => (
                <GastarioDataRow key={item.title}>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">{item.title}</strong>
                    <span className="g-ui-data-row-description">{item.text}</span>
                  </div>
                </GastarioDataRow>
              ))}
            </GastarioDataList>
          ) : null}
          {selectedArea === "users" ? (
            <GastarioStack>
              <GastarioNotice type="info">Diese Teamrollen sind bislang Beispielangaben, keine Live-Benutzerverwaltung.</GastarioNotice>
              <GastarioDataList>
                {users.map(user => (
                  <GastarioDataRow key={user.name}>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">{user.name}</strong>
                      <span className="g-ui-data-row-description">{user.access}</span>
                    </div>
                    <div className="g-ui-data-row-meta">
                      <GastarioBadge variant="neutral">{user.role}</GastarioBadge>
                    </div>
                  </GastarioDataRow>
                ))}
              </GastarioDataList>
            </GastarioStack>
          ) : null}
          {selectedArea === "integrations" ? (
            <GastarioStack>
              <GastarioNotice type="info">Die hier angezeigten Integrationsstatus sind Platzhalter und kein Live-Verbindungsstatus.</GastarioNotice>
              <GastarioDataList>
                {integrations.map(item => (
                  <GastarioDataRow key={item.name}>
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">{item.name}</strong>
                      <span className="g-ui-data-row-description">{item.description}</span>
                    </div>
                    <div className="g-ui-data-row-meta">
                      <GastarioBadge variant="neutral">{item.status}</GastarioBadge>
                    </div>
                  </GastarioDataRow>
                ))}
              </GastarioDataList>
            </GastarioStack>
          ) : null}
        </GastarioDetailDialog>
      </GastarioPage>
    </AppLayout>
  );
}
