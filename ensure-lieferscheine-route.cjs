const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes.ts");
let content = fs.readFileSync(file, "utf8");

const line1 = 'route("lieferscheine", "routes/lieferscheine.tsx"),';
const line2 = 'route("fahrerzettel", "routes/lieferscheine.tsx"),';

if (!content.includes(line1)) {
  content = content.replace("];", "  " + line1 + "\n];");
}

if (!content.includes(line2)) {
  content = content.replace("];", "  " + line2 + "\n];");
}

fs.writeFileSync(file, content, "utf8");
console.log("Lieferschein- und Fahrerzettelroute geprüft.");
