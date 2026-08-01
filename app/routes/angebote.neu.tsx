import {
  useMemo,
  useState,
} from "react";

import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/angebote.css";

type QuoteBuilderItem = {
  key: string;
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: string;
  taxRate: number;
  notes: string;
};

const UNIT_OPTIONS = [
  "Portion",
  "Stück",
  "Personen",
  "Pauschale",
  "Stunde",
  "Kilogramm",
  "Liter",
  "Set",
];

const TAX_OPTIONS = [
  0,
  7,
  19,
];

function moneyInputToCents(
  value: unknown
) {
  const normalized = String(
    value || "0"
  )
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(parsed * 100)
  );
}

function centsToInput(
  value: number | null | undefined
) {
  return (
    Number(value || 0) / 100
  ).toFixed(2).replace(".", ",");
}

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

function dateAfterDays(days: number) {
  const value = new Date();

  value.setDate(
    value.getDate() + days
  );

  return value
    .toISOString()
    .slice(0, 10);
}

function createInitialItem(): QuoteBuilderItem {
  return {
    key: "position-1",
    productId: "",
    name: "",
    quantity: 1,
    unit: "Portion",
    unitPrice: "0,00",
    taxRate: 7,
    notes: "",
  };
}

function customerAddress(
  customer: any
) {
  if (!customer) {
    return "";
  }

  if (customer.address) {
    return customer.address;
  }

  const street = [
    customer.street,
    customer.houseNumber,
  ]
    .filter(Boolean)
    .join(" ");

  const city = [
    customer.postalCode,
    customer.city,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    street,
    city,
  ]
    .filter(Boolean)
    .join(", ");
}

function customerDeliveryAddress(
  customer: any
) {
  if (!customer) {
    return "";
  }

  if (
    customer.differentDeliveryAddress
  ) {
    const street = [
      customer.deliveryStreet,
      customer.deliveryHouseNumber,
    ]
      .filter(Boolean)
      .join(" ");

    const city = [
      customer.deliveryPostalCode,
      customer.deliveryCity,
    ]
      .filter(Boolean)
      .join(" ");

    const deliveryAddress = [
      street,
      city,
    ]
      .filter(Boolean)
      .join(", ");

    if (deliveryAddress) {
      return deliveryAddress;
    }
  }

  return customerAddress(customer);
}

export function meta() {
  return [
    {
      title:
        "Neues Angebot · Gastario",
    },
  ];
}

export async function loader({
  request,
}: {
  request: Request;
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
    !access.tenant
  ) {
    return {
      tenant: null,
      setupError:
        access.setupError ||
        "Kein Mandant gefunden.",
      customers: [],
      products: [],
      defaultValidUntil:
        dateAfterDays(14),
    };
  }

  const [
    customers,
    products,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: {
        tenantId: access.tenantId,
        active: true,
      },

      select: {
        id: true,
        customerNumber: true,
        name: true,
        contactName: true,
        email: true,
        invoiceEmail: true,
        phone: true,
        address: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        country: true,
        differentDeliveryAddress:
          true,
        deliveryStreet: true,
        deliveryHouseNumber: true,
        deliveryPostalCode: true,
        deliveryCity: true,
        deliveryCountry: true,
        paymentTermDays: true,
        invoiceLanguage: true,
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

      select: {
        id: true,
        name: true,
        category: true,
        unit: true,
        priceCents: true,
        taxRate: true,
      },

      orderBy: [
        {
          category: "asc",
        },
        {
          name: "asc",
        },
      ],
    }),
  ]);

  return {
    tenant: access.tenant,
    setupError:
      access.setupError,
    customers,
    products,
    defaultValidUntil:
      dateAfterDays(14),
  };
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import(
      "../lib/prisma.server"
    );

  const { getTenantAccess } =
    await import(
      "../lib/features.server"
    );

  const {
    createQuoteWithNextNumber,
  } = await import(
    "../lib/quote-number.server"
  );

  const access =
    await getTenantAccess(request);

  if (!access.tenantId) {
    return {
      error:
        "Kein Mandant gefunden.",
    };
  }

  const formData =
    await request.formData();

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
    formData.get(
      "deliveryTimeText"
    ) || ""
  ).trim();

  const deliveryAddress = String(
    formData.get(
      "deliveryAddress"
    ) || ""
  ).trim();

  const notes = String(
    formData.get("notes") || ""
  ).trim();

  const itemsJson = String(
    formData.get("itemsJson") || "[]"
  );

  const requestedDiscountCents =
    Math.max(
      0,
      Math.round(
        Number(
          formData.get(
            "discountCents"
          ) || 0
        )
      )
    );

  if (!customerId) {
    return {
      error:
        "Bitte einen Kunden auswählen.",
    };
  }

  let rawItems: any[] = [];

  try {
    const parsed =
      JSON.parse(itemsJson);

    if (Array.isArray(parsed)) {
      rawItems = parsed;
    }
  } catch {
    return {
      error:
        "Die Angebotspositionen konnten nicht gelesen werden.",
    };
  }

  if (rawItems.length === 0) {
    return {
      error:
        "Bitte mindestens eine Angebotsposition anlegen.",
    };
  }

  const customer =
    await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: access.tenantId,
        active: true,
      },
    });

  if (!customer) {
    return {
      error:
        "Der ausgewählte Kunde wurde nicht gefunden.",
    };
  }

  const productIds =
    Array.from(
      new Set(
        rawItems
          .map((item) =>
            String(
              item?.productId || ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: {
            tenantId:
              access.tenantId,
            id: {
              in: productIds,
            },
            active: true,
          },

          select: {
            id: true,
            name: true,
            unit: true,
            priceCents: true,
            taxRate: true,
          },
        })
      : [];

  const productMap =
    new Map(
      products.map((product: any) => [
        product.id,
        product,
      ])
    );

  for (
    const productId of productIds
  ) {
    if (!productMap.has(productId)) {
      return {
        error:
          "Mindestens ein ausgewähltes Produkt wurde nicht gefunden.",
      };
    }
  }

  const normalizedItems: any[] = [];

  for (
    let index = 0;
    index < rawItems.length;
    index += 1
  ) {
    const rawItem =
      rawItems[index] || {};

    const productId = String(
      rawItem.productId || ""
    ).trim();

    const product =
      productId
        ? productMap.get(productId)
        : null;

    const name = String(
      rawItem.name ||
        product?.name ||
        ""
    ).trim();

    if (!name) {
      return {
        error:
          `Position ${index + 1}: Bitte eine Bezeichnung eintragen.`,
      };
    }

    const quantity = Math.max(
      1,
      Math.round(
        Number(
          rawItem.quantity || 1
        )
      )
    );

    const unit = String(
      rawItem.unit ||
        product?.unit ||
        "Portion"
    ).trim();

    const unitCents = Math.max(
      0,
      Math.round(
        Number(
          rawItem.unitCents || 0
        )
      )
    );

    const requestedTaxRate =
      Number(rawItem.taxRate);

    const taxRate =
      TAX_OPTIONS.includes(
        requestedTaxRate
      )
        ? requestedTaxRate
        : Number(
            product?.taxRate || 7
          );

    const totalCents =
      quantity * unitCents;

    normalizedItems.push({
      productId:
        product?.id || null,
      name,
      quantity,
      unit: unit || "Portion",
      unitCents,
      totalCents,
      taxRate,
      notes:
        String(
          rawItem.notes || ""
        ).trim() || null,
      sortOrder: index,
    });
  }

  const subtotalCents =
    normalizedItems.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.totalCents || 0
        ),
      0
    );

  const discountCents =
    Math.min(
      requestedDiscountCents,
      subtotalCents
    );

  const totalCents =
    subtotalCents -
    discountCents;

  const defaultAddress =
    customerDeliveryAddress(
      customer
    );

  const createdQuote =
    await createQuoteWithNextNumber(
      prisma,
      access.tenantId,
      {
        customerId:
          customer.id,
        status: "DRAFT",
        customerName:
          customer.name,

        eventName:
          eventName || null,

        eventDate:
          eventDateRaw
            ? new Date(
                `${eventDateRaw}T12:00:00`
              )
            : null,

        deliveryTimeText:
          deliveryTimeText || null,

        deliveryAddress:
          deliveryAddress ||
          defaultAddress ||
          null,

        contactName:
          customer.contactName ||
          null,

        contactEmail:
          customer.email ||
          customer.invoiceEmail ||
          null,

        contactPhone:
          customer.phone || null,

        validUntil:
          validUntilRaw
            ? new Date(
                `${validUntilRaw}T12:00:00`
              )
            : null,

        notes:
          notes || null,

        subtotalCents,
        discountCents,
        totalCents,

        items: {
          create:
            normalizedItems,
        },
      }
    );

  throw redirect(
    `/angebote/${createdQuote.id}`
  );
}

export default function NewQuotePage() {
  const data =
    useLoaderData<typeof loader>();

  const actionData =
    useActionData<typeof action>();

  const navigation =
    useNavigation();

  const [customerId, setCustomerId] =
    useState("");

  const [eventName, setEventName] =
    useState("");

  const [eventDate, setEventDate] =
    useState("");

  const [
    deliveryTimeText,
    setDeliveryTimeText,
  ] = useState("");

  const [
    deliveryAddress,
    setDeliveryAddress,
  ] = useState("");

  const [validUntil, setValidUntil] =
    useState(
      data.defaultValidUntil
    );

  const [notes, setNotes] =
    useState("");

  const [discount, setDiscount] =
    useState("0,00");

  const [items, setItems] =
    useState<QuoteBuilderItem[]>([
      createInitialItem(),
    ]);

  const selectedCustomer =
    data.customers.find(
      (customer: any) =>
        customer.id === customerId
    );

  const updateItem = (
    index: number,
    values:
      Partial<QuoteBuilderItem>
  ) => {
    setItems((currentItems) =>
      currentItems.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                ...values,
              }
            : item
      )
    );
  };

  const selectProduct = (
    index: number,
    productId: string
  ) => {
    const product =
      data.products.find(
        (entry: any) =>
          entry.id === productId
      );

    if (!product) {
      updateItem(index, {
        productId: "",
      });

      return;
    }

    updateItem(index, {
      productId:
        product.id,
      name:
        product.name,
      unit:
        product.unit ||
        "Portion",
      unitPrice:
        centsToInput(
          product.priceCents
        ),
      taxRate:
        Number(
          product.taxRate || 7
        ),
    });
  };

  const addItem = () => {
    setItems((currentItems) => [
      ...currentItems,
      {
        ...createInitialItem(),
        key:
          `position-${Date.now()}-` +
          String(
            currentItems.length + 1
          ),
      },
    ]);
  };

  const duplicateItem = (
    index: number
  ) => {
    setItems((currentItems) => {
      const source =
        currentItems[index];

      if (!source) {
        return currentItems;
      }

      const copy = {
        ...source,
        key:
          `position-${Date.now()}-copy`,
      };

      return [
        ...currentItems.slice(
          0,
          index + 1
        ),
        copy,
        ...currentItems.slice(
          index + 1
        ),
      ];
    });
  };

  const deleteItem = (
    index: number
  ) => {
    setItems((currentItems) => {
      if (
        currentItems.length === 1
      ) {
        return currentItems;
      }

      return currentItems.filter(
        (
          _item,
          itemIndex
        ) =>
          itemIndex !== index
      );
    });
  };

  const moveItem = (
    index: number,
    direction: -1 | 1
  ) => {
    setItems((currentItems) => {
      const targetIndex =
        index + direction;

      if (
        targetIndex < 0 ||
        targetIndex >=
          currentItems.length
      ) {
        return currentItems;
      }

      const nextItems = [
        ...currentItems,
      ];

      const [
        movedItem,
      ] = nextItems.splice(
        index,
        1
      );

      nextItems.splice(
        targetIndex,
        0,
        movedItem
      );

      return nextItems;
    });
  };

  const summary = useMemo(() => {
    const itemValues =
      items.map((item) => {
        const unitCents =
          moneyInputToCents(
            item.unitPrice
          );

        const quantity = Math.max(
          1,
          Math.round(
            Number(
              item.quantity || 1
            )
          )
        );

        return {
          netCents:
            unitCents *
            quantity,
          taxRate:
            Number(
              item.taxRate || 0
            ),
        };
      });

    const subtotalCents =
      itemValues.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.netCents,
        0
      );

    const requestedDiscountCents =
      moneyInputToCents(
        discount
      );

    const discountCents =
      Math.min(
        requestedDiscountCents,
        subtotalCents
      );

    const netCents =
      subtotalCents -
      discountCents;

    const discountFactor =
      subtotalCents > 0
        ? netCents /
          subtotalCents
        : 1;

    const taxes =
      TAX_OPTIONS.map(
        (taxRate) => {
          const netForRate =
            itemValues
              .filter(
                (item) =>
                  item.taxRate ===
                  taxRate
              )
              .reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  item.netCents,
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
        }
      ).filter(
        (entry) =>
          entry.taxCents > 0
      );

    const taxCents =
      taxes.reduce(
        (
          sum,
          entry
        ) =>
          sum +
          entry.taxCents,
        0
      );

    return {
      subtotalCents,
      discountCents,
      netCents,
      taxes,
      taxCents,
      grossCents:
        netCents +
        taxCents,
    };
  }, [
    items,
    discount,
  ]);

  const serializedItems =
    JSON.stringify(
      items.map((item) => ({
        productId:
          item.productId,
        name:
          item.name,
        quantity:
          Math.max(
            1,
            Math.round(
              Number(
                item.quantity || 1
              )
            )
          ),
        unit:
          item.unit,
        unitCents:
          moneyInputToCents(
            item.unitPrice
          ),
        taxRate:
          item.taxRate,
        notes:
          item.notes,
      }))
    );

  const isSubmitting =
    navigation.state ===
    "submitting";

  return (
    <AppLayout>
      <PageShell className="quotesPage">
        <PageHeader
          eyebrow="Verkauf"
          title="Neues Angebot"
          subtitle={
            <>
              {data.tenant?.name ||
                "Kein Mandant"}
              {" · "}
              Kundendaten, Veranstaltung,
              Positionen und Kalkulation
              in einem Arbeitsbereich.
            </>
          }
          actions={
            <Link
              to="/angebote"
              className="quoteButton quoteButtonSecondary"
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

        <Form
          method="post"
          className="quoteCreateForm"
        >
          <input
            type="hidden"
            name="customerId"
            value={customerId}
          />

          <input
            type="hidden"
            name="itemsJson"
            value={serializedItems}
          />

          <input
            type="hidden"
            name="discountCents"
            value={
              summary.discountCents
            }
          />

          <div className="quoteBuilderGrid">
            <div className="quoteBuilderMain">
              <PageSection
                eyebrow="Angebotsdaten"
                title="Kunde und Veranstaltung"
                description="Grunddaten für Empfänger, Termin und Lieferung."
              >
                <div className="quoteFormGrid">
                  <label className="quoteField quoteFormFull">
                    <span>Kunde *</span>

                    <select
                      value={customerId}
                      required
                      onChange={(event) => {
                        const value =
                          event.target.value;

                        setCustomerId(
                          value
                        );

                        const customer =
                          data.customers.find(
                            (
                              entry: any
                            ) =>
                              entry.id ===
                              value
                          );

                        if (
                          customer &&
                          !deliveryAddress
                        ) {
                          setDeliveryAddress(
                            customerDeliveryAddress(
                              customer
                            )
                          );
                        }
                      }}
                    >
                      <option value="">
                        Kunde auswählen
                      </option>

                      {data.customers.map(
                        (
                          customer: any
                        ) => (
                          <option
                            key={
                              customer.id
                            }
                            value={
                              customer.id
                            }
                          >
                            {customer.customerNumber
                              ? `${customer.customerNumber} · `
                              : ""}
                            {customer.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  {selectedCustomer ? (
                    <div className="quoteCustomerPreview quoteFormFull">
                      <div>
                        <small>
                          Ansprechpartner
                        </small>

                        <strong>
                          {selectedCustomer.contactName ||
                            "Nicht hinterlegt"}
                        </strong>
                      </div>

                      <div>
                        <small>
                          E-Mail
                        </small>

                        <strong>
                          {selectedCustomer.email ||
                            selectedCustomer.invoiceEmail ||
                            "Nicht hinterlegt"}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Zahlungsziel
                        </small>

                        <strong>
                          {selectedCustomer.paymentTermDays}
                          {" Tage"}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Sprache
                        </small>

                        <strong>
                          {selectedCustomer.invoiceLanguage ===
                          "EN"
                            ? "Englisch"
                            : "Deutsch"}
                        </strong>
                      </div>
                    </div>
                  ) : null}

                  <label className="quoteField">
                    <span>
                      Veranstaltung
                    </span>

                    <input
                      name="eventName"
                      value={eventName}
                      onChange={(event) =>
                        setEventName(
                          event.target.value
                        )
                      }
                      placeholder="z. B. Office Lunch"
                    />
                  </label>

                  <label className="quoteField">
                    <span>
                      Veranstaltungsdatum
                    </span>

                    <input
                      name="eventDate"
                      type="date"
                      value={eventDate}
                      onChange={(event) =>
                        setEventDate(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="quoteField">
                    <span>
                      Lieferzeit
                    </span>

                    <input
                      name="deliveryTimeText"
                      type="time"
                      value={
                        deliveryTimeText
                      }
                      onChange={(event) =>
                        setDeliveryTimeText(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="quoteField">
                    <span>
                      Gültig bis
                    </span>

                    <input
                      name="validUntil"
                      type="date"
                      value={validUntil}
                      onChange={(event) =>
                        setValidUntil(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="quoteField quoteFormFull">
                    <span>
                      Lieferadresse
                    </span>

                    <input
                      name="deliveryAddress"
                      value={
                        deliveryAddress
                      }
                      onChange={(event) =>
                        setDeliveryAddress(
                          event.target.value
                        )
                      }
                      placeholder="Wird andernfalls aus dem Kunden übernommen"
                    />
                  </label>
                </div>
              </PageSection>

              <PageSection
                eyebrow="Leistungen"
                title="Angebotspositionen"
                description="Produkte übernehmen oder freie Leistungen erfassen."
                actions={
                  <button
                    type="button"
                    className="quoteButton quoteButtonPrimary"
                    onClick={addItem}
                  >
                    + Position hinzufügen
                  </button>
                }
              >
                <div className="quotePositionList">
                  {items.map(
                    (
                      item,
                      index
                    ) => {
                      const lineTotal =
                        Math.max(
                          1,
                          Number(
                            item.quantity ||
                              1
                          )
                        ) *
                        moneyInputToCents(
                          item.unitPrice
                        );

                      return (
                        <article
                          key={item.key}
                          className="quotePositionCard"
                        >
                          <header className="quotePositionHeader">
                            <div>
                              <span className="quotePositionNumber">
                                {index + 1}
                              </span>

                              <div>
                                <strong>
                                  {item.name ||
                                    "Neue Position"}
                                </strong>

                                <small>
                                  {centsToEuro(
                                    lineTotal
                                  )}
                                  {" netto"}
                                </small>
                              </div>
                            </div>

                            <div className="quotePositionActions">
                              <button
                                type="button"
                                className="quoteIconButton"
                                disabled={
                                  index === 0
                                }
                                onClick={() =>
                                  moveItem(
                                    index,
                                    -1
                                  )
                                }
                                aria-label="Position nach oben"
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                className="quoteIconButton"
                                disabled={
                                  index ===
                                  items.length -
                                    1
                                }
                                onClick={() =>
                                  moveItem(
                                    index,
                                    1
                                  )
                                }
                                aria-label="Position nach unten"
                              >
                                ↓
                              </button>

                              <button
                                type="button"
                                className="quoteIconButton"
                                onClick={() =>
                                  duplicateItem(
                                    index
                                  )
                                }
                              >
                                Duplizieren
                              </button>

                              <button
                                type="button"
                                className="quoteIconButton quoteIconButtonDanger"
                                disabled={
                                  items.length ===
                                  1
                                }
                                onClick={() =>
                                  deleteItem(
                                    index
                                  )
                                }
                              >
                                Löschen
                              </button>
                            </div>
                          </header>

                          <div className="quotePositionGrid">
                            <label className="quoteField quotePositionProduct">
                              <span>
                                Produkt
                              </span>

                              <select
                                value={
                                  item.productId
                                }
                                onChange={(
                                  event
                                ) =>
                                  selectProduct(
                                    index,
                                    event
                                      .target
                                      .value
                                  )
                                }
                              >
                                <option value="">
                                  Freie Position
                                </option>

                                {data.products.map(
                                  (
                                    product: any
                                  ) => (
                                    <option
                                      key={
                                        product.id
                                      }
                                      value={
                                        product.id
                                      }
                                    >
                                      {product.category
                                        ? `${product.category} · `
                                        : ""}
                                      {product.name}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>

                            <label className="quoteField quotePositionName">
                              <span>
                                Bezeichnung *
                              </span>

                              <input
                                value={
                                  item.name
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItem(
                                    index,
                                    {
                                      name:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                placeholder="Leistung oder Produkt"
                              />
                            </label>

                            <label className="quoteField">
                              <span>
                                Menge
                              </span>

                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={
                                  item.quantity
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItem(
                                    index,
                                    {
                                      quantity:
                                        Math.max(
                                          1,
                                          Number(
                                            event
                                              .target
                                              .value ||
                                              1
                                          )
                                        ),
                                    }
                                  )
                                }
                              />
                            </label>

                            <label className="quoteField">
                              <span>
                                Einheit
                              </span>

                              <select
                                value={
                                  item.unit
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItem(
                                    index,
                                    {
                                      unit:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                              >
                                {UNIT_OPTIONS.map(
                                  (
                                    unit
                                  ) => (
                                    <option
                                      key={
                                        unit
                                      }
                                      value={
                                        unit
                                      }
                                    >
                                      {unit}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>

                            <label className="quoteField">
                              <span>
                                Einzelpreis netto
                              </span>

                              <input
                                inputMode="decimal"
                                value={
                                  item.unitPrice
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItem(
                                    index,
                                    {
                                      unitPrice:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                placeholder="0,00"
                              />
                            </label>

                            <label className="quoteField">
                              <span>
                                Umsatzsteuer
                              </span>

                              <select
                                value={
                                  item.taxRate
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItem(
                                    index,
                                    {
                                      taxRate:
                                        Number(
                                          event
                                            .target
                                            .value
                                        ),
                                    }
                                  )
                                }
                              >
                                {TAX_OPTIONS.map(
                                  (
                                    taxRate
                                  ) => (
                                    <option
                                      key={
                                        taxRate
                                      }
                                      value={
                                        taxRate
                                      }
                                    >
                                      {taxRate}
                                      {" %"}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>

                            <div className="quoteLineTotal">
                              <span>
                                Positionssumme
                              </span>

                              <strong>
                                {centsToEuro(
                                  lineTotal
                                )}
                              </strong>
                            </div>

                            <label className="quoteField quoteFormFull">
                              <span>
                                Beschreibung oder Hinweis
                              </span>

                              <textarea
                                rows={2}
                                value={
                                  item.notes
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateItem(
                                    index,
                                    {
                                      notes:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                placeholder="Optionale Beschreibung für diese Position"
                              />
                            </label>
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              </PageSection>

              <PageSection
                eyebrow="Hinweise"
                title="Interne Notiz"
                description="Diese Notiz wird zunächst intern am Angebot gespeichert."
              >
                <label className="quoteField">
                  <textarea
                    name="notes"
                    rows={4}
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    placeholder="Absprachen, Kalkulationshinweise oder interne Informationen"
                  />
                </label>
              </PageSection>
            </div>

            <aside className="quoteBuilderSidebar">
              <section className="quoteSummaryCard">
                <header>
                  <p>
                    Kalkulation
                  </p>

                  <h2>
                    Angebotssumme
                  </h2>

                  <span>
                    Alle Werte werden live
                    berechnet.
                  </span>
                </header>

                <div className="quoteSummaryLines">
                  <div>
                    <span>
                      Positionen
                    </span>

                    <strong>
                      {items.length}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Zwischensumme netto
                    </span>

                    <strong>
                      {centsToEuro(
                        summary.subtotalCents
                      )}
                    </strong>
                  </div>

                  <label className="quoteSummaryDiscount">
                    <span>
                      Gesamtrabatt
                    </span>

                    <input
                      inputMode="decimal"
                      value={discount}
                      onChange={(event) =>
                        setDiscount(
                          event.target.value
                        )
                      }
                    />

                    <small>EUR</small>
                  </label>

                  <div>
                    <span>
                      Nettobetrag
                    </span>

                    <strong>
                      {centsToEuro(
                        summary.netCents
                      )}
                    </strong>
                  </div>

                  {summary.taxes.map(
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
                      summary.grossCents
                    )}
                  </strong>
                </div>

                <button
                  type="submit"
                  className="quoteButton quoteButtonPrimary quoteBuilderSubmit"
                  disabled={
                    isSubmitting ||
                    !customerId
                  }
                >
                  {isSubmitting
                    ? "Angebot wird angelegt …"
                    : "Als Entwurf anlegen"}
                </button>

                <p className="quoteSummaryHint">
                  Nach dem Speichern öffnet
                  sich die vollständige
                  Angebotsansicht.
                </p>
              </section>
            </aside>
          </div>
        </Form>
      </PageShell>
    </AppLayout>
  );
}