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