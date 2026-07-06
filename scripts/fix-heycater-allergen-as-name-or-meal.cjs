const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-allergen-name-meal-guard", content, "utf8");

// Hilfsfunktion einfuegen: Allergene/Hinweise erkennen
if (!content.includes("function isAllergenOrInfoLine")) {
  content = content.replace(
    "function isHardMetaLine(value: string) {",
`function isAllergenOrInfoLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  if (!text) return false;

  const allergyWords = [
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
    "cereals containing gluten",
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

  return allergyWords.some((word) => lower.includes(word));
}

function isHardMetaLine(value: string) {`
  );
}

// Name darf niemals Allergene/Info sein
content = content.replace(
  `if (isAddressLine(text)) return false;`,
  `if (isAddressLine(text)) return false;
  if (isAllergenOrInfoLine(text)) return false;`
);

// Doppelte alte Einzelchecks sind ok, aber wir sichern nochmal:
content = content.replace(
  `if (lower.includes("gluten")) return false;`,
  `if (isAllergenOrInfoLine(text)) return false;
  if (lower.includes("gluten")) return false;`
);

// pickMealFromBlock robuster ersetzen
const mealStart = content.indexOf("function pickMealFromBlock");
if (mealStart === -1) {
  throw new Error("pickMealFromBlock nicht gefunden.");
}

const detailsStart = content.indexOf("function pickDetailsFromBlock", mealStart);
if (detailsStart === -1) {
  throw new Error("pickDetailsFromBlock nach pickMealFromBlock nicht gefunden.");
}

const beforeMeal = content.slice(0, mealStart);
const afterMeal = content.slice(detailsStart);

const newPickMeal = `function pickMealFromBlock(block: string[], name: string, address: string) {
  const addressIndex = block.findIndex((line) => cleanLine(line) === cleanLine(address));
  const nameIndex = block.findIndex((line) => cleanLine(line) === cleanLine(name));

  const isValidMealCandidate = (value: string) => {
    const line = cleanLine(value);
    if (!line) return false;
    if (isHardMetaLine(line)) return false;
    if (isAddressLine(line)) return false;
    if (isAllergenOrInfoLine(line)) return false;
    if (isProbablyPersonName(line)) return false;

    return true;
  };

  // Normalfall Heycater:
  // Datum -> Name -> Adresse -> Gericht -> Allergene -> Caterer -> Customer
  if (addressIndex >= 0) {
    for (let i = addressIndex + 1; i < block.length; i++) {
      if (isValidMealCandidate(block[i])) return cleanLine(block[i]);
    }
  }

  // Fallback: nach Name suchen
  if (nameIndex >= 0) {
    for (let i = nameIndex + 1; i < block.length; i++) {
      if (isValidMealCandidate(block[i])) return cleanLine(block[i]);
    }
  }

  // Letzter Fallback: irgendeine echte Gerichtszeile im Block
  for (const line of block) {
    if (isValidMealCandidate(line)) return cleanLine(line);
  }

  return "Gericht nicht erkannt";
}

`;

content = beforeMeal + newPickMeal + afterMeal;

// pickDetailsFromBlock so sichern, dass Allergene wirklich Details bleiben
content = content.replace(
  `if (isProbablyPersonName(line)) break;

    detailLines.push(line);`,
  `if (isProbablyPersonName(line)) break;

    // Nur Hinweis-/Allergenzeilen als Details uebernehmen.
    // So landet kein Gericht versehentlich in den Allergenen und umgekehrt.
    if (isAllergenOrInfoLine(line)) {
      detailLines.push(line);
    }`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Parser: Allergene duerfen nicht mehr Name oder Gericht werden.");
