export type ExtractedOrderItem = {
  name: string;
  description?: string;
  rawLine?: string;
};

export type ExtractedOrder = {
  source: string;
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

  const zipCityLine = lines.find((line) => /^\d{5}\s+/.test(line)) || "";
  const addressIndex = zipCityLine ? lines.indexOf(zipCityLine) : -1;
  const streetLine = addressIndex > 0 ? lines[addressIndex - 1] : "";
  const deliveryAddress = [streetLine, zipCityLine].filter(Boolean).join(", ");

  const items: ExtractedOrderItem[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (/\b\d+\s*?\s*\d+/i.test(line) || /\b\d+\s+x\s+/i.test(line)) {
      const name = lines[index - 1] || "";
      const description = lines[index - 2] || "";

      if (name && !name.toLowerCase().includes("liefer")) {
        items.push({
          name,
          description,
          rawLine: line,
        });
      }
    }
  }

  return {
    source: text.toLowerCase().includes("hey") ? "Heycater" : "Unbekannt",
    deliveryDate,
    deliveryTime,
    eventDate,
    eventStart,
    deliveryAddress,
    presentation,
    items: items.slice(0, 20),
  };
}
