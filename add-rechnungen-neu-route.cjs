const fs = require("fs");

const file = "app/routes.ts";
let text = fs.readFileSync(file, "utf8");

if (!text.includes('route("rechnungen/neu", "routes/rechnungen.neu.tsx")')) {
  text = text.replace(
    `  route("rechnungen", "routes/rechnungen.tsx"),`,
    `  route("rechnungen", "routes/rechnungen.tsx"),
  route("rechnungen/neu", "routes/rechnungen.neu.tsx"),`
  );
}

fs.writeFileSync(file, text, "utf8");
