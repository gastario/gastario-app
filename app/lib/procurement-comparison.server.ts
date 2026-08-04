type DemandItemInput = {
  supplierName?: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  sources?: any[];
};

type ComparisonOffer = {
  matchId: string;
  supplierId: string;
  supplierName: string;
  catalogItemId: string;
  catalogItemName: string;
  articleNumber: string | null;
  orderUnit: string | null;
  baseUnit: string | null;
  packContent: number;
  packageCount: number;
  plannedQuantity: number;
  netUnitPriceCents: number;
  netTotalCents: number;
  fetchedAt: string;
  available: boolean | null;
  preferred: boolean;
  promotional: boolean;
};

function cleanUnit(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, "");

  const aliases: Record<string, string> = {
    gramm: "g",
    gr: "g",
    kilogramm: "kg",
    kilogram: "kg",
    kgs: "kg",
    milliliter: "ml",
    millilitre: "ml",
    liter: "l",
    litre: "l",
    st: "stueck",
    stk: "stueck",
    stück: "stueck",
    stueck: "stueck",
    piece: "stueck",
    pieces: "stueck",
  };

  return aliases[normalized] || normalized;
}

function normalizeIngredientName(value: unknown) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unitFamily(unit: string) {
  if (unit === "g" || unit === "kg") return "mass";
  if (unit === "ml" || unit === "l") return "volume";
  if (unit === "stueck") return "piece";
  return unit ? `other:${unit}` : "unknown";
}

function convertQuantity(
  quantity: number,
  fromUnitRaw: unknown,
  toUnitRaw: unknown
) {
  const fromUnit = cleanUnit(fromUnitRaw);
  const toUnit = cleanUnit(toUnitRaw);

  if (!Number.isFinite(quantity) || quantity < 0) {
    return null;
  }

  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return quantity;
  }

  if (unitFamily(fromUnit) !== unitFamily(toUnit)) {
    return null;
  }

  if (fromUnit === "g" && toUnit === "kg") {
    return quantity / 1000;
  }

  if (fromUnit === "kg" && toUnit === "g") {
    return quantity * 1000;
  }

  if (fromUnit === "ml" && toUnit === "l") {
    return quantity / 1000;
  }

  if (fromUnit === "l" && toUnit === "ml") {
    return quantity * 1000;
  }

  return null;
}

function latestPrice(prices: any[]) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return null;
  }

  return [...prices].sort(
    (left, right) =>
      new Date(right.fetchedAt).getTime() -
      new Date(left.fetchedAt).getTime()
  )[0];
}

function calculateOffer(params: {
  demand: DemandItemInput;
  match: any;
}): ComparisonOffer | null {
  const { demand, match } = params;
  const catalogItem = match.catalogItem;
  const price = latestPrice(catalogItem?.prices || []);

  if (!catalogItem || !price) {
    return null;
  }

  if (price.available === false) {
    return null;
  }

  const targetUnit =
    catalogItem.baseUnit ||
    price.priceUnit ||
    demand.unit;

  const convertedDemand = convertQuantity(
    Number(demand.quantity || 0),
    demand.unit,
    targetUnit
  );

  if (convertedDemand === null) {
    return null;
  }

  const conversionFactor =
    Number(match.conversionFactor || 1) > 0
      ? Number(match.conversionFactor || 1)
      : 1;

  const adjustedDemand =
    convertedDemand * conversionFactor;

  const packContentCandidates = [
    Number(catalogItem.contentQuantity || 0),
    Number(catalogItem.packageQuantity || 0),
    Number(price.priceUnitQuantity || 0),
  ].filter((value) => Number.isFinite(value) && value > 0);

  const packContent =
    packContentCandidates[0] || 1;

  const minimumOrderQuantity = Math.max(
    1,
    Number(
      price.minimumQuantity ||
        catalogItem.minimumOrderQuantity ||
        1
    ) || 1
  );

  const packageCount = Math.max(
    minimumOrderQuantity,
    Math.ceil(adjustedDemand / packContent)
  );

  const netUnitPriceCents =
    Number(price.netPriceCents || 0);

  if (
    !Number.isFinite(netUnitPriceCents) ||
    netUnitPriceCents < 0
  ) {
    return null;
  }

  return {
    matchId: match.id,
    supplierId: catalogItem.supplier.id,
    supplierName: catalogItem.supplier.name,
    catalogItemId: catalogItem.id,
    catalogItemName: catalogItem.name,
    articleNumber: catalogItem.articleNumber || null,
    orderUnit: catalogItem.orderUnit || null,
    baseUnit: targetUnit || null,
    packContent,
    packageCount,
    plannedQuantity: packageCount * packContent,
    netUnitPriceCents,
    netTotalCents: packageCount * netUnitPriceCents,
    fetchedAt: new Date(price.fetchedAt).toISOString(),
    available:
      typeof price.available === "boolean"
        ? price.available
        : null,
    preferred: match.preferred === true,
    promotional: price.promotional === true,
  };
}

export async function buildProcurementComparisons(params: {
  prisma: any;
  tenantId: string;
  demandItems: DemandItemInput[];
}) {
  const { prisma, tenantId, demandItems } = params;

  const ingredientKeys = new Map<
    string,
    {
      normalizedName: string;
      displayName: string;
      baseUnit: string;
    }
  >();

  for (const demand of demandItems) {
    const normalizedName = normalizeIngredientName(
      demand.ingredientName
    );
    const baseUnit = cleanUnit(demand.unit);

    if (!normalizedName || !baseUnit) {
      continue;
    }

    const key = `${normalizedName}__${baseUnit}`;

    if (!ingredientKeys.has(key)) {
      ingredientKeys.set(key, {
        normalizedName,
        displayName: String(
          demand.ingredientName || ""
        ).trim(),
        baseUnit,
      });
    }
  }

  for (const ingredient of ingredientKeys.values()) {
    await prisma.procurementIngredient.upsert({
      where: {
        tenantId_normalizedName_baseUnit: {
          tenantId,
          normalizedName: ingredient.normalizedName,
          baseUnit: ingredient.baseUnit,
        },
      },
      update: {
        displayName: ingredient.displayName,
        active: true,
      },
      create: {
        tenantId,
        normalizedName: ingredient.normalizedName,
        displayName: ingredient.displayName,
        baseUnit: ingredient.baseUnit,
      },
    });
  }

  const ingredients =
    ingredientKeys.size > 0
      ? await prisma.procurementIngredient.findMany({
          where: {
            tenantId,
            active: true,
            OR: Array.from(
              ingredientKeys.values()
            ).map((ingredient) => ({
              normalizedName:
                ingredient.normalizedName,
              baseUnit: ingredient.baseUnit,
            })),
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
                      take: 5,
                    },
                  },
                },
              },
            },
          },
        })
      : [];

  const ingredientMap = new Map(
    ingredients.map((ingredient: any) => [
      `${ingredient.normalizedName}__${ingredient.baseUnit}`,
      ingredient,
    ])
  );

  let matchedCount = 0;
  let pricedCount = 0;
  let unmatchedCount = 0;

  const items = demandItems.map((demand) => {
    const normalizedName = normalizeIngredientName(
      demand.ingredientName
    );
    const baseUnit = cleanUnit(demand.unit);
    const ingredient = ingredientMap.get(
      `${normalizedName}__${baseUnit}`
    );

    const offers = (ingredient?.matches || [])
      .map((match: any) =>
        calculateOffer({
          demand,
          match,
        })
      )
      .filter(Boolean)
      .sort((left: any, right: any) => {
        if (left.preferred !== right.preferred) {
          return left.preferred ? -1 : 1;
        }

        return (
          left.netTotalCents -
          right.netTotalCents
        );
      }) as ComparisonOffer[];

    if ((ingredient?.matches || []).length > 0) {
      matchedCount += 1;
    } else {
      unmatchedCount += 1;
    }

    if (offers.length > 0) {
      pricedCount += 1;
    }

    return {
      ...demand,
      procurementIngredientId:
        ingredient?.id || null,
      normalizedIngredientName:
        normalizedName,
      offers,
      offersCount: offers.length,
      bestOffer: offers[0] || null,
      comparisonStatus:
        offers.length > 0
          ? "PRICED"
          : (ingredient?.matches || []).length > 0
            ? "NO_CURRENT_PRICE"
            : "UNMATCHED",
    };
  });

  return {
    items,
    stats: {
      total: items.length,
      matched: matchedCount,
      priced: pricedCount,
      unmatched: unmatchedCount,
    },
  };
}
/*
 * gastario-procurement-candidate-suggestions-v1-20260803
 * Lokale Kandidatensuche im bereits importierten
 * Lieferantenkatalog. Keine automatische Zuordnung.
 */

function candidateTokens(value: unknown) {
  const stopWords = new Set([
    "frisch",
    "fresh",
    "bio",
    "classic",
    "premium",
    "roh",
    "gegart",
    "geschnitten",
    "scheiben",
    "stueck",
    "stück",
    "packung",
    "kg",
    "g",
    "ml",
    "l",
  ]);

  return normalizeIngredientName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !stopWords.has(token)
    );
}

function candidateUnitScore(
  ingredientUnitRaw: unknown,
  catalogItem: any
) {
  const ingredientUnit =
    cleanUnit(ingredientUnitRaw);

  const candidateUnits = [
    catalogItem?.baseUnit,
    catalogItem?.orderUnit,
    catalogItem?.prices?.[0]?.priceUnit,
  ]
    .map(cleanUnit)
    .filter(Boolean);

  if (candidateUnits.length === 0) {
    return 4;
  }

  if (
    candidateUnits.some(
      (unit) => unit === ingredientUnit
    )
  ) {
    return 24;
  }

  if (
    candidateUnits.some(
      (unit) =>
        unitFamily(unit) ===
        unitFamily(ingredientUnit)
    )
  ) {
    return 14;
  }

  return -18;
}

function scoreCatalogCandidate(params: {
  ingredient: {
    displayName: string;
    baseUnit: string;
  };
  catalogItem: any;
}) {
  const { ingredient, catalogItem } = params;

  const ingredientName =
    normalizeIngredientName(
      ingredient.displayName
    );

  const searchableText =
    normalizeIngredientName(
      [
        catalogItem.name,
        catalogItem.brand,
        catalogItem.description,
        catalogItem.articleNumber,
      ]
        .filter(Boolean)
        .join(" ")
    );

  if (!ingredientName || !searchableText) {
    return 0;
  }

  const tokens =
    candidateTokens(ingredientName);

  let score = 0;
  let matchedTokens = 0;

  if (searchableText === ingredientName) {
    score += 75;
  } else if (
    searchableText.includes(ingredientName)
  ) {
    score += 55;
  }

  for (const token of tokens) {
    if (searchableText.includes(token)) {
      matchedTokens += 1;
      score += token.length >= 7 ? 18 : 12;
    }
  }

  if (
    tokens.length > 0 &&
    matchedTokens === tokens.length
  ) {
    score += 20;
  }

  score += candidateUnitScore(
    ingredient.baseUnit,
    catalogItem
  );

  const latestPrice =
    catalogItem?.prices?.[0] || null;

  if (latestPrice) {
    score += 8;
  }

  if (latestPrice?.available === false) {
    score -= 35;
  }

  if (catalogItem.active === false) {
    score -= 50;
  }

  return Math.max(0, Math.round(score));
}

export function buildProcurementCandidateSuggestions(params: {
  ingredients: any[];
  catalogItems: any[];
  limit?: number;
}) {
  const {
    ingredients,
    catalogItems,
    limit = 5,
  } = params;

  const result: Record<string, any[]> = {};

  for (const ingredient of ingredients) {
    result[ingredient.id] = catalogItems
      .map((catalogItem) => {
        const latestPrice =
          catalogItem?.prices?.[0] || null;

        return {
          catalogItemId: catalogItem.id,
          supplierName:
            catalogItem.supplier?.name ||
            "Unbekannter Lieferant",
          catalogItemName:
            catalogItem.name,
          netPriceCents:
            latestPrice?.netPriceCents ?? null,
          fetchedAt:
            latestPrice?.fetchedAt ?? null,
          available:
            latestPrice?.available ?? null,
          score: scoreCatalogCandidate({
            ingredient,
            catalogItem,
          }),
        };
      })
      .filter(
        (candidate) =>
          candidate.score >= 24
      )
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        const leftPrice =
          left.netPriceCents ??
          Number.MAX_SAFE_INTEGER;

        const rightPrice =
          right.netPriceCents ??
          Number.MAX_SAFE_INTEGER;

        return leftPrice - rightPrice;
      })
      .slice(0, limit);
  }

  return result;
}
/*
 * gastario-procurement-cheapest-plan-v1-20260804
 * Erstellt aus den bestätigten Artikelzuordnungen
 * einen nach Lieferanten gruppierten günstigsten Einkaufsplan.
 */
export function buildCheapestProcurementPlan(
  items: any[]
) {
  const selectedItems = items
    .map((item) => {
      const cheapestOffer = Array.isArray(item.offers)
        ? [...item.offers].sort(
            (left: any, right: any) =>
              Number(left.netTotalCents || 0) -
              Number(right.netTotalCents || 0)
          )[0] || null
        : null;

      return {
        ingredientName: item.ingredientName,
        demandQuantity: Number(item.quantity || 0),
        demandUnit: item.unit,
        sources: item.sources || [],
        offer: cheapestOffer,
      };
    });

  const pricedItems = selectedItems.filter(
    (item) => item.offer
  );

  const missingItems = selectedItems.filter(
    (item) => !item.offer
  );

  const groupMap = new Map<string, any>();

  for (const item of pricedItems) {
    const offer = item.offer;
    const supplierKey =
      offer.supplierId ||
      offer.supplierName;

    let group = groupMap.get(supplierKey);

    if (!group) {
      group = {
        supplierId: offer.supplierId,
        supplierName: offer.supplierName,
        netTotalCents: 0,
        itemCount: 0,
        items: [],
      };

      groupMap.set(supplierKey, group);
    }

    group.items.push({
      ingredientName: item.ingredientName,
      demandQuantity: item.demandQuantity,
      demandUnit: item.demandUnit,
      catalogItemId: offer.catalogItemId,
      catalogItemName: offer.catalogItemName,
      articleNumber: offer.articleNumber,
      packageCount: offer.packageCount,
      packContent: offer.packContent,
      baseUnit: offer.baseUnit,
      plannedQuantity: offer.plannedQuantity,
      netUnitPriceCents: offer.netUnitPriceCents,
      netTotalCents: offer.netTotalCents,
      fetchedAt: offer.fetchedAt,
      promotional: offer.promotional,
    });

    group.itemCount += 1;
    group.netTotalCents += Number(
      offer.netTotalCents || 0
    );
  }

  const groups = Array.from(
    groupMap.values()
  )
    .map((group: any) => ({
      ...group,
      items: group.items.sort(
        (left: any, right: any) =>
          left.ingredientName.localeCompare(
            right.ingredientName,
            "de"
          )
      ),
    }))
    .sort((left: any, right: any) =>
      left.supplierName.localeCompare(
        right.supplierName,
        "de"
      )
    );

  return {
    groups,
    totalNetCents: groups.reduce(
      (sum: number, group: any) =>
        sum + group.netTotalCents,
      0
    ),
    supplierCount: groups.length,
    pricedItemCount: pricedItems.length,
    missingItemCount: missingItems.length,
    missingItems: missingItems.map((item) => ({
      ingredientName: item.ingredientName,
      quantity: item.demandQuantity,
      unit: item.demandUnit,
    })),
  };
}
/*
 * gastario-procurement-practical-plan-v1-20260804
 * Reduziert die Zahl der Lieferanten, solange ein Artikel
 * beim gleichen Lieferanten höchstens 10 Prozent teurer ist.
 */
export function buildPracticalProcurementPlan(
  items: any[],
  tolerancePercent = 10
) {
  const pricedItems = items.filter(
    (item) =>
      Array.isArray(item.offers) &&
      item.offers.length > 0
  );

  const supplierCoverage = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      coveredItems: number;
      totalNetCents: number;
    }
  >();

  for (const item of pricedItems) {
    const seenSuppliers = new Set<string>();

    for (const offer of item.offers) {
      const supplierKey =
        offer.supplierId ||
        offer.supplierName;

      if (seenSuppliers.has(supplierKey)) {
        continue;
      }

      seenSuppliers.add(supplierKey);

      const current =
        supplierCoverage.get(supplierKey) || {
          supplierId: offer.supplierId,
          supplierName: offer.supplierName,
          coveredItems: 0,
          totalNetCents: 0,
        };

      current.coveredItems += 1;
      current.totalNetCents += Number(
        offer.netTotalCents || 0
      );

      supplierCoverage.set(
        supplierKey,
        current
      );
    }
  }

  const preferredSupplier =
    Array.from(supplierCoverage.values())
      .sort((left, right) => {
        if (
          right.coveredItems !==
          left.coveredItems
        ) {
          return (
            right.coveredItems -
            left.coveredItems
          );
        }

        return (
          left.totalNetCents -
          right.totalNetCents
        );
      })[0] || null;

  const selectedItems = items.map((item) => {
    const offers = Array.isArray(item.offers)
      ? [...item.offers].sort(
          (left: any, right: any) =>
            Number(left.netTotalCents || 0) -
            Number(right.netTotalCents || 0)
        )
      : [];

    const cheapestOffer = offers[0] || null;

    if (!cheapestOffer) {
      return {
        ingredientName: item.ingredientName,
        demandQuantity: Number(
          item.quantity || 0
        ),
        demandUnit: item.unit,
        offer: null,
      };
    }

    const practicalOffer =
      preferredSupplier
        ? offers.find(
            (offer: any) =>
              (
                offer.supplierId ||
                offer.supplierName
              ) ===
              (
                preferredSupplier.supplierId ||
                preferredSupplier.supplierName
              )
          ) || null
        : null;

    const maximumAcceptedCost =
      Number(cheapestOffer.netTotalCents || 0) *
      (1 + tolerancePercent / 100);

    const selectedOffer =
      practicalOffer &&
      Number(
        practicalOffer.netTotalCents || 0
      ) <= maximumAcceptedCost
        ? practicalOffer
        : cheapestOffer;

    return {
      ingredientName: item.ingredientName,
      demandQuantity: Number(
        item.quantity || 0
      ),
      demandUnit: item.unit,
      offer: selectedOffer,
      cheapestNetTotalCents: Number(
        cheapestOffer.netTotalCents || 0
      ),
    };
  });

  const groupMap = new Map<string, any>();

  for (const item of selectedItems.filter(
    (entry) => entry.offer
  )) {
    const offer = item.offer;
    const supplierKey =
      offer.supplierId ||
      offer.supplierName;

    let group = groupMap.get(supplierKey);

    if (!group) {
      group = {
        supplierId: offer.supplierId,
        supplierName: offer.supplierName,
        netTotalCents: 0,
        itemCount: 0,
        items: [],
      };

      groupMap.set(supplierKey, group);
    }

    group.items.push({
      ingredientName: item.ingredientName,
      catalogItemId: offer.catalogItemId,
      catalogItemName: offer.catalogItemName,
      articleNumber: offer.articleNumber,
      packageCount: offer.packageCount,
      packContent: offer.packContent,
      baseUnit: offer.baseUnit,
      netUnitPriceCents:
        offer.netUnitPriceCents,
      netTotalCents:
        offer.netTotalCents,
      surchargeCents: Math.max(
        0,
        Number(offer.netTotalCents || 0) -
          Number(
            item.cheapestNetTotalCents || 0
          )
      ),
    });

    group.itemCount += 1;
    group.netTotalCents += Number(
      offer.netTotalCents || 0
    );
  }

  const groups = Array.from(
    groupMap.values()
  ).sort((left: any, right: any) =>
    left.supplierName.localeCompare(
      right.supplierName,
      "de"
    )
  );

  const totalNetCents = groups.reduce(
    (sum: number, group: any) =>
      sum + group.netTotalCents,
    0
  );

  const cheapestTotalNetCents =
    selectedItems.reduce(
      (sum, item) =>
        sum +
        Number(
          item.cheapestNetTotalCents || 0
        ),
      0
    );

  return {
    groups,
    supplierCount: groups.length,
    totalNetCents,
    cheapestTotalNetCents,
    surchargeCents: Math.max(
      0,
      totalNetCents -
        cheapestTotalNetCents
    ),
    tolerancePercent,
    missingItemCount:
      selectedItems.filter(
        (item) => !item.offer
      ).length,
    preferredSupplierName:
      preferredSupplier?.supplierName ||
      null,
  };
}