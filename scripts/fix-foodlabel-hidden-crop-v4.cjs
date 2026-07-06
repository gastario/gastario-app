const fs = require("fs");

const path = "app/routes/foodlabels.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace('name="pageTopMm" value="9"', 'name="pageTopMm" value="0"');
content = content.replace('name="pageRightMm" value="9"', 'name="pageRightMm" value="0"');
content = content.replace('name="pageBottomMm" value="9"', 'name="pageBottomMm" value="0"');
content = content.replace('name="pageLeftMm" value="9"', 'name="pageLeftMm" value="0"');

content = content.replace('name="innerTopMm" value="0.8"', 'name="innerTopMm" value="0"');
content = content.replace('name="innerRightMm" value="1.2"', 'name="innerRightMm" value="1"');
content = content.replace('name="innerBottomMm" value="9"', 'name="innerBottomMm" value="12"');
content = content.replace('name="innerLeftMm" value="1.2"', 'name="innerLeftMm" value="1"');

fs.writeFileSync(path, content, "utf8");
console.log("Uploadformular-Schnittwerte korrigiert.");
