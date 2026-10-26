import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  GastarioSplitView,
  GastarioMain,
  GastarioAside,
  gastarioButtonClass,
} from "../components/ui";

import { GastarioSection, GastarioMetricGrid, GastarioMetric, GastarioBadge } from "../components/ui";

import { GastarioDataList, GastarioDataRow } from "../components/ui";

import { GastarioPanel } from "../components/ui";

import { GastarioField, GastarioSelect, GastarioButton, GastarioToolbar } from "../components/ui";

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
      <GastarioPage>
        <GastarioHeader
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
            <GastarioToolbar align="end">
              <Link
                to="/angebote"
                className={gastarioButtonClass("secondary")}
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
                  className={gastarioButtonClass("secondary")}
                >
                  Duplizieren
                </button>
              </Form>
            </GastarioToolbar>
          }
        />

        {actionData?.error ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}

        {actionData?.success ? (
          <GastarioNotice type="success">
            {actionData.success}
          </GastarioNotice>
        ) : null}

        <GastarioSplitView wide>
          <GastarioMain>
            <GastarioSection
              eyebrow="Empfänger"
              title={quote.customerName}
              description="Kunden- und Veranstaltungsdaten des Angebots."
              action={
                <GastarioBadge variant="neutral">
                  {statusLabel(quote.status)}
                </GastarioBadge>
              }
            >

              <GastarioMetricGrid>

                <GastarioMetric
                  label="Ansprechpartner"
                  value={
                    quote.contactName ||
                    "Nicht hinterlegt"
                  }
                />

                <GastarioMetric
                  label="E-Mail"
                  value={
                    quote.contactEmail ||
                    "Nicht hinterlegt"
                  }
                />

                <GastarioMetric
                  label="Telefon"
                  value={
                    quote.contactPhone ||
                    "Nicht hinterlegt"
                  }
                />

                <GastarioMetric
                  label="Veranstaltung"
                  value={
                    quote.eventName ||
                    "Nicht festgelegt"
                  }
                />

                <GastarioMetric
                  label="Datum"
                  value={
                    formatDate(
                      quote.eventDate
                    )
                  }
                />

                <GastarioMetric
                  label="Lieferzeit"
                  value={
                    quote.deliveryTimeText ||
                    "Nicht festgelegt"
                  }
                />

                <GastarioMetric
                  label="Lieferadresse"
                  value={
                    quote.deliveryAddress ||
                    "Nicht festgelegt"
                  }
                />

                <GastarioMetric
                  label="Gültig bis"
                  value={
                    formatDate(
                      quote.validUntil
                    )
                  }
                />

              </GastarioMetricGrid>

            </GastarioSection>

            <GastarioSection
              eyebrow="Leistungen"
              title="Angebotspositionen"
              description={
                quote.items.length === 1
                  ? "1 Position"
                  : `${quote.items.length} Positionen`
              }
            >

              <GastarioDataList>

                {quote.items.map(
                  (
                    item: any,
                    index: number
                  ) => (

                    <GastarioDataRow
                      key={item.id}
                    >

                      <div className="g-ui-data-row-main">

                        <span className="g-ui-data-row-description">
                          Position {index + 1}
                        </span>

                        <strong className="g-ui-data-row-title">
                          {item.name}
                        </strong>

                        {item.notes ? (
                          <span className="g-ui-data-row-description">
                            {item.notes}
                          </span>
                        ) : null}

                        <span className="g-ui-data-row-description">
                          {item.quantity} {item.unit}
                          {" · "}
                          Einzelpreis{" "}
                          {centsToEuro(
                            item.unitCents
                          )}
                          {" · "}
                          USt. {item.taxRate} %
                        </span>

                      </div>


                      <div className="g-ui-data-row-meta">

                        <span>
                          {item.quantity} {item.unit}
                        </span>

                        <span>
                          {item.taxRate} % USt.
                        </span>

                        <strong>
                          {centsToEuro(
                            item.totalCents
                          )}
                        </strong>

                      </div>

                    </GastarioDataRow>

                  )
                )}

              </GastarioDataList>

            </GastarioSection>

            {quote.notes ? (
              <GastarioSection
                eyebrow="Hinweise"
                title="Interne Notiz"
              >
                <GastarioPanel variant="soft">
                  {quote.notes}
                </GastarioPanel>
              </GastarioSection>
            ) : null}
          </GastarioMain>

          <GastarioAside>
            <GastarioSection
              eyebrow="Kalkulation"
              title="Angebotssumme"
              description="Stand des gespeicherten Entwurfs."
            >

              <GastarioMetricGrid>

                <GastarioMetric
                  label="Zwischensumme netto"
                  value={
                    centsToEuro(
                      subtotalCents
                    )
                  }
                />

                <GastarioMetric
                  label="Rabatt"
                  value={
                    `− ${centsToEuro(
                      quote.discountCents
                    )}`
                  }
                />

                <GastarioMetric
                  label="Nettobetrag"
                  value={
                    centsToEuro(
                      totalCents
                    )
                  }
                />

                <GastarioMetric
                  label="Gesamt brutto"
                  value={
                    centsToEuro(
                      grossCents
                    )
                  }
                  badge="EUR"
                />

              </GastarioMetricGrid>


              {taxRows.length > 0 ? (
                <GastarioDataList>

                  {taxRows.map((tax) => (
                    <GastarioDataRow
                      key={tax.taxRate}
                    >
                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          Umsatzsteuer {tax.taxRate} %
                        </strong>

                        <span className="g-ui-data-row-description">
                          Steuerbetrag
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <strong>
                          {centsToEuro(
                            tax.taxCents
                          )}
                        </strong>
                      </div>
                    </GastarioDataRow>
                  ))}

                </GastarioDataList>
              ) : null}


              <GastarioPanel variant="soft">
                <strong>
                  Gesamt brutto:{" "}
                  {centsToEuro(
                    grossCents
                  )}
                </strong>
              </GastarioPanel>

            </GastarioSection>

            <GastarioSection
              eyebrow="Workflow"
              title="Angebotsstatus"
              description="Dokumentiere den aktuellen Bearbeitungsstand."
            >

              <Form method="post">

                <input
                  type="hidden"
                  name="intent"
                  value="updateStatus"
                />

                <GastarioField label="Status">
                  <GastarioSelect
                    name="status"
                    defaultValue={quote.status}
                  >
                    {QUOTE_STATUSES.map(
                      (entry) => (
                        <option
                          key={entry.value}
                          value={entry.value}
                        >
                          {entry.label}
                        </option>
                      )
                    )}
                  </GastarioSelect>
                </GastarioField>

                <GastarioToolbar align="end">
                  <GastarioButton
                    type="submit"
                    variant="primary"
                  >
                    Status speichern
                  </GastarioButton>
                </GastarioToolbar>

              </Form>


              {quote.convertedOrderId ? (
                <GastarioNotice type="success">
                  Dieses Angebot wurde bereits in einen Auftrag übernommen.
                </GastarioNotice>
              ) : null}

            </GastarioSection>

            {quote.status === "DRAFT" ? (
              <GastarioSection
                eyebrow="Entwurf"
                title="Angebot löschen"
                description="Diese Aktion kann nicht rückgängig gemacht werden."
              >

                <GastarioNotice type="warning">
                  Der Angebotsentwurf wird dauerhaft gelöscht.
                </GastarioNotice>

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

                  <GastarioToolbar align="end">
                    <GastarioButton
                      type="submit"
                      variant="danger"
                    >
                      Entwurf löschen
                    </GastarioButton>
                  </GastarioToolbar>

                </Form>

              </GastarioSection>
            ) : null}
          </GastarioAside>
        </GastarioSplitView>
      </GastarioPage>
    </AppLayout>
  );
}