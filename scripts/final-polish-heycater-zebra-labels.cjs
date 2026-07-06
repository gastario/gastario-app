const fs = require("fs");

const path = "app/lib/heycater-zebra-pdf.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-final-visual-polish", content, "utf8");

// Name noch klarer, aber nicht zu fett/gross
content = content.replace(/size:\s*9\.4,/g, "size: 10.2,");

// Datum oben rechts etwas lesbarer
content = content.replace(/size:\s*7\.4,/g, "size: 7.8,");

// Gericht minimal groesser
content = content.replace(/size:\s*9\.2,/g, "size: 9.8,");

// Abstand nach Gericht minimal ruhiger
content = content.replace(/y -= 11\.2;/g, "y -= 11.8;");

// Details/Zutaten lesbarer, aber noch passend
content = content.replace(
  /wrapText\(label\.details,\s*48\)\.slice\(0,\s*3\)/g,
  "wrapText(label.details, 46).slice(0, 3)"
);
content = content.replace(/size:\s*6\.8,/g, "size: 7.1,");
content = content.replace(/y -= 8\.4;/g, "y -= 8.7;");

// Caterer / Customer besser lesbar
content = content.replace(/size:\s*7\.6,/g, "size: 7.9,");
content = content.replace(/y -= 9\.4;/g, "y -= 9.7;");

// Adresse unten besser lesbar
content = content.replace(
  /y:\s*17,\s*\n\s*size:\s*7,/g,
  "y: 17,\n      size: 7.3,"
);

// QR nicht weiter vergroessern, damit Adresse nicht gequetscht wird
content = content.replace(/const qrSize = 21;/g, "const qrSize = 21;");

// Falls die obere gestrichelte Linie zu nah wirkt, minimal nach oben/sauber halten
content = content.replace(
  /drawDashedLine\(page, left, right, height - 9\);/g,
  "drawDashedLine(page, left, right, height - 8);"
);

// Untere Linie bleibt unten, wirkt voller
content = content.replace(
  /drawDashedLine\(page, left, width - qrSize - 13, 5\);/g,
  "drawDashedLine(page, left, width - qrSize - 13, 5);"
);

fs.writeFileSync(path, content, "utf8");
console.log("Finaler visueller Feinschliff fuer Heycater Zebra Labels erledigt.");
