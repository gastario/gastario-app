const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

// Generator-Zeile und PDF-Footer nie als Name akzeptieren
content = content.replace(
  `if (lower.includes("let me bowl")) return false;`,
  `if (lower.includes("let me bowl")) return false;
  if (lower.includes("powered by")) return false;
  if (lower.includes("pdf generator")) return false;`
);

// Wieder sicher machen: ohne erkanntes Gericht KEIN Label erzeugen.
// Sonst entstehen falsche Zusatzetiketten wie "Tomasz | Gericht nicht erkannt".
content = content.replace(
  `    // Wichtig: Kein Label darf verloren gehen.
    // Wenn ein Gericht nicht sauber erkannt wird, erstellen wir trotzdem ein Label.
    // Danach sieht man im Ausdruck sofort, dass Daten fehlen, aber niemand wird ausgelassen.`,
  `    // Wichtig: Kein falsches Zusatzetikett erzeugen.
    // Wenn kein Gericht im Block erkannt wird, ist das meistens nur ein abgetrennter Vor-/Nachname.
    if (mealIndex === -1) continue;`
);

content = content.replace(
  `    const meal =
      mealIndex >= 0
        ? block[mealIndex]
        : block.find((line, index) => index > 0 && !isDate(line) && !isMetaLine(line)) || "Gericht nicht erkannt";`,
  `    const meal = block[mealIndex];`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Parser: falsche Zusatzlabels ohne Gericht entfernt.");
