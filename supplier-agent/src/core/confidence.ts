import type {
  ConfidenceLevel,
  NormalizedSupplierProduct
} from "../types.js";

export function calculateProductConfidence(
  product: Omit<
    NormalizedSupplierProduct,
    "confidence"
  >
): ConfidenceLevel {
  let score = 0;

  if (product.name.trim().length >= 3) {
    score += 3;
  }

  if (
    product.articleNumber ||
    product.externalId ||
    product.ean
  ) {
    score += 3;
  }

  if (product.productUrl) {
    score += 1;
  }

  if (
    product.netPriceCents != null &&
    product.netPriceCents > 0
  ) {
    score += 3;
  }

  if (product.orderUnit || product.packageText) {
    score += 1;
  }

  if (product.source === "NETWORK") {
    score += 3;
  } else if (
    product.source === "EMBEDDED_JSON"
  ) {
    score += 2;
  }

  if (score >= 10) {
    return "HIGH";
  }

  if (score >= 6) {
    return "MEDIUM";
  }

  return "LOW";
}
