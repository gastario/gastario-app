const fs = require("fs");

const path = "app/lib/heycater-label-parser.server.ts";
let content = fs.readFileSync(path, "utf8");

const oldBlock = `  const unique = new Map<string, HeycaterLabelData>();

  for (const label of labels) {
    const key = [label.name, label.date, label.meal].join("|").toLowerCase();

    if (!unique.has(key)) {
      unique.set(key, label);
    }
  }

  return Array.from(unique.values());
}`;

const newBlock = `  // Wichtig: Foodlabels duerfen NICHT dedupliziert werden.
  // Wenn Heycater 115 Etiketten liefert, muessen auch 115 Etiketten erzeugt werden.
  return labels;
}`;

if (!content.includes(oldBlock)) {
  throw new Error("Deduplizierungs-Block nicht gefunden.");
}

content = content.replace(oldBlock, newBlock);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Label Parser: Deduplizierung entfernt.");
