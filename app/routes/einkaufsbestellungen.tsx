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

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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

function buildSupplierBundles(
  drafts: any[]
) {
  const bundleMap = new Map<string, any>();

  for (const draft of drafts) {
    const bundleKey =
      draft.supplierId ||
      `name:${String(
        draft.supplierName
      ).toLocaleLowerCase("de-DE")}`;

    let bundle = bundleMap.get(bundleKey);

    if (!bundle) {
      bundle = {
        key: bundleKey,
        supplierId:
          draft.supplierId || null,
        supplierName:
          draft.supplierName,
        drafts: [],
        items: [],
        netTotalCents: 0,
        earliestPlanningDate:
          draft.planningDate,
        latestPlanningDate:
          draft.planningDate,
        totalPackages: 0,
        receivedPackages: 0,
      };

      bundleMap.set(bundleKey, bundle);
    }

    bundle.drafts.push(draft);
    bundle.netTotalCents += Number(
      draft.netTotalCents || 0
    );

    if (
      new Date(draft.planningDate) <
      new Date(
        bundle.earliestPlanningDate
      )
    ) {
      bundle.earliestPlanningDate =
        draft.planningDate;
    }

    if (
      new Date(draft.planningDate) >
      new Date(
        bundle.latestPlanningDate
      )
    ) {
      bundle.latestPlanningDate =
        draft.planningDate;
    }

    for (const item of draft.items) {
      bundle.totalPackages += Number(
        item.packageCount || 0
      );

      bundle.receivedPackages += Number(
        item.receivedPackageCount || 0
      );

      const itemKey = [
        item.catalogItemId || "",
        item.articleNumber || "",
        item.catalogItemName || "",
        item.baseUnit || "",
        item.netUnitPriceCents || 0,
      ].join("|");

      let bundledItem = bundle.items.find(
        (entry: any) =>
          entry.key === itemKey
      );

      if (!bundledItem) {
        bundledItem = {
          key: itemKey,
          catalogItemName:
            item.catalogItemName,
          articleNumber:
            item.articleNumber,
          baseUnit: item.baseUnit,
          packContent:
            item.packContent,
          netUnitPriceCents:
            item.netUnitPriceCents,
          packageCount: 0,
          receivedPackageCount: 0,
          netTotalCents: 0,
          ingredientNames: [],
          draftIds: [],
        };

        bundle.items.push(bundledItem);
      }

      bundledItem.packageCount += Number(
        item.packageCount || 0
      );

      bundledItem.receivedPackageCount +=
        Number(
          item.receivedPackageCount || 0
        );

      bundledItem.netTotalCents += Number(
        item.netTotalCents || 0
      );

      if (
        item.ingredientName &&
        !bundledItem.ingredientNames.includes(
          item.ingredientName
        )
      ) {
        bundledItem.ingredientNames.push(
          item.ingredientName
        );
      }

      if (
        !bundledItem.draftIds.includes(
          draft.id
        )
      ) {
        bundledItem.draftIds.push(
          draft.id
        );
      }
    }
  }

  return Array.from(bundleMap.values())
    .map((bundle: any) => ({
      ...bundle,
      items: bundle.items.sort(
        (a: any, b: any) =>
          String(
            a.catalogItemName
          ).localeCompare(
            String(
              b.catalogItemName
            ),
            "de"
          )
      ),
      percentage:
        bundle.totalPackages > 0
          ? Math.min(
              100,
              Math.round(
                (bundle.receivedPackages /
                  bundle.totalPackages) *
                  100
              )
            )
          : 0,
      draftIds: bundle.drafts.map(
        (draft: any) => draft.id
      ),
    }))
    .sort((a: any, b: any) => {
      const dateDifference =
        new Date(
          a.earliestPlanningDate
        ).getTime() -
        new Date(
          b.earliestPlanningDate
        ).getTime();

      if (dateDifference !== 0) {
        return dateDifference;
      }

      return String(
        a.supplierName
      ).localeCompare(
        String(b.supplierName),
        "de"
      );
    });
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

  const requestedView = String(
    url.searchParams.get("view") ||
      "worklist"
  ).trim();

  const view = [
    "worklist",
    "suppliers",
    "all",
  ].includes(requestedView)
    ? requestedView
    : "worklist";

  const where: any = {
    tenantId: access.tenantId,
  };

  if (
    view === "worklist" ||
    view === "suppliers"
  ) {
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
          new Date(
            `${dateFrom}T00:00:00`
          )
        );
    }

    if (dateTo) {
      where.planningDate.lte =
        endOfLocalDay(
          new Date(
            `${dateTo}T00:00:00`
          )
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
              view === "all"
                ? "desc"
                : "asc",
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

  const supplierBundles =
    buildSupplierBundles(enrichedDrafts);

  const totalNetCents =
    enrichedDrafts.reduce(
      (sum: number, draft: any) =>
        sum +
        Number(
          draft.netTotalCents || 0
        ),
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
    supplierBundles,
    bundleMailStatus: String(
      url.searchParams.get("bundleMail") || ""
    ),
    mailConfigured: Boolean(
      String(
        process.env.MAILJET_API_KEY || ""
      ).trim() &&
        String(
          process.env.MAILJET_SECRET_KEY || ""
        ).trim() &&
        String(
          process.env.MAILJET_FROM_EMAIL ||
            process.env.MAIL_FROM_EMAIL ||
            ""
        ).trim()
    ),
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
      supplierCount:
        supplierBundles.length,
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

  if (
    intent ===
    "send-supplier-bundle-email"
  ) {
    const bundleDraftIds = Array.from(
      new Set(
        String(
          formData.get("draftIds") || ""
        )
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    const recipientEmail = String(
      formData.get("recipientEmail") || ""
    ).trim();

    const recipientName = String(
      formData.get("recipientName") || ""
    ).trim();

    const subject = String(
      formData.get("emailSubject") || ""
    ).trim();

    const message = String(
      formData.get("emailMessage") || ""
    ).trim();

    if (
      bundleDraftIds.length === 0 ||
      !recipientEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        recipientEmail
      ) ||
      !subject
    ) {
      throw new Response(
        "Bitte Empfänger, Betreff und Bestellungen vollständig angeben.",
        {
          status: 400,
        }
      );
    }

    const bundleDrafts =
      await prisma.procurementOrderDraft.findMany({
        where: {
          tenantId: access.tenantId,
          id: {
            in: bundleDraftIds,
          },
          status: {
            in: [
              "DRAFT",
              "ORDERED",
              "PARTIALLY_RECEIVED",
            ],
          },
        },
        include: {
          items: true,
        },
      });

    if (
      bundleDrafts.length !==
      bundleDraftIds.length
    ) {
      throw new Response(
        "Mindestens eine Sammelbestellung wurde nicht gefunden oder ist nicht mehr offen.",
        {
          status: 409,
        }
      );
    }

    const supplierNames = Array.from(
      new Set(
        bundleDrafts.map(
          (draft: any) =>
            String(
              draft.supplierName
            ).trim()
        )
      )
    );

    if (supplierNames.length !== 1) {
      throw new Response(
        "Eine Sammelbestellung darf nur Bestellungen desselben Lieferanten enthalten.",
        {
          status: 409,
        }
      );
    }

    const itemMap = new Map<string, any>();

    for (const draft of bundleDrafts) {
      for (const item of draft.items) {
        const key = [
          item.catalogItemId || "",
          item.articleNumber || "",
          item.catalogItemName || "",
          item.baseUnit || "",
          item.netUnitPriceCents || 0,
        ].join("|");

        let merged = itemMap.get(key);

        if (!merged) {
          merged = {
            ingredientName:
              item.ingredientName,
            catalogItemName:
              item.catalogItemName,
            articleNumber:
              item.articleNumber,
            packageCount: 0,
            packContent:
              item.packContent,
            baseUnit: item.baseUnit,
            netUnitPriceCents:
              item.netUnitPriceCents,
            netTotalCents: 0,
          };

          itemMap.set(key, merged);
        }

        merged.packageCount += Number(
          item.packageCount || 0
        );

        merged.netTotalCents += Number(
          item.netTotalCents || 0
        );
      }
    }

    const planningDates =
      bundleDrafts.map(
        (draft: any) =>
          new Date(draft.planningDate)
      );

    const earliestPlanningDate =
      new Date(
        Math.min(
          ...planningDates.map(
            (date) => date.getTime()
          )
        )
      );

    const pseudoDraft = {
      supplierName: supplierNames[0],
      planningDate:
        earliestPlanningDate,
      planType: "PRACTICAL",
      status: "ORDERED",
      createdAt: new Date(),
      orderedAt: new Date(),
      receivedAt: null,
      netTotalCents:
        bundleDrafts.reduce(
          (
            sum: number,
            draft: any
          ) =>
            sum +
            Number(
              draft.netTotalCents || 0
            ),
          0
        ),
      items: Array.from(
        itemMap.values()
      ),
    };

    try {
      const {
        sendProcurementOrderEmail,
      } = await import(
        "../lib/procurement-order-mail.server"
      );

      const result =
        await sendProcurementOrderEmail({
          tenantName: access.tenant.name,
          replyTo:
            access.tenant.invoiceEmail ||
            null,
          recipientEmail,
          recipientName:
            recipientName ||
            supplierNames[0],
          subject,
          message,
          draft: pseudoDraft,
        });

      const sentAt = new Date();

      await prisma.$transaction([
        ...bundleDrafts.map(
          (draft: any) =>
            prisma.procurementOrderEmailLog.create({
              data: {
                tenantId:
                  access.tenantId,
                draftId: draft.id,
                recipient:
                  recipientEmail,
                subject,
                message,
                status: "SENT",
                messageId:
                  result.messageId ||
                  null,
              },
            })
        ),
        ...bundleDrafts.map(
          (draft: any) =>
            prisma.procurementOrderDraft.update({
              where: {
                id: draft.id,
              },
              data: {
                emailedAt: sentAt,
                emailedTo:
                  recipientEmail,
                emailSubject: subject,
                emailMessageId:
                  result.messageId ||
                  null,
                emailError: null,
                status:
                  draft.status ===
                  "DRAFT"
                    ? "ORDERED"
                    : draft.status,
                orderedAt:
                  draft.orderedAt ||
                  sentAt,
              },
            })
        ),
      ]);

      return redirect(
        "/einkaufsbestellungen?view=suppliers&bundleMail=sent"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Versandfehler.";

      await prisma.$transaction([
        ...bundleDrafts.map(
          (draft: any) =>
            prisma.procurementOrderEmailLog.create({
              data: {
                tenantId:
                  access.tenantId,
                draftId: draft.id,
                recipient:
                  recipientEmail,
                subject,
                message,
                status: "FAILED",
                error:
                  errorMessage.slice(
                    0,
                    1000
                  ),
              },
            })
        ),
        ...bundleDrafts.map(
          (draft: any) =>
            prisma.procurementOrderDraft.update({
              where: {
                id: draft.id,
              },
              data: {
                emailError:
                  errorMessage.slice(
                    0,
                    1000
                  ),
              },
            })
        ),
      ]);

      throw new Response(
        `Sammelbestellung konnte nicht versendet werden: ${errorMessage}`,
        {
          status: 502,
        }
      );
    }
  }

  let draftIds: string[] = [];

  if (intent === "mark-received") {
    const draftId = String(
      formData.get("draftId") || ""
    ).trim();

    if (draftId) {
      draftIds = [draftId];
    }
  }

  if (
    intent ===
    "mark-supplier-bundle-received"
  ) {
    draftIds = String(
      formData.get("draftIds") || ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  draftIds = Array.from(
    new Set(draftIds)
  );

  if (draftIds.length === 0) {
    throw new Response(
      "Ungültige Warenannahme-Aktion.",
      {
        status: 400,
      }
    );
  }

  const drafts =
    await prisma.procurementOrderDraft.findMany({
      where: {
        tenantId: access.tenantId,
        id: {
          in: draftIds,
        },
        status: {
          notIn: [
            "RECEIVED",
            "CANCELLED",
          ],
        },
      },
      include: {
        items: true,
      },
    });

  if (drafts.length !== draftIds.length) {
    throw new Response(
      "Mindestens eine Bestellung wurde nicht gefunden oder kann nicht abgeschlossen werden.",
      {
        status: 409,
      }
    );
  }

  const now = new Date();

  const itemUpdates = drafts.flatMap(
    (draft: any) =>
      draft.items.map((item: any) =>
        prisma.procurementOrderDraftItem.update({
          where: {
            id: item.id,
          },
          data: {
            receivedPackageCount:
              item.packageCount,
          },
        })
      )
  );

  const draftUpdates = drafts.map(
    (draft: any) =>
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
      })
  );

  await prisma.$transaction([
    ...itemUpdates,
    ...draftUpdates,
  ]);

  return redirect(
    intent ===
      "mark-supplier-bundle-received"
      ? "/einkaufsbestellungen?view=suppliers"
      : "/einkaufsbestellungen?view=worklist"
  );
}

export default function ProcurementOrdersPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PageShell className="procurementOrdersPage">
        {data.bundleMailStatus ===
        "sent" ? (
          <div className="procurementOrderNotice procurementOrderNotice--success">
            Die Sammelbestellung wurde erfolgreich mit PDF-Anhang versendet.
          </div>
        ) : null}
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
            to="/einkaufsbestellungen?view=suppliers"
            className={[
              "procurementOrdersViewTab",
              data.filters.view ===
              "suppliers"
                ? "isActive"
                : "",
            ].join(" ")}
          >
            Nach Lieferant
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
              "suppliers"
                ? "Lieferanten"
                : data.filters.view ===
                    "worklist"
                  ? "Offene Aufgaben"
                  : "Bestellungen"
            }
            value={
              data.filters.view ===
              "suppliers"
                ? data.stats.supplierCount
                : data.filters.view ===
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
                  data.filters.view !== "all"
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

        {data.filters.view ===
        "suppliers" ? (
          <PageSection
            eyebrow="Bündelung"
            title="Offene Bestellungen nach Lieferant"
            description="Mehrere Planungstage desselben Lieferanten werden zusammengefasst. Einzelbestellungen bleiben separat erhalten."
          >
            {data.supplierBundles.length ===
            0 ? (
              <div className="procurementOrdersEmpty">
                Keine offenen Lieferantenbestellungen gefunden.
              </div>
            ) : (
              <div className="procurementSupplierBundles">
                {data.supplierBundles.map(
                  (bundle: any) => (
                    <article
                      key={bundle.key}
                      className="procurementSupplierBundle"
                    >
                      <header className="procurementSupplierBundleHeader">
                        <div>
                          <span>
                            {bundle.drafts.length} Bestellung(en)
                          </span>
                          <h3>
                            {bundle.supplierName}
                          </h3>
                          <p>
                            Planung von{" "}
                            {formatDate(
                              bundle.earliestPlanningDate
                            )}{" "}
                            bis{" "}
                            {formatDate(
                              bundle.latestPlanningDate
                            )}
                          </p>
                        </div>

                        <strong>
                          {formatMoney(
                            bundle.netTotalCents
                          )}
                        </strong>
                      </header>

                      <div className="procurementOrdersProgressBlock">
                        <div className="procurementOrdersProgressHeader">
                          <span>
                            Gemeinsame Warenannahme
                          </span>
                          <strong>
                            {bundle.percentage} %
                          </strong>
                        </div>

                        <div className="procurementOrdersProgressTrack">
                          <span
                            style={{
                              width: `${bundle.percentage}%`,
                            }}
                          />
                        </div>

                        <small>
                          {formatNumber(
                            bundle.receivedPackages
                          )}{" "}
                          von{" "}
                          {formatNumber(
                            bundle.totalPackages
                          )}{" "}
                          Packungen erhalten
                        </small>
                      </div>

                      <div className="procurementSupplierBundleTableWrap">
                        <table className="procurementSupplierBundleTable">
                          <thead>
                            <tr>
                              <th>Artikel</th>
                              <th>Art.-Nr.</th>
                              <th>Gesamt</th>
                              <th>Erhalten</th>
                              <th>Netto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bundle.items.map(
                              (item: any) => (
                                <tr
                                  key={
                                    item.key
                                  }
                                >
                                  <td>
                                    <strong>
                                      {
                                        item.catalogItemName
                                      }
                                    </strong>
                                    <span>
                                      {item.ingredientNames.join(
                                        ", "
                                      )}
                                    </span>
                                  </td>
                                  <td>
                                    {item.articleNumber ||
                                      "–"}
                                  </td>
                                  <td>
                                    {formatNumber(
                                      item.packageCount
                                    )}{" "}
                                    Pack.
                                  </td>
                                  <td>
                                    {formatNumber(
                                      item.receivedPackageCount
                                    )}{" "}
                                    Pack.
                                  </td>
                                  <td>
                                    {formatMoney(
                                      item.netTotalCents
                                    )}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="procurementSupplierBundleDrafts">
                        {bundle.drafts.map(
                          (draft: any) => (
                            <Link
                              key={draft.id}
                              to={`/einkaufsbestellungen/${draft.id}`}
                            >
                              <span>
                                {formatDate(
                                  draft.planningDate
                                )}
                              </span>
                              <strong>
                                {statusLabel(
                                  draft.status
                                )}
                              </strong>
                            </Link>
                          )
                        )}
                      </div>

                      <div className="procurementSupplierBundleOrderBox">
                        <div className="procurementSupplierBundleOrderIntro">
                          <strong>
                            Sammelbestellung erstellen
                          </strong>
                          <span>
                            Gemeinsame PDF für alle oben aufgeführten Einzelbestellungen.
                          </span>
                        </div>

                        <a
                          className="procurementOrdersButton procurementOrdersButton--secondary"
                          href={`/einkaufsbestellungen/sammelbestellung/pdf?draftIds=${encodeURIComponent(
                            bundle.draftIds.join(
                              ","
                            )
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Sammel-PDF öffnen
                        </a>

                        <Form
                          method="post"
                          className="procurementSupplierBundleMailForm"
                        >
                          <input
                            type="hidden"
                            name="intent"
                            value="send-supplier-bundle-email"
                          />
                          <input
                            type="hidden"
                            name="draftIds"
                            value={bundle.draftIds.join(
                              ","
                            )}
                          />

                          <label>
                            <span>Empfänger</span>
                            <input
                              type="email"
                              name="recipientEmail"
                              placeholder="bestellung@lieferant.de"
                              required
                            />
                          </label>

                          <label>
                            <span>Ansprechpartner</span>
                            <input
                              name="recipientName"
                              defaultValue={
                                bundle.supplierName
                              }
                            />
                          </label>

                          <label className="procurementSupplierBundleMailWide">
                            <span>Betreff</span>
                            <input
                              name="emailSubject"
                              defaultValue={`Sammelbestellung ${bundle.supplierName} · ${formatDate(
                                bundle.earliestPlanningDate
                              )} bis ${formatDate(
                                bundle.latestPlanningDate
                              )}`}
                              required
                            />
                          </label>

                          <label className="procurementSupplierBundleMailWide">
                            <span>Nachricht</span>
                            <textarea
                              name="emailMessage"
                              rows={5}
                              defaultValue={[
                                "Guten Tag,",
                                "",
                                `anbei erhalten Sie unsere Sammelbestellung für den Zeitraum ${formatDate(
                                  bundle.earliestPlanningDate
                                )} bis ${formatDate(
                                  bundle.latestPlanningDate
                                )}.`,
                                "",
                                "Bitte bestätigen Sie uns kurz den Erhalt und die Liefermöglichkeit.",
                                "",
                                "Vielen Dank und freundliche Grüße",
                                data.tenant.name,
                              ].join("\n")}
                            />
                          </label>

                          <button
                            type="submit"
                            className="procurementOrdersButton procurementOrdersButton--primary"
                            disabled={
                              !data.mailConfigured
                            }
                          >
                            Sammelbestellung senden
                          </button>

                          {!data.mailConfigured ? (
                            <span className="procurementOrderMailWarning procurementSupplierBundleMailWide">
                              Mailjet ist noch nicht vollständig konfiguriert.
                            </span>
                          ) : null}
                        </Form>
                      </div>

                      <div className="procurementOrdersWorkActions">
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="mark-supplier-bundle-received"
                          />
                          <input
                            type="hidden"
                            name="draftIds"
                            value={bundle.draftIds.join(
                              ","
                            )}
                          />
                          <button
                            type="submit"
                            className="procurementOrdersButton procurementOrdersButton--primary"
                          >
                            Alle Bestellungen komplett erhalten
                          </button>
                        </Form>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </PageSection>
        ) : (
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
                          )}{" "}
                          netto
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
                            {
                              draft.progress
                                .percentage
                            }{" "}
                            %
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
                          {formatNumber(
                            draft.progress
                              .receivedPackages
                          )}{" "}
                          von{" "}
                          {formatNumber(
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
        )}
      </PageShell>
    </AppLayout>
  );
}