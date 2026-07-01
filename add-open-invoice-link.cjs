const fs = require("fs");

const file = "app/routes/rechnungen.tsx";
let text = fs.readFileSync(file, "utf8");

const needle = `<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>`;

const replacement = `<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Link to={\`/rechnungen/\${invoice.id}\`} style={miniButtonStyle}>Öffnen</Link>`;

if (!text.includes("Öffnen</Link>")) {
  if (!text.includes(needle)) {
    throw new Error("Aktion-Div wurde nicht gefunden.");
  }

  text = text.replace(needle, replacement);
}

fs.writeFileSync(file, text, "utf8");
