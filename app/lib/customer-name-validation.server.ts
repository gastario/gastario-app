export type CustomerCandidateSource =
  | "STRUCTURED_LABEL"
  | "EMAIL_SENTENCE"
  | "EXPLICIT_FIELD"
  | "COMPANY_LINE"
  | "PARSER_RESULT";

export type CustomerCandidate = {
  value: string;
  source: CustomerCandidateSource;
  score: number;
};

export type ResolveCustomerNameInput = {
  text: string;
  parserCustomerName?: string | null;
  items?: Array<{
    name?: string | null;
    description?: string | null;
    rawLine?: string | null;
  }>;
};

function normalizeText(value: unknown) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparison(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCompanyLegalForm(value: string) {
  return /\b(?:gmbh(?:\s*&\s*co\.?\s*kg)?|ug(?:\s*\(haftungsbeschränkt\))?|ag|se|kg|ohg|gbr|e\.?\s*v\.?|inc\.?|ltd\.?|llc|plc|sarl|sas)\b/i.test(
    value
  );
}

function looksLikeQuantityOrPosition(value: string) {
  return (
    /^\s*\d+(?:[,.]\d+)?\s*(?:x|st(?:ück)?|stk\.?|portion(?:en)?|pers(?:onen)?|kg|g|ml|l)?\b/i.test(
      value
    ) ||
    /^\s*\d{1,3}[.)-]\s+/.test(value)
  );
}

function looksLikeMoneyOrTotal(value: string) {
  return (
    /(?:€|eur)\s*\d|\d(?:[.,]\d{1,2})?\s*(?:€|eur)/i.test(value) ||
    /\b(?:gesamt|gesamtsumme|gesamtbetrag|netto|brutto|mwst|ust|steuer|einzelpreis|betrag)\b/i.test(
      value
    )
  );
}

function looksLikeAddress(value: string) {
  return (
    /^\d{5}\s+\S+/i.test(value) ||
    (
      /\b(?:straße|strasse|str\.|allee|weg|platz|damm|ufer|ring|chaussee|gasse|promenade|kai|wall)\b/i.test(
        value
      ) &&
      /\b\d+[a-z]?\b/i.test(value)
    )
  );
}

function looksLikeFooterOrRegister(value: string) {
  return /\b(?:registergericht|handelsregister|hrb|hra|ust-?id|iban|bic|geschäftsführung|geschaeftsfuehrung|zahlungsempfänger|zahlungsempfaenger|kundennummer|datum:|auftrag:)\b/i.test(
    value
  );
}

function looksLikeContactOrLabel(value: string) {
  return /^(?:kunde|customer|firma|unternehmen|company|auftraggeber|besteller|kontakt|ansprechpartner|telefon|tel\.?|mobil|phone|lieferadresse|rechnungsadresse|präsentation|praesentation|lieferungen)\s*:?\s*$/i.test(
    value
  );
}

function looksLikeFoodOrProduct(value: string) {
  if (looksLikeQuantityOrPosition(value)) {
    return true;
  }

  return /\b(?:bagel|sesambagel|laugenbagel|wrap|bowl|salat|pizza|croissant|schnittchen|schnitte|mousse|buffet|frühstück|fruehstueck|hummus|falafel|chicken|hähnchen|haehnchen|lachs|käse|kaese|gouda|frischkäse|frischkaese|tomate|gurke|avocado|rucola|kartoffel|gemüse|gemuese|obst|lebensmittel|speisen|gerichte|snacks?|getränke|getraenke|dessert|kuchen|sauce|soße|sosse|vegan|veggie|menü|menu)\b/i.test(
    value
  );
}

function overlapsWithItems(
  value: string,
  items: ResolveCustomerNameInput["items"]
) {
  const candidate = normalizeComparison(value);

  if (!candidate || candidate.length < 3) {
    return false;
  }

  return (items || []).some((item) => {
    const itemValues = [
      item?.name,
      item?.description,
      item?.rawLine,
    ]
      .map(normalizeComparison)
      .filter(Boolean);

    return itemValues.some((itemValue) => {
      if (candidate === itemValue) {
        return true;
      }

      if (
        candidate.length >= 12 &&
        itemValue.length >= 12 &&
        (
          itemValue.includes(candidate) ||
          candidate.includes(itemValue)
        )
      ) {
        return true;
      }

      return false;
    });
  });
}

export function isReliableCustomerCandidate(
  value: unknown,
  items: ResolveCustomerNameInput["items"] = []
) {
  const normalized = normalizeText(value);

  if (!normalized || normalized.length < 2 || normalized.length > 140) {
    return false;
  }

  if (
    looksLikeQuantityOrPosition(normalized) ||
    looksLikeMoneyOrTotal(normalized) ||
    looksLikeAddress(normalized) ||
    looksLikeFooterOrRegister(normalized) ||
    looksLikeContactOrLabel(normalized) ||
    looksLikeFoodOrProduct(normalized) ||
    overlapsWithItems(normalized, items)
  ) {
    return false;
  }

  if (
    /^(?:edis gastrobetriebe|gastario|hey group|heycater)\b/i.test(
      normalized
    )
  ) {
    return false;
  }

  return true;
}

function extractLineAfterLabel(
  lines: string[],
  labels: RegExp[]
) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!labels.some((label) => label.test(lines[index]))) {
      continue;
    }

    for (
      let nextIndex = index + 1;
      nextIndex < Math.min(lines.length, index + 8);
      nextIndex += 1
    ) {
      const candidate = normalizeText(lines[nextIndex]);

      if (!candidate) {
        continue;
      }

      if (
        /^(?:lieferadresse|rechnungsadresse|präsentation|praesentation|lieferungen|telefon|mobil|kontakt|ansprechpartner)\s*:/i.test(
          candidate
        )
      ) {
        break;
      }

      return candidate;
    }
  }

  return "";
}

function collectCustomerCandidates(
  input: ResolveCustomerNameInput
): CustomerCandidate[] {
  const text = String(input.text || "").replace(/\r/g, "");

  const lines = text
    .split("\n")
    .map(normalizeText)
    .filter(Boolean);

  const candidates: CustomerCandidate[] = [];

  const structuredCustomer = extractLineAfterLabel(lines, [
    /^kunde\s*:?\s*$/i,
    /^customer\s*:?\s*$/i,
    /^firma\s*:?\s*$/i,
    /^unternehmen\s*:?\s*$/i,
    /^auftraggeber\s*:?\s*$/i,
    /^besteller\s*:?\s*$/i,
  ]);

  if (structuredCustomer) {
    candidates.push({
      value: structuredCustomer,
      source: "STRUCTURED_LABEL",
      score: 100,
    });
  }

  const emailCustomerMatch = text.match(
    /\bDer\s+Kunde\s+(.{2,140}?)\s+hat\s+(?:Dein|Ihr|das)\s+Angebot\s+gebucht\b/i
  );

  if (emailCustomerMatch?.[1]) {
    candidates.push({
      value: emailCustomerMatch[1],
      source: "EMAIL_SENTENCE",
      score: 95,
    });
  }

  const explicitFieldPatterns = [
    /(?:^|\n)\s*(?:Kunde|Customer|Firma|Unternehmen|Company|Auftraggeber|Besteller)\s*[:\-]\s*(.+)$/im,
    /(?:^|\n)\s*(?:Rechnungsempfänger|Rechnungsempfaenger)\s*[:\-]\s*(.+)$/im,
  ];

  for (const pattern of explicitFieldPatterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      candidates.push({
        value: match[1],
        source: "EXPLICIT_FIELD",
        score: 90,
      });
    }
  }

  if (input.parserCustomerName) {
    candidates.push({
      value: input.parserCustomerName,
      source: "PARSER_RESULT",
      score: 55,
    });
  }

  for (const line of lines.slice(0, 180)) {
    if (!hasCompanyLegalForm(line)) {
      continue;
    }

    candidates.push({
      value: line,
      source: "COMPANY_LINE",
      score: 45,
    });
  }

  return candidates;
}

export function resolveReliableCustomerName(
  input: ResolveCustomerNameInput
) {
  const candidates = collectCustomerCandidates(input)
    .map((candidate) => ({
      ...candidate,
      value: normalizeText(candidate.value),
    }))
    .filter((candidate) =>
      isReliableCustomerCandidate(candidate.value, input.items)
    )
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.value || "";
}