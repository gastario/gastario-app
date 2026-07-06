const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// Alle React-Router-Link-Tags in dieser Datei zurück auf normale a-Tags
content = content.replaceAll("<Link to=", "<a href=");
content = content.replaceAll("</Link>", "</a>");

// Falls irgendwo noch kaputte Mischformen sind
content = content.replaceAll("</Link>", "</a>");

// Link aus react-router Import entfernen
content = content.replace(
  /import\s*\{([^}]+)\}\s*from\s*"react-router";/,
  (match, imports) => {
    const cleaned = imports
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && part !== "Link")
      .join(", ");

    return `import { ${cleaned} } from "react-router";`;
  }
);

fs.writeFileSync(path, content, "utf8");
console.log("Alle Link-Tags im Auftragseingang auf a-Tags repariert.");
