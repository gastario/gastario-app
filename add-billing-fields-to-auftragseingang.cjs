const fs = require("fs");

const file = "app/routes/auftragseingang.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Server: neue Felder aus Formular lesen
const readNeedle = `    const notes = String(formData.get("notes") || "").trim();`;

const readReplacement = `    const notes = String(formData.get("notes") || "").trim();

    const billingMode = String(formData.get("billingMode") || "UNDECIDED");
    const invoiceLanguage = String(formData.get("invoiceLanguage") || "DE");
    const customerCountry = String(formData.get("customerCountry") || "DE").trim().toUpperCase();
    const customerVatId = String(formData.get("customerVatId") || "").trim();
    const customerType = String(formData.get("customerType") || "BUSINESS");
    const taxTreatment = String(formData.get("taxTreatment") || "DOMESTIC_19");

    const billingStatus =
      billingMode === "DIRECT_INVOICE"
        ? "READY_TO_INVOICE"
        : billingMode === "PLATFORM_CREDIT"
          ? "WAITING_FOR_PLATFORM"
          : billingMode === "NO_INVOICE"
            ? "NOT_RELEVANT"
            : "NOT_BILLED";`;

if (!text.includes("const billingMode = String(formData.get")) {
  if (!text.includes(readNeedle)) {
    throw new Error("Stelle zum Lesen der Formulardaten nicht gefunden.");
  }

  text = text.replace(readNeedle, readReplacement);
}

// 2) Server: neue Felder beim Order speichern
const createNeedle = `        contactPhone: contactPhone || null,
        notes: notes || null,`;

const createReplacement = `        contactPhone: contactPhone || null,
        notes: notes || null,

        billingMode: billingMode as any,
        billingStatus: billingStatus as any,
        invoiceLanguage: invoiceLanguage as any,
        customerCountry: customerCountry || "DE",
        customerVatId: customerVatId || null,
        customerType: customerType as any,
        taxTreatment: taxTreatment as any,`;

if (!text.includes("billingMode: billingMode as any")) {
  if (!text.includes(createNeedle)) {
    throw new Error("Order-create Stelle nicht gefunden.");
  }

  text = text.replace(createNeedle, createReplacement);
}

// 3) UI-Feldblock nach Kunden-/Lieferdaten einfügen
const uiNeedle = `              </div>

              <div style={{ display: "grid", gap: 10 }}>`;

const billingBlock = `              </div>

              <div style={{
                border: "1px solid #dbeafe",
                background: "#eff6ff",
                borderRadius: 14,
                padding: 16,
                display: "grid",
                gap: 14
              }}>
                <div>
                  <div style={sectionLabelStyle}>Abrechnung</div>
                  <h3 style={{ margin: "4px 0 0", fontSize: 18, letterSpacing: "-0.03em" }}>
                    Rechnung & Steuer
                  </h3>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, fontWeight: 650 }}>
                    Lege fest, ob aus diesem Auftrag später eine Rechnung erstellt werden soll.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr", gap: 12 }}>
                  <label style={labelStyle}>
                    Abrechnung
                    <select name="billingMode" defaultValue="UNDECIDED" style={inputStyle}>
                      <option value="UNDECIDED">Noch nicht entschieden</option>
                      <option value="DIRECT_INVOICE">Rechnung erstellen</option>
                      <option value="PLATFORM_CREDIT">Plattform rechnet ab</option>
                      <option value="NO_INVOICE">Keine Rechnung</option>
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Sprache
                    <select name="invoiceLanguage" defaultValue="DE" style={inputStyle}>
                      <option value="DE">Deutsch</option>
                      <option value="EN">Englisch</option>
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Kundentyp
                    <select name="customerType" defaultValue="BUSINESS" style={inputStyle}>
                      <option value="BUSINESS">Firma</option>
                      <option value="PRIVATE">Privatkunde</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1.2fr", gap: 12 }}>
                  <label style={labelStyle}>
                    Land
                    <input name="customerCountry" defaultValue="DE" placeholder="DE" style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    USt-ID Kunde
                    <input name="customerVatId" placeholder="z. B. DE123456789" style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Steuerbehandlung
                    <select name="taxTreatment" defaultValue="DOMESTIC_19" style={inputStyle}>
                      <option value="DOMESTIC_19">Deutschland 19 %</option>
                      <option value="DOMESTIC_7">Deutschland 7 %</option>
                      <option value="TAX_FREE">Steuerfrei / 0 %</option>
                      <option value="REVERSE_CHARGE">Reverse Charge</option>
                      <option value="EXPORT">Ausland / Export</option>
                      <option value="OTHER">Sonderfall</option>
                    </select>
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>`;

if (!text.includes("Rechnung & Steuer")) {
  const index = text.indexOf(uiNeedle);
  if (index === -1) {
    throw new Error("UI-Einfügestelle nicht gefunden.");
  }

  text = text.slice(0, index) + billingBlock + text.slice(index + uiNeedle.length);
}

fs.writeFileSync(file, text, "utf8");
