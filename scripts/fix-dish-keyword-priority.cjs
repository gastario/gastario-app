const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-dish-keyword-priority", content, "utf8");

if (!content.includes("function isDishLine")) {
  content = content.replace(
    "function splitMealAndInfo(value: string) {",
`function isDishLine(value: string) {
  const lower = normalize(value);

  const dishWords = [
    "bowl",
    "wrap",
    "salad",
    "risotto",
    "curry",
    "chicken",
    "salmon",
    "tofu",
    "bbq",
    "veggie",
    "tempura",
    "falafel",
    "pasta",
    "mushroom",
    "rice",
    "noodle",
    "shawarma",
    "grill",
    "tuna",
    "beetroot",
    "oriental",
    "korean",
    "panaeng",
    "teriyaki"
  ];

  return dishWords.some((word) => lower.includes(word));
}

function splitMealAndInfo(value: string) {`
  );
}

const start = content.indexOf("function splitMealAndInfo");
const end = content.indexOf("function parseOneHeycaterLabel", start);

if (start === -1) throw new Error("splitMealAndInfo nicht gefunden.");
if (end === -1) throw new Error("parseOneHeycaterLabel nach splitMealAndInfo nicht gefunden.");

const before = content.slice(0, start);
const after = content.slice(end);

const replacement = `function splitMealAndInfo(value: string) {
  const line = cleanLine(value);
  const parts = line
    .split("/")
    .map((part) => cleanLine(part))
    .filter(Boolean);

  if (parts.length <= 1) {
    return { meal: line, info: "" };
  }

  // Gericht gewinnt immer, wenn ein typisches Gerichtswort vorkommt.
  // Beispiel: Vegetarian / Korean BBQ Veggie Wrap / Cereals containing gluten
  // => Gericht: Korean BBQ Veggie Wrap
  const mealPart =
    parts.find((part) => isDishLine(part)) ||
    parts.find((part) => !isInfoLine(part)) ||
    parts[0];

  const infoParts = parts.filter((part) => part !== mealPart);

  return {
    meal: mealPart,
    info: infoParts.join(" / "),
  };
}

`;

content = before + replacement + after;

// Finale Korrektur ebenfalls auf Gerichtsworte umstellen
content = content.replace(
  `const realMealFromDetails = detailParts.find((part) => !isInfoLine(part));`,
  `const realMealFromDetails =
      detailParts.find((part) => isDishLine(part)) ||
      detailParts.find((part) => !isInfoLine(part));`
);

// Falls meal selbst Info ist, aber details Gericht enthalten: tauschen.
// Falls meal nicht Info ist, aber details ein viel klareres Gericht enthalten und meal nur Vegetarian/Vegan/Halal ist, auch sichern.
content = content.replace(
  `if (isInfoLine(finalMeal) && finalDetails) {`,
  `if ((isInfoLine(finalMeal) || !isDishLine(finalMeal)) && finalDetails) {`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Parser: Gerichtsworte haben jetzt Prioritaet vor Vegetarian/Vegan/Allergenen.");
