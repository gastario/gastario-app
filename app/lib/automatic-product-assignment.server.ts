type AutomaticAssignmentParams = {
  prisma: any;
  tenantId: string;
  orders: any[];
};

type ProductCandidate = {
  id: string;
  name: string;
  unit: string;
  active: boolean;
  operationalArea: string;
  recipeItems: any[];
};

const SERVICE_LOGISTICS_PATTERNS = [
  "lieferung",
  "abholung",
  "anlieferung",
  "transport",
  "logistik",
  "delivery",
  "pickup",
  "fahrtkosten",
  "lieferkosten",
  "liefergebuehr",
  "lieferpauschale",
];

const NON_OPERATIONAL_PATTERNS = [
  "servicepauschale",
  "servicegebuehr",
  "bearbeitungsgebuehr",
  "rabatt",
  "gutschrift",
  "deposit",
  "kaution",
  "trinkgeld",
  "tips",
  "summe",
  "gesamtbetrag",
  "mwst",
  "umsatzsteuer",
];

const STOP_WORDS = new Set([
  "mit",
  "und",
  "auf",
  "an",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einer",
  "einem",
  "einen",
  "von",
  "im",
  "in",
  "zum",
  "zur",
  "pro",
  "portion",
  "portionen",
  "stueck",
  "stk",
]);

function normalizeName(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactName(value: unknown) {
  return normalizeName(value).replace(/\s+/g, "");
}

function meaningfulTokens(value: unknown) {
  return normalizeName(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 2 &&
        !STOP_WORDS.has(token)
    );
}

function diceCoefficient(
  leftValue: unknown,
  rightValue: unknown
) {
  const left = compactName(leftValue);
  const right = compactName(rightValue);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.length < 2 || right.length < 2) {
    return 0;
  }

  const pairs = (text: string) => {
    const values: string[] = [];

    for (
      let index = 0;
      index < text.length - 1;
      index += 1
    ) {
      values.push(
        text.slice(index, index + 2)
      );
    }

    return values;
  };

  const rightPairs = pairs(right);
  let intersection = 0;

  for (const pair of pairs(left)) {
    const foundIndex =
      rightPairs.indexOf(pair);

    if (foundIndex >= 0) {
      intersection += 1;
      rightPairs.splice(foundIndex, 1);
    }
  }

  return (
    (2 * intersection) /
    (left.length - 1 + right.length - 1)
  );
}

function tokenCoverage(
  sourceValue: unknown,
  productValue: unknown
) {
  const sourceTokens =
    meaningfulTokens(sourceValue);

  const productTokens =
    meaningfulTokens(productValue);

  if (
    sourceTokens.length === 0 ||
    productTokens.length === 0
  ) {
    return 0;
  }

  const productSet = new Set(productTokens);

  const matches = sourceTokens.filter(
    (token) => productSet.has(token)
  ).length;

  return (
    matches /
    Math.max(
      sourceTokens.length,
      productTokens.length
    )
  );
}

function productScore(
  sourceName: string,
  productName: string
) {
  const sourceNormalized =
    normalizeName(sourceName);

  const productNormalized =
    normalizeName(productName);

  if (
    !sourceNormalized ||
    !productNormalized
  ) {
    return 0;
  }

  if (
    sourceNormalized ===
    productNormalized
  ) {
    return 1;
  }

  const sourceCompact =
    compactName(sourceName);

  const productCompact =
    compactName(productName);

  if (
    sourceCompact ===
    productCompact
  ) {
    return 0.99;
  }

  const dice = diceCoefficient(
    sourceName,
    productName
  );

  const coverage = tokenCoverage(
    sourceName,
    productName
  );

  const contains =
    sourceNormalized.includes(
      productNormalized
    ) ||
    productNormalized.includes(
      sourceNormalized
    );

  return Math.min(
    1,
    dice * 0.62 +
      coverage * 0.33 +
      (contains ? 0.05 : 0)
  );
}

function detectServiceArea(name: unknown) {
  const normalized = normalizeName(name);
  const compact = compactName(name);

  if (
    SERVICE_LOGISTICS_PATTERNS.some(
      (pattern) =>
        normalized.includes(pattern) ||
        compact.includes(pattern)
    )
  ) {
    return "LOGISTICS";
  }

  if (
    NON_OPERATIONAL_PATTERNS.some(
      (pattern) =>
        normalized.includes(pattern) ||
        compact.includes(pattern)
    )
  ) {
    return "NON_OPERATIONAL";
  }

  return null;
}

function effectiveArea(item: any) {
  return String(
    item?.operationalArea ||
      item?.product?.operationalArea ||
      "REVIEW"
  ).toUpperCase();
}

function cloneProductForOrder(
  product: ProductCandidate
) {
  return {
    ...product,
    recipeItems:
      Array.isArray(product.recipeItems)
        ? product.recipeItems
        : [],
  };
}

export async function automaticallyAssignOrderItems({
  prisma,
  tenantId,
  orders,
}: AutomaticAssignmentParams) {
  const products: ProductCandidate[] =
    await prisma.product.findMany({
      where: {
        tenantId,
        active: true,
      },
      include: {
        recipeItems: true,
      },
      orderBy: {
        name: "asc",
      },
    });

  const mappings =
    await prisma.productMapping.findMany({
      where: {
        tenantId,
      },
      include: {
        product: {
          include: {
            recipeItems: true,
          },
        },
      },
    });

  const mappingMap = new Map<
    string,
    any
  >();

  for (const mapping of mappings) {
    mappingMap.set(
      [
        String(mapping.source),
        normalizeName(
          mapping.externalName
        ),
      ].join("::"),
      mapping
    );
  }

  const updates: any[] = [];
  const decisions: any[] = [];

  for (const order of orders) {
    for (const item of order.items || []) {
      const currentArea =
        effectiveArea(item);

      if (
        currentArea !== "REVIEW" &&
        (item.productId || item.product)
      ) {
        continue;
      }

      const itemName = String(
        item.name || ""
      ).trim();

      if (!itemName) {
        continue;
      }

      const serviceArea =
        detectServiceArea(itemName);

      if (serviceArea) {
        updates.push(
          prisma.orderItem.update({
            where: {
              id: item.id,
            },
            data: {
              productId: null,
              operationalArea:
                serviceArea,
              operationalQuantity:
                item.operationalQuantity ??
                Number(
                  item.quantity || 0
                ),
              operationalUnit:
                item.operationalUnit ||
                item.unit ||
                "Stueck",
            },
          })
        );

        item.productId = null;
        item.product = null;
        item.operationalArea =
          serviceArea;

        decisions.push({
          itemId: item.id,
          itemName,
          type: "SERVICE",
          area: serviceArea,
          confidence: 100,
        });

        continue;
      }

      const mappingKey = [
        String(order.source),
        normalizeName(itemName),
      ].join("::");

      const learnedMapping =
        mappingMap.get(mappingKey);

      if (
        learnedMapping?.product?.active
      ) {
        const product =
          learnedMapping.product;

        updates.push(
          prisma.orderItem.update({
            where: {
              id: item.id,
            },
            data: {
              productId: product.id,
              operationalArea: null,
              operationalQuantity:
                item.operationalQuantity ??
                Number(
                  item.quantity || 0
                ),
              operationalUnit:
                item.operationalUnit ||
                product.unit ||
                item.unit ||
                "Stueck",
            },
          })
        );

        item.productId = product.id;
        item.product =
          cloneProductForOrder(product);
        item.operationalArea = null;

        decisions.push({
          itemId: item.id,
          itemName,
          type: "LEARNED",
          productId: product.id,
          productName: product.name,
          confidence: 100,
        });

        continue;
      }

      const ranked = products
        .map((product) => ({
          product,
          score: productScore(
            itemName,
            product.name
          ),
        }))
        .sort(
          (left, right) =>
            right.score - left.score
        );

      const best = ranked[0];
      const second = ranked[1];

      if (!best) {
        continue;
      }

      const margin =
        best.score -
        Number(second?.score || 0);

      const exact =
        normalizeName(itemName) ===
          normalizeName(
            best.product.name
          ) ||
        compactName(itemName) ===
          compactName(
            best.product.name
          );

      const safeFuzzy =
        best.score >= 0.9 &&
        margin >= 0.12;

      if (!exact && !safeFuzzy) {
        decisions.push({
          itemId: item.id,
          itemName,
          type: "REVIEW",
          suggestedProductId:
            best.product.id,
          suggestedProductName:
            best.product.name,
          confidence: Math.round(
            best.score * 100
          ),
        });

        continue;
      }

      const product = best.product;

      updates.push(
        prisma.orderItem.update({
          where: {
            id: item.id,
          },
          data: {
            productId: product.id,
            operationalArea: null,
            operationalQuantity:
              item.operationalQuantity ??
              Number(
                item.quantity || 0
              ),
            operationalUnit:
              item.operationalUnit ||
              product.unit ||
              item.unit ||
              "Stueck",
          },
        })
      );

      item.productId = product.id;
      item.product =
        cloneProductForOrder(product);
      item.operationalArea = null;

      decisions.push({
        itemId: item.id,
        itemName,
        type: exact
          ? "EXACT"
          : "FUZZY",
        productId: product.id,
        productName: product.name,
        confidence: exact
          ? 100
          : Math.round(
              best.score * 100
            ),
      });
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  return {
    assignedCount: decisions.filter(
      (decision) =>
        decision.type !== "REVIEW"
    ).length,
    productCount: decisions.filter(
      (decision) =>
        [
          "LEARNED",
          "EXACT",
          "FUZZY",
        ].includes(decision.type)
    ).length,
    serviceCount: decisions.filter(
      (decision) =>
        decision.type === "SERVICE"
    ).length,
    reviewCount: decisions.filter(
      (decision) =>
        decision.type === "REVIEW"
    ).length,
    decisions,
  };
}