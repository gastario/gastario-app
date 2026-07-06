const fs = require("fs");

const path = "app/routes/api.email-import.run.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replaceAll(
  'errorMessage: importDecision.reason || "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",',
  'errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",'
);

content = content.replace(
`                  extractedJson: extractedOrder || undefined,
                  errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",`,
`                  extractedJson: extractedOrder || undefined,
                  errorMessage: importDecision.reason || "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",`
);

content = content.replace(
`                processedAt: new Date(),
                errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",`,
`                processedAt: new Date(),
                errorMessage: importDecision.reason || "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",`
);

fs.writeFileSync(path, content, "utf8");
console.log("importDecision Scope-Fix gesetzt.");
