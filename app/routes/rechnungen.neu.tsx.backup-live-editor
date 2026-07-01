import { Form, Link, redirect, useActionData } from "react-router";
import AppLayout from "../components/AppLayout";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function euroToCents(value: FormDataEntryValue | null) {
  const normalized = String(value || "0")
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

function parseDateInput(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = new Date(raw + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function meta() {
  return [{ title: "Neue Rechnung · Gastario" }];
}

export async function action({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!access) {
    return { error: "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "createInvoiceDraft") {
    return { error: "Unbekannte Aktion." };
  }

  const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();
  const language = String(formData.get("language") || "DE");
  const customerName = String(formData.get("customerName") || "").trim();
  const customerAddress = [
    String(formData.get("addressExtra") || "").trim(),
    String(formData.get("street") || "").trim(),
    [String(formData.get("zip") || "").trim(), String(formData.get("city") || "").trim()].filter(Boolean).join(" "),
    String(formData.get("country") || "Deutschland").trim(),
  ].filter(Boolean).join("\\n");

  const invoiceDate = parseDateInput(formData.get("invoiceDate")) || new Date();
  const serviceDate = parseDateInput(formData.get("serviceDate")) || invoiceDate;

  const title = String(formData.get("title") || "Rechnung").trim();
  const introText = String(formData.get("introText") || "").trim();
  const paymentTerms = String(formData.get("paymentTerms") || "").trim();
  const closingText = String(formData.get("closingText") || "").trim();

  const itemName = String(formData.get("itemName") || "").trim();
  const quantityRaw = Number(String(formData.get("quantity") || "1").replace(",", "."));
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
  const unit = String(formData.get("unit") || "Stück").trim();
  const unitCents = euroToCents(formData.get("unitPriceEuro"));
  const discountRaw = Number(String(formData.get("discountPercent") || "0").replace(",", "."));
  const discountPercent = Number.isFinite(discountRaw) ? Math.max(0, Math.min(discountRaw, 100)) : 0;
  const taxRate = Number(String(formData.get("taxRate") || "19").replace(",", "."));

  if (!customerName) return { error: "Kunde fehlt." };
  if (!invoiceNumber) return { error: "Rechnungsnummer fehlt." };
  if (!itemName) return { error: "Position fehlt." };
  if (unitCents <= 0) return { error: "VK Netto fehlt." };

  const existing = await prisma.invoice.findFirst({
    where: {
      tenantId: access.tenantId,
      externalInvoiceNumber: invoiceNumber,
    },
  });

  if (existing) {
    return { error: "Diese Rechnungsnummer ist bereits vorhanden." };
  }

  const lineBeforeDiscountCents = Math.round(unitCents * quantity);
  const discountCents = Math.round(lineBeforeDiscountCents * (discountPercent / 100));
  const netTotalCents = Math.max(0, lineBeforeDiscountCents - discountCents);
  const taxTotalCents = Math.round(netTotalCents * ((Number.isFinite(taxRate) ? taxRate : 19) / 100));
  const grossTotalCents = netTotalCents + taxTotalCents;

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: access.tenantId,
      type: "DIRECT" as any,
      status: "DRAFT" as any,
      numberSource: "MANUAL" as any,
      externalInvoiceNumber: invoiceNumber,
      language: language as any,
      customerType: "BUSINESS" as any,
      taxTreatment: taxRate === 7 ? "DOMESTIC_7" as any : "DOMESTIC_19" as any,
      invoiceDate,
      serviceDate,
      customerName,
      customerAddress: customerAddress || null,
      customerCountry: "DE",
      sellerName: access.tenant?.name || "Gastario",
      currency: "EUR",
      netTotalCents,
      taxTotalCents,
      grossTotalCents,
      paymentTermsDe: paymentTerms || "Zahlbar sofort, rein netto.",
      paymentTermsEn: "Payable immediately without deduction.",
      notes: [title, introText, closingText].filter(Boolean).join("\\n\\n"),
    } as any,
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice.id,
      position: 1,
      type: "ITEM",
      name: itemName,
      quantity,
      unit,
      unitCents,
      discountPercent: Math.round(discountPercent),
      discountCents,
      netTotalCents,
      taxRate: Number.isFinite(taxRate) ? taxRate : 19,
      taxTotalCents,
      grossTotalCents,
    } as any,
  });

  return { success: "Rechnungsentwurf wurde erstellt." };
}

export default function NeueRechnungPage() {
  const actionData = useActionData<typeof action>();
  const today = todayInput();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Rechnung erstellen</h1>
          <p className="muted">Lexoffice-ähnlicher Editor für Rechnungsentwürfe.</p>
        </div>

        <Link className="button secondary" to="/rechnungen">
          Zur Übersicht
        </Link>
      </header>

      {actionData && "error" in actionData ? <div style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      <Form method="post" style={pageStyle}>
        <input type="hidden" name="intent" value="createInvoiceDraft" />

        <div style={topSwitchStyle}>
          <span style={switchButtonStyle}>Brutto</span>
          <span style={activeSwitchButtonStyle}>✓ Netto</span>
        </div>

        <section style={cardStyle}>
          <div style={twoColStyle}>
            <div style={gridStyle}>
              <FloatingInput name="customerName" label="Kunde" placeholder="Name des Kunden" required />
              <FloatingInput name="addressExtra" label="Adresszusatz" placeholder="Adresszusatz" />
              <FloatingInput name="street" label="Straße" placeholder="Straße" />

              <div style={twoColSmallStyle}>
                <FloatingInput name="zip" label="PLZ" placeholder="PLZ" />
                <FloatingInput name="city" label="Ort" placeholder="Ort" />
              </div>

              <label style={floatingLabelStyle}>
                <span>Land</span>
                <select name="country" defaultValue="Deutschland" style={inputStyle}>
                  <option>Deutschland</option>
                  <option>Österreich</option>
                  <option>Schweiz</option>
                  <option>Andere</option>
                </select>
              </label>
            </div>

            <div style={gridStyle}>
              <FloatingInput name="invoiceNumber" label="Rechnungsnummer" placeholder="z. B. RE-2026-001" required />
              <FloatingInput name="customerNumber" label="Kundennummer" placeholder="optional" />

              <FloatingInput name="invoiceDate" label="Datum" type="date" defaultValue={today} required />

              <div style={twoColSmallStyle}>
                <label style={floatingLabelStyle}>
                  <span>Lieferung oder Leistung</span>
                  <select name="serviceDateType" defaultValue="Lieferdatum" style={inputStyle}>
                    <option>Lieferdatum</option>
                    <option>Leistungsdatum</option>
                    <option>Lieferzeitraum</option>
                    <option>Leistungszeitraum</option>
                    <option>Kein Lieferdatum</option>
                  </select>
                </label>

                <FloatingInput name="serviceDate" label="Datum" type="date" defaultValue={today} required />
              </div>

              <label style={floatingLabelStyle}>
                <span>Beleg übersetzen</span>
                <select name="language" defaultValue="DE" style={inputStyle}>
                  <option value="DE">Deutsch</option>
                  <option value="EN">Englisch</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <FloatingInput name="title" label="Belegtitel" defaultValue="Rechnung" />
          <FloatingInput
            name="introText"
            label="Einleitungstext"
            defaultValue="Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung."
          />
        </section>

        <section style={positionCardStyle}>
          <div style={positionRowStyle}>
            <div style={numberCircleStyle}>1</div>

            <FloatingInput name="itemName" label="Artikel" placeholder="Bezeichnung des Artikels" required />
            <FloatingInput name="quantity" label="Menge" defaultValue="1,00" />
            <FloatingInput name="unit" label="Einheit" defaultValue="Stück" />
            <FloatingInput name="unitPriceEuro" label="VK (Netto)" placeholder="0,00 €" required />
            <FloatingInput name="discountPercent" label="Rabatt" defaultValue="0,00 %" />

            <div style={amountBoxStyle}>
              <strong>0,00 €</strong>
              <select name="taxRate" defaultValue="19" style={taxPillStyle}>
                <option value="19">USt 19 %</option>
                <option value="7">USt 7 %</option>
                <option value="0">USt 0 %</option>
              </select>
            </div>
          </div>

          <div style={positionActionsStyle}>
            <button type="button" style={greenOutlineButtonStyle}>+ ARTIKEL</button>
            <button type="button" style={textActionStyle}>≡ FREITEXT</button>
            <button type="button" style={textActionStyle}>% GESAMTRABATT</button>
          </div>

          <div style={totalBarStyle}>
            <div />
            <div style={sumBoxStyle}>
              <span>Summe (Netto)</span>
              <strong>0,00 €</strong>
            </div>
            <div style={grossBoxStyle}>
              <span>Gesamtbetrag</span>
              <strong>0,00 €</strong>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <FloatingInput name="paymentTerms" label="Zahlungsbedingung" defaultValue="Zahlbar sofort, rein netto" />
          <FloatingInput name="closingText" label="Nachbemerkung" defaultValue="Vielen Dank für die gute Zusammenarbeit." />
        </section>

        <section style={paymentGridStyle}>
          <div style={paymentCardStyle}>
            <strong>Überweisung</strong>
            <span>Aktiv</span>
          </div>

          <div style={paymentCardStyle}>
            <strong>Beleg übersetzen</strong>
            <span>Deutsch / Englisch</span>
          </div>
        </section>

        <div style={footerActionsStyle}>
          <Link to="/rechnungen" style={secondaryButtonStyle}>Abbrechen</Link>
          <button type="submit" style={primaryButtonStyle}>Zwischenspeichern</button>
        </div>
      </Form>
    </AppLayout>
  );
}

function FloatingInput({
  name,
  label,
  placeholder,
  defaultValue,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label style={floatingLabelStyle}>
      <span>{label}{required ? " *" : ""}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        style={inputStyle}
      />
    </label>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gap: 16,
};

const topSwitchStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 0,
};

const switchButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  padding: "10px 18px",
  background: "#ffffff",
  fontWeight: 800,
};

const activeSwitchButtonStyle: React.CSSProperties = {
  ...switchButtonStyle,
  background: "#f8fafc",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d7dde5",
  borderRadius: 8,
  padding: 18,
  boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
};

const positionCardStyle: React.CSSProperties = {
  ...cardStyle,
  padding: 0,
  overflow: "hidden",
};

const twoColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 78,
};

const twoColSmallStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.7fr 1.3fr",
  gap: 12,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const floatingLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 750,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 50,
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  padding: "0 13px",
  fontSize: 16,
  fontWeight: 500,
  background: "#ffffff",
};

const positionRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(260px, 1fr) 90px 130px 140px 100px 120px",
  gap: 10,
  alignItems: "end",
  padding: "34px 22px 20px",
};

const numberCircleStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  background: "#f1f5f9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  marginBottom: 9,
};

const amountBoxStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 8,
  paddingBottom: 4,
};

const taxPillStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  background: "#3f3f3f",
  color: "#ffffff",
  height: 28,
  padding: "0 9px",
  fontWeight: 800,
};

const positionActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 26,
  padding: "10px 22px 26px",
};

const greenOutlineButtonStyle: React.CSSProperties = {
  border: "1px solid #10a66a",
  background: "#ffffff",
  color: "#059669",
  borderRadius: 4,
  padding: "8px 18px",
  fontWeight: 900,
};

const textActionStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#334155",
  fontWeight: 900,
};

const totalBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 160px 160px",
  background: "#555",
  color: "#ffffff",
};

const sumBoxStyle: React.CSSProperties = {
  padding: 16,
  display: "grid",
  justifyItems: "center",
  borderLeft: "1px solid rgba(255,255,255,0.15)",
};

const grossBoxStyle: React.CSSProperties = {
  ...sumBoxStyle,
  background: "#444",
};

const paymentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const paymentCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  display: "flex",
  justifyContent: "space-between",
};

const footerActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  padding: "0 0 40px",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#059669",
  color: "#ffffff",
  borderRadius: 5,
  padding: "12px 18px",
  fontWeight: 950,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 5,
  padding: "12px 18px",
  fontWeight: 850,
  textDecoration: "none",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
};

const successStyle: React.CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#047857",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
};
