const fs = require("fs");

const file = "app/routes.ts";
let text = fs.readFileSync(file, "utf8");

if (!text.includes('route("rechnungen/:invoiceId/pdf", "routes/rechnungen.$invoiceId.pdf.tsx")')) {
  text = text.replace(
    `  route("rechnungen/:invoiceId", "routes/rechnungen.$invoiceId.tsx"),`,
    `  route("rechnungen/:invoiceId", "routes/rechnungen.$invoiceId.tsx"),
  route("rechnungen/:invoiceId/pdf", "routes/rechnungen.$invoiceId.pdf.tsx"),`
  );
}

fs.writeFileSync(file, text, "utf8");
