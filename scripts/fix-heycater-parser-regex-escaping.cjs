const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-regex-fix", content, "utf8");

// Kaputte doppelt escaped Regexe reparieren
content = content.replaceAll(/\\\\r\?\\\\n/g, "\\r?\\n");
content = content.replaceAll(/\\\\b/g, "\\b");
content = content.replaceAll(/\\\\s/g, "\\s");
content = content.replaceAll(/\\\\d/g, "\\d");

// Falls dadurch in Strings etwas komisch wurde, die wichtigste split-Zeile hart sichern
content = content.replace(
  `.split(/\\\\r?\\\\n/)`,
  `.split(/\\r?\\n/)`
);

content = content.replace(
  `.split(/\\r?\\n/)`,
  `.split(/\\r?\\n/)`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Parser Regex repariert: echte Zeilenumbrueche werden wieder erkannt.");
