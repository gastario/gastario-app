const fs = require("fs");

const path = "app/lib/heycater-zebra-pdf.server.ts";
let content = fs.readFileSync(path, "utf8");

fs.writeFileSync(path + ".backup-before-allergen-italic", content, "utf8");

// 1) HelveticaOblique Font einbetten
content = content.replace(
  `const bold = await pdf.embedFont(StandardFonts.HelveticaBold);`,
  `const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);`
);

// 2) Allergene/Details kursiv statt bold
content = content.replace(
  /for \(const line of wrapText\(label\.details,\s*42\)\.slice\(0,\s*3\)\) \{\s*page\.drawText\(line,\s*\{\s*x:\s*left,\s*y,\s*size:\s*[\d.]+,\s*font:\s*bold,\s*color:\s*black,/g,
  `for (const line of wrapText(label.details, 42).slice(0, 3)) {
      page.drawText(line, {
        x: left,
        y,
        size: 7.6,
        font: italic,
        color: black,`
);

// 3) Falls durch alte Patches noch pauschal "font: bold" im Details-Block steckt, gezielt ersetzen
content = content.replace(
  /for \(const line of wrapText\(label\.details,\s*42\)\.slice\(0,\s*3\)\) \{([\s\S]*?)font:\s*bold,/,
  `for (const line of wrapText(label.details, 42).slice(0, 3)) {$1font: italic,`
);

// 4) Allergene nicht zu fett/gross, sondern ruhig lesbar
content = content.replace(/size:\s*7\.8,/g, "size: 7.6,");

// 5) Abstand Allergene bleibt lesbar
content = content.replace(/y -= 9\.2;/g, "y -= 9.0;");

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Allergene kursiv gesetzt.");
