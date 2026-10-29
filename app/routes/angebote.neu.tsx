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
  useNavigate,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  GastarioDialog,
  GastarioWorkspace,
  GastarioMain,
  GastarioAside,  GastarioCard,  GastarioFormGrid,  GastarioField,  GastarioInput,  GastarioSelect,  GastarioMetricGrid,  GastarioMetric,







  gastarioButtonClass,
} from "../components/ui";

import { GastarioPanel, GastarioTextarea, GastarioButton, GastarioToolbar } from "../components/ui";

import { GastarioDataList, GastarioDataRow } from "../components/ui";

import { GastarioTabs } from "../components/ui";


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

  const navigate = useNavigate();

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

  const [
    createTab,
    setCreateTab,
  ] = useState("general");

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
      <GastarioPage>
        <GastarioHeader
          eyebrow="Verkauf"
          title="Angebote"
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
              className={gastarioButtonClass("secondary")}
            >
              Zur Übersicht
            </Link>
          }
        />

        <GastarioDialog
          open
          title="Neues Angebot"
          description="Kunde, Veranstaltung, Positionen und Kalkulation erfassen."
          size="xl"
          onClose={() =>
            navigate("/angebote")
          }
          footer={
            <>
              <GastarioButton
                variant="secondary"
                type="button"
                onClick={() =>
                  navigate("/angebote")
                }
              >
                Abbrechen
              </GastarioButton>

              <GastarioButton
                type="submit"
                form="new-quote-form"
                variant="primary"
                disabled={
                  isSubmitting ||
                  !customerId
                }
              >
                {isSubmitting
                  ? "Angebot wird angelegt …"
                  : "Als Entwurf anlegen"}
              </GastarioButton>


            </>
          }
        >

        {data.setupError ? (
          <GastarioNotice type="warning">
            {data.setupError}
          </GastarioNotice>
        ) : null}

        {actionData?.error ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}

        <GastarioTabs
          activeId={createTab}
          onChange={setCreateTab}
          items={[
            {
              id: "general",
              label: "Allgemein",
            },
            {
              id: "items",
              label: "Positionen",
              badge: items.length,
            },
            {
              id: "calculation",
              label: "Kalkulation",
            },
            {
              id: "notes",
              label: "Hinweise",
            },
          ]}
        />

        <Form
          id="new-quote-form"
          method="post"
          className="g-ui-dialog-form"
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

              <div
                className="g-ui-form-section"
                hidden={createTab !== "general"}
              >
                <div className="g-ui-form-section-heading">
                  <h3>Kunde und Veranstaltung</h3>
                  <p>
                    Grunddaten für Empfänger, Termin und Lieferung.
                  </p>
                </div>

<GastarioFormGrid columns={2}>

                  <GastarioField
                    label="Kunde"
                    required
                  >
                    <GastarioSelect
                      value={customerId}
                      required
                      onChange={(event) => {
                        const value = event.target.value;

                        setCustomerId(value);

                        const customer =
                          data.customers.find(
                            (entry: any) =>
                              entry.id === value
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
                        (customer: any) => (
                          <option
                            key={customer.id}
                            value={customer.id}
                          >
                            {customer.customerNumber
                              ? `${customer.customerNumber} · `
                              : ""}
                            {customer.name}
                          </option>
                        )
                      )}
                    </GastarioSelect>
                  </GastarioField>


                  <GastarioField label="Veranstaltung">
                    <GastarioInput
                      name="eventName"
                      value={eventName}
                      onChange={(event) =>
                        setEventName(
                          event.target.value
                        )
                      }
                      placeholder="z. B. Office Lunch"
                    />
                  </GastarioField>


                  <GastarioField label="Veranstaltungsdatum">
                    <GastarioInput
                      name="eventDate"
                      type="date"
                      value={eventDate}
                      onChange={(event) =>
                        setEventDate(
                          event.target.value
                        )
                      }
                    />
                  </GastarioField>


                  <GastarioField label="Lieferzeit">
                    <GastarioInput
                      name="deliveryTimeText"
                      type="time"
                      value={deliveryTimeText}
                      onChange={(event) =>
                        setDeliveryTimeText(
                          event.target.value
                        )
                      }
                    />
                  </GastarioField>


                  <GastarioField label="Gültig bis">
                    <GastarioInput
                      name="validUntil"
                      type="date"
                      value={validUntil}
                      onChange={(event) =>
                        setValidUntil(
                          event.target.value
                        )
                      }
                    />
                  </GastarioField>


                  <GastarioField label="Lieferadresse">
                    <GastarioInput
                      name="deliveryAddress"
                      value={deliveryAddress}
                      onChange={(event) =>
                        setDeliveryAddress(
                          event.target.value
                        )
                      }
                      placeholder="Wird andernfalls aus dem Kunden übernommen"
                    />
                  </GastarioField>

                </GastarioFormGrid>


                {selectedCustomer ? (
                  <GastarioMetricGrid>

                    <GastarioMetric
                      label="Ansprechpartner"
                      value={
                        selectedCustomer.contactName ||
                        "Nicht hinterlegt"
                      }
                    />

                    <GastarioMetric
                      label="E-Mail"
                      value={
                        selectedCustomer.email ||
                        selectedCustomer.invoiceEmail ||
                        "Nicht hinterlegt"
                      }
                    />

                    <GastarioMetric
                      label="Zahlungsziel"
                      value={`${selectedCustomer.paymentTermDays} Tage`}
                    />

                    <GastarioMetric
                      label="Sprache"
                      value={
                        selectedCustomer.invoiceLanguage === "EN"
                          ? "Englisch"
                          : "Deutsch"
                      }
                    />

                  </GastarioMetricGrid>
                ) : null}

              </div>

              <div
                className="g-ui-form-section"
                hidden={createTab !== "items"}
              >
                <div className="g-ui-form-section-heading">
                  <h3>Angebotspositionen</h3>
                  <p>
                    Produkte übernehmen oder freie Leistungen erfassen.
                  </p>
                </div>

                <GastarioToolbar align="end">
                  <GastarioButton
                    type="button"
                    variant="primary"
                    onClick={addItem}
                  >
                    + Position hinzufügen
                  </GastarioButton>
                </GastarioToolbar>

                {items.map((item, index) => {
                  const lineTotal =
                    Math.max(
                      1,
                      Number(
                        item.quantity || 1
                      )
                    ) *
                    moneyInputToCents(
                      item.unitPrice
                    );

                  return (
                    <GastarioPanel
                      key={item.key}
                      variant="soft"
                    >

                      <GastarioToolbar align="between">

                        <div>
                          <strong>
                            {index + 1}.{" "}
                            {item.name ||
                              "Neue Position"}
                          </strong>

                          <div>
                            {centsToEuro(
                              lineTotal
                            )}
                            {" netto"}
                          </div>
                        </div>


                        <GastarioToolbar align="end">

                          <GastarioButton
                            type="button"
                            variant="secondary"
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
                          </GastarioButton>


                          <GastarioButton
                            type="button"
                            variant="secondary"
                            disabled={
                              index ===
                              items.length - 1
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
                          </GastarioButton>


                          <GastarioButton
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              duplicateItem(
                                index
                              )
                            }
                          >
                            Duplizieren
                          </GastarioButton>


                          <GastarioButton
                            type="button"
                            variant="danger"
                            disabled={
                              items.length === 1
                            }
                            onClick={() =>
                              deleteItem(
                                index
                              )
                            }
                          >
                            Löschen
                          </GastarioButton>

                        </GastarioToolbar>

                      </GastarioToolbar>


                      <GastarioFormGrid columns={4}>

                        <GastarioField label="Produkt">
                          <GastarioSelect
                            value={
                              item.productId
                            }
                            onChange={(event) =>
                              selectProduct(
                                index,
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Freie Position
                            </option>

                            {data.products.map(
                              (product: any) => (
                                <option
                                  key={product.id}
                                  value={product.id}
                                >
                                  {product.category
                                    ? `${product.category} · `
                                    : ""}
                                  {product.name}
                                </option>
                              )
                            )}
                          </GastarioSelect>
                        </GastarioField>


                        <GastarioField label="Bezeichnung *">
                          <GastarioInput
                            value={item.name}
                            onChange={(event) =>
                              updateItem(
                                index,
                                {
                                  name:
                                    event.target.value,
                                }
                              )
                            }
                            placeholder="Leistung oder Produkt"
                          />
                        </GastarioField>


                        <GastarioField label="Menge">
                          <GastarioInput
                            type="number"
                            min="1"
                            step="1"
                            value={
                              item.quantity
                            }
                            onChange={(event) =>
                              updateItem(
                                index,
                                {
                                  quantity:
                                    Math.max(
                                      1,
                                      Number(
                                        event.target.value ||
                                        1
                                      )
                                    ),
                                }
                              )
                            }
                          />
                        </GastarioField>


                        <GastarioField label="Einheit">
                          <GastarioSelect
                            value={item.unit}
                            onChange={(event) =>
                              updateItem(
                                index,
                                {
                                  unit:
                                    event.target.value,
                                }
                              )
                            }
                          >
                            {UNIT_OPTIONS.map(
                              (unit) => (
                                <option
                                  key={unit}
                                  value={unit}
                                >
                                  {unit}
                                </option>
                              )
                            )}
                          </GastarioSelect>
                        </GastarioField>


                        <GastarioField label="Einzelpreis netto">
                          <GastarioInput
                            inputMode="decimal"
                            value={
                              item.unitPrice
                            }
                            onChange={(event) =>
                              updateItem(
                                index,
                                {
                                  unitPrice:
                                    event.target.value,
                                }
                              )
                            }
                            placeholder="0,00"
                          />
                        </GastarioField>


                        <GastarioField label="Umsatzsteuer">
                          <GastarioSelect
                            value={
                              item.taxRate
                            }
                            onChange={(event) =>
                              updateItem(
                                index,
                                {
                                  taxRate:
                                    Number(
                                      event.target.value
                                    ),
                                }
                              )
                            }
                          >
                            {TAX_OPTIONS.map(
                              (taxRate) => (
                                <option
                                  key={taxRate}
                                  value={taxRate}
                                >
                                  {taxRate} %
                                </option>
                              )
                            )}
                          </GastarioSelect>
                        </GastarioField>


                        <GastarioField label="Beschreibung oder Hinweis">
                          <GastarioTextarea
                            rows={2}
                            value={item.notes}
                            onChange={(event) =>
                              updateItem(
                                index,
                                {
                                  notes:
                                    event.target.value,
                                }
                              )
                            }
                            placeholder="Optionale Beschreibung für diese Position"
                          />
                        </GastarioField>

                      </GastarioFormGrid>


                      <GastarioPanel variant="flat">
                        <GastarioToolbar align="between">
                          <span className="g-ui-field-hint">
                            Positionssumme netto
                          </span>

                          <strong>
                            {centsToEuro(
                              lineTotal
                            )}
                          </strong>
                        </GastarioToolbar>
                      </GastarioPanel>

                    </GastarioPanel>
                  );
                })}

              </div>

              <div
                className="g-ui-form-section"
                hidden={createTab !== "notes"}
              >
                <div className="g-ui-form-section-heading">
                  <h3>Interne Notiz</h3>
                  <p>
                    Absprachen und interne Informationen zum Angebot.
                  </p>
                </div>

<GastarioField label="Interne Notiz">
                  <GastarioTextarea
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
                </GastarioField>
              </div>


              <div
                className="g-ui-form-section"
                hidden={createTab !== "calculation"}
              >
                <div className="g-ui-form-section-heading">
                  <h3>Angebotssumme</h3>
                  <p>
                    Alle Werte werden live aus den Angebotspositionen berechnet.
                  </p>
                </div>

<GastarioMetricGrid>

                  <GastarioMetric
                    label="Positionen"
                    value={items.length}
                  />

                  <GastarioMetric
                    label="Zwischensumme netto"
                    value={
                      centsToEuro(
                        summary.subtotalCents
                      )
                    }
                  />

                  <GastarioMetric
                    label="Nettobetrag"
                    value={
                      centsToEuro(
                        summary.netCents
                      )
                    }
                  />

                  <GastarioMetric
                    label="Gesamt brutto"
                    value={
                      centsToEuro(
                        summary.grossCents
                      )
                    }
                    badge="EUR"
                  />

                </GastarioMetricGrid>


                <GastarioField
                  label="Gesamtrabatt"
                  hint="Betrag in EUR"
                >
                  <GastarioInput
                    inputMode="decimal"
                    value={discount}
                    onChange={(event) =>
                      setDiscount(
                        event.target.value
                      )
                    }
                    placeholder="0,00"
                  />
                </GastarioField>


                {summary.taxes.length > 0 ? (
                  <GastarioDataList>

                    {summary.taxes.map(
                      (tax) => (
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
                      )
                    )}

                  </GastarioDataList>
                ) : null}


                <GastarioPanel variant="soft">
                  <strong>
                    Gesamt brutto:{" "}
                    {centsToEuro(
                      summary.grossCents
                    )}
                  </strong>
                </GastarioPanel>





                <GastarioNotice type="neutral">
                  Nach dem Speichern öffnet sich die vollständige Angebotsansicht.
                </GastarioNotice>

              </div>

        </Form>
        </GastarioDialog>
      </GastarioPage>
    </AppLayout>
  );
}
