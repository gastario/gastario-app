const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

if (!content.includes("const primaryActionStyle")) {
  const insertAfterMatch = content.match(/const\s+smallButtonStyle:\s*any\s*=\s*\{[\s\S]*?\n\s*\};/);

  if (!insertAfterMatch) {
    throw new Error("smallButtonStyle nicht gefunden.");
  }

  const insert = insertAfterMatch[0] + `

  const toolbarInputStyle: any = {
    height: 44,
    border: "1px solid #d7e2ec",
    borderRadius: 14,
    padding: "0 14px",
    fontSize: 14,
    fontWeight: 850,
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  const toolbarButtonStyle: any = {
    height: 44,
    border: "1px solid #d7e2ec",
    background: "#ffffff",
    borderRadius: 14,
    padding: "0 15px",
    fontSize: 14,
    fontWeight: 950,
    color: "#0f172a",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  const primaryActionStyle: any = {
    minHeight: 38,
    border: "1px solid #0f9f7a",
    background: "#0f9f7a",
    color: "#ffffff",
    borderRadius: 12,
    padding: "8px 13px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 18px rgba(15, 159, 122, 0.18)",
  };

  const quietActionStyle: any = {
    minHeight: 38,
    border: "1px solid #dbe5ee",
    background: "#ffffff",
    color: "#334155",
    borderRadius: 12,
    padding: "8px 13px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const dangerActionStyle: any = {
    minHeight: 38,
    border: "1px solid #fecaca",
    background: "#fff7f7",
    color: "#b91c1c",
    borderRadius: 12,
    padding: "8px 13px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const statusPillStyle: any = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #dbe5ee",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    background: "#f8fafc",
    color: "#334155",
  };`;

  content = content.replace(insertAfterMatch[0], insert);
}

content = content.replaceAll("Sonstiges / Absagen / Absagen", "Sonstiges / Absagen");
content = content.replaceAll("Erinnerungen / Lieferscheine / Lieferscheine", "Erinnerungen / Lieferscheine");

fs.writeFileSync(path, content, "utf8");
console.log("Fehlende Auftragseingang-Styles robust eingefuegt.");
