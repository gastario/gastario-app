import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioPanel,
  GastarioStack,
  GastarioToolbar,
  GastarioButton,
  GastarioDataList,
  GastarioDataRow,
  GastarioEmptyState,
} from "../components/ui";

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
      <GastarioPage>
        <GastarioHeader
          eyebrow="Finanzen"
          title="Belege"
          description="Einkaufsbelege, Quittungen und Lieferantenrechnungen zentral erfassen und für die Buchhaltung vorbereiten."
        />

        <GastarioMetricGrid>
          <GastarioMetric
            label="Unbearbeitet"
            value="0"
            description="Müssen geprüft werden"
            badge="Eingang"
          />

          <GastarioMetric
            label="Bereit"
            value="0"
            description="Für die Buchhaltung"
            badge="Geprüft"
          />

          <GastarioMetric
            label="Exportiert"
            value="0"
            description="An die Buchhaltung"
            badge="Erledigt"
          />
        </GastarioMetricGrid>

        <GastarioSection
          eyebrow="Belegscan"
          title="Belege erfassen"
          description="Hier entsteht der zentrale Arbeitsbereich für Rechnungen, Kassenbons und Lieferantenbelege."
        >
          <GastarioPanel variant="soft">
            <GastarioStack>
              <div>
                <strong>
                  Dokument hochladen
                </strong>

                <p>
                  PDF-, JPG- und PNG-Belege werden künftig automatisch
                  ausgelesen, kategorisiert und dem passenden Lieferanten
                  zugeordnet.
                </p>
              </div>

              <GastarioToolbar>
                <GastarioButton
                  type="button"
                  variant="primary"
                  disabled
                >
                  Upload folgt
                </GastarioButton>
              </GastarioToolbar>
            </GastarioStack>
          </GastarioPanel>
        </GastarioSection>

        <GastarioSection
          eyebrow="Workflow"
          title="Vom Beleg zur Buchhaltung"
          description="Der geplante Ablauf bleibt transparent und nachvollziehbar."
        >
          <GastarioDataList>
            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">
                  1 · Beleg erfassen
                </strong>

                <span className="g-ui-data-row-description">
                  Datei hochladen oder später direkt mit dem Smartphone
                  fotografieren.
                </span>
              </div>
            </GastarioDataRow>

            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">
                  2 · Daten prüfen
                </strong>

                <span className="g-ui-data-row-description">
                  Lieferant, Datum, Betrag, Steuer und Kategorie werden
                  kontrolliert.
                </span>
              </div>
            </GastarioDataRow>

            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">
                  3 · Buchhaltung übergeben
                </strong>

                <span className="g-ui-data-row-description">
                  Geprüfte Belege werden für Lexware Office oder den
                  Steuerberater vorbereitet.
                </span>
              </div>
            </GastarioDataRow>
          </GastarioDataList>
        </GastarioSection>

        <GastarioSection
          eyebrow="Belegarchiv"
          title="Gespeicherte Belege"
          description="Alle erfassten Dokumente erscheinen später in dieser Übersicht."
        >
          <GastarioEmptyState title="Noch keine Belege vorhanden">
            Sobald der Belegscan aktiviert ist, werden hochgeladene
            Dokumente hier mit Status und Buchungsdaten angezeigt.
          </GastarioEmptyState>
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}