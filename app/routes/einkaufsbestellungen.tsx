import {
  Form,
  Link,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-page-shell.css";
import "../styles/gastario-procurement-orders.css";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(
    "de-DE"
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Entwurf",
    ORDERED: "Bestellt",
    PARTIALLY_RECEIVED: "Teilweise geliefert",
    RECEIVED: "Geliefert",
    CANCELLED: "Storniert",
  };

  return labels[status] || status;
}

export function meta() {
  return [
    {
      title:
        "Einkaufsbestellungen · Gastario",
    },
  ];
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const url = new URL(request.url);
  const status = String(
    url.searchParams.get("status") || ""
  ).trim();

  const supplier = String(
    url.searchParams.get("supplier") || ""
  ).trim();

  const dateFrom = String(
    url.searchParams.get("dateFrom") || ""
  ).trim();

  const dateTo = String(
    url.searchParams.get("dateTo") || ""
  ).trim();

  const where: any = {
    tenantId: access.tenantId,
  };

  if (status) {
    where.status = status;
  }

  if (supplier) {
    where.supplierName = {
      contains: supplier,
      mode: "insensitive",
    };
  }

  if (dateFrom || dateTo) {
    where.planningDate = {};

    if (dateFrom) {
      where.planningDate.gte = new Date(
        `${dateFrom}T00:00:00.000Z`
      );
    }

    if (dateTo) {
      where.planningDate.lte = new Date(
        `${dateTo}T23:59:59.999Z`
      );
    }
  }

  const [drafts, supplierRows] =
    await Promise.all([
      prisma.procurementOrderDraft.findMany({
        where,
        include: {
          items: true,
        },
        orderBy: [
          {
            planningDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 500,
      }),
      prisma.procurementOrderDraft.findMany({
        where: {
          tenantId: access.tenantId,
        },
        distinct: ["supplierName"],
        select: {
          supplierName: true,
        },
        orderBy: {
          supplierName: "asc",
        },
      }),
    ]);

  const totalNetCents = drafts.reduce(
    (sum: number, draft: any) =>
      sum +
      Number(draft.netTotalCents || 0),
    0
  );

  const openCount = drafts.filter(
    (draft: any) =>
      draft.status !== "RECEIVED" &&
      draft.status !== "CANCELLED"
  ).length;

  const receivedCount = drafts.filter(
    (draft: any) =>
      draft.status === "RECEIVED"
  ).length;

  return {
    tenant: access.tenant,
    drafts,
    suppliers: supplierRows.map(
      (row: any) => row.supplierName
    ),
    filters: {
      status,
      supplier,
      dateFrom,
      dateTo,
    },
    stats: {
      count: drafts.length,
      openCount,
      receivedCount,
      totalNetCents,
    },
  };
}

export default function ProcurementOrdersPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PageShell className="procurementOrdersPage">
        <PageHeader
          eyebrow="Einkauf"
          title="Einkaufsbestellungen"
          subtitle={`Gespeicherte Lieferantenbestellungen für ${data.tenant.name}.`}
          actions={
            <Link
              className="procurementOrdersButton procurementOrdersButton--primary"
              to="/einkauf"
            >
              Neue Planung
            </Link>
          }
        />

        <MetricGrid>
          <MetricCard
            label="Bestellungen"
            value={data.stats.count}
          />
          <MetricCard
            label="Offen"
            value={data.stats.openCount}
          />
          <MetricCard
            label="Geliefert"
            value={data.stats.receivedCount}
          />
          <MetricCard
            label="Gesamtsumme netto"
            value={formatMoney(
              data.stats.totalNetCents
            )}
          />
        </MetricGrid>

        <PageSection
          eyebrow="Filter"
          title="Bestellungen durchsuchen"
          description="Nach Status, Lieferant und Planungstag filtern."
        >
          <Form
            method="get"
            className="procurementOrdersFilters"
          >
            <label>
              <span>Status</span>
              <select
                name="status"
                defaultValue={
                  data.filters.status
                }
              >
                <option value="">
                  Alle Status
                </option>
                <option value="DRAFT">
                  Entwurf
                </option>
                <option value="ORDERED">
                  Bestellt
                </option>
                <option value="PARTIALLY_RECEIVED">
                  Teilweise geliefert
                </option>
                <option value="RECEIVED">
                  Geliefert
                </option>
                <option value="CANCELLED">
                  Storniert
                </option>
              </select>
            </label>

            <label>
              <span>Lieferant</span>
              <select
                name="supplier"
                defaultValue={
                  data.filters.supplier
                }
              >
                <option value="">
                  Alle Lieferanten
                </option>
                {data.suppliers.map(
                  (supplier: string) => (
                    <option
                      value={supplier}
                      key={supplier}
                    >
                      {supplier}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>Von</span>
              <input
                type="date"
                name="dateFrom"
                defaultValue={
                  data.filters.dateFrom
                }
              />
            </label>

            <label>
              <span>Bis</span>
              <input
                type="date"
                name="dateTo"
                defaultValue={
                  data.filters.dateTo
                }
              />
            </label>

            <button
              type="submit"
              className="procurementOrdersButton procurementOrdersButton--primary"
            >
              Filtern
            </button>

            <Link
              className="procurementOrdersButton procurementOrdersButton--secondary"
              to="/einkaufsbestellungen"
            >
              Zurücksetzen
            </Link>
          </Form>
        </PageSection>

        <PageSection
          eyebrow="Übersicht"
          title="Lieferantenbestellungen"
          description={`${data.drafts.length} Bestellung(en) entsprechen den aktuellen Filtern.`}
        >
          {data.drafts.length === 0 ? (
            <div className="procurementOrdersEmpty">
              Keine Einkaufsbestellungen gefunden.
            </div>
          ) : (
            <div className="procurementOrdersTableWrap">
              <table className="procurementOrdersTable">
                <thead>
                  <tr>
                    <th>Planungstag</th>
                    <th>Lieferant</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Positionen</th>
                    <th className="isNumeric">
                      Netto
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.drafts.map(
                    (draft: any) => (
                      <tr key={draft.id}>
                        <td>
                          {formatDate(
                            draft.planningDate
                          )}
                        </td>
                        <td>
                          <strong>
                            {draft.supplierName}
                          </strong>
                        </td>
                        <td>
                          {draft.planType ===
                          "PRACTICAL"
                            ? "Praktisch"
                            : "Günstig"}
                        </td>
                        <td>
                          <span
                            className={[
                              "procurementOrdersStatus",
                              `procurementOrdersStatus--${String(
                                draft.status
                              ).toLowerCase()}`,
                            ].join(" ")}
                          >
                            {statusLabel(
                              draft.status
                            )}
                          </span>
                        </td>
                        <td>
                          {draft.items.length}
                        </td>
                        <td className="isNumeric">
                          {formatMoney(
                            draft.netTotalCents
                          )}
                        </td>
                        <td className="isAction">
                          <Link
                            to={`/einkaufsbestellungen/${draft.id}`}
                            className="procurementOrdersButton procurementOrdersButton--secondary"
                          >
                            Öffnen
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}