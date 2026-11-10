import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioBadge,
  GastarioDataList,
  GastarioDataRow,
  GastarioEmptyState,
  gastarioButtonClass,
} from "../components/ui";

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
      <GastarioPage>
        <GastarioHeader
          eyebrow="Finanzen"
          title="Rechnungen"
          subtitle={
            <>
              {data.tenantName} · Entwürfe erstellen, Rechnungen finalisieren und Zahlungen nachvollziehbar verwalten.
            </>
          }
          actions={
            <>
              <Link to="/einstellungen/rechnungen" className={gastarioButtonClass("secondary")}>
                Rechnungsdaten
              </Link>
              <Link to="/rechnungen/neu" className={gastarioButtonClass("primary")}>
                + Neue Rechnung
              </Link>
            </>
          }
        />

        {actionData && "error" in actionData ? (
          <GastarioNotice type="danger">{actionData.error}</GastarioNotice>
        ) : null}
        {actionData && "success" in actionData ? (
          <GastarioNotice type="success">{actionData.success}</GastarioNotice>
        ) : null}
        {data.dbError ? (
          <GastarioNotice type="danger">
            <strong>Rechnungsdaten konnten nicht vollständig geladen werden.</strong>
            {" "}{data.dbError}
          </GastarioNotice>
        ) : null}

        <GastarioMetricGrid>
          <GastarioMetric
            label="Entwürfe"
            value={data.stats.drafts}
            description="Noch nicht finalisiert"
            badge="Offen"
            attention={data.stats.drafts > 0}
          />
          <GastarioMetric
            label="Erstellt"
            value={data.stats.issued}
            description="Finalisierte Rechnungen"
            badge="Aktiv"
          />
          <GastarioMetric
            label="Bezahlt"
            value={data.stats.paid}
            description="Vollständig erledigt"
            badge="Erledigt"
          />
          <GastarioMetric
            label="Storniert"
            value={data.stats.cancelled}
            description="Storno oder Korrektur"
            badge="Archiv"
          />
        </GastarioMetricGrid>

        <GastarioSection
          eyebrow="Rechnungsübersicht"
          title="Alle Rechnungen"
          description="Belege öffnen, finalisieren und Zahlungen sowie Stornierungen verwalten."
          action={
            <GastarioBadge variant="neutral">
              {data.invoices.length === 1 ? "1 Rechnung" : `${data.invoices.length} Rechnungen`}
            </GastarioBadge>
          }
        >
          {data.invoices.length === 0 ? (
            <GastarioEmptyState title="Noch keine Rechnungen vorhanden">
              <p>Erstelle den ersten Rechnungsentwurf direkt im Gastario-Rechnungseditor.</p>
              <Link to="/rechnungen/neu" className={gastarioButtonClass("secondary")}>
                Rechnung erstellen
              </Link>
            </GastarioEmptyState>
          ) : (
            <GastarioDataList>
              {data.invoices.map((invoice) => (
                <GastarioDataRow key={invoice.id}>
                  <div className="g-ui-data-row-main">
                    <span className="g-ui-data-row-description">
                      {invoice.externalInvoiceNumber || "Entwurf ohne Nummer"}
                    </span>
                    <strong className="g-ui-data-row-title">
                      {invoice.customerName || "Ohne Kunde"}
                    </strong>
                    <span className="g-ui-data-row-description">
                      {formatDate(invoice.invoiceDate)}
                      {" · "}{invoice.language || "DE"}
                      {" · "}{invoice.items?.length || 0} Position(en)
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <GastarioBadge variant={
                      invoice.status === "PAID" ? "success"
                        : invoice.status === "CANCELLED" ? "danger"
                        : invoice.status === "DRAFT" ? "warning" : "neutral"
                    }>
                      {statusLabel(invoice.status)}
                    </GastarioBadge>
                    <strong>{centsToEuro(invoice.grossTotalCents)}</strong>
                  </div>

                  <div className="g-ui-data-row-actions">
                    <Link to={`/rechnungen/${invoice.id}`} className={gastarioButtonClass("secondary")}>
                      Öffnen
                    </Link>
                    {invoice.status === "DRAFT" ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="finalizeInvoice" />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button type="submit" className={gastarioButtonClass("primary")}>
                          Finalisieren
                        </button>
                      </Form>
                    ) : null}
                    {invoice.status === "ISSUED" ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="markInvoicePaid" />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button type="submit" className={gastarioButtonClass("secondary")}>
                          Bezahlt
                        </button>
                      </Form>
                    ) : null}
                    {invoice.status !== "CANCELLED" && invoice.status !== "PAID" ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="cancelInvoice" />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button type="submit" className={gastarioButtonClass("danger")}>
                          Stornieren
                        </button>
                      </Form>
                    ) : null}
                  </div>
                </GastarioDataRow>
              ))}
            </GastarioDataList>
          )}
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}

export function ErrorBoundary({ error }: { error: any }) {
  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Finanzen"
          title="Rechnungen"
          subtitle="Die Rechnungsübersicht konnte nicht geladen werden."
        />

        <GastarioNotice type="danger">
          <strong>Rechnungen konnten nicht geladen werden.</strong>
          <span>
            {error?.message || String(error) || "Unbekannter Fehler"}
          </span>
        </GastarioNotice>
      </GastarioPage>
    </AppLayout>
  );
}
