const fs = require("fs");

const routePath = "app/routes/foodlabels.heycater-pdf.tsx";
let route = fs.readFileSync(routePath, "utf8");

// Standard von 6 auf 12 Reihen setzen
route = route.replace(
  'const rows = Math.max(1, Math.floor(readNumber(formData.get("rows"), 6)));',
  'const rows = Math.max(1, Math.floor(readNumber(formData.get("rows"), 12)));'
);

// Innenbeschnitt wieder kleiner, weil jetzt jede Zeile halb so hoch ist
route = route.replace(
  'const innerTopMm = readNumber(formData.get("innerTopMm"), 0);',
  'const innerTopMm = readNumber(formData.get("innerTopMm"), 0.4);'
);

route = route.replace(
  'const innerBottomMm = readNumber(formData.get("innerBottomMm"), 12);',
  'const innerBottomMm = readNumber(formData.get("innerBottomMm"), 0.8);'
);

route = route.replace(
  'const innerRightMm = readNumber(formData.get("innerRightMm"), 1);',
  'const innerRightMm = readNumber(formData.get("innerRightMm"), 0.8);'
);

route = route.replace(
  'const innerLeftMm = readNumber(formData.get("innerLeftMm"), 1);',
  'const innerLeftMm = readNumber(formData.get("innerLeftMm"), 0.8);'
);

fs.writeFileSync(routePath, route, "utf8");

const pagePath = "app/routes/foodlabels.tsx";
let page = fs.readFileSync(pagePath, "utf8");

// Dropdown sichtbar auf 12 Reihen erweitern und Standard 12 setzen
page = page.replace('select name="rows" defaultValue="6"', 'select name="rows" defaultValue="12"');

if (!page.includes('<option value="12">12 Reihen</option>')) {
  page = page.replace(
    '<option value="6">6 Reihen</option>',
    '<option value="12">12 Reihen</option>\n                <option value="6">6 Reihen</option>'
  );
}

// Hidden Werte passend setzen
page = page.replace('name="innerTopMm" value="0"', 'name="innerTopMm" value="0.4"');
page = page.replace('name="innerTopMm" value="0.8"', 'name="innerTopMm" value="0.4"');
page = page.replace('name="innerRightMm" value="1"', 'name="innerRightMm" value="0.8"');
page = page.replace('name="innerBottomMm" value="12"', 'name="innerBottomMm" value="0.8"');
page = page.replace('name="innerBottomMm" value="9"', 'name="innerBottomMm" value="0.8"');
page = page.replace('name="innerLeftMm" value="1"', 'name="innerLeftMm" value="0.8"');

page = page.replace(
  "Standard: Heycater A4 mit 3 Spalten x 6 Reihen. Die Schnittlinien werden als Label-Grenze beruecksichtigt.",
  "Standard: Heycater A4 mit 3 Spalten x 12 Reihen. Jeder gestrichelte Bereich wird als einzelnes Label geschnitten."
);

page = page.replace(
  "Standard: 3 Spalten x 6 Reihen.",
  "Standard: 3 Spalten x 12 Reihen."
);

fs.writeFileSync(pagePath, page, "utf8");

console.log("Heycater Foodlabel Import auf 3 Spalten x 12 Reihen umgestellt.");
