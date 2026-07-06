const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-simple-reliable-parser", content, "utf8");

const helperStart = content.indexOf("function isAddressLine");
const parserStart = content.indexOf("export function parseHeycaterLabelsFromText");

if (helperStart === -1) throw new Error("function isAddressLine nicht gefunden.");
if (parserStart === -1) throw new Error("parseHeycaterLabelsFromText nicht gefunden.");

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

  return [
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
  ].some((word) => lower.includes(word));
}

function isUsableLabelContentLine(value: string) {
  const line = cleanLine(value);

  if (!line) return false;
  if (isDate(line)) return false;
  if (isFooterLine(line)) return false;
  if (isCatererLine(line)) return false;
  if (isCustomerLine(line)) return false;
  if (isAddressLine(line)) return false;
  if (isInfoLine(line)) return false;

  return true;
}

function cleanBlockAfterDate(lines: string[], start: number, end: number) {
  return lines
    .slice(start + 1, end)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isFooterLine(line));
}

function parseOneHeycaterLabel(date: string, block: string[]) {
  const contentLines = block.filter(isUsableLabelContentLine);

  const name = contentLines[0] || "Name nicht erkannt";
  const meal = contentLines[1] || "Gericht nicht erkannt";

  const details = block
    .filter((line) => isInfoLine(line))
    .join(" / ");

  const address =
    block.find((line) => isAddressLine(line)) ||
    "Adresse nicht erkannt";

  const caterer =
    block.find((line) => isCatererLine(line)) ||
    "Caterer: Let Me Bowl heykantine";

  const customer =
    block.find((line) => isCustomerLine(line)) ||
    "Customer: Heycater";

  return {
    name,
    date,
    meal,
    details,
    caterer,
    customer,
    address,
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
console.log("Heycater Parser vereinfacht: nach Datum ist Zeile 1 Name, Zeile 2 Gericht.");
