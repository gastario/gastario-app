const fs = require("fs");

const path = "app/routes/foodlabels.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace('name="pageTopMm" value="0"', 'name="pageTopMm" value="9"');
content = content.replace('name="pageRightMm" value="0"', 'name="pageRightMm" value="9"');
content = content.replace('name="pageBottomMm" value="0"', 'name="pageBottomMm" value="9"');
content = content.replace('name="pageLeftMm" value="0"', 'name="pageLeftMm" value="9"');

content = content.replace('name="innerTopMm" value="1.5"', 'name="innerTopMm" value="0.8"');
content = content.replace('name="innerRightMm" value="1.5"', 'name="innerRightMm" value="1.2"');
content = content.replace('name="innerBottomMm" value="5"', 'name="innerBottomMm" value="9"');
content = content.replace('name="innerLeftMm" value="1.5"', 'name="innerLeftMm" value="1.2"');

content = content.replace(
  "Standard: 3 Spalten x 6 Reihen. Wenn ein Nachbarlabel sichtbar ist, erhoehen wir danach den Innenrand unten.",
  "Standard: Heycater A4 mit 3 Spalten x 6 Reihen. Die Schnittlinien werden als Label-Grenze beruecksichtigt."
);

fs.writeFileSync(path, content, "utf8");
console.log("Foodlabel Uploadwerte fuer Heycater-Schnittlinien angepasst.");
