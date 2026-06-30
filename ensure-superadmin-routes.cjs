const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes.ts");
let content = fs.readFileSync(file, "utf8");

function add(line) {
  if (content.includes(line)) return;
  content = content.replace("];", "  " + line + "\n];");
}

add('route("gastario-control/mandanten", "routes/gastario-control.mandanten.tsx"),');
add('route("gastario-control/features", "routes/gastario-control.features.tsx"),');
add('route("gastario-control/codes", "routes/gastario-control.codes.tsx"),');
add('route("gastario-control/mandanten/:tenantId", "routes/gastario-control.mandanten.$tenantId.tsx"),');

fs.writeFileSync(file, content, "utf8");
console.log("routes.ts geprüft/repariert");
