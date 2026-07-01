import { Form, redirect, useActionData, useLoaderData } from "react-router";
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
    };
  }

  const tenant = access.tenant as any;

  const requiredComplete = Boolean(
    tenant.invoiceSellerName &&
    tenant.invoiceSellerAddress &&
    (tenant.invoiceTaxNumber || tenant.invoiceVatId) &&
    tenant.invoiceIban &&
    tenant.invoiceBankName
  );

  return {
    tenant,
    requiredComplete,
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
          <p className="eyebrow">Einstellungen</p>
          <h1>Rechnungsdaten</h1>
          <p className="muted">
            Pflichtangaben für Rechnungen einmal sauber hinterlegen.
          </p>
        </div>
      </header>

      {actionData && "error" in actionData ? <div style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      <section style={pageGridStyle}>
        <div style={heroStyle}>
          <div>
            <p style={smallLabelStyle}>Pflichtangaben</p>
            <h2 style={heroTitleStyle}>
              {data.requiredComplete ? "Rechnungsdaten vollständig" : "Rechnungsdaten unvollständig"}
            </h2>
            <p style={mutedTextStyle}>
              Diese Daten werden später automatisch in jede Rechnung übernommen. Ohne vollständige Rechnungsdaten soll keine finale Rechnung möglich sein.
            </p>
          </div>

          <span style={data.requiredComplete ? completeBadgeStyle : warningBadgeStyle}>
            {data.requiredComplete ? "Bereit" : "Unvollständig"}
          </span>
        </div>

        <Form method="post" style={formStyle}>
          <div style={cardStyle}>
            <p style={smallLabelStyle}>Unternehmen</p>
            <h2 style={sectionTitleStyle}>Deine Firmendaten</h2>

            <div style={twoColStyle}>
              <label style={labelStyle}>
                Firmenname *
                <input name="invoiceSellerName" defaultValue={tenant?.invoiceSellerName || tenant?.name || ""} required style={inputStyle} />
              </label>

              <label style={labelStyle}>
                E-Mail
                <input name="invoiceEmail" type="email" defaultValue={tenant?.invoiceEmail || ""} placeholder="rechnung@example.de" style={inputStyle} />
              </label>
            </div>

            <label style={labelStyle}>
              Firmenadresse *
              <textarea
                name="invoiceSellerAddress"
                defaultValue={tenant?.invoiceSellerAddress || ""}
                required
                rows={4}
                placeholder={"Straße Hausnummer\nPLZ Ort\nDeutschland"}
                style={textareaStyle}
              />
            </label>

            <div style={threeColStyle}>
              <label style={labelStyle}>
                Steuernummer
                <input name="invoiceTaxNumber" defaultValue={tenant?.invoiceTaxNumber || ""} placeholder="Steuernummer" style={inputStyle} />
              </label>

              <label style={labelStyle}>
                USt-ID
                <input name="invoiceVatId" defaultValue={tenant?.invoiceVatId || ""} placeholder="DE..." style={inputStyle} />
              </label>

              <label style={labelStyle}>
                Telefon
                <input name="invoicePhone" defaultValue={tenant?.invoicePhone || ""} placeholder="+49 ..." style={inputStyle} />
              </label>
            </div>

            <div style={noticeStyle}>
              Mindestens Steuernummer oder USt-ID ist erforderlich.
            </div>
          </div>

          <div style={cardStyle}>
            <p style={smallLabelStyle}>Zahlung</p>
            <h2 style={sectionTitleStyle}>Bankdaten</h2>

            <div style={threeColStyle}>
              <label style={labelStyle}>
                IBAN *
                <input name="invoiceIban" defaultValue={tenant?.invoiceIban || ""} required placeholder="DE..." style={inputStyle} />
              </label>

              <label style={labelStyle}>
                BIC
                <input name="invoiceBic" defaultValue={tenant?.invoiceBic || ""} placeholder="optional" style={inputStyle} />
              </label>

              <label style={labelStyle}>
                Bankname *
                <input name="invoiceBankName" defaultValue={tenant?.invoiceBankName || ""} required placeholder="Bankname" style={inputStyle} />
              </label>
            </div>
          </div>

          <div style={cardStyle}>
            <p style={smallLabelStyle}>Standardtexte</p>
            <h2 style={sectionTitleStyle}>Zahlungsbedingungen & Nachbemerkung</h2>

            <div style={twoColStyle}>
              <label style={labelStyle}>
                Zahlungsbedingung Deutsch
                <input
                  name="invoicePaymentTermsDe"
                  defaultValue={tenant?.invoicePaymentTermsDe || "Zahlbar sofort, rein netto."}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Zahlungsbedingung Englisch
                <input
                  name="invoicePaymentTermsEn"
                  defaultValue={tenant?.invoicePaymentTermsEn || "Payable immediately without deduction."}
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={twoColStyle}>
              <label style={labelStyle}>
                Nachbemerkung Deutsch
                <input
                  name="invoiceClosingTextDe"
                  defaultValue={tenant?.invoiceClosingTextDe || "Vielen Dank für die gute Zusammenarbeit."}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Nachbemerkung Englisch
                <input
                  name="invoiceClosingTextEn"
                  defaultValue={tenant?.invoiceClosingTextEn || "Thank you for your business."}
                  style={inputStyle}
                />
              </label>
            </div>
          </div>

          <div style={footerStyle}>
            <button type="submit" style={primaryButtonStyle}>
              Rechnungsdaten speichern
            </button>
          </div>
        </Form>
      </section>
    </AppLayout>
  );
}

const pageGridStyle: React.CSSProperties = { display: "grid", gap: 18 };

const heroStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#00796b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 12,
  fontWeight: 900,
};

const heroTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 26,
  letterSpacing: "-0.04em",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "6px 0 16px",
  fontSize: 22,
  letterSpacing: "-0.035em",
};

const mutedTextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  fontWeight: 650,
  lineHeight: 1.55,
};

const completeBadgeStyle: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 12px",
  fontWeight: 900,
};

const warningBadgeStyle: React.CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
  borderRadius: 999,
  padding: "8px 12px",
  fontWeight: 900,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 22,
};

const twoColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const threeColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontSize: 12,
  fontWeight: 850,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 11px",
  fontWeight: 750,
  background: "#ffffff",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 110,
  resize: "vertical",
  lineHeight: 1.5,
};

const noticeStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 13,
  borderRadius: 14,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontWeight: 750,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#059669",
  color: "#ffffff",
  borderRadius: 999,
  padding: "13px 18px",
  fontWeight: 950,
  cursor: "pointer",
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
