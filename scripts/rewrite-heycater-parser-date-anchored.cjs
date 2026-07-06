const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

const functionStart = content.indexOf("export function parseHeycaterLabelsFromText");
if (functionStart === -1) {
  throw new Error("parseHeycaterLabelsFromText nicht gefunden.");
}

const before = content.slice(0, functionStart);

const newFunction = `function isAddressLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  if (!text) return false;
  if (/\\\\b\\\\d{5}\\\\b/.test(text)) return true;
  if (lower.includes("strasse")) return true;
  if (lower.includes("straße")) return true;
  if (lower.includes("allee")) return true;
  if (lower.includes("platz")) return true;
  if (lower.includes("berlin")) return true;

  return false;
}

function isHardMetaLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  if (!text) return true;
  if (isDate(text)) return true;
  if (lower.includes("caterer:")) return true;
  if (lower.includes("customer:")) return true;
  if (lower.includes("powered by")) return true;
  if (lower.includes("pdf generator")) return true;
  if (/--\\\\s*\\\\d+\\\\s*of\\\\s*\\\\d+\\\\s*--/i.test(text)) return true;
  if (/^\\\\d+\\\\s*of\\\\s*\\\\d+$/i.test(text)) return true;

  return false;
}

function isProbablyPersonName(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  if (!text) return false;
  if (text.length < 2 || text.length > 70) return false;
  if (isHardMetaLine(text)) return false;
  if (isAddressLine(text)) return false;
  if (lower.includes("gluten")) return false;
  if (lower.includes("halal")) return false;
  if (lower.includes("vegetarian")) return false;
  if (lower.includes("vegan")) return false;
  if (lower.includes("poultry")) return false;
  if (lower.includes("milk")) return false;
  if (lower.includes("soy")) return false;
  if (lower.includes("sesame")) return false;
  if (lower.includes("nuts")) return false;
  if (lower.includes("fish")) return false;
  if (lower.includes("bowl")) return false;
  if (lower.includes("wrap")) return false;
  if (lower.includes("salad")) return false;
  if (lower.includes("risotto")) return false;
  if (lower.includes("curry")) return false;
  if (lower.includes("chicken")) return false;
  if (lower.includes("salmon")) return false;

  return true;
}

function pickNameFromBlock(block: string[]) {
  for (const line of block) {
    if (isProbablyPersonName(line)) return cleanLine(line);
  }

  return "Name nicht erkannt";
}

function pickAddressFromBlock(block: string[]) {
  return (
    block.find((line) => isAddressLine(line)) ||
    "Adresse nicht erkannt"
  );
}

function pickMealFromBlock(block: string[], name: string, address: string) {
  const addressIndex = block.findIndex((line) => cleanLine(line) === cleanLine(address));

  if (addressIndex >= 0) {
    for (let i = addressIndex + 1; i < block.length; i++) {
      const line = cleanLine(block[i]);
      if (!line || isHardMetaLine(line)) continue;
      if (isAddressLine(line)) continue;
      if (isProbablyPersonName(line)) continue;

      return line;
    }
  }

  const nameIndex = block.findIndex((line) => cleanLine(line) === cleanLine(name));

  if (nameIndex >= 0) {
    for (let i = nameIndex + 1; i < block.length; i++) {
      const line = cleanLine(block[i]);
      if (!line || isHardMetaLine(line)) continue;
      if (isAddressLine(line)) continue;
      if (isProbablyPersonName(line)) continue;

      return line;
    }
  }

  for (const line of block) {
    const cleaned = cleanLine(line);
    if (!cleaned || isHardMetaLine(cleaned)) continue;
    if (isAddressLine(cleaned)) continue;
    if (isProbablyPersonName(cleaned)) continue;

    return cleaned;
  }

  return "Gericht nicht erkannt";
}

function pickDetailsFromBlock(block: string[], meal: string) {
  const mealIndex = block.findIndex((line) => cleanLine(line) === cleanLine(meal));
  const detailLines: string[] = [];

  if (mealIndex === -1) return "";

  for (let i = mealIndex + 1; i < block.length; i++) {
    const line = cleanLine(block[i]);
    const lower = normalize(line);

    if (!line) continue;
    if (isHardMetaLine(line)) break;
    if (isAddressLine(line)) break;
    if (isProbablyPersonName(line)) break;

    detailLines.push(line);
  }

  return detailLines.join(" / ");
}

export function parseHeycaterLabelsFromText(rawText: string): HeycaterLabelData[] {
  const lines = String(rawText || "")
    .split(/\\\\r?\\\\n/)
    .map(cleanLine)
    .filter(Boolean);

  const labels: HeycaterLabelData[] = [];

  const dateIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => isDate(entry.line))
    .map((entry) => entry.index);

  for (let d = 0; d < dateIndexes.length; d++) {
    const start = dateIndexes[d];
    const end = d + 1 < dateIndexes.length ? dateIndexes[d + 1] : lines.length;

    const date = extractDate(lines[start]);

    const block = lines
      .slice(start + 1, end)
      .map(cleanLine)
      .filter((line) => line && !isHardMetaLine(line));

    const name = pickNameFromBlock(block);
    const address = pickAddressFromBlock(block);
    const meal = pickMealFromBlock(block, name, address);
    const details = pickDetailsFromBlock(block, meal);

    const caterer =
      lines.slice(start + 1, end).find((line) => normalize(line).includes("caterer:")) ||
      "Caterer: Let Me Bowl heykantine";

    const customer =
      lines.slice(start + 1, end).find((line) => normalize(line).includes("customer:")) ||
      "Customer: Heycater";

    labels.push({
      name,
      date,
      meal,
      details,
      caterer,
      customer,
      address,
    });
  }

  return labels;
}
`;

fs.writeFileSync(path, before + newFunction, "utf8");
console.log("Heycater Parser jetzt datum-basiert: jedes Datum erzeugt exakt ein Label.");
