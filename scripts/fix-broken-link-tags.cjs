const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// Kaputte Mischform reparieren: <a ...> darf nicht mit </Link> schließen
content = content.replaceAll("</Link>", "</a>");

// Falls Link nur wegen dem kaputten Patch importiert wurde, wieder entfernen
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

// Den kaputten Styleblock können wir drin lassen, der Build-Fehler war JSX.
// Aber falls er doppelt stört, nicht anfassen.

fs.writeFileSync(path, content, "utf8");
console.log("Kaputte Link/a-Tags repariert.");
