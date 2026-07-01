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
  return [{ title: "Rechnung · Gastario" }];
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
    invoice,
  };
}

export async function action({ request, params }: { request: Request; params: { invoiceId?: string } }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
  });

  if (!access) {
    return { error: "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: params.invoiceId,
      tenantId: access.tenantId,
    },
  });

  if (!invoice) {
    return { error: "Rechnung wurde nicht gefunden." };
  }

  if (intent === "finalizeInvoice") {
    if (invoice.status !== "DRAFT") {
      return { error: "Nur Entwürfe können finalisiert werden." };
    }

    if (!invoice.externalInvoiceNumber) {
      return { error: "Rechnungsnummer fehlt." };
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

export default function RechnungDetailPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const invoice = data.invoice;

  return (
    <AppLayout>
      <div style={backRowStyle}>
        <Link to="/rechnungen" style={backButtonStyle}>
          ← Zurück zu Rechnungen
        </Link>
      </div>

      <header className="topbar">
        <div>
          <p className="eyebrow">Rechnung</p>
          <h1>{invoice.externalInvoiceNumber || "Entwurf ohne Nummer"}</h1>
          <p className="muted">
            Rechnung prüfen, Status verwalten und später als PDF ausgeben.
          </p>
        </div>

        <div style={headerActionsStyle}>
          <span style={{
            ...statusPillStyle,
            ...(invoice.status === "DRAFT" ? draftPillStyle : {}),
            ...(invoice.status === "ISSUED" ? issuedPillStyle : {}),
            ...(invoice.status === "PAID" ? paidPillStyle : {}),
            ...(invoice.status === "CANCELLED" ? cancelledPillStyle : {}),
          }}>
            {statusLabel(invoice.status)}
          </span>

          <Link className="button secondary" to="/rechnungen">
            Zur Übersicht
          </Link>
        </div>
      </header>

      {actionData && "error" in actionData ? <div style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      <section style={pageGridStyle}>
        <div style={actionCardStyle}>
          <div>
            <p style={smallLabelStyle}>Status</p>
            <h2 style={actionTitleStyle}>{statusLabel(invoice.status)}</h2>
            <p style={heroTextStyle}>
              Entwürfe können finalisiert werden. Nach dem Finalisieren soll die Rechnung später nicht mehr direkt überschrieben werden.
            </p>
          </div>

          <div style={actionBarStyle}>
            {invoice.status === "DRAFT" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="finalizeInvoice" />
                <button type="submit" style={primaryButtonStyle}>Finalisieren</button>
              </Form>
            ) : null}

            {invoice.status === "ISSUED" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="markInvoicePaid" />
                <button type="submit" style={secondaryButtonStyle}>Als bezahlt markieren</button>
              </Form>
            ) : null}

            {invoice.status !== "CANCELLED" && invoice.status !== "PAID" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="cancelInvoice" />
                <button type="submit" style={dangerButtonStyle}>Stornieren</button>
              </Form>
            ) : null}
          </div>
        </div>

        <div style={previewWrapStyle}>
          <div style={previewToolbarStyle}>
            <div>
              <p style={smallLabelStyle}>Vorschau</p>
              <h2 style={previewTitleStyle}>Rechnung</h2>
            </div>

            <div style={toolbarRightStyle}>
              <Link to={`/rechnungen/${invoice.id}/pdf`} target="_blank" style={ghostButtonStyle}>PDF / Drucken</Link>
            </div>
          </div>

          <div style={previewCardStyle}>
            <div style={invoiceTopStyle}>
              <div>
                <p style={tinyTextStyle}>Rechnung an</p>
                <h2 style={customerTitleStyle}>{invoice.customerName}</h2>
                <p style={addressStyle}>{invoice.customerAddress || "Keine Adresse hinterlegt"}</p>
              </div>

              <div style={metaBoxStyle}>
                <MetaRow label="Rechnungsnummer" value={invoice.externalInvoiceNumber || "-"} />
                <MetaRow label="Rechnungsdatum" value={formatDate(invoice.invoiceDate)} />
                <MetaRow label="Leistungsdatum" value={formatDate(invoice.serviceDate)} />
                <MetaRow label="Sprache" value={invoice.language || "DE"} />
              </div>
            </div>

            <div style={sellerBoxStyle}>
              <div>
                <p style={tinyTextStyle}>Von</p>
                <strong>{invoice.sellerName || data.tenantName}</strong>
              </div>
              <span>{invoice.sellerAddress || "Firmendaten werden später aus Einstellungen übernommen."}</span>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Pos.</th>
                  <th style={thStyle}>Beschreibung</th>
                  <th style={thRightStyle}>Menge</th>
                  <th style={thRightStyle}>Einzelpreis</th>
                  <th style={thRightStyle}>MwSt</th>
                  <th style={thRightStyle}>Gesamt</th>
                </tr>
              </thead>

              <tbody>
                {invoice.items.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={6}>Keine Positionen vorhanden.</td>
                  </tr>
                ) : (
                  invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>{item.position}</td>
                      <td style={tdStyle}>
                        <strong>{item.name}</strong>
                        {item.description ? <small style={subTextStyle}>{item.description}</small> : null}
                      </td>
                      <td style={tdRightStyle}>{item.quantity.toLocaleString("de-DE")} {item.unit}</td>
                      <td style={tdRightStyle}>{centsToEuro(item.unitCents)}</td>
                      <td style={tdRightStyle}>{item.taxRate} %</td>
                      <td style={tdRightStyle}><strong>{centsToEuro(item.grossTotalCents)}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={totalsStyle}>
              <TotalRow label="Netto" value={centsToEuro(invoice.netTotalCents)} />
              <TotalRow label="MwSt" value={centsToEuro(invoice.taxTotalCents)} />
              <div style={grandTotalStyle}>
                <span>Gesamtbetrag</span>
                <strong>{centsToEuro(invoice.grossTotalCents)}</strong>
              </div>
            </div>

            <div style={footerNoteStyle}>
              <div>
                <strong>Zahlungsbedingung</strong>
                <span>{invoice.paymentTermsDe || "Zahlbar sofort ohne Abzug."}</span>
              </div>

              {invoice.reverseChargeNoteDe ? (
                <div>
                  <strong>Steuerhinweis</strong>
                  <span>{invoice.reverseChargeNoteDe}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
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

export function ErrorBoundary({ error }: { error: any }) {
  return (
    <AppLayout>
      <div style={errorStyle}>
        <strong>Rechnung konnte nicht geladen werden.</strong>
        <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
          {error?.message || String(error) || "Unbekannter Fehler"}
        </div>
      </div>
    </AppLayout>
  );
}

const backRowStyle: React.CSSProperties = {
  marginBottom: 12,
};

const backButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#0f766e",
  fontWeight: 900,
  textDecoration: "none",
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const pageGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const actionCardStyle: React.CSSProperties = {
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

const tinyTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontSize: 11,
  fontWeight: 900,
};

const actionTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 24,
  letterSpacing: "-0.035em",
};

const heroTextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  fontWeight: 650,
};

const actionBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const previewWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const previewToolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
};

const previewTitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 24,
  letterSpacing: "-0.035em",
};

const toolbarRightStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
};

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 999,
  padding: "9px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const previewCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 34,
  boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
};

const invoiceTopStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 360px",
  gap: 34,
  alignItems: "start",
};

const customerTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 24,
  letterSpacing: "-0.035em",
};

const addressStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  color: "#475569",
  fontWeight: 650,
  marginTop: 10,
  lineHeight: 1.55,
};

const metaBoxStyle: React.CSSProperties = {
  border: "1px solid #dbe3ec",
  borderRadius: 18,
  padding: 18,
  display: "grid",
  gap: 12,
  background: "#f8fafc",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  color: "#475569",
};

const sellerBoxStyle: React.CSSProperties = {
  marginTop: 28,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 20,
  display: "grid",
  gap: 6,
  color: "#475569",
  lineHeight: 1.55,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 30,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "13px 10px",
  borderBottom: "2px solid #e2e8f0",
  color: "#64748b",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "16px 10px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
};

const subTextStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  color: "#64748b",
};

const totalsStyle: React.CSSProperties = {
  marginTop: 24,
  marginLeft: "auto",
  width: 360,
  display: "grid",
  gap: 10,
};

const totalRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  color: "#475569",
  fontWeight: 750,
};

const grandTotalStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  borderTop: "2px solid #0f172a",
  paddingTop: 12,
  marginTop: 4,
  fontSize: 20,
};

const footerNoteStyle: React.CSSProperties = {
  marginTop: 34,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 20,
  display: "grid",
  gap: 14,
  color: "#475569",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#059669",
  color: "#ffffff",
  borderRadius: 999,
  padding: "11px 16px",
  fontWeight: 950,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 999,
  padding: "11px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "11px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const statusPillStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "7px 11px",
  background: "#f1f5f9",
  color: "#334155",
  fontSize: 12,
  fontWeight: 900,
};

const draftPillStyle: React.CSSProperties = { background: "#fef3c7", color: "#92400e" };
const issuedPillStyle: React.CSSProperties = { background: "#dbeafe", color: "#1d4ed8" };
const paidPillStyle: React.CSSProperties = { background: "#dcfce7", color: "#166534" };
const cancelledPillStyle: React.CSSProperties = { background: "#fee2e2", color: "#991b1b" };

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
