const fs = require("fs");

const path = "app/lib/heycater-zebra-pdf.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-fill-and-spacing", content, "utf8");

// 1) Name etwas groesser und minimal hoeher
content = content.replace(/y:\s*height - 23,/g, "y: height - 22,");
content = content.replace(/size:\s*8\.6,/g, "size: 9.4,");

// 2) Datum etwas klarer
content = content.replace(/size:\s*7,/g, "size: 7.4,");

// 3) Mehr Abstand zwischen Name und Gericht
content = content.replace(/let y = height - 39;/g, "let y = height - 42;");

// 4) Gericht groesser und lesbarer
content = content.replace(/size:\s*8\.2,/g, "size: 9.2,");
content = content.replace(/y -= 9\.6;/g, "y -= 11.2;");

// 5) Zutaten / Details groesser und mit besserem Umbruch
content = content.replace(
  /wrapText\(label\.details,\s*52\)\.slice\(0,\s*3\)/g,
  "wrapText(label.details, 48).slice(0, 3)"
);
content = content.replace(/size:\s*6\.1,/g, "size: 6.8,");
content = content.replace(/y -= 7\.2;/g, "y -= 8.4;");

// 6) Zwischen Details und Caterer etwas mehr Luft
content = content.replace(/y -= 3;/g, "y -= 4.5;");

// 7) Caterer / Customer etwas groesser
content = content.replace(/size:\s*7\.1,/g, "size: 7.6,");
content = content.replace(/y -= 8\.4;/g, "y -= 9.4;");

// 8) Adresse groesser und etwas hoeher
content = content.replace(
  /y:\s*15,\s*\n\s*size:\s*6\.5,/g,
  "y: 17,\n      size: 7,"
);

// 9) QR minimal groesser
content = content.replace(/const qrSize = 20;/g, "const qrSize = 21;");
content = content.replace(
  /y:\s*10,\s*\n\s*width:\s*qrSize,/g,
  "y: 11,\n      width: qrSize,"
);

// 10) Untere Linie minimal tiefer, damit es voller wirkt
content = content.replace(
  /drawDashedLine\(page, left, width - qrSize - 13, 6\);/g,
  "drawDashedLine(page, left, width - qrSize - 13, 5);"
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Zebra Labels: mehr Fuellung, mehr Abstand, bessere Lesbarkeit.");
