const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// useState import ergänzen
if (!text.includes('useState')) {
  text = 'import { useState } from "react";\n' + text;
}

// State im Component ergänzen
text = text.replace(
  '  const actionData = useActionData<typeof action>();',
  `  const actionData = useActionData<typeof action>();
  const [positionRows, setPositionRows] = useState<number[]>([Date.now()]);`
);

// Text ändern
text = text.replaceAll("Bis zu 5 Positionen erfassen", "Positionen flexibel erfassen");

// 5 feste Zeilen ersetzen durch dynamische Zeilen
text = text.replace(
  "{Array.from({ length: 5 }).map((_, rowIndex) => (",
  "{positionRows.map((rowId, rowIndex) => ("
);

text = text.replace(
  "<div key={rowIndex} style={{",
  "<div key={rowId} style={{"
);

// Freitext-Feld größer machen
text = text.replaceAll(
  'rows={2}',
  'rows={4}'
);

text = text.replaceAll(
  'style={{ ...inputStyle, marginTop: 9 }}',
  'style={{ ...inputStyle, marginTop: 9, width: "100%", minHeight: 96, resize: "vertical" }}'
);

// Buttonbereich nach der Positionen-Map einfügen
const oldEnd = `              ))}
            </div>
          </div>`;

const newEnd = `              ))}

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
                        rows.length >= 50 ? rows : [...rows, Date.now() + Math.random()]
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
                    + Position hinzufügen
                  </button>

                  {positionRows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPositionRows((rows) => rows.length > 1 ? rows.slice(0, -1) : rows)
                      }
                      style={{
                        border: "1px solid #fecaca",
                        background: "#fff1f2",
                        color: "#991b1b",
                        borderRadius: 999,
                        padding: "10px 14px",
                        fontWeight: 950,
                        cursor: "pointer"
                      }}
                    >
                      Letzte Position entfernen
                    </button>
                  ) : null}
                </div>

                <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                  {positionRows.length} / 50 Positionen
                </div>
              </div>
            </div>
          </div>`;

if (!text.includes(oldEnd)) {
  throw new Error("Konnte Ende der Positionstabelle nicht finden.");
}

text = text.replace(oldEnd, newEnd);

fs.writeFileSync(file, text, "utf8");
