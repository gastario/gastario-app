const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

const replacements = [
  ["AuftrÃ¤ge", "Aufträge"],
  ["AuftrÃ¤gen", "Aufträgen"],
  ["prÃ¼fen", "prüfen"],
  ["PrÃ¼fen", "Prüfen"],
  ["Ãœbernehmen", "Übernehmen"],
  ["Ãœbernommen", "Übernommen"],
  ["Ã¼bernehmen", "übernehmen"],
  ["Ã¼bernommen", "übernommen"],
  ["MenÃ¼", "Menü"],
  ["StÃ¼ck", "Stück"],
  ["â‚¬", "€"],
  ["fÃ¼r", "für"],
  ["spÃ¤ter", "später"],
  ["Ã¤", "ä"],
  ["Ã¶", "ö"],
  ["Ã¼", "ü"],
  ["ÃŸ", "ß"],
  ["Ã„", "Ä"],
  ["Ã–", "Ö"],
  ["Ãœ", "Ü"]
];

for (const [bad, good] of replacements) {
  text = text.split(bad).join(good);
}

fs.writeFileSync(file, text, "utf8");
