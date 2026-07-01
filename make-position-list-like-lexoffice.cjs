const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

/**
 * 1) State von number[] auf echte Positionszeilen umbauen
 */
text = text.replace(
  `  const [positionRows, setPositionRows] = useState<number[]>([Date.now()]);`,
  `  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);`
);

/**
 * 2) Server-Action: mehrere Positionen inkl. Rabatt, MwSt und Freitext lesen
 */
const oldActionBlock = `    const itemNames = formData.getAll("itemName").map((value) => String(value || "").trim());
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

const newActionBlock = `    const itemKinds = formData.getAll("itemKind").map((value) => String(value || "item"));
    const itemNames = formData.getAll("itemName").map((value) => String(value || "").trim());
    const quantities = formData.getAll("quantity").map((value) => Number(value || 1));
    const units = formData.getAll("unit").map((value) => String(value || "Stück").trim());
    const unitCentsList = formData.getAll("unitPriceEuro").map((value) => euroToCents(value));
    const discountPercents = formData.getAll("discountPercent").map((value) => Number(String(value || "0").replace(",", ".")));
    const taxRates = formData.getAll("taxRate").map((value) => Number(value || 19));
    const itemNotes = formData.getAll("itemNotes").map((value) => String(value || "").trim());
    const notes = String(formData.get("notes") || "").trim();

    const items = itemNames
      .map((name, index) => {
        const kind = itemKinds[index] === "text" ? "text" : "item";
        const quantity = kind === "text" ? 1 : Number.isFinite(quantities[index]) && quantities[index] > 0 ? quantities[index] : 1;
        const unitCents = kind === "text" ? 0 : unitCentsList[index] || 0;
        const discountPercent = Number.isFinite(discountPercents[index]) ? Math.max(0, discountPercents[index]) : 0;
        const taxRate = Number.isFinite(taxRates[index]) ? taxRates[index] : 19;
        const netBeforeDiscount = unitCents * quantity;
        const discountCents = Math.round(netBeforeDiscount * (discountPercent / 100));
        const totalCents = Math.max(0, netBeforeDiscount - discountCents);

        const metaNotes = [
          itemNotes[index] || "",
          kind === "text" ? "Freitext" : "",
          kind === "item" ? "MwSt " + taxRate + "%" : "",
          kind === "item" && discountPercent > 0 ? "Rabatt " + discountPercent + "%" : "",
        ].filter(Boolean).join(" | ");

        return {
          name,
          quantity,
          unit: kind === "text" ? "Text" : units[index] || "Stück",
          unitCents,
          totalCents,
          notes: metaNotes || null,
        };
      })
      .filter((item) => item.name);`;

if (!text.includes(oldActionBlock)) {
  throw new Error("Action-Block für Positionen wurde nicht gefunden.");
}

text = text.replace(oldActionBlock, newActionBlock);

/**
 * 3) Alten Tabellenblock durch Lexoffice-ähnliche Positionsliste ersetzen
 */
const formStart = text.indexOf(`          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: "#0f766e", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 11, fontWeight: 950 }}>
                  Positionen`);
const formEnd = text.indexOf(`          <textarea name="notes" placeholder="Notizen / Besonderheiten" rows={3} style={inputStyle} />`, formStart);

if (formStart === -1 || formEnd === -1) {
  throw new Error("Positionsformular-Block wurde nicht gefunden.");
}

const newFormBlock = `          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: "#0f766e", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 11, fontWeight: 950 }}>
                  Positionen
                </div>
                <h3 style={{ margin: "4px 0 0", fontSize: 18, letterSpacing: "-0.03em" }}>
                  Artikel, Freitext, Rabatt und MwSt
                </h3>
              </div>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 750 }}>
                {positionRows.length} / 50 Positionen
              </div>
            </div>

            <div style={{
              border: "1px solid #dbe3ec",
              borderRadius: 18,
              background: "#ffffff",
              overflow: "hidden"
            }}>
              {positionRows.map((row, rowIndex) => (
                <div key={row.id} style={{
                  display: "grid",
                  gridTemplateColumns: row.type === "text"
                    ? "46px 1fr 42px"
                    : "46px minmax(220px, 1fr) 90px 110px 135px 95px 105px 110px 42px",
                  gap: 8,
                  alignItems: "start",
                  padding: "14px 12px",
                  borderTop: rowIndex === 0 ? "none" : "1px solid #e5edf5",
                  background: row.type === "text" ? "#fbfdff" : "#ffffff"
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#eef3f7",
                    color: "#64748b",
                    fontWeight: 950
                  }}>
                    {rowIndex + 1}
                  </div>

                  {row.type === "text" ? (
                    <>
                      <input type="hidden" name="itemKind" value="text" />
                      <input type="hidden" name="quantity" value="1" />
                      <input type="hidden" name="unit" value="Text" />
                      <input type="hidden" name="unitPriceEuro" value="0" />
                      <input type="hidden" name="discountPercent" value="0" />
                      <input type="hidden" name="taxRate" value="0" />
                      <input type="hidden" name="itemNotes" value="" />

                      <textarea
                        name="itemName"
                        placeholder="Freitext, z. B. Aufbauhinweis, Sonderwunsch, interne Info"
                        rows={4}
                        style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setPositionRows((rows) => rows.filter((item) => item.id !== row.id))
                        }
                        style={{
                          border: "none",
                          background: "#fff1f2",
                          color: "#991b1b",
                          borderRadius: 10,
                          minHeight: 40,
                          cursor: "pointer",
                          fontWeight: 950
                        }}
                        title="Position löschen"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="itemKind" value="item" />

                      <div style={{ display: "grid", gap: 8 }}>
                        <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 12, fontWeight: 850 }}>
                          Artikel / Leistung
                          <input name="itemName" placeholder="Bezeichnung des Artikels" style={inputStyle} />
                        </label>

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
                            rows={4}
                            style={{ ...inputStyle, marginTop: 9, width: "100%", minHeight: 110, resize: "vertical" }}
                          />
                        </details>
                      </div>

                      <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 12, fontWeight: 850 }}>
                        Menge
                        <input name="quantity" type="number" min="1" defaultValue="1" style={inputStyle} />
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 12, fontWeight: 850 }}>
                        Einheit
                        <input name="unit" defaultValue="Stück" style={inputStyle} />
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 12, fontWeight: 850 }}>
                        VK Netto
                        <input name="unitPriceEuro" placeholder="0,00 €" style={inputStyle} />
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 12, fontWeight: 850 }}>
                        Rabatt
                        <input name="discountPercent" type="number" min="0" defaultValue="0" style={inputStyle} />
                      </label>

                      <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 12, fontWeight: 850 }}>
                        MwSt
                        <select name="taxRate" defaultValue="19" style={inputStyle}>
                          <option value="19">19 %</option>
                          <option value="7">7 %</option>
                          <option value="0">0 %</option>
                        </select>
                      </label>

                      <div style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 12, fontWeight: 850 }}>
                        Gesamt
                        <div style={{
                          minHeight: 42,
                          borderRadius: 12,
                          background: "#f8fafc",
                          border: "1px solid #dbe3ec",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          padding: "0 12px",
                          color: "#07111f",
                          fontWeight: 950
                        }}>
                          wird berechnet
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setPositionRows((rows) => rows.length > 1 ? rows.filter((item) => item.id !== row.id) : rows)
                        }
                        style={{
                          border: "none",
                          background: "#fff1f2",
                          color: "#991b1b",
                          borderRadius: 10,
                          minHeight: 40,
                          marginTop: 22,
                          cursor: "pointer",
                          fontWeight: 950
                        }}
                        title="Position löschen"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              ))}

              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 12px",
                borderTop: "1px solid #e5edf5",
                background: "#f8fafc"
              }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() =>
                      setPositionRows((rows) =>
                        rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "item" }]
                      )
                    }
                    style={{
                      border: "1px solid #0f766e",
                      background: "#ecfdf5",
                      color: "#0f766e",
                      borderRadius: 999,
                      padding: "10px 14px",
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    + Artikel
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPositionRows((rows) =>
                        rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "text" }]
                      )
                    }
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#334155",
                      borderRadius: 999,
                      padding: "10px 14px",
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    + Freitext
                  </button>

                  <button
                    type="button"
                    disabled
                    style={{
                      border: "1px solid #e5e7eb",
                      background: "#f3f4f6",
                      color: "#9ca3af",
                      borderRadius: 999,
                      padding: "10px 14px",
                      fontWeight: 950,
                      cursor: "not-allowed"
                    }}
                  >
                    Optional später
                  </button>

                  <button
                    type="button"
                    disabled
                    style={{
                      border: "1px solid #e5e7eb",
                      background: "#f3f4f6",
                      color: "#9ca3af",
                      borderRadius: 999,
                      padding: "10px 14px",
                      fontWeight: 950,
                      cursor: "not-allowed"
                    }}
                  >
                    % Gesamtrabatt später
                  </button>
                </div>

                <div style={{
                  minWidth: 210,
                  borderRadius: 12,
                  background: "#07111f",
                  color: "white",
                  padding: "10px 14px",
                  fontWeight: 950,
                  textAlign: "right"
                }}>
                  Summe wird nach Speichern berechnet
                </div>
              </div>
            </div>
          </div>

`;

text = text.slice(0, formStart) + newFormBlock + text.slice(formEnd);

fs.writeFileSync(file, text, "utf8");
