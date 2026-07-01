const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) AppLayout importieren
if (!text.includes('import AppLayout from "../components/AppLayout";')) {
  text = text.replace(
    /^(import .*?;\r?\n)/,
    `$1import AppLayout from "../components/AppLayout";\n`
  );
}

// 2) positionRows um optional erweitern
text = text.replaceAll(
  `useState<Array<{ id: number; type: "item" | "text" }>>`,
  `useState<Array<{ id: number; type: "item" | "text" | "optional" }>>`
);

// 3) Server: itemKind optional erkennen
text = text.replace(
  `const kind = itemKinds[index] === "text" ? "text" : "item";`,
  `const kind = itemKinds[index] === "text" ? "text" : itemKinds[index] === "optional" ? "optional" : "item";`
);

text = text.replace(
  `kind === "text" ? "Freitext" : "",`,
  `kind === "text" ? "Freitext" : "",
          kind === "optional" ? "Optional" : "",`
);

// 4) Hidden itemKind in Artikelzeile: item oder optional speichern
text = text.replaceAll(
  `<input type="hidden" name="itemKind" value="item" />`,
  `<input type="hidden" name="itemKind" value={row.type === "optional" ? "optional" : "item"} />`
);

// 5) Optional optisch markieren
const articleLabelNeedle = `                        <div style={{ display: "grid", gap: 8 }}>
                          <label style={labelStyle}>
                            Artikel`;

const articleLabelReplacement = `                        <div style={{ display: "grid", gap: 8 }}>
                          {row.type === "optional" ? (
                            <div style={{
                              width: "fit-content",
                              border: "1px solid #fde68a",
                              background: "#fffbeb",
                              color: "#92400e",
                              borderRadius: 999,
                              padding: "4px 9px",
                              fontSize: 11,
                              fontWeight: 900
                            }}>
                              Optionale Position
                            </div>
                          ) : null}

                          <label style={labelStyle}>
                            Artikel`;

if (text.includes(articleLabelNeedle) && !text.includes("Optionale Position")) {
  text = text.replace(articleLabelNeedle, articleLabelReplacement);
}

// 6) Optional-Button bekommt echte Funktion
text = text.replace(
/<button type="button" style=\{\{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" \}\}>\s*◉ OPTIONAL\s*<\/button>/,
`<button
                    type="button"
                    onClick={() => setPositionRows((rows) => rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "optional" }])}
                    style={{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" }}
                  >
                    ◉ OPTIONAL
                  </button>`
);

// Falls OPTIONAL vorher entfernt wurde: nach + ARTIKEL einfügen
if (!text.includes(`type: "optional"`)) {
  text = text.replace(
    `                  </button>

                  <button type="button"`,
    `                  </button>

                  <button
                    type="button"
                    onClick={() => setPositionRows((rows) => rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "optional" }])}
                    style={{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" }}
                  >
                    ◉ OPTIONAL
                  </button>

                  <button type="button"`
  );
}

// 7) Gesamtrabatt in Liveberechnung einbauen
text = text.replace(
`    setLiveNetTotalCents(netTotalCents);
    setLiveTaxTotalCents(taxTotalCents);
    setLiveGrossTotalCents(grossTotalCents);`,
`    const discountInput = form.querySelector('input[name="globalDiscountPercent"]') as HTMLInputElement | null;
    const globalDiscountPercent = Number(String(discountInput?.value || "0").replace(",", "."));
    const safeGlobalDiscount = Number.isFinite(globalDiscountPercent) && globalDiscountPercent > 0
      ? Math.min(globalDiscountPercent, 100)
      : 0;

    if (safeGlobalDiscount > 0) {
      const factor = Math.max(0, 1 - safeGlobalDiscount / 100);
      netTotalCents = Math.round(netTotalCents * factor);
      taxTotalCents = Math.round(taxTotalCents * factor);
      grossTotalCents = Math.round(grossTotalCents * factor);
    }

    setLiveNetTotalCents(netTotalCents);
    setLiveTaxTotalCents(taxTotalCents);
    setLiveGrossTotalCents(grossTotalCents);`
);

// 8) Gesamtrabatt-Button durch echtes Feld ersetzen
text = text.replace(
/<button type="button" style=\{\{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" \}\}>\s*% GESAMTRABATT\s*<\/button>/,
`<label style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#333",
                    fontWeight: 850,
                    fontSize: 14
                  }}>
                    % Gesamtrabatt
                    <input
                      name="globalDiscountPercent"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue="0"
                      placeholder="0"
                      style={{
                        width: 72,
                        height: 34,
                        border: "1px solid #cfd8e3",
                        borderRadius: 3,
                        padding: "0 8px",
                        fontWeight: 800,
                        textAlign: "right"
                      }}
                    />
                  </label>`
);

// Falls nur Text übrig war, ersetzen
text = text.replaceAll("% GESAMTRABATT", "% Gesamtrabatt");

// 9) Produkt-anlegen aus Position vorerst entfernen
text = text.replace(
/\s*<button\s+type="button"\s+onClick=\{\(event\) => \{[\s\S]*?\}\}\s+style=\{\{[\s\S]*?\}\}\s*>\r?\n\s*\+ als Produkt speichern\r?\n\s*<\/button>/,
""
);

// Product Modal entfernen, falls vorhanden
text = text.replace(
/\r?\n\s*\{productDraft\.open \? \([\s\S]*?\) : null\}\r?\n\s*<\/section>/,
`
        </section>`
);

// productDraft-State entfernen, falls vorhanden
text = text.replace(
/  const \[productDraft, setProductDraft\] = useState<\{[\s\S]*?\}\>\(\{[\s\S]*?\}\);\r?\n\r?\n/,
""
);

// createProductFromPosition Action entfernen, falls vorhanden
text = text.replace(
/  if \(intent === "createProductFromPosition"\) \{[\s\S]*?  \}\r?\n\r?\n  if \(intent === "createOrder"\) \{/,
`  if (intent === "createOrder") {`
);

// 10) AppLayout um die Seite legen
const componentStart = text.indexOf("export default function AuftragseingangPage()");
const componentEnd = text.indexOf("export function ErrorBoundary", componentStart);
if (componentStart === -1 || componentEnd === -1) {
  throw new Error("Component-Grenzen nicht gefunden.");
}

let component = text.slice(componentStart, componentEnd);

if (!component.includes("<AppLayout>")) {
  component = component.replace(
    `  return (
    <div style={pageStyle}>`,
    `  return (
    <AppLayout>
      <div style={{ ...pageStyle, minHeight: "auto", padding: "0 0 40px", background: "transparent" }}>`
  );

  const lastClose = component.lastIndexOf(`    </div>
  );`);

  if (lastClose === -1) {
    throw new Error("Return-Ende nicht gefunden.");
  }

  component =
    component.slice(0, lastClose) +
    `      </div>
    </AppLayout>
  );` +
    component.slice(lastClose + `    </div>
  );`.length);

  text = text.slice(0, componentStart) + component + text.slice(componentEnd);
}

// 11) Header im AppLayout etwas weniger eigenständig
text = text.replaceAll(
  `background: "#f2f2f2",`,
  `background: "transparent",`
);

text = text.replaceAll(
  `padding: "28px 0 56px",`,
  `padding: "0 0 40px",`
);

fs.writeFileSync(file, text, "utf8");
