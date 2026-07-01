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
      <header className="topbar">
        <div>
          <p className="eyebrow">Rechnung</p>
          <h1>{invoice.externalInvoiceNumber || "Entwurf ohne Nummer"}</h1>
          <p className="muted">
            Rechnung prüfen, Status verwalten und später als PDF ausgeben.
          </p>
        </div>

        <Link className="button secondary" to="/rechnungen">
          Zur Übersicht
        </Link>
      </header>

      {actionData && "error" in actionData ? <div style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      <section style={pageGridStyle}>
        <div style={heroStyle}>
          <div>
            <p style={smallLabelStyle}>Status</p>
            <h2 style={heroTitleStyle}>{statusLabel(invoice.status)}</h2>
            <p style={heroTextStyle}>
              Entwürfe können noch finalisiert werden. Finalisierte Rechnungen sollten später nicht einfach überschrieben werden.
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

        <div style={previewCardStyle}>
          <div style={invoiceHeaderStyle}>
            <div>
              <p style={smallLabelStyle}>Rechnung an</p>
              <h2 style={{ margin: "6px 0 0" }}>{invoice.customerName}</h2>
              <p style={addressStyle}>{invoice.customerAddress || "Keine Adresse hinterlegt"}</p>
            </div>

            <div style={metaBoxStyle}>
              <div>
                <span>Rechnungsnummer</span>
                <strong>{invoice.externalInvoiceNumber || "-"}</strong>
              </div>
              <div>
                <span>Rechnungsdatum</span>
                <strong>{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString("de-DE") : "-"}</strong>
              </div>
              <div>
                <span>Leistungsdatum</span>
                <strong>{invoice.serviceDate ? new Date(invoice.serviceDate).toLocaleDateString("de-DE") : "-"}</strong>
              </div>
              <div>
                <span>Sprache</span>
                <strong>{invoice.language || "DE"}</strong>
              </div>
            </div>
          </div>

          <div style={sellerBoxStyle}>
            <strong>{invoice.sellerName || data.tenantName}</strong>
            {invoice.sellerAddress ? <span>{invoice.sellerAddress}</span> : <span>Firmendaten werden später aus Einstellungen übernommen.</span>}
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
            <div>
              <span>Netto</span>
              <strong>{centsToEuro(invoice.netTotalCents)}</strong>
            </div>
            <div>
              <span>MwSt</span>
              <strong>{centsToEuro(invoice.taxTotalCents)}</strong>
            </div>
            <div style={grandTotalStyle}>
              <span>Gesamtbetrag</span>
              <strong>{centsToEuro(invoice.grossTotalCents)}</strong>
            </div>
          </div>

          <div style={footerNoteStyle}>
            <strong>Zahlungsbedingung</strong>
            <span>{invoice.paymentTermsDe || "Zahlbar sofort ohne Abzug."}</span>
          </div>
        </div>
      </section>
    </AppLayout>
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

const previewCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 28,
  boxShadow: "0 16px 40px rgba(15,23,42,0.07)",
};

const invoiceHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 340px",
  gap: 30,
  alignItems: "start",
};

const addressStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  color: "#475569",
  fontWeight: 650,
  marginTop: 10,
};

const metaBoxStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 10,
  background: "#f8fafc",
};

const sellerBoxStyle: React.CSSProperties = {
  marginTop: 24,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 18,
  display: "grid",
  gap: 4,
  color: "#475569",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 26,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "2px solid #e2e8f0",
  color: "#64748b",
  fontSize: 12,
  textTransform: "uppercase",
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 10px",
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
  marginTop: 20,
  marginLeft: "auto",
  width: 340,
  display: "grid",
  gap: 10,
};

const grandTotalStyle: React.CSSProperties = {
  borderTop: "2px solid #0f172a",
  paddingTop: 10,
  fontSize: 18,
};

const footerNoteStyle: React.CSSProperties = {
  marginTop: 30,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 18,
  display: "grid",
  gap: 6,
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
