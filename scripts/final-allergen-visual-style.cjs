const fs = require("fs");

const path = "app/lib/heycater-zebra-pdf.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-allergen-style-final", content, "utf8");

// Allergene etwas kuerzer umbrechen, damit es wie ein eigener Hinweisblock aussieht
content = content.replace(
  /for \(const line of wrapText\(label\.details,\s*\d+\)\.slice\(0,\s*\d+\)\) \{/g,
  "for (const line of wrapText(label.details, 38).slice(0, 3)) {"
);

// Details/Allergene: kursiv, etwas kleiner, mit Einzug
content = content.replace(
  /for \(const line of wrapText\(label\.details,\s*38\)\.slice\(0,\s*3\)\) \{\s*page\.drawText\(line,\s*\{\s*x:\s*left,\s*y,\s*size:\s*[\d.]+,\s*font:\s*italic,\s*color:\s*black,/g,
  `for (const line of wrapText(label.details, 38).slice(0, 3)) {
      page.drawText(line, {
        x: left + 3,
        y,
        size: 7.1,
        font: italic,
        color: black,`
);

// Falls Formatierung anders ist: gezielt x/size/font im Detailsblock sichern
content = content.replace(
  /for \(const line of wrapText\(label\.details,\s*38\)\.slice\(0,\s*3\)\) \{([\s\S]*?)x:\s*left,([\s\S]*?)size:\s*[\d.]+,([\s\S]*?)font:\s*(bold|regular|italic),/m,
  `for (const line of wrapText(label.details, 38).slice(0, 3)) {$1x: left + 3,$2size: 7.1,$3font: italic,`
);

// Vor den Allergenen eine kleine Trennlinie setzen, damit man es optisch unterscheidet
content = content.replace(
  /y -= 11\.8;\s*\n\s*\/\/ Details\/Zutaten|y -= 11\.8;\s*\n\s*for \(const line of wrapText\(label\.details/g,
  `y -= 11.8;

    page.drawLine({
      start: { x: left, y: y + 4 },
      end: { x: right - 54, y: y + 4 },
      thickness: 0.4,
      color: rgb(0.65, 0.65, 0.65),
    });

    for (const line of wrapText(label.details`
);

// Falls der vorherige Replace nicht greift, sichere Variante: Linie direkt vor Detailsblock einfuegen
if (!content.includes("thickness: 0.4")) {
  content = content.replace(
    /for \(const line of wrapText\(label\.details,\s*38\)\.slice\(0,\s*3\)\) \{/,
    `page.drawLine({
      start: { x: left, y: y + 4 },
      end: { x: right - 54, y: y + 4 },
      thickness: 0.4,
      color: rgb(0.65, 0.65, 0.65),
    });

    for (const line of wrapText(label.details, 38).slice(0, 3)) {`
  );
}

// Allergene brauchen etwas mehr Luft pro Zeile
content = content.replace(/y -= 9\.0;/g, "y -= 8.4;");
content = content.replace(/y -= 9\.2;/g, "y -= 8.4;");

// Caterer danach minimal mit Abstand
content = content.replace(/y -= 2\.5;/g, "y -= 4;");

fs.writeFileSync(path, content, "utf8");
console.log("Allergene final optisch getrennt: kursiv, eingerueckt, mit Trennlinie.");
