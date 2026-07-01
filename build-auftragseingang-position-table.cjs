const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Felder entfernen, die im aktuellen Order-Model nicht existieren
text = text.replace(/\s*confidence:\s*"HIGH"\s+as\s+any,\r?\n/g, "");
text = text.replace(/\s*manualReviewReason:\s*"Manuell im Auftragseingang angelegt",\r?\n/g, "");

// Einzelposition-Variablen durch mehrere Positionen ersetzen
text = text.replace(
`    const itemName = String(formData.get("itemName") || "").trim();
    const quantity = Number(formData.get("quantity") || 1);
    const unit = String(formData.get("unit") || "Stück").trim();
    const unitCents = euroToCents(formData.get("unitPriceEuro"));
    const notes = String(formData.get("notes") || "").trim();`,
`    const itemNames = formData.getAll("itemName").map((value) => String(value || "").trim());
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
      .filter((item) => item.name);`
);

// Falls die Datei noch unitPriceCents heißt
text = text.replaceAll("unitPriceCents", "unitCents");
text = text.replaceAll("totalPriceCents", "totalCents");

// Validierung ersetzen
text = text.replace(
`    if (!itemName) {
      return { error: "Position fehlt." };
    }`,
`    if (items.length === 0) {
      return { error: "Mindestens eine Position fehlt." };
    }`
);

// Einzelnes orderItem.create durch createMany ersetzen
text = text.replace(
/    await prisma\.orderItem\.create\(\{\r?\n      data: \{[\s\S]*?\r?\n      \} as any,\r?\n    \}\);\r?\n/,
`    await prisma.orderItem.createMany({
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
`
);

// Formularblock ersetzen: alte Einzelpositions-Zeile raus, neue Tabelle rein
text = text.replace(
`          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 160px", gap: 12 }}>
            <input name="itemName" placeholder="Position, z. B. Bowl Menü" style={inputStyle} />
            <input name="quantity" type="number" min="1" defaultValue="1" style={inputStyle} />
            <input name="unit" defaultValue="Stück" style={inputStyle} />
            <input name="unitPriceEuro" placeholder="Einzelpreis €" style={inputStyle} />
          </div>`,
`          <div style={{ display: "grid", gap: 10 }}>
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

            <div style={{ border: "1px solid #dbe3ec", borderRadius: 16, overflow: "hidden", background: "#ffffff" }}>
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
          </div>`
);

// Übersicht: Summe und Freitext anzeigen
text = text.replaceAll("item.totalPriceCents", "item.totalCents");
text = text.replaceAll(" Ã— ", " × ");

text = text.replace(
`                            {item.quantity} × {item.name}
`,
`                            {item.quantity} × {item.name}
                            {item.notes ? (
                              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
                                + {item.notes}
                              </div>
                            ) : null}
`
);

fs.writeFileSync(file, text, "utf8");
