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
  const raw = cleanLine(value);
  const text = normalize(raw);

  if (!text || isDate(raw) || isMetaLine(raw)) return false;

  // Sehr wichtig:
  // Allergen-/Hinweiszeilen wie "Vegan, Vegetarian / Soybeans"
  // duerfen NIE als eigenes Gericht/Label zaehlen.
  if (raw.includes(",") || raw.includes(" / ") || raw.includes("/")) {
    const strongDish =
      text.includes("bowl") ||
      text.includes("wrap") ||
      text.includes("salad") ||
      text.includes("salmon") ||
      text.includes("chicken") ||
      text.includes("tofu") ||
      text.includes("falafel") ||
      text.includes("tempura");

    if (!strongDish) return false;
  }

  const blockedDetailOnly = [
    "gluten free",
    "halal",
    "poultry",
    "milk",
    "sesame seeds",
    "soybeans",
    "soya",
    "sulphur",
    "sulfur",
    "nuts",
    "peanut",
    "vegetarian /",
    "vegan,",
    "pescatarian /",
  ];

  if (blockedDetailOnly.some((word) => text.includes(word))) {
    return false;
  }

  const mealWords = [
    "bowl",
    "wrap",
    "salad",
    "salmon",
    "chicken",
    "tofu",
    "falafel",
    "tempura",
    "shawarma",
    "oriental",
    "beetroot",
    "tuna",
    "greens with sesame",
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
  if (/--\s*\d+\s*of\s*\d+\s*--/i.test(text)) return false;
  if (/^\d+\s*of\s*\d+$/i.test(text)) return false;
  if (/--\s*\d+\s*of\s*\d+\s*--/i.test(text)) return false;
  if (/^\d+\s*of\s*\d+$/i.test(text)) return false;
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

function isAddressLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  if (!text) return false;
  if (/\\b\\d{5}\\b/.test(text)) return true;
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
  if (/--\\s*\\d+\\s*of\\s*\\d+\\s*--/i.test(text)) return true;
  if (/^\\d+\\s*of\\s*\\d+$/i.test(text)) return true;

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
    .split(/\\r?\\n/)
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
