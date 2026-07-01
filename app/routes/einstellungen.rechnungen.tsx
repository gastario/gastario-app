import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Rechnungsdaten · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
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

  if (!access?.tenant) {
    return {
      tenant: null,
      requiredComplete: false,
      missingFields: ["Mandant"],
    };
  }

  const tenant = access.tenant as any;
  const missingFields: string[] = [];

  if (!tenant.invoiceSellerName) missingFields.push("Firmenname");
  if (!tenant.invoiceSellerAddress) missingFields.push("Firmenadresse");
  if (!tenant.invoiceTaxNumber && !tenant.invoiceVatId) missingFields.push("Steuernummer oder USt-ID");
  if (!tenant.invoiceIban) missingFields.push("IBAN");
  if (!tenant.invoiceBankName) missingFields.push("Bankname");

  return {
    tenant,
    requiredComplete: missingFields.length === 0,
    missingFields,
  };
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

  if (!access?.tenant) {
    return { error: "Kein Mandant gefunden." };
  }

  const formData = await request.formData();

  const invoiceSellerName = String(formData.get("invoiceSellerName") || "").trim();
  const invoiceSellerAddress = String(formData.get("invoiceSellerAddress") || "").trim();
  const invoiceTaxNumber = String(formData.get("invoiceTaxNumber") || "").trim();
  const invoiceVatId = String(formData.get("invoiceVatId") || "").trim();
  const invoiceEmail = String(formData.get("invoiceEmail") || "").trim();
  const invoicePhone = String(formData.get("invoicePhone") || "").trim();
  const invoiceIban = String(formData.get("invoiceIban") || "").trim();
  const invoiceBic = String(formData.get("invoiceBic") || "").trim();
  const invoiceBankName = String(formData.get("invoiceBankName") || "").trim();
  const invoicePaymentTermsDe = String(formData.get("invoicePaymentTermsDe") || "").trim();
  const invoicePaymentTermsEn = String(formData.get("invoicePaymentTermsEn") || "").trim();
  const invoiceClosingTextDe = String(formData.get("invoiceClosingTextDe") || "").trim();
  const invoiceClosingTextEn = String(formData.get("invoiceClosingTextEn") || "").trim();

  if (!invoiceSellerName) return { error: "Firmenname fehlt." };
  if (!invoiceSellerAddress) return { error: "Firmenadresse fehlt." };
  if (!invoiceTaxNumber && !invoiceVatId) return { error: "Steuernummer oder USt-ID fehlt." };
  if (!invoiceIban) return { error: "IBAN fehlt." };
  if (!invoiceBankName) return { error: "Bankname fehlt." };

  await prisma.tenant.update({
    where: { id: access.tenantId },
    data: {
      invoiceSellerName,
      invoiceSellerAddress,
      invoiceTaxNumber: invoiceTaxNumber || null,
      invoiceVatId: invoiceVatId || null,
      invoiceEmail: invoiceEmail || null,
      invoicePhone: invoicePhone || null,
      invoiceIban,
      invoiceBic: invoiceBic || null,
      invoiceBankName,
      invoicePaymentTermsDe: invoicePaymentTermsDe || "Zahlbar sofort, rein netto.",
      invoicePaymentTermsEn: invoicePaymentTermsEn || "Payable immediately without deduction.",
      invoiceClosingTextDe: invoiceClosingTextDe || "Vielen Dank für die gute Zusammenarbeit.",
      invoiceClosingTextEn: invoiceClosingTextEn || "Thank you for your business.",
    } as any,
  });

  return { success: "Rechnungsdaten wurden gespeichert." };
}

export default function RechnungsdatenPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const tenant = data.tenant as any;

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Rechnungsdaten</h1>
          <p className="muted">
            Firmendaten, Steuerdaten, Bankverbindung und Standardtexte für Rechnungen.
          </p>
        </div>

        <Link to="/rechnungen" className="button secondary">
          Zurück zu Rechnungen
        </Link>
      </header>

      {actionData && "error" in actionData ? <div style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      <section style={pageGridStyle}>
        <div style={heroStyle}>
          <div>
            <p style={smallLabelStyle}>Pflichtstatus</p>
            <h2 style={heroTitleStyle}>
              {data.requiredComplete ? "Rechnungsdaten vollständig" : "Rechnungsdaten unvollständig"}
            </h2>
            <p style={mutedTextStyle}>
              Diese Angaben werden in neue Rechnungen übernommen und sind Voraussetzung für saubere finale Rechnungen.
            </p>

            {!data.requiredComplete ? (
              <div style={missingWrapStyle}>
                {data.missingFields.map((field) => (
                  <span key={field} style={missingPillStyle}>{field}</span>
                ))}
              </div>
            ) : null}
          </div>

          <div style={data.requiredComplete ? completeBadgeStyle : warningBadgeStyle}>
            <strong>{data.requiredComplete ? "Bereit" : "Fehlt noch"}</strong>
            <span>{data.requiredComplete ? "Finalisierung möglich" : "Pflichtdaten ergänzen"}</span>
          </div>
        </div>

        <Form method="post" style={formStyle}>
          <div style={cardStyle}>
            <div>
              <p style={smallLabelStyle}>Unternehmen</p>
              <h2 style={sectionTitleStyle}>Firmendaten</h2>
              <p style={sectionHintStyle}>Diese Daten erscheinen als Rechnungsaussteller.</p>
            </div>

            <div style={twoColStyle}>
              <Field label="Firmenname *">
                <input name="invoiceSellerName" defaultValue={tenant?.invoiceSellerName || tenant?.name || ""} required />
              </Field>

              <Field label="E-Mail">
                <input name="invoiceEmail" type="email" defaultValue={tenant?.invoiceEmail || ""} placeholder="rechnung@example.de" />
              </Field>
            </div>

            <Field label="Firmenadresse *">
              <textarea
                name="invoiceSellerAddress"
                defaultValue={tenant?.invoiceSellerAddress || ""}
                required
                rows={4}
                placeholder={"Straße Hausnummer\nPLZ Ort\nDeutschland"}
              />
            </Field>

            <div style={threeColStyle}>
              <Field label="Steuernummer">
                <input name="invoiceTaxNumber" defaultValue={tenant?.invoiceTaxNumber || ""} placeholder="Steuernummer" />
              </Field>

              <Field label="USt-ID">
                <input name="invoiceVatId" defaultValue={tenant?.invoiceVatId || ""} placeholder="DE..." />
              </Field>

              <Field label="Telefon">
                <input name="invoicePhone" defaultValue={tenant?.invoicePhone || ""} placeholder="+49 ..." />
              </Field>
            </div>

            <div style={noticeStyle}>
              Mindestens Steuernummer oder USt-ID ist erforderlich.
            </div>
          </div>

          <div style={cardStyle}>
            <div>
              <p style={smallLabelStyle}>Zahlung</p>
              <h2 style={sectionTitleStyle}>Bankverbindung</h2>
              <p style={sectionHintStyle}>Diese Bankdaten erscheinen später auf Rechnung und PDF.</p>
            </div>

            <div style={threeColStyle}>
              <Field label="IBAN *">
                <input name="invoiceIban" defaultValue={tenant?.invoiceIban || ""} required placeholder="DE..." />
              </Field>

              <Field label="BIC">
                <input name="invoiceBic" defaultValue={tenant?.invoiceBic || ""} placeholder="optional" />
              </Field>

              <Field label="Bankname *">
                <input name="invoiceBankName" defaultValue={tenant?.invoiceBankName || ""} required placeholder="Bankname" list="bankNameOptions" />
                <datalist id="bankNameOptions">
                  <option value="Deutsche Bank" />
                  <option value="Commerzbank" />
                  <option value="Sparkasse" />
                  <option value="Berliner Sparkasse" />
                  <option value="Postbank" />
                  <option value="Volksbank" />
                  <option value="Raiffeisenbank" />
                  <option value="DKB" />
                  <option value="N26" />
                  <option value="ING" />
                  <option value="Comdirect" />
                  <option value="Targobank" />
                  <option value="Santander" />
                  <option value="HypoVereinsbank" />
                  <option value="GLS Bank" />
                  <option value="Revolut" />
                  <option value="Wise" />
                </datalist>
              </Field>
            </div>
          </div>

          <div style={cardStyle}>
            <div>
              <p style={smallLabelStyle}>Standardtexte</p>
              <h2 style={sectionTitleStyle}>Zahlungsbedingungen & Nachbemerkung</h2>
              <p style={sectionHintStyle}>Diese Texte werden automatisch für neue Rechnungen vorgeschlagen.</p>
            </div>

            <div style={twoColStyle}>
              <Field label="Zahlungsbedingung Deutsch">
                <input
                  name="invoicePaymentTermsDe"
                  defaultValue={tenant?.invoicePaymentTermsDe || "Zahlbar sofort, rein netto."}
                />
              </Field>

              <Field label="Zahlungsbedingung Englisch">
                <input
                  name="invoicePaymentTermsEn"
                  defaultValue={tenant?.invoicePaymentTermsEn || "Payable immediately without deduction."}
                />
              </Field>
            </div>

            <div style={twoColStyle}>
              <Field label="Nachbemerkung Deutsch">
                <input
                  name="invoiceClosingTextDe"
                  defaultValue={tenant?.invoiceClosingTextDe || "Vielen Dank für die gute Zusammenarbeit."}
                />
              </Field>

              <Field label="Nachbemerkung Englisch">
                <input
                  name="invoiceClosingTextEn"
                  defaultValue={tenant?.invoiceClosingTextEn || "Thank you for your business."}
                />
              </Field>
            </div>
          </div>

          <div style={footerBarStyle}>
            <div>
              <strong>Rechnungsdaten speichern</strong>
              <span>Änderungen gelten für neue Rechnungen und spätere PDF-Ausgaben.</span>
            </div>

            <button type="submit" style={primaryButtonStyle}>
              Rechnungsdaten speichern
            </button>
          </div>
        </Form>
      </section>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const pageGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #ffffff 0%, #f7fbfa 100%)",
  border: "1px solid #dbe5eb",
  borderRadius: 22,
  padding: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#057a67",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 11,
  fontWeight: 700,
};

const heroTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 26,
  letterSpacing: "-0.045em",
  color: "#0f172a",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 24,
  letterSpacing: "-0.04em",
  color: "#0f172a",
};

const mutedTextStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#475569",
  fontWeight: 650,
  lineHeight: 1.55,
};

const sectionHintStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontWeight: 650,
};

const missingWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 14,
};

const missingPillStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "7px 10px",
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontSize: 12,
  fontWeight: 700,
};

const completeBadgeStyle: React.CSSProperties = {
  minWidth: 190,
  borderRadius: 18,
  padding: 16,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#047857",
  display: "grid",
  gap: 4,
  textAlign: "right",
};

const warningBadgeStyle: React.CSSProperties = {
  minWidth: 190,
  borderRadius: 18,
  padding: 16,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  display: "grid",
  gap: 4,
  textAlign: "right",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 22,
  padding: 24,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
  display: "grid",
  gap: 18,
};

const twoColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const threeColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
};

const noticeStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontWeight: 700,
};

const footerBarStyle: React.CSSProperties = {
  position: "sticky",
  bottom: 18,
  zIndex: 2,
  background: "rgba(255, 255, 255, 0.94)",
  backdropFilter: "blur(10px)",
  border: "1px solid #dbe5eb",
  borderRadius: 20,
  padding: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 46,
  borderRadius: 13,
  padding: "0 18px",
  border: "1px solid #036b5a",
  background: "linear-gradient(135deg, #058872 0%, #04705f 100%)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(5, 122, 103, 0.24)",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
  marginBottom: 16,
};

const successStyle: React.CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#047857",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
  marginBottom: 16,
};


