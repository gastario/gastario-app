const fs = require("fs");

const routePath = "app/routes/foodlabels.heycater-pdf.tsx";
let content = fs.readFileSync(routePath, "utf8");

// Seite wieder komplett nutzen, sonst wird links/rechts Text abgeschnitten
content = content.replace(
  'const pageTopMm = readNumber(formData.get("pageTopMm"), 9);',
  'const pageTopMm = readNumber(formData.get("pageTopMm"), 0);'
);

content = content.replace(
  'const pageRightMm = readNumber(formData.get("pageRightMm"), 9);',
  'const pageRightMm = readNumber(formData.get("pageRightMm"), 0);'
);

content = content.replace(
  'const pageBottomMm = readNumber(formData.get("pageBottomMm"), 9);',
  'const pageBottomMm = readNumber(formData.get("pageBottomMm"), 0);'
);

content = content.replace(
  'const pageLeftMm = readNumber(formData.get("pageLeftMm"), 9);',
  'const pageLeftMm = readNumber(formData.get("pageLeftMm"), 0);'
);

// Nur innen schneiden:
// oben fast nichts weg, links/rechts wenig, unten stark gegen naechstes Label
content = content.replace(
  'const innerTopMm = readNumber(formData.get("innerTopMm"), 0.8);',
  'const innerTopMm = readNumber(formData.get("innerTopMm"), 0);'
);

content = content.replace(
  'const innerRightMm = readNumber(formData.get("innerRightMm"), 1.2);',
  'const innerRightMm = readNumber(formData.get("innerRightMm"), 1);'
);

content = content.replace(
  'const innerBottomMm = readNumber(formData.get("innerBottomMm"), 9);',
  'const innerBottomMm = readNumber(formData.get("innerBottomMm"), 12);'
);

content = content.replace(
  'const innerLeftMm = readNumber(formData.get("innerLeftMm"), 1.2);',
  'const innerLeftMm = readNumber(formData.get("innerLeftMm"), 1);'
);

fs.writeFileSync(routePath, content, "utf8");
console.log("Heycater-Schnitt korrigiert: volle A4-Breite, unten staerker beschnitten.");
