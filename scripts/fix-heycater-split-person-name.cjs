const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-split-name-fix", content, "utf8");

if (!content.includes("function looksLikeNamePart")) {
  content = content.replace(
    "function splitMealAndInfo(value: string) {",
`function looksLikeNamePart(value: string) {
  const text = cleanLine(value);
  if (!text) return false;
  if (text.length < 2 || text.length > 40) return false;
  if (isDishLine(text)) return false;
  if (isInfoLine(text)) return false;
  if (isAddressLine(text)) return false;
  if (isCatererLine(text)) return false;
  if (isCustomerLine(text)) return false;
  if (isDate(text)) return false;

  return /^[A-Za-zÀ-ž.'’\\- ]+$/.test(text);
}

function splitMealAndInfo(value: string) {`
  );
}

const oldBlock = `  const name = cleanContent[0] || "Name nicht erkannt";

  let meal = "Gericht nicht erkannt";
  const details: string[] = [];

  for (let i = 1; i < cleanContent.length; i++) {`;

const newBlock = `  let name = cleanContent[0] || "Name nicht erkannt";
  let startIndex = 1;

  // Manche Heycater-PDFs brechen Vorname/Nachname in zwei Zeilen:
  // Martyna
  // Radziszewicz
  // Salmon Tempura Bowl
  // Dann darf Radziszewicz nicht als Gericht genommen werden.
  if (
    cleanContent.length >= 3 &&
    looksLikeNamePart(cleanContent[0]) &&
    looksLikeNamePart(cleanContent[1]) &&
    isDishLine(cleanContent[2])
  ) {
    name = cleanContent[0] + " " + cleanContent[1];
    startIndex = 2;
  }

  let meal = "Gericht nicht erkannt";
  const details: string[] = [];

  for (let i = startIndex; i < cleanContent.length; i++) {`;

if (!content.includes(oldBlock)) {
  throw new Error("Name/Meal Block nicht gefunden. Bitte Select-String Ausgabe schicken.");
}

content = content.replace(oldBlock, newBlock);

fs.writeFileSync(path, content, "utf8");
console.log("Split-Name-Fix gesetzt: zweizeilige Namen werden zusammengefuehrt.");
