const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-flexible-label-sequence", content, "utf8");

const start = content.indexOf("function parseOneHeycaterLabel");
const end = content.indexOf("export function parseHeycaterLabelsFromText", start);

if (start === -1) {
  throw new Error("parseOneHeycaterLabel nicht gefunden.");
}
if (end === -1) {
  throw new Error("parseHeycaterLabelsFromText nicht nach parseOneHeycaterLabel gefunden.");
}

const before = content.slice(0, start);
const after = content.slice(end);

const replacement = `function parseOneHeycaterLabel(date: string, block: string[]) {
  let name = "";
  let address = "";
  let meal = "";
  const details: string[] = [];
  let caterer = "Caterer: Let Me Bowl heykantine";
  let customer = "Customer: Heycater";

  for (const rawLine of block) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    if (isCatererLine(line)) {
      caterer = line;
      continue;
    }

    if (isCustomerLine(line)) {
      customer = line;
      continue;
    }

    if (isAddressLine(line)) {
      if (!address) address = line;
      continue;
    }

    if (!name && !isInfoLine(line)) {
      name = line;
      continue;
    }

    // Wichtig:
    // Heycater-PDF-Text kommt nicht immer gleich raus.
    // Manchmal steht nach dem Namen direkt das Gericht und die Adresse kommt erst spaeter.
    if (name && !meal && !isInfoLine(line) && !isCatererLine(line) && !isCustomerLine(line)) {
      meal = line;
      continue;
    }

    if (meal && isInfoLine(line)) {
      details.push(line);
      continue;
    }
  }

  return {
    name: name || "Name nicht erkannt",
    date,
    meal: meal || "Gericht nicht erkannt",
    details: details.join(" / "),
    caterer,
    customer,
    address: address || "Adresse nicht erkannt",
  };
}

`;

content = before + replacement + after;

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Parser: Gericht wird jetzt auch erkannt, wenn Adresse spaeter im PDF-Text kommt.");
