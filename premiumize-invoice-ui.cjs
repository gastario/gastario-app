const fs = require("fs");

const files = [
  "app/routes/rechnungen.tsx",
  "app/routes/rechnungen.neu.tsx",
  "app/routes/rechnungen.$invoiceId.tsx",
  "app/routes/einstellungen.rechnungen.tsx",
];

const premiumStyles = `
const premiumUiStyle: React.CSSProperties = {
  "--g-card-bg": "#ffffff",
  "--g-border": "#dbe3ec",
  "--g-border-strong": "#cbd5e1",
  "--g-page-bg": "#eef3f7",
  "--g-text": "#0f172a",
  "--g-muted": "#64748b",
  "--g-green": "#059669",
  "--g-green-dark": "#047857",
} as React.CSSProperties;

const premiumCardBase: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe3ec",
  borderRadius: 18,
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.055)",
};

const premiumButtonBase: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  padding: "0 16px",
  fontSize: 14,
  fontWeight: 850,
  letterSpacing: "-0.01em",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const premiumPrimaryButton: React.CSSProperties = {
  ...premiumButtonBase,
  border: "1px solid #059669",
  background: "#059669",
  color: "#ffffff",
  boxShadow: "0 8px 18px rgba(5, 150, 105, 0.18)",
};

const premiumSecondaryButton: React.CSSProperties = {
  ...premiumButtonBase,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
};

const premiumDangerButton: React.CSSProperties = {
  ...premiumButtonBase,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
};

const premiumInput: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  fontWeight: 650,
  background: "#ffffff",
  outline: "none",
};

const premiumLabel: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#334155",
  fontSize: 12,
  fontWeight: 850,
};

const premiumSectionLabel: React.CSSProperties = {
  margin: 0,
  color: "#00796b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 11,
  fontWeight: 950,
};

const premiumTitle: React.CSSProperties = {
  margin: "5px 0 0",
  fontSize: 24,
  letterSpacing: "-0.04em",
  color: "#0f172a",
};

const premiumMuted: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontWeight: 650,
  lineHeight: 1.55,
};
`;

for (const file of files) {
  if (!fs.existsSync(file)) continue;

  let text = fs.readFileSync(file, "utf8");

  if (!text.includes("premiumUiStyle")) {
    text += "\n" + premiumStyles + "\n";
  }

  // Karten hochwertiger machen
  text = text.replace(
    /const cardStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const cardStyle: React.CSSProperties = {
  ...premiumCardBase,
  padding: 22,
};`
  );

  text = text.replace(
    /const statCardStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const statCardStyle: React.CSSProperties = {
  ...premiumCardBase,
  padding: 18,
  display: "grid",
  gap: 7,
};`
  );

  text = text.replace(
    /const heroStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const heroStyle: React.CSSProperties = {
  ...premiumCardBase,
  padding: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
};`
  );

  text = text.replace(
    /const previewCardStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const previewCardStyle: React.CSSProperties = {
  ...premiumCardBase,
  padding: 34,
  boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
};`
  );

  // Buttons vereinheitlichen
  text = text.replace(
    /const primaryButtonStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const primaryButtonStyle: React.CSSProperties = premiumPrimaryButton;`
  );

  text = text.replace(
    /const secondaryButtonStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const secondaryButtonStyle: React.CSSProperties = premiumSecondaryButton;`
  );

  text = text.replace(
    /const dangerButtonStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const dangerButtonStyle: React.CSSProperties = premiumDangerButton;`
  );

  text = text.replace(
    /const miniPrimaryButtonStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const miniPrimaryButtonStyle: React.CSSProperties = {
  ...premiumPrimaryButton,
  minHeight: 34,
  borderRadius: 10,
  padding: "0 12px",
  fontSize: 12,
};`
  );

  text = text.replace(
    /const miniButtonStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const miniButtonStyle: React.CSSProperties = {
  ...premiumSecondaryButton,
  minHeight: 34,
  borderRadius: 10,
  padding: "0 12px",
  fontSize: 12,
};`
  );

  text = text.replace(
    /const miniDangerButtonStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const miniDangerButtonStyle: React.CSSProperties = {
  ...premiumDangerButton,
  minHeight: 34,
  borderRadius: 10,
  padding: "0 12px",
  fontSize: 12,
};`
  );

  text = text.replace(
    /const heroButtonStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const heroButtonStyle: React.CSSProperties = premiumPrimaryButton;`
  );

  text = text.replace(
    /const ghostButtonStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const ghostButtonStyle: React.CSSProperties = premiumSecondaryButton;`
  );

  // Inputs vereinheitlichen
  text = text.replace(
    /const inputStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const inputStyle: React.CSSProperties = premiumInput;`
  );

  text = text.replace(
    /const labelStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const labelStyle: React.CSSProperties = premiumLabel;`
  );

  text = text.replace(
    /const floatingLabelStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const floatingLabelStyle: React.CSSProperties = premiumLabel;`
  );

  // Überschriften/Labels vereinheitlichen
  text = text.replace(
    /const smallLabelStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const smallLabelStyle: React.CSSProperties = premiumSectionLabel;`
  );

  text = text.replace(
    /const heroTitleStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const heroTitleStyle: React.CSSProperties = premiumTitle;`
  );

  text = text.replace(
    /const sectionTitleStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const sectionTitleStyle: React.CSSProperties = premiumTitle;`
  );

  text = text.replace(
    /const mutedTextStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const mutedTextStyle: React.CSSProperties = premiumMuted;`
  );

  text = text.replace(
    /const heroTextStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const heroTextStyle: React.CSSProperties = premiumMuted;`
  );

  // Seitenabstand etwas hochwertiger
  text = text.replace(
    /const pageGridStyle: React\.CSSProperties = \{[\s\S]*?\};/m,
    `const pageGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};`
  );

  fs.writeFileSync(file, text, "utf8");
}
