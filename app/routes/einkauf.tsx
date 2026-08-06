import { Form, Link, redirect, useLoaderData } from "react-router";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-page-shell.css";
import "../styles/gastario-procurement.css";

const PURCHASING_STATUSES = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "PACKING_OPEN",
] as const;

function todayInput() {
  const now = new Date();

  const localDate = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60_000
  );

  return localDate
    .toISOString()
    .slice(0, 10);
}

function normalizeDate(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDateOption(value: string) {
  if (value === "ohne-datum") {
    return "Ohne Datum";
  }

  return new Date(
    `${value}T00:00:00`
  ).toLocaleDateString("de-DE");
}

function formatQty(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
}

function formatPriceAge(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Zeitpunkt unbekannt";
  }

  return date.toLocaleString("de-DE");
}
/*
 * gastario-procurement-export-v1-20260804
 */

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "");

  if (
    text.includes(";") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildProcurementCsv(params: {
  plan: any;
  selectedDate: string;
  planLabel: string;
}) {
  const { plan, selectedDate, planLabel } = params;

  const rows = [
    [
      "Plan",
      "Planungstag",
      "Lieferant",
      "Zutat",
      "Lieferantenartikel",
      "Artikelnummer",
      "Packungen",
      "Packungsinhalt",
      "Basiseinheit",
      "Einzelpreis netto",
      "Gesamt netto",
    ],
  ];

  for (const group of plan.groups || []) {
    for (const item of group.items || []) {
      rows.push([
        planLabel,
        selectedDate,
        group.supplierName,
        item.ingredientName,
        item.catalogItemName,
        item.articleNumber || "",
        String(item.packageCount ?? ""),
        String(item.packContent ?? ""),
        item.baseUnit || "",
        (
          Number(item.netUnitPriceCents || 0) /
          100
        )
          .toFixed(2)
          .replace(".", ","),
        (
          Number(item.netTotalCents || 0) /
          100
        )
          .toFixed(2)
          .replace(".", ","),
      ]);
    }
  }

  return rows
    .map((row) =>
      row.map(escapeCsvValue).join(";")
    )
    .join("\r\n");
}

function downloadProcurementCsv(params: {
  plan: any;
  selectedDate: string;
  planLabel: string;
  fileSuffix: string;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const csv = buildProcurementCsv(params);
  const blob = new Blob(
    [`\uFEFF${csv}`],
    {
      type: "text/csv;charset=utf-8",
    }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = [
    "gastario-einkauf",
    params.selectedDate,
    params.fileSuffix,
  ].join("-") + ".csv";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
/*
 * gastario-procurement-draft-management-v1-20260804
 */

function procurementDraftStatusLabel(
  status: string
) {
  const labels: Record<string, string> = {
    DRAFT: "Entwurf",
    ORDERED: "Bestellt",
    PARTIALLY_RECEIVED: "Teilweise geliefert",
    RECEIVED: "Geliefert",
    CANCELLED: "Storniert",
  };

  return labels[status] || status;
}
function effectiveOperationalArea(item: any) {
  return String(
    item?.operationalArea ||
      item?.product?.operationalArea ||
      "REVIEW"
  ).toUpperCase();
}

function effectiveOperationalQuantity(item: any) {
  const value = Number(
    item?.operationalQuantity ??
      item?.quantity ??
      0
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function effectiveOperationalUnit(item: any) {
  return String(
    item?.operationalUnit ||
      item?.product?.unit ||
      item?.unit ||
      "Stueck"
  ).trim();
}

/*
 * gastario-procurement-ingredient-mapping-v1-20260803
 * Manuelle und nachvollziehbare Zuordnung von Zutaten
 * zu echten Lieferantenartikeln.
 */
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

  const returnDate = String(
    formData.get("returnDate") || ""
  ).trim();

  const redirectTarget = returnDate
    ? `/einkauf?date=${encodeURIComponent(
        returnDate
      )}#ingredient-mapping`
    : "/einkauf#ingredient-mapping";

  /*
   * gastario-procurement-draft-save-v1-20260804
   */
  if (intent === "save-procurement-drafts") {
    const selectedDate = String(
      formData.get("selectedDate") || ""
    ).trim();

    const planTypeRaw = String(
      formData.get("planType") || ""
    ).trim();

    const groupsJson = String(
      formData.get("groupsJson") || ""
    ).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
    ) {
      throw new Response(
        "Ungültiger Planungstag.",
        {
          status: 400,
        }
      );
    }

    if (
      planTypeRaw !== "CHEAPEST" &&
      planTypeRaw !== "PRACTICAL"
    ) {
      throw new Response(
        "Ungültige Planart.",
        {
          status: 400,
        }
      );
    }

    let groups: any[] = [];

    try {
      groups = JSON.parse(groupsJson);
    } catch {
      throw new Response(
        "Der Einkaufsplan konnte nicht gelesen werden.",
        {
          status: 400,
        }
      );
    }

    if (
      !Array.isArray(groups) ||
      groups.length === 0
    ) {
      throw new Response(
        "Der Einkaufsplan enthält keine Lieferanten.",
        {
          status: 400,
        }
      );
    }

    const planningDate = new Date(
      `${selectedDate}T00:00:00.000Z`
    );

    const existingDraftCount =
      await prisma.procurementOrderDraft.count({
        where: {
          tenantId: access.tenantId,
          planningDate,
          planType: planTypeRaw,
          status: {
            not: "CANCELLED",
          },
        },
      });

    if (existingDraftCount > 0) {
      return redirect(
        `/einkauf?date=${encodeURIComponent(
          selectedDate
        )}&draft=exists#saved-procurement-drafts`
      );
    }

    const catalogItemIds = Array.from(
      new Set(
        groups.flatMap((group: any) =>
          Array.isArray(group?.items)
            ? group.items
                .map(
                  (item: any) =>
                    item?.catalogItemId
                )
                .filter(Boolean)
            : []
        )
      )
    );

    const validCatalogItems =
      catalogItemIds.length > 0
        ? await prisma.supplierCatalogItem.findMany({
            where: {
              tenantId: access.tenantId,
              id: {
                in: catalogItemIds,
              },
              active: true,
            },
            select: {
              id: true,
              supplierId: true,
              supplier: {
                select: {
                  name: true,
                },
              },
            },
          })
        : [];

    const catalogItemMap = new Map(
      validCatalogItems.map((item: any) => [
        item.id,
        item,
      ])
    );

    const sanitizedGroups = groups
      .map((group: any) => {
        const items = Array.isArray(group?.items)
          ? group.items
              .map((item: any) => {
                const catalogItem =
                  catalogItemMap.get(
                    item?.catalogItemId
                  );

                if (!catalogItem) {
                  return null;
                }

                const packageCount = Number(
                  item?.packageCount || 0
                );

                const packContent = Number(
                  item?.packContent || 0
                );

                const netUnitPriceCents =
                  Math.max(
                    0,
                    Math.round(
                      Number(
                        item?.netUnitPriceCents ||
                          0
                      )
                    )
                  );

                const netTotalCents =
                  Math.max(
                    0,
                    Math.round(
                      Number(
                        item?.netTotalCents || 0
                      )
                    )
                  );

                if (
                  !Number.isFinite(packageCount) ||
                  packageCount <= 0 ||
                  !Number.isFinite(packContent) ||
                  packContent < 0
                ) {
                  return null;
                }

                return {
                  catalogItemId:
                    catalogItem.id,
                  ingredientName: String(
                    item?.ingredientName || ""
                  ).trim(),
                  catalogItemName: String(
                    item?.catalogItemName || ""
                  ).trim(),
                  articleNumber:
                    item?.articleNumber
                      ? String(
                          item.articleNumber
                        ).trim()
                      : null,
                  packageCount,
                  packContent:
                    packContent > 0
                      ? packContent
                      : null,
                  baseUnit:
                    item?.baseUnit
                      ? String(
                          item.baseUnit
                        ).trim()
                      : null,
                  netUnitPriceCents,
                  netTotalCents,
                };
              })
              .filter(Boolean)
          : [];

        if (items.length === 0) {
          return null;
        }

        const firstCatalogItem =
          catalogItemMap.get(
            items[0].catalogItemId
          );

        return {
          supplierId:
            firstCatalogItem?.supplierId ||
            null,
          supplierName:
            firstCatalogItem?.supplier
              ?.name ||
            String(
              group?.supplierName ||
                "Unbekannter Lieferant"
            ).trim(),
          netTotalCents: items.reduce(
            (sum: number, item: any) =>
              sum +
              Number(
                item.netTotalCents || 0
              ),
            0
          ),
          items,
        };
      })
      .filter(Boolean);

    if (sanitizedGroups.length === 0) {
      throw new Response(
        "Es konnten keine gültigen Bestellpositionen übernommen werden.",
        {
          status: 400,
        }
      );
    }

    await prisma.$transaction(
      sanitizedGroups.map((group: any) =>
        prisma.procurementOrderDraft.create({
          data: {
            tenantId: access.tenantId,
            supplierId: group.supplierId,
            supplierName:
              group.supplierName,
            planningDate,
            planType: planTypeRaw,
            status: "DRAFT",
            netTotalCents:
              group.netTotalCents,
            items: {
              create: group.items.map(
                (item: any) => ({
                  tenantId:
                    access.tenantId,
                  catalogItemId:
                    item.catalogItemId,
                  ingredientName:
                    item.ingredientName,
                  catalogItemName:
                    item.catalogItemName,
                  articleNumber:
                    item.articleNumber,
                  packageCount:
                    item.packageCount,
                  packContent:
                    item.packContent,
                  baseUnit:
                    item.baseUnit,
                  netUnitPriceCents:
                    item.netUnitPriceCents,
                  netTotalCents:
                    item.netTotalCents,
                })
              ),
            },
          },
        })
      )
    );

    return redirect(
      `/einkauf?date=${encodeURIComponent(
        selectedDate
      )}&draft=created#saved-procurement-drafts`
    );
  }
  if (intent === "update-procurement-draft") {
    const draftId = String(
      formData.get("draftId") || ""
    ).trim();

    const selectedDate = String(
      formData.get("selectedDate") || ""
    ).trim();

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

    if (
      !draftId ||
      !allowedStatuses.has(statusRaw)
    ) {
      throw new Response(
        "Ungültiger Bestellentwurf oder Status.",
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
        "Bestellentwurf wurde nicht gefunden.",
        {
          status: 404,
        }
      );
    }

    const itemUpdates: any[] = [];

    for (const item of draft.items) {
      const packageCountRaw = String(
        formData.get(
          `packageCount_${item.id}`
        ) || item.packageCount
      )
        .trim()
        .replace(",", ".");

      const receivedCountRaw = String(
        formData.get(
          `receivedPackageCount_${item.id}`
        ) || item.receivedPackageCount
      )
        .trim()
        .replace(",", ".");

      const packageCount = Number(
        packageCountRaw
      );

      const receivedPackageCount = Number(
        receivedCountRaw
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

      const netTotalCents = Math.round(
        packageCount *
          Number(
            item.netUnitPriceCents || 0
          )
      );

      itemUpdates.push({
        id: item.id,
        packageCount,
        receivedPackageCount,
        netTotalCents,
      });
    }

    const allReceived =
      itemUpdates.length > 0 &&
      itemUpdates.every(
        (item) =>
          item.receivedPackageCount >=
          item.packageCount
      );

    const anyReceived = itemUpdates.some(
      (item) =>
        item.receivedPackageCount > 0
    );

    let resolvedStatus = statusRaw;

    if (
      statusRaw !== "CANCELLED" &&
      statusRaw !== "DRAFT"
    ) {
      if (allReceived) {
        resolvedStatus = "RECEIVED";
      } else if (anyReceived) {
        resolvedStatus =
          "PARTIALLY_RECEIVED";
      } else if (
        statusRaw ===
        "PARTIALLY_RECEIVED" ||
        statusRaw === "RECEIVED"
      ) {
        resolvedStatus = "ORDERED";
      }
    }

    const now = new Date();

    await prisma.$transaction([
      ...itemUpdates.map((item) =>
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
          netTotalCents:
            itemUpdates.reduce(
              (sum, item) =>
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
      `/einkauf?date=${encodeURIComponent(
        selectedDate
      )}&draft=updated#saved-procurement-drafts`
    );
  }
  if (intent === "save-ingredient-match") {
    const ingredientId = String(
      formData.get("ingredientId") || ""
    ).trim();

    const catalogItemId = String(
      formData.get("catalogItemId") || ""
    ).trim();

    const preferred =
      String(
        formData.get("preferred") || ""
      ) === "true";

    if (!ingredientId || !catalogItemId) {
      throw new Response(
        "Zutat und Lieferantenartikel sind erforderlich.",
        {
          status: 400,
        }
      );
    }

    const [ingredient, catalogItem] =
      await Promise.all([
        prisma.procurementIngredient.findFirst({
          where: {
            id: ingredientId,
            tenantId: access.tenantId,
            active: true,
          },
        }),
        prisma.supplierCatalogItem.findFirst({
          where: {
            id: catalogItemId,
            tenantId: access.tenantId,
            active: true,
          },
        }),
      ]);

    if (!ingredient || !catalogItem) {
      throw new Response(
        "Zutat oder Lieferantenartikel wurde nicht gefunden.",
        {
          status: 404,
        }
      );
    }

    if (preferred) {
      await prisma.procurementIngredientMatch.updateMany({
        where: {
          tenantId: access.tenantId,
          ingredientId,
        },
        data: {
          preferred: false,
        },
      });
    }

    await prisma.procurementIngredientMatch.upsert({
      where: {
        ingredientId_catalogItemId: {
          ingredientId,
          catalogItemId,
        },
      },
      update: {
        active: true,
        preferred,
        method: "MANUAL",
        confidence: 100,
      },
      create: {
        tenantId: access.tenantId,
        ingredientId,
        catalogItemId,
        active: true,
        preferred,
        method: "MANUAL",
        confidence: 100,
      },
    });

    return redirect(redirectTarget);
  }

  if (intent === "remove-ingredient-match") {
    const matchId = String(
      formData.get("matchId") || ""
    ).trim();

    if (!matchId) {
      throw new Response(
        "Zuordnung fehlt.",
        {
          status: 400,
        }
      );
    }

    await prisma.procurementIngredientMatch.updateMany({
      where: {
        id: matchId,
        tenantId: access.tenantId,
      },
      data: {
        active: false,
        preferred: false,
      },
    });

    return redirect(redirectTarget);
  }

  throw new Response(
    "Unbekannte Aktion.",
    {
      status: 400,
    }
  );
}
export function meta() {
  return [{ title: "Einkaufsplanung · Gastario" }];
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

  const selectedDate =
    url.searchParams.get("date") ||
    todayInput();

  /*
   * gastario-purchasing-masterdesign-v1-20260802
   *
   * deliveryTimeText ist das echte Order-Feld.
   * Die bisherige Abfrage auf deliveryTime verursachte
   * den Laufzeitfehler der Einkaufsseite.
   */
  const orders = await prisma.order.findMany({
    where: {
      tenantId: access.tenantId,
      status: {
        in: [...PURCHASING_STATUSES] as any,
      },
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              recipeItems: true,
            },
          },
        },
      },
      customer: true,
    },
    orderBy: [
      { deliveryDate: "asc" },
      { deliveryTimeText: "asc" },
      { createdAt: "desc" },
    ],
    take: 500,
  });

  /*
   * gastario-automatic-product-assignment-v1-20260806
   *
   * Wiederkehrende Plattformnamen, eindeutige Produktnamen und
   * Servicepositionen werden vor der Bedarfsberechnung automatisch
   * operativ eingeordnet. Nur unsichere Treffer bleiben auf REVIEW.
   */
  const {
    automaticallyAssignOrderItems,
  } = await import(
    "../lib/automatic-product-assignment.server"
  );

  const automaticAssignmentResult =
    await automaticallyAssignOrderItems({
      prisma,
      tenantId: access.tenantId,
      orders: orders as any[],
    });

  const availableDates = Array.from(
    new Set(
      (orders as any[])
        .map((order) =>
          order.deliveryDate
            ? normalizeDate(order.deliveryDate)
            : "ohne-datum"
        )
        .filter(Boolean)
    )
  ).sort();

  if (!availableDates.includes(selectedDate)) {
    availableDates.unshift(selectedDate);
  }

  const filteredOrders = (orders as any[]).filter(
    (order) => {
      if (!order.deliveryDate) {
        return selectedDate === "ohne-datum";
      }

      return (
        normalizeDate(order.deliveryDate) ===
        selectedDate
      );
    }
  );

  const demandMap = new Map<string, any>();
  const missingMap = new Map<string, any>();

  for (const order of filteredOrders) {
    for (const orderItem of order.items || []) {
      const area =
        effectiveOperationalArea(orderItem);

      if (
        area === "PACKING" ||
        area === "LOGISTICS" ||
        area === "NON_OPERATIONAL"
      ) {
        continue;
      }

      const product = orderItem.product;
      const orderQty =
        effectiveOperationalQuantity(orderItem);

      const productName = String(
        product?.name ||
          orderItem.name ||
          "Unbekannte Position"
      ).trim();

      const unit =
        effectiveOperationalUnit(orderItem);

      let missingReason = "";

      if (area === "REVIEW") {
        missingReason =
          "Operative Zuordnung fehlt";
      } else if (!product) {
        missingReason =
          "Kein Gastario-Produkt verknüpft";
      } else if (
        !Array.isArray(product.recipeItems) ||
        product.recipeItems.length === 0
      ) {
        missingReason =
          "Keine Rezeptur hinterlegt";
      }

      if (missingReason) {
        const key =
          `${product?.id || productName}__${missingReason}`;

        if (!missingMap.has(key)) {
          missingMap.set(key, {
            name: productName,
            quantity: 0,
            unit,
            reason: missingReason,
            orders: [],
          });
        }

        const row = missingMap.get(key);

        row.quantity += orderQty;

        row.orders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
        });

        continue;
      }

      for (const recipeItem of product.recipeItems) {
        const ingredientName = String(
          recipeItem.ingredientName || ""
        ).trim();

        if (!ingredientName) {
          continue;
        }

        const recipeUnit = String(
          recipeItem.unit || "g"
        ).trim();

        const supplierName = String(
          recipeItem.supplierName ||
            "Ohne Lieferant"
        ).trim();

        const requiredQty =
          Number(
            recipeItem.quantityPerUnit || 0
          ) * orderQty;

        const key = [
          supplierName.toLocaleLowerCase("de-DE"),
          ingredientName.toLocaleLowerCase("de-DE"),
          recipeUnit.toLocaleLowerCase("de-DE"),
        ].join("__");

        if (!demandMap.has(key)) {
          demandMap.set(key, {
            supplierName,
            ingredientName,
            unit: recipeUnit,
            quantity: 0,
            sources: [],
          });
        }

        const row = demandMap.get(key);

        row.quantity += requiredQty;

        row.sources.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          productName,
          productQuantity: orderQty,
        });
      }
    }
  }

  const demandItems = Array.from(
    demandMap.values()
  ).sort((left, right) => {
    const supplierCompare =
      left.supplierName.localeCompare(
        right.supplierName,
        "de"
      );

    if (supplierCompare !== 0) {
      return supplierCompare;
    }

    return left.ingredientName.localeCompare(
      right.ingredientName,
      "de"
    );
  });

  const missingRecipeItems = Array.from(
    missingMap.values()
  ).sort((left, right) =>
    left.name.localeCompare(right.name, "de")
  );

  const supplierGroups =
    demandItems.reduce(
      (groups: any[], item: any) => {
        let group = groups.find(
          (entry) =>
            entry.supplierName ===
            item.supplierName
        );

        if (!group) {
          group = {
            supplierName: item.supplierName,
            items: [],
          };

          groups.push(group);
        }

        group.items.push(item);

        return groups;
      },
      []
    );

  const {
    buildProcurementComparisons,
    buildProcurementCandidateSuggestions,
    buildCheapestProcurementPlan,
    buildPracticalProcurementPlan,
  } = await import(
    "../lib/procurement-comparison.server"
  );

  const comparisonResult =
    await buildProcurementComparisons({
      prisma,
      tenantId: access.tenantId,
      demandItems,
    });
  const procurementPlan =
    buildCheapestProcurementPlan(
      comparisonResult.items
    );

  const practicalProcurementPlan =
    buildPracticalProcurementPlan(
      comparisonResult.items,
      10
    );
  const currentIngredientIds =
    comparisonResult.items
      .map(
        (item: any) =>
          item.procurementIngredientId
      )
      .filter(Boolean);

  const [
    ingredientMappings,
    catalogItems,
  ] = await Promise.all([
    currentIngredientIds.length > 0
      ? prisma.procurementIngredient.findMany({
          where: {
            tenantId: access.tenantId,
            id: {
              in: currentIngredientIds,
            },
            active: true,
          },
          include: {
            matches: {
              where: {
                active: true,
              },
              include: {
                catalogItem: {
                  include: {
                    supplier: true,
                    prices: {
                      orderBy: {
                        fetchedAt: "desc",
                      },
                      take: 1,
                    },
                  },
                },
              },
              orderBy: [
                {
                  preferred: "desc",
                },
                {
                  createdAt: "asc",
                },
              ],
            },
          },
          orderBy: {
            displayName: "asc",
          },
        })
      : [],
    prisma.supplierCatalogItem.findMany({
      where: {
        tenantId: access.tenantId,
        active: true,
      },
      include: {
        supplier: true,
        prices: {
          orderBy: {
            fetchedAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: [
        {
          supplier: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
      take: 750,
    }),
  ]);
  const candidateSuggestions =
    buildProcurementCandidateSuggestions({
      ingredients: ingredientMappings,
      catalogItems,
      limit: 5,
    });
  const savedProcurementDrafts =
    await prisma.procurementOrderDraft.findMany({
      where: {
        tenantId: access.tenantId,
        planningDate: new Date(
          `${selectedDate}T00:00:00.000Z`
        ),
      },
      include: {
        items: {
          orderBy: {
            ingredientName: "asc",
          },
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          supplierName: "asc",
        },
      ],
      take: 100,
    });
  const unresolvedCount =
    missingRecipeItems.length;

  return {
    tenant: access.tenant,
    selectedDate,
    availableDates,
    orders: filteredOrders,
    demandItems: comparisonResult.items,
    supplierGroups,
    missingRecipeItems,
    unresolvedCount,
    comparisonStats: comparisonResult.stats,
    ingredientMappings,
    catalogItems,
    candidateSuggestions,
    procurementPlan,
    practicalProcurementPlan,
    savedProcurementDrafts,
    automaticAssignmentResult,
  };
}

export default function PurchasingPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PageShell className="procurementPage">
        <PageHeader
          eyebrow="Einkauf & Lager"
          title="Einkaufsplanung"
          subtitle={
            <>
              Automatisch berechneter Bedarf aus
              bestätigten Aufträgen, operativen
              Produktzuordnungen und Rezepturen für{" "}
              {data.tenant.name}.
            </>
          }
          actions={
            <>
              <Form
                method="get"
                className="procurementDateFilter"
              >
                <label>
                  <span>Planungstag</span>

                  <select
                    name="date"
                    defaultValue={
                      data.selectedDate
                    }
                  >
                    {data.availableDates.map(
                      (date: string) => (
                        <option
                          key={date}
                          value={date}
                        >
                          {formatDateOption(date)}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <button
                  className="procurementButton procurementButton--secondary"
                  type="submit"
                >
                  Anzeigen
                </button>
              </Form>

              <button
                className="procurementButton procurementButton--secondary procurementPrintButton"
                type="button"
                onClick={() => window.print()}
              >
                Drucken
              </button>
            </>
          }
        />

        {data.automaticAssignmentResult.assignedCount >
        0 ? (
          <Notice type="success">
            <strong>
              Automatische Zuordnung ausgeführt.
            </strong>{" "}
            {
              data.automaticAssignmentResult
                .assignedCount
            }{" "}
            Position(en) wurden automatisch einem
            Produkt oder Arbeitsbereich zugeordnet.
            {data.automaticAssignmentResult
              .serviceCount > 0
              ? ` ${data.automaticAssignmentResult.serviceCount} Serviceposition(en) wurden vom Wareneinkauf ausgeschlossen.`
              : ""}
          </Notice>
        ) : null}

        <MetricGrid>
          <MetricCard
            label="Aufträge"
            value={data.orders.length}
            description="für den ausgewählten Planungstag"
            badge="Operativ"
          />

          <MetricCard
            label="Einkaufspositionen"
            value={data.demandItems.length}
            description="aus gepflegten Rezepturen"
            badge="Bedarf"
          />

          <MetricCard
            label="Lieferanten"
            value={data.procurementPlan.supplierCount}
            description="im günstigsten Einkaufsplan"
            badge="Preisplan"
          />

          <MetricCard
            label="Zu prüfen"
            value={data.unresolvedCount}
            description="fehlende Zuordnung oder Rezeptur"
            badge={
              data.unresolvedCount > 0
                ? "Offen"
                : "Sauber"
            }
            attention={
              data.unresolvedCount > 0
            }
          />
        </MetricGrid>

        {data.unresolvedCount > 0 ? (
          <Notice type="warning">
            <strong>
              Einkaufsbedarf ist noch nicht
              vollständig.
            </strong>{" "}
            {data.unresolvedCount} Position(en)
            benötigen eine operative Zuordnung
            oder Rezeptur.
          </Notice>
        ) : null}

        {data.comparisonStats.unmatched > 0 ? (
          <Notice type="info">
            <strong>
              Preisvergleich vorbereitet.
            </strong>{" "}
            {data.comparisonStats.unmatched} Zutat(en)
            benötigen noch eine Zuordnung zu einem
            Lieferantenartikel. Diese werden nicht
            automatisch geraten.
          </Notice>
        ) : null}
        <div className="procurementWorkspace">
          <PageSection
            className="procurementMainSection"
            eyebrow="Bedarf"
            title="Automatische Einkaufsliste"
            description="Auftragsmenge × Rezepturmenge. Packstation, Logistik und nicht operative Positionen werden nicht als Küchenbedarf gerechnet."
            actions={
              <Link
                className="procurementButton procurementButton--secondary"
                to="/produkte"
              >
                Produkte & Rezepturen
              </Link>
            }
          >
            <div className="procurementTableWrap">
              <table className="procurementTable">
                <thead>
                  <tr>
                    <th>Zutat / Material</th>
                    <th>Menge</th>
                    <th>Einheit</th>
                    <th>Preisvorschlag</th>
                    <th>Kosten netto</th>
                    <th>Quelle</th>
                  </tr>
                </thead>

                <tbody>
                  {data.demandItems.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="procurementEmpty">
                          <span>0</span>

                          <div>
                            <strong>
                              Keine Einkaufsvorschläge
                              vorhanden
                            </strong>

                            <p>
                              Für diesen Planungstag
                              wurde noch kein Bedarf aus
                              vollständigen Rezepturen
                              berechnet.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.demandItems.map(
                      (item: any) => (
                        <tr
                          key={[
                            item.supplierName,
                            item.ingredientName,
                            item.unit,
                          ].join("-")}
                        >
                          <td>
                            <strong>
                              {item.ingredientName}
                            </strong>
                          </td>

                          <td className="procurementQuantity">
                            {formatQty(item.quantity)}
                          </td>

                          <td>{item.unit}</td>                          <td>
                            {item.bestOffer ? (
                              <div className="procurementOffer">
                                <strong>
                                  {
                                    item.bestOffer
                                      .supplierName
                                  }
                                </strong>

                                <span>
                                  {
                                    item.bestOffer
                                      .catalogItemName
                                  }
                                </span>

                                <small>
                                  {
                                    item.bestOffer
                                      .packageCount
                                  }{" "}
                                  ×{" "}
                                  {formatQty(
                                    item.bestOffer
                                      .packContent
                                  )}{" "}
                                  {
                                    item.bestOffer
                                      .baseUnit
                                  }
                                  {" · "}
                                  {
                                    item.offersCount
                                  }{" "}
                                  Angebot(e)
                                </small>
                              </div>
                            ) : (
                              <div className="procurementOffer procurementOffer--missing">
                                <strong>
                                  Noch keine Zuordnung
                                </strong>

                                <span>
                                  Lieferantenartikel
                                  zuordnen
                                </span>
                              </div>
                            )}
                          </td>

                          <td>
                            {item.bestOffer ? (
                              <div className="procurementCost">
                                <strong>
                                  {formatMoney(
                                    item.bestOffer
                                      .netTotalCents
                                  )}
                                </strong>

                                <small>
                                  Preisstand:{" "}
                                  {formatPriceAge(
                                    item.bestOffer
                                      .fetchedAt
                                  )}
                                </small>
                              </div>
                            ) : (
                              <span className="procurementNoPrice">
                                –
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="procurementSources">
                              {item.sources
                                .slice(0, 3)
                                .map(
                                  (source: any) => (
                                    <span
                                      key={[
                                        source.orderId,
                                        source.productName,
                                      ].join("-")}
                                    >
                                      {formatQty(
                                        source.productQuantity
                                      )}{" "}
                                      ×{" "}
                                      {source.productName} ·{" "}
                                      {source.orderNumber}
                                    </span>
                                  )
                                )}

                              {item.sources.length >
                              3 ? (
                                <small>
                                  +{" "}
                                  {item.sources.length -
                                    3}{" "}
                                  weitere Quellen
                                </small>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </PageSection>

          <aside className="procurementSideStack">
            <PageSection
              eyebrow="Gruppiert"
              title="Nach Lieferant"
              description="Welche Einkaufspositionen aktuell welchem Lieferanten zugeordnet sind."
              soft
            >
              <div className="procurementSupplierList">
                {data.supplierGroups.length ===
                0 ? (
                  <div className="procurementCompactEmpty">
                    Noch keine Lieferantenzuordnung
                    aus Rezepturen gefunden.
                  </div>
                ) : (
                  data.supplierGroups.map(
                    (group: any) => (
                      <article
                        key={group.supplierName}
                        className="procurementSupplierRow"
                      >
                        <div>
                          <strong>
                            {group.supplierName}
                          </strong>

                          <span>
                            {group.items.length}{" "}
                            Position(en)
                          </span>
                        </div>

                        <small>Einkauf</small>
                      </article>
                    )
                  )
                )}
              </div>
            </PageSection>

            <PageSection
              eyebrow="Berechnung"
              title="So entsteht der Bedarf"
              soft
            >
              <div className="procurementFormula">
                <strong>
                  Operative Auftragsmenge ×
                  Rezepturmenge
                </strong>

                <p>
                  Beispiel: 80 Chicken Bowls ×
                  100 g Hähnchen = 8.000 g
                  Einkaufsbedarf.
                </p>
              </div>
            </PageSection>
          </aside>
        </div>

        {/*
         * gastario-procurement-cheapest-plan-v1-20260804
         */}
        <PageSection
          className="procurementPlanSection"
          eyebrow="Einkaufsvorschlag"
          title="Günstigster Einkaufsplan"
          description="Je Zutat wird das günstigste bestätigte und aktuell bepreiste Angebot verwendet. Der Plan ist nach Lieferanten gruppiert."
          actions={
            <div className="procurementPlanActions">
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="save-procurement-drafts"
                />
                <input
                  type="hidden"
                  name="selectedDate"
                  value={data.selectedDate}
                />
                <input
                  type="hidden"
                  name="planType"
                  value="CHEAPEST"
                />
                <input
                  type="hidden"
                  name="groupsJson"
                  value={JSON.stringify(
                    data.procurementPlan.groups
                  )}
                />

                <button
                  type="submit"
                  className="procurementButton procurementButton--primary"
                  disabled={
                    data.procurementPlan.groups
                      .length === 0
                  }
                >
                  Bestellentwürfe erstellen
                </button>
              </Form>
              <button
                type="button"
                className="procurementButton procurementButton--secondary"
                onClick={() =>
                  downloadProcurementCsv({
                    plan: data.procurementPlan,
                    selectedDate:
                      data.selectedDate,
                    planLabel:
                      "Günstigster Einkaufsplan",
                    fileSuffix: "guenstig",
                  })
                }
                disabled={
                  data.procurementPlan.groups
                    .length === 0
                }
              >
                CSV herunterladen
              </button>

              <button
                type="button"
                className="procurementButton procurementButton--secondary"
                onClick={() => window.print()}
              >
                Drucken
              </button>

              <div className="procurementPlanTotal">
                <small>Gesamtsumme netto</small>
                <strong>
                  {formatMoney(
                    data.procurementPlan
                      .totalNetCents
                  )}
                </strong>
              </div>
            </div>
          }
        >
          {data.procurementPlan.groups.length === 0 ? (
            <div className="procurementCompactEmpty">
              Noch kein vollständiger Preisplan vorhanden.
              Ordne Zutaten zuerst passenden
              Lieferantenartikeln zu.
            </div>
          ) : (
            <div className="procurementPlanGrid">
              {data.procurementPlan.groups.map(
                (group: any) => (
                  <article
                    className="procurementPlanSupplier"
                    key={
                      group.supplierId ||
                      group.supplierName
                    }
                  >
                    <header>
                      <div>
                        <small>Lieferant</small>
                        <strong>
                          {group.supplierName}
                        </strong>
                        <span>
                          {group.itemCount} Position(en)
                        </span>
                      </div>

                      <div className="procurementPlanSupplierTotal">
                        <small>Netto</small>
                        <strong>
                          {formatMoney(
                            group.netTotalCents
                          )}
                        </strong>
                      </div>
                    </header>

                    <div className="procurementPlanItems">
                      {group.items.map(
                        (item: any) => (
                          <div
                            className="procurementPlanItem"
                            key={[
                              item.catalogItemId,
                              item.ingredientName,
                            ].join("-")}
                          >
                            <div>
                              <strong>
                                {item.ingredientName}
                              </strong>
                              <span>
                                {item.catalogItemName}
                              </span>
                              <small>
                                {item.articleNumber
                                  ? `Art.-Nr. ${item.articleNumber} · `
                                  : ""}
                                {item.packageCount} ×{" "}
                                {formatQty(
                                  item.packContent
                                )}{" "}
                                {item.baseUnit}
                              </small>
                            </div>

                            <div className="procurementPlanItemPrice">
                              <strong>
                                {formatMoney(
                                  item.netTotalCents
                                )}
                              </strong>
                              <small>
                                {formatMoney(
                                  item.netUnitPriceCents
                                )} je Packung
                              </small>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}

          {data.procurementPlan.missingItemCount > 0 ? (
            <div className="procurementPlanMissing">
              <strong>
                {data.procurementPlan.missingItemCount} Position(en)
                fehlen noch im Preisplan.
              </strong>
              <span>
                Dafür fehlt eine bestätigte Zuordnung,
                ein aktueller Preis oder eine passende
                Einheit.
              </span>
            </div>
          ) : null}
        </PageSection>
        {/*
         * gastario-procurement-practical-plan-v1-20260804
         */}
        <PageSection
          className="procurementPracticalSection"
          eyebrow="Alternative"
          title="Praktischer Einkaufsplan"
          description={`Bevorzugt möglichst wenige Lieferanten. Ein Artikel darf dabei höchstens ${data.practicalProcurementPlan.tolerancePercent}% teurer als das günstigste Angebot sein.`}
          actions={
            <div className="procurementPlanActions">
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="save-procurement-drafts"
                />
                <input
                  type="hidden"
                  name="selectedDate"
                  value={data.selectedDate}
                />
                <input
                  type="hidden"
                  name="planType"
                  value="PRACTICAL"
                />
                <input
                  type="hidden"
                  name="groupsJson"
                  value={JSON.stringify(
                    data.practicalProcurementPlan
                      .groups
                  )}
                />

                <button
                  type="submit"
                  className="procurementButton procurementButton--primary"
                  disabled={
                    data.practicalProcurementPlan
                      .groups.length === 0
                  }
                >
                  Bestellentwürfe erstellen
                </button>
              </Form>
              <button
                type="button"
                className="procurementButton procurementButton--secondary"
                onClick={() =>
                  downloadProcurementCsv({
                    plan:
                      data.practicalProcurementPlan,
                    selectedDate:
                      data.selectedDate,
                    planLabel:
                      "Praktischer Einkaufsplan",
                    fileSuffix: "praktisch",
                  })
                }
                disabled={
                  data.practicalProcurementPlan
                    .groups.length === 0
                }
              >
                CSV herunterladen
              </button>

              <button
                type="button"
                className="procurementButton procurementButton--secondary"
                onClick={() => window.print()}
              >
                Drucken
              </button>

              <div className="procurementPlanTotal">
                <small>Gesamtsumme netto</small>
                <strong>
                  {formatMoney(
                    data.practicalProcurementPlan
                      .totalNetCents
                  )}
                </strong>
              </div>
            </div>
          }
        >
          <div className="procurementPracticalSummary">
            <div>
              <small>Lieferanten</small>
              <strong>
                {
                  data.practicalProcurementPlan
                    .supplierCount
                }
              </strong>
            </div>

            <div>
              <small>Mehrkosten</small>
              <strong>
                {formatMoney(
                  data.practicalProcurementPlan
                    .surchargeCents
                )}
              </strong>
            </div>

            <div>
              <small>Schwerpunkt</small>
              <strong>
                {data.practicalProcurementPlan
                  .preferredSupplierName ||
                  "Noch offen"}
              </strong>
            </div>
          </div>

          {data.practicalProcurementPlan.groups
            .length === 0 ? (
            <div className="procurementCompactEmpty">
              Noch kein praktischer Einkaufsplan
              berechenbar.
            </div>
          ) : (
            <div className="procurementPlanGrid">
              {data.practicalProcurementPlan.groups.map(
                (group: any) => (
                  <article
                    className="procurementPlanSupplier"
                    key={`practical-${
                      group.supplierId ||
                      group.supplierName
                    }`}
                  >
                    <header>
                      <div>
                        <small>Lieferant</small>
                        <strong>
                          {group.supplierName}
                        </strong>
                        <span>
                          {group.itemCount} Position(en)
                        </span>
                      </div>

                      <div className="procurementPlanSupplierTotal">
                        <small>Netto</small>
                        <strong>
                          {formatMoney(
                            group.netTotalCents
                          )}
                        </strong>
                      </div>
                    </header>

                    <div className="procurementPlanItems">
                      {group.items.map(
                        (item: any) => (
                          <div
                            className="procurementPlanItem"
                            key={[
                              "practical",
                              item.catalogItemId,
                              item.ingredientName,
                            ].join("-")}
                          >
                            <div>
                              <strong>
                                {item.ingredientName}
                              </strong>
                              <span>
                                {item.catalogItemName}
                              </span>
                              <small>
                                {item.packageCount} ×{" "}
                                {formatQty(
                                  item.packContent
                                )}{" "}
                                {item.baseUnit}
                                {item.surchargeCents > 0
                                  ? ` · ${formatMoney(
                                      item.surchargeCents
                                    )} über Bestpreis`
                                  : " · Bestpreis"}
                              </small>
                            </div>

                            <div className="procurementPlanItemPrice">
                              <strong>
                                {formatMoney(
                                  item.netTotalCents
                                )}
                              </strong>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
        <PageSection
          className="procurementDraftSection"
          eyebrow="Gespeichert"
          title="Bestellentwürfe"
          description="Dauerhaft gespeicherte Lieferantenentwürfe für den gewählten Planungstag."
          id="saved-procurement-drafts"
        >
          {data.savedProcurementDrafts.length ===
          0 ? (
            <div className="procurementCompactEmpty">
              Für diesen Planungstag wurden noch keine
              Bestellentwürfe gespeichert.
            </div>
          ) : (
            <div className="procurementDraftGrid">
              {data.savedProcurementDrafts.map(
                (draft: any) => (
                  <article
                    className="procurementDraftCard"
                    key={draft.id}
                  >
                    <header>
                      <div>
                        <small>
                          {draft.planType ===
                          "PRACTICAL"
                            ? "Praktischer Plan"
                            : "Günstigster Plan"}
                        </small>
                        <strong>
                          {draft.supplierName}
                        </strong>
                        <span>
                          {draft.items.length} Position(en)
                        </span>
                      </div>

                      <div className="procurementDraftStatus">
                        <span>
                          {procurementDraftStatusLabel(
                            draft.status
                          )}
                        </span>
                        <strong>
                          {formatMoney(
                            draft.netTotalCents
                          )}
                        </strong>
                      </div>
                    </header>

                    <Form
                      method="post"
                      className="procurementDraftForm"
                    >
                      <input
                        type="hidden"
                        name="intent"
                        value="update-procurement-draft"
                      />
                      <input
                        type="hidden"
                        name="draftId"
                        value={draft.id}
                      />
                      <input
                        type="hidden"
                        name="selectedDate"
                        value={data.selectedDate}
                      />

                      <div className="procurementDraftControls">
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
                          className="procurementButton procurementButton--primary"
                        >
                          Änderungen speichern
                        </button>
                      </div>

                      <div className="procurementDraftEditor">
                        {draft.items.map(
                          (item: any) => (
                            <div
                              className="procurementDraftEditorRow"
                              key={item.id}
                            >
                              <div>
                                <strong>
                                  {item.ingredientName}
                                </strong>
                                <span>
                                  {item.catalogItemName}
                                </span>
                                <small>
                                  {item.articleNumber
                                    ? `Art.-Nr. ${item.articleNumber}`
                                    : "Keine Artikelnummer"}
                                </small>
                              </div>

                              <label>
                                <span>Bestellt</span>
                                <input
                                  type="number"
                                  name={`packageCount_${item.id}`}
                                  min="0.01"
                                  step="0.01"
                                  defaultValue={
                                    item.packageCount
                                  }
                                />
                              </label>

                              <label>
                                <span>Geliefert</span>
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
                              </label>

                              <div className="procurementDraftEditorPrice">
                                <small>Netto</small>
                                <strong>
                                  {formatMoney(
                                    item.netTotalCents
                                  )}
                                </strong>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </Form>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
        <PageSection
          className="procurementMappingSection"
          eyebrow="Artikelzuordnung"
          title="Zutaten mit Lieferantenartikeln verbinden"
          description="Ordne jede Zutat einem oder mehreren echten Katalogartikeln zu. Gastario vergleicht anschließend automatisch Packungsgrößen und aktuelle Preise."
          id="ingredient-mapping"
          actions={
            <Link
              className="procurementButton procurementButton--secondary"
              to="/lieferanten"
            >
              Lieferantenkataloge
            </Link>
          }
        >
          {data.ingredientMappings.length === 0 ? (
            <div className="procurementCompactEmpty">
              Für den gewählten Planungstag gibt es
              noch keine berechenbaren Zutaten.
            </div>
          ) : (
            <div className="procurementMappingList">
              {data.ingredientMappings.map(
                (ingredient: any) => (
                  <article
                    className="procurementMappingRow"
                    key={ingredient.id}
                  >
                    <div className="procurementMappingIdentity">
                      <small>Zutat</small>
                      <strong>
                        {ingredient.displayName}
                      </strong>
                      <span>
                        Basiseinheit:{" "}
                        {ingredient.baseUnit}
                      </span>

                      <div className="procurementSuggestionSummary">
                        <strong>
                          {(data.candidateSuggestions[
                            ingredient.id
                          ] || []).length}
                        </strong>
                        <span>
                          passende Katalogkandidaten
                        </span>
                      </div>
                    </div>

                    <div className="procurementMappingMatches">
                      {ingredient.matches.length === 0 ? (
                        <div className="procurementMappingEmpty">
                          Noch kein Lieferantenartikel
                          zugeordnet
                        </div>
                      ) : (
                        ingredient.matches.map(
                          (match: any) => {
                            const price =
                              match.catalogItem
                                .prices?.[0] || null;

                            return (
                              <div
                                className="procurementMappedArticle"
                                key={match.id}
                              >
                                <div>
                                  <strong>
                                    {
                                      match
                                        .catalogItem
                                        .supplier
                                        .name
                                    }
                                  </strong>

                                  <span>
                                    {
                                      match
                                        .catalogItem
                                        .name
                                    }
                                  </span>

                                  <small>
                                    {price
                                      ? `${formatMoney(
                                          price.netPriceCents
                                        )} · ${formatPriceAge(
                                          price.fetchedAt
                                        )}`
                                      : "Noch kein Preis vorhanden"}
                                  </small>
                                </div>

                                {match.preferred ? (
                                  <span className="procurementPreferredBadge">
                                    Bevorzugt
                                  </span>
                                ) : null}

                                <Form method="post">
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="remove-ingredient-match"
                                  />
                                  <input
                                    type="hidden"
                                    name="matchId"
                                    value={match.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="returnDate"
                                    value={
                                      data.selectedDate
                                    }
                                  />

                                  <button
                                    type="submit"
                                    className="procurementMappingRemove"
                                  >
                                    Entfernen
                                  </button>
                                </Form>
                              </div>
                            );
                          }
                        )
                      )}
                    </div>

                    <Form
                      method="post"
                      className="procurementMappingForm"
                    >
                      <input
                        type="hidden"
                        name="intent"
                        value="save-ingredient-match"
                      />
                      <input
                        type="hidden"
                        name="ingredientId"
                        value={ingredient.id}
                      />
                      <input
                        type="hidden"
                        name="returnDate"
                        value={data.selectedDate}
                      />

                      <label>
                        <span>
                          Lieferantenartikel
                        </span>

                        <select
                          name="catalogItemId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Artikel auswählen …
                          </option>

                          {(data.candidateSuggestions[
                            ingredient.id
                          ] || []).length > 0 ? (
                            <optgroup label="Gastario Vorschläge">
                              {(data.candidateSuggestions[
                                ingredient.id
                              ] || []).map(
                                (suggestion: any) => (
                                  <option
                                    key={`suggestion-${suggestion.catalogItemId}`}
                                    value={
                                      suggestion.catalogItemId
                                    }
                                  >
                                    {suggestion.supplierName}
                                    {" · "}
                                    {suggestion.catalogItemName}
                                    {suggestion.netPriceCents !==
                                    null
                                      ? ` · ${formatMoney(
                                          suggestion.netPriceCents
                                        )}`
                                      : " · ohne Preis"}
                                    {` · Treffer ${suggestion.score}%`}
                                  </option>
                                )
                              )}
                            </optgroup>
                          ) : null}

                          <optgroup label="Alle Katalogartikel">
                          {data.catalogItems.map(
                            (catalogItem: any) => {
                              const latestPrice =
                                catalogItem
                                  .prices?.[0] ||
                                null;

                              return (
                                <option
                                  key={
                                    catalogItem.id
                                  }
                                  value={
                                    catalogItem.id
                                  }
                                >
                                  {
                                    catalogItem
                                      .supplier.name
                                  }
                                  {" · "}
                                  {catalogItem.name}
                                  {latestPrice
                                    ? ` · ${formatMoney(
                                        latestPrice
                                          .netPriceCents
                                      )}`
                                    : " · ohne Preis"}
                                </option>
                              );
                            }
                          )}
                          </optgroup>
                        </select>
                      </label>

                      <label className="procurementMappingCheck">
                        <input
                          type="checkbox"
                          name="preferred"
                          value="true"
                        />
                        <span>
                          Als bevorzugten Artikel
                          markieren
                        </span>
                      </label>

                      <button
                        className="procurementButton procurementButton--primary"
                        type="submit"
                      >
                        Zuordnen
                      </button>
                    </Form>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
        {data.missingRecipeItems.length > 0 ? (
          <PageSection
            eyebrow="Prüfung"
            title="Noch nicht berechenbare Positionen"
            description="Diese Positionen werden nicht geraten. Erst nach Zuordnung und Rezeptur fließen sie in den Einkauf ein."
            actions={
              <Link
                className="procurementButton procurementButton--primary"
                to="/produkte"
              >
                Zuordnungen pflegen
              </Link>
            }
          >
            <div className="procurementIssueList">
              {data.missingRecipeItems.map(
                (item: any) => (
                  <article
                    className="procurementIssueRow"
                    key={[
                      item.name,
                      item.reason,
                    ].join("-")}
                  >
                    <div>
                      <strong>{item.name}</strong>

                      <span>
                        {formatQty(item.quantity)}{" "}
                        {item.unit} · {item.reason}
                      </span>
                    </div>

                    <small>Prüfen</small>
                  </article>
                )
              )}
            </div>
          </PageSection>
        ) : null}
      </PageShell>
    </AppLayout>
  );
}
