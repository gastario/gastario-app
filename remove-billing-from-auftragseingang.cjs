const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) UI-Block Rechnung & Steuer komplett entfernen
text = text.replace(
/\s*<div style=\{\{\s*border: "1px solid #dbeafe",[\s\S]*?<h3 style=\{\{ margin: "4px 0 0", fontSize: 18, letterSpacing: "-0\.03em" \}\}>\s*Rechnung & Steuer\s*<\/h3>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*/m,
"\n"
);

// 2) Falls Regex wegen Formatierung nicht greift: robuster Start/Ende-Fallback
if (text.includes("Rechnung & Steuer")) {
  const titleIndex = text.indexOf("Rechnung & Steuer");
  const start = text.lastIndexOf("<div style={{", titleIndex);
  const afterTitle = text.indexOf("Positionen", titleIndex);

  if (start !== -1 && afterTitle !== -1) {
    const positionBlockStart = text.lastIndexOf("<div style={{ display: \"grid\", gap: 10 }}>", afterTitle);
    if (positionBlockStart !== -1 && positionBlockStart > start) {
      text = text.slice(0, start) + text.slice(positionBlockStart);
    }
  }
}

// 3) Server: Rechnungs-/Steuer-Felder aus Auftragseingang wieder entfernen
text = text.replace(
/\s*const billingMode = String\(formData\.get\("billingMode"\) \|\| "UNDECIDED"\);[\s\S]*?const billingStatus =[\s\S]*?: "NOT_BILLED";/m,
""
);

// 4) Server: Speichern dieser Felder beim Auftrag entfernen
text = text.replace(
/\s*billingMode: billingMode as any,\s*[\r\n]+[\s\S]*?taxTreatment: taxTreatment as any,\s*/m,
""
);

// 5) Doppelte Leerzeilen etwas aufräumen
text = text.replace(/\n{4,}/g, "\n\n\n");

fs.writeFileSync(file, text, "utf8");
