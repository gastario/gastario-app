const fs = require("fs");

const file = "app/routes/rechnungen.$invoiceId.tsx";
let text = fs.readFileSync(file, "utf8");

text = text.replace(
  `<button type="button" style={ghostButtonStyle}>PDF später</button>
              <button type="button" style={ghostButtonStyle}>Drucken später</button>`,
  `<Link to={\`/rechnungen/\${invoice.id}/pdf\`} target="_blank" style={ghostButtonStyle}>PDF / Drucken</Link>`
);

fs.writeFileSync(file, text, "utf8");
