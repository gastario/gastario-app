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

const QUOTE_STATUSES = [
  {
    value: "DRAFT",
    label: "Entwurf",
  },
  {
    value: "SENT",
    label: "Versendet",
  },
  {
    value: "WAITING",
    label: "Wartet auf Rückmeldung",
  },
  {
    value: "CONFIRMED",
    label: "Bestätigt",
  },
  {
    value: "REJECTED",
    label: "Abgelehnt",
  },
  {
    value: "EXPIRED",
    label: "Abgelaufen",
  },
];

function centsToEuro(
  value: number | null | undefined
) {
  return (
    Number(value || 0) / 100
  ).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(
  value:
    | string
    | Date
    | null
    | undefined
) {
  if (!value) {
    return "Nicht festgelegt";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Nicht festgelegt";
  }

  return date.toLocaleDateString(
    "de-DE"
  );
}

function statusLabel(
  status: string
) {
  return (
    QUOTE_STATUSES.find(
      (entry) =>
        entry.value === status
    )?.label || status
  );
}

function statusClass(
  status: string
) {
  return (
    "quoteStatus " +
    `quoteStatus--${String(
      status || "draft"
    ).toLowerCase()}`
  );
}

export function meta({
  data,
}: {
  data?: any;
}) {
  return [
    {
      title:
        data?.quote?.quoteNumber
          ? `${data.quote.quoteNumber} · Gastario`
          : "Angebot · Gastario",
    },
  ];
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: {
    quoteId?: string;
  };
}) {
  const { prisma } =
    await import(
      "../lib/prisma.server"
    );

  const { getTenantAccess } =
    await import(
      "../lib/features.server"
    );

  const access =
    await getTenantAccess(request);

  if (
    !access.tenantId ||
    !params.quoteId
  ) {
    throw new Response(
      "Angebot nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  const quote =
    await prisma.quote.findFirst({
      where: {
        id: params.quoteId,
        tenantId: access.tenantId,
      },

      include: {
        customer: true,

        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

  if (!quote) {
    throw new Response(
      "Angebot nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  return {
    tenant:
      access.tenant,
    quote,
  };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: {
    quoteId?: string;
  };
}) {
  const { prisma } =
    await import(
      "../lib/prisma.server"
    );

  const { getTenantAccess } =
    await import(
      "../lib/features.server"
    );

  const access =
    await getTenantAccess(request);

  if (
    !access.tenantId ||
    !params.quoteId
  ) {
    return {
      error:
        "Angebot nicht gefunden.",
    };
  }

  const formData =
    await request.formData();

  const intent = String(
    formData.get("intent") || ""
  );

  const quote =
    await prisma.quote.findFirst({
      where: {
        id: params.quoteId,
        tenantId: access.tenantId,
      },

      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

  if (!quote) {
    return {
      error:
        "Angebot nicht gefunden.",
    };
  }

  if (intent === "updateStatus") {
    const status = String(
      formData.get("status") || ""
    );

    const allowedStatuses =
      QUOTE_STATUSES.map(
        (entry) => entry.value
      );

    if (
      !allowedStatuses.includes(
        status
      )
    ) {
      return {
        error:
          "Der ausgewählte Status ist ungültig.",
      };
    }

    await prisma.quote.update({
      where: {
        id: quote.id,
      },

      data: {
        status,
      },
    });

    return {
      success:
        "Angebotsstatus wurde aktualisiert.",
    };
  }

  if (intent === "duplicate") {
    const {
      createQuoteWithNextNumber,
    } = await import(
      "../lib/quote-number.server"
    );

    const duplicate =
      await createQuoteWithNextNumber(
        prisma,
        access.tenantId,
        {
          customerId:
            quote.customerId,
          status: "DRAFT",
          customerName:
            quote.customerName,
          eventName:
            quote.eventName,
          eventDate:
            quote.eventDate,
          deliveryTimeText:
            quote.deliveryTimeText,
          deliveryAddress:
            quote.deliveryAddress,
          contactName:
            quote.contactName,
          contactEmail:
            quote.contactEmail,
          contactPhone:
            quote.contactPhone,
          validUntil:
            quote.validUntil,
          notes:
            quote.notes,
          subtotalCents:
            quote.subtotalCents,
          discountCents:
            quote.discountCents,
          totalCents:
            quote.totalCents,
          convertedOrderId: null,

          items: {
            create:
              quote.items.map(
                (item: any) => ({
                  productId:
                    item.productId,
                  name:
                    item.name,
                  quantity:
                    item.quantity,
                  unit:
                    item.unit,
                  unitCents:
                    item.unitCents,
                  totalCents:
                    item.totalCents,
                  taxRate:
                    item.taxRate,
                  notes:
                    item.notes,
                  sortOrder:
                    item.sortOrder,
                })
              ),
          },
        }
      );

    throw redirect(
      `/angebote/${duplicate.id}`
    );
  }

  if (intent === "delete") {
    if (
      quote.status !== "DRAFT"
    ) {
      return {
        error:
          "Nur Angebotsentwürfe können gelöscht werden.",
      };
    }

    await prisma.quote.delete({
      where: {
        id: quote.id,
      },
    });

    throw redirect("/angebote");
  }

  return {
    error:
      "Unbekannte Aktion.",
  };
}

export default function QuoteDetailPage() {
  const data =
    useLoaderData<typeof loader>();

  const actionData =
    useActionData<typeof action>();

  const quote =
    data.quote;

  const subtotalCents =
    Number(
      quote.subtotalCents || 0
    );

  const totalCents =
    Number(
      quote.totalCents || 0
    );

  const discountFactor =
    subtotalCents > 0
      ? totalCents /
        subtotalCents
      : 1;

  const taxRows =
    [0, 7, 19]
      .map((taxRate) => {
        const netForRate =
          quote.items
            .filter(
              (item: any) =>
                Number(
                  item.taxRate
                ) === taxRate
            )
            .reduce(
              (
                sum: number,
                item: any
              ) =>
                sum +
                Number(
                  item.totalCents ||
                    0
                ),
              0
            ) *
          discountFactor;

        return {
          taxRate,
          taxCents:
            Math.round(
              netForRate *
                taxRate /
                100
            ),
        };
      })
      .filter(
        (entry) =>
          entry.taxCents > 0
      );

  const taxCents =
    taxRows.reduce(
      (
        sum,
        entry
      ) =>
        sum +
        entry.taxCents,
      0
    );

  const grossCents =
    totalCents +
    taxCents;

  return (
    <AppLayout>
      <PageShell className="quotesPage">
        <PageHeader
          eyebrow="Angebot"
          title={quote.quoteNumber}
          subtitle={
            <>
              {quote.customerName}
              {" · "}
              {quote.eventName ||
                "Keine Veranstaltung"}
            </>
          }
          actions={
            <div className="quoteHeaderActions">
              <Link
                to="/angebote"
                className="quoteButton quoteButtonSecondary"
              >
                Übersicht
              </Link>

              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="duplicate"
                />

                <button
                  type="submit"
                  className="quoteButton quoteButtonSecondary"
                >
                  Duplizieren
                </button>
              </Form>
            </div>
          }
        />

        {actionData?.error ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        {actionData?.success ? (
          <Notice type="success">
            {actionData.success}
          </Notice>
        ) : null}

        <div className="quoteDetailGrid">
          <div className="quoteDetailMain">
            <PageSection
              eyebrow="Empfänger"
              title={quote.customerName}
              description="Kunden- und Veranstaltungsdaten des Angebots."
              actions={
                <span
                  className={statusClass(
                    quote.status
                  )}
                >
                  {statusLabel(
                    quote.status
                  )}
                </span>
              }
            >
              <div className="quoteDetailFacts">
                <div>
                  <small>
                    Ansprechpartner
                  </small>

                  <strong>
                    {quote.contactName ||
                      "Nicht hinterlegt"}
                  </strong>
                </div>

                <div>
                  <small>
                    E-Mail
                  </small>

                  <strong>
                    {quote.contactEmail ||
                      "Nicht hinterlegt"}
                  </strong>
                </div>

                <div>
                  <small>
                    Telefon
                  </small>

                  <strong>
                    {quote.contactPhone ||
                      "Nicht hinterlegt"}
                  </strong>
                </div>

                <div>
                  <small>
                    Veranstaltung
                  </small>

                  <strong>
                    {quote.eventName ||
                      "Nicht festgelegt"}
                  </strong>
                </div>

                <div>
                  <small>
                    Datum
                  </small>

                  <strong>
                    {formatDate(
                      quote.eventDate
                    )}
                  </strong>
                </div>

                <div>
                  <small>
                    Lieferzeit
                  </small>

                  <strong>
                    {quote.deliveryTimeText ||
                      "Nicht festgelegt"}
                  </strong>
                </div>

                <div className="quoteDetailFactWide">
                  <small>
                    Lieferadresse
                  </small>

                  <strong>
                    {quote.deliveryAddress ||
                      "Nicht festgelegt"}
                  </strong>
                </div>

                <div>
                  <small>
                    Gültig bis
                  </small>

                  <strong>
                    {formatDate(
                      quote.validUntil
                    )}
                  </strong>
                </div>
              </div>
            </PageSection>

            <PageSection
              eyebrow="Leistungen"
              title="Angebotspositionen"
              description={
                quote.items.length === 1
                  ? "1 Position"
                  : `${quote.items.length} Positionen`
              }
            >
              <div className="quoteDetailItems">
                <div className="quoteDetailItemsHead">
                  <span>Position</span>
                  <span>Menge</span>
                  <span>Einzelpreis</span>
                  <span>Steuer</span>
                  <span>Gesamt</span>
                </div>

                {quote.items.map(
                  (
                    item: any,
                    index: number
                  ) => (
                    <article
                      key={item.id}
                      className="quoteDetailItem"
                    >
                      <div>
                        <small>
                          Position{" "}
                          {index + 1}
                        </small>

                        <strong>
                          {item.name}
                        </strong>

                        {item.notes ? (
                          <p>
                            {item.notes}
                          </p>
                        ) : null}
                      </div>

                      <span>
                        {item.quantity}
                        {" "}
                        {item.unit}
                      </span>

                      <span>
                        {centsToEuro(
                          item.unitCents
                        )}
                      </span>

                      <span>
                        {item.taxRate}
                        {" %"}
                      </span>

                      <strong>
                        {centsToEuro(
                          item.totalCents
                        )}
                      </strong>
                    </article>
                  )
                )}
              </div>
            </PageSection>

            {quote.notes ? (
              <PageSection
                eyebrow="Hinweise"
                title="Interne Notiz"
              >
                <p className="quoteDetailNotes">
                  {quote.notes}
                </p>
              </PageSection>
            ) : null}
          </div>

          <aside className="quoteDetailSidebar">
            <section className="quoteSummaryCard">
              <header>
                <p>
                  Kalkulation
                </p>

                <h2>
                  Angebotssumme
                </h2>

                <span>
                  Stand des gespeicherten
                  Entwurfs.
                </span>
              </header>

              <div className="quoteSummaryLines">
                <div>
                  <span>
                    Zwischensumme netto
                  </span>

                  <strong>
                    {centsToEuro(
                      subtotalCents
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Rabatt
                  </span>

                  <strong>
                    −{" "}
                    {centsToEuro(
                      quote.discountCents
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Nettobetrag
                  </span>

                  <strong>
                    {centsToEuro(
                      totalCents
                    )}
                  </strong>
                </div>

                {taxRows.map(
                  (tax) => (
                    <div
                      key={
                        tax.taxRate
                      }
                    >
                      <span>
                        Umsatzsteuer{" "}
                        {tax.taxRate}
                        {" %"}
                      </span>

                      <strong>
                        {centsToEuro(
                          tax.taxCents
                        )}
                      </strong>
                    </div>
                  )
                )}
              </div>

              <div className="quoteSummaryTotal">
                <span>
                  Gesamt brutto
                </span>

                <strong>
                  {centsToEuro(
                    grossCents
                  )}
                </strong>
              </div>
            </section>

            <PageSection
              eyebrow="Workflow"
              title="Angebotsstatus"
              description="Dokumentiere den aktuellen Bearbeitungsstand."
            >
              <Form
                method="post"
                className="quoteStatusForm"
              >
                <input
                  type="hidden"
                  name="intent"
                  value="updateStatus"
                />

                <label className="quoteField">
                  <span>Status</span>

                  <select
                    name="status"
                    defaultValue={
                      quote.status
                    }
                  >
                    {QUOTE_STATUSES.map(
                      (entry) => (
                        <option
                          key={
                            entry.value
                          }
                          value={
                            entry.value
                          }
                        >
                          {entry.label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <button
                  type="submit"
                  className="quoteButton quoteButtonPrimary"
                >
                  Status speichern
                </button>
              </Form>

              {quote.convertedOrderId ? (
                <Notice type="success">
                  Dieses Angebot wurde bereits
                  in einen Auftrag übernommen.
                </Notice>
              ) : null}
            </PageSection>

            {quote.status === "DRAFT" ? (
              <PageSection
                eyebrow="Entwurf"
                title="Angebot löschen"
                description="Diese Aktion kann nicht rückgängig gemacht werden."
                soft
                flat
              >
                <Form
                  method="post"
                  onSubmit={(event) => {
                    if (
                      !window.confirm(
                        "Diesen Angebotsentwurf wirklich löschen?"
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input
                    type="hidden"
                    name="intent"
                    value="delete"
                  />

                  <button
                    type="submit"
                    className="quoteButton quoteButtonDanger quoteButtonFull"
                  >
                    Entwurf löschen
                  </button>
                </Form>
              </PageSection>
            ) : null}
          </aside>
        </div>
      </PageShell>
    </AppLayout>
  );
}