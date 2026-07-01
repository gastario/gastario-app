const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Server-Action: Produkt aus Position speichern
const actionNeedle = `  if (intent === "createOrder") {`;

const productAction = `  if (intent === "createProductFromPosition") {
    const name = String(formData.get("productName") || "").trim();
    const category = String(formData.get("productCategory") || "Auftragseingang").trim();
    const unit = String(formData.get("productUnit") || "Stück").trim();
    const priceCents = euroToCents(formData.get("productPriceEuro"));
    const taxRate = Number(formData.get("productTaxRate") || 19);

    if (!name) {
      return { error: "Produktname fehlt." };
    }

    await prisma.product.create({
      data: {
        tenantId: tenantUser.tenantId,
        name,
        category: category || null,
        unit,
        priceCents,
        taxRate: Number.isFinite(taxRate) ? taxRate : 19,
        active: true,
      } as any,
    });

    return { success: "Produkt wurde angelegt." };
  }

`;

if (!text.includes(productAction)) {
  if (!text.includes(actionNeedle)) {
    throw new Error("createOrder-Block wurde nicht gefunden.");
  }

  text = text.replace(actionNeedle, productAction + actionNeedle);
}

// 2) Product-Modal-State nach positionRows einfügen
const oldState = `  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);`;

const newState = `  const [positionRows, setPositionRows] = useState<Array<{ id: number; type: "item" | "text" }>>([
    { id: Date.now(), type: "item" },
  ]);

  const [productDraft, setProductDraft] = useState<{
    open: boolean;
    name: string;
    unit: string;
    priceEuro: string;
    taxRate: string;
  }>({
    open: false,
    name: "",
    unit: "Stück",
    priceEuro: "",
    taxRate: "19",
  });`;

if (!text.includes("const [productDraft, setProductDraft]")) {
  if (!text.includes(oldState)) {
    throw new Error("positionRows-State wurde nicht gefunden.");
  }

  text = text.replace(oldState, newState);
}

// 3) Positionsnummer wie Bedienbutton darstellen
text = text.replace(
`                    <div style={{
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
                    </div>`,
`                    <button
                      type="button"
                      title="Position später verschieben"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        border: "1px solid #cfd8e3",
                        background: "#f8fafc",
                        color: "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 900,
                        marginTop: row.type === "text" ? 24 : 26,
                        cursor: "grab",
                        boxShadow: "0 1px 2px rgba(15,23,42,0.08)"
                      }}
                    >
                      {rowIndex + 1}
                    </button>`
);

// 4) Freitext-Link schöner machen
text = text.replace(
`                            <summary style={{
                              cursor: "pointer",
                              color: "#333",
                              fontSize: 12,
                              fontWeight: 800,
                              listStyle: "none"
                            }}>
                              ≡ Freitext zu dieser Position
                            </summary>`,
`                            <summary style={{
                              cursor: "pointer",
                              color: "#0f766e",
                              fontSize: 12,
                              fontWeight: 900,
                              listStyle: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              width: "fit-content",
                              marginTop: 2
                            }}>
                              + Freitext zu dieser Position
                            </summary>`
);

// 5) Button "Als Produkt speichern" direkt unter Freitext/Artikel einfügen
const afterDetails = `                          </details>
                        </div>

                        <label style={labelStyle}>
                          Menge`;

const withProductButton = `                          </details>

                          <button
                            type="button"
                            onClick={(event) => {
                              const rowElement = event.currentTarget.closest('[data-position-row="item"]') as HTMLElement | null;
                              const nameInput = rowElement?.querySelector('input[name="itemName"]') as HTMLInputElement | null;
                              const unitInput = rowElement?.querySelector('input[name="unit"]') as HTMLInputElement | null;
                              const priceInput = rowElement?.querySelector('input[name="unitPriceEuro"]') as HTMLInputElement | null;
                              const taxInput = rowElement?.querySelector('select[name="taxRate"]') as HTMLSelectElement | null;

                              setProductDraft({
                                open: true,
                                name: nameInput?.value || "",
                                unit: unitInput?.value || "Stück",
                                priceEuro: priceInput?.value || "",
                                taxRate: taxInput?.value || "19",
                              });
                            }}
                            style={{
                              border: "1px solid #d1fae5",
                              background: "#ecfdf5",
                              color: "#047857",
                              borderRadius: 999,
                              padding: "7px 11px",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: "pointer",
                              width: "fit-content"
                            }}
                          >
                            + als Produkt speichern
                          </button>
                        </div>

                        <label style={labelStyle}>
                          Menge`;

if (!text.includes("+ als Produkt speichern")) {
  if (!text.includes(afterDetails)) {
    throw new Error("Stelle nach Freitext-Details wurde nicht gefunden.");
  }

  text = text.replace(afterDetails, withProductButton);
}

// 6) Modal nach dem Haupt-Formular einfügen, nicht verschachteln
const formCloseNeedle = `          </Form>
        </section>`;

const modalBlock = `          </Form>

          {productDraft.open ? (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.42)",
                zIndex: 9999,
                display: "flex",
                justifyContent: "flex-end"
              }}
            >
              <Form
                method="post"
                style={{
                  width: 430,
                  maxWidth: "92vw",
                  height: "100vh",
                  background: "#ffffff",
                  boxShadow: "-24px 0 60px rgba(15,23,42,0.22)",
                  padding: 24,
                  display: "grid",
                  alignContent: "start",
                  gap: 18
                }}
              >
                <input type="hidden" name="intent" value="createProductFromPosition" />

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.04em" }}>
                      Produkt anlegen
                    </h2>
                    <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 650, fontSize: 13 }}>
                      Aus dieser Position als Stammprodukt speichern.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setProductDraft((draft) => ({ ...draft, open: false }))}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 26,
                      lineHeight: 1,
                      cursor: "pointer",
                      color: "#64748b"
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ borderTop: "1px solid #e5e7eb" }} />

                <label style={labelStyle}>
                  Bezeichnung *
                  <input
                    name="productName"
                    defaultValue={productDraft.name}
                    placeholder="Produktname"
                    required
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Kategorie
                  <input
                    name="productCategory"
                    defaultValue="Auftragseingang"
                    placeholder="z. B. Bowls, Buffet, Getränke"
                    style={inputStyle}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={labelStyle}>
                    Einheit
                    <input
                      name="productUnit"
                      defaultValue={productDraft.unit}
                      placeholder="Stück"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    MwSt
                    <select
                      name="productTaxRate"
                      defaultValue={productDraft.taxRate}
                      style={inputStyle}
                    >
                      <option value="19">19 %</option>
                      <option value="7">7 %</option>
                      <option value="0">0 %</option>
                    </select>
                  </label>
                </div>

                <label style={labelStyle}>
                  VK Netto
                  <input
                    name="productPriceEuro"
                    defaultValue={productDraft.priceEuro}
                    placeholder="0,00 €"
                    style={{ ...inputStyle, textAlign: "right" }}
                  />
                </label>

                <div style={{
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  color: "#64748b",
                  fontSize: 13,
                  fontWeight: 650
                }}>
                  Hinweis: Beschreibung, Artikelnummer und EAN können wir später ergänzen, dafür müssen erst Felder im Product-Model ergänzt werden.
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setProductDraft((draft) => ({ ...draft, open: false }))}
                    style={smallButtonStyle}
                  >
                    Abbrechen
                  </button>

                  <button
                    type="submit"
                    style={{
                      border: "none",
                      background: "#059669",
                      color: "#ffffff",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontWeight: 950,
                      cursor: "pointer"
                    }}
                  >
                    Speichern
                  </button>
                </div>
              </Form>
            </div>
          ) : null}
        </section>`;

if (!text.includes("Produkt anlegen")) {
  if (!text.includes(formCloseNeedle)) {
    throw new Error("Formular-Ende wurde nicht gefunden.");
  }

  text = text.replace(formCloseNeedle, modalBlock);
}

fs.writeFileSync(file, text, "utf8");
