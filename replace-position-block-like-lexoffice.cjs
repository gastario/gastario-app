const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

const startNeedle = `            <div style={{ display: "grid", gap: 10 }}>`;
const start = text.indexOf(startNeedle);

const endNeedle = `            <textarea
              name="notes"`;
const end = text.indexOf(endNeedle, start);

if (start === -1 || end === -1) {
  throw new Error("Positionsblock konnte nicht gefunden werden.");
}

const block = String.raw`            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <div>
                  <div style={sectionLabelStyle}>Positionen</div>
                  <h3 style={{ margin: "4px 0 0", fontSize: 20, letterSpacing: "-0.03em" }}>
                    Artikel
                  </h3>
                </div>

                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 750 }}>
                  {positionRows.length} / 50 Positionen
                </div>
              </div>

              <div style={{
                border: "1px solid #d2d2d2",
                borderRadius: 4,
                background: "#ffffff",
                overflow: "hidden"
              }}>
                {positionRows.map((row, rowIndex) => (
                  <div
                    key={row.id}
                    data-position-row={row.type}
                    style={{
                      display: "grid",
                      gridTemplateColumns: row.type === "text"
                        ? "42px minmax(0, 1fr) 40px"
                        : "42px minmax(320px, 1fr) 86px 118px 138px 92px 150px 38px",
                      gap: 10,
                      alignItems: "start",
                      padding: row.type === "text" ? "18px 18px 20px" : "15px 18px",
                      borderTop: rowIndex === 0 ? "none" : "1px solid #e5e5e5",
                      background: "#ffffff"
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: "#eeeeee",
                      color: "#555",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 850,
                      marginTop: row.type === "text" ? 24 : 26
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

                        <div style={{ display: "grid", gap: 10 }}>
                          <label style={labelStyle}>
                            Titel optional
                            <input
                              name="itemName"
                              placeholder="z. B. Zusatzhinweis"
                              style={{ ...inputStyle, minHeight: 46 }}
                            />
                          </label>

                          <textarea
                            name="itemNotes"
                            placeholder="Text optional"
                            rows={3}
                            style={{
                              ...inputStyle,
                              minHeight: 72,
                              resize: "vertical",
                              paddingTop: 12,
                              fontWeight: 500
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setPositionRows((rows) => rows.filter((item) => item.id !== row.id))}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#777",
                            cursor: "pointer",
                            fontWeight: 950,
                            fontSize: 18,
                            marginTop: 32
                          }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="itemKind" value="item" />

                        <label style={labelStyle}>
                          Artikel
                          <input
                            name="itemName"
                            placeholder="Bezeichnung des Artikels"
                            style={{ ...inputStyle, minHeight: 46 }}
                          />
                        </label>

                        <label style={labelStyle}>
                          Menge
                          <input
                            name="quantity"
                            type="number"
                            min="1"
                            defaultValue="1"
                            style={{ ...inputStyle, minHeight: 46, textAlign: "right" }}
                          />
                        </label>

                        <label style={labelStyle}>
                          Einheit
                          <input
                            name="unit"
                            defaultValue="Stück"
                            style={{ ...inputStyle, minHeight: 46 }}
                          />
                        </label>

                        <label style={labelStyle}>
                          VK Netto
                          <input
                            name="unitPriceEuro"
                            placeholder="0,00 €"
                            style={{ ...inputStyle, minHeight: 46, textAlign: "right" }}
                          />
                        </label>

                        <label style={labelStyle}>
                          Rabatt
                          <input
                            name="discountPercent"
                            type="number"
                            min="0"
                            defaultValue="0"
                            style={{ ...inputStyle, minHeight: 46, textAlign: "right" }}
                          />
                        </label>

                        <div style={{ display: "grid", gap: 7, justifyItems: "end" }}>
                          <div style={{ color: "#555", fontSize: 12, fontWeight: 750, height: 17 }}>
                            Gesamt
                          </div>

                          <div
                            data-line-total
                            style={{
                              minHeight: 22,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              color: "#111",
                              fontWeight: 950,
                              fontSize: 16,
                              lineHeight: 1
                            }}
                          >
                            0,00 €
                          </div>

                          <select
                            name="taxRate"
                            defaultValue="19"
                            style={{
                              height: 28,
                              width: 112,
                              border: "none",
                              borderRadius: 999,
                              background: "#444",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 850,
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
                            fontWeight: 950,
                            fontSize: 18,
                            marginTop: 30
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
                  justifyContent: "center",
                  gap: 24,
                  padding: "18px 18px 22px",
                  borderTop: "1px solid #d2d2d2",
                  background: "#ffffff"
                }}>
                  <button
                    type="button"
                    onClick={() => setPositionRows((rows) => rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "item" }])}
                    style={{
                      border: "1px solid #10a66a",
                      background: "#ffffff",
                      color: "#10a66a",
                      borderRadius: 3,
                      padding: "8px 14px",
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    + ARTIKEL
                  </button>

                  <button
                    type="button"
                    onClick={() => setPositionRows((rows) => rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "text" }])}
                    style={{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" }}
                  >
                    ≡ FREITEXT
                  </button>

                  <button type="button" style={{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" }}>
                    ◉ OPTIONAL
                  </button>

                  <button type="button" style={{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" }}>
                    % GESAMTRABATT
                  </button>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 180px 180px",
                  minHeight: 74,
                  background: "#5a5a5a",
                  color: "#ffffff"
                }}>
                  <div></div>

                  <div style={{
                    display: "grid",
                    alignContent: "center",
                    justifyItems: "center",
                    borderLeft: "1px solid rgba(255,255,255,0.12)"
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 750 }}>Summe Netto</div>
                    <div style={{ fontSize: 26, fontWeight: 500 }}>
                      {formatEuroCents(liveNetTotalCents)}
                    </div>
                  </div>

                  <div style={{
                    display: "grid",
                    alignContent: "center",
                    justifyItems: "center",
                    background: "#444"
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 750 }}>Gesamtbetrag</div>
                    <div style={{ fontSize: 26, fontWeight: 800 }}>
                      {formatEuroCents(liveGrossTotalCents)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

`;

text = text.slice(0, start) + block + text.slice(end);

fs.writeFileSync(file, text, "utf8");
