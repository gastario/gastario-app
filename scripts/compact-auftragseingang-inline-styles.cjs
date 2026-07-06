const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

function replaceBlock(name, replacement) {
  const start = content.indexOf(`  const ${name}: any = {`);
  if (start === -1) {
    throw new Error(`${name} nicht gefunden`);
  }

  let depth = 0;
  let end = -1;

  for (let i = start; i < content.length; i++) {
    const char = content[i];

    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) {
        end = content.indexOf(";", i) + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`${name} Ende nicht gefunden`);
  }

  content = content.slice(0, start) + replacement + content.slice(end);
}

replaceBlock("cardStyle", `  const cardStyle: any = {
    background: "#ffffff",
    border: "1px solid #dbe5ec",
    borderRadius: 14,
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.035)",
  };`);

replaceBlock("mailCardStyle", `  const mailCardStyle: any = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    background: "#ffffff",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    boxShadow: "none",
  };`);

replaceBlock("sectionLabelStyle", `  const sectionLabelStyle: any = {
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: ".09em",
    fontSize: 10,
    fontWeight: 700,
  };`);

replaceBlock("primaryButtonStyle", `  const primaryButtonStyle: any = {
    border: "1px solid #0f9f7a",
    background: "#0f9f7a",
    color: "#ffffff",
    borderRadius: 8,
    padding: "7px 11px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    minHeight: 34,
  };`);

replaceBlock("secondaryButtonStyle", `  const secondaryButtonStyle: any = {
    border: "1px solid #d6e1ea",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 8,
    padding: "7px 11px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
  };`);

replaceBlock("inputStyle", `  const inputStyle: any = {
    height: 36,
    border: "1px solid #d6e1ea",
    borderRadius: 8,
    padding: "0 10px",
    fontWeight: 450,
    fontSize: 13,
    color: "#0f172a",
    background: "#ffffff",
  };`);

replaceBlock("thStyle", `  const thStyle: any = {
    textAlign: "left",
    padding: "10px 12px",
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".055em",
    borderBottom: "1px solid #e8eef4",
    fontWeight: 700,
  };`);

replaceBlock("tdStyle", `  const tdStyle: any = {
    padding: "11px 12px",
    borderBottom: "1px solid #edf2f7",
    verticalAlign: "top",
    fontSize: 13,
    fontWeight: 450,
  };`);

// große Inline-Paddings reduzieren
content = content.replaceAll("padding: 30", "padding: 20");
content = content.replaceAll("padding: 28", "padding: 20");
content = content.replaceAll("padding: 26", "padding: 18");
content = content.replaceAll("padding: 24", "padding: 18");
content = content.replaceAll("padding: 22", "padding: 16");

// große Radius-Werte reduzieren
content = content.replaceAll("borderRadius: 24", "borderRadius: 14");
content = content.replaceAll("borderRadius: 22", "borderRadius: 14");
content = content.replaceAll("borderRadius: 20", "borderRadius: 12");
content = content.replaceAll("borderRadius: 18", "borderRadius: 12");

// dicke Schrift raus
content = content.replaceAll("fontWeight: 950", "fontWeight: 700");
content = content.replaceAll("fontWeight: 900", "fontWeight: 600");
content = content.replaceAll("fontWeight: 850", "fontWeight: 500");
content = content.replaceAll("fontWeight: 800", "fontWeight: 600");

// sehr große Überschriften/Zahlen etwas kleiner
content = content.replaceAll("fontSize: 38", "fontSize: 30");
content = content.replaceAll("fontSize: 34", "fontSize: 28");
content = content.replaceAll("fontSize: 32", "fontSize: 28");
content = content.replaceAll("fontSize: 30", "fontSize: 27");
content = content.replaceAll("fontSize: 28", "fontSize: 25");

// starke Schatten raus
content = content.replaceAll(
  'boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)"',
  'boxShadow: "0 6px 16px rgba(15, 23, 42, 0.035)"'
);

content = content.replaceAll(
  'boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)"',
  'boxShadow: "0 6px 16px rgba(15, 23, 42, 0.035)"'
);

content = content.replaceAll(
  'boxShadow: "0 10px 22px rgba(15, 159, 122, 0.18)"',
  'boxShadow: "none"'
);

// Spacing etwas dichter
content = content.replaceAll("gap: 24", "gap: 14");
content = content.replaceAll("gap: 22", "gap: 14");
content = content.replaceAll("gap: 20", "gap: 12");
content = content.replaceAll("gap: 18", "gap: 12");
content = content.replaceAll("gap: 16", "gap: 10");

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang Inline-Styles kompakter gemacht.");
