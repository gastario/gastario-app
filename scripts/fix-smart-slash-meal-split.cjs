const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-smart-slash-meal-split", content, "utf8");

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

  // Heycater kann so liefern:
  // Korean BBQ Veggie Wrap / Vegetarian / Cereals containing gluten
  // oder auch:
  // Vegetarian / Korean BBQ Veggie Wrap / Cereals containing gluten
  //
  // Deshalb ist das Gericht NICHT immer der erste Teil.
  // Gericht = erster Teil, der keine Info/Allergen-Zeile ist.
  const mealPart = parts.find((part) => !isInfoLine(part)) || parts[0];

  const infoParts = parts.filter((part) => part !== mealPart);

  return {
    meal: mealPart,
    info: infoParts.join(" / "),
  };
}

`;

content = before + replacement + after;

fs.writeFileSync(path, content, "utf8");
console.log("Slash-Split repariert: Gericht wird aus erstem Nicht-Info-Teil gelesen.");
