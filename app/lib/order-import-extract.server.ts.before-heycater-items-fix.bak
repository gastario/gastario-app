export type ExtractedOrderItem = {
  name: string;
  description?: string;
  rawLine?: string;
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

  const deliveryStreet = deliveryBlock.find((line) => /stra?e|strasse|str\.|allee|weg|platz|damm|ufer|ring/i.test(line)) || "";
  const deliveryZipCity = deliveryBlock.find((line) => /^\d{5}\s+/.test(line)) || "";
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
      ? [...lines.slice(Math.max(0, addressIndex - 6), addressIndex)]
          .reverse()
          .find((line) =>
            !isOwnOrPlatformLine(line) &&
            !line.toLowerCase().includes("lieferadresse") &&
            /stra?e|strasse|str\.|allee|weg|platz|damm|ufer|ring/i.test(line)
          ) || ""
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

    if (!priceMatch) {
      currentLines.push(line);
      continue;
    }

    const prefixName = String(priceMatch[1] || "").trim();
    const quantity = Number(priceMatch[2] || 1);
    const unitCents = toCents(priceMatch[3]);
    const totalCents = toCents(priceMatch[4]);

    const rowLines = [...currentLines, prefixName]
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !isNoiseLine(item));

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

      if (isInvalidImportedItem(name, description, rowLines.join(" | "))) {
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
    "lieferkosten",
    "liefergebuehr",
    "liefergeb?hr",
    "versand",
    "transport",
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

function looksLikeGenericItemLine(line: string) {
  const text = String(line || "").trim();
  if (!text) return false;

  const lower = text.toLowerCase();

  if (
    lower.includes("gesamt") ||
    lower.includes("summe") ||
    lower.includes("netto") ||
    lower.includes("brutto") ||
    lower.includes("ust") ||
    lower.includes("mwst") ||
    lower.includes("zahlungs") ||
    lower.includes("iban") ||
    lower.includes("bic")
  ) {
    return false;
  }

  if (/\b\d+\s*(x|stk|st\.|stück|portionen|personen|pax)\b/i.test(text)) return true;
  if (/\b\d+[,.]\d{2}\s*€/.test(text) && /[a-zäöüß]/i.test(text)) return true;
  if (/^\d+\s+.+\s+\d+[,.]\d{2}/.test(text)) return true;

  return false;
}

function extractGenericItems(lines: string[]) {
  const items: ExtractedOrderItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!looksLikeGenericItemLine(line)) continue;

    let quantity = 1;
    let name = line;
    let unitCents = 0;
    let totalCents = 0;

    const qtyMatch =
      line.match(/\b([0-9]+)\s*x\s+(.+)/i) ||
      line.match(/\b([0-9]+)\s*(stk|st\.|stück|portionen|personen|pax)\s+(.+)/i);

    if (qtyMatch) {
      quantity = Number(qtyMatch[1]) || 1;
      name = qtyMatch[3] || qtyMatch[2] || line;
    }

    const euroValues = [...line.matchAll(/([0-9]{1,6}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]{1,6}\.[0-9]{2})\s*€/g)]
      .map((match) => parseGenericMoneyToCents(match[1]))
      .filter((value) => value > 0);

    if (euroValues.length >= 2) {
      unitCents = euroValues[0];
      totalCents = euroValues[euroValues.length - 1];
    } else if (euroValues.length === 1) {
      totalCents = euroValues[0];
      unitCents = quantity > 0 ? Math.round(totalCents / quantity) : totalCents;
    }

    name = name
      .replace(/\b[0-9]+\s*(x|stk|st\.|stück|portionen|personen|pax)\b/gi, "")
      .replace(/([0-9]{1,6}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]{1,6}\.[0-9]{2})\s*€/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!name || name.length < 3) continue;

    items.push({
      name,
      description: "",
      rawLine: line,
      quantity: quantity > 0 ? quantity : 1,
      unitCents,
      totalCents,
    });
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

  const customerName = extractFirstGenericValue(normalizedText, [
    /(?:Kunde|Firma|Unternehmen|Company|Customer)\s*[:\-]\s*(.+)/i,
    /(?:Auftraggeber|Besteller|Rechnungsempfänger|Rechnungsempfaenger)\s*[:\-]\s*(.+)/i,
  ]);

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
        .find((line) => /straße|strasse|str\.|allee|weg|platz|damm|ufer|ring|chaussee/i.test(line)) || "";

      return [streetLine, cityLine].filter(Boolean).join(", ");
    })();

  const items = extractGenericItems(lines);

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

function scoreExtractedOrder(order: ExtractedOrder) {
  const items = Array.isArray(order.items) ? order.items : [];
  const pricedItems = items.filter((item) => Number(item.totalCents || 0) > 0);

  let score = 0;
  if (order.customerName) score += 2;
  if (order.deliveryDate) score += 2;
  if (order.deliveryTime) score += 1;
  if (order.deliveryAddress) score += 2;
  if (items.length > 0) score += 2;
  if (pricedItems.length > 0) score += 2;

  return score;
}

export function extractUniversalOrder(text: string): ExtractedOrder {
  const heycaterOrder = extractHeycaterOrder(text);
  const genericOrder = extractGenericOrder(text);

  const heycaterScore = scoreExtractedOrder(heycaterOrder);
  const genericScore = scoreExtractedOrder(genericOrder);

  if (genericScore > heycaterScore) {
    return genericOrder;
  }

  if (
    heycaterScore >= genericScore &&
    (heycaterOrder.customerName ||
      heycaterOrder.deliveryDate ||
      heycaterOrder.deliveryAddress ||
      heycaterOrder.items.length > 0)
  ) {
    return heycaterOrder;
  }

  return genericOrder;
}
