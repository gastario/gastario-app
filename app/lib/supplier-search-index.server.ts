export function normalizeSupplierSearchTerm(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: unknown) {
  const normalized = normalizeSupplierSearchTerm(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        token.length <= 80
    );
}

export function buildSupplierCatalogSearchTokens(
  values: Record<string, unknown>
) {
  return Array.from(
    new Set(
      Object.values(values)
        .flatMap(tokenize)
        .filter(Boolean)
    )
  ).slice(0, 160);
}

export function buildSupplierSearchQueryTokens(
  values: Array<unknown>
) {
  return Array.from(
    new Set(
      values
        .flatMap(tokenize)
        .filter(Boolean)
    )
  ).slice(0, 80);
}