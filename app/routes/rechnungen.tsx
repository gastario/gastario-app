import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function statusLabel(status: string) {
  if (status === "DRAFT") return "Entwurf";
  if (status === "ISSUED") return "Erstellt";
  if (status === "PAID") return "Bezahlt";
  if (status === "CANCELLED") return "Storniert";
  if (status === "CORRECTED") return "Korrigiert";
  return status;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

export function meta() {
  return [{ title: "Rechnungen · Gastario" }];
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

  if (!access) {
    return {
      tenantName: "Gastario",
      invoices: [],
      dbError: "Kein Mandant gefunden.",
      stats: { drafts: 0, issued: 0, paid: 0, cancelled: 0 },
    };
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: access.tenantId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    return {
      tenantName: access.tenant?.name || "Gastario",
      invoices,
      dbError: null,
      stats: {
        drafts: invoices.filter((invoice) => invoice.status === "DRAFT").length,
        issued: invoices.filter((invoice) => invoice.status === "ISSUED").length,
        paid: invoices.filter((invoice) => invoice.status === "PAID").length,
        cancelled: invoices.filter((invoice) => invoice.status === "CANCELLED").length,
      },
    };
  } catch (error: any) {
    return {
      tenantName: access.tenant?.name || "Gastario",
      invoices: [],
      dbError: error?.message || "Rechnungen konnten nicht geladen werden.",
      stats: { drafts: 0, issued: 0, paid: 0, cancelled: 0 },
    };
  }
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
  const invoiceId = String(formData.get("invoiceId") || "");

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId: access.tenantId,
    },
    include: {
      items: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!invoice) {
    return { error: "Rechnung wurde nicht gefunden." };
  }

  if (intent === "finalizeInvoice") {
    if (invoice.status !== "DRAFT") {
      return { error: "Nur Entwürfe können finalisiert werden." };
    }

    const tenant = access.tenant as any;
    const missing: string[] = [];

    if (!invoice.externalInvoiceNumber) missing.push("Rechnungsnummer");
    if (!invoice.customerName) missing.push("Kunde");
    if (!invoice.customerAddress) missing.push("vollständige Kundenadresse");
    if (!invoice.invoiceDate) missing.push("Rechnungsdatum");
    if (!invoice.serviceDate) missing.push("Leistungsdatum");

    const realItems = invoice.items.filter((item) => item.type !== "TEXT");
    const hasPricedItem = realItems.some((item) => item.name && item.quantity > 0 && item.unitCents > 0);

    if (realItems.length === 0) missing.push("mindestens eine Artikelposition");
    if (!hasPricedItem) missing.push("Preis größer 0");

    if (!tenant?.invoiceSellerName) missing.push("eigener Firmenname");
    if (!tenant?.invoiceSellerAddress) missing.push("eigene Firmenadresse");
    if (!tenant?.invoiceTaxNumber && !tenant?.invoiceVatId) missing.push("Steuernummer oder USt-ID");
    if (!tenant?.invoiceIban) missing.push("IBAN");
    if (!tenant?.invoiceBankName) missing.push("Bankname");

    if (missing.length > 0) {
      return { error: `Finalisieren nicht möglich. Es fehlt: ${missing.join(", ")}.` };
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "ISSUED" as any,
        issuedAt: new Date(),
        sellerName: invoice.sellerName || tenant.invoiceSellerName,
        sellerAddress: invoice.sellerAddress || tenant.invoiceSellerAddress,
        sellerTaxNumber: invoice.sellerTaxNumber || tenant.invoiceTaxNumber,
        sellerVatId: invoice.sellerVatId || tenant.invoiceVatId,
        paymentTermsDe: invoice.paymentTermsDe || tenant.invoicePaymentTermsDe || "Zahlbar sofort ohne Abzug.",
        paymentTermsEn: invoice.paymentTermsEn || tenant.invoicePaymentTermsEn || "Payable immediately without deduction.",
      } as any,
    });

    return { success: "Rechnung wurde finalisiert und gesperrt." };
  }

  if (intent === "markInvoicePaid") {
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

  return { error: "Unbekannte Aktion." };
}

export default function RechnungenPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Rechnungen</h1>
          <p className="muted">
            Rechnungen verwalten, Entwürfe prüfen, finalisieren und Zahlstatus verfolgen.
          </p>
        </div>

        <Link className="button primary" to="/rechnungen/neu">
          + Neue Rechnung
        </Link>
      </header>

      {actionData && "error" in actionData ? <div style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      {data.dbError ? (
        <div style={errorStyle}>
          <strong>Rechnungsdatenbank ist noch nicht sauber bereit.</strong>
          <div style={{ marginTop: 8 }}>{data.dbError}</div>
        </div>
      ) : null}

      <section style={pageGridStyle}>
        <div style={heroStyle}>
          <div style={heroCopyStyle}>
            <p style={smallLabelStyle}>Übersicht</p>
            <h2 style={heroTitleStyle}>Rechnungen & Entwürfe</h2>
            <p style={heroTextStyle}>
              Erstelle Rechnungen im Gastario-Editor, prüfe Entwürfe und behalte offene,
              bezahlte und stornierte Rechnungen sauber im Blick.
            </p>
          </div>

          <div style={heroActionsStyle}>
            <Link to="/einstellungen/rechnungen" style={secondaryButtonStyle}>
              Rechnungsdaten prüfen
            </Link>
          </div>
        </div>

        <div style={statsGridStyle}>
          <StatCard label="Entwürfe" value={data.stats.drafts} hint="Noch nicht final" tone="draft" />
          <StatCard label="Erstellt" value={data.stats.issued} hint="Finalisierte Rechnungen" tone="issued" />
          <StatCard label="Bezahlt" value={data.stats.paid} hint="Erledigt" tone="paid" />
          <StatCard label="Storniert" value={data.stats.cancelled} hint="Korrektur / Storno" tone="cancelled" />
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={smallLabelStyle}>Liste</p>
              <h2 style={sectionTitleStyle}>Alle Rechnungen</h2>
              <p style={sectionHintStyle}>
                Öffne eine Rechnung für Vorschau, PDF, Finalisierung, Zahlung oder Storno.
              </p>
            </div>


          </div>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Nummer</th>
                  <th style={thStyle}>Kunde</th>
                  <th style={thStyle}>Datum</th>
                  <th style={thStyle}>Sprache</th>
                  <th style={thRightStyle}>Summe</th>
                  <th style={thStyle}>Status</th>
                  <th style={thRightStyle}>Aktion</th>
                </tr>
              </thead>

              <tbody>
                {data.invoices.length === 0 ? (
                  <tr>
                    <td style={emptyStateStyle} colSpan={7}>
                      <div style={emptyInnerStyle}>
                        <strong>Noch keine Rechnungen vorhanden.</strong>
                        <span>Erstelle deine erste Rechnung über den Gastario-Rechnungseditor.</span>
                        <Link to="/rechnungen/neu" style={primaryButtonStyle}>Neue Rechnung erstellen</Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td style={tdStyle}>
                        <strong>{invoice.externalInvoiceNumber || "Entwurf ohne Nummer"}</strong>
                        <small style={subTextStyle}>{invoice.items?.length || 0} Position(en)</small>
                      </td>

                      <td style={tdStyle}>
                        <strong style={customerNameStyle}>{invoice.customerName}</strong>
                      </td>

                      <td style={tdStyle}>{formatDate(invoice.invoiceDate)}</td>

                      <td style={tdStyle}>{invoice.language || "DE"}</td>

                      <td style={tdRightStyle}>
                        <strong>{centsToEuro(invoice.grossTotalCents)}</strong>
                      </td>

                      <td style={tdStyle}>
                        <span style={{
                          ...statusPillStyle,
                          ...(invoice.status === "DRAFT" ? draftPillStyle : {}),
                          ...(invoice.status === "ISSUED" ? issuedPillStyle : {}),
                          ...(invoice.status === "PAID" ? paidPillStyle : {}),
                          ...(invoice.status === "CANCELLED" ? cancelledPillStyle : {}),
                        }}>
                          {statusLabel(invoice.status)}
                        </span>
                      </td>

                      <td style={tdRightStyle}>
                        <div style={rowActionsStyle}>
                          <Link to={`/rechnungen/${invoice.id}`} style={miniButtonStyle}>Öffnen</Link>

                          {invoice.status === "DRAFT" ? (
                            <Form method="post">
                              <input type="hidden" name="intent" value="finalizeInvoice" />
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <button type="submit" style={miniPrimaryButtonStyle}>Finalisieren</button>
                            </Form>
                          ) : null}

                          {invoice.status === "ISSUED" ? (
                            <Form method="post">
                              <input type="hidden" name="intent" value="markInvoicePaid" />
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <button type="submit" style={miniButtonStyle}>Bezahlt</button>
                            </Form>
                          ) : null}

                          {invoice.status !== "CANCELLED" && invoice.status !== "PAID" ? (
                            <Form method="post">
                              <input type="hidden" name="intent" value="cancelInvoice" />
                              <input type="hidden" name="invoiceId" value={invoice.id} />
                              <button type="submit" style={miniDangerButtonStyle}>Stornieren</button>
                            </Form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "draft" | "issued" | "paid" | "cancelled";
}) {
  return (
    <div style={statCardStyle}>
      <div style={{
        ...statIconStyle,
        ...(tone === "draft" ? statDraftStyle : {}),
        ...(tone === "issued" ? statIssuedStyle : {}),
        ...(tone === "paid" ? statPaidStyle : {}),
        ...(tone === "cancelled" ? statCancelledStyle : {}),
      }}>
        {value}
      </div>
      <div>
        <span style={statLabelStyle}>{label}</span>
        <small style={statHintStyle}>{hint}</small>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: any }) {
  return (
    <AppLayout>
      <div style={errorStyle}>
        <strong>Rechnungen konnten nicht geladen werden.</strong>
        <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
          {error?.message || String(error) || "Unbekannter Fehler"}
        </div>
      </div>
    </AppLayout>
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

const heroCopyStyle: React.CSSProperties = {
  maxWidth: 760,
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#057a67",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 11,
  fontWeight: 950,
};

const heroTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 26,
  letterSpacing: "-0.045em",
  color: "#0f172a",
};

const heroTextStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#475569",
  fontWeight: 650,
  lineHeight: 1.55,
};

const heroActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const statCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.055)",
};

const statIconStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: 950,
  background: "#f1f5f9",
  color: "#0f172a",
};

const statDraftStyle: React.CSSProperties = { background: "#fff7ed", color: "#9a3412" };
const statIssuedStyle: React.CSSProperties = { background: "#eff6ff", color: "#1d4ed8" };
const statPaidStyle: React.CSSProperties = { background: "#ecfdf5", color: "#047857" };
const statCancelledStyle: React.CSSProperties = { background: "#fff1f2", color: "#be123c" };

const statLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
};

const statHintStyle: React.CSSProperties = {
  display: "block",
  marginTop: 3,
  color: "#64748b",
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 24,
  letterSpacing: "-0.04em",
};

const sectionHintStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontWeight: 650,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 13,
  padding: "0 18px",
  border: "1px solid #036b5a",
  background: "linear-gradient(135deg, #058872 0%, #04705f 100%)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(5, 122, 103, 0.24)",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 13,
  padding: "0 18px",
  border: "1px solid #c8d4dd",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  background: "#ffffff",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: 12,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "16px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
};

const customerNameStyle: React.CSSProperties = {
  fontWeight: 760,
};

const subTextStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  color: "#64748b",
  fontWeight: 650,
};

const emptyStateStyle: React.CSSProperties = {
  padding: 34,
  textAlign: "center",
  color: "#64748b",
};

const emptyInnerStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 9,
};

const statusPillStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "6px 10px",
  background: "#f1f5f9",
  color: "#334155",
  fontSize: 12,
  fontWeight: 900,
};

const draftPillStyle: React.CSSProperties = { background: "#fff7ed", color: "#9a3412" };
const issuedPillStyle: React.CSSProperties = { background: "#eff6ff", color: "#1d4ed8" };
const paidPillStyle: React.CSSProperties = { background: "#ecfdf5", color: "#047857" };
const cancelledPillStyle: React.CSSProperties = { background: "#fff1f2", color: "#be123c" };

const rowActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const miniBaseButtonStyle: React.CSSProperties = {
  minHeight: 34,
  borderRadius: 10,
  padding: "0 12px",
  fontSize: 12,
  fontWeight: 850,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const miniPrimaryButtonStyle: React.CSSProperties = {
  ...miniBaseButtonStyle,
  border: "1px solid #057a67",
  background: "#057a67",
  color: "#ffffff",
};

const miniButtonStyle: React.CSSProperties = {
  ...miniBaseButtonStyle,
  border: "1px solid #c8d4dd",
  background: "#ffffff",
  color: "#0f172a",
};

const miniDangerButtonStyle: React.CSSProperties = {
  ...miniBaseButtonStyle,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#be123c",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
  marginBottom: 16,
};

const successStyle: React.CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#047857",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
  marginBottom: 16,
};

