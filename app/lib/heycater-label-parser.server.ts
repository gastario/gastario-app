export type HeycaterLabelData = {
  name: string;
  date: string;
  meal: string;
  details: string;
  caterer: string;
  customer: string;
  address: string;
};

function cleanLine(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .trim();
}

function normalize(value: string) {
  return cleanLine(value).toLowerCase();
}

function isDate(value: string) {
  return /\b\d{2}[.-]\d{2}[.-]\d{4}\b/.test(value);
}

function extractDate(value: string) {
  const match = value.match(/\b\d{2}[.-]\d{2}[.-]\d{4}\b/);
  return match ? match[0].replace(/\./g, "-") : "";
}

function isMetaLine(value: string) {
  const text = normalize(value);

  return (
    !text ||
    text === "-" ||
    text.includes("caterer:") ||
    text.includes("customer:") ||
    text.includes("alexander") ||
    text.includes("berlin") ||
    text.includes("10178") ||
    text.includes("page") ||
    /^[-–—_]+$/.test(text)
  );
}

function looksLikePersonName(value: string) {
  const text = cleanLine(value);
  const lower = text.toLowerCase();

  if (text.length < 3 || text.length > 46) return false;
  if (isDate(text)) return false;
  if (isMetaLine(text)) return false;
  if (/\d/.test(text)) return false;

  const blockedWords = [
    "gluten",
    "free",
    "halal",
    "vegan",
    "vegetarian",
    "fish",
    "milk",
    "sesame",
    "sulphur",
    "sulfur",
    "peanut",
    "nuts",
    "soy",
    "soya",
    "bowl",
    "wrap",
    "salad",
    "salmon",
    "chicken",
    "shawarma",
    "tempura",
    "rice",
    "asian",
    "greens",
    "caterer",
    "customer",
    "ninja",
    "let me bowl",
    "heykantine",
  ];

  if (blockedWords.some((word) => lower.includes(word))) return false;

  return /^[A-Za-zÄÖÜäöüßÀ-ÿ'’ .-]+$/.test(text);
}

function looksLikeMeal(value: string) {
  const text = normalize(value);

  if (!text || isDate(value) || isMetaLine(value)) return false;

  const mealWords = [
    "bowl",
    "wrap",
    "salad",
    "salmon",
    "chicken",
    "tofu",
    "falafel",
    "tempura",
    "greens",
    "rice",
    "shawarma",
    "veggie",
    "vegan",
    "oriental",
  ];

  return mealWords.some((word) => text.includes(word));
}

function looksLikeDetails(value: string) {
  const text = normalize(value);

  if (!text || isDate(value) || isMetaLine(value)) return false;

  const detailWords = [
    "gluten",
    "free",
    "halal",
    "vegan",
    "vegetarian",
    "fish",
    "milk",
    "sesame",
    "sulphur",
    "sulfur",
    "poultry",
    "peanut",
    "nuts",
    "soy",
    "soya",
    "mustard",
    "celery",
    "crustaceans",
  ];

  return detailWords.some((word) => text.includes(word));
}

function findNearby(lines: string[], start: number, matcher: (value: string) => boolean, max = 12) {
  for (let i = start; i < Math.min(lines.length, start + max); i++) {
    if (matcher(lines[i])) return lines[i];
  }

  return "";
}

export function parseHeycaterLabelsFromText(rawText: string): HeycaterLabelData[] {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const labels: HeycaterLabelData[] = [];

  for (let i = 0; i < lines.length; i++) {
    const name = lines[i];

    if (!looksLikePersonName(name)) continue;

    const dateLine = findNearby(lines, i, isDate, 10);
    const meal = findNearby(lines, i + 1, looksLikeMeal, 8);
    const details = findNearby(lines, i + 1, looksLikeDetails, 10);

    const caterer =
      findNearby(lines, i, (line) => normalize(line).includes("caterer:"), 14) ||
      "Caterer: Let Me Bowl heykantine";

    const customer =
      findNearby(lines, i, (line) => normalize(line).includes("customer:"), 14) ||
      "Customer: NinjaOne GmbH";

    const address =
      findNearby(
        lines,
        i,
        (line) => normalize(line).includes("alexander") || /\b\d{5}\b/.test(line),
        16
      ) || "Alexanderstrasse 5, Berlin, 10178";

    if (!meal) continue;

    labels.push({
      name,
      date: extractDate(dateLine),
      meal,
      details,
      caterer,
      customer,
      address,
    });
  }

  const unique = new Map<string, HeycaterLabelData>();

  for (const label of labels) {
    const key = [label.name, label.date, label.meal].join("|").toLowerCase();

    if (!unique.has(key)) {
      unique.set(key, label);
    }
  }

  return Array.from(unique.values());
}
