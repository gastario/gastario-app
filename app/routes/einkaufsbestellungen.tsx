import {
  Form,
  Link,
  redirect,
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

function getReceiptProgress(draft: any) {
  const totalPackages = draft.items.reduce(
    (sum: number, item: any) =>
      sum + Number(item.packageCount || 0),
    0
  );

  const receivedPackages = draft.items.reduce(
    (sum: number, item: any) =>
      sum +
      Number(
        item.receivedPackageCount || 0
      ),
    0
  );

  const percentage =
    totalPackages > 0
      ? Math.min(
          100,
          Math.round(
            (receivedPackages /
              totalPackages) *
              100
          )
        )
      : 0;

  return {
    totalPackages,
    receivedPackages,
    percentage,
  };
}

function startOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
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

  const view = String(
    url.searchParams.get("view") || "worklist"
  ).trim();

  const where: any = {
    tenantId: access.tenantId,
  };

  if (view === "worklist") {
    where.status = {
      in: [
        "DRAFT",
        "ORDERED",
        "PARTIALLY_RECEIVED",
      ],
    };
  } else if (status) {
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
      where.planningDate.gte =
        startOfLocalDay(
          new Date(`${dateFrom}T00:00:00`)
        );
    }

    if (dateTo) {
      where.planningDate.lte =
        endOfLocalDay(
          new Date(`${dateTo}T00:00:00`)
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
            planningDate:
              view === "worklist"
                ? "asc"
                : "desc",
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

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);

  const enrichedDrafts = drafts.map(
    (draft: any) => {
      const progress =
        getReceiptProgress(draft);

      const planningDate = new Date(
        draft.planningDate
      );

      const isToday =
        planningDate >= todayStart &&
        planningDate <= todayEnd;

      const isOverdue =
        planningDate < todayStart &&
        draft.status !== "RECEIVED" &&
        draft.status !== "CANCELLED";

      return {
        ...draft,
        progress,
        isToday,
        isOverdue,
      };
    }
  );

  const totalNetCents =
    enrichedDrafts.reduce(
      (sum: number, draft: any) =>
        sum +
        Number(draft.netTotalCents || 0),
      0
    );

  const openCount =
    enrichedDrafts.filter(
      (draft: any) =>
        draft.status !== "RECEIVED" &&
        draft.status !== "CANCELLED"
    ).length;

  const receivedCount =
    enrichedDrafts.filter(
      (draft: any) =>
        draft.status === "RECEIVED"
    ).length;

  const dueTodayCount =
    enrichedDrafts.filter(
      (draft: any) => draft.isToday
    ).length;

  const overdueCount =
    enrichedDrafts.filter(
      (draft: any) => draft.isOverdue
    ).length;

  return {
    tenant: access.tenant,
    drafts: enrichedDrafts,
    suppliers: supplierRows.map(
      (row: any) => row.supplierName
    ),
    filters: {
      status,
      supplier,
      dateFrom,
      dateTo,
      view,
    },
    stats: {
      count: enrichedDrafts.length,
      openCount,
      receivedCount,
      dueTodayCount,
      overdueCount,
      totalNetCents,
    },
  };
}

export async function action({
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

  const formData = await request.formData();

  const intent = String(
    formData.get("intent") || ""
  ).trim();

  const draftId = String(
    formData.get("draftId") || ""
  ).trim();

  if (
    intent !== "mark-received" ||
    !draftId
  ) {
    throw new Response(
      "Ungültige Aktion.",
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

  const now = new Date();

  await prisma.$transaction([
    ...draft.items.map((item: any) =>
      prisma.procurementOrderDraftItem.update({
        where: {
          id: item.id,
        },
        data: {
          receivedPackageCount:
            item.packageCount,
        },
      })
    ),
    prisma.procurementOrderDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        status: "RECEIVED",
        receivedAt: now,
        orderedAt:
          draft.orderedAt || now,
      },
    }),
  ]);

  const returnUrl = new URL(request.url);
  returnUrl.search = "";

  return redirect(
    "/einkaufsbestellungen?view=worklist"
  );
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

        <div className="procurementOrdersViewSwitch">
          <Link
            to="/einkaufsbestellungen?view=worklist"
            className={[
              "procurementOrdersViewTab",
              data.filters.view ===
              "worklist"
                ? "isActive"
                : "",
            ].join(" ")}
          >
            Tagesarbeitsliste
          </Link>

          <Link
            to="/einkaufsbestellungen?view=all"
            className={[
              "procurementOrdersViewTab",
              data.filters.view === "all"
                ? "isActive"
                : "",
            ].join(" ")}
          >
            Alle Bestellungen
          </Link>
        </div>

        <MetricGrid>
          <MetricCard
            label={
              data.filters.view ===
              "worklist"
                ? "Offene Aufgaben"
                : "Bestellungen"
            }
            value={
              data.filters.view ===
              "worklist"
                ? data.stats.openCount
                : data.stats.count
            }
          />
          <MetricCard
            label="Heute fällig"
            value={data.stats.dueTodayCount}
          />
          <MetricCard
            label="Überfällig"
            value={data.stats.overdueCount}
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
            <input
              type="hidden"
              name="view"
              value={data.filters.view}
            />

            <label>
              <span>Status</span>
              <select
                name="status"
                defaultValue={
                  data.filters.status
                }
                disabled={
                  data.filters.view ===
                  "worklist"
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
              to={`/einkaufsbestellungen?view=${data.filters.view}`}
            >
              Zurücksetzen
            </Link>
          </Form>
        </PageSection>

        <PageSection
          eyebrow={
            data.filters.view ===
            "worklist"
              ? "Arbeitsliste"
              : "Übersicht"
          }
          title={
            data.filters.view ===
            "worklist"
              ? "Offene Einkaufsbestellungen"
              : "Lieferantenbestellungen"
          }
          description={
            data.filters.view ===
            "worklist"
              ? "Nach Planungstag sortiert. Überfällige Bestellungen stehen zuerst."
              : `${data.drafts.length} Bestellung(en) entsprechen den aktuellen Filtern.`
          }
        >
          {data.drafts.length === 0 ? (
            <div className="procurementOrdersEmpty">
              Keine Einkaufsbestellungen gefunden.
            </div>
          ) : (
            <div className="procurementOrdersWorklist">
              {data.drafts.map(
                (draft: any) => (
                  <article
                    key={draft.id}
                    className={[
                      "procurementOrdersWorkCard",
                      draft.isOverdue
                        ? "isOverdue"
                        : "",
                      draft.isToday
                        ? "isToday"
                        : "",
                    ].join(" ")}
                  >
                    <div className="procurementOrdersWorkCardHeader">
                      <div>
                        <span className="procurementOrdersWorkDate">
                          {formatDate(
                            draft.planningDate
                          )}
                        </span>
                        <strong>
                          {draft.supplierName}
                        </strong>
                      </div>

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
                    </div>

                    <div className="procurementOrdersWorkMeta">
                      <span>
                        {draft.items.length} Position(en)
                      </span>
                      <span>
                        {formatMoney(
                          draft.netTotalCents
                        )} netto
                      </span>
                      {draft.isOverdue ? (
                        <span className="procurementOrdersDue procurementOrdersDue--overdue">
                          Überfällig
                        </span>
                      ) : draft.isToday ? (
                        <span className="procurementOrdersDue procurementOrdersDue--today">
                          Heute fällig
                        </span>
                      ) : null}
                    </div>

                    <div className="procurementOrdersProgressBlock">
                      <div className="procurementOrdersProgressHeader">
                        <span>
                          Warenannahme
                        </span>
                        <strong>
                          {draft.progress.percentage} %
                        </strong>
                      </div>

                      <div className="procurementOrdersProgressTrack">
                        <span
                          style={{
                            width: `${draft.progress.percentage}%`,
                          }}
                        />
                      </div>

                      <small>
                        {new Intl.NumberFormat(
                          "de-DE",
                          {
                            maximumFractionDigits: 2,
                          }
                        ).format(
                          draft.progress
                            .receivedPackages
                        )}{" "}
                        von{" "}
                        {new Intl.NumberFormat(
                          "de-DE",
                          {
                            maximumFractionDigits: 2,
                          }
                        ).format(
                          draft.progress
                            .totalPackages
                        )}{" "}
                        Packungen erhalten
                      </small>
                    </div>

                    <div className="procurementOrdersWorkActions">
                      <Link
                        to={`/einkaufsbestellungen/${draft.id}`}
                        className="procurementOrdersButton procurementOrdersButton--secondary"
                      >
                        Öffnen
                      </Link>

                      {draft.status !==
                        "RECEIVED" &&
                      draft.status !==
                        "CANCELLED" ? (
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="mark-received"
                          />
                          <input
                            type="hidden"
                            name="draftId"
                            value={draft.id}
                          />
                          <button
                            type="submit"
                            className="procurementOrdersButton procurementOrdersButton--primary"
                          >
                            Komplett erhalten
                          </button>
                        </Form>
                      ) : null}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}