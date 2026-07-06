const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

const oldFunctionStart = content.indexOf("export function parseHeycaterLabelsFromText");
if (oldFunctionStart === -1) {
  throw new Error("parseHeycaterLabelsFromText nicht gefunden.");
}

const before = content.slice(0, oldFunctionStart);

const newFunction = `export function parseHeycaterLabelsFromText(rawText: string): HeycaterLabelData[] {
  const lines = String(rawText || "")
    .split(/\\r?\\n/)
    .map(cleanLine)
    .filter(Boolean);

  const labels: HeycaterLabelData[] = [];

  for (let i = 0; i < lines.length; i++) {
    const name = lines[i];

    if (!looksLikePersonName(name)) continue;

    const nextNameIndex = lines.findIndex((line, index) => index > i && looksLikePersonName(line));
    const blockEnd = nextNameIndex > i ? nextNameIndex : Math.min(lines.length, i + 18);
    const block = lines.slice(i, blockEnd);

    const dateLine = block.find(isDate) || "";
    const mealIndex = block.findIndex((line, index) => index > 0 && looksLikeMeal(line));

    if (mealIndex === -1) continue;

    const meal = block[mealIndex];

    const catererIndex = block.findIndex((line) => normalize(line).includes("caterer:"));
    const customerIndex = block.findIndex((line) => normalize(line).includes("customer:"));

    const detailsEnd =
      catererIndex > mealIndex
        ? catererIndex
        : customerIndex > mealIndex
          ? customerIndex
          : Math.min(block.length, mealIndex + 5);

    const detailsLines = block
      .slice(mealIndex + 1, detailsEnd)
      .map(cleanLine)
      .filter((line) => {
        const text = normalize(line);

        return (
          line &&
          !isDate(line) &&
          !isMetaLine(line) &&
          !looksLikePersonName(line) &&
          !looksLikeMeal(line) &&
          !text.includes("caterer:") &&
          !text.includes("customer:")
        );
      });

    const details = detailsLines.join(" / ");

    const caterer =
      block.find((line) => normalize(line).includes("caterer:")) ||
      "Caterer: Let Me Bowl heykantine";

    const customer =
      block.find((line) => normalize(line).includes("customer:")) ||
      "Customer: NinjaOne GmbH";

    const address =
      block.find((line) => normalize(line).includes("alexander") || /\\b\\d{5}\\b/.test(line)) ||
      "Alexanderstrasse 5, Berlin, 10178";

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
`;

fs.writeFileSync(path, before + newFunction, "utf8");
console.log("Heycater Parser uebernimmt jetzt alle Detail-/Allergen-Zeilen.");
