const fs = require("fs");

const path = "app/lib/heycater-zebra-pdf.server.ts";
let content = fs.readFileSync(path, "utf8");

// Details nicht nur 2 Zeilen, sondern bis zu 3 Zeilen anzeigen
content = content.replace(
  "for (const line of wrapText(label.details, 58).slice(0, 2)) {",
  "for (const line of wrapText(label.details, 58).slice(0, 3)) {"
);

// Details etwas kompakter setzen, damit alles aufs Label passt
content = content.replace(
  "size: 5.1,",
  "size: 4.8,"
);

content = content.replace(
  "y -= 6.2;",
  "y -= 5.6;"
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Zebra Layout zeigt mehr Allergene/Details.");
