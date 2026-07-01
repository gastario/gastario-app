const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Felder entfernen, die im aktuellen Order-Model nicht existieren
text = text.replace(/\s*confidence:\s*"HIGH"\s+as\s+any,\r?\n/g, "");
text = text.replace(/\s*manualReviewReason:\s*"Manuell im Auftragseingang angelegt",\r?\n/g, "");

// Alte Einzelpositions-Variablen ersetzen durch mehrere Positionen
const oldItemVars = /    const itemName = String\(formData\.get\("itemName"\) \|\| ""\)\.trim\(\);\r?\n    const quantity = Number\(formData\.get\("quantity"\) \|\| 1\);\r?\n    const unit = String\(formData\.get\("unit"\) \|\| "[^"]*"\)\.trim\(\);\r?\n    const unit(?:Price)?Cents = euroToCents\(formData\.get\("unitPriceEuro"\)\);\r?\n    const notes = String\(formData\.get\("notes"\) \|\| ""\)\.trim\(\);/;

const newItemVars = `    const itemNames = formData.getAll("itemName").map((value) => String(value || "").trim());
    const quantities = formData.getAll("quantity").map((value) => Number(value || 1));
    const units = formData.getAll("unit").map((value) => String(value || "Stück").trim());
    const unitCentsList = formData.getAll("unitPriceEuro").map((value) => euroToCents(value));
    const itemNotes = formData.getAll("itemNotes").map((value) => String(value || "").trim());
    const notes = String(formData.get("notes") || "").trim();

    const items = itemNames
      .map((name, index) => {
        const quantity = Number.isFinite(quantities[index]) && quantities[index] > 0 ? quantities[index] : 1;
        const unitCents = unitCentsList[index] || 0;

        return {
          name,
          quantity,
          unit: units[index] || "Stück",
          unitCents,
          totalCents: unitCents * quantity,
          notes: itemNotes[index] || null,
        };
      })
      .filter((item) => item.name);`;

if (!oldItemVars.test(text)) {
  throw new Error("Konnte den alten Einzelpositions-Block nicht finden.");
}

text = text.replace(oldItemVars, newItemVars);

// Validierung: mindestens eine Position
text = text.replace(
  /    if \(!itemName\) \{\r?\n      return \{ error: "Position fehlt\." \};\r?\n    \}\r?\n/,
  `    if (items.length === 0) {
      return { error: "Mindestens eine Position fehlt." };
    }
`
);

// Alte einzelne orderItem.create ersetzen durch createMany
const oldCreateItem = /    await prisma\.orderItem\.create\(\{\r?\n      data: \{[\s\S]*?\r?\n      \} as any,\r?\n    \}\);\r?\n/;

const newCreateItem = `    await prisma.orderItem.createMany({
      data: items.map((item) => ({
        orderId: order.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitCents: item.unitCents,
        totalCents: item.totalCents,
        notes: item.notes,
      })),
    });
`;

if (!oldCreateItem.test(text)) {
  throw new Error("Konnte prisma.orderItem.create Block nicht finden.");
}

text = text.replace(oldCreateItem, newCreateItem);

// Alte Einzelpositions-Eingabe ersetzen durch Positionstabelle
const oldFormBlock = /          <div style=\{\{ display: "grid", gridTemplateColumns: "1fr 120px 120px 160px", gap: 12 \}\}>\r?\n            <input name="itemName" placeholder="Position, z\. B\. Bowl Menü" style=\{inputStyle\} \/>\r?\n            <input name="quantity" type="number" min="1" defaultValue="1" style=\{inputStyle\} \/>\r?\n            <input name="unit" defaultValue="Stück" style=\{inputStyle\} \/>\r?\n            <input name="unitPriceEuro" placeholder="Einzelpreis €" style=\{inputStyle\} \/>\r?\n          <\/div>/;

const newFormBlock = `          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: "#0f766e", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 11, fontWeight: 950 }}>
                  Positionen
                </div>
                <h3 style={{ margin: "4px 0 0", fontSize: 18, letterSpacing: "-0.03em" }}>
                  Speisen / Leistungen als Tabelle
                </h3>
              </div>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 750 }}>
                Bis zu 5 Positionen erfassen
              </div>
            </div>

            <div style={{
              border: "1px solid #dbe3ec",
              borderRadius: 16,
              overflow: "hidden",
              background: "#ffffff"
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "52px 1fr 110px 120px 150px",
                gap: 10,
                padding: "11px 12px",
                background: "#f8fafc",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: ".04em",
                fontSize: 11,
                fontWeight: 950
              }}>
                <div>Pos.</div>
                <div>Speise / Leistung</div>
                <div>Menge</div>
                <div>Einheit</div>
                <div>Einzelpreis</div>
              </div>

              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <div key={rowIndex} style={{
                  display: "grid",
                  gridTemplateColumns: "52px 1fr 110px 120px 150px",
                  gap: 10,
                  padding: "12px",
                  borderTop: "1px solid #e5edf5",
                  alignItems: "start"
                }}>
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: rowIndex === 0 ? "#0f766e" : "#eef3f7",
                    color: rowIndex === 0 ? "white" : "#64748b",
                    fontWeight: 950
                  }}>
                    {rowIndex + 1}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <input
                      name="itemName"
                      placeholder={rowIndex === 0 ? "z. B. Chicken Bowl" : "Weitere Position optional"}
                      style={inputStyle}
                    />

                    <details style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 12,
                      padding: "9px 11px",
                      background: "#f8fafc"
                    }}>
                      <summary style={{
                        cursor: "pointer",
                        color: "#0f766e",
                        fontWeight: 900,
                        fontSize: 13
                      }}>
                        + Freitext zu dieser Position
                      </summary>
                      <textarea
                        name="itemNotes"
                        placeholder="z. B. ohne Koriander, extra Sauce, separat verpacken"
                        rows={2}
                        style={{ ...inputStyle, marginTop: 9 }}
                      />
                    </details>
                  </div>

                  <input name="quantity" type="number" min="1" defaultValue={rowIndex === 0 ? "1" : ""} style={inputStyle} />
                  <input name="unit" defaultValue="Stück" style={inputStyle} />
                  <input name="unitPriceEuro" placeholder="0,00 €" style={inputStyle} />
                </div>
              ))}
            </div>
          </div>`;

if (!oldFormBlock.test(text)) {
  throw new Error("Konnte alten Positions-Formblock nicht finden.");
}

text = text.replace(oldFormBlock, newFormBlock);

// Summe und Positionsanzeige an neue Feldnamen anpassen
text = text.replaceAll("item.totalPriceCents", "item.totalCents");
text = text.replaceAll(" Ã— ", " × ");

// Notiz je Position in der Übersicht anzeigen
text = text.replace(
  /                            \{item\.quantity\} × \{item\.name\}\r?\n/,
  `                            {item.quantity} × {item.name}
                            {item.notes ? (
                              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
                                + {item.notes}
                              </div>
                            ) : null}
`
);

fs.writeFileSync(file, text, "utf8");
