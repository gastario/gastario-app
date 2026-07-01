const fs = require("fs");

const layoutFile = "app/components/AppLayout.tsx";
let layout = fs.readFileSync(layoutFile, "utf8");

// Rechnungen in Verkauf einfügen
if (!layout.includes('{ label: "Rechnungen", to: "/rechnungen" }')) {
  layout = layout.replace(
    `{ label: "Angebote", to: "/angebote" },`,
    `{ label: "Angebote", to: "/angebote" },
      { label: "Rechnungen", to: "/rechnungen" },`
  );
}

fs.writeFileSync(layoutFile, layout, "utf8");

const routesFile = "app/routes.ts";
let routes = fs.readFileSync(routesFile, "utf8");

// Route einfügen
if (!routes.includes('route("rechnungen", "routes/rechnungen.tsx")')) {
  routes = routes.replace(
    `  route("angebote", "routes/angebote.tsx"),`,
    `  route("angebote", "routes/angebote.tsx"),
  route("rechnungen", "routes/rechnungen.tsx"),`
  );
}

fs.writeFileSync(routesFile, routes, "utf8");
