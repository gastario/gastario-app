const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

// Nicht mehr abbrechen, wenn meal nicht sauber erkannt wurde
content = content.replace(
  "    if (mealIndex === -1) continue;",
  `    // Wichtig: Kein Label darf verloren gehen.
    // Wenn ein Gericht nicht sauber erkannt wird, erstellen wir trotzdem ein Label.
    // Danach sieht man im Ausdruck sofort, dass Daten fehlen, aber niemand wird ausgelassen.`
);

content = content.replace(
  "    const meal = block[mealIndex];",
  `    const meal =
      mealIndex >= 0
        ? block[mealIndex]
        : block.find((line, index) => index > 0 && !isDate(line) && !isMetaLine(line)) || "Gericht nicht erkannt";`
);

// Detailsstart sicher machen, falls mealIndex -1 war
content = content.replaceAll(
  "mealIndex + 1",
  "Math.max(mealIndex, 0) + 1"
);

content = content.replaceAll(
  "catererIndex > mealIndex",
  "catererIndex > Math.max(mealIndex, 0)"
);

content = content.replaceAll(
  "customerIndex > mealIndex",
  "customerIndex > Math.max(mealIndex, 0)"
);

// Deduplizierung entfernen, falls noch vorhanden
content = content.replace(
`  const unique = new Map<string, HeycaterLabelData>();

  for (const label of labels) {
    const key = [label.name, label.date, label.meal].join("|").toLowerCase();

    if (!unique.has(key)) {
      unique.set(key, label);
    }
  }

  return Array.from(unique.values());`,
`  // Wichtig: Foodlabels duerfen NICHT dedupliziert werden.
  // Wenn Heycater 115 Etiketten liefert, muessen auch 115 Etiketten erzeugt werden.
  return labels;`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Parser: keine Labels mehr wegen fehlendem Gericht/Duplikat entfernen.");
