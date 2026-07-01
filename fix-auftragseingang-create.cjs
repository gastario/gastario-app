const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Felder entfernen, die im aktuellen Prisma Order-Model nicht existieren
text = text.replace(/\s*confidence:\s*"HIGH"\s+as\s+any,\r?\n/g, "");
text = text.replace(/\s*manualReviewReason:\s*"Manuell im Auftragseingang angelegt",\r?\n/g, "");

// Kaputtes Mal-Zeichen in der Positionsanzeige reparieren
text = text.replaceAll(" Ã— ", " × ");

fs.writeFileSync(file, text, "utf8");
