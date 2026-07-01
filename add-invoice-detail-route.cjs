const fs = require("fs");

const file = "app/routes.ts";
let text = fs.readFileSync(file, "utf8");

if (!text.includes('route("rechnungen/:invoiceId", "routes/rechnungen.$invoiceId.tsx")')) {
  text = text.replace(
    `  route("rechnungen/neu", "routes/rechnungen.neu.tsx"),`,
    `  route("rechnungen/neu", "routes/rechnungen.neu.tsx"),
  route("rechnungen/:invoiceId", "routes/rechnungen.$invoiceId.tsx"),`
  );
}

fs.writeFileSync(file, text, "utf8");
