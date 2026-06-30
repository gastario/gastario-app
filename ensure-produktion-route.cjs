const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes.ts");
let content = fs.readFileSync(file, "utf8");

const line = 'route("produktion", "routes/produktion.tsx"),';

if (!content.includes(line)) {
  content = content.replace("];", "  " + line + "\n];");
}

fs.writeFileSync(file, content, "utf8");
console.log("Produktionsroute geprüft.");
