const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-final-meal-detail-swap", content, "utf8");

const oldReturn = `  return {
    name,
    date,
    meal,
    details: details.join(" / "),
    caterer,
    customer,
    address,
  };`;

const newReturn = `  let finalMeal = meal;
  let finalDetails = details.join(" / ");

  // Sicherheitskorrektur:
  // Wenn versehentlich "Vegetarian", "Vegan", "Halal" usw. als Gericht genommen wurde,
  // aber in den Details ein echter Gerichtname steckt, dann tauschen.
  if (isInfoLine(finalMeal) && finalDetails) {
    const detailParts = finalDetails
      .split("/")
      .map((part) => cleanLine(part))
      .filter(Boolean);

    const realMealFromDetails = detailParts.find((part) => !isInfoLine(part));

    if (realMealFromDetails) {
      finalMeal = realMealFromDetails;
      finalDetails = detailParts
        .filter((part) => part !== realMealFromDetails)
        .join(" / ");
    }
  }

  return {
    name,
    date,
    meal: finalMeal,
    details: finalDetails,
    caterer,
    customer,
    address,
  };`;

if (!content.includes(oldReturn)) {
  throw new Error("Return-Block nicht gefunden. Bitte Select-String Ausgabe schicken.");
}

content = content.replace(oldReturn, newReturn);

fs.writeFileSync(path, content, "utf8");
console.log("Finale Sicherheitskorrektur: Gericht wird aus Details zurueckgeholt, wenn Meal nur Info ist.");
