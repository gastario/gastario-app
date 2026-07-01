const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// Datum wieder mit echter Auswahl
text = text.replace(
`<input
              name="deliveryDate"
              type="text"
              inputMode="numeric"
              placeholder="Datum, z. B. 01.07.2026"
              style={{ ...inputStyle, borderRadius: 3 }}
            />`,
`<input
              name="deliveryDate"
              type="date"
              style={{ ...inputStyle, borderRadius: 3 }}
            />`
);

// Positionsbereich sauber ersetzen
const startNeedle = `          <div style={{ display: "grid", gap: 10, width: "100%" }}>`;
const start = text.indexOf(startNeedle);

const endNeedle = `          <textarea name="notes" placeholder="Notizen / Besonderheiten" rows={3}`;
const end = text.indexOf(endNeedle, start);

if (start === -1 || end === -1) {
  throw new Error("Positionsbereich nicht gefunden.");
}

const cleanBlock = `          <div style={{ display: "grid", gap: 10, width: "100%", marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#0f766e", textTransform: "uppercase", letterSpacing: ".08em", fontSize: 11, fontWeight: 950 }}>
                  Positionen
                </div>
                <h3 style={{ margin: "3px 0 0", fontSize: 18, letterSpacing: "-0.03em" }}>
                  Artikel
                </h3>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 750 }}>
                {positionRows.length} / 50 Positionen
              </div>
            </div>

            <div style={{
              border: "1px solid #cfcfcf",
              borderRadius: 4,
              background: "#fff",
              overflow: "hidden"
            }}>
              {positionRows.map((row, rowIndex) => (
                <div
                  key={row.id}
                  data-position-row={row.type}
                  style={{
                    display: "grid",
                    gridTemplateColumns: row.type === "text"
                      ? "34px minmax(0, 1fr) 32px"
                      : "34px minmax(360px, 1fr) 78px 108px 126px 82px 150px 30px",
                    gap: 8,
                    alignItems: "start",
                    padding: "14px 14px",
                    borderTop: rowIndex === 0 ? "none" : "1px solid #e5e5e5",
                    background: "#fff"
                  }}
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#eeeeee",
                    color: "#555",
                    fontSize: 12,
                    fontWeight: 800,
                    marginTop: 23
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

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Freitext
                        <textarea
                          name="itemName"
                          placeholder="Freitext eingeben"
                          rows={3}
                          style={{ ...inputStyle, borderRadius: 3, minHeight: 82, resize: "vertical", fontWeight: 500 }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setPositionRows((rows) => rows.filter((item) => item.id !== row.id))}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#777",
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: 16,
                          marginTop: 26
                        }}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="itemKind" value="item" />

                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                          Artikel
                          <input
                            name="itemName"
                            placeholder="Bezeichnung des Artikels"
                            style={{ ...inputStyle, borderRadius: 3, minHeight: 42, fontWeight: 500 }}
                          />
                        </label>

                        <details>
                          <summary style={{
                            cursor: "pointer",
                            color: "#333",
                            fontSize: 12,
                            fontWeight: 700,
                            listStyle: "none"
                          }}>
                            ≡ FREITEXT zu dieser Position
                          </summary>
                          <textarea
                            name="itemNotes"
                            placeholder="z. B. ohne Koriander, extra Sauce, separat verpacken"
                            rows={3}
                            style={{ ...inputStyle, marginTop: 7, minHeight: 76, resize: "vertical", borderRadius: 3 }}
                          />
                        </details>
                      </div>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Menge
                        <input name="quantity" type="number" min="1" defaultValue="1" style={{ ...inputStyle, borderRadius: 3, minHeight: 42 }} />
                      </label>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Einheit
                        <input name="unit" defaultValue="Stück" style={{ ...inputStyle, borderRadius: 3, minHeight: 42 }} />
                      </label>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        VK Netto
                        <input name="unitPriceEuro" placeholder="0,00 €" style={{ ...inputStyle, borderRadius: 3, minHeight: 42, textAlign: "right" }} />
                      </label>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Rabatt
                        <input name="discountPercent" type="number" min="0" defaultValue="0" style={{ ...inputStyle, borderRadius: 3, minHeight: 42, textAlign: "right" }} />
                      </label>

                      <div style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Gesamt
                        <div
                          data-line-total
                          style={{
                            minHeight: 22,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            color: "#111",
                            fontWeight: 900,
                            fontSize: 14
                          }}
                        >
                          0,00 €
                        </div>
                        <select
                          name="taxRate"
                          defaultValue="19"
                          style={{
                            minHeight: 26,
                            border: "none",
                            borderRadius: 999,
                            background: "#444",
                            color: "white",
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "2px 8px",
                            cursor: "pointer"
                          }}
                        >
                          <option value="19">USt 19 %</option>
                          <option value="7">USt 7 %</option>
                          <option value="0">USt 0 %</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPositionRows((rows) => rows.length > 1 ? rows.filter((item) => item.id !== row.id) : rows)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#777",
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: 16,
                          marginTop: 25
                        }}
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
                gap: 14,
                padding: "14px 14px",
                borderTop: "1px solid #d6d6d6",
                background: "#fff"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() =>
                      setPositionRows((rows) =>
                        rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "item" }]
                      )
                    }
                    style={{
                      border: "1px solid #10a66a",
                      background: "#fff",
                      color: "#10a66a",
                      borderRadius: 3,
                      padding: "8px 13px",
                      fontWeight: 900,
                      cursor: "pointer"
                    }}
                  >
                    + ARTIKEL
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPositionRows((rows) =>
                        rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "text" }]
                      )
                    }
                    style={{
                      border: "none",
                      background: "#fff",
                      color: "#333",
                      padding: "8px 6px",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    ≡ FREITEXT
                  </button>

                  <button type="button" style={{ border: "none", background: "#fff", color: "#333", padding: "8px 6px", fontWeight: 800, cursor: "pointer" }}>
                    ◉ OPTIONAL
                  </button>

                  <button type="button" style={{ border: "none", background: "#fff", color: "#333", padding: "8px 6px", fontWeight: 800, cursor: "pointer" }}>
                    % GESAMTRABATT
                  </button>
                </div>

                <div style={{
                  minWidth: 390,
                  background: "#555",
                  color: "white",
                  padding: "11px 16px",
                  fontWeight: 750,
                  textAlign: "center",
                  fontSize: 13
                }}>
                  Netto {formatEuroCents(liveNetTotalCents)} · MwSt {formatEuroCents(liveTaxTotalCents)} · Gesamt {formatEuroCents(liveGrossTotalCents)}
                </div>
              </div>
            </div>
          </div>

`;

text = text.slice(0, start) + cleanBlock + text.slice(end);

fs.writeFileSync(file, text, "utf8");
