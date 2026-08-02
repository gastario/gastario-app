import {
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-administration.css";

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
      <PageShell className="adminPage accountPage">
        <PageHeader
          eyebrow="Verwaltung"
          title="Plan & Abo"
          subtitle="Aktuelles Gastario-Paket, enthaltene Limits und spätere Abo-Rechnungen zentral einsehen."
        />

        {data.error ? (
          <Notice type="danger">
            {data.error}
          </Notice>
        ) : null}

        <MetricGrid className="adminMetricGrid adminMetricGridFour">
          <MetricCard
            label="Aktueller Plan"
            value={data.planCode}
            description={data.tenantName}
            badge={
              data.subscriptionStatus
            }
          />

          <MetricCard
            label="Nutzer"
            value={data.maxUsers}
            description="im Paket enthalten"
            badge="Limit"
          />

          <MetricCard
            label="Marken"
            value={data.maxBrands}
            description="im Paket enthalten"
            badge="Limit"
          />

          <MetricCard
            label="E-Mail-Konten"
            value={
              data.maxEmailAccounts
            }
            description="für automatische Importe"
            badge="Limit"
          />
        </MetricGrid>

        <div className="adminSplitGrid">
          <PageSection
            eyebrow="Aktueller Plan"
            title={data.planCode}
            description={`Mandant: ${data.tenantName}`}
          >
            <div className="adminPlanSummary">
              <div>
                <span>Status</span>

                <strong>
                  {
                    data.subscriptionStatus
                  }
                </strong>
              </div>

              <div>
                <span>
                  Testphase bis
                </span>

                <strong>
                  {formatDate(
                    data.trialEndsAt
                  )}
                </strong>
              </div>
            </div>
          </PageSection>

          <PageSection
            eyebrow="Paketumfang"
            title="Enthaltene Limits"
            description="Die Limits stammen direkt aus dem aktuell zugewiesenen Paket."
          >
            <div className="adminLimitGrid">
              <article>
                <strong>
                  {data.maxUsers}
                </strong>

                <span>
                  Nutzer
                </span>
              </article>

              <article>
                <strong>
                  {data.maxBrands}
                </strong>

                <span>
                  Marken
                </span>
              </article>

              <article>
                <strong>
                  {
                    data.maxEmailAccounts
                  }
                </strong>

                <span>
                  E-Mail-Konten
                </span>
              </article>
            </div>
          </PageSection>
        </div>

        <PageSection
          eyebrow="Abrechnung"
          title="Abo-Rechnungen"
          description="Sobald die Gastario-Abrechnung aktiv ist, stehen Rechnungen hier als PDF bereit."
          actions={
            <span className="adminSoftBadge">
              Noch keine Rechnungen
            </span>
          }
        >
          <div className="adminEmptyState">
            <div className="adminEmptyStateIcon">
              0
            </div>

            <div>
              <strong>
                Noch keine Abo-Rechnungen vorhanden
              </strong>

              <p>
                Die Übersicht wird automatisch
                gefüllt, sobald für den Mandanten
                eine Abrechnung erstellt wurde.
              </p>
            </div>
          </div>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}
