const fs = require("fs");

const file = "app/routes/rechnungen.tsx";
let text = fs.readFileSync(file, "utf8");

const styles = `
const miniPrimaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#059669",
  color: "#ffffff",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const miniButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const miniDangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};
`;

if (!text.includes("const miniPrimaryButtonStyle")) {
  text = text + "\n" + styles;
}

fs.writeFileSync(file, text, "utf8");
