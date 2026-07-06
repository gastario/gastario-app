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

function isPossibleNameLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  if (!text || text.length < 2 || text.length > 60) return false;
  if (isDate(text)) return false;
  if (isMetaLine(text)) return false;
  if (looksLikeMeal(text)) return false;
  if (looksLikeDetails(text)) return false;
  if (lower.includes("powered by")) return false;
  if (lower.includes("pdf generator")) return false;
  if (lower.includes("caterer:")) return false;
  if (lower.includes("customer:")) return false;
  if (/^[-–—_]+$/.test(text)) return false;

  return true;
}

function findNameBeforeMeal(lines: string[], mealIndex: number) {
  const candidates: string[] = [];

  for (let i = mealIndex - 1; i >= Math.max(0, mealIndex - 5); i--) {
    const line = cleanLine(lines[i]);

    if (!line) continue;
    if (isPossibleNameLine(line)) {
      candidates.unshift(line);
    }
  }

  if (candidates.length === 0) return "Name nicht erkannt";

  // Wenn PDF Vorname und Nachname getrennt hat, wieder zusammenbauen.
  const joined = candidates.join(" ").replace(/\s+/g, " ").trim();

  // Maximal die letzten 2 sinnvollen Namenszeilen nehmen.
  if (candidates.length >= 2) {
    return candidates.slice(-2).join(" ").replace(/\s+/g, " ").trim();
  }

  return joined;
}

export function parseHeycaterLabelsFromText(rawText: string): HeycaterLabelData[] {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const labels: HeycaterLabelData[] = [];

  for (let i = 0; i < lines.length; i++) {
    const meal = lines[i];

    // Neue sichere Logik:
    // Jedes erkannte Gericht erzeugt genau ein Foodlabel.
    // Dadurch verlieren wir keine Labels, wenn Namen im PDF komisch getrennt sind.
    if (!looksLikeMeal(meal)) continue;

    const name = findNameBeforeMeal(lines, i);

    const block = lines.slice(i - 5 >= 0 ? i - 5 : 0, Math.min(lines.length, i + 14));

    const dateLine =
      block.find(isDate) ||
      lines.slice(i, Math.min(lines.length, i + 8)).find(isDate) ||
      "";

    const detailLines: string[] = [];

    for (let d = i + 1; d < Math.min(lines.length, i + 8); d++) {
      const line = cleanLine(lines[d]);
      const lower = normalize(line);

      if (!line) continue;
      if (isDate(line)) continue;
      if (lower.includes("caterer:")) break;
      if (lower.includes("customer:")) break;
      if (lower.includes("alexander")) break;
      if (/\b\d{5}\b/.test(line)) break;
      if (looksLikeMeal(line)) break;

      if (!isMetaLine(line) && !isPossibleNameLine(line)) {
        detailLines.push(line);
      } else if (looksLikeDetails(line)) {
        detailLines.push(line);
      }
    }

    const caterer =
      lines.slice(i, Math.min(lines.length, i + 14)).find((line) => normalize(line).includes("caterer:")) ||
      "Caterer: Let Me Bowl heykantine";

    const customer =
      lines.slice(i, Math.min(lines.length, i + 14)).find((line) => normalize(line).includes("customer:")) ||
      "Customer: NinjaOne GmbH";

    const address =
      lines
        .slice(i, Math.min(lines.length, i + 16))
        .find((line) => normalize(line).includes("alexander") || /\b\d{5}\b/.test(line)) ||
      "Alexanderstrasse 5, Berlin, 10178";

    labels.push({
      name,
      date: extractDate(dateLine),
      meal,
      details: detailLines.join(" / "),
      caterer,
      customer,
      address,
    });
  }

  // Keine Deduplizierung. Ein Gericht im PDF = ein Etikett.
  return labels;
}
