const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Position type optional erlauben
text = text.replaceAll(
  `useState<Array<{ id: number; type: "item" | "text" }>>`,
  `useState<Array<{ id: number; type: "item" | "text" | "optional" }>>`
);

// 2) Server: optional als itemKind erkennen
text = text.replace(
  `const kind = itemKinds[index] === "text" ? "text" : "item";`,
  `const kind = itemKinds[index] === "text" ? "text" : itemKinds[index] === "optional" ? "optional" : "item";`
);

text = text.replace(
  `kind === "text" ? "Freitext" : "",`,
  `kind === "text" ? "Freitext" : "",
          kind === "optional" ? "Optional" : "",`
);

// 3) Hidden itemKind dynamisch machen
text = text.replaceAll(
  `<input type="hidden" name="itemKind" value="item" />`,
  `<input type="hidden" name="itemKind" value={row.type === "optional" ? "optional" : "item"} />`
);

// 4) Optional optisch über der Position markieren
const artikelBlock = `                        <div style={{ display: "grid", gap: 8 }}>
                          <label style={labelStyle}>
                            Artikel`;

const artikelBlockNeu = `                        <div style={{ display: "grid", gap: 8 }}>
                          {row.type === "optional" ? (
                            <div style={{
                              width: "fit-content",
                              border: "1px solid #facc15",
                              background: "#fef9c3",
                              color: "#854d0e",
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

if (!text.includes("Optionale Position") && text.includes(artikelBlock)) {
  text = text.replace(artikelBlock, artikelBlockNeu);
}

// 5) Liveberechnung mit Gesamtrabatt
if (!text.includes("globalDiscountPercent")) {
  text = text.replace(
`    setLiveNetTotalCents(netTotalCents);
    setLiveTaxTotalCents(taxTotalCents);
    setLiveGrossTotalCents(grossTotalCents);`,
`    const globalDiscountInput = form.querySelector('input[name="globalDiscountPercent"]') as HTMLInputElement | null;
    const globalDiscountPercent = Number(String(globalDiscountInput?.value || "0").replace(",", "."));
    const safeGlobalDiscount = Number.isFinite(globalDiscountPercent)
      ? Math.max(0, Math.min(globalDiscountPercent, 100))
      : 0;

    if (safeGlobalDiscount > 0) {
      const factor = 1 - safeGlobalDiscount / 100;
      netTotalCents = Math.round(netTotalCents * factor);
      taxTotalCents = Math.round(taxTotalCents * factor);
      grossTotalCents = Math.round(grossTotalCents * factor);
    }

    setLiveNetTotalCents(netTotalCents);
    setLiveTaxTotalCents(taxTotalCents);
    setLiveGrossTotalCents(grossTotalCents);`
  );
}

// 6) Optional + Gesamtrabatt nach + ARTIKEL einfügen
if (!text.includes(`name="globalDiscountPercent"`)) {
  const marker = `                  >
                    + ARTIKEL
                  </button>`;

  const insert = `                  >
                    + ARTIKEL
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPositionRows((rows) =>
                        rows.length >= 50 ? rows : [...rows, { id: Date.now() + Math.random(), type: "optional" }]
                      )
                    }
                    style={{
                      border: "none",
                      background: "#ffffff",
                      color: "#333",
                      padding: "8px 6px",
                      fontWeight: 850,
                      cursor: "pointer"
                    }}
                  >
                    ◉ OPTIONAL
                  </button>

                  <label style={{
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
                  </label>`;

  if (!text.includes(marker)) {
    throw new Error("+ ARTIKEL Button wurde nicht gefunden.");
  }

  text = text.replace(marker, insert);
}

fs.writeFileSync(file, text, "utf8");
