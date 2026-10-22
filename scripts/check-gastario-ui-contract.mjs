import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routesDir = path.join(root, "app", "routes");
const baselinePath = path.join(root, "scripts", "gastario-ui-baseline.json");

const writeBaseline = process.argv.includes("--write-baseline");

const excluded = [
  /\.backup(?:-|\.|$)/i,
  /\.print\./i,
  /\.pdf\.tsx$/i,
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(full);
    }

    return full.endsWith(".tsx") ? [full] : [];
  });
}

function normalize(value) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function isExcluded(file) {
  const rel = relative(file);

  return excluded.some((pattern) => pattern.test(rel));
}

const violations = [];

for (const file of walk(routesDir)) {
  if (isExcluded(file)) continue;

  const rel = relative(file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (/\bstyle\s*=/.test(line)) {
      violations.push({
        type: "inline-style",
        file: rel,
        line: index + 1,
        snippet: normalize(trimmed),
      });
    }

    if (/<style(?:\s|>)/.test(line)) {
      violations.push({
        type: "route-style-block",
        file: rel,
        line: index + 1,
        snippet: normalize(trimmed),
      });
    }

    const classMatch = line.match(/className\s*=\s*["'`]([^"'`]+)["'`]/);

    if (classMatch) {
      const classes = classMatch[1].split(/\s+/);

      const localUiClass = classes.find((className) => {
        if (className.startsWith("g-ui-")) return false;

        return /(?:button|card)/i.test(className);
      });

      if (localUiClass) {
        violations.push({
          type: "local-ui-class",
          file: rel,
          line: index + 1,
          snippet: normalize(trimmed),
        });
      }
    }
  });
}

function countViolations(items) {
  const counts = {};

  for (const item of items) {
    const key = [
      item.type,
      item.file,
      item.snippet,
    ].join("|");

    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
}

const currentCounts = countViolations(violations);

if (writeBaseline) {
  fs.writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        counts: currentCounts,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    `Gastario UI baseline gespeichert: ${violations.length} bestehende Altstellen.`
  );

  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error(
    "Keine Gastario UI baseline vorhanden. Erst mit --write-baseline erzeugen."
  );

  process.exitCode = 1;
}
else {
  const baseline = JSON.parse(
    fs.readFileSync(baselinePath, "utf8")
  );

  const baselineCounts = baseline.counts || {};
  const newViolations = [];

  for (const item of violations) {
    const key = [
      item.type,
      item.file,
      item.snippet,
    ].join("|");

    const current = currentCounts[key] || 0;
    const allowed = baselineCounts[key] || 0;

    if (current > allowed) {
      const alreadyAdded = newViolations.filter(
        (entry) =>
          entry.type === item.type &&
          entry.file === item.file &&
          entry.snippet === item.snippet
      ).length;

      if (alreadyAdded < current - allowed) {
        newViolations.push(item);
      }
    }
  }

  if (newViolations.length === 0) {
    console.log("✓ Gastario UI Contract sauber.");
    console.log("  Keine neuen lokalen Design-Abweichungen gefunden.");
  }
  else {
    console.error("");
    console.error("✗ Gastario UI Contract verletzt.");
    console.error("");
    console.error(
      "Neue App-UI muss aus ../components/ui gebaut werden."
    );
    console.error("");

    for (const item of newViolations) {
      console.error(
        `  ${item.file}:${item.line}`
      );
      console.error(
        `  ${item.type}: ${item.snippet}`
      );
      console.error("");
    }

    console.error(
      "Erlaubt: GastarioUI-Komponenten und zentrale g-ui-* Styles."
    );
    console.error(
      "Nicht erlaubt: neue Inline-Styles, lokale <style>-Blöcke oder eigene Button/Card-Designs."
    );

    process.exitCode = 1;
  }
}