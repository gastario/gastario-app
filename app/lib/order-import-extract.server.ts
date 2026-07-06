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
    items: items.slice(0, 20),
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

