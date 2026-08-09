import {
  calculateProductConfidence
} from "../core/confidence.js";

import {
  walkJsonObjects
} from "../core/json-walk.js";

import type {
  NetworkObservation,
  NormalizedSupplierProduct,
  SupplierKey
} from "../types.js";

function firstText(
  record: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const value = record[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function firstNumber(
  record: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const value = record[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      Number.isFinite(
        Number(
          value
            .replace(",", ".")
            .replace(
              /[^0-9.-]/g,
              ""
            )
        )
      )
    ) {
      return Number(
        value
          .replace(",", ".")
          .replace(
            /[^0-9.-]/g,
            ""
          )
      );
    }
  }

  return null;
}

function priceToCents(
  value: number | null
) {
  if (
    value == null ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  // Generischer Network-Parser akzeptiert nur realistische
  // Dezimalpreise als HIGH/MEDIUM-Kandidat. Shop-spezifische
  // Adapter ersetzen diese Heuristik später.
  if (value > 100_000) {
    return null;
  }

  return Math.round(
    value * 100
  );
}

export function extractGenericNetworkProducts(
  supplierKey: SupplierKey,
  observation: NetworkObservation
) {
  const products:
    NormalizedSupplierProduct[] = [];

  const seen =
    new Set<string>();

  for (
    const { value: record }
    of walkJsonObjects(
      observation.body
    )
  ) {
    const name =
      firstText(
        record,
        [
          "name",
          "title",
          "productName",
          "articleName",
          "description"
        ]
      );

    if (!name || name.length < 3) {
      continue;
    }

    const articleNumber =
      firstText(
        record,
        [
          "articleNumber",
          "articleNo",
          "sku",
          "productId",
          "itemNo",
          "itemNumber"
        ]
      );

    const externalId =
      firstText(
        record,
        [
          "id",
          "externalId",
          "productId"
        ]
      );

    const ean =
      firstText(
        record,
        [
          "ean",
          "gtin",
          "barcode"
        ]
      );

    const rawNet =
      firstNumber(
        record,
        [
          "netPrice",
          "priceNet",
          "net",
          "price"
        ]
      );

    const rawGross =
      firstNumber(
        record,
        [
          "grossPrice",
          "priceGross",
          "gross"
        ]
      );

    if (
      !articleNumber &&
      !externalId &&
      !ean &&
      rawNet == null &&
      rawGross == null
    ) {
      continue;
    }

    const productBase =
      {
        supplierKey,
        externalId,
        articleNumber,
        ean,
        name,
        brand:
          firstText(
            record,
            [
              "brand",
              "manufacturer"
            ]
          ),
        orderUnit:
          firstText(
            record,
            [
              "orderUnit",
              "salesUnit",
              "unit"
            ]
          ),
        packageText:
          firstText(
            record,
            [
              "packageText",
              "packaging",
              "packageSize"
            ]
          ),
        netPriceCents:
          priceToCents(
            rawNet
          ),
        grossPriceCents:
          priceToCents(
            rawGross
          ),
        currency: "EUR" as const,
        tiers: [],
        available:
          typeof record.available ===
          "boolean"
            ? record.available
            : null,
        availabilityText:
          firstText(
            record,
            [
              "availabilityText",
              "stockText",
              "availability"
            ]
          ),
        productUrl:
          firstText(
            record,
            [
              "url",
              "productUrl",
              "href"
            ]
          ) ||
          observation.url,
        source:
          "NETWORK" as const,
        capturedAt:
          observation.capturedAt
      };

    const product:
      NormalizedSupplierProduct = {
        ...productBase,
        confidence:
          calculateProductConfidence(
            productBase
          )
      };

    const key = [
      articleNumber,
      externalId,
      ean,
      name
    ]
      .filter(Boolean)
      .join("|")
      .toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    products.push(product);
  }

  return products;
}
