const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-clean-parser-duplicates", content, "utf8");

const helperStart = content.indexOf("function isAddressLine");
const parserStart = content.indexOf("export function parseHeycaterLabelsFromText");

if (helperStart === -1) {
  throw new Error("function isAddressLine nicht gefunden.");
}

if (parserStart === -1) {
  throw new Error("parseHeycaterLabelsFromText nicht gefunden.");
}

const before = content.slice(0, helperStart);

const cleanParser = `function isAddressLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  return (
    /\\b\\d{5}\\b/.test(text) ||
    lower.includes("strasse") ||
    lower.includes("straße") ||
    lower.includes("allee") ||
    lower.includes("platz") ||
    lower.includes("berlin")
  );
}

function isCatererLine(value: string) {
  return normalize(value).includes("caterer:");
}

function isCustomerLine(value: string) {
  return normalize(value).includes("customer:");
}

function isFooterLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  return (
    !text ||
    lower.includes("powered by") ||
    lower.includes("pdf generator") ||
    /--\\s*\\d+\\s*of\\s*\\d+\\s*--/i.test(text) ||
    /^\\d+\\s*of\\s*\\d+$/i.test(text)
  );
}

function isInfoLine(value: string) {
  const lower = normalize(value);

  const words = [
    "gluten",
    "lactose",
    "halal",
    "poultry",
    "milk",
    "soy",
    "soya",
    "soybeans",
    "sesame",
    "nuts",
    "peanut",
    "fish",
    "crustaceans",
    "cereals",
    "vegetarian",
    "vegan",
    "pescatarian",
    "sulphur",
    "sulfur",
    "sulphites",
    "sulfites",
    "celery",
    "mustard",
    "egg",
    "eggs"
  ];

  return words.some((word) => lower.includes(word));
}

function cleanBlockAfterDate(lines: string[], start: number, end: number) {
  return lines
    .slice(start + 1, end)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isFooterLine(line));
}

function parseOneHeycaterLabel(date: string, block: string[]) {
  let name = "";
  let address = "";
  let meal = "";
  const details: string[] = [];
  let caterer = "Caterer: Let Me Bowl heykantine";
  let customer = "Customer: Heycater";

  for (const line of block) {
    if (isCatererLine(line)) {
      caterer = line;
      continue;
    }

    if (isCustomerLine(line)) {
      customer = line;
      continue;
    }

    if (!name && !isAddressLine(line) && !isInfoLine(line)) {
      name = line;
      continue;
    }

    if (!address && isAddressLine(line)) {
      address = line;
      continue;
    }

    if (name && address && !meal && !isInfoLine(line) && !isCatererLine(line) && !isCustomerLine(line)) {
      meal = line;
      continue;
    }

    if (meal && isInfoLine(line)) {
      details.push(line);
      continue;
    }
  }

  if (!meal && address) {
    const addressIndex = block.findIndex((line) => cleanLine(line) === cleanLine(address));

    for (let i = addressIndex + 1; i < block.length; i++) {
      const line = block[i];
      if (!line) continue;
      if (isInfoLine(line)) continue;
      if (isCatererLine(line)) continue;
      if (isCustomerLine(line)) continue;
      if (isAddressLine(line)) continue;

      meal = line;
      break;
    }
  }

  return {
    name: name || "Name nicht erkannt",
    date,
    meal: meal || "Gericht nicht erkannt",
    details: details.join(" / "),
    caterer,
    customer,
    address: address || "Adresse nicht erkannt",
  };
}

export function parseHeycaterLabelsFromText(rawText: string): HeycaterLabelData[] {
  const lines = String(rawText || "")
    .split(/\\r?\\n/)
    .map(cleanLine)
    .filter(Boolean);

  const dateIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => isDate(entry.line))
    .map((entry) => entry.index);

  const labels: HeycaterLabelData[] = [];

  for (let i = 0; i < dateIndexes.length; i++) {
    const start = dateIndexes[i];
    const end = i + 1 < dateIndexes.length ? dateIndexes[i + 1] : lines.length;
    const date = extractDate(lines[start]);
    const block = cleanBlockAfterDate(lines, start, end);

    labels.push(parseOneHeycaterLabel(date, block));
  }

  return labels;
}
`;

fs.writeFileSync(path, before + cleanParser, "utf8");
console.log("Heycater Parser bereinigt: doppelte Funktionen entfernt.");
