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
const SUPPLIER_SEARCH_LEARNING_STOPWORDS = new Set([
  "und",
  "oder",
  "mit",
  "ohne",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einer",
  "eines",
  "von",
  "vom",
  "fur",
  "fuer",
  "pro",
  "je",
  "stk",
  "stuck",
  "stueck",
  "pack",
  "paket",
  "beutel",
  "dose",
  "dosen",
  "glas",
  "glaser",
  "glaeser",
  "flasche",
  "flaschen",
  "karton",
  "kartons",
  "kg",
  "g",
  "gr",
  "mg",
  "ml",
  "cl",
  "dl",
  "liter",
  "l",
  "x",
]);

export function extractSupplierSearchLearningCandidates(
  params: {
    query: unknown;
    itemName: unknown;
    brand?: unknown;
  }
) {
  const queryTokens = new Set(
    buildSupplierSearchQueryTokens([
      params.query,
    ])
  );

  const brandTokens = new Set(
    buildSupplierSearchQueryTokens([
      params.brand,
    ])
  );

  return Array.from(
    new Set(
      buildSupplierSearchQueryTokens([
        params.itemName,
      ])
        .filter(
          (token) =>
            token.length >= 4 &&
            !queryTokens.has(token) &&
            !brandTokens.has(token) &&
            !SUPPLIER_SEARCH_LEARNING_STOPWORDS.has(
              token
            ) &&
            !/^\d+$/.test(token) &&
            !/^\d+(kg|g|gr|mg|ml|cl|dl|l)$/.test(
              token
            )
        )
    )
  ).slice(0, 8);
}
