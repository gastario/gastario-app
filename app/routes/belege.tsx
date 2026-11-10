import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioBadge,
  GastarioNotice,
  GastarioEmptyState,
  GastarioButton,
} from "../components/ui";

export function meta() {
  return [{ title: "Belege · Gastario" }];
}

export default function BelegePage() {
  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Finanzen"
          title="Belege"
          subtitle="Einkaufsbelege, Quittungen und Lieferantenrechnungen für die Buchhaltung vorbereiten."
          actions={
            <GastarioButton type="button" variant="primary" disabled title="Beleg-Upload wird noch entwickelt">
              + Beleg hochladen
            </GastarioButton>
          }
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
          eyebrow="Belegübersicht"
          title="Gespeicherte Belege"
          description="Belege erfassen, kontrollieren und für die Buchhaltung vorbereiten."
          action={<GastarioBadge variant="neutral">0 Belege</GastarioBadge>}
        >
          <GastarioNotice type="info">
            Der Beleg-Upload und die automatische Erkennung sind noch in Vorbereitung.
            Aktuell können auf dieser Seite noch keine Dokumente hochgeladen oder exportiert werden.
          </GastarioNotice>

          <GastarioEmptyState title="Noch keine Belege vorhanden">
            <p>Sobald der Belegscan verfügbar ist, erscheinen hier deine Belege mit Status und Buchungsdaten.</p>
          </GastarioEmptyState>
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}
