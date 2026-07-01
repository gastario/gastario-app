const fs = require("fs");

const routesFile = "app/routes.ts";
let routes = fs.readFileSync(routesFile, "utf8");

if (!routes.includes('route("einstellungen/rechnungen", "routes/einstellungen.rechnungen.tsx")')) {
  routes = routes.replace(
    `  route("einstellungen", "routes/einstellungen.tsx"),`,
    `  route("einstellungen", "routes/einstellungen.tsx"),
  route("einstellungen/rechnungen", "routes/einstellungen.rechnungen.tsx"),`
  );
}

fs.writeFileSync(routesFile, routes, "utf8");

const layoutFile = "app/components/AppLayout.tsx";
let layout = fs.readFileSync(layoutFile, "utf8");

if (!layout.includes('{ label: "Rechnungsdaten", to: "/einstellungen/rechnungen" }')) {
  layout = layout.replace(
    `{ label: "Einstellungen", to: "/einstellungen" },`,
    `{ label: "Einstellungen", to: "/einstellungen" },
      { label: "Rechnungsdaten", to: "/einstellungen/rechnungen" },`
  );
}

fs.writeFileSync(layoutFile, layout, "utf8");
