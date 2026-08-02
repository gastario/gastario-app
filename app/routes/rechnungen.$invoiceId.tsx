import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import "../styles/gastario-documents.css";

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
    include: { tenant: true },
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
      return {
        error: `Finalisieren nicht möglich. Es fehlt: ${missing.join(", ")}.`,
      };
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

export default function RechnungDetailPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const invoice = data.invoice;

  return (
    <AppLayout>
      <PageShell className="documentsPage invoiceDetailPage">
        <PageHeader
          eyebrow="Finanzen"
          title={
            invoice.externalInvoiceNumber ||
            "Rechnungsentwurf"
          }
          subtitle={
            <>
              {invoice.customerName || "Ohne Kunde"} · Rechnung prüfen,
              Status verwalten und als PDF ausgeben.
            </>
          }
          actions={
            <>
              <span
                className={
                  "g-doc-status is-" +
                  String(invoice.status || "")
                    .toLowerCase()
                    .replace(/_/g, "-")
                }
              >
                {statusLabel(invoice.status)}
              </span>

              <Link
                className="g-doc-button g-doc-button--secondary"
                to="/rechnungen"
              >
                Zur Übersicht
              </Link>

              <Link
                className="g-doc-button g-doc-button--primary"
                to={`/rechnungen/${invoice.id}/pdf`}
                target="_blank"
              >
                PDF / Drucken
              </Link>
            </>
          }
        />

        {actionData && "error" in actionData ? (
          <Notice type="danger">{actionData.error}</Notice>
        ) : null}

        {actionData && "success" in actionData ? (
          <Notice type="success">{actionData.success}</Notice>
        ) : null}

        <PageSection
          className="invoiceStatusSection"
          eyebrow="Bearbeitungsstand"
          title={statusLabel(invoice.status)}
          description={
            invoice.status === "DRAFT"
              ? "Der Entwurf kann noch geprüft und anschließend finalisiert werden."
              : invoice.status === "ISSUED"
                ? "Die Rechnung ist finalisiert und kann als bezahlt markiert werden."
                : invoice.status === "PAID"
                  ? "Die Rechnung ist vollständig bezahlt."
                  : invoice.status === "CANCELLED"
                    ? "Die Rechnung wurde storniert und bleibt im Archiv."
                    : "Der aktuelle Rechnungsstatus wird hier verwaltet."
          }
          actions={
            <>
              {invoice.status === "DRAFT" ? (
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="finalizeInvoice"
                  />
                  <button
                    className="g-doc-button g-doc-button--primary"
                    type="submit"
                  >
                    Finalisieren
                  </button>
                </Form>
              ) : null}

              {invoice.status === "ISSUED" ? (
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="markInvoicePaid"
                  />
                  <button
                    className="g-doc-button g-doc-button--secondary"
                    type="submit"
                  >
                    Als bezahlt markieren
                  </button>
                </Form>
              ) : null}

              {invoice.status !== "CANCELLED" &&
              invoice.status !== "PAID" ? (
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="cancelInvoice"
                  />
                  <button
                    className="g-doc-button g-doc-button--danger"
                    type="submit"
                  >
                    Stornieren
                  </button>
                </Form>
              ) : null}
            </>
          }
        >
          <div className="invoiceStatusFacts">
            <div>
              <span>Kunde</span>
              <strong>{invoice.customerName || "Ohne Kunde"}</strong>
            </div>

            <div>
              <span>Rechnungsdatum</span>
              <strong>{formatDate(invoice.invoiceDate)}</strong>
            </div>

            <div>
              <span>Gesamtbetrag</span>
              <strong>{centsToEuro(invoice.grossTotalCents)}</strong>
            </div>

            <div>
              <span>Positionen</span>
              <strong>{invoice.items.length}</strong>
            </div>
          </div>
        </PageSection>

        <PageSection
          className="invoicePreviewSection"
          eyebrow="Dokument"
          title="Rechnungsvorschau"
          description="Inhaltliche Vorschau der gespeicherten Rechnung."
          actions={
            <Link
              className="g-doc-button g-doc-button--secondary"
              to={`/rechnungen/${invoice.id}/pdf`}
              target="_blank"
            >
              PDF öffnen
            </Link>
          }
        >
          <article className="invoiceDocumentPreview">
            <div className="invoiceDocumentHeader">
              <div>
                <p className="invoiceDocumentLabel">Rechnung an</p>
                <h2>{invoice.customerName || "Ohne Kunde"}</h2>
                <p className="invoiceDocumentAddress">
                  {invoice.customerAddress ||
                    "Keine Kundenadresse hinterlegt"}
                </p>
              </div>

              <div className="invoiceDocumentMeta">
                <MetaRow
                  label="Rechnungsnummer"
                  value={invoice.externalInvoiceNumber || "-"}
                />
                <MetaRow
                  label="Rechnungsdatum"
                  value={formatDate(invoice.invoiceDate)}
                />
                <MetaRow
                  label="Leistungsdatum"
                  value={formatDate(invoice.serviceDate)}
                />
                <MetaRow
                  label="Sprache"
                  value={invoice.language || "DE"}
                />
              </div>
            </div>

            <div className="invoiceSellerLine">
              <div>
                <span>Rechnungssteller</span>
                <strong>
                  {invoice.sellerName || data.tenantName}
                </strong>
              </div>

              <p>
                {invoice.sellerAddress ||
                  "Firmendaten werden aus den Rechnungseinstellungen übernommen."}
              </p>
            </div>

            <div className="g-doc-table-wrap invoiceItemsTableWrap">
              <table className="g-doc-table invoiceItemsTable">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Beschreibung</th>
                    <th className="isNumeric">Menge</th>
                    <th className="isNumeric">Einzelpreis</th>
                    <th className="isNumeric">USt.</th>
                    <th className="isNumeric">Gesamt</th>
                  </tr>
                </thead>

                <tbody>
                  {invoice.items.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        Keine Positionen vorhanden.
                      </td>
                    </tr>
                  ) : (
                    invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.position}</td>
                        <td>
                          <strong>{item.name}</strong>
                          {item.description ? (
                            <small>{item.description}</small>
                          ) : null}
                        </td>
                        <td className="isNumeric">
                          {item.quantity.toLocaleString("de-DE")}{" "}
                          {item.unit}
                        </td>
                        <td className="isNumeric">
                          {centsToEuro(item.unitCents)}
                        </td>
                        <td className="isNumeric">
                          {item.taxRate} %
                        </td>
                        <td className="isNumeric">
                          <strong>
                            {centsToEuro(item.grossTotalCents)}
                          </strong>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="invoiceTotals">
              <TotalRow
                label="Netto"
                value={centsToEuro(invoice.netTotalCents)}
              />
              <TotalRow
                label="Umsatzsteuer"
                value={centsToEuro(invoice.taxTotalCents)}
              />
              <div className="invoiceGrandTotal">
                <span>Gesamtbetrag</span>
                <strong>
                  {centsToEuro(invoice.grossTotalCents)}
                </strong>
              </div>
            </div>

            <div className="invoiceDocumentFooter">
              <div>
                <strong>Zahlungsbedingung</strong>
                <span>
                  {invoice.paymentTermsDe ||
                    "Zahlbar sofort ohne Abzug."}
                </span>
              </div>

              {invoice.reverseChargeNoteDe ? (
                <div>
                  <strong>Steuerhinweis</strong>
                  <span>{invoice.reverseChargeNoteDe}</span>
                </div>
              ) : null}
            </div>
          </article>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="invoiceMetaRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="invoiceTotalRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: any }) {
  return (
    <AppLayout>
      <PageShell className="documentsPage">
        <PageHeader
          eyebrow="Finanzen"
          title="Rechnung"
          subtitle="Die Rechnung konnte nicht geladen werden."
        />

        <Notice type="danger">
          <strong>Rechnung konnte nicht geladen werden.</strong>
          <span>
            {error?.message || String(error) || "Unbekannter Fehler"}
          </span>
        </Notice>
      </PageShell>
    </AppLayout>
  );
}
