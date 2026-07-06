const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-combined-meal-info-fix", content, "utf8");

const start = content.indexOf("function parseOneHeycaterLabel");
const end = content.indexOf("export function parseHeycaterLabelsFromText", start);

if (start === -1) throw new Error("parseOneHeycaterLabel nicht gefunden.");
if (end === -1) throw new Error("parseHeycaterLabelsFromText nicht gefunden.");

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

  return {
    meal: parts[0],
    info: parts.slice(1).join(" / "),
  };
}

function parseOneHeycaterLabel(date: string, block: string[]) {
  const address =
    block.find((line) => isAddressLine(line)) ||
    "Adresse nicht erkannt";

  const caterer =
    block.find((line) => isCatererLine(line)) ||
    "Caterer: Let Me Bowl heykantine";

  const customer =
    block.find((line) => isCustomerLine(line)) ||
    "Customer: Heycater";

  const cleanContent = block
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isDate(line))
    .filter((line) => !isFooterLine(line))
    .filter((line) => !isCatererLine(line))
    .filter((line) => !isCustomerLine(line))
    .filter((line) => !isAddressLine(line));

  const name = cleanContent[0] || "Name nicht erkannt";

  let meal = "Gericht nicht erkannt";
  const details: string[] = [];

  for (let i = 1; i < cleanContent.length; i++) {
    const line = cleanContent[i];
    if (!line) continue;

    // Wichtig: Heycater schreibt manchmal Gericht + Allergene in eine Zeile:
    // Korean BBQ Veggie Wrap / Vegetarian / Cereals containing gluten, Soybeans
    if (line.includes("/")) {
      const split = splitMealAndInfo(line);

      if (meal === "Gericht nicht erkannt" && split.meal) {
        meal = split.meal;
      }

      if (split.info) {
        details.push(split.info);
      }

      continue;
    }

    if (isInfoLine(line)) {
      details.push(line);
      continue;
    }

    if (meal === "Gericht nicht erkannt") {
      meal = line;
      continue;
    }
  }

  return {
    name,
    date,
    meal,
    details: details.join(" / "),
    caterer,
    customer,
    address,
  };
}

`;

content = before + replacement + after;

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Parser fix: kombinierte Gericht/Allergen-Zeilen werden getrennt.");
