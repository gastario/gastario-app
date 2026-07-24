import { resolveReliableCustomerName } from "./customer-name-validation.server";

export type ExtractedOrderItem = {
  name: string;
  description?: string;
  rawLine?: string;
  cateringDate?: string;
  quantity?: number;
  unitCents?: number;
  totalCents?: number;
};

export type ExtractedOrder = {
  source: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
  deliveryDate: string;
  deliveryTime: string;
  eventDate: string;
  eventStart: string;
  deliveryAddress: string;
  presentation: string;
  pdfNetTotalCents?: number;
  pdfTaxTotalCents?: number;
  pdfGrossTotalCents?: number;
  items: ExtractedOrderItem[];
};

function extractValue(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

function extractLinesAfterLabel(lines: string[], label: string, stopLabels: string[]) {
  const startIndex = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());

  if (startIndex < 0) {
    return [];
  }

  const result: string[] = [];

  for (const line of lines.slice(startIndex + 1)) {
    const lower = line.toLowerCase();

    if (stopLabels.some((stop) => lower.startsWith(stop.toLowerCase()))) {
      break;
    }

    result.push(line);
  }

  return result;
}

export function extractHeycaterOrder(text: string): ExtractedOrder {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const deliveryDate = extractValue(text, /Lieferdatum:\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i);
  const deliveryTime = extractValue(text, /Lieferzeit:\s*([0-9]{1,2}:[0-9]{2})/i);
  const eventDate = extractValue(text, /Event Datum:\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i);
  const eventStart = extractValue(text, /Event Beginn:\s*([0-9]{1,2}:[0-9]{2})/i);
  const presentation =
    extractValue(text, /Praesentation:\s*(.+)/i) ||
    extractValue(text, /Pr?sentation:\s*(.+)/i);

  const customerBlock = extractLinesAfterLabel(lines, "Kunde:", [
    "Lieferadresse:",
    "Pr?sentation:",
    "Praesentation:",
    "Lieferungen:",
  ]);

  const deliveryBlock = extractLinesAfterLabel(lines, "Lieferadresse:", [
    "Stockwerk:",
    "Aufzug:",
    "Parkm?glichkeiten:",
    "Parkmoeglichkeiten:",
    "Pr?sentation:",
    "Praesentation:",
    "Lieferungen:",
  ]);

  const customerName = customerBlock[0] || "";
  const contactName = customerBlock.find((line) => !line.toLowerCase().startsWith("telefon:") && line !== customerName) || "";
  const contactPhone = extractValue(customerBlock.join("\n"), /Telefon:\s*(.+)/i);
  function looksLikeCompanyLine(line: string) {
    const value = String(line || "").trim().toLowerCase();

    if (!value) return false;

    return (
      /\b(gmbh|ug|ag|se|kg|ohg|gbr|e\.v\.|ev|inc|ltd|llc|company|catering|management|office|solutions|group|holding|studio)\b/i.test(value) ||
      value.includes("@") ||
      value.includes("www.") ||
      value.includes("http") ||
      value.includes("telefon") ||
      value.includes("ansprechpartner") ||
      value.includes("kontakt") ||
      value.includes("kunde") ||
      value.includes("lieferadresse")
    );
  }

  function looksLikeAddressLine(line: string) {
    const value = String(line || "").trim();
    const lower = value.toLowerCase();

    if (!value) return false;
    if (/goerzallee|edis gastrobetriebe|hey group|gormann|qonto|iban|bic/i.test(lower)) return false;
    if (looksLikeCompanyLine(value)) return false;
    if (/^\d{5}\s+/.test(value)) return false;
    if (/telefon|ansprechpartner|kontakt|kunde|lieferadresse|stockwerk|aufzug|park/i.test(value)) return false;
    if (/gesamtbetrag|netto|brutto|ust|iban|bic|qonto|registergericht/i.test(lower)) return false;

    const hasStreetWord = /straße|strasse|str\.|allee|weg|platz|damm|ufer|ring|chaussee|markt|gasse|hof|promenade|tor|kai|wall/i.test(value);
    const hasHouseNumber = /\b\d+[a-z]?\b/i.test(value);

    return hasStreetWord && hasHouseNumber;
  }
  const deliveryZipCity = deliveryBlock.find((line) => /^\d{5}\s+/.test(line)) || "";
  const zipIndexInDeliveryBlock = deliveryZipCity ? deliveryBlock.indexOf(deliveryZipCity) : -1;

  const deliveryStreet =
    deliveryBlock.find((line) => looksLikeAddressLine(line)) ||
    (zipIndexInDeliveryBlock > 0
      ? [...deliveryBlock.slice(Math.max(0, zipIndexInDeliveryBlock - 8), zipIndexInDeliveryBlock)]
          .reverse()
          .find((line) => {
            const value = String(line || "").trim();
            return looksLikeAddressLine(value);
          }) || ""
      : "");
  const deliveryAddressFromBlock = [deliveryStreet, deliveryZipCity].filter(Boolean).join(", ");

  const ownOrPlatformWords = [
    "goerzallee",
    "edis gastrobetriebe",
    "hey group",
    "gormannstr",
    "gormannstra?e",
    "gormanstra?e",
    "qonto",
    "iban",
    "bic",
    "registergericht",
    "gesch?ftsf?hrung",
    "geschaeftsfuehrung",
  ];

  function isOwnOrPlatformLine(line: string) {
    const lower = String(line || "").toLowerCase();
    return ownOrPlatformWords.some((word) => lower.includes(word));
  }

  const possibleZipLines = lines.filter((line) =>
    /^\d{5}\s+/.test(line) && !isOwnOrPlatformLine(line)
  );

  const zipCityLine =
    possibleZipLines.find((line) => line.includes("10117")) ||
    possibleZipLines[0] ||
    "";

  const addressIndex = zipCityLine ? lines.indexOf(zipCityLine) : -1;
  const streetLine =
    addressIndex > 0
      ? [...lines.slice(Math.max(0, addressIndex - 8), addressIndex)]
          .reverse()
          .find((line) =>
            looksLikeAddressLine(line) &&
            !line.toLowerCase().includes("lieferadresse")
          ) ||
        [...lines.slice(Math.max(0, addressIndex - 4), addressIndex)]
          .reverse()
          .find((line) => {
            const value = String(line || "").trim();
            return (
              value &&
              !isOwnOrPlatformLine(value) &&
              !value.toLowerCase().includes("lieferadresse") &&
              !/kunde|telefon|ansprechpartner|kontakt|stockwerk|aufzug|park/i.test(value)
            );
          }) ||
        ""
      : "";

  const deliveryAddress = deliveryAddressFromBlock || [streetLine, zipCityLine].filter(Boolean).join(", ");

  const items: ExtractedOrderItem[] = [];

  const tableStartIndex = lines.findIndex((line) =>
    line.toLowerCase().includes("bezeichnung") &&
    line.toLowerCase().includes("menge") &&
    line.toLowerCase().includes("einzelpreis")
  );

  const tableEndIndex = lines.findIndex((line, index) =>
    index > tableStartIndex &&
    (
      line.toLowerCase().includes("gesamtbetrag netto") ||
      line.toLowerCase().startsWith("sonstiges:")
    )
  );

  const productLines =
    tableStartIndex >= 0
      ? lines.slice(tableStartIndex + 1, tableEndIndex > tableStartIndex ? tableEndIndex : lines.length)
      : [];

  function isNoiseLine(line: string) {
    const lower = line.toLowerCase();

    return (
      lower.includes("catering auftragsbest") ||
      lower.includes("hey group") ||
      lower.includes("gormann") ||
      lower.includes("registergericht") ||
      lower.includes("ust-idnr") ||
      lower.includes("iban") ||
      lower.includes("bic") ||
      lower.includes("qonto") ||
      lower.includes("name der bank") ||
      lower.includes("gesch?ftsf?hrung") ||
      lower.includes("geschaeftsfuehrung") ||
      lower.includes("zahlungsempf?nger") ||
      lower.includes("zahlungsempfaenger") ||
      lower.includes("bezeichnung menge") ||
      lower.includes("einzelpreis")
    );
  }

  function toCents(value: string) {
    const normalized = String(value || "0").replace(",", ".").trim();
    const number = Number(normalized);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Math.round(number * 100);
  }

  let currentLines: string[] = [];

  for (const rawLine of productLines) {
    const line = rawLine.replace(/\uFFFD|\uFFFE/g, "-").trim();

    if (!line || isNoiseLine(line)) {
      continue;
    }

    const priceMatch = line.match(/^(?:(.*?)\s+)?(\d+)\s*(?:\u20ac|EUR)\s*([0-9]+[,.]?[0-9]*)\s+([0-9]+[,.]?[0-9]*)$/i);

    const nameUnitQuantityTotalRow =
      parseNameUnitQuantityTotalRow(line);

    if (
      !priceMatch &&
      !nameUnitQuantityTotalRow
    ) {
      currentLines.push(line);
      continue;
    }

    const alternativeName =
      String(
        nameUnitQuantityTotalRow?.name || ""
      ).trim();

    const looksLikeSurchargeRow =
      Boolean(nameUnitQuantityTotalRow) &&
      /^(?:bitte\b|aufpreis\b|zuschlag\b|pauschale\b|mehrpreis\b|servicepauschale\b)/i.test(
        alternativeName
      );

    /*
     * Reguläre Heycater-Reihenfolge:
     * Produktname, Menge, €, Einzelpreis, Gesamtpreis
     *
     * Bei Zuschlagszeilen kann die PDF-Extraktion dagegen
     * Einzelpreis und Menge vertauscht ausgeben.
     */
    const useAlternativeOrder =
      Boolean(nameUnitQuantityTotalRow) &&
      (
        !priceMatch ||
        looksLikeSurchargeRow
      );

    const prefixName =
      useAlternativeOrder
        ? alternativeName
        : String(
            priceMatch?.[1] || ""
          ).trim();

    const quantity =
      useAlternativeOrder
        ? Number(
            nameUnitQuantityTotalRow?.quantity || 1
          )
        : Number(
            priceMatch?.[2] || 1
          );

    const unitCents =
      useAlternativeOrder
        ? Number(
            nameUnitQuantityTotalRow?.unitCents || 0
          )
        : toCents(
            String(
              priceMatch?.[3] || ""
            )
          );

    const totalCents =
      useAlternativeOrder
        ? Number(
            nameUnitQuantityTotalRow?.totalCents || 0
          )
        : toCents(
            String(
              priceMatch?.[4] || ""
            )
          );

    /*
     * Enthält die Preiszeile bereits einen Namen,
     * gehört vorheriger Fließtext nicht zu dieser Position.
     * Beispiel:
     * Bitte mit mehr Rührei planen 80 € 1 80.0
     */
    const rowLines =
      nameUnitQuantityTotalRow
        ? [prefixName]
        : removeLeadingImportedOrderNotes(
            [...currentLines, prefixName]
              .map((item) => item.trim())
              .filter(Boolean)
              .filter(
                (item) =>
                  !isNoiseLine(item) &&
                  !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(
                    item
                  ) &&
                  !/^seite\s+\d+\s*(?:\/|von)\s*\d+$/i.test(
                    item
                  )
              )
          );

    currentLines = [];

    if (rowLines.length === 0) {
      continue;
    }

    const descriptionStart = rowLines.findIndex((item, index) =>
      index > 0 &&
      (
        item.toLowerCase().startsWith("mit ") ||
        item.toLowerCase().startsWith("beinhaltet ") ||
        item.toLowerCase().startsWith("vegane ") ||
        item.toLowerCase().startsWith("weizenklein")
      )
    );

    const nameLines = descriptionStart > 0 ? rowLines.slice(0, descriptionStart) : rowLines.slice(0, 1);
    const descriptionLines = descriptionStart > 0 ? rowLines.slice(descriptionStart) : rowLines.slice(1);

    const name = nameLines.join(" ").trim();
    const description = descriptionLines.join(" ").trim();

    if (!name) {
      continue;
    }

    if (isInvalidImportedItem(name, description, line)) {
      continue;
    }

    items.push({
      name,
      description,
      rawLine: line,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unitCents,
      totalCents,
    });
  }


  if (items.length === 0) {
    const deliveryNoteTableStartIndex = lines.findIndex((line) => {
      const lower = line.toLowerCase();
      return lower.includes("bezeichnung") && lower.includes("menge");
    });

    const deliveryNoteTableEndIndex = lines.findIndex((line, index) => {
      const lower = line.toLowerCase();
      return (
        index > deliveryNoteTableStartIndex &&
        (
          lower.startsWith("sonstiges:") ||
          lower.includes("bei fragen stehen wir") ||
          lower.includes("dein heycater")
        )
      );
    });

    const deliveryNoteLines =
      deliveryNoteTableStartIndex >= 0
        ? lines.slice(
            deliveryNoteTableStartIndex + 1,
            deliveryNoteTableEndIndex > deliveryNoteTableStartIndex ? deliveryNoteTableEndIndex : lines.length
          )
        : [];

    const pendingLines: string[] = [];

    function isDeliveryNoteNoiseLine(line: string) {
      const lower = line.toLowerCase();

      return (
        isNoiseLine(line) ||
        lower.includes("catering lieferschein") ||
        lower.includes("hey group") ||
        lower.includes("registergericht") ||
        lower.includes("ust-idnr") ||
        lower.includes("iban") ||
        lower.includes("bic") ||
        lower.includes("qonto") ||
        lower.includes("zahlungsempfaenger") ||
        lower.includes("zahlungsempf") ||
        lower.includes("name der bank") ||
        lower.includes("geschaeftsfuehrung") ||
        lower.includes("geschäftsführung") ||
        lower.includes("-- 1 of") ||
        lower.includes("-- 2 of") ||
        lower.includes("-- 3 of")
      );
    }

    function finalizeDeliveryNoteItem(quantityLine: string) {
      const quantity = Number(quantityLine);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        pendingLines.length = 0;
        return;
      }

      const rowLines = pendingLines
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => !isDeliveryNoteNoiseLine(item));

      pendingLines.length = 0;

      if (rowLines.length === 0) {
        return;
      }

      const descriptionStart = rowLines.findIndex((item, index) => {
        const lower = item.toLowerCase();

        return (
          index > 0 &&
          (
            lower.startsWith("mit ") ||
            lower.startsWith("beinhaltet ") ||
            lower.startsWith("vegane ") ||
            lower.startsWith("vegetarisch") ||
            lower.startsWith("aromatisches ") ||
            lower.startsWith("weizenklein")
          )
        );
      });

      const nameLines = descriptionStart > 0 ? rowLines.slice(0, descriptionStart) : rowLines.slice(0, 1);
      const descriptionLines = descriptionStart > 0 ? rowLines.slice(descriptionStart) : rowLines.slice(1);

      const name = nameLines.join(" ").replace(/\s+/g, " ").trim();
      const description = descriptionLines.join(" ").replace(/\s+/g, " ").trim();

      if (!name) {
        return;
      }

      const hasPrice = totalCents > 0 || unitCents > 0;

      if (!hasPrice && isInvalidImportedItem(name, description, rowLines.join(" | "))) {
        return;
      }

      items.push({
        name,
        description,
        rawLine: rowLines.join(" | ") + " | Menge " + quantity,
        quantity,
        unitCents: 0,
        totalCents: 0,
      });
    }

    for (const rawLine of deliveryNoteLines) {
      const line = rawLine.replace(/\uFFFD|\uFFFE/g, "-").trim();

      if (!line || isDeliveryNoteNoiseLine(line)) {
        continue;
      }

      if (/^\d+$/.test(line)) {
        finalizeDeliveryNoteItem(line);
        continue;
      }

      pendingLines.push(line);
    }
  }

  return {
    source: text.toLowerCase().includes("hey") ? "Heycater" : "Unbekannt",
    customerName,
    contactName,
    contactPhone,
    deliveryDate,
    deliveryTime,
    eventDate,
    eventStart,
    deliveryAddress,
    presentation,
    items: items,
  };
}


function isInvalidImportedItem(name: string, description?: string, rawLine?: string) {
  const value = [name, description || "", rawLine || ""]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return true;

  if (/^[-??\s]*\d+\s+of\s+\d+[-??\s]*/i.test(value)) return true;
  if (value.includes("-- 1 of")) return true;
  if (value.includes("-- 2 of")) return true;
  if (value.includes("-- 3 of")) return true;

  const blocked = [
    "zwischensumme",
    "summe",
    "gesamtsumme",
    "netto",
    "brutto",
    "ust",
    "mwst",
    "mehrwertsteuer",
    "subtotal",
    "total",
    "invoice",
    "rechnung",
    "zahlbar",
    "iban",
    "bic"
  ];

  if (blocked.some((word) => value.includes(word))) return true;

  const withoutPriceChars = value.replace(/[0-9\s,.?eur-]/g, "");
  if (withoutPriceChars.length < 4) return true;

  return false;
}




function extractFirstGenericValue(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value.replace(/\s+/g, " ").trim();
  }

  return "";
}

function detectOrderSource(text: string) {
  const lower = String(text || "").toLowerCase();

  if (lower.includes("heycater") || lower.includes("hey cater")) return "Heycater";
  if (lower.includes("feedr")) return "Feedr";
  if (lower.includes("egora")) return "Egora";
  if (lower.includes("lexware")) return "Lexware";
  if (lower.includes("auftragsbestätigung") || lower.includes("auftragsbestaetigung")) return "Auftragsbestätigung";
  if (lower.includes("angebotsbestätigung") || lower.includes("angebotsbestaetigung")) return "Angebotsbestätigung";
  if (lower.includes("bestellbestätigung") || lower.includes("bestellbestaetigung")) return "Bestellbestätigung";
  if (lower.includes("order confirmation")) return "Order Confirmation";
  if (lower.includes("booking confirmation")) return "Booking Confirmation";
  if (lower.includes("angebot")) return "Angebot";
  if (lower.includes("bestellung")) return "Bestellung";

  return "PDF/E-Mail";
}

function parseAnyDateToGerman(value: string) {
  const text = String(value || "").trim();

  let match = text.match(/\b([0-9]{2})\.([0-9]{2})\.([0-9]{4})\b/);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;

  match = text.match(/\b([0-9]{4})-([0-9]{2})-([0-9]{2})\b/);
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;

  match = text.match(/\b([0-9]{2})\/([0-9]{2})\/([0-9]{4})\b/);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;

  return "";
}

function parseGenericMoneyToCents(value: string) {
  const raw = String(value || "").replace(/[^\d,.-]/g, "").trim();
  if (!raw) return 0;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function looksLikePriceValue(value: string) {
  return /^\d{1,6}(?:\.\d{3})*(?:,\d{2})$/.test(value) ||
    /^\d{1,6}\.\d{2}$/.test(value);
}

function hasUsefulProductText(value: string) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length < 3) {
    return false;
  }

  if (!/[a-zäöüß]/i.test(normalized)) {
    return false;
  }

  const letters = (
    normalized.match(/[a-zäöüß]/gi) || []
  ).length;

  return letters >= 3;
}

function isGenericItemNoiseLine(value: string) {
  const lower = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!lower) return true;

  return [
    "bezeichnung",
    "einzelpreis",
    "gesamtpreis",
    "gesamtbetrag",
    "zwischensumme",
    "gesamtsumme",
    "summe netto",
    "summe brutto",
    "übertrag",
    "uebertrag",
    "seitenübertrag",
    "seitenuebertrag",
    "betrag vor übertrag",
    "betrag vor uebertrag",
    "mehrwertsteuer",
    "umsatzsteuer",
    "zahlungsbedingungen",
    "rechnungsempfänger",
    "rechnungsempfaenger",
    "lieferadresse",
    "auftragsnummer",
    "bestellnummer",
    "iban",
    "bic",
    "registergericht",
    "geschäftsführung",
    "geschaeftsfuehrung",
  ].some((term) => lower.includes(term));
}

function looksLikeGenericItemLine(line: string) {
  const text = String(line || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || isGenericItemNoiseLine(text)) {
    return false;
  }

  if (
    /^\d+\s+.+\s+\d+[,.]\d{2}\s+\d+[,.]\d{2}(?:\s*(?:€|eur))?$/i.test(text)
  ) {
    return true;
  }

  if (
    /^\d+\s+\d+[,.]\d{2}\s+\d+[,.]\d{2}(?:\s*(?:€|eur))?$/i.test(text)
  ) {
    return true;
  }

  if (
    /\b\d+\s*(?:x|stk|st\.|stück|portionen|personen|pax)\b/i.test(text)
  ) {
    return true;
  }

  if (
    /\d+[,.]\d{2}\s*(?:€|eur)/i.test(text) &&
    hasUsefulProductText(text)
  ) {
    return true;
  }

  return hasUsefulProductText(text);
}

function extractStructuredPositionBlocks(
  lines: string[]
): ExtractedOrderItem[] {
  const items: ExtractedOrderItem[] = [];

  let currentCateringDate = "";

  let currentItem:
    | {
        name: string;
        descriptionLines: string[];
        rawLines: string[];
        cateringDate: string;
      }
    | null = null;

  function normalizeStructuredLine(value: string) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isStructuredNoiseLine(value: string) {
    const lower = normalizeStructuredLine(value)
      .toLowerCase();

    if (!lower) return true;

    return (
      isGenericItemNoiseLine(lower) ||
      /^seite\s+\d+\s*\/\s*\d+/i.test(lower) ||
      /^--\s*\d+\s+of\s+\d+\s*--$/i.test(lower) ||
      lower.includes("edis gastrobetriebe") ||
      lower.includes("goerzallee 299") ||
      lower.includes("ust-idnr") ||
      lower.includes("steuernummer") ||
      lower.includes("amtsgericht") ||
      lower.includes("landesbank berlin") ||
      lower.includes("sparkasse") ||
      lower.includes("iban:") ||
      lower.includes("bic:") ||
      lower.includes("info@") ||
      lower.includes("www.") ||
      lower.includes("tel.:")
    );
  }

  function pushStructuredItem(
    quantityText: string,
    unitPriceText: string,
    totalPriceText: string
  ) {
    if (!currentItem) return;

    const quantity = Number(
      String(quantityText || "")
        .replace(",", ".")
    );

    const name = normalizeStructuredLine(
      currentItem.name
    );

    const description = currentItem.descriptionLines
      .map(normalizeStructuredLine)
      .filter(Boolean)
      .join(" ")
      .replace(/-\s+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (
      name &&
      /[A-Za-zÄÖÜäöüß]/.test(name)
    ) {
      items.push({
        name,
        description,
        rawLine:
          currentItem.rawLines.join(" | "),
        cateringDate:
          currentItem.cateringDate || undefined,
        quantity:
          Number.isFinite(quantity) &&
          quantity > 0
            ? quantity
            : 1,
        unitCents:
          parseGenericMoneyToCents(
            unitPriceText
          ),
        totalCents:
          parseGenericMoneyToCents(
            totalPriceText
          ),
      });
    }

    currentItem = null;
  }

  for (const rawLine of lines) {
    const line =
      normalizeStructuredLine(rawLine);

    if (!line) continue;

    const cateringDateMatch = line.match(
      /^catering\s+am\s+(\d{1,2}\.\d{1,2}\.\d{4})$/i
    );

    if (cateringDateMatch) {
      currentCateringDate =
        String(cateringDateMatch[1] || "")
          .trim();

      currentItem = null;
      continue;
    }

    /*
     * Einzeilige vollständige Position:
     * 13 Glasnudelsalat Veggie 15 Stück 4,90 73,50
     */
    const completePositionRow = line.match(
      /^(\d{1,4})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:stück|stueck|stk\.?|st\.?|portionen?|personen?|pax|kg|g|liter|l)\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})(?:\s*(?:€|eur))?$/i
    );

    if (completePositionRow) {
      currentItem = {
        name:
          String(
            completePositionRow[2] || ""
          ).trim(),
        descriptionLines: [],
        rawLines: [line],
        cateringDate: currentCateringDate,
      };

      pushStructuredItem(
        completePositionRow[3],
        completePositionRow[4],
        completePositionRow[5]
      );

      continue;
    }

    /*
     * Abschlusszeile einer mehrzeiligen Position:
     * 7 Stück 13,90 97,30
     */
    const positionPriceRow = line.match(
      /^(\d+(?:[.,]\d+)?)\s+(?:stück|stueck|stk\.?|st\.?|portionen?|personen?|pax|kg|g|liter|l)\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})(?:\s*(?:€|eur))?$/i
    );

    if (positionPriceRow && currentItem) {
      currentItem.rawLines.push(line);

      pushStructuredItem(
        positionPriceRow[1],
        positionPriceRow[2],
        positionPriceRow[3]
      );

      continue;
    }

    /*
     * Start einer neuen mehrzeiligen Position:
     * 10 Chicken Bowl
     */
    const positionStart = line.match(
      /^(\d{1,4})[.)-]?\s+(.+)$/
    );

    if (positionStart) {
      const possibleName =
        normalizeStructuredLine(
          positionStart[2]
        );

      if (
        /[A-Za-zÄÖÜäöüß]/.test(
          possibleName
        ) &&
        !isStructuredNoiseLine(
          possibleName
        ) &&
        !/^\d{5}\s+/.test(line)
      ) {
        currentItem = {
          name: possibleName,
          descriptionLines: [],
          rawLines: [line],
          cateringDate:
            currentCateringDate,
        };

        continue;
      }
    }

    if (!currentItem) {
      continue;
    }

    if (isStructuredNoiseLine(line)) {
      continue;
    }

    if (
      /^(?:übertrag|uebertrag|zwischensumme|gesamtbetrag|umsatzsteuer)\b/i.test(
        line
      )
    ) {
      continue;
    }

    currentItem.descriptionLines.push(
      line
    );

    currentItem.rawLines.push(line);
  }

  return items;
}

function isStandaloneImportedOrderNoteLine(
  value: string
) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    /^(?:kein|ohne)\s+(?:schweinefleisch|fleisch|nüsse|nuesse|gluten|laktose)$/i.test(
      normalized
    ) ||
    /^beschilderung\b/i.test(normalized) ||
    /^(?:allergien?|allergene?|unverträglichkeiten?|unvertraeglichkeiten?)\b/i.test(
      normalized
    ) ||
    /^(?:nuss|nüsse|nuesse|erdbeeren?|gluten|laktose)(?:\s*[,/+&]\s*(?:nuss|nüsse|nuesse|erdbeeren?|gluten|laktose))*$/i.test(
      normalized
    )
  );
}

function removeLeadingImportedOrderNotes(
  values: string[]
) {
  const result = [...values];

  while (
    result.length > 0 &&
    isStandaloneImportedOrderNoteLine(
      result[0]
    )
  ) {
    result.shift();
  }

  return result;
}

/*
 * Unterstützt Tabellenextraktionen wie:
 *
 * Bitte mit mehr Rührei planen 80 € 1 80.0
 *
 * Reihenfolge:
 * Produktname, Einzelpreis, Währung,
 * Menge, Positionssumme
 */
function parseNameUnitQuantityTotalRow(
  value: string
) {
  const match = String(value || "")
    .trim()
    .match(
      /^(.+?)\s+([0-9]+(?:[.,][0-9]+)?)\s*(?:€|eur)\s+(\d+(?:[.,]\d+)?)\s+([0-9]+(?:[.,][0-9]+)?)$/i
    );

  if (!match) {
    return null;
  }

  const name = String(match[1] || "")
    .replace(/\s+/g, " ")
    .trim();

  const quantity = Number(
    String(match[3] || "")
      .replace(",", ".")
  );

  const unitCents =
    parseGenericMoneyToCents(match[2]);

  const totalCents =
    parseGenericMoneyToCents(match[4]);

  if (
    !name ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    unitCents <= 0 ||
    totalCents <= 0
  ) {
    return null;
  }

  return {
    name,
    quantity,
    unitCents,
    totalCents,
  };
}

function extractGenericItems(lines: string[]) {
  const items: ExtractedOrderItem[] = [];
  let pendingNameLines: string[] = [];
  let currentCateringDate = "";

  function normalizeLine(value: string) {
    return String(value || "")
      .replace(/\uFFFD|\uFFFE/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripPositionNumber(value: string) {
    return normalizeLine(value)
      .replace(
        /^\d{1,3}[.)-]?\s+(?=[A-Za-zÄÖÜäöüß])/,
        ""
      )
      .trim();
  }

  function splitSingleProductText(value: string) {
    let name = stripPositionNumber(value);
    let description = "";

    const descriptionMarker = name.match(
      /^(.+?)\s+(mit|beinhaltet|bestehend aus|gefüllt mit|serviert mit|dazu|inkl\.?|inklusive)\s+(.+)$/i
    );

    if (descriptionMarker) {
      name = String(descriptionMarker[1] || "").trim();

      description = [
        descriptionMarker[2],
        descriptionMarker[3],
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
    }
    else {
      const commaIndex = name.indexOf(",");

      if (commaIndex >= 4) {
        description = name
          .slice(commaIndex + 1)
          .trim();

        name = name
          .slice(0, commaIndex)
          .trim();
      }
    }

    return {
      name,
      description,
    };
  }

  function splitProductLines(rawLines: string[]) {
    const normalizedLines = rawLines
      .map(normalizeLine)
      .filter(Boolean)
      .filter(
        (line) =>
          !isGenericItemNoiseLine(line)
      );

    if (normalizedLines.length === 0) {
      return {
        name: "",
        description: "",
      };
    }

    const firstLine =
      stripPositionNumber(normalizedLines[0]);

    const followingLines =
      normalizedLines
        .slice(1)
        .map(normalizeLine)
        .filter(Boolean);

    if (followingLines.length > 0) {
      return {
        name: firstLine,
        description: followingLines
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      };
    }

    return splitSingleProductText(firstLine);
  }

  function pushItem({
    name,
    description,
    quantity,
    unitCents,
    totalCents,
    rawLine,
  }: {
    name: string;
    description?: string;
    quantity: number;
    unitCents: number;
    totalCents: number;
    rawLine: string;
  }) {
    const cleanedName =
      stripPositionNumber(name);

    const cleanedDescription =
      normalizeLine(description || "");

    if (!hasUsefulProductText(cleanedName)) {
      return;
    }

    if (
      isInvalidImportedItem(
        cleanedName,
        cleanedDescription,
        rawLine
      )
    ) {
      return;
    }

    items.push({
      name: cleanedName,
      description: cleanedDescription,
      rawLine,
      cateringDate: currentCateringDate || undefined,
      quantity:
        Number.isFinite(quantity) && quantity > 0
          ? quantity
          : 1,
      unitCents:
        Number.isFinite(unitCents) && unitCents > 0
          ? unitCents
          : 0,
      totalCents:
        Number.isFinite(totalCents) && totalCents > 0
          ? totalCents
          : 0,
    });
  }

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);

    if (!line) {
      continue;
    }

    const cateringDateMatch = line.match(
      /^catering\s+am\s+(\d{1,2}\.\d{1,2}\.\d{4})$/i
    );

    if (cateringDateMatch) {
      currentCateringDate =
        String(cateringDateMatch[1] || "").trim();

      pendingNameLines = [];
      continue;
    }

    if (
      /^(?:übertrag|uebertrag|seitenübertrag|seitenuebertrag)\b/i.test(line)
    ) {
      pendingNameLines = [];
      continue;
    }
    if (isGenericItemNoiseLine(line)) {
      /*
       * Seitenköpfe, Fußzeilen und Firmendaten dürfen
       * eine laufende Position nicht verwerfen.
       */
      continue;
    }

    /*
     * Vollständige Tabellenzeile mit Positionsnummer und Einheit:
     *
     * 32 Glasnudelsalat Veggie 15 Stück 4,90 73,50
     *
     * Gruppe 1 = Positionsnummer
     * Gruppe 2 = Produktname
     * Gruppe 3 = Menge
     * Gruppe 4 = Einzelpreis
     * Gruppe 5 = Gesamtpreis
     */
    const positionedUnitRow = line.match(
      /^(\d{1,4})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:stück|stueck|stk\.?|st\.?|portionen?|personen?|pax|kg|g|liter|l)\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})(?:\s*(?:€|eur))?$/i
    );

    if (positionedUnitRow) {
      const quantity = Number(
        String(positionedUnitRow[3] || "")
          .replace(",", ".")
      );

      pushItem({
        name: String(positionedUnitRow[2] || "")
          .replace(/\s+/g, " ")
          .trim(),

        description: "",

        quantity:
          Number.isFinite(quantity) && quantity > 0
            ? quantity
            : 1,

        unitCents:
          parseGenericMoneyToCents(
            positionedUnitRow[4]
          ),

        totalCents:
          parseGenericMoneyToCents(
            positionedUnitRow[5]
          ),

        rawLine: line,
      });

      pendingNameLines = [];
      continue;
    }
    const completeRow = line.match(
      /^(\d+)\s+(.+?)\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})(?:\s*(?:€|eur))?$/i
    );

    if (completeRow) {
      const parsedText =
        splitProductLines([
          ...pendingNameLines,
          String(completeRow[2] || ""),
        ]);

      pushItem({
        name: parsedText.name,
        description: parsedText.description,
        quantity:
          Number(completeRow[1]) || 1,
        unitCents:
          parseGenericMoneyToCents(
            completeRow[3]
          ),
        totalCents:
          parseGenericMoneyToCents(
            completeRow[4]
          ),
        rawLine: line,
      });

      pendingNameLines = [];
      continue;
    }

    const priceOnlyRow = line.match(
      /^(\d+)\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})\s+(\d{1,6}(?:\.\d{3})*(?:,\d{2})|\d{1,6}\.\d{2})(?:\s*(?:€|eur))?$/i
    );

    if (priceOnlyRow) {
      const parsedText =
        splitProductLines(
          pendingNameLines
        );

      pushItem({
        name: parsedText.name,
        description: parsedText.description,
        quantity:
          Number(priceOnlyRow[1]) || 1,
        unitCents:
          parseGenericMoneyToCents(
            priceOnlyRow[2]
          ),
        totalCents:
          parseGenericMoneyToCents(
            priceOnlyRow[3]
          ),
        rawLine:
          pendingNameLines.join(" | ") +
          " | " +
          line,
      });

      pendingNameLines = [];
      continue;
    }

    const quantityTextRow = line.match(
      /^(\d+)\s*(?:x|stk|st\.|stück|portionen|personen|pax)\s+(.+?)(?:\s+(\d+[,.]\d{2})\s*(?:€|eur)?)?$/i
    );

    if (quantityTextRow) {
      const parsedText =
        splitProductLines([
          ...pendingNameLines,
          String(quantityTextRow[2] || ""),
        ]);

      const totalCents =
        quantityTextRow[3]
          ? parseGenericMoneyToCents(
              quantityTextRow[3]
            )
          : 0;

      const quantity =
        Number(quantityTextRow[1]) || 1;

      pushItem({
        name: parsedText.name,
        description: parsedText.description,
        quantity,
        unitCents:
          totalCents > 0
            ? Math.round(
                totalCents / quantity
              )
            : 0,
        totalCents,
        rawLine: line,
      });

      pendingNameLines = [];
      continue;
    }

    const nameUnitQuantityTotalRow =
      parseNameUnitQuantityTotalRow(line);

    if (nameUnitQuantityTotalRow) {
      const parsedText =
        splitProductLines(
          removeLeadingImportedOrderNotes([
            ...pendingNameLines,
            nameUnitQuantityTotalRow.name,
          ])
        );

      pushItem({
        name: parsedText.name,
        description: parsedText.description,
        quantity:
          nameUnitQuantityTotalRow.quantity,
        unitCents:
          nameUnitQuantityTotalRow.unitCents,
        totalCents:
          nameUnitQuantityTotalRow.totalCents,
        rawLine: line,
      });

      pendingNameLines = [];
      continue;
    }
    const separatedValues = line
      .split(/\s+/)
      .filter(Boolean);

    const onlyNumbersAndPrices =
      separatedValues.length > 0 &&
      separatedValues.every(
        (value) =>
          /^\d+$/.test(value) ||
          looksLikePriceValue(value) ||
          /^(?:€|eur)$/i.test(value)
      );

    if (onlyNumbersAndPrices) {
      continue;
    }
    if (
      isStandaloneImportedOrderNoteLine(
        line
      )
    ) {
      continue;
    }

    if (looksLikeGenericItemLine(line)) {
      pendingNameLines.push(line);

      if (pendingNameLines.length > 8) {
        pendingNameLines =
          pendingNameLines.slice(-8);
      }
    }
  }

  return items;
}

function extractGenericOrder(text: string): ExtractedOrder {
  const normalizedText = String(text || "").replace(/\r/g, "");
  const lines = normalizedText
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const source = detectOrderSource(normalizedText);

  const customerNameFromLabel =
    extractFirstGenericValue(normalizedText, [
      /(?:Kunde|Firma|Unternehmen|Company|Customer)\s*[:\-]\s*(.+)/i,
      /(?:Auftraggeber|Besteller|Rechnungsempfänger|Rechnungsempfaenger)\s*[:\-]\s*(.+)/i,
    ]);

  const customerCompanyFallback =
    lines.find((line) => {
      const value = String(line || "")
        .replace(/\s+/g, " ")
        .trim();

      const lower = value.toLowerCase();

      if (!value || value.length < 3 || value.length > 120) {
        return false;
      }

      if (
        lower.includes("edis gastrobetriebe") ||
        lower.includes("gastario") ||
        lower.includes("heycater") ||
        lower.includes("hey group") ||
        lower.includes("qonto") ||
        lower.includes("rechnungsempfänger") ||
        lower.includes("rechnungsempfaenger") ||
        lower.includes("lieferadresse") ||
        lower.includes("auftragsbestätigung") ||
        lower.includes("auftragsbestaetigung")
      ) {
        return false;
      }

      return /\b(gmbh|ug|ag|se|kg|ohg|gbr|e\.v\.|ev|inc\.?|ltd\.?|llc)\b/i.test(
        value
      );
    }) || "";

  function isPlausibleCustomerName(value: string) {
    const normalized = String(value || "")
      .replace(/\s+/g, " ")
      .trim();

    const lower = normalized.toLowerCase();

    if (!normalized || normalized.length < 3) {
      return false;
    }

    if (
      /^\d{1,3}[.)-]?\s+/.test(normalized) ||
      /^\d+(?:[,.]\d+)?$/.test(normalized)
    ) {
      return false;
    }

    if (
      /\b(bowl|wrap|salat|curry|pizza|bagel|buffet|frühstück|fruehstueck|sommerrolle|falafel|chicken|vegan|veggie|dessert|kuchen|schnittchen)\b/i.test(
        lower
      )
    ) {
      return false;
    }

    if (
      /^(?:kunde|firma|unternehmen|company|customer)$/i.test(
        normalized
      )
    ) {
      return false;
    }

    return true;
  }

  const customerName =
    isPlausibleCustomerName(customerNameFromLabel)
      ? customerNameFromLabel
      : isPlausibleCustomerName(customerCompanyFallback)
        ? customerCompanyFallback
        : "";

  const contactName = extractFirstGenericValue(normalizedText, [
    /(?:Ansprechpartner|Kontakt|Contact|Contact person)\s*[:\-]\s*(.+)/i,
  ]);

  const contactPhone = extractFirstGenericValue(normalizedText, [
    /(?:Telefon|Tel\.?|Phone|Mobile|Handy)\s*[:\-]\s*([+0-9][0-9\s\/().-]+)/i,
  ]);

  const deliveryDate =
    parseAnyDateToGerman(extractFirstGenericValue(normalizedText, [
      /(?:Lieferdatum|Lieferung am|Delivery date|Delivery)\s*[:\-]\s*([0-9.\/-]+)/i,
      /(?:Eventdatum|Event date|Veranstaltungsdatum)\s*[:\-]\s*([0-9.\/-]+)/i,
      /(?:Datum)\s*[:\-]\s*([0-9.\/-]+)/i,
    ])) ||
    parseAnyDateToGerman(normalizedText);

  const deliveryTime = extractFirstGenericValue(normalizedText, [
    /(?:Lieferzeit|Uhrzeit|Delivery time|Time)\s*[:\-]\s*([0-9]{1,2}:[0-9]{2})/i,
    /\b([0-9]{1,2}:[0-9]{2})\s*(?:Uhr)?\b/i,
  ]);

  const eventDate = parseAnyDateToGerman(extractFirstGenericValue(normalizedText, [
    /(?:Eventdatum|Event date|Veranstaltungsdatum)\s*[:\-]\s*([0-9.\/-]+)/i,
  ]));

  const eventStart = extractFirstGenericValue(normalizedText, [
    /(?:Eventbeginn|Beginn|Start)\s*[:\-]\s*([0-9]{1,2}:[0-9]{2})/i,
  ]);

  const presentation = extractFirstGenericValue(normalizedText, [
    /(?:Event|Veranstaltung|Anlass|Betreff|Subject)\s*[:\-]\s*(.+)/i,
  ]);

  const deliveryAddress =
    extractFirstGenericValue(normalizedText, [
      /(?:Lieferadresse|Adresse|Delivery address|Location|Ort)\s*[:\-]\s*(.+)/i,
    ]) ||
    (() => {
      const zipLineIndex = lines.findIndex((line) => /\b\d{5}\s+[A-Za-zÄÖÜäöüß-]+/.test(line));
      if (zipLineIndex < 0) return "";

      const cityLine = lines[zipLineIndex];
      const streetLine = [...lines.slice(Math.max(0, zipLineIndex - 5), zipLineIndex)]
        .reverse()
        .find((line) => /straße|strasse|str\.|allee|weg|platz|damm|ufer|ring|chaussee/i.test(line) && /\b\d+[a-z]?\b/i.test(line) && !/\b(gmbh|ug|ag|se|kg|ohg|gbr|e\.v\.|ev|catering|management|solutions|group|holding)\b/i.test(line)) || "";

      return [streetLine, cityLine].filter(Boolean).join(", ");
    })();

  const genericItems =
    extractGenericItems(lines);

  const structuredItems =
    extractStructuredPositionBlocks(lines);

  const expectedNetTotalCents =
    extractFinalDocumentTotals(
      normalizedText
    ).pdfNetTotalCents;

  function getItemsTotalCents(
    values: ExtractedOrderItem[]
  ) {
    return values.reduce(
      (sum, item) => {
        const importedTotalCents =
          Math.max(
            0,
            Number(item.totalCents || 0)
          );

        const calculatedTotalCents =
          Math.max(
            0,
            Number(item.quantity || 1)
          ) *
          Math.max(
            0,
            Number(item.unitCents || 0)
          );

        return (
          sum +
          (
            importedTotalCents > 0
              ? importedTotalCents
              : calculatedTotalCents
          )
        );
      },
      0
    );
  }

  const genericItemsTotalCents =
    getItemsTotalCents(genericItems);

  const structuredItemsTotalCents =
    getItemsTotalCents(
      structuredItems
    );

  const useStructuredItems =
    structuredItems.length > 0 &&
    (
      genericItems.length === 0 ||
      (
        expectedNetTotalCents > 0 &&
        Math.abs(
          structuredItemsTotalCents -
          expectedNetTotalCents
        ) <
        Math.abs(
          genericItemsTotalCents -
          expectedNetTotalCents
        )
      ) ||
      (
        expectedNetTotalCents <= 0 &&
        structuredItems.length >
        genericItems.length
      )
    );

  const items =
    useStructuredItems
      ? structuredItems
      : genericItems;

  return {
    source,
    customerName,
    contactName,
    contactPhone,
    deliveryDate,
    deliveryTime,
    eventDate,
    eventStart,
    deliveryAddress,
    presentation,
    items,
  };
}

function scoreExtractedOrder(
  order: ExtractedOrder
) {
  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const validItems = items.filter((item) => {
    const name = String(item?.name || "")
      .replace(/\s+/g, " ")
      .trim();

    return (
      /[a-zäöüß]/i.test(name) &&
      (name.match(/[a-zäöüß]/gi) || []).length >= 3
    );
  });

  const pricedItems = validItems.filter(
    (item) =>
      Number(item?.unitCents || 0) > 0 ||
      Number(item?.totalCents || 0) > 0
  );

  const invalidNumericItems =
    items.filter((item) => {
      const name = String(item?.name || "")
        .replace(/\s+/g, " ")
        .trim();

      const letters =
        name.match(/[a-zäöüß]/gi) || [];

      return letters.length < 3;
    });

  let score = 0;

  if (order.customerName) {
    score += 2;
  }

  if (order.deliveryDate) {
    score += 2;
  }

  if (order.deliveryTime) {
    score += 1;
  }

  if (order.deliveryAddress) {
    score += 2;
  }

  if (validItems.length > 0) {
    score += 2;
    score += Math.min(validItems.length, 3);
  }

  if (pricedItems.length > 0) {
    score += 2;
  }

  score -= invalidNumericItems.length * 2;

  return score;
}

function parseDocumentMoneyToCents(value: string) {
  const normalized = String(value || "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(normalized);

  return Number.isFinite(amount)
    ? Math.round(amount * 100)
    : 0;
}

function extractLastMoneyMatch(
  text: string,
  pattern: RegExp
) {
  const matches = Array.from(
    String(text || "").matchAll(pattern)
  );

  const lastMatch = matches[matches.length - 1];

  return lastMatch?.[1]
    ? parseDocumentMoneyToCents(lastMatch[1])
    : 0;
}

function extractFinalDocumentTotals(text: string) {
  return {
    pdfNetTotalCents:
      extractLastMoneyMatch(
        text,
        /Zwischensumme\s*\(netto\)\s*([0-9.]+,[0-9]{2})/gi
      ) ||
      extractLastMoneyMatch(
        text,
        /(?:Gesamtbetrag\s*Netto|Gesamt\s*netto|Nettosumme|Summe\s*netto)\s*(?:€|EUR)?\s*[:\-]?\s*([0-9.]+,[0-9]{1,2})/gi
      ),

    pdfTaxTotalCents:
      extractLastMoneyMatch(
        text,
        /(?:Umsatzsteuer|Mehrwertsteuer|MwSt\.?)(?:\s+[0-9.,]+\s*%)?\s*(?:€|EUR)?\s*[:\-]?\s*([0-9.]+,[0-9]{1,2})/gi
      ),

    pdfGrossTotalCents:
      extractLastMoneyMatch(
        text,
        /Gesamtbetrag\s*[:\-]?\s*([0-9.]+,[0-9]{2})/gi
      ) ||
      extractLastMoneyMatch(
        text,
        /(?:Gesamtbestellwert|Gesamtsumme|Summe\s*brutto|Bruttosumme)\s*(?:€|EUR)?\s*[:\-]?\s*([0-9.]+,[0-9]{1,2})/gi
      ),
  };
}

function extractDocumentCustomerName(text: string) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split(/\n/)
    .map((line) =>
      String(line || "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const firstPageEndIndex =
    lines.findIndex((line) =>
      /^Seite\s+1\s*\/\s*\d+/i.test(line)
    );

  const firstPageLines =
    firstPageEndIndex >= 0
      ? lines.slice(0, firstPageEndIndex)
      : lines.slice(0, 180);

  const candidates = firstPageLines.filter((line) => {
    const lower = line.toLowerCase();

    if (
      !/\b(gmbh|ug|ag|se|kg|ohg|gbr|e\.v\.|ev|inc\.?|ltd\.?|llc)\b/i.test(
        line
      )
    ) {
      return false;
    }

    if (
      lower.includes("edis gastrobetriebe") ||
      lower.includes("gastario") ||
      lower.includes("heycater") ||
      lower.includes("hey group") ||
      lower.includes("qonto") ||
      lower.includes("landesbank") ||
      lower.includes("sparkasse")
    ) {
      return false;
    }

    return true;
  });

  return candidates.length > 0
    ? candidates[candidates.length - 1]
    : "";
}

function normalizeFinalImportedItem(
  item: ExtractedOrderItem
): ExtractedOrderItem | null {
  let name = String(item?.name || "")
    .replace(/\s+/g, " ")
    .trim();

  let description = String(
    item?.description || ""
  )
    .replace(/\s+/g, " ")
    .trim();

  /*
   * PDF-Positionsnummer entfernen:
   * "16 12er Mini Chicken Wrap"
   * wird zu "12er Mini Chicken Wrap".
   */
  name = name.replace(
    /^\d{1,3}[.)-]?\s+(?=(?:\d{1,3}(?:er)?\s+)?[A-Za-zÄÖÜäöüß])/,
    ""
  );

  description = description.replace(
    /^\d{1,3}[.)-]?\s+(?=[A-Za-zÄÖÜäöüß])/,
    ""
  );

  /*
   * Überträge und Summenzeilen entfernen.
   */
  if (
    /^catering\s+am\s+\d{1,2}\.\d{1,2}\.\d{4}$/i.test(
      name
    )
  ) {
    return null;
  }

  if (
    /^(?:übertrag|uebertrag|seitenübertrag|seitenuebertrag|zwischensumme|gesamtsumme|gesamtbetrag|summe netto|summe brutto|nettosumme|bruttosumme)\b/i.test(
      name
    )
  ) {
    return null;
  }

  if (
    !name ||
    !/[A-Za-zÄÖÜäöüß]/.test(name)
  ) {
    return null;
  }

  const quantity = Math.max(
    1,
    Number(item?.quantity || 1)
  );

  const unitCents = Math.max(
    0,
    Number(item?.unitCents || 0)
  );

  const importedTotalCents = Math.max(
    0,
    Number(item?.totalCents || 0)
  );

  return {
    ...item,
    name,
    description,
    quantity,
    unitCents,
    totalCents:
      importedTotalCents > 0
        ? importedTotalCents
        : quantity * unitCents,
  };
}

function isOwnImportedBusinessAddress(
  value: string
) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized.includes("goerzallee 299") ||
    normalized.includes("edis gastrobetriebe")
  );
}

function extractImportedPositionDeliveryAddress(
  items: ExtractedOrderItem[]
) {
  const firstItem =
    Array.isArray(items) && items.length > 0
      ? items[0]
      : null;

  if (!firstItem) {
    return "";
  }

  const combined = [
    firstItem.name,
    firstItem.description,
    firstItem.rawLine,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!combined) {
    return "";
  }

  const addressMatch = combined.match(
    /((?:[^,|]{2,90},\s*)?[^,|]*(?:straße|strasse|str\.|chaussee|allee|weg|platz|damm|ufer|ring)\s*\d+[a-z]?(?:\s*[-–]\s*\d+[a-z]?)?\s*,\s*\d{5}\s+[A-Za-zÄÖÜäöüß-]+(?:\s+[A-Za-zÄÖÜäöüß-]+)?)/i
  );

  if (!addressMatch?.[1]) {
    return "";
  }

  return String(addressMatch[1])
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}
function normalizeFinalImportedOrder(
  order: ExtractedOrder,
  text: string
): ExtractedOrder {
  const items = (
    Array.isArray(order.items)
      ? order.items
      : []
  )
    .map(normalizeFinalImportedItem)
    .filter(
      (
        item
      ): item is ExtractedOrderItem =>
        Boolean(item)
    );

  const documentTotals =
    extractFinalDocumentTotals(text);

  const documentCustomerName =
    extractDocumentCustomerName(text);

  const resolvedCustomerName =
    resolveReliableCustomerName({
      text,
      parserCustomerName:
        documentCustomerName ||
        order.customerName ||
        "",
      items,
    });

  return {
    ...order,

    pdfNetTotalCents:
      documentTotals.pdfNetTotalCents,

    pdfTaxTotalCents:
      documentTotals.pdfTaxTotalCents,

    pdfGrossTotalCents:
      documentTotals.pdfGrossTotalCents,

    customerName: resolvedCustomerName,

    contactName: String(
      order.contactName || ""
    )
      .replace(/\s+/g, " ")
      .trim(),

    deliveryAddress: (() => {
      const existingAddress =
        String(order.deliveryAddress || "")
          .replace(/\s+/g, " ")
          .trim();

      const positionAddress =
        extractImportedPositionDeliveryAddress(
          items
        );

      if (
        !existingAddress ||
        isOwnImportedBusinessAddress(
          existingAddress
        )
      ) {
        return positionAddress || "";
      }

      return existingAddress;
    })(),

    items,
  };
}

export function extractUniversalOrder(
  text: string
): ExtractedOrder {
  const normalizedSourceText =
    String(text || "").replace(/\r/g, "");

  const isStructuredHeycaterConfirmation =
    /hiermit\s+erh[aä]ltst?\s+du\s+die\s+verbindliche\s+auftragsbest[aä]tigung/i.test(
      normalizedSourceText
    ) &&
    /(?:^|\n)\s*Kunde:\s*(?:\n|$)/i.test(
      normalizedSourceText
    ) &&
    /(?:^|\n)\s*Lieferadresse:\s*(?:\n|$)/i.test(
      normalizedSourceText
    ) &&
    /Gesamtbetrag\s*Netto/i.test(
      normalizedSourceText
    ) &&
    /Gesamtbestellwert/i.test(
      normalizedSourceText
    );

  const heycaterOrder =
    extractHeycaterOrder(normalizedSourceText);

  const genericOrder =
    extractGenericOrder(normalizedSourceText);

  if (isStructuredHeycaterConfirmation) {
    const normalizedHeycaterOrder =
      normalizeFinalImportedOrder(
        {
          ...heycaterOrder,
          source: "Heycater",
        },
        normalizedSourceText
      );

    /*
     * Die strukturierten Heycater-Felder haben Vorrang.
     * Die allgemeine Dokumenterkennung darf Produkttexte
     * hier niemals als Kunde oder Kontakt einsetzen.
     */
    return {
      ...normalizedHeycaterOrder,
      source: "Heycater",
      customerName: heycaterOrder.customerName,
      contactName: heycaterOrder.contactName,
      contactPhone: heycaterOrder.contactPhone,
      deliveryDate: heycaterOrder.deliveryDate,
      deliveryTime: heycaterOrder.deliveryTime,
      eventDate: heycaterOrder.eventDate,
      eventStart: heycaterOrder.eventStart,
      deliveryAddress: heycaterOrder.deliveryAddress,
      presentation: heycaterOrder.presentation,
    };
  }

  const heycaterScore =
    scoreExtractedOrder(heycaterOrder);

  const genericScore =
    scoreExtractedOrder(genericOrder);

  const primaryOrder =
    genericScore > heycaterScore
      ? genericOrder
      : (
          heycaterScore >= genericScore &&
          (
            heycaterOrder.customerName ||
            heycaterOrder.deliveryDate ||
            heycaterOrder.deliveryAddress ||
            heycaterOrder.items.length > 0
          )
        )
        ? heycaterOrder
        : genericOrder;

  const secondaryOrder =
    primaryOrder === genericOrder
      ? heycaterOrder
      : genericOrder;

  return normalizeFinalImportedOrder({
    ...primaryOrder,

    customerName:
      primaryOrder.customerName ||
      secondaryOrder.customerName,

    contactName:
      primaryOrder.contactName ||
      secondaryOrder.contactName,

    contactPhone:
      primaryOrder.contactPhone ||
      secondaryOrder.contactPhone,

    deliveryDate:
      primaryOrder.deliveryDate ||
      secondaryOrder.deliveryDate,

    deliveryTime:
      primaryOrder.deliveryTime ||
      secondaryOrder.deliveryTime,

    eventDate:
      primaryOrder.eventDate ||
      secondaryOrder.eventDate,

    eventStart:
      primaryOrder.eventStart ||
      secondaryOrder.eventStart,

    deliveryAddress:
      primaryOrder.deliveryAddress ||
      secondaryOrder.deliveryAddress,

    presentation:
      primaryOrder.presentation ||
      secondaryOrder.presentation,

    items:
      Array.isArray(primaryOrder.items) &&
      primaryOrder.items.length > 0
        ? primaryOrder.items
        : secondaryOrder.items,
  }, text);
}










