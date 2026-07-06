const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

// looksLikeMeal komplett strenger ersetzen
const start = content.indexOf("function looksLikeMeal(value: string)");
if (start === -1) {
  throw new Error("looksLikeMeal nicht gefunden.");
}

const next = content.indexOf("function looksLikeDetails", start);
if (next === -1) {
  throw new Error("looksLikeDetails nach looksLikeMeal nicht gefunden.");
}

const before = content.slice(0, start);
const after = content.slice(next);

const newLooksLikeMeal = `function looksLikeMeal(value: string) {
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
    "sesame",
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

`;

content = before + newLooksLikeMeal + after;

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Gericht-Erkennung: Allergen-Zeilen zaehlen nicht mehr als Labels.");
