const fs = require("fs");

const path = "app/lib/heycater-zebra-pdf.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-info-allergen-block", content, "utf8");

// Alte Trennlinie vor Allergenen entfernen, weil sie durch den Text laeuft
content = content.replace(
/\s*page\.drawLine\(\{\s*start:\s*\{\s*x:\s*left,\s*y:\s*y \+ 4\s*\},\s*end:\s*\{\s*x:\s*right - 54,\s*y:\s*y \+ 4\s*\},\s*thickness:\s*0\.4,\s*color:\s*rgb\(0\.65,\s*0\.65,\s*0\.65\),\s*\}\);\s*/g,
"\n"
);

// Vor Allergene eine kleine Info-Zeile setzen
content = content.replace(
  /for \(const line of wrapText\(label\.details,\s*38\)\.slice\(0,\s*3\)\) \{/,
  `page.drawText("Info", {
      x: left,
      y: y + 1,
      size: 5.8,
      font: bold,
      color: black,
    });

    y -= 6.2;

    for (const line of wrapText(label.details, 40).slice(0, 3)) {`
);

// Allergene: sauber kursiv, nicht riesig, leicht eingerueckt
content = content.replace(
  /x:\s*left \+ 3,\s*\n\s*y,\s*\n\s*size:\s*7\.1,\s*\n\s*font:\s*italic,\s*\n\s*color:\s*black,/,
  `x: left + 2,
        y,
        size: 7.4,
        font: italic,
        color: black,`
);

// Falls noch alte Groessen vorhanden sind
content = content.replace(/size:\s*7\.6,\s*\n\s*font:\s*italic,/g, "size: 7.4,\n        font: italic,");
content = content.replace(/size:\s*7\.8,\s*\n\s*font:\s*italic,/g, "size: 7.4,\n        font: italic,");

// Zeilenabstand fuer Allergene
content = content.replace(/y -= 8\.4;/g, "y -= 8.1;");
content = content.replace(/y -= 9\.0;/g, "y -= 8.1;");

// Nach Allergenen wieder etwas Abstand zu Caterer
content = content.replace(/y -= 4;/g, "y -= 5;");

fs.writeFileSync(path, content, "utf8");
console.log("Allergen-Block als saubere Info-Zeile ohne stoerende Linie gesetzt.");
