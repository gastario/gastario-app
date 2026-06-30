const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes.ts");

let content = fs.readFileSync(file, "utf8");

function addRoute(line, anchor) {
  if (content.includes(line)) return;

  if (content.includes(anchor)) {
    content = content.replace(anchor, anchor + "\n  " + line);
  } else {
    content = content.replace("];", "  " + line + "\n];");
  }
}

addRoute('route("gastario-control/features", "routes/gastario-control.features.tsx"),', 'route("gastario-control/pakete", "routes/gastario-control.pakete.tsx"),');
addRoute('route("gastario-control/codes", "routes/gastario-control.codes.tsx"),', 'route("gastario-control/features", "routes/gastario-control.features.tsx"),');
addRoute('route("gastario-control/mandanten/:tenantId", "routes/gastario-control.mandanten.$tenantId.tsx"),', 'route("gastario-control/mandanten", "routes/gastario-control.mandanten.tsx"),');

fs.writeFileSync(file, content, "utf8");

console.log("routes.ts wurde repariert.");
