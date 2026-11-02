import { useState } from "react";
import { Form, Link, redirect, useLoaderData } from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioActionCard,
  GastarioActionGrid,
  GastarioFilterBar,
  GastarioFormGrid,
  GastarioHeader,
  GastarioNotice,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioField,
  GastarioSelect,
  GastarioToolbar,
  gastarioButtonClass,
  GastarioSection,
  GastarioDataList,
  GastarioDataRow,
  GastarioEmptyState,
  GastarioStack,
  GastarioInput,
  GastarioTextarea,
  GastarioDetailDialog,
  GastarioDetailTabs,
  GastarioDetailPane,
  GastarioCheckRow,
} from "../components/ui";


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

function emptyManualShoppingItem() {
  return {
    name: "",
    quantity: "1",
    unit: "StÃ¼ck",
    notes: "",
    checked: false,
  };
}

function parseManualShoppingListItems(
  rawValue: unknown
) {
  const raw = String(
    rawValue || ""
  ).trim();

  if (!raw) {
    throw new Response(
      "Mindestens eine Einkaufsposition ist erforderlich.",
      {
        status: 400,
      }
    );
  }

  let parsed: any[] = [];

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Response(
      "Die Einkaufspositionen konnten nicht gelesen werden.",
      {
        status: 400,
      }
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Response(
      "UngÃ¼ltige Einkaufspositionen.",
      {
        status: 400,
      }
    );
  }

  const items = parsed
    .map(
      (
        item: any,
        index: number
      ) => {
        const name = String(
          item?.name || ""
        ).trim();

        const quantity = Number(
          String(
            item?.quantity ?? ""
          ).replace(",", ".")
        );

        const unit = String(
          item?.unit || ""
        ).trim();

        const notes = String(
          item?.notes || ""
        ).trim();

        if (
          !name ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !unit
        ) {
          return null;
        }

        return {
          name,
          quantity,
          unit,
          notes:
            notes || null,
          checked:
            Boolean(
              item?.checked
            ),
          sortOrder:
            index,
        };
      }
    )
    .filter(Boolean);

  if (items.length === 0) {
    throw new Response(
      "Mindestens eine vollstÃ¤ndige Einkaufsposition ist erforderlich.",
      {
        status: 400,
      }
    );
  }

  return items;
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
   * gastario-manual-shopping-lists-v1-20261102
   */
  if (
    intent ===
    "create-manual-shopping-list"
  ) {
    const title = String(
      formData.get("title") || ""
    ).trim();

    const planningDate = String(
      formData.get("planningDate") ||
        ""
    ).trim();

    const notes = String(
      formData.get("notes") || ""
    ).trim();

    if (!title) {
      throw new Response(
        "Bitte einen Namen fÃ¼r die Einkaufsliste eingeben.",
        {
          status: 400,
        }
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        planningDate
      )
    ) {
      throw new Response(
        "Bitte einen gÃ¼ltigen Planungstag auswÃ¤hlen.",
        {
          status: 400,
        }
      );
    }

    const items =
      parseManualShoppingListItems(
        formData.get("itemsJson")
      );

    await prisma.manualShoppingList.create({
      data: {
        tenantId:
          access.tenantId,
        title,
        planningDate:
          new Date(
            planningDate +
              "T00:00:00.000Z"
          ),
        notes:
          notes || null,
        items: {
          create:
            items.map(
              (item: any) => ({
                tenantId:
                  access.tenantId,
                ...item,
              })
            ),
        },
      },
    });

    return redirect(
      "/einkauf?date=" +
        encodeURIComponent(
          planningDate
        ) +
        "#manual-shopping-lists"
    );
  }


  if (
    intent ===
    "update-manual-shopping-list"
  ) {
    const listId = String(
      formData.get("listId") || ""
    ).trim();

    const title = String(
      formData.get("title") || ""
    ).trim();

    const planningDate = String(
      formData.get("planningDate") ||
        ""
    ).trim();

    const notes = String(
      formData.get("notes") || ""
    ).trim();

    if (
      !listId ||
      !title ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        planningDate
      )
    ) {
      throw new Response(
        "Die Einkaufsliste ist unvollstÃ¤ndig.",
        {
          status: 400,
        }
      );
    }

    const existing =
      await prisma.manualShoppingList.findFirst({
        where: {
          id: listId,
          tenantId:
            access.tenantId,
        },
      });

    if (!existing) {
      throw new Response(
        "Einkaufsliste wurde nicht gefunden.",
        {
          status: 404,
        }
      );
    }

    const items =
      parseManualShoppingListItems(
        formData.get("itemsJson")
      );

    await prisma.manualShoppingList.update({
      where: {
        id:
          existing.id,
      },
      data: {
        title,
        planningDate:
          new Date(
            planningDate +
              "T00:00:00.000Z"
          ),
        notes:
          notes || null,
        items: {
          deleteMany: {},
          create:
            items.map(
              (item: any) => ({
                tenantId:
                  access.tenantId,
                ...item,
              })
            ),
        },
      },
    });

    return redirect(
      "/einkauf?date=" +
        encodeURIComponent(
          planningDate
        ) +
        "#manual-shopping-lists"
    );
  }


  if (
    intent ===
    "delete-manual-shopping-list"
  ) {
    const listId = String(
      formData.get("listId") || ""
    ).trim();

    if (!listId) {
      throw new Response(
        "Einkaufsliste fehlt.",
        {
          status: 400,
        }
      );
    }

    await prisma.manualShoppingList.deleteMany({
      where: {
        id:
          listId,
        tenantId:
          access.tenantId,
      },
    });

    const targetDate =
      /^\d{4}-\d{2}-\d{2}$/.test(
        returnDate
      )
        ? returnDate
        : todayInput();

    return redirect(
      "/einkauf?date=" +
        encodeURIComponent(
          targetDate
        ) +
        "#manual-shopping-lists"
    );
  }

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
        "UngÃ¼ltiger Planungstag.",
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
        "UngÃ¼ltige Planart.",
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
        "Der Einkaufsplan enthÃ¤lt keine Lieferanten.",
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
        "Es konnten keine gÃ¼ltigen Bestellpositionen Ã¼bernommen werden.",
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
        "UngÃ¼ltiger Bestellentwurf oder Status.",
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
          `UngÃ¼ltige Menge bei ${item.ingredientName}.`,
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
  return [{ title: "Einkaufsplanung Â· Gastario" }];
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

  const manualShoppingListDateRows =
    await prisma.manualShoppingList.findMany({
      where: {
        tenantId:
          access.tenantId,
      },
      select: {
        planningDate: true,
      },
      orderBy: {
        planningDate: "asc",
      },
    });

  const availableDates = Array.from(
    new Set([
      ...(orders as any[])
        .map((order) =>
          order.deliveryDate
            ? normalizeDate(
                order.deliveryDate
              )
            : "ohne-datum"
        )
        .filter(Boolean),

      ...manualShoppingListDateRows
        .map((list: any) =>
          normalizeDate(
            list.planningDate
          )
        )
        .filter(Boolean),
    ])
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
  const shoppingMap = new Map<string, any>();
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
          "Kein Gastario-Produkt verknÃ¼pft";
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

        // Einkaufsliste unabhÃ¤ngig von Lieferant und Preis.
        // Gleiche Zutat + gleiche Einheit werden zusammengefasst.
        const shoppingKey = [
          ingredientName.toLocaleLowerCase("de-DE"),
          recipeUnit.toLocaleLowerCase("de-DE"),
        ].join("__");

        if (!shoppingMap.has(shoppingKey)) {
          shoppingMap.set(shoppingKey, {
            ingredientName,
            unit: recipeUnit,
            quantity: 0,
            sources: [],
          });
        }

        const shoppingRow =
          shoppingMap.get(shoppingKey);

        shoppingRow.quantity += requiredQty;

        shoppingRow.sources.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          productName,
          productQuantity: orderQty,
        });

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

  const shoppingItems = Array.from(
    shoppingMap.values()
  ).sort((left, right) =>
    left.ingredientName.localeCompare(
      right.ingredientName,
      "de"
    )
  );

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
  const manualShoppingLists =
    /^\d{4}-\d{2}-\d{2}$/.test(
      selectedDate
    )
      ? await prisma.manualShoppingList.findMany({
          where: {
            tenantId:
              access.tenantId,
            planningDate:
              new Date(
                selectedDate +
                  "T00:00:00.000Z"
              ),
          },
          include: {
            items: {
              orderBy: [
                {
                  sortOrder:
                    "asc",
                },
                {
                  createdAt:
                    "asc",
                },
              ],
            },
          },
          orderBy: {
            createdAt:
              "desc",
          },
        })
      : [];

  const unresolvedCount =
    missingRecipeItems.length;

  return {
    tenant: access.tenant,
    selectedDate,
    availableDates,
    orders: filteredOrders,
    demandItems: comparisonResult.items,
    shoppingItems,
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
    manualShoppingLists,
    automaticAssignmentResult,
  };
}

export default function PurchasingPage() {
  const data = useLoaderData<typeof loader>();

  const [selectedDraftId, setSelectedDraftId] =
    useState<string | null>(null);

  const [draftDetailTab, setDraftDetailTab] =
    useState("overview");

  const selectedDraft =
    data.savedProcurementDrafts.find(
      (draft: any) =>
        draft.id === selectedDraftId
    ) || null;

  const [selectedIngredientId, setSelectedIngredientId] =
    useState<string | null>(null);

  const [ingredientDetailTab, setIngredientDetailTab] =
    useState("matches");

  const selectedIngredient =
    data.ingredientMappings.find(
      (ingredient: any) =>
        ingredient.id === selectedIngredientId
    ) || null;


  const [
    selectedShoppingKey,
    setSelectedShoppingKey,
  ] = useState<string | null>(null);

  const [
    shoppingDetailTab,
    setShoppingDetailTab,
  ] = useState("overview");

  const selectedShoppingItem =
    selectedShoppingKey
      ? data.shoppingItems.find(
          (item: any) =>
            [
              item.ingredientName,
              item.unit,
            ].join("::") ===
            selectedShoppingKey
        ) || null
      : null;


  const [
    selectedPlanType,
    setSelectedPlanType,
  ] = useState<
    "CHEAPEST" |
    "PRACTICAL" |
    null
  >(null);

  const [
    planDetailTab,
    setPlanDetailTab,
  ] = useState("overview");

  const selectedPlan: any =
    selectedPlanType === "CHEAPEST"
      ? data.procurementPlan
      : selectedPlanType === "PRACTICAL"
        ? data.practicalProcurementPlan
        : null;

  const selectedPlanLabel =
    selectedPlanType === "CHEAPEST"
      ? "GÃ¼nstigster Einkaufsplan"
      : "Praktischer Einkaufsplan";


  const [
    manualCreateOpen,
    setManualCreateOpen,
  ] = useState(false);

  const [
    manualCreateItems,
    setManualCreateItems,
  ] = useState<any[]>([
    emptyManualShoppingItem(),
  ]);


  const [
    selectedManualListId,
    setSelectedManualListId,
  ] = useState<string | null>(
    null
  );

  const [
    manualListTab,
    setManualListTab,
  ] = useState("overview");

  const [
    manualEditItems,
    setManualEditItems,
  ] = useState<any[]>([]);


  const selectedManualList =
    manualShoppingLists.find(
      (list: any) =>
        list.id ===
        selectedManualListId
    ) || null;


  const openManualList = (
    list: any
  ) => {
    setSelectedManualListId(
      list.id
    );

    setManualListTab(
      "overview"
    );

    setManualEditItems(
      list.items.map(
        (item: any) => ({
          id:
            item.id,
          name:
            item.name,
          quantity:
            String(
              item.quantity
            ),
          unit:
            item.unit,
          notes:
            item.notes || "",
          checked:
            Boolean(
              item.checked
            ),
        })
      )
    );
  };


  const closeManualCreate = () => {
    setManualCreateOpen(
      false
    );

    setManualCreateItems([
      emptyManualShoppingItem(),
    ]);
  };


  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Einkauf & Lager"
          title="Einkaufsplanung"
          description={
            <>
              Bedarf, Lieferantenartikel,
              EinkaufsplÃ¤ne und BestellentwÃ¼rfe
              zentral fÃ¼r {data.tenant.name}.
            </>
          }
          actions={
            <>
              <Link
                className={gastarioButtonClass(
                  "primary"
                )}
                to="/einkauf/artikelsuche"
              >
                Artikel suchen
              </Link>

              <button
                className={gastarioButtonClass(
                  "secondary"
                )}
                type="button"
                onClick={() =>
                  window.print()
                }
              >
                Drucken
              </button>
            </>
          }
        />


        <GastarioSection
          eyebrow="Planung"
          title="Planungstag"
          description="WÃ¤hle den Liefertag, fÃ¼r den Bedarf und EinkaufsplÃ¤ne berechnet werden sollen."
        >
          <Form method="get">

            <GastarioFilterBar
              actions={
                <button
                  className={gastarioButtonClass(
                    "primary"
                  )}
                  type="submit"
                >
                  Anzeigen
                </button>
              }
            >

              <GastarioField
                label="Planungstag"
              >
                <GastarioSelect
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
                        {formatDateOption(
                          date
                        )}
                      </option>
                    )
                  )}
                </GastarioSelect>
              </GastarioField>

            </GastarioFilterBar>

          </Form>
        </GastarioSection>


        {data.automaticAssignmentResult.assignedCount >
        0 ? (
          <GastarioNotice type="success">
            <strong>
              Automatische Zuordnung ausgefÃ¼hrt.
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
          </GastarioNotice>
        ) : null}

        <GastarioMetricGrid>
          <GastarioMetric
            label="AuftrÃ¤ge"
            value={data.orders.length}
            description="fÃ¼r den ausgewÃ¤hlten Planungstag"
            badge="Operativ"
          />

          <GastarioMetric
            label="Einkaufspositionen"
            value={data.demandItems.length}
            description="aus gepflegten Rezepturen"
            badge="Bedarf"
          />

          <GastarioMetric
            label="Lieferanten"
            value={data.procurementPlan.supplierCount}
            description="im gÃ¼nstigsten Einkaufsplan"
            badge="Preisplan"
          />

          <GastarioMetric
            label="Zu prÃ¼fen"
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
        </GastarioMetricGrid>

        {data.unresolvedCount > 0 ? (
          <GastarioNotice type="warning">
            <strong>
              Einkaufsbedarf ist noch nicht
              vollstÃ¤ndig.
            </strong>{" "}
            {data.unresolvedCount} Position(en)
            benÃ¶tigen eine operative Zuordnung
            oder Rezeptur.
          </GastarioNotice>
        ) : null}

        {data.comparisonStats.unmatched > 0 ? (
          <GastarioNotice type="info">
            <strong>
              Preisvergleich vorbereitet.
            </strong>{" "}
            {data.comparisonStats.unmatched} Zutat(en)
            benÃ¶tigen noch eine Zuordnung zu einem
            Lieferantenartikel. Diese werden nicht
            automatisch geraten.
          </GastarioNotice>
        ) : null}
        <GastarioSection
          eyebrow="Bedarf"
          title="Automatische Einkaufsliste"
          description="Der Bedarf wird aus operativer Auftragsmenge und Rezepturmenge berechnet."
          action={
            <Link
              className={gastarioButtonClass(
                "secondary"
              )}
              to="/produkte"
            >
              Produkte & Rezepturen
            </Link>
          }
        >

          {data.shoppingItems.length === 0 ? (

            <GastarioEmptyState
              title="Kein Einkaufsbedarf vorhanden"
            >
              FÃ¼r diesen Planungstag wurde
              noch kein Bedarf aus vollstÃ¤ndigen
              Rezepturen berechnet.
            </GastarioEmptyState>

          ) : (

            <GastarioDataList>

              {data.shoppingItems.map(
                (item: any) => {

                  const shoppingKey =
                    [
                      item.ingredientName,
                      item.unit,
                    ].join("::");

                  return (
                    <GastarioDataRow
                      key={shoppingKey}
                      onClick={() => {
                        setShoppingDetailTab(
                          "overview"
                        );

                        setSelectedShoppingKey(
                          shoppingKey
                        );
                      }}
                    >

                      <div className="g-ui-data-row-main">

                        <strong className="g-ui-data-row-title">
                          {item.ingredientName}
                        </strong>

                        <span className="g-ui-data-row-description">
                          {item.sources.length} Quelle(n)
                          aus bestÃ¤tigten AuftrÃ¤gen
                        </span>

                      </div>


                      <div className="g-ui-data-row-meta">

                        <strong>
                          {formatQty(
                            item.quantity
                          )}{" "}
                          {item.unit}
                        </strong>

                      </div>


                      <span
                        className="g-ui-data-row-chevron"
                        aria-hidden="true"
                      >
                        â†’
                      </span>

                    </GastarioDataRow>
                  );
                }
              )}

            </GastarioDataList>

          )}

        </GastarioSection>


        <GastarioDetailDialog
          open={Boolean(
            selectedShoppingItem
          )}
          title={
            selectedShoppingItem
              ?.ingredientName ||
            "Einkaufsbedarf"
          }
          description={
            selectedShoppingItem
              ? "Berechneter Gesamtbedarf und Herkunft"
              : undefined
          }
          onClose={() =>
            setSelectedShoppingKey(
              null
            )
          }
          footer={
            selectedShoppingItem ? (
              <>

                <button
                  type="button"
                  className={gastarioButtonClass(
                    "secondary"
                  )}
                  onClick={() =>
                    setSelectedShoppingKey(
                      null
                    )
                  }
                >
                  SchlieÃŸen
                </button>

                <Link
                  to="/produkte"
                  className={gastarioButtonClass(
                    "primary"
                  )}
                >
                  Rezepturen Ã¶ffnen
                </Link>

              </>
            ) : null
          }
        >

          {selectedShoppingItem ? (
            <>

              <GastarioDetailTabs
                activeId={
                  shoppingDetailTab
                }
                onChange={
                  setShoppingDetailTab
                }
                items={[
                  {
                    id: "overview",
                    label: "Ãœbersicht",
                  },
                  {
                    id: "sources",
                    label: "Herkunft",
                    badge:
                      selectedShoppingItem
                        .sources.length,
                  },
                ]}
              />


              <GastarioDetailPane
                active={
                  shoppingDetailTab ===
                  "overview"
                }
              >

                <GastarioMetricGrid>

                  <GastarioMetric
                    label="Gesamtbedarf"
                    value={
                      formatQty(
                        selectedShoppingItem
                          .quantity
                      ) +
                      " " +
                      selectedShoppingItem
                        .unit
                    }
                    description="Berechnete Einkaufsmenge"
                  />

                  <GastarioMetric
                    label="Auftragsquellen"
                    value={
                      selectedShoppingItem
                        .sources.length
                    }
                    description="Verwendete Auftragspositionen"
                  />

                </GastarioMetricGrid>


                <GastarioNotice
                  type="neutral"
                >
                  <strong>
                    Berechnung:
                  </strong>{" "}
                  Operative Auftragsmenge Ã—
                  Rezepturmenge.
                  Packstation, Logistik und
                  nicht operative Positionen
                  werden nicht als KÃ¼chenbedarf
                  gerechnet.
                </GastarioNotice>

              </GastarioDetailPane>


              <GastarioDetailPane
                active={
                  shoppingDetailTab ===
                  "sources"
                }
              >

                <GastarioDataList>

                  {selectedShoppingItem.sources.map(
                    (
                      source: any,
                      index: number
                    ) => (

                      <GastarioDataRow
                        key={
                          source.orderId +
                          "-" +
                          source.productName +
                          "-" +
                          index
                        }
                      >

                        <div className="g-ui-data-row-main">

                          <strong className="g-ui-data-row-title">
                            {source.productName}
                          </strong>

                          <span className="g-ui-data-row-description">
                            {source.orderNumber}
                            {" Â· "}
                            {source.customerName ||
                              "Kunde"}
                          </span>

                        </div>


                        <div className="g-ui-data-row-meta">

                          <strong>
                            {formatQty(
                              source.productQuantity
                            )}
                          </strong>

                        </div>

                      </GastarioDataRow>

                    )
                  )}

                </GastarioDataList>

              </GastarioDetailPane>

            </>
          ) : null}

        </GastarioDetailDialog>




        <GastarioSection
          id="manual-shopping-lists"
          eyebrow="Eigene Planung"
          title="Eigene Einkaufslisten"
          description="Erstelle freie Einkaufslisten unabhÃ¤ngig vom automatisch berechneten Rezepturbedarf."
          action={
            <button
              type="button"
              className={gastarioButtonClass(
                "primary"
              )}
              onClick={() => {
                setManualCreateItems([
                  emptyManualShoppingItem(),
                ]);

                setManualCreateOpen(
                  true
                );
              }}
            >
              + Neue Einkaufsliste
            </button>
          }
        >

          {manualShoppingLists
            .length === 0 ? (

            <GastarioEmptyState
              title="Noch keine eigene Einkaufsliste"
            >
              FÃ¼r diesen Planungstag wurde
              noch keine manuelle Einkaufsliste
              angelegt.
            </GastarioEmptyState>

          ) : (

            <GastarioDataList>

              {manualShoppingLists.map(
                (list: any) => {

                  const completed =
                    list.items.filter(
                      (item: any) =>
                        item.checked
                    ).length;

                  return (
                    <GastarioDataRow
                      key={list.id}
                      onClick={() =>
                        openManualList(
                          list
                        )
                      }
                    >

                      <div className="g-ui-data-row-main">

                        <strong className="g-ui-data-row-title">
                          {list.title}
                        </strong>

                        <span className="g-ui-data-row-description">
                          {formatDateOption(
                            normalizeDate(
                              list.planningDate
                            )
                          )}
                          {" Â· "}
                          {list.items.length}
                          {" Position(en)"}
                          {list.notes
                            ? " Â· " +
                              list.notes
                            : ""}
                        </span>

                      </div>


                      <div className="g-ui-data-row-meta">

                        <strong>
                          {completed}
                          {" / "}
                          {list.items.length}
                        </strong>

                        <span>
                          erledigt
                        </span>

                      </div>


                      <span
                        className="g-ui-data-row-chevron"
                        aria-hidden="true"
                      >
                        â†’
                      </span>

                    </GastarioDataRow>
                  );
                }
              )}

            </GastarioDataList>

          )}

        </GastarioSection>


        <GastarioDetailDialog
          open={
            manualCreateOpen
          }
          size="lg"
          title="Neue Einkaufsliste"
          description="Artikel frei erfassen und fÃ¼r einen Planungstag speichern."
          onClose={
            closeManualCreate
          }
          footer={
            <>

              <button
                type="button"
                className={gastarioButtonClass(
                  "secondary"
                )}
                onClick={
                  closeManualCreate
                }
              >
                Abbrechen
              </button>

              <button
                type="submit"
                form="manual-shopping-list-create"
                className={gastarioButtonClass(
                  "primary"
                )}
              >
                Einkaufsliste speichern
              </button>

            </>
          }
        >

          <Form
            method="post"
            id="manual-shopping-list-create"
          >

            <input
              type="hidden"
              name="intent"
              value="create-manual-shopping-list"
            />

            <input
              type="hidden"
              name="itemsJson"
              value={JSON.stringify(
                manualCreateItems
              )}
            />


            <GastarioStack>

              <GastarioFormGrid
                columns={2}
              >

                <GastarioField
                  label="Name der Einkaufsliste"
                  required
                >
                  <GastarioInput
                    name="title"
                    required
                    maxLength={120}
                    placeholder="z. B. Metro Einkauf Montag"
                  />
                </GastarioField>


                <GastarioField
                  label="Planungstag"
                  required
                >
                  <GastarioInput
                    type="date"
                    name="planningDate"
                    required
                    defaultValue={
                      /^\d{4}-\d{2}-\d{2}$/.test(
                        data.selectedDate
                      )
                        ? data.selectedDate
                        : todayInput()
                    }
                  />
                </GastarioField>

              </GastarioFormGrid>


              <GastarioField
                label="Interne Notiz"
              >
                <GastarioTextarea
                  name="notes"
                  placeholder="z. B. Metro, Selgros, GetrÃ¤nke, Sonderbedarf ..."
                />
              </GastarioField>


              <GastarioSection
                eyebrow="Positionen"
                title="Was muss eingekauft werden?"
                description="Menge und Einheit frei festlegen."
                action={
                  <button
                    type="button"
                    className={gastarioButtonClass(
                      "secondary"
                    )}
                    onClick={() =>
                      setManualCreateItems(
                        (
                          current
                        ) => [
                          ...current,
                          emptyManualShoppingItem(),
                        ]
                      )
                    }
                  >
                    + Position hinzufÃ¼gen
                  </button>
                }
              >

                <GastarioDataList>

                  {manualCreateItems.map(
                    (
                      item: any,
                      index: number
                    ) => (

                      <GastarioDataRow
                        key={
                          "create-" +
                          index
                        }
                      >

                        <div className="g-ui-data-row-main">

                          <GastarioFormGrid
                            columns={4}
                          >

                            <GastarioField
                              label="Artikel"
                              required
                            >
                              <GastarioInput
                                value={
                                  item.name
                                }
                                placeholder="z. B. HÃ¤hnchenbrust"
                                onChange={(
                                  event
                                ) =>
                                  setManualCreateItems(
                                    (
                                      current
                                    ) =>
                                      current.map(
                                        (
                                          row,
                                          rowIndex
                                        ) =>
                                          rowIndex ===
                                          index
                                            ? {
                                                ...row,
                                                name:
                                                  event
                                                    .currentTarget
                                                    .value,
                                              }
                                            : row
                                      )
                                  )
                                }
                              />
                            </GastarioField>


                            <GastarioField
                              label="Menge"
                              required
                            >
                              <GastarioInput
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={
                                  item.quantity
                                }
                                onChange={(
                                  event
                                ) =>
                                  setManualCreateItems(
                                    (
                                      current
                                    ) =>
                                      current.map(
                                        (
                                          row,
                                          rowIndex
                                        ) =>
                                          rowIndex ===
                                          index
                                            ? {
                                                ...row,
                                                quantity:
                                                  event
                                                    .currentTarget
                                                    .value,
                                              }
                                            : row
                                      )
                                  )
                                }
                              />
                            </GastarioField>


                            <GastarioField
                              label="Einheit"
                              required
                            >
                              <GastarioInput
                                value={
                                  item.unit
                                }
                                placeholder="StÃ¼ck, kg, Karton ..."
                                onChange={(
                                  event
                                ) =>
                                  setManualCreateItems(
                                    (
                                      current
                                    ) =>
                                      current.map(
                                        (
                                          row,
                                          rowIndex
                                        ) =>
                                          rowIndex ===
                                          index
                                            ? {
                                                ...row,
                                                unit:
                                                  event
                                                    .currentTarget
                                                    .value,
                                              }
                                            : row
                                      )
                                  )
                                }
                              />
                            </GastarioField>


                            <GastarioField
                              label="Hinweis"
                            >
                              <GastarioInput
                                value={
                                  item.notes
                                }
                                placeholder="optional"
                                onChange={(
                                  event
                                ) =>
                                  setManualCreateItems(
                                    (
                                      current
                                    ) =>
                                      current.map(
                                        (
                                          row,
                                          rowIndex
                                        ) =>
                                          rowIndex ===
                                          index
                                            ? {
                                                ...row,
                                                notes:
                                                  event
                                                    .currentTarget
                                                    .value,
                                              }
                                            : row
                                      )
                                  )
                                }
                              />
                            </GastarioField>

                          </GastarioFormGrid>

                        </div>


                        <div className="g-ui-data-row-meta">

                          <button
                            type="button"
                            className={gastarioButtonClass(
                              "danger"
                            )}
                            disabled={
                              manualCreateItems
                                .length ===
                              1
                            }
                            onClick={() =>
                              setManualCreateItems(
                                (
                                  current
                                ) =>
                                  current.filter(
                                    (
                                      _,
                                      rowIndex
                                    ) =>
                                      rowIndex !==
                                      index
                                  )
                              )
                            }
                          >
                            Entfernen
                          </button>

                        </div>

                      </GastarioDataRow>

                    )
                  )}

                </GastarioDataList>

              </GastarioSection>

            </GastarioStack>

          </Form>

        </GastarioDetailDialog>


        <GastarioDetailDialog
          open={Boolean(
            selectedManualList
          )}
          title={
            selectedManualList
              ?.title ||
            "Einkaufsliste"
          }
          description={
            selectedManualList
              ? "Eigene Einkaufsliste Â· " +
                formatDateOption(
                  normalizeDate(
                    selectedManualList
                      .planningDate
                  )
                )
              : undefined
          }
          onClose={() =>
            setSelectedManualListId(
              null
            )
          }
          footer={
            selectedManualList ? (
              <>

                <button
                  type="button"
                  className={gastarioButtonClass(
                    "secondary"
                  )}
                  onClick={() =>
                    setSelectedManualListId(
                      null
                    )
                  }
                >
                  SchlieÃŸen
                </button>


                <Form method="post">

                  <input
                    type="hidden"
                    name="intent"
                    value="delete-manual-shopping-list"
                  />

                  <input
                    type="hidden"
                    name="listId"
                    value={
                      selectedManualList
                        .id
                    }
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
                    className={gastarioButtonClass(
                      "danger"
                    )}
                    onClick={(
                      event
                    ) => {
                      if (
                        !window.confirm(
                          "Diese Einkaufsliste wirklich lÃ¶schen?"
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Liste lÃ¶schen
                  </button>

                </Form>


                <button
                  type="submit"
                  form="manual-shopping-list-edit"
                  className={gastarioButtonClass(
                    "primary"
                  )}
                >
                  Ã„nderungen speichern
                </button>

              </>
            ) : null
          }
        >

          {selectedManualList ? (

            <Form
              method="post"
              id="manual-shopping-list-edit"
            >

              <input
                type="hidden"
                name="intent"
                value="update-manual-shopping-list"
              />

              <input
                type="hidden"
                name="listId"
                value={
                  selectedManualList.id
                }
              />

              <input
                type="hidden"
                name="returnDate"
                value={
                  data.selectedDate
                }
              />

              <input
                type="hidden"
                name="itemsJson"
                value={JSON.stringify(
                  manualEditItems
                )}
              />


              <GastarioDetailTabs
                activeId={
                  manualListTab
                }
                onChange={
                  setManualListTab
                }
                items={[
                  {
                    id:
                      "overview",
                    label:
                      "Ãœbersicht",
                  },
                  {
                    id:
                      "items",
                    label:
                      "Positionen",
                    badge:
                      manualEditItems
                        .length,
                  },
                ]}
              />


              <GastarioDetailPane
                active={
                  manualListTab ===
                  "overview"
                }
              >

                <GastarioStack>

                  <GastarioFormGrid
                    columns={2}
                  >

                    <GastarioField
                      label="Name der Einkaufsliste"
                      required
                    >
                      <GastarioInput
                        name="title"
                        required
                        maxLength={120}
                        defaultValue={
                          selectedManualList
                            .title
                        }
                      />
                    </GastarioField>


                    <GastarioField
                      label="Planungstag"
                      required
                    >
                      <GastarioInput
                        type="date"
                        name="planningDate"
                        required
                        defaultValue={
                          normalizeDate(
                            selectedManualList
                              .planningDate
                          )
                        }
                      />
                    </GastarioField>

                  </GastarioFormGrid>


                  <GastarioField
                    label="Interne Notiz"
                  >
                    <GastarioTextarea
                      name="notes"
                      defaultValue={
                        selectedManualList
                          .notes || ""
                      }
                      placeholder="Interner Hinweis zur Einkaufsliste"
                    />
                  </GastarioField>


                  <GastarioMetricGrid>

                    <GastarioMetric
                      label="Positionen"
                      value={
                        manualEditItems
                          .length
                      }
                      description="Artikel auf dieser Liste"
                    />

                    <GastarioMetric
                      label="Erledigt"
                      value={
                        manualEditItems.filter(
                          (
                            item
                          ) =>
                            item.checked
                        ).length
                      }
                      description="Bereits abgehakt"
                    />

                    <GastarioMetric
                      label="Offen"
                      value={
                        manualEditItems.filter(
                          (
                            item
                          ) =>
                            !item.checked
                        ).length
                      }
                      description="Noch einzukaufen"
                    />

                  </GastarioMetricGrid>

                </GastarioStack>

              </GastarioDetailPane>


              <GastarioDetailPane
                active={
                  manualListTab ===
                  "items"
                }
              >

                <GastarioStack>

                  <GastarioToolbar>

                    <button
                      type="button"
                      className={gastarioButtonClass(
                        "secondary"
                      )}
                      onClick={() =>
                        setManualEditItems(
                          (
                            current
                          ) => [
                            ...current,
                            emptyManualShoppingItem(),
                          ]
                        )
                      }
                    >
                      + Position hinzufÃ¼gen
                    </button>

                  </GastarioToolbar>


                  <GastarioDataList>

                    {manualEditItems.map(
                      (
                        item: any,
                        index: number
                      ) => (

                        <GastarioDataRow
                          key={
                            "edit-" +
                            index
                          }
                        >

                          <div className="g-ui-data-row-main">

                            <GastarioCheckRow
                              checked={
                                Boolean(
                                  item.checked
                                )
                              }
                              title={
                                item.name ||
                                "Neue Position"
                              }
                              description={
                                item.checked
                                  ? "Erledigt"
                                  : "Noch einzukaufen"
                              }
                              onCheckedChange={(
                                checked
                              ) =>
                                setManualEditItems(
                                  (
                                    current
                                  ) =>
                                    current.map(
                                      (
                                        row,
                                        rowIndex
                                      ) =>
                                        rowIndex ===
                                        index
                                          ? {
                                              ...row,
                                              checked,
                                            }
                                          : row
                                    )
                                )
                              }
                            />


                            <GastarioFormGrid
                              columns={4}
                            >

                              <GastarioField
                                label="Artikel"
                                required
                              >
                                <GastarioInput
                                  value={
                                    item.name
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setManualEditItems(
                                      (
                                        current
                                      ) =>
                                        current.map(
                                          (
                                            row,
                                            rowIndex
                                          ) =>
                                            rowIndex ===
                                            index
                                              ? {
                                                  ...row,
                                                  name:
                                                    event
                                                      .currentTarget
                                                      .value,
                                                }
                                              : row
                                        )
                                    )
                                  }
                                />
                              </GastarioField>


                              <GastarioField
                                label="Menge"
                                required
                              >
                                <GastarioInput
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  value={
                                    item.quantity
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setManualEditItems(
                                      (
                                        current
                                      ) =>
                                        current.map(
                                          (
                                            row,
                                            rowIndex
                                          ) =>
                                            rowIndex ===
                                            index
                                              ? {
                                                  ...row,
                                                  quantity:
                                                    event
                                                      .currentTarget
                                                      .value,
                                                }
                                              : row
                                        )
                                    )
                                  }
                                />
                              </GastarioField>


                              <GastarioField
                                label="Einheit"
                                required
                              >
                                <GastarioInput
                                  value={
                                    item.unit
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setManualEditItems(
                                      (
                                        current
                                      ) =>
                                        current.map(
                                          (
                                            row,
                                            rowIndex
                                          ) =>
                                            rowIndex ===
                                            index
                                              ? {
                                                  ...row,
                                                  unit:
                                                    event
                                                      .currentTarget
                                                      .value,
                                                }
                                              : row
                                        )
                                    )
                                  }
                                />
                              </GastarioField>


                              <GastarioField
                                label="Hinweis"
                              >
                                <GastarioInput
                                  value={
                                    item.notes
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setManualEditItems(
                                      (
                                        current
                                      ) =>
                                        current.map(
                                          (
                                            row,
                                            rowIndex
                                          ) =>
                                            rowIndex ===
                                            index
                                              ? {
                                                  ...row,
                                                  notes:
                                                    event
                                                      .currentTarget
                                                      .value,
                                                }
                                              : row
                                        )
                                    )
                                  }
                                />
                              </GastarioField>

                            </GastarioFormGrid>

                          </div>


                          <div className="g-ui-data-row-meta">

                            <button
                              type="button"
                              className={gastarioButtonClass(
                                "danger"
                              )}
                              disabled={
                                manualEditItems
                                  .length ===
                                1
                              }
                              onClick={() =>
                                setManualEditItems(
                                  (
                                    current
                                  ) =>
                                    current.filter(
                                      (
                                        _,
                                        rowIndex
                                      ) =>
                                        rowIndex !==
                                        index
                                    )
                                )
                              }
                            >
                              Entfernen
                            </button>

                          </div>

                        </GastarioDataRow>

                      )
                    )}

                  </GastarioDataList>

                </GastarioStack>

              </GastarioDetailPane>

            </Form>

          ) : null}

        </GastarioDetailDialog>




        <GastarioSection
          eyebrow="Einkaufsvorschlag"
          title="Einkaufsplan auswÃ¤hlen"
          description="Vergleiche den gÃ¼nstigsten Plan mit einer praktischeren Variante mit weniger Lieferanten."
        >

          <GastarioActionGrid
            columns={2}
          >

            <GastarioActionCard
              title="GÃ¼nstigster Einkaufsplan"
              tone="sage"
              description="Verwendet je Zutat den gÃ¼nstigsten bestÃ¤tigten und aktuell bepreisten Lieferantenartikel."
              meta={
                formatMoney(
                  data.procurementPlan
                    .totalNetCents
                )
              }
              onClick={() => {
                setPlanDetailTab(
                  "overview"
                );

                setSelectedPlanType(
                  "CHEAPEST"
                );
              }}
            />


            <GastarioActionCard
              title="Praktischer Einkaufsplan"
              tone="sand"
              description={
                "Reduziert Lieferanten, solange ein Artikel hÃ¶chstens " +
                data.practicalProcurementPlan
                  .tolerancePercent +
                "% Ã¼ber dem Bestpreis liegt."
              }
              meta={
                formatMoney(
                  data.practicalProcurementPlan
                    .totalNetCents
                )
              }
              onClick={() => {
                setPlanDetailTab(
                  "overview"
                );

                setSelectedPlanType(
                  "PRACTICAL"
                );
              }}
            />

          </GastarioActionGrid>

        </GastarioSection>


        <GastarioDetailDialog
          open={Boolean(
            selectedPlan
          )}
          title={
            selectedPlanLabel
          }
          description={
            selectedPlanType ===
            "CHEAPEST"
              ? "Preisoptimierter Einkaufsplan"
              : "Lieferantenoptimierter Einkaufsplan"
          }
          onClose={() =>
            setSelectedPlanType(
              null
            )
          }
          footer={
            selectedPlan ? (
              <>

                <button
                  type="button"
                  className={gastarioButtonClass(
                    "secondary"
                  )}
                  onClick={() =>
                    setSelectedPlanType(
                      null
                    )
                  }
                >
                  SchlieÃŸen
                </button>


                <button
                  type="button"
                  className={gastarioButtonClass(
                    "secondary"
                  )}
                  disabled={
                    selectedPlan.groups
                      .length === 0
                  }
                  onClick={() =>
                    downloadProcurementCsv({
                      plan:
                        selectedPlan,
                      selectedDate:
                        data.selectedDate,
                      planLabel:
                        selectedPlanLabel,
                      fileSuffix:
                        selectedPlanType ===
                        "CHEAPEST"
                          ? "guenstig"
                          : "praktisch",
                    })
                  }
                >
                  CSV herunterladen
                </button>


                <Form method="post">

                  <input
                    type="hidden"
                    name="intent"
                    value="save-procurement-drafts"
                  />

                  <input
                    type="hidden"
                    name="selectedDate"
                    value={
                      data.selectedDate
                    }
                  />

                  <input
                    type="hidden"
                    name="planType"
                    value={
                      selectedPlanType ||
                      ""
                    }
                  />

                  <input
                    type="hidden"
                    name="groupsJson"
                    value={
                      JSON.stringify(
                        selectedPlan.groups
                      )
                    }
                  />

                  <button
                    type="submit"
                    className={gastarioButtonClass(
                      "primary"
                    )}
                    disabled={
                      selectedPlan.groups
                        .length === 0
                    }
                  >
                    BestellentwÃ¼rfe erstellen
                  </button>

                </Form>

              </>
            ) : null
          }
        >

          {selectedPlan ? (
            <>

              <GastarioDetailTabs
                activeId={
                  planDetailTab
                }
                onChange={
                  setPlanDetailTab
                }
                items={[
                  {
                    id: "overview",
                    label: "Ãœbersicht",
                  },
                  {
                    id: "suppliers",
                    label: "Lieferanten",
                    badge:
                      selectedPlan
                        .supplierCount,
                  },
                ]}
              />


              <GastarioDetailPane
                active={
                  planDetailTab ===
                  "overview"
                }
              >

                <GastarioMetricGrid>

                  <GastarioMetric
                    label="Gesamtsumme netto"
                    value={
                      formatMoney(
                        selectedPlan
                          .totalNetCents
                      )
                    }
                    description="Berechneter Einkaufswert"
                  />

                  <GastarioMetric
                    label="Lieferanten"
                    value={
                      selectedPlan
                        .supplierCount
                    }
                    description="Im ausgewÃ¤hlten Plan"
                  />


                  {selectedPlanType ===
                  "CHEAPEST" ? (

                    <GastarioMetric
                      label="Noch offen"
                      value={
                        selectedPlan
                          .missingItemCount
                      }
                      description="Positionen ohne vollstÃ¤ndigen Preisplan"
                      attention={
                        selectedPlan
                          .missingItemCount >
                        0
                      }
                    />

                  ) : (

                    <GastarioMetric
                      label="Mehrkosten"
                      value={
                        formatMoney(
                          selectedPlan
                            .surchargeCents
                        )
                      }
                      description="GegenÃ¼ber dem gÃ¼nstigsten Plan"
                    />

                  )}


                  {selectedPlanType ===
                  "PRACTICAL" ? (

                    <GastarioMetric
                      label="Schwerpunkt"
                      value={
                        selectedPlan
                          .preferredSupplierName ||
                        "Noch offen"
                      }
                      description="Bevorzugter Lieferant"
                    />

                  ) : null}

                </GastarioMetricGrid>


                {selectedPlanType ===
                  "CHEAPEST" &&
                selectedPlan
                  .missingItemCount >
                  0 ? (

                  <GastarioNotice
                    type="warning"
                  >
                    <strong>
                      {
                        selectedPlan
                          .missingItemCount
                      }{" "}
                      Position(en) sind noch
                      nicht vollstÃ¤ndig.
                    </strong>{" "}
                    DafÃ¼r fehlt eine bestÃ¤tigte
                    Artikelzuordnung,
                    ein aktueller Preis oder
                    eine passende Einheit.
                  </GastarioNotice>

                ) : null}

              </GastarioDetailPane>


              <GastarioDetailPane
                active={
                  planDetailTab ===
                  "suppliers"
                }
              >

                {selectedPlan.groups
                  .length === 0 ? (

                  <GastarioEmptyState
                    title="Noch kein vollstÃ¤ndiger Einkaufsplan"
                  >
                    Ordne zunÃ¤chst Zutaten
                    passenden Lieferantenartikeln
                    zu.
                  </GastarioEmptyState>

                ) : (

                  <GastarioStack>

                    {selectedPlan.groups.map(
                      (group: any) => (

                        <GastarioSection
                          key={
                            group.supplierId ||
                            group.supplierName
                          }
                          eyebrow="Lieferant"
                          title={
                            group.supplierName
                          }
                          description={
                            group.itemCount +
                            " Position(en)"
                          }
                          action={
                            <strong>
                              {formatMoney(
                                group.netTotalCents
                              )}
                            </strong>
                          }
                        >

                          <GastarioDataList>

                            {group.items.map(
                              (item: any) => (

                                <GastarioDataRow
                                  key={
                                    (
                                      item.catalogItemId ||
                                      item.catalogItemName
                                    ) +
                                    "-" +
                                    item.ingredientName
                                  }
                                >

                                  <div className="g-ui-data-row-main">

                                    <strong className="g-ui-data-row-title">
                                      {item.ingredientName}
                                    </strong>

                                    <span className="g-ui-data-row-description">
                                      {item.catalogItemName}
                                      {item.articleNumber
                                        ? " Â· Art.-Nr. " +
                                          item.articleNumber
                                        : ""}
                                      {" Â· "}
                                      {item.packageCount}
                                      {" Ã— "}
                                      {formatQty(
                                        item.packContent
                                      )}
                                      {" "}
                                      {item.baseUnit}
                                    </span>

                                  </div>


                                  <div className="g-ui-data-row-meta">

                                    <strong>
                                      {formatMoney(
                                        item.netTotalCents
                                      )}
                                    </strong>

                                    <span>
                                      {formatMoney(
                                        item.netUnitPriceCents
                                      )}{" "}
                                      je Packung
                                    </span>

                                  </div>

                                </GastarioDataRow>

                              )
                            )}

                          </GastarioDataList>

                        </GastarioSection>

                      )
                    )}

                  </GastarioStack>

                )}

              </GastarioDetailPane>

            </>
          ) : null}

        </GastarioDetailDialog>


        <GastarioSection
          eyebrow="Gespeichert"
          title="BestellentwÃ¼rfe"
          description="Dauerhaft gespeicherte LieferantenentwÃ¼rfe fÃ¼r den gewÃ¤hlten Planungstag."
          id="saved-procurement-drafts"
        >
          {data.savedProcurementDrafts.length ===
          0 ? (
            <GastarioEmptyState title="Noch keine BestellentwÃ¼rfe">
              FÃ¼r diesen Planungstag wurden noch
              keine BestellentwÃ¼rfe gespeichert.
            </GastarioEmptyState>
          ) : (
            <GastarioDataList>
              {data.savedProcurementDrafts.map(
                (draft: any) => (
                  <GastarioDataRow
                    key={draft.id}
                    onClick={() => {
                      setSelectedDraftId(
                        draft.id
                      );

                      setDraftDetailTab(
                        "overview"
                      );
                    }}
                  >
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {draft.supplierName}
                      </strong>

                      <span className="g-ui-data-row-description">
                        {draft.planType ===
                        "PRACTICAL"
                          ? "Praktischer Plan"
                          : "GÃ¼nstigster Plan"}
                        {" Â· "}
                        {draft.items.length} Position(en)
                        {" Â· "}
                        {procurementDraftStatusLabel(
                          draft.status
                        )}
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <strong>
                        {formatMoney(
                          draft.netTotalCents
                        )}
                      </strong>

                      <span
                        className="g-ui-data-row-chevron"
                        aria-hidden="true"
                      >
                        â†’
                      </span>
                    </div>
                  </GastarioDataRow>
                )
              )}
            </GastarioDataList>
          )}
        </GastarioSection>

        <GastarioDetailDialog
          open={Boolean(selectedDraft)}
          title={
            selectedDraft
              ? selectedDraft.supplierName
              : "Bestellentwurf"
          }
          description={
            selectedDraft
              ? `${
                  selectedDraft.planType ===
                  "PRACTICAL"
                    ? "Praktischer Plan"
                    : "GÃ¼nstigster Plan"
                } Â· ${procurementDraftStatusLabel(
                  selectedDraft.status
                )}`
              : undefined
          }
          onClose={() =>
            setSelectedDraftId(null)
          }
          footer={
            selectedDraft ? (
              <GastarioToolbar>
                <button
                  type="button"
                  className={gastarioButtonClass(
                    "secondary"
                  )}
                  onClick={() =>
                    setSelectedDraftId(null)
                  }
                >
                  SchlieÃŸen
                </button>

                <button
                  type="submit"
                  form={`procurement-draft-${selectedDraft.id}`}
                  className={gastarioButtonClass(
                    "primary"
                  )}
                >
                  Ã„nderungen speichern
                </button>
              </GastarioToolbar>
            ) : null
          }
        >
          {selectedDraft ? (
            <Form
              method="post"
              id={`procurement-draft-${selectedDraft.id}`}
            >
              <input
                type="hidden"
                name="intent"
                value="update-procurement-draft"
              />

              <input
                type="hidden"
                name="draftId"
                value={selectedDraft.id}
              />

              <input
                type="hidden"
                name="selectedDate"
                value={data.selectedDate}
              />

              <GastarioDetailTabs
                items={[
                  {
                    id: "overview",
                    label: "Ãœbersicht",
                  },
                  {
                    id: "items",
                    label: "Positionen",
                  },
                ]}
                activeId={draftDetailTab}
                onChange={setDraftDetailTab}
              />

              <GastarioDetailPane
                active={
                  draftDetailTab ===
                  "overview"
                }
              >
                <GastarioMetricGrid>
                  <GastarioMetric
                    label="Netto"
                    value={formatMoney(
                      selectedDraft.netTotalCents
                    )}
                    description="Aktueller Bestellentwurf"
                  />

                  <GastarioMetric
                    label="Positionen"
                    value={
                      selectedDraft.items.length
                    }
                    description="Lieferantenartikel"
                  />
                </GastarioMetricGrid>

                <GastarioField label="Status">
                  <GastarioSelect
                    name="status"
                    defaultValue={
                      selectedDraft.status
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
                  </GastarioSelect>
                </GastarioField>
              </GastarioDetailPane>

              <GastarioDetailPane
                active={
                  draftDetailTab === "items"
                }
              >
                <GastarioDataList>
                  {selectedDraft.items.map(
                    (item: any) => (
                      <GastarioDataRow
                        key={item.id}
                      >
                        <div className="g-ui-data-row-main">
                          <strong className="g-ui-data-row-title">
                            {item.ingredientName}
                          </strong>

                          <span className="g-ui-data-row-description">
                            {item.catalogItemName}
                            {" Â· "}
                            {item.articleNumber
                              ? `Art.-Nr. ${item.articleNumber}`
                              : "Keine Artikelnummer"}
                          </span>
                        </div>

                        <div className="g-ui-data-row-meta">
                          <GastarioField label="Bestellt">
                            <GastarioInput
                              type="number"
                              name={`packageCount_${item.id}`}
                              min="0.01"
                              step="0.01"
                              defaultValue={
                                item.packageCount
                              }
                            />
                          </GastarioField>

                          <GastarioField label="Geliefert">
                            <GastarioInput
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
                          </GastarioField>

                          <strong>
                            {formatMoney(
                              item.netTotalCents
                            )}
                          </strong>
                        </div>
                      </GastarioDataRow>
                    )
                  )}
                </GastarioDataList>
              </GastarioDetailPane>
            </Form>
          ) : null}
        </GastarioDetailDialog>

        <GastarioSection
          eyebrow="Artikelzuordnung"
          title="Zutaten mit Lieferantenartikeln verbinden"
          description="Ordne jede Zutat einem oder mehreren echten Katalogartikeln zu. Gastario vergleicht anschlieÃŸend automatisch PackungsgrÃ¶ÃŸen und aktuelle Preise."
          id="ingredient-mapping"
          action={
            <Link
              className={gastarioButtonClass(
                "secondary"
              )}
              to="/lieferanten"
            >
              Lieferantenkataloge
            </Link>
          }
        >
          {data.ingredientMappings.length === 0 ? (
            <GastarioEmptyState title="Keine berechenbaren Zutaten">
              FÃ¼r den gewÃ¤hlten Planungstag gibt es
              noch keine Zutaten, die einem
              Lieferantenartikel zugeordnet werden
              kÃ¶nnen.
            </GastarioEmptyState>
          ) : (
            <GastarioDataList>
              {data.ingredientMappings.map(
                (ingredient: any) => (
                  <GastarioDataRow
                    key={ingredient.id}
                    onClick={() => {
                      setSelectedIngredientId(
                        ingredient.id
                      );

                      setIngredientDetailTab(
                        "matches"
                      );
                    }}
                  >
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {ingredient.displayName}
                      </strong>

                      <span className="g-ui-data-row-description">
                        Basiseinheit:{" "}
                        {ingredient.baseUnit}
                        {" Â· "}
                        {ingredient.matches.length}{" "}
                        Zuordnung(en)
                        {" Â· "}
                        {(data.candidateSuggestions[
                          ingredient.id
                        ] || []).length}{" "}
                        Vorschlag/VorschlÃ¤ge
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <span
                        className="g-ui-data-row-chevron"
                        aria-hidden="true"
                      >
                        â†’
                      </span>
                    </div>
                  </GastarioDataRow>
                )
              )}
            </GastarioDataList>
          )}
        </GastarioSection>

        <GastarioDetailDialog
          open={Boolean(selectedIngredient)}
          title={
            selectedIngredient
              ? selectedIngredient.displayName
              : "Artikelzuordnung"
          }
          description={
            selectedIngredient
              ? `Basiseinheit: ${selectedIngredient.baseUnit}`
              : undefined
          }
          onClose={() =>
            setSelectedIngredientId(null)
          }
          footer={
            <button
              type="button"
              className={gastarioButtonClass(
                "secondary"
              )}
              onClick={() =>
                setSelectedIngredientId(null)
              }
            >
              SchlieÃŸen
            </button>
          }
        >
          {selectedIngredient ? (
            <>
              <GastarioDetailTabs
                items={[
                  {
                    id: "matches",
                    label: "Zuordnungen",
                  },
                  {
                    id: "add",
                    label: "Neue Zuordnung",
                  },
                ]}
                activeId={ingredientDetailTab}
                onChange={setIngredientDetailTab}
              />

              <GastarioDetailPane
                active={
                  ingredientDetailTab ===
                  "matches"
                }
              >
                {selectedIngredient.matches
                  .length === 0 ? (
                  <GastarioEmptyState title="Noch keine Zuordnung">
                    FÃ¼r diese Zutat wurde noch kein
                    Lieferantenartikel hinterlegt.
                  </GastarioEmptyState>
                ) : (
                  <GastarioDataList>
                    {selectedIngredient.matches.map(
                      (match: any) => {
                        const price =
                          match.catalogItem
                            .prices?.[0] || null;

                        return (
                          <GastarioDataRow
                            key={match.id}
                          >
                            <div className="g-ui-data-row-main">
                              <strong className="g-ui-data-row-title">
                                {
                                  match.catalogItem
                                    .supplier.name
                                }
                              </strong>

                              <span className="g-ui-data-row-description">
                                {
                                  match.catalogItem
                                    .name
                                }
                                {" Â· "}
                                {price
                                  ? `${formatMoney(
                                      price.netPriceCents
                                    )} Â· ${formatPriceAge(
                                      price.fetchedAt
                                    )}`
                                  : "Noch kein Preis vorhanden"}
                                {match.preferred
                                  ? " Â· Bevorzugt"
                                  : ""}
                              </span>
                            </div>

                            <div className="g-ui-data-row-meta">
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
                                  className={gastarioButtonClass(
                                    "danger"
                                  )}
                                >
                                  Entfernen
                                </button>
                              </Form>
                            </div>
                          </GastarioDataRow>
                        );
                      }
                    )}
                  </GastarioDataList>
                )}
              </GastarioDetailPane>

              <GastarioDetailPane
                active={
                  ingredientDetailTab === "add"
                }
              >
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="save-ingredient-match"
                  />

                  <input
                    type="hidden"
                    name="ingredientId"
                    value={
                      selectedIngredient.id
                    }
                  />

                  <input
                    type="hidden"
                    name="returnDate"
                    value={data.selectedDate}
                  />

                  <GastarioStack>
                    <GastarioField
                      label="Lieferantenartikel"
                      required
                    >
                      <GastarioSelect
                        name="catalogItemId"
                        required
                        defaultValue=""
                      >
                        <option
                          value=""
                          disabled
                        >
                          Artikel auswÃ¤hlen â€¦
                        </option>

                        {(data.candidateSuggestions[
                          selectedIngredient.id
                        ] || []).length > 0 ? (
                          <optgroup label="Gastario VorschlÃ¤ge">
                            {(data.candidateSuggestions[
                              selectedIngredient.id
                            ] || []).map(
                              (
                                suggestion: any
                              ) => (
                                <option
                                  key={`suggestion-${suggestion.catalogItemId}`}
                                  value={
                                    suggestion.catalogItemId
                                  }
                                >
                                  {
                                    suggestion.supplierName
                                  }
                                  {" Â· "}
                                  {
                                    suggestion.catalogItemName
                                  }
                                  {suggestion.netPriceCents !==
                                  null
                                    ? ` Â· ${formatMoney(
                                        suggestion.netPriceCents
                                      )}`
                                    : " Â· ohne Preis"}
                                  {` Â· Treffer ${suggestion.score}%`}
                                </option>
                              )
                            )}
                          </optgroup>
                        ) : null}

                        <optgroup label="Alle Katalogartikel">
                          {data.catalogItems.map(
                            (
                              catalogItem: any
                            ) => {
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
                                  {" Â· "}
                                  {
                                    catalogItem.name
                                  }
                                  {latestPrice
                                    ? ` Â· ${formatMoney(
                                        latestPrice.netPriceCents
                                      )}`
                                    : " Â· ohne Preis"}
                                </option>
                              );
                            }
                          )}
                        </optgroup>
                      </GastarioSelect>
                    </GastarioField>

                    <GastarioCheckRow
                      name="preferred"
                      value="true"
                      title="Als bevorzugten Artikel markieren"
                      description="Dieser Artikel wird bei mehreren passenden Zuordnungen bevorzugt."
                    />

                    <GastarioToolbar>
                      <button
                        type="submit"
                        className={gastarioButtonClass(
                          "primary"
                        )}
                      >
                        Zuordnen
                      </button>
                    </GastarioToolbar>
                  </GastarioStack>
                </Form>
              </GastarioDetailPane>
            </>
          ) : null}
        </GastarioDetailDialog>

        {data.missingRecipeItems.length > 0 ? (
          <GastarioSection
            eyebrow="PrÃ¼fung"
            title="Noch nicht berechenbare Positionen"
            description="Diese Positionen werden nicht geraten. Erst nach Zuordnung und Rezeptur flieÃŸen sie in den Einkauf ein."
            action={
              <Link
                className={gastarioButtonClass(
                  "primary"
                )}
                to="/produkte"
              >
                Zuordnungen pflegen
              </Link>
            }
          >
            <GastarioDataList>
              {data.missingRecipeItems.map(
                (item: any) => (
                  <GastarioDataRow
                    key={[
                      item.name,
                      item.reason,
                    ].join("-")}
                  >
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {item.name}
                      </strong>

                      <span className="g-ui-data-row-description">
                        {formatQty(item.quantity)}{" "}
                        {item.unit}
                        {" Â· "}
                        {item.reason}
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      PrÃ¼fen
                    </div>
                  </GastarioDataRow>
                )
              )}
            </GastarioDataList>
          </GastarioSection>
        ) : null}
      </GastarioPage>
    </AppLayout>
  );
}
