import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import AppLayout from "../components/AppLayout";
import {
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import "../styles/angebote.css";

function euroToCents(value: FormDataEntryValue | null) {
  const normalized = String(value || "0")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(number * 100);
}

export function meta() {
  return [{ title: "Neues Angebot · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import(
    "../lib/features.server"
  );

  const access = await getTenantAccess(request);

  if (!access.tenantId || !access.tenant) {
    return {
      tenant: null,
      setupError:
        access.setupError || "Kein Mandant gefunden.",
      customers: [],
      products: [],
    };
  }

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: {
        tenantId: access.tenantId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.product.findMany({
      where: {
        tenantId: access.tenantId,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    tenant: access.tenant,
    setupError: access.setupError,
    customers,
    products,
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import(
    "../lib/features.server"
  );

  const access = await getTenantAccess(request);

  if (!access.tenantId) {
    return {
      error: "Kein Mandant gefunden.",
    };
  }

  const formData = await request.formData();

  const customerId = String(
    formData.get("customerId") || ""
  ).trim();

  const eventName = String(
    formData.get("eventName") || ""
  ).trim();

  const eventDateRaw = String(
    formData.get("eventDate") || ""
  ).trim();

  const validUntilRaw = String(
    formData.get("validUntil") || ""
  ).trim();

  const deliveryTimeText = String(
    formData.get("deliveryTimeText") || ""
  ).trim();

  const deliveryAddress = String(
    formData.get("deliveryAddress") || ""
  ).trim();

  const productId = String(
    formData.get("productId") || ""
  ).trim();

  const customItemName = String(
    formData.get("customItemName") || ""
  ).trim();

  const quantityRaw = Number(
    formData.get("quantity") || 1
  );

  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw > 0
      ? Math.round(quantityRaw)
      : 1;

  const unit = String(
    formData.get("unit") || "Portion"
  ).trim();

  const unitCents = euroToCents(
    formData.get("unitPrice")
  );

  const notes = String(
    formData.get("notes") || ""
  ).trim();

  if (!customerId) {
    return {
      error: "Bitte einen Kunden auswählen.",
    };
  }

  if (!productId && !customItemName) {
    return {
      error:
        "Bitte ein Produkt auswählen oder eine freie Position eingeben.",
    };
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: access.tenantId,
    },
  });

  if (!customer) {
    return {
      error: "Der ausgewählte Kunde wurde nicht gefunden.",
    };
  }

  const product = productId
    ? await prisma.product.findFirst({
        where: {
          id: productId,
          tenantId: access.tenantId,
        },
      })
    : null;

  const itemName =
    customItemName || product?.name || "Position";

  const effectiveUnitCents =
    unitCents > 0
      ? unitCents
      : Number(product?.priceCents || 0);

  const totalCents = quantity * effectiveUnitCents;

  const existingQuotes = await prisma.quote.findMany({
    where: {
      tenantId: access.tenantId,
    },
    select: {
      quoteNumber: true,
    },
  });

  const year = new Date().getFullYear();

  const highestNumber = existingQuotes.reduce(
    (highest: number, quote: any) => {
      const match = String(quote.quoteNumber || "").match(
        new RegExp(`^AN-${year}-(\\d+)$`)
      );

      if (!match) return highest;

      return Math.max(highest, Number(match[1]));
    },
    0
  );

  let nextNumber = highestNumber + 1;
  let createdQuote: any = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const quoteNumber =
      `AN-${year}-` +
      String(nextNumber).padStart(4, "0");

    try {
      createdQuote = await prisma.quote.create({
        data: {
          tenantId: access.tenantId,
          customerId: customer.id,
          quoteNumber,
          status: "DRAFT",
          customerName: customer.name,
          eventName: eventName || null,
          eventDate: eventDateRaw
            ? new Date(`${eventDateRaw}T12:00:00`)
            : null,
          deliveryTimeText:
            deliveryTimeText || null,
          deliveryAddress:
            deliveryAddress ||
            customer.address ||
            null,
          contactName:
            customer.contactName || null,
          contactEmail:
            customer.email || null,
          contactPhone:
            customer.phone || null,
          validUntil: validUntilRaw
            ? new Date(`${validUntilRaw}T12:00:00`)
            : null,
          notes: notes || null,
          subtotalCents: totalCents,
          discountCents: 0,
          totalCents,
          items: {
            create: {
              productId: product?.id || null,
              name: itemName,
              quantity,
              unit: unit || "Portion",
              unitCents: effectiveUnitCents,
              totalCents,
              taxRate: Number(product?.taxRate || 7),
              sortOrder: 0,
            },
          },
        },
      });

      break;
    } catch (error: any) {
      if (error?.code === "P2002") {
        nextNumber += 1;
        continue;
      }

      throw error;
    }
  }

  if (!createdQuote) {
    return {
      error:
        "Es konnte keine freie Angebotsnummer erzeugt werden.",
    };
  }

  throw redirect(`/angebote/${createdQuote.id}`);
}

export default function NewQuotePage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AppLayout>
      <PageShell className="quotesPage">
        <PageHeader
          eyebrow="Verkauf"
          title="Neues Angebot"
          subtitle={
            <>
              {data.tenant?.name || "Kein Mandant"} · Kundendaten,
              Veranstaltung und erste Position erfassen.
            </>
          }
          actions={
            <Link
              to="/angebote"
              className="g-ui-button g-ui-button--secondary"
            >
              Zur Übersicht
            </Link>
          }
        />

        {data.setupError ? (
          <Notice type="warning">
            {data.setupError}
          </Notice>
        ) : null}

        {actionData?.error ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        <PageSection
          eyebrow="Angebotsdaten"
          title="Angebot anlegen"
          description="Das Angebot wird zunächst als Entwurf gespeichert."
        >
          <Form
            method="post"
            className="quoteCreateForm"
          >
            <fieldset className="customerFormGroup">
              <legend>Kunde und Veranstaltung</legend>

              <div className="quoteFormGrid">
                <label className="g-ui-field">
                  <span>Kunde *</span>
                  <select
                    name="customerId"
                    required
                    defaultValue=""
                  >
                    <option value="">
                      Kunde auswählen
                    </option>

                    {data.customers.map((customer: any) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.customerNumber
                          ? `${customer.customerNumber} · `
                          : ""}
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="g-ui-field">
                  <span>Veranstaltung</span>
                  <input
                    name="eventName"
                    placeholder="z. B. Office Lunch"
                  />
                </label>

                <label className="g-ui-field">
                  <span>Veranstaltungsdatum</span>
                  <input
                    name="eventDate"
                    type="date"
                  />
                </label>

                <label className="g-ui-field">
                  <span>Lieferzeit</span>
                  <input
                    name="deliveryTimeText"
                    type="time"
                  />
                </label>

                <label className="g-ui-field quoteFormFull">
                  <span>Lieferadresse</span>
                  <input
                    name="deliveryAddress"
                    placeholder="Wird andernfalls aus dem Kunden übernommen"
                  />
                </label>

                <label className="g-ui-field">
                  <span>Gültig bis</span>
                  <input
                    name="validUntil"
                    type="date"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="customerFormGroup">
              <legend>Erste Position</legend>

              <div className="quoteFormGrid">
                <label className="g-ui-field quoteFormFull">
                  <span>Produkt</span>
                  <select
                    name="productId"
                    defaultValue=""
                  >
                    <option value="">
                      Freie Position verwenden
                    </option>

                    {data.products.map((product: any) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="g-ui-field quoteFormFull">
                  <span>Freie Positionsbezeichnung</span>
                  <input
                    name="customItemName"
                    placeholder="Nur ausfüllen, wenn kein Produkt gewählt wurde"
                  />
                </label>

                <label className="g-ui-field">
                  <span>Menge *</span>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue="1"
                    required
                  />
                </label>

                <label className="g-ui-field">
                  <span>Einheit</span>
                  <select
                    name="unit"
                    defaultValue="Portion"
                  >
                    <option value="Portion">Portion</option>
                    <option value="Stück">Stück</option>
                    <option value="Personen">Personen</option>
                    <option value="Pauschale">Pauschale</option>
                    <option value="Stunde">Stunde</option>
                  </select>
                </label>

                <label className="g-ui-field">
                  <span>Einzelpreis netto</span>
                  <input
                    name="unitPrice"
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </label>

                <label className="g-ui-field quoteFormFull">
                  <span>Interne Hinweise</span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Besondere Absprachen oder Hinweise"
                  />
                </label>
              </div>
            </fieldset>

            <div className="quoteCreateActions">
              <Link
                to="/angebote"
                className="g-ui-button g-ui-button--secondary"
              >
                Abbrechen
              </Link>

              <button
                type="submit"
                className="g-ui-button g-ui-button--primary"
              >
                Angebot als Entwurf anlegen
              </button>
            </div>
          </Form>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}