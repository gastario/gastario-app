const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

const anchor = `                  Positionen
                </div>
                <h3`;

const anchorIndex = text.indexOf(anchor);

if (anchorIndex === -1) {
  throw new Error("Positions-Anker nicht gefunden.");
}

const formStart = text.lastIndexOf(`          <div style={{ display: "grid", gap: 12 }}>`, anchorIndex);
const formEnd = text.indexOf(`          <textarea name="notes" placeholder="Notizen / Besonderheiten"`, anchorIndex);

if (formStart === -1 || formEnd === -1) {
  throw new Error("Positionsbereich konnte nicht sauber gefunden werden.");
}

const newBlock = `          <div style={{ display: "grid", gap: 10, maxWidth: 980, margin: "0 auto", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
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
              border: "1px solid #d6d6d6",
              borderRadius: 4,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)"
            }}>
              {positionRows.map((row, rowIndex) => (
                <div
                  key={row.id}
                  data-position-row={row.type}
                  style={{
                    display: "grid",
                    gridTemplateColumns: row.type === "text"
                      ? "32px minmax(0, 1fr) 28px"
                      : "32px minmax(280px, 1fr) 78px 96px 118px 76px 78px 94px 28px",
                    gap: 8,
                    alignItems: "center",
                    padding: "13px 14px",
                    borderTop: rowIndex === 0 ? "none" : "1px solid #e5e5e5",
                    background: "#ffffff"
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
                    color: "#555555",
                    fontSize: 12,
                    fontWeight: 800
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
                          style={{
                            ...inputStyle,
                            minHeight: 74,
                            borderRadius: 3,
                            resize: "vertical",
                            fontWeight: 500
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          setPositionRows((rows) => rows.filter((item) => item.id !== row.id))
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#777",
                          minHeight: 34,
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: 16
                        }}
                        title="Position löschen"
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
                            style={{ ...inputStyle, borderRadius: 3, fontWeight: 500 }}
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
                            style={{
                              ...inputStyle,
                              marginTop: 7,
                              minHeight: 72,
                              resize: "vertical",
                              borderRadius: 3,
                              fontWeight: 500
                            }}
                          />
                        </details>
                      </div>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Menge
                        <input name="quantity" type="number" min="1" defaultValue="1" style={{ ...inputStyle, borderRadius: 3 }} />
                      </label>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Einheit
                        <input name="unit" defaultValue="Stück" style={{ ...inputStyle, borderRadius: 3 }} />
                      </label>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        VK Netto
                        <input name="unitPriceEuro" placeholder="0,00 €" style={{ ...inputStyle, borderRadius: 3, textAlign: "right" }} />
                      </label>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Rabatt
                        <input name="discountPercent" type="number" min="0" defaultValue="0" style={{ ...inputStyle, borderRadius: 3, textAlign: "right" }} />
                      </label>

                      <label style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        MwSt
                        <select name="taxRate" defaultValue="19" style={{ ...inputStyle, borderRadius: 3 }}>
                          <option value="19">19 %</option>
                          <option value="7">7 %</option>
                          <option value="0">0 %</option>
                        </select>
                      </label>

                      <div style={{ display: "grid", gap: 4, color: "#777", fontSize: 11, fontWeight: 650 }}>
                        Netto
                        <div
                          data-line-total
                          style={{
                            minHeight: 34,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            color: "#111",
                            fontWeight: 800,
                            fontSize: 13
                          }}
                        >
                          0,00 €
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setPositionRows((rows) => rows.length > 1 ? rows.filter((item) => item.id !== row.id) : rows)
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#777",
                          minHeight: 34,
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: 16,
                          marginTop: 17
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
                padding: "14px 14px",
                borderTop: "1px solid #d6d6d6",
                background: "#ffffff"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() =>
                      setPositionRows((rows) =>
                        rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "item" }]
                      )
                    }
                    style={{
                      border: "1px solid #10a66a",
                      background: "#ffffff",
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
                      background: "#ffffff",
                      color: "#333",
                      borderRadius: 3,
                      padding: "8px 6px",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    ≡ FREITEXT
                  </button>

                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "#ffffff",
                      color: "#333",
                      borderRadius: 3,
                      padding: "8px 6px",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    ◉ OPTIONAL
                  </button>

                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "#ffffff",
                      color: "#333",
                      borderRadius: 3,
                      padding: "8px 6px",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    % GESAMTRABATT
                  </button>
                </div>

                <div style={{
                  minWidth: 330,
                  background: "#555",
                  color: "white",
                  padding: "10px 16px",
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

text = text.slice(0, formStart) + newBlock + text.slice(formEnd);

fs.writeFileSync(file, text, "utf8");
