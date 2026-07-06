const fs = require("fs");

const path = "app/lib/heycater-zebra-pdf.server.ts";
let content = fs.readFileSync(path, "utf8");

// Backup
fs.writeFileSync(path + ".backup-before-readable-label-layout", content, "utf8");

// Name etwas besser positionieren
content = content.replace(
  /y:\s*height - 22,/g,
  "y: height - 23,"
);

// Datum minimal lesbarer
content = content.replace(
  /size:\s*6\.4,/g,
  "size: 7,"
);

// Gericht groesser und mehr Abstand unter Name
content = content.replace(
  /let y = height - 36;/g,
  "let y = height - 39;"
);

content = content.replace(
  /size:\s*7\.1,/g,
  "size: 8.2,"
);

content = content.replace(
  /y -= 8\.3;/g,
  "y -= 9.6;"
);

// Zutaten / Hinweise deutlich lesbarer
content = content.replace(
  /wrapText\(label\.details,\s*58\)\.slice\(0,\s*3\)/g,
  "wrapText(label.details, 52).slice(0, 3)"
);

content = content.replace(
  /size:\s*4\.8,/g,
  "size: 6.1,"
);

content = content.replace(
  /y -= 5\.6;/g,
  "y -= 7.2;"
);

// Zwischen Details und Caterer etwas Luft
content = content.replace(
  /y -= 2;\s*\n\s*page\.drawText\(safeText\(label\.caterer/g,
  "y -= 3;\n\n    page.drawText(safeText(label.caterer"
);

// Caterer / Customer groesser
content = content.replace(
  /size:\s*6\.2,/g,
  "size: 7.1,"
);

content = content.replace(
  /y -= 7\.2;/g,
  "y -= 8.4;"
);

// Adresse groesser und etwas hoeher, damit QR und Text ruhiger sitzen
content = content.replace(
  /y:\s*13,\s*\n\s*size:\s*5\.8,/g,
  "y: 15,\n      size: 6.5,"
);

// QR minimal groesser, aber noch sicher im Label
content = content.replace(
  /const qrSize = 18;/g,
  "const qrSize = 20;"
);

// QR wegen groesserer Adresse minimal hoeher/rechts sauber setzen
content = content.replace(
  /y:\s*9,\s*\n\s*width:\s*qrSize,/g,
  "y: 10,\n      width: qrSize,"
);

// Untere Linie minimal tiefer lassen
content = content.replace(
  /drawDashedLine\(page, left, width - qrSize - 13, 7\);/g,
  "drawDashedLine(page, left, width - qrSize - 13, 6);"
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Zebra Layout lesbarer gemacht: Details, Gericht, Meta und Abstaende angepasst.");
