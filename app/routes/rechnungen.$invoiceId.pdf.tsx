import { redirect, useLoaderData } from "react-router";

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

export function meta() {
  return [{ title: "Rechnung PDF · Gastario" }];
}

export async function loader({ request, params }: { request: Request; params: { invoiceId?: string } }) {
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
    throw new Response("Kein Mandant gefunden.", { status: 404 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: params.invoiceId,
      tenantId: access.tenantId,
    },
    include: {
      items: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!invoice) {
    throw new Response("Rechnung wurde nicht gefunden.", { status: 404 });
  }

  return {
    tenantName: access.tenant?.name || "Gastario",
    tenant: access.tenant,
    invoice,
  };
}

export default function InvoicePrintPage() {
  const data = useLoaderData<typeof loader>();
  const invoice = data.invoice;
  const tenant = data.tenant as any;
  const isEnglish = invoice.language === "EN";

  return (
    <main style={pageStyle}>
      <style>
        {`
          @media print {
            body {
              background: #ffffff !important;
            }

            .no-print {
              display: none !important;
            }

            .invoice-page {
              box-shadow: none !important;
              margin: 0 !important;
              width: 100% !important;
              min-height: auto !important;
              padding: 0 !important;
            }

            @page {
              size: A4;
              margin: 18mm;
            }
          }
        `}
      </style>

      <div className="no-print" style={toolbarStyle}>
        <button type="button" onClick={() => window.print()} style={printButtonStyle}>
          Drucken / Als PDF speichern
        </button>
      </div>

      <section className="invoice-page" style={invoicePageStyle}>
        <header style={headerStyle}>
          <div>
            <p style={companyLineStyle}>{invoice.sellerName || data.tenantName}</p>
            <h1 style={titleStyle}>{isEnglish ? "Invoice" : "Rechnung"}</h1>
          </div>

          <div style={metaBoxStyle}>
            <MetaRow label={isEnglish ? "Invoice no." : "Rechnungsnummer"} value={invoice.externalInvoiceNumber || "-"} />
            <MetaRow label={isEnglish ? "Invoice date" : "Rechnungsdatum"} value={formatDate(invoice.invoiceDate)} />
            <MetaRow label={isEnglish ? "Service date" : "Leistungsdatum"} value={formatDate(invoice.serviceDate)} />
          </div>
        </header>

        <section style={addressGridStyle}>
          <div>
            <p style={labelStyle}>{isEnglish ? "From" : "Von"}</p>
            <strong>{invoice.sellerName || data.tenantName}</strong>
            <p style={addressStyle}>
              {invoice.sellerAddress || "Firmendaten werden später aus Einstellungen übernommen."}
            </p>
            {invoice.sellerTaxNumber ? <p style={smallTextStyle}>Steuernummer: {invoice.sellerTaxNumber}</p> : null}
            {invoice.sellerVatId ? <p style={smallTextStyle}>USt-ID: {invoice.sellerVatId}</p> : null}
          </div>

          <div>
            <p style={labelStyle}>{isEnglish ? "Bill to" : "Rechnung an"}</p>
            <strong>{invoice.customerName}</strong>
            <p style={addressStyle}>{invoice.customerAddress || "-"}</p>
            {invoice.customerVatId ? <p style={smallTextStyle}>USt-ID: {invoice.customerVatId}</p> : null}
          </div>
        </section>

        <section style={introStyle}>
          <p>
            {isEnglish
              ? "We invoice you for the following goods/services."
              : "Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung."}
          </p>
        </section>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Pos.</th>
              <th style={thStyle}>{isEnglish ? "Description" : "Beschreibung"}</th>
              <th style={thRightStyle}>{isEnglish ? "Qty" : "Menge"}</th>
              <th style={thRightStyle}>{isEnglish ? "Unit price" : "Einzelpreis"}</th>
              <th style={thRightStyle}>{isEnglish ? "VAT" : "MwSt"}</th>
              <th style={thRightStyle}>{isEnglish ? "Total" : "Gesamt"}</th>
            </tr>
          </thead>

          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td style={tdStyle}>{item.position}</td>
                <td style={tdStyle}>
                  <strong>{item.name}</strong>
                  {item.description ? <div style={subTextStyle}>{item.description}</div> : null}
                </td>
                <td style={tdRightStyle}>{item.quantity.toLocaleString("de-DE")} {item.unit}</td>
                <td style={tdRightStyle}>{centsToEuro(item.unitCents)}</td>
                <td style={tdRightStyle}>{item.taxRate} %</td>
                <td style={tdRightStyle}><strong>{centsToEuro(item.grossTotalCents)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>

        <section style={totalsStyle}>
          <TotalRow label={isEnglish ? "Net amount" : "Netto"} value={centsToEuro(invoice.netTotalCents)} />
          <TotalRow label={isEnglish ? "VAT" : "MwSt"} value={centsToEuro(invoice.taxTotalCents)} />
          <div style={grandTotalStyle}>
            <span>{isEnglish ? "Total amount" : "Gesamtbetrag"}</span>
            <strong>{centsToEuro(invoice.grossTotalCents)}</strong>
          </div>
        </section>

        <footer style={footerStyle}>
          <div>
            <strong>{isEnglish ? "Payment terms" : "Zahlungsbedingung"}</strong>
            <p>{isEnglish ? invoice.paymentTermsEn || "Payable immediately without deduction." : invoice.paymentTermsDe || "Zahlbar sofort ohne Abzug."}</p>
          </div>

          <div>
            <strong>{isEnglish ? "Bank details" : "Bankverbindung"}</strong>
            <p style={bankTextStyle}>
              {tenant?.invoiceBankName ? <span>{tenant.invoiceBankName}</span> : null}
              {tenant?.invoiceIban ? <span>IBAN: {tenant.invoiceIban}</span> : null}
              {tenant?.invoiceBic ? <span>BIC: {tenant.invoiceBic}</span> : null}
            </p>
          </div>

          <div>
            <strong>{isEnglish ? "Bank details" : "Bankverbindung"}</strong>
            <p style={bankTextStyle}>
              {tenant?.invoiceBankName ? <span>{tenant.invoiceBankName}</span> : null}
              {tenant?.invoiceIban ? <span>IBAN: {tenant.invoiceIban}</span> : null}
              {tenant?.invoiceBic ? <span>BIC: {tenant.invoiceBic}</span> : null}
            </p>
          </div>

          {invoice.reverseChargeNoteDe || invoice.reverseChargeNoteEn ? (
            <div>
              <strong>{isEnglish ? "Tax note" : "Steuerhinweis"}</strong>
              <p>{isEnglish ? invoice.reverseChargeNoteEn : invoice.reverseChargeNoteDe}</p>
            </div>
          ) : null}

          <p style={smallTextStyle}>
            {isEnglish
              ? "This document was created with Gastario."
              : "Dieses Dokument wurde mit Gastario erstellt."}
          </p>
        </footer>
      </section>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={totalRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#e9eef3",
  padding: "28px 0",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
};

const toolbarStyle: React.CSSProperties = {
  width: 900,
  margin: "0 auto 18px",
  display: "flex",
  justifyContent: "flex-end",
};

const printButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#059669",
  color: "#ffffff",
  borderRadius: 999,
  padding: "12px 18px",
  fontWeight: 700,
  cursor: "pointer",
};

const invoicePageStyle: React.CSSProperties = {
  width: 900,
  minHeight: 1180,
  margin: "0 auto",
  background: "#ffffff",
  padding: 54,
  borderRadius: 14,
  boxShadow: "0 18px 50px rgba(15,23,42,0.12)",
};

const headerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 320px",
  gap: 36,
  alignItems: "start",
};

const companyLineStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 42,
  letterSpacing: "-0.05em",
};

const metaBoxStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 16,
  display: "grid",
  gap: 10,
  background: "#f8fafc",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  fontSize: 14,
};

const addressGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 60,
  marginTop: 56,
};

const labelStyle: React.CSSProperties = {
  margin: "0 0 8px",
  color: "#00796b",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 12,
  fontWeight: 700,
};

const addressStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  color: "#475569",
  lineHeight: 1.55,
};

const smallTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
};

const introStyle: React.CSSProperties = {
  marginTop: 48,
  color: "#334155",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 28,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  borderBottom: "2px solid #0f172a",
  fontSize: 12,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 8px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
};

const subTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 13,
};

const totalsStyle: React.CSSProperties = {
  width: 330,
  marginLeft: "auto",
  marginTop: 28,
  display: "grid",
  gap: 10,
};

const totalRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  color: "#475569",
  fontWeight: 700,
};

const grandTotalStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  borderTop: "2px solid #0f172a",
  paddingTop: 12,
  fontSize: 20,
};

const footerStyle: React.CSSProperties = {
  marginTop: 54,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 24,
  display: "grid",
  gap: 18,
};

const bankTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.45,
};






