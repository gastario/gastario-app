const fs = require("fs");

const routePath = "app/routes/foodlabels.heycater-pdf.tsx";
let route = fs.readFileSync(routePath, "utf8");

// Heycater Foodlabels sind 3 Spalten x 8 Reihen pro A4-Seite
route = route.replace(
  /const rows = Math\.max\(1, Math\.floor\(readNumber\(formData\.get\("rows"\), \d+\)\)\);/,
  'const rows = Math.max(1, Math.floor(readNumber(formData.get("rows"), 8)));'
);

// Wieder sauber: volle A4-Seite nutzen, fast kein Innenbeschnitt
route = route.replace(
  /const pageTopMm = readNumber\(formData\.get\("pageTopMm"\), [0-9.]+\);/,
  'const pageTopMm = readNumber(formData.get("pageTopMm"), 0);'
);
route = route.replace(
  /const pageRightMm = readNumber\(formData\.get\("pageRightMm"\), [0-9.]+\);/,
  'const pageRightMm = readNumber(formData.get("pageRightMm"), 0);'
);
route = route.replace(
  /const pageBottomMm = readNumber\(formData\.get\("pageBottomMm"\), [0-9.]+\);/,
  'const pageBottomMm = readNumber(formData.get("pageBottomMm"), 0);'
);
route = route.replace(
  /const pageLeftMm = readNumber\(formData\.get\("pageLeftMm"\), [0-9.]+\);/,
  'const pageLeftMm = readNumber(formData.get("pageLeftMm"), 0);'
);

route = route.replace(
  /const innerTopMm = readNumber\(formData\.get\("innerTopMm"\), [0-9.]+\);/,
  'const innerTopMm = readNumber(formData.get("innerTopMm"), 0.4);'
);
route = route.replace(
  /const innerRightMm = readNumber\(formData\.get\("innerRightMm"\), [0-9.]+\);/,
  'const innerRightMm = readNumber(formData.get("innerRightMm"), 0.4);'
);
route = route.replace(
  /const innerBottomMm = readNumber\(formData\.get\("innerBottomMm"\), [0-9.]+\);/,
  'const innerBottomMm = readNumber(formData.get("innerBottomMm"), 0.4);'
);
route = route.replace(
  /const innerLeftMm = readNumber\(formData\.get\("innerLeftMm"\), [0-9.]+\);/,
  'const innerLeftMm = readNumber(formData.get("innerLeftMm"), 0.4);'
);

fs.writeFileSync(routePath, route, "utf8");

const pagePath = "app/routes/foodlabels.tsx";
let page = fs.readFileSync(pagePath, "utf8");

// Dropdown Standard auf 8 Reihen
page = page.replace(/select name="rows" defaultValue="\d+"/g, 'select name="rows" defaultValue="8"');

if (!page.includes('<option value="8">8 Reihen</option>')) {
  page = page.replace(
    /<option value="12">12 Reihen<\/option>\s*/g,
    ""
  );
  page = page.replace(
    '<option value="6">6 Reihen</option>',
    '<option value="8">8 Reihen</option>\n                <option value="6">6 Reihen</option>'
  );
}

// Versteckte Werte korrekt setzen
page = page.replace(/name="pageTopMm" value="[0-9.]+"/g, 'name="pageTopMm" value="0"');
page = page.replace(/name="pageRightMm" value="[0-9.]+"/g, 'name="pageRightMm" value="0"');
page = page.replace(/name="pageBottomMm" value="[0-9.]+"/g, 'name="pageBottomMm" value="0"');
page = page.replace(/name="pageLeftMm" value="[0-9.]+"/g, 'name="pageLeftMm" value="0"');

page = page.replace(/name="innerTopMm" value="[0-9.]+"/g, 'name="innerTopMm" value="0.4"');
page = page.replace(/name="innerRightMm" value="[0-9.]+"/g, 'name="innerRightMm" value="0.4"');
page = page.replace(/name="innerBottomMm" value="[0-9.]+"/g, 'name="innerBottomMm" value="0.4"');
page = page.replace(/name="innerLeftMm" value="[0-9.]+"/g, 'name="innerLeftMm" value="0.4"');

page = page.replace(
  /Standard: Heycater A4 mit 3 Spalten x \d+ Reihen\.[^<]*/g,
  "Standard: Heycater A4 mit 3 Spalten x 8 Reihen. Jeder gestrichelte Bereich wird als einzelnes Label geschnitten."
);

fs.writeFileSync(pagePath, page, "utf8");

console.log("Heycater Foodlabel-Raster auf 3 x 8 korrigiert.");
