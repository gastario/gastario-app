import type {
  SupplierCachedOffer,
  SupplierPriceFreshness,
  SupplierProduct
} from "./types";

export const DEFAULT_SUPPLIER_PRICE_FRESH_MS =
  5 * 60 * 1000;

export const DEFAULT_SUPPLIER_PRICE_STALE_MS =
  30 * 60 * 1000;

export const DEFAULT_SUPPLIER_PRICE_EXPIRED_MS =
  6 * 60 * 60 * 1000;

export function classifySupplierPriceFreshness({
  fetchedAt,
  now = new Date(),
  freshMs =
    DEFAULT_SUPPLIER_PRICE_FRESH_MS,
  staleMs =
    DEFAULT_SUPPLIER_PRICE_STALE_MS,
  expiredMs =
    DEFAULT_SUPPLIER_PRICE_EXPIRED_MS
}: {
  fetchedAt: Date | null | undefined;
  now?: Date;
  freshMs?: number;
  staleMs?: number;
  expiredMs?: number;
}): SupplierPriceFreshness {
  if (!fetchedAt) {
    return "UNKNOWN";
  }

  const ageMs =
    now.getTime() -
    fetchedAt.getTime();

  if (
    !Number.isFinite(ageMs) ||
    ageMs < 0
  ) {
    return "UNKNOWN";
  }

  if (ageMs <= freshMs) {
    return "LIVE";
  }

  if (ageMs <= staleMs) {
    return "FRESH";
  }

  if (ageMs <= expiredMs) {
    return "STALE";
  }

  return "EXPIRED";
}

export function toSupplierCachedOffer(
  product: SupplierProduct,
  now = new Date()
): SupplierCachedOffer {
  const ageMs =
    product.fetchedAt
      ? Math.max(
          0,
          now.getTime() -
            product.fetchedAt.getTime()
        )
      : null;

  return {
    product,
    freshness:
      classifySupplierPriceFreshness({
        fetchedAt:
          product.fetchedAt,
        now
      }),
    ageMs
  };
}
