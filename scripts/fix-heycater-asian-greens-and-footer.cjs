const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

// 1) Asian Greens with Sesame Salmon darf NICHT blockiert werden.
// "sesame" alleine raus, aber "sesame seeds" bleibt als Allergen-Hinweis gesperrt.
content = content.replace(
  `    "sesame",
    "soybeans",`,
  `    "sesame seeds",
    "soybeans",`
);

// Falls durch vorherige Patches "sesame seeds" doppelt wurde, bereinigen.
content = content.replaceAll(
  `    "sesame seeds",
    "sesame seeds",`,
  `    "sesame seeds",`
);

// 2) PDF-Footer wie "-- 1 of 5 -- Ahan Ghosh" darf niemals Name sein.
content = content.replace(
  `if (lower.includes("pdf generator")) return false;`,
  `if (lower.includes("pdf generator")) return false;
  if (/--\\s*\\d+\\s*of\\s*\\d+\\s*--/i.test(text)) return false;
  if (/^\\d+\\s*of\\s*\\d+$/i.test(text)) return false;`
);

// 3) Auch in isPossibleNameLine den Footer blocken.
content = content.replace(
  `if (lower.includes("pdf generator")) return false;`,
  `if (lower.includes("pdf generator")) return false;
  if (/--\\s*\\d+\\s*of\\s*\\d+\\s*--/i.test(text)) return false;
  if (/^\\d+\\s*of\\s*\\d+$/i.test(text)) return false;`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Parser: Asian Greens erlaubt und PDF-Footer als Name blockiert.");
