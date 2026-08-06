import {
  Form,
  Link,
  redirect,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
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

function formatDateTime(
  value: string | Date | null
) {
  if (!value) {
    return "–";
  }

  return new Date(value).toLocaleString(
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
        "Einkaufsbestellung · Gastario",
    },
  ];
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: {
    draftId?: string;
  };
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const draftId = String(
    params.draftId || ""
  ).trim();

  const draft =
    await prisma.procurementOrderDraft.findFirst({
      where: {
        id: draftId,
        tenantId: access.tenantId,
      },
      include: {
        items: {
          orderBy: {
            ingredientName: "asc",
          },
        },
      },
    });

  if (!draft) {
    throw new Response(
      "Einkaufsbestellung nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  return {
    tenant: access.tenant,
    draft,
  };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: {
    draftId?: string;
  };
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const draftId = String(
    params.draftId || ""
  ).trim();

  const formData = await request.formData();
  const statusRaw = String(
    formData.get("status") || ""
  ).trim();

  const allowedStatuses = new Set([
    "DRAFT",
    "ORDERED",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CANCELLED",
  ]);

  if (!allowedStatuses.has(statusRaw)) {
    throw new Response(
      "Ungültiger Status.",
      {
        status: 400,
      }
    );
  }

  const draft =
    await prisma.procurementOrderDraft.findFirst({
      where: {
        id: draftId,
        tenantId: access.tenantId,
      },
      include: {
        items: true,
      },
    });

  if (!draft) {
    throw new Response(
      "Einkaufsbestellung nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  const updates = draft.items.map(
    (item: any) => {
      const packageCount = Number(
        String(
          formData.get(
            `packageCount_${item.id}`
          ) ?? item.packageCount
        ).replace(",", ".")
      );

      const receivedPackageCount = Number(
        String(
          formData.get(
            `receivedPackageCount_${item.id}`
          ) ?? item.receivedPackageCount
        ).replace(",", ".")
      );

      if (
        !Number.isFinite(packageCount) ||
        packageCount <= 0 ||
        !Number.isFinite(
          receivedPackageCount
        ) ||
        receivedPackageCount < 0 ||
        receivedPackageCount > packageCount
      ) {
        throw new Response(
          `Ungültige Menge bei ${item.ingredientName}.`,
          {
            status: 400,
          }
        );
      }

      return {
        id: item.id,
        packageCount,
        receivedPackageCount,
        netTotalCents: Math.round(
          packageCount *
            Number(
              item.netUnitPriceCents || 0
            )
        ),
      };
    }
  );

  const allReceived =
    updates.length > 0 &&
    updates.every(
      (item: any) =>
        item.receivedPackageCount >=
        item.packageCount
    );

  const anyReceived = updates.some(
    (item: any) =>
      item.receivedPackageCount > 0
  );

  let resolvedStatus = statusRaw;

  if (
    statusRaw !== "DRAFT" &&
    statusRaw !== "CANCELLED"
  ) {
    if (allReceived) {
      resolvedStatus = "RECEIVED";
    } else if (anyReceived) {
      resolvedStatus =
        "PARTIALLY_RECEIVED";
    } else if (
      statusRaw === "RECEIVED" ||
      statusRaw ===
        "PARTIALLY_RECEIVED"
    ) {
      resolvedStatus = "ORDERED";
    }
  }

  const now = new Date();

  await prisma.$transaction([
    ...updates.map((item: any) =>
      prisma.procurementOrderDraftItem.update({
        where: {
          id: item.id,
        },
        data: {
          packageCount:
            item.packageCount,
          receivedPackageCount:
            item.receivedPackageCount,
          netTotalCents:
            item.netTotalCents,
        },
      })
    ),
    prisma.procurementOrderDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        status: resolvedStatus,
        netTotalCents: updates.reduce(
          (sum: number, item: any) =>
            sum +
            item.netTotalCents,
          0
        ),
        orderedAt:
          resolvedStatus === "ORDERED" ||
          resolvedStatus ===
            "PARTIALLY_RECEIVED" ||
          resolvedStatus === "RECEIVED"
            ? draft.orderedAt || now
            : null,
        receivedAt:
          resolvedStatus === "RECEIVED"
            ? draft.receivedAt || now
            : null,
      },
    }),
  ]);

  return redirect(
    `/einkaufsbestellungen/${draft.id}`
  );
}

export default function ProcurementOrderDetailPage() {
  const data = useLoaderData<typeof loader>();
  const draft = data.draft;

  return (
    <AppLayout>
      <PageShell className="procurementOrderDetailPage">
        <PageHeader
          eyebrow="Einkaufsbestellung"
          title={draft.supplierName}
          subtitle={`Planungstag ${formatDate(
            draft.planningDate
          )} · ${statusLabel(
            draft.status
          )}`}
          actions={
            <>
              <a
                className="procurementOrdersButton procurementOrdersButton--primary"
                href={`/einkaufsbestellungen/${draft.id}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                PDF herunterladen
              </a>

              <button
                type="button"
                className="procurementOrdersButton procurementOrdersButton--secondary"
                onClick={() =>
                  window.print()
                }
              >
                Drucken
              </button>

              <Link
                className="procurementOrdersButton procurementOrdersButton--secondary"
                to="/einkaufsbestellungen"
              >
                Zur Übersicht
              </Link>
            </>
          }
        />

        <PageSection
          eyebrow="Bestelldaten"
          title="Lieferantenbestellung"
          description="Bestellmengen, Liefermengen und Status verwalten."
        >
          <div className="procurementOrderFacts">
            <div>
              <span>Planungstag</span>
              <strong>
                {formatDate(
                  draft.planningDate
                )}
              </strong>
            </div>
            <div>
              <span>Planart</span>
              <strong>
                {draft.planType ===
                "PRACTICAL"
                  ? "Praktischer Plan"
                  : "Günstigster Plan"}
              </strong>
            </div>
            <div>
              <span>Bestellt am</span>
              <strong>
                {formatDateTime(
                  draft.orderedAt
                )}
              </strong>
            </div>
            <div>
              <span>Geliefert am</span>
              <strong>
                {formatDateTime(
                  draft.receivedAt
                )}
              </strong>
            </div>
            <div>
              <span>Gesamtsumme netto</span>
              <strong>
                {formatMoney(
                  draft.netTotalCents
                )}
              </strong>
            </div>
          </div>
        </PageSection>

        <PageSection
          eyebrow="Positionen"
          title="Bestellpositionen"
          description={`${draft.items.length} Position(en) bei ${draft.supplierName}.`}
        >
          <Form
            method="post"
            className="procurementOrderDetailForm"
          >
            <div className="procurementOrderStatusBar">
              <label>
                <span>Status</span>
                <select
                  name="status"
                  defaultValue={
                    draft.status
                  }
                >
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

              <button
                type="submit"
                className="procurementOrdersButton procurementOrdersButton--primary"
              >
                Änderungen speichern
              </button>
            </div>

            <div className="procurementOrderDetailTableWrap">
              <table className="procurementOrderDetailTable">
                <thead>
                  <tr>
                    <th>Zutat / Artikel</th>
                    <th>Artikelnummer</th>
                    <th>Bestellt</th>
                    <th>Geliefert</th>
                    <th>Einzelpreis</th>
                    <th>Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map(
                    (item: any) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.ingredientName}
                          </strong>
                          <span>
                            {item.catalogItemName}
                          </span>
                        </td>
                        <td>
                          {item.articleNumber ||
                            "–"}
                        </td>
                        <td>
                          <input
                            type="number"
                            name={`packageCount_${item.id}`}
                            min="0.01"
                            step="0.01"
                            defaultValue={
                              item.packageCount
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            name={`receivedPackageCount_${item.id}`}
                            min="0"
                            step="0.01"
                            max={
                              item.packageCount
                            }
                            defaultValue={
                              item.receivedPackageCount
                            }
                          />
                        </td>
                        <td>
                          {formatMoney(
                            item.netUnitPriceCents
                          )}
                        </td>
                        <td>
                          <strong>
                            {formatMoney(
                              item.netTotalCents
                            )}
                          </strong>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Form>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}