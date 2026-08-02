import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-administration.css";

export function meta() {
  return [
    {
      title:
        "Steuerberater-Export · Gastario",
    },
    {
      name: "description",
      content:
        "Monatsabschluss und Unterlagen für den Steuerberater vorbereiten.",
    },
  ];
}

export default function SteuerberaterExport() {
  return (
    <AppLayout>
      <PageShell className="adminPage taxExportPage">
        <PageHeader
          eyebrow="Finanzen"
          title="Steuerberater-Export"
          subtitle="Rechnungen, Belege und offene Punkte für einen nachvollziehbaren Monatsabschluss vorbereiten."
        />

        <MetricGrid className="adminMetricGrid">
          <MetricCard
            label="Rechnungen"
            value="0"
            description="für den Export vorbereitet"
            badge="Belege"
          />

          <MetricCard
            label="Einkaufsbelege"
            value="0"
            description="geprüft und zugeordnet"
            badge="Eingang"
          />

          <MetricCard
            label="Offene Punkte"
            value="0"
            description="vor Abschluss zu klären"
            badge="Prüfung"
          />
        </MetricGrid>

        <PageSection
          eyebrow="Monatsabschluss"
          title="Export vorbereiten"
          description="Der künftige Export bündelt alle Unterlagen eines Monats in einem einheitlichen Arbeitsablauf."
        >
          <div className="adminExportWorkflow">
            <article>
              <span>1</span>

              <div>
                <strong>
                  Zeitraum wählen
                </strong>

                <p>
                  Monat und Geschäftsjahr für den
                  Abschluss festlegen.
                </p>
              </div>
            </article>

            <article>
              <span>2</span>

              <div>
                <strong>
                  Vollständigkeit prüfen
                </strong>

                <p>
                  Rechnungen, Belege und offene
                  Zuordnungen kontrollieren.
                </p>
              </div>
            </article>

            <article>
              <span>3</span>

              <div>
                <strong>
                  Unterlagen exportieren
                </strong>

                <p>
                  Geprüfte Daten gebündelt für den
                  Steuerberater bereitstellen.
                </p>
              </div>
            </article>
          </div>
        </PageSection>

        <PageSection
          eyebrow="Exportstatus"
          title="Noch nicht aktiviert"
          description="Der technische Export wird schrittweise ergänzt. Bis dahin bleiben bestehende Rechnungs- und Buchhaltungsdaten unverändert."
          soft
          flat
        >
          <div className="adminEmptyState">
            <div className="adminEmptyStateIcon">
              0
            </div>

            <div>
              <strong>
                Noch kein Export verfügbar
              </strong>

              <p>
                Sobald der Monatsabschluss
                aktiviert ist, erscheinen hier
                Zeitraum, Prüfstatus und
                Downloadmöglichkeiten.
              </p>
            </div>
          </div>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}
