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
  GastarioSplitView,
  GastarioSplitMain,
  GastarioSplitAside,
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

        <GastarioSplitView>
          <GastarioSplitMain>
            <GastarioSection
              eyebrow="Aktueller Plan"
              title={data.planCode}
              description={`Mandant: ${data.tenantName}`}
              actions={
                <GastarioBadge variant="neutral">
                  {data.subscriptionStatus}
                </GastarioBadge>
              }
            >
              <GastarioDataList>
                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Status
                    </strong>

                    <span className="g-ui-data-row-description">
                      Aktueller Abonnementstatus
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {data.subscriptionStatus}
                    </strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Testphase bis
                    </strong>

                    <span className="g-ui-data-row-description">
                      Ende der aktuellen Testphase
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {formatDate(
                        data.trialEndsAt
                      )}
                    </strong>
                  </div>
                </GastarioDataRow>
              </GastarioDataList>
            </GastarioSection>
          </GastarioSplitMain>

          <GastarioSplitAside>
            <GastarioSection
              eyebrow="Paketumfang"
              title="Enthaltene Limits"
              description="Die Limits stammen direkt aus dem aktuell zugewiesenen Paket."
            >
              <GastarioDataList>
                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Nutzer
                    </strong>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {data.maxUsers}
                    </strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Marken
                    </strong>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {data.maxBrands}
                    </strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      E-Mail-Konten
                    </strong>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {data.maxEmailAccounts}
                    </strong>
                  </div>
                </GastarioDataRow>
              </GastarioDataList>
            </GastarioSection>
          </GastarioSplitAside>
        </GastarioSplitView>

        <GastarioSection
          eyebrow="Abrechnung"
          title="Abo-Rechnungen"
          description="Sobald die Gastario-Abrechnung aktiv ist, stehen Rechnungen hier als PDF bereit."
          actions={
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