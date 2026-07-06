const fs = require("fs");

const path = "app/lib/heycater-zebra-pdf.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-allergen-readability", content, "utf8");

// Allergene/Details besser umbrechen: etwas kuerzere Zeilen, dadurch groesser lesbar
content = content.replace(
  /for \(const line of wrapText\(label\.details,\s*\d+\)\.slice\(0,\s*\d+\)\) \{/g,
  "for (const line of wrapText(label.details, 42).slice(0, 3)) {"
);

// Den Details-Block gezielt staerker machen: groesser, schwarz, bold
content = content.replace(
  /(for \(const line of wrapText\(label\.details,\s*42\)\.slice\(0,\s*3\)\) \{\s*page\.drawText\(line,\s*\{\s*x:\s*left,\s*y,\s*size:\s*)[\d.]+(,\s*font:\s*)regular(,\s*color:\s*)muted(,\s*\}\);\s*y\s*-=\s*)[\d.]+(;[\s\S]*?\n\s*\})/,
  "$17.8$2bold$3black$49.2$5"
);

// Falls die vorherige Regex wegen Formatierung nicht gegriffen hat, einfache Sicherung
content = content.replace(/size:\s*7\.1,/g, "size: 7.8,");
content = content.replace(/size:\s*6\.8,/g, "size: 7.8,");
content = content.replace(/font:\s*regular,\s*\n\s*color:\s*muted,/g, "font: bold,\n        color: black,");

// Nach Allergenen etwas weniger Extra-Luft, damit unten nichts rausfliegt
content = content.replace(/y -= 4\.5;/g, "y -= 2.5;");

// Caterer/Customer minimal kleiner lassen, damit Allergene mehr Platz haben
content = content.replace(/size:\s*7\.9,/g, "size: 7.4,");
content = content.replace(/size:\s*7\.6,/g, "size: 7.4,");

fs.writeFileSync(path, content, "utf8");
console.log("Allergene/Details auf Heycater Zebra Labels besser lesbar gemacht.");
