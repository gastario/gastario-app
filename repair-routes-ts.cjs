const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes.ts");

if (!fs.existsSync(file)) {
  throw new Error("app/routes.ts nicht gefunden");
}

let content = fs.readFileSync(file, "utf8");

const requiredRoutes = [
  'route("gastario-control", "routes/gastario-control.tsx"),',
  'route("gastario-control/mandanten", "routes/gastario-control.mandanten.tsx"),',
  'route("gastario-control/mandanten/:tenantId", "routes/gastario-control.mandanten.$tenantId.tsx"),',
  'route("gastario-control/pakete", "routes/gastario-control.pakete.tsx"),',
  'route("gastario-control/features", "routes/gastario-control.features.tsx"),',
  'route("gastario-control/codes", "routes/gastario-control.codes.tsx"),',
];

for (const line of requiredRoutes) {
  if (content.includes(line)) continue;

  const match = content.match(/\]\s+satisfies\s+RouteConfig\s*;/);

  if (match) {
    content = content.replace(match[0], "  " + line + "\n" + match[0]);
  } else {
    content = content.replace(/\]\s*;?\s*$/, "  " + line + "\n];");
  }

  console.log("hinzugefügt:", line);
}

fs.writeFileSync(file, content, "utf8");

console.log("routes.ts repariert.");
console.log("");
console.log(fs.readFileSync(file, "utf8"));
