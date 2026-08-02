import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-receipts.css";

export function meta() {
  return [
    {
      title: "Belege · Gastario",
    },
  ];
}

export default function BelegePage() {
  return (
    <AppLayout>
      <PageShell className="receiptsPage">
        <PageHeader
          eyebrow="Finanzen"
          title="Belege"
          subtitle="Einkaufsbelege, Quittungen und Lieferantenrechnungen zentral erfassen und für die Buchhaltung vorbereiten."
        />

        <MetricGrid className="receiptsMetricGrid">
          <MetricCard
            label="Unbearbeitet"
            value="0"
            description="müssen geprüft werden"
            badge="Eingang"
          />

          <MetricCard
            label="Bereit"
            value="0"
            description="für die Buchhaltung"
            badge="Geprüft"
          />

          <MetricCard
            label="Exportiert"
            value="0"
            description="an die Buchhaltung"
            badge="Erledigt"
          />
        </MetricGrid>

        <PageSection
          eyebrow="Belegscan"
          title="Belege erfassen"
          description="Hier entsteht der zentrale Arbeitsbereich für Rechnungen, Kassenbons und Lieferantenbelege."
        >
          <div className="receiptsUploadArea">
            <div className="receiptsUploadIcon">
              <span>+</span>
            </div>

            <div className="receiptsUploadContent">
              <strong>
                Dokument hochladen
              </strong>

              <p>
                PDF-, JPG- und PNG-Belege werden
                künftig automatisch ausgelesen,
                kategorisiert und dem passenden
                Lieferanten zugeordnet.
              </p>
            </div>

            <button
              type="button"
              className="receiptsPrimaryButton"
              disabled
            >
              Upload folgt
            </button>
          </div>
        </PageSection>

        <PageSection
          eyebrow="Workflow"
          title="Vom Beleg zur Buchhaltung"
          description="Der geplante Ablauf bleibt transparent und nachvollziehbar."
        >
          <div className="receiptsWorkflow">
            <article>
              <span>1</span>

              <div>
                <strong>
                  Beleg erfassen
                </strong>

                <p>
                  Datei hochladen oder später
                  direkt mit dem Smartphone
                  fotografieren.
                </p>
              </div>
            </article>

            <article>
              <span>2</span>

              <div>
                <strong>
                  Daten prüfen
                </strong>

                <p>
                  Lieferant, Datum, Betrag,
                  Steuer und Kategorie werden
                  kontrolliert.
                </p>
              </div>
            </article>

            <article>
              <span>3</span>

              <div>
                <strong>
                  Buchhaltung übergeben
                </strong>

                <p>
                  Geprüfte Belege werden für
                  Lexware Office oder den
                  Steuerberater vorbereitet.
                </p>
              </div>
            </article>
          </div>
        </PageSection>

        <PageSection
          eyebrow="Belegarchiv"
          title="Gespeicherte Belege"
          description="Alle erfassten Dokumente erscheinen später in dieser Übersicht."
        >
          <div className="receiptsEmptyState">
            <div className="receiptsEmptyIcon">
              0
            </div>

            <div>
              <strong>
                Noch keine Belege vorhanden
              </strong>

              <p>
                Sobald der Belegscan aktiviert
                ist, werden hochgeladene Dokumente
                hier mit Status und Buchungsdaten
                angezeigt.
              </p>
            </div>
          </div>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}