const fs = require("fs");
const path = require("path");

const root = process.cwd();

const includeExt = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json", ".svg"]);

const replacements = [
  // einfache UTF-8 Mojibake
  ["\\u00C3\\u00BC", "ü"], // Ã¼
  ["\\u00C3\\u00A4", "ä"], // Ã¤
  ["\\u00C3\\u00B6", "ö"], // Ã¶
  ["\\u00C3\\u015C", "Ü"], // Ãœ
  ["\\u00C3\\u201E", "Ä"], // Ã„
  ["\\u00C3\\u2013", "Ö"], // Ã–
  ["\\u00C3\\u0178", "ß"], // ÃŸ

  // doppelte Mojibake
  ["\\u00C3\\u0192\\u00C2\\u00BC", "ü"], // ÃƒÂ¼
  ["\\u00C3\\u0192\\u00C2\\u00A4", "ä"], // ÃƒÂ¤
  ["\\u00C3\\u0192\\u00C2\\u00B6", "ö"], // ÃƒÂ¶
  ["\\u00C3\\u0192\\u00E2\\u20AC\\u017E", "Ä"],
  ["\\u00C3\\u0192\\u00E2\\u20AC\\u201C", "Ö"],
  ["\\u00C3\\u0192\\u00C5\\u201C", "Ü"],
  ["\\u00C3\\u0192\\u00C5\\u00B8", "ß"],

  // Euro / Sonderzeichen
  ["\\u00E2\\u201A\\u00AC", "€"], // â‚¬
  ["\\u00C2\\u20AC", "€"], // Â€
  ["\\u00C2\\u00A7", "§"], // Â§
  ["\\u00C2", ""],

  // typische kaputte Wörter aus unseren Dateien
  ["Auftr\\u00C3\\u0192\\u00C2\\u00A4ge", "Aufträge"],
  ["Auftr\\u00C3\\u00A4ge", "Aufträge"],
  ["sp\\u00C3\\u0192\\u00C2\\u00A4ter", "später"],
  ["sp\\u00C3\\u00A4ter", "später"],
  ["f\\u00C3\\u0192\\u00C2\\u00BCr", "für"],
  ["f\\u00C3\\u00BCr", "für"],
  ["F\\u00C3\\u0192\\u00C2\\u00BCr", "Für"],
  ["F\\u00C3\\u00BCr", "Für"],
  ["\\u00C3\\u015Cbersicht", "Übersicht"],
  ["\\u00C3\\u0192\\u00C5\\u201Cbersicht", "Übersicht"],
  ["\\u00C3\\u00B6ffnen", "öffnen"],
  ["\\u00C3\\u0192\\u00C2\\u00B6ffnen", "öffnen"],
  ["Gekuendigt", "Gekündigt"],
  ["Auftraege", "Aufträge"],
  ["Uebersicht", "Übersicht"],
  ["spaeter", "später"],
  ["fuer", "für"],
  ["gueltig", "gültig"],
  ["Gueltig", "Gültig"],
  ["geloescht", "gelöscht"],
  ["Loeschen", "Löschen"],
  ["Oeffnen", "Öffnen"],
  ["geoeffnet", "geöffnet"],
  ["koennen", "können"],
  ["oeffentlich", "öffentlich"],
  ["ausgewaehlt", "ausgewählt"],
  ["laeuft", "läuft"],
  ["pruefen", "prüfen"],
  ["Mueller", "Müller"],
];

function shouldSkip(filePath) {
  return (
    filePath.includes(`${path.sep}node_modules${path.sep}`) ||
    filePath.includes(`${path.sep}.git${path.sep}`) ||
    filePath.includes(`${path.sep}build${path.sep}`) ||
    filePath.includes(`${path.sep}.react-router${path.sep}`)
  );
}

function walk(dir, files = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);

    if (shouldSkip(full)) continue;

    if (item.isDirectory()) {
      walk(full, files);
    } else if (includeExt.has(path.extname(full))) {
      files.push(full);
    }
  }

  return files;
}

let changed = 0;

for (const file of walk(root)) {
  let content = fs.readFileSync(file, "utf8");
  let next = content;

  for (const [badEscaped, good] of replacements) {
    const bad = badEscaped.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

    next = next.split(bad).join(good);
  }

  if (next !== content) {
    fs.writeFileSync(file, next, "utf8");
    changed++;
    console.log("repariert:", path.relative(root, file));
  }
}

console.log("Fertig. Dateien geaendert:", changed);
