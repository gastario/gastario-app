import type {
  NetworkObservation,
  NormalizedSupplierProduct,
  SupplierPriceTier
} from "../types.js";

import type {
  SupplierAdapter,
  SupplierEndpointKind
} from "./types.js";

type JsonRecord =
  Record<string, unknown>;

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function text(
  value: unknown
) {
  return (
    typeof value === "string" &&
    value.trim()
      ? value.trim()
      : null
  );
}

function numberValue(
  value: unknown
) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const normalized =
      value
        .trim()
        .replace(",", ".")
        .replace(
          /[^0-9.-]/g,
          ""
        );

    if (
      normalized &&
      Number.isFinite(
        Number(normalized)
      )
    ) {
      return Number(normalized);
    }
  }

  return null;
}

function moneyToCents(
  value: unknown
) {
  const parsed =
    numberValue(value);

  if (
    parsed == null ||
    parsed <= 0 ||
    parsed > 100_000
  ) {
    return null;
  }

  return Math.round(
    parsed * 100
  );
}

function firstString(
  ...values: unknown[]
) {
  for (const value of values) {
    const candidate =
      text(value);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function firstArrayString(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    if (typeof item === "string") {
      const candidate =
        item.trim();

      if (candidate) {
        return candidate;
      }
    }

    if (isRecord(item)) {
      const candidate =
        firstString(
          item.ean,
          item.gtin,
          item.value,
          item.id
        );

      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function normalizeAvailability(
  value: unknown
) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes(
      "available"
    ) ||
    normalized.includes(
      "verfügbar"
    ) ||
    normalized === "true"
  ) {
    return true;
  }

  if (
    normalized.includes(
      "unavailable"
    ) ||
    normalized.includes(
      "nicht verfügbar"
    ) ||
    normalized.includes(
      "outofstock"
    ) ||
    normalized === "false"
  ) {
    return false;
  }

  return null;
}

function readWeight(
  value: unknown
) {
  if (!isRecord(value)) {
    return {
      value: null,
      unit: null
    };
  }

  return {
    value:
      numberValue(
        value.value
      ),
    unit:
      firstString(
        value.uom,
        value.unit
      )
  };
}

function classifyMetroEndpoint(
  value: string
): SupplierEndpointKind {
  let pathname = "";

  try {
    pathname =
      new URL(value).pathname;
  } catch {
    pathname =
      value.split("?")[0];
  }

  if (
    pathname ===
    "/searchdiscover/articlesearch/search"
  ) {
    return "PRODUCT_SEARCH";
  }

  if (
    pathname ===
    "/evaluate.article.v1/betty-variants"
  ) {
    return "PRODUCT_VARIANTS";
  }

  if (
    pathname ===
    "/evaluate.article.v1/substitutes" ||
    pathname.includes(
      "/evaluate.article.v1/replacements/"
    )
  ) {
    return "PRODUCT_SUBSTITUTES";
  }

  if (
    pathname.includes(
      "/searchdiscover/navigationmenu/"
    ) ||
    pathname.includes(
      "/searchdiscover/category/"
    )
  ) {
    return "NAVIGATION";
  }

  if (
    pathname.includes(
      "/customer/"
    ) ||
    pathname.includes(
      "/businessaccounts/"
    ) ||
    pathname.includes(
      "/personallists/"
    ) ||
    pathname.includes(
      "/orderhistory/"
    )
  ) {
    return "ACCOUNT";
  }

  if (
    pathname.includes(
      "/customercart/"
    ) ||
    pathname.includes(
      "/checkout/"
    )
  ) {
    return "CART";
  }

  if (
    pathname.includes(
      "/price-config/"
    ) ||
    pathname.includes(
      "/uidispatcher/"
    ) ||
    pathname.includes(
      "/storeinfo/"
    ) ||
    pathname.includes(
      "/depotsettings/"
    ) ||
    pathname.includes(
      "/i18n/"
    )
  ) {
    return "CONFIG";
  }

  return "OTHER";
}

function extractPriceTiers(
  priceInfo: JsonRecord
): SupplierPriceTier[] {
  const tiers:
    SupplierPriceTier[] = [];

  const summary =
    isRecord(
      priceInfo.summaryDnrInfo
    )
      ? priceInfo.summaryDnrInfo
      : null;

  const levels =
    summary &&
    isRecord(summary.levels)
      ? summary.levels
      : null;

  if (!levels) {
    return tiers;
  }

  for (
    const [minimumText, rawLevel]
    of Object.entries(levels)
  ) {
    if (!isRecord(rawLevel)) {
      continue;
    }

    const minimum =
      numberValue(
        minimumText
      );

    if (
      minimum == null ||
      minimum <= 0
    ) {
      continue;
    }

    const net =
      moneyToCents(
        firstString(
          rawLevel.finalSingleNetPrice,
          rawLevel.price
        )
      );

    const gross =
      moneyToCents(
        firstString(
          rawLevel.finalSingleGrossPrice
        )
      );

    if (
      net == null &&
      gross == null
    ) {
      continue;
    }

    tiers.push({
      minimumQuantity:
        minimum,
      netPriceCents:
        net,
      grossPriceCents:
        gross,
      label:
        `ab ${minimum}`
    });
  }

  return tiers.sort(
    (a, b) =>
      a.minimumQuantity -
      b.minimumQuantity
  );
}

function productFromBundle(
  bundle: JsonRecord,
  fallback?: {
    articleId?: string | null;
    variantId?: string | null;
  }
): NormalizedSupplierProduct | null {
  const title =
    firstString(
      bundle.title,
      bundle.description,
      bundle.longDescription,
      bundle.variantText
    );

  const bundleId =
    firstString(
      bundle.bundleId,
      bundle.bettyBundleId
    );

  const articleNumber =
    firstString(
      bundle.customerDisplayId,
      bundle.displayId,
      bundle.customArticleNumber
    );

  if (
    !title ||
    (
      !bundleId &&
      !articleNumber
    )
  ) {
    return null;
  }

  const priceInfo =
    isRecord(
      bundle.priceInfo
    )
      ? bundle.priceInfo
      : null;

  const finalPrices =
    priceInfo &&
    isRecord(
      priceInfo.finalPricesInfo
    )
      ? priceInfo.finalPricesInfo
      : null;

  const netPriceCents =
    priceInfo
      ? (
          moneyToCents(
            priceInfo.netPrice
          ) ??
          moneyToCents(
            finalPrices?.articleNet
          ) ??
          moneyToCents(
            finalPrices?.singleSumNet
          )
        )
      : null;

  const grossPriceCents =
    priceInfo
      ? (
          moneyToCents(
            priceInfo.grossPrice
          ) ??
          moneyToCents(
            finalPrices?.articleGross
          ) ??
          moneyToCents(
            finalPrices?.singleSumGross
          )
        )
      : null;

  const weight =
    readWeight(
      bundle.weightPerPiece
    );

  const packagingType =
    firstString(
      bundle.packagingType
    );

  const orderUnit =
    packagingType ||
    (
      weight.unit
        ? weight.unit
        : null
    );

  const packageText =
    weight.value != null &&
    weight.unit
      ? `${weight.value} ${weight.unit}`
      : packagingType;

  const availabilityText =
    firstString(
      bundle.customerAvailability,
      bundle.availability
    );

  const minOrderQuantity =
    numberValue(
      bundle.minOrderQuantity
    );

  const tiers =
    priceInfo
      ? extractPriceTiers(
          priceInfo
        )
      : [];

  const externalId =
    bundleId ||
    fallback?.variantId ||
    fallback?.articleId ||
    null;

  const ean =
    firstArrayString(
      bundle.eanNumber
    ) ||
    firstArrayString(
      bundle.gtins
    );

  const confidence =
    (
      title &&
      externalId &&
      (
        netPriceCents != null ||
        grossPriceCents != null
      )
    )
      ? "HIGH"
      : (
          title &&
          externalId
        )
        ? "MEDIUM"
        : "LOW";

  return {
    supplierKey:
      "metro",

    externalId,

    articleNumber,

    ean,

    name:
      title,

    brand:
      firstString(
        bundle.brandName
      ),

    orderUnit,

    packageText,

    netPriceCents,

    grossPriceCents,

    currency:
      firstString(
        priceInfo?.currency
      ) === "EUR"
        ? "EUR"
        : "EUR",

    tiers,

    available:
      normalizeAvailability(
        availabilityText
      ),

    availabilityText,

    productUrl:
      null,

    source:
      "NETWORK",

    confidence,

    capturedAt:
      new Date()
        .toISOString()
  };
}

function extractSubstituteProducts(
  observation:
    NetworkObservation
) {
  if (
    !Array.isArray(
      observation.body
    )
  ) {
    return [];
  }

  const products:
    NormalizedSupplierProduct[] = [];

  const seen =
    new Set<string>();

  for (
    const rawArticle
    of observation.body
  ) {
    if (!isRecord(rawArticle)) {
      continue;
    }

    const fallback = {
      articleId:
        firstString(
          rawArticle.articleId
        ),
      variantId:
        firstString(
          rawArticle.variantId
        )
    };

    const bundles =
      Array.isArray(
        rawArticle.bundles
      )
        ? rawArticle.bundles
        : [];

    for (
      const rawBundle
      of bundles
    ) {
      if (!isRecord(rawBundle)) {
        continue;
      }

      const product =
        productFromBundle(
          rawBundle,
          fallback
        );

      if (!product) {
        continue;
      }

      const key =
        [
          product.externalId,
          product.articleNumber,
          product.name
        ]
          .filter(Boolean)
          .join("|")
          .toLowerCase();

      if (
        !key ||
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);
      products.push(product);
    }
  }

  return products;
}

function extractVariantProducts(
  observation:
    NetworkObservation
) {
  if (
    !isRecord(
      observation.body
    )
  ) {
    return [];
  }

  const result =
    isRecord(
      observation.body.result
    )
      ? observation.body.result
      : null;

  if (!result) {
    return [];
  }

  const products:
    NormalizedSupplierProduct[] = [];

  const seen =
    new Set<string>();

  for (
    const [
      articleKey,
      rawArticle
    ]
    of Object.entries(result)
  ) {
    if (!isRecord(rawArticle)) {
      continue;
    }

    const variants =
      isRecord(
        rawArticle.variants
      )
        ? rawArticle.variants
        : null;

    if (!variants) {
      continue;
    }

    for (
      const [
        variantKey,
        rawVariant
      ]
      of Object.entries(
        variants
      )
    ) {
      if (!isRecord(rawVariant)) {
        continue;
      }

      const bundles =
        isRecord(
          rawVariant.bundles
        )
          ? rawVariant.bundles
          : null;

      if (!bundles) {
        continue;
      }

      for (
        const rawBundle
        of Object.values(
          bundles
        )
      ) {
        if (!isRecord(rawBundle)) {
          continue;
        }

        /*
         * VARIANTS liefert reichhaltige Produkt-/Gebindedaten,
         * aber in der beobachteten Struktur noch keine priceInfo.
         * Der Datensatz ist deshalb maximal MEDIUM, bis ein
         * priced SUBSTITUTE/weiterer Preis-Response denselben
         * Bundle-Identifier ergänzt.
         */
        const title =
          firstString(
            rawBundle.description,
            rawBundle.longDescription,
            rawBundle.variantText,
            rawVariant.description
          );

        const externalId =
          firstString(
            rawBundle.bettyBundleId,
            rawBundle.bundleId
          );

        if (
          !title ||
          !externalId
        ) {
          continue;
        }

        const weight =
          readWeight(
            rawBundle.weightPerPiece
          );

        const availabilityText =
          firstString(
            rawBundle.customerAvailability,
            rawBundle.availability,
            rawVariant.availability
          );

        const product:
          NormalizedSupplierProduct = {
            supplierKey:
              "metro",

            externalId,

            articleNumber:
              firstString(
                rawBundle.customerDisplayId,
                rawBundle.displayId
              ),

            ean:
              firstArrayString(
                rawBundle.eanNumber
              ) ||
              firstArrayString(
                rawBundle.gtins
              ),

            name:
              title,

            brand:
              firstString(
                rawBundle.brandName,
                rawArticle.brandName
              ),

            orderUnit:
              firstString(
                rawBundle.packagingType
              ) ||
              weight.unit,

            packageText:
              weight.value != null &&
              weight.unit
                ? `${weight.value} ${weight.unit}`
                : firstString(
                    rawBundle.packagingType
                  ),

            netPriceCents:
              null,

            grossPriceCents:
              null,

            currency:
              "EUR",

            tiers: [],

            available:
              normalizeAvailability(
                availabilityText
              ),

            availabilityText,

            productUrl:
              null,

            source:
              "NETWORK",

            confidence:
              "MEDIUM",

            capturedAt:
              observation.capturedAt
          };

        const key =
          [
            articleKey,
            variantKey,
            product.externalId
          ]
            .join("|")
            .toLowerCase();

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        products.push(product);
      }
    }
  }

  return products;
}

export const metroAdapter:
  SupplierAdapter = {
    key:
      "metro",

    displayName:
      "METRO",

    hosts: [
      "lieferservice.metro.de"
    ],

    matchesUrl(
      url: string
    ) {
      try {
        const hostname =
          new URL(url)
            .hostname
            .toLowerCase();

        return (
          hostname ===
            "lieferservice.metro.de" ||
          hostname.endsWith(
            ".lieferservice.metro.de"
          )
        );
      } catch {
        return false;
      }
    },

    classifyEndpoint(
      url: string
    ) {
      return classifyMetroEndpoint(
        url
      );
    },

    async extractNetworkProducts(
      observation
    ) {
      const kind =
        classifyMetroEndpoint(
          observation.url
        );

      if (
        kind ===
        "PRODUCT_SUBSTITUTES"
      ) {
        return extractSubstituteProducts(
          observation
        );
      }

      if (
        kind ===
        "PRODUCT_VARIANTS"
      ) {
        return extractVariantProducts(
          observation
        );
      }

      /*
       * PRODUCT_SEARCH liefert in der beobachteten Antwort vor allem
       * resultIds/categorytree. Diese IDs werden künftig für die
       * gezielte Enrichment-Pipeline verwendet; wir erzeugen daraus
       * bewusst noch keine halben Produktdatensätze.
       */
      return [];
    }
  };
