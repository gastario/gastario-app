const fs = require("fs");

const routePath = "app/routes/foodlabels.heycater-pdf.tsx";
let content = fs.readFileSync(routePath, "utf8");

// Standardwerte fuer Heycater A4-Raster korrigieren:
// A4 hat Rand; Schnittlinien liegen nicht direkt am Seitenrand.
content = content.replace(
  'const pageTopMm = readNumber(formData.get("pageTopMm"), 0);',
  'const pageTopMm = readNumber(formData.get("pageTopMm"), 9);'
);

content = content.replace(
  'const pageRightMm = readNumber(formData.get("pageRightMm"), 0);',
  'const pageRightMm = readNumber(formData.get("pageRightMm"), 9);'
);

content = content.replace(
  'const pageBottomMm = readNumber(formData.get("pageBottomMm"), 0);',
  'const pageBottomMm = readNumber(formData.get("pageBottomMm"), 9);'
);

content = content.replace(
  'const pageLeftMm = readNumber(formData.get("pageLeftMm"), 0);',
  'const pageLeftMm = readNumber(formData.get("pageLeftMm"), 9);'
);

// Innenbeschnitt: unten staerker, damit kein naechstes Label mitkommt
content = content.replace(
  'const innerTopMm = readNumber(formData.get("innerTopMm"), 1.5);',
  'const innerTopMm = readNumber(formData.get("innerTopMm"), 0.8);'
);

content = content.replace(
  'const innerRightMm = readNumber(formData.get("innerRightMm"), 1.5);',
  'const innerRightMm = readNumber(formData.get("innerRightMm"), 1.2);'
);

content = content.replace(
  'const innerBottomMm = readNumber(formData.get("innerBottomMm"), 5);',
  'const innerBottomMm = readNumber(formData.get("innerBottomMm"), 9);'
);

content = content.replace(
  'const innerLeftMm = readNumber(formData.get("innerLeftMm"), 1.5);',
  'const innerLeftMm = readNumber(formData.get("innerLeftMm"), 1.2);'
);

fs.writeFileSync(routePath, content, "utf8");
console.log("Heycater PDF Schnitt: A4-Rand und Innenbeschnitt korrigiert.");
