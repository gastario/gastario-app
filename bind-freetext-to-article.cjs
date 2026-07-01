const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Artikel-Feld durch Artikel + angebundenen Freitext ersetzen
const oldArticleField = `                        <label style={labelStyle}>
                          Artikel
                          <input
                            name="itemName"
                            placeholder="Bezeichnung des Artikels"
                            style={{ ...inputStyle, minHeight: 46 }}
                          />
                        </label>`;

const newArticleField = `                        <div style={{ display: "grid", gap: 8 }}>
                          <label style={labelStyle}>
                            Artikel
                            <input
                              name="itemName"
                              placeholder="Bezeichnung des Artikels"
                              style={{ ...inputStyle, minHeight: 46 }}
                            />
                          </label>

                          <details>
                            <summary style={{
                              cursor: "pointer",
                              color: "#333",
                              fontSize: 12,
                              fontWeight: 800,
                              listStyle: "none"
                            }}>
                              ≡ Freitext zu dieser Position
                            </summary>
                            <textarea
                              name="itemNotes"
                              placeholder="z. B. ohne Koriander, extra Sauce, separat verpacken"
                              rows={3}
                              style={{
                                ...inputStyle,
                                marginTop: 8,
                                minHeight: 76,
                                resize: "vertical",
                                paddingTop: 10,
                                fontWeight: 500
                              }}
                            />
                          </details>
                        </div>`;

if (!text.includes(oldArticleField)) {
  throw new Error("Artikel-Feld wurde nicht gefunden.");
}

text = text.replace(oldArticleField, newArticleField);

// 2) Der + FREITEXT Button soll keine eigene Zeile mehr erzeugen
const freetextButtonRegex = /<button\s+type="button"\s+onClick=\{\(\) => setPositionRows\(\(rows\) => rows\.length >= 50 \? rows : \[\.\.\.rows, \{ id: Date\.now\(\) \+ Math\.random\(\), type: "text" \}\]\)\}\s+style=\{\{ border: "none", background: "#ffffff", color: "#333", padding: "8px 6px", fontWeight: 850, cursor: "pointer" \}\}\s+>\s*≡ FREITEXT\s*<\/button>/;

const disabledFreetextButton = `<span style={{
                    color: "#666",
                    padding: "8px 6px",
                    fontWeight: 850,
                    fontSize: 14
                  }}>
                    ≡ Freitext direkt unter Artikel
                  </span>`;

if (freetextButtonRegex.test(text)) {
  text = text.replace(freetextButtonRegex, disabledFreetextButton);
} else {
  text = text.replace(
    `                    ≡ FREITEXT`,
    `                    ≡ Freitext direkt unter Artikel`
  );
}

// 3) Falls alte separate Freitext-Zeilen doch noch entstehen, Überschrift entschärfen
text = text.replaceAll("Titel optional", "Freitext");
text = text.replaceAll("z. B. Zusatzhinweis", "Freitext zur Position");
text = text.replaceAll("Text optional", "Details / Hinweise");

// 4) Positionszählung zählt Freitext-Zeilen nicht mehr optisch falsch: Text bleibt möglich, aber Button erzeugt sie nicht mehr
fs.writeFileSync(file, text, "utf8");
