const fs = require("fs");

const file = "app/routes/rechnungen.tsx";
let text = fs.readFileSync(file, "utf8");

// 1) Action: Finalisieren / Bezahlt / Stornieren ergänzen
const actionNeedle = `  if (intent !== "createInvoiceDraft") {
    return { error: "Unbekannte Aktion." };
  }

  const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();`;

const actionReplacement = `  if (intent === "finalizeInvoice") {
    const invoiceId = String(formData.get("invoiceId") || "");

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: access.tenantId,
      },
    });

    if (!invoice) {
      return { error: "Rechnung wurde nicht gefunden." };
    }

    if (invoice.status !== "DRAFT") {
      return { error: "Nur Entwürfe können finalisiert werden." };
    }

    if (!invoice.externalInvoiceNumber) {
      return { error: "Rechnungsnummer fehlt. Entwurf kann nicht finalisiert werden." };
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "ISSUED" as any,
        issuedAt: new Date(),
      } as any,
    });

    return { success: "Rechnung wurde finalisiert und gesperrt." };
  }

  if (intent === "markInvoicePaid") {
    const invoiceId = String(formData.get("invoiceId") || "");

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: access.tenantId,
      },
    });

    if (!invoice) {
      return { error: "Rechnung wurde nicht gefunden." };
    }

    if (invoice.status === "CANCELLED") {
      return { error: "Stornierte Rechnungen können nicht als bezahlt markiert werden." };
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID" as any,
        paidAt: new Date(),
      } as any,
    });

    return { success: "Rechnung wurde als bezahlt markiert." };
  }

  if (intent === "cancelInvoice") {
    const invoiceId = String(formData.get("invoiceId") || "");

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: access.tenantId,
      },
    });

    if (!invoice) {
      return { error: "Rechnung wurde nicht gefunden." };
    }

    if (invoice.status === "PAID") {
      return { error: "Bezahlte Rechnungen bitte nicht einfach stornieren. Dafür bauen wir als Nächstes eine Korrektur/Storno-Rechnung." };
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELLED" as any,
        cancelledAt: new Date(),
      } as any,
    });

    return { success: "Rechnung wurde storniert." };
  }

  if (intent !== "createInvoiceDraft") {
    return { error: "Unbekannte Aktion." };
  }

  const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();`;

if (!text.includes(`intent === "finalizeInvoice"`)) {
  if (!text.includes(actionNeedle)) {
    throw new Error("Action-Einfügestelle wurde nicht gefunden.");
  }

  text = text.replace(actionNeedle, actionReplacement);
}

// 2) Tabellenkopf um Aktion erweitern
text = text.replace(
  `<th style={thStyle}>Status</th>
                </tr>`,
  `<th style={thStyle}>Status</th>
                  <th style={thStyle}>Aktion</th>
                </tr>`
);

// 3) Leerer Tabellenzustand colspan anpassen
text = text.replaceAll(`colSpan={6}`, `colSpan={7}`);

// 4) Aktion-Spalte in jeder Rechnungszeile ergänzen
const rowNeedle = `                      <td style={tdStyle}><span style={statusPillStyle}>{invoice.status}</span></td>
                    </tr>`;

const rowReplacement = `                      <td style={tdStyle}><span style={statusPillStyle}>{invoice.status}</span></td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {invoice.status === "DRAFT" ? (
                            <Form method="post">
                              <input type="hidden" name="intent" value="finalizeInvoice" />
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <button type="submit" style={miniPrimaryButtonStyle}>
                                Finalisieren
                              </button>
                            </Form>
                          ) : null}

                          {invoice.status === "ISSUED" ? (
                            <Form method="post">
                              <input type="hidden" name="intent" value="markInvoicePaid" />
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <button type="submit" style={miniButtonStyle}>
                                Bezahlt
                              </button>
                            </Form>
                          ) : null}

                          {invoice.status !== "CANCELLED" && invoice.status !== "PAID" ? (
                            <Form method="post">
                              <input type="hidden" name="intent" value="cancelInvoice" />
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <button type="submit" style={miniDangerButtonStyle}>
                                Stornieren
                              </button>
                            </Form>
                          ) : null}
                        </div>
                      </td>
                    </tr>`;

if (!text.includes(`value="finalizeInvoice"`)) {
  if (!text.includes(rowNeedle)) {
    throw new Error("Tabellenzeile wurde nicht gefunden.");
  }

  text = text.replace(rowNeedle, rowReplacement);
}

// 5) Button-Styles ergänzen
const styleNeedle = `const successStyle: React.CSSProperties = { background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857", borderRadius: 14, padding: 14, fontWeight: 750 };`;

const styleReplacement = `const successStyle: React.CSSProperties = { background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857", borderRadius: 14, padding: 14, fontWeight: 750 };

const miniPrimaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#059669",
  color: "#ffffff",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const miniButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const miniDangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};`;

if (!text.includes("miniPrimaryButtonStyle")) {
  if (!text.includes(styleNeedle)) {
    throw new Error("Style-Einfügestelle wurde nicht gefunden.");
  }

  text = text.replace(styleNeedle, styleReplacement);
}

fs.writeFileSync(file, text, "utf8");
