const fs = require("fs");

const parserPath = "app/lib/order-import-extract.server.ts";
let content = fs.readFileSync(parserPath, "utf8");

const insert = `
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

      const name = nameLines.join(" ").replace(/\\s+/g, " ").trim();
      const description = descriptionLines.join(" ").replace(/\\s+/g, " ").trim();

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
      const line = rawLine.replace(/\\uFFFD|\\uFFFE/g, "-").trim();

      if (!line || isDeliveryNoteNoiseLine(line)) {
        continue;
      }

      if (/^\\d+$/.test(line)) {
        finalizeDeliveryNoteItem(line);
        continue;
      }

      pendingLines.push(line);
    }
  }

`;

if (!content.includes("deliveryNoteTableStartIndex")) {
  const marker = "  return {\r\n    source:";
  const markerAlt = "  return {\n    source:";

  if (content.includes(marker)) {
    content = content.replace(marker, insert + marker);
  } else if (content.includes(markerAlt)) {
    content = content.replace(markerAlt, insert + markerAlt);
  } else {
    throw new Error("Marker fuer return { source: nicht gefunden.");
  }

  fs.writeFileSync(parserPath, content, "utf8");
  console.log("Parser gepatcht.");
} else {
  console.log("Parser-Patch war bereits vorhanden.");
}

const backfillPath = "scripts/backfill-empty-email-orders.ts";
let backfill = fs.readFileSync(backfillPath, "utf8");

backfill = backfill.replace(
  "return Boolean(name) && quantity > 0 && totalCents > 0;",
  "return Boolean(name) && quantity > 0;"
);

fs.writeFileSync(backfillPath, backfill, "utf8");
console.log("Backfill-Script gepatcht.");
