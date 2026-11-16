import {
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioDataList,
  GastarioDataRow,
  GastarioBadge,
  GastarioEmptyState,
} from "../components/ui";

export function meta() {
  return [
    {
      title: "Plan & Abo · Gastario",
    },
  ];
}

function formatDate(
  value:
    | string
    | Date
    | null
    | undefined
) {
  if (!value) {
    return "-";
  }

  try {
    return new Date(
      value
    ).toLocaleDateString(
      "de-DE"
    );
  } catch {
    return "-";
  }
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  const { getTenantAccess } =
    await import(
      "../lib/features.server"
    );

  const access =
    await getTenantAccess(request);

  if (!access?.tenant) {
    return {
      tenantName: "Gastario",
      planCode: "STARTER",
      subscriptionStatus:
        "TRIAL",
      trialEndsAt: null,
      maxUsers: 1,
      maxBrands: 1,
      maxEmailAccounts: 1,
      error:
        "Kein Mandant gefunden.",
    };
  }

  return {
    tenantName:
      access.tenant.name,
    planCode:
      access.tenant.planCode,
    subscriptionStatus:
      access.tenant
        .subscriptionStatus,
    trialEndsAt:
      access.tenant.trialEndsAt,
    maxUsers:
      access.tenant.maxUsers,
    maxBrands:
      access.tenant.maxBrands,
    maxEmailAccounts:
      access.tenant
        .maxEmailAccounts,
    error: null,
  };
}

export default function KontoAboPage() {
  const data =
    useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Verwaltung"
          title="Plan & Abo"
          description="Aktuelles Gastario-Paket, enthaltene Limits und spätere Abo-Rechnungen zentral einsehen."
        />

        {data.error ? (
          <GastarioNotice type="danger">
            {data.error}
          </GastarioNotice>
        ) : null}

        <GastarioMetricGrid>
          <GastarioMetric
            label="Aktueller Plan"
            value={data.planCode}
            description={data.tenantName}
            badge={
              data.subscriptionStatus
            }
          />

          <GastarioMetric
            label="Nutzer"
            value={data.maxUsers}
            description="Im Paket enthalten"
            badge="Limit"
          />

          <GastarioMetric
            label="Marken"
            value={data.maxBrands}
            description="Im Paket enthalten"
            badge="Limit"
          />

          <GastarioMetric
            label="E-Mail-Konten"
            value={
              data.maxEmailAccounts
            }
            description="Für automatische Importe"
            badge="Limit"
          />
        </GastarioMetricGrid>

        <GastarioSection
          eyebrow="Abo-Übersicht"
          title="Aktuelles Abonnement"
          description={`Tarif- und Vertragsstatus für ${data.tenantName}.`}
          action={<GastarioBadge variant="neutral">{data.subscriptionStatus}</GastarioBadge>}
        >
          <GastarioDataList>
            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">Tarif</strong>
                <span className="g-ui-data-row-description">Aktuell zugewiesenes Paket</span>
              </div>
              <div className="g-ui-data-row-meta"><strong>{data.planCode}</strong></div>
            </GastarioDataRow>
            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">Abonnementstatus</strong>
                <span className="g-ui-data-row-description">Aktueller Vertragsstatus</span>
              </div>
              <div className="g-ui-data-row-meta">
                <GastarioBadge variant={data.subscriptionStatus === "ACTIVE" ? "success" : "neutral"}>
                  {data.subscriptionStatus}
                </GastarioBadge>
              </div>
            </GastarioDataRow>
            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">Testphase bis</strong>
                <span className="g-ui-data-row-description">Ende der Testphase, sofern hinterlegt</span>
              </div>
              <div className="g-ui-data-row-meta"><strong>{formatDate(data.trialEndsAt)}</strong></div>
            </GastarioDataRow>
          </GastarioDataList>
        </GastarioSection>

        <GastarioSection
          eyebrow="Abrechnung"
          title="Abo-Rechnungen"
          description="Sobald die Gastario-Abrechnung aktiv ist, stehen Rechnungen hier als PDF bereit."
          action={
            <GastarioBadge variant="neutral">
              Noch keine Rechnungen
            </GastarioBadge>
          }
        >
          <GastarioEmptyState title="Noch keine Abo-Rechnungen vorhanden">
            Die Übersicht wird automatisch gefüllt, sobald für den
            Mandanten eine Abrechnung erstellt wurde.
          </GastarioEmptyState>
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}