import { useState } from "react";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioPage,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioNotice,
  GastarioSection,
  GastarioPanel,
  gastarioButtonClass,
  GastarioDialog,
  GastarioFormGrid,
  GastarioField,
  GastarioInput,
  GastarioSelect,
  GastarioTextarea,
  GastarioToolbar,
  GastarioCheckRow,
  GastarioDataList,
  GastarioDataRow,
  GastarioEmptyState,
  GastarioDetailDialog,
  GastarioDetailTabs,
  GastarioDetailPane,
} from "../components/ui";

export function meta() {
  return [{ title: "Kunden · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId || !access.tenant) {
    return {
      tenant: null,
      setupError: access.setupError || "Kein Mandant gefunden.",
      customers: [],
      stats: {
        total: 0,
        withEmail: 0,
        withPhone: 0,
        withOrders: 0,
      },
    };
  }

  try {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: access.tenantId,
      },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      tenant: access.tenant,
      setupError: null,
      customers,
      stats: {
        total: customers.length,
        withEmail: customers.filter((customer) => Boolean(customer.email)).length,
        withPhone: customers.filter((customer) => Boolean(customer.phone)).length,
        withOrders: customers.filter((customer: any) => customer._count.orders > 0).length,
      },
    };
  } catch (error) {
    console.error("Kunden loader failed:", error);

    return {
      tenant: access.tenant,
      setupError: "Kunden konnten nicht geladen werden. Bitte Datenbank/Schema pruefen.",
      customers: [],
      stats: {
        total: 0,
        withEmail: 0,
        withPhone: 0,
        withOrders: 0,
      },
    };
  }
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId) {
    return { error: access.setupError || "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createCustomer") {
    /*
     * gastario-customer-master-data-actions-20260716
     */
    const name = String(formData.get("name") || "").trim();
    const customerType = String(
      formData.get("customerType") || "BUSINESS"
    );
    const contactName = String(
      formData.get("contactName") || ""
    ).trim();
    const email = String(
      formData.get("email") || ""
    ).trim().toLowerCase();
    const invoiceEmail = String(
      formData.get("invoiceEmail") || ""
    ).trim().toLowerCase();
    const phone = String(
      formData.get("phone") || ""
    ).trim();

    const street = String(
      formData.get("street") || ""
    ).trim();
    const houseNumber = String(
      formData.get("houseNumber") || ""
    ).trim();
    const postalCode = String(
      formData.get("postalCode") || ""
    ).trim();
    const city = String(
      formData.get("city") || ""
    ).trim();
    const country = String(
      formData.get("country") || "DE"
    ).trim();

    const differentDeliveryAddress =
      formData.get("differentDeliveryAddress") === "on";

    const deliveryStreet = String(
      formData.get("deliveryStreet") || ""
    ).trim();
    const deliveryHouseNumber = String(
      formData.get("deliveryHouseNumber") || ""
    ).trim();
    const deliveryPostalCode = String(
      formData.get("deliveryPostalCode") || ""
    ).trim();
    const deliveryCity = String(
      formData.get("deliveryCity") || ""
    ).trim();
    const deliveryCountry = String(
      formData.get("deliveryCountry") || ""
    ).trim();

    const vatId = String(
      formData.get("vatId") || ""
    ).trim();
    const costCenter = String(
      formData.get("costCenter") || ""
    ).trim();
    const paymentTermDaysRaw = Number(
      formData.get("paymentTermDays") || 14
    );
    const paymentTermDays =
      Number.isFinite(paymentTermDaysRaw) &&
      paymentTermDaysRaw >= 0
        ? Math.round(paymentTermDaysRaw)
        : 14;

    const invoiceLanguage = String(
      formData.get("invoiceLanguage") || "DE"
    );
    const notes = String(
      formData.get("notes") || ""
    ).trim();
    const active =
      formData.get("active") !== "false";

    const address = [
      [street, houseNumber].filter(Boolean).join(" "),
      [postalCode, city].filter(Boolean).join(" "),
      country,
    ]
      .filter(Boolean)
      .join(", ");

    if (!name) {
      return { error: "Kundenname fehlt." };
    }

    /*
     * gastario-customer-number-generation-20260716
     *
     * Die Kundennummer wird pro Mandant fortlaufend erzeugt.
     * Bei einem gleichzeitigen Speichervorgang wird nach einem
     * Unique-Konflikt automatisch die nächste Nummer probiert.
     */
    const existingCustomers = await prisma.customer.findMany({
      where: {
        tenantId: access.tenantId,
      },
      select: {
        customerNumber: true,
      },
    });

    const highestCustomerNumber = existingCustomers.reduce(
      (highest, existingCustomer) => {
        const match = String(
          existingCustomer.customerNumber || ""
        ).match(/^KD-(\d+)$/);

        if (!match) {
          return highest;
        }

        const value = Number(match[1]);

        return Number.isFinite(value)
          ? Math.max(highest, value)
          : highest;
      },
      0
    );

    let nextCustomerNumber = highestCustomerNumber + 1;
    let createdCustomer = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const customerNumber =
        "KD-" +
        String(nextCustomerNumber).padStart(5, "0");

      try {
        createdCustomer = await prisma.customer.create({
          data: {
            tenantId: access.tenantId,
            customerNumber,
            customerType: customerType as any,
            name,
            contactName: contactName || null,
            email: email || null,
            invoiceEmail: invoiceEmail || null,
            phone: phone || null,

            address: address || null,
            street: street || null,
            houseNumber: houseNumber || null,
            postalCode: postalCode || null,
            city: city || null,
            country: country || "DE",

            differentDeliveryAddress,
            deliveryStreet:
              differentDeliveryAddress && deliveryStreet
                ? deliveryStreet
                : null,
            deliveryHouseNumber:
              differentDeliveryAddress && deliveryHouseNumber
                ? deliveryHouseNumber
                : null,
            deliveryPostalCode:
              differentDeliveryAddress && deliveryPostalCode
                ? deliveryPostalCode
                : null,
            deliveryCity:
              differentDeliveryAddress && deliveryCity
                ? deliveryCity
                : null,
            deliveryCountry:
              differentDeliveryAddress && deliveryCountry
                ? deliveryCountry
                : null,

            vatId: vatId || null,
            costCenter: costCenter || null,
            paymentTermDays,
            invoiceLanguage: invoiceLanguage as any,
            notes: notes || null,
            active,
          } as any,
        });

        break;
      } catch (error: any) {
        if (error?.code !== "P2002") {
          throw error;
        }

        nextCustomerNumber += 1;
      }
    }

    if (!createdCustomer) {
      return {
        error:
          "Kundennummer konnte nicht automatisch vergeben werden. Bitte erneut versuchen.",
      };
    }

    return {
      success:
        "Kunde " +
        createdCustomer.customerNumber +
        " wurde angelegt.",
    };
  }

  const customerId = String(formData.get("customerId") || "");

  if (!customerId) {
    return { error: "Kunde fehlt." };
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: access.tenantId,
    },
  });

  if (!customer) {
    return { error: "Kunde nicht gefunden." };
  }

  if (intent === "updateCustomer") {
    const name = String(formData.get("name") || "").trim();
    const customerType = String(
      formData.get("customerType") || "BUSINESS"
    );
    const contactName = String(
      formData.get("contactName") || ""
    ).trim();
    const email = String(
      formData.get("email") || ""
    ).trim().toLowerCase();
    const invoiceEmail = String(
      formData.get("invoiceEmail") || ""
    ).trim().toLowerCase();
    const phone = String(
      formData.get("phone") || ""
    ).trim();

    const street = String(
      formData.get("street") || ""
    ).trim();
    const houseNumber = String(
      formData.get("houseNumber") || ""
    ).trim();
    const postalCode = String(
      formData.get("postalCode") || ""
    ).trim();
    const city = String(
      formData.get("city") || ""
    ).trim();
    const country = String(
      formData.get("country") || "DE"
    ).trim();

    const differentDeliveryAddress =
      formData.get("differentDeliveryAddress") === "on";

    const deliveryStreet = String(
      formData.get("deliveryStreet") || ""
    ).trim();
    const deliveryHouseNumber = String(
      formData.get("deliveryHouseNumber") || ""
    ).trim();
    const deliveryPostalCode = String(
      formData.get("deliveryPostalCode") || ""
    ).trim();
    const deliveryCity = String(
      formData.get("deliveryCity") || ""
    ).trim();
    const deliveryCountry = String(
      formData.get("deliveryCountry") || ""
    ).trim();

    const vatId = String(
      formData.get("vatId") || ""
    ).trim();
    const costCenter = String(
      formData.get("costCenter") || ""
    ).trim();
    const paymentTermDaysRaw = Number(
      formData.get("paymentTermDays") || 14
    );
    const paymentTermDays =
      Number.isFinite(paymentTermDaysRaw) &&
      paymentTermDaysRaw >= 0
        ? Math.round(paymentTermDaysRaw)
        : 14;

    const invoiceLanguage = String(
      formData.get("invoiceLanguage") || "DE"
    );
    const notes = String(
      formData.get("notes") || ""
    ).trim();
    const active =
      formData.get("active") !== "false";

    const address = [
      [street, houseNumber].filter(Boolean).join(" "),
      [postalCode, city].filter(Boolean).join(" "),
      country,
    ]
      .filter(Boolean)
      .join(", ");

    if (!name) {
      return { error: "Kundenname fehlt." };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        customerType: customerType as any,
        name,
        contactName: contactName || null,
        email: email || null,
        invoiceEmail: invoiceEmail || null,
        phone: phone || null,

        address: address || null,
        street: street || null,
        houseNumber: houseNumber || null,
        postalCode: postalCode || null,
        city: city || null,
        country: country || "DE",

        differentDeliveryAddress,
        deliveryStreet:
          differentDeliveryAddress && deliveryStreet
            ? deliveryStreet
            : null,
        deliveryHouseNumber:
          differentDeliveryAddress && deliveryHouseNumber
            ? deliveryHouseNumber
            : null,
        deliveryPostalCode:
          differentDeliveryAddress && deliveryPostalCode
            ? deliveryPostalCode
            : null,
        deliveryCity:
          differentDeliveryAddress && deliveryCity
            ? deliveryCity
            : null,
        deliveryCountry:
          differentDeliveryAddress && deliveryCountry
            ? deliveryCountry
            : null,

        vatId: vatId || null,
        costCenter: costCenter || null,
        paymentTermDays,
        invoiceLanguage: invoiceLanguage as any,
        notes: notes || null,
        active,
      } as any,
    });

    return { success: "Kunde wurde gespeichert." };
  }

  if (intent === "deleteCustomer") {
    const orderCount = await prisma.order.count({
      where: {
        tenantId: access.tenantId,
        customerId: customer.id,
      },
    });

    if (orderCount > 0) {
      return { error: "Kunde kann nicht geloescht werden, weil Auftraege vorhanden sind." };
    }

    await prisma.customer.delete({
      where: { id: customer.id },
    });

    return { success: "Kunde wurde geloescht." };
  }

  return { error: "Unbekannte Aktion." };
}


export default function CustomersPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [
    createCustomerOpen,
    setCreateCustomerOpen,
  ] = useState(false);

  const [
    createDifferentDeliveryAddress,
    setCreateDifferentDeliveryAddress,
  ] = useState(false);

  const [
    editDifferentDeliveryAddress,
    setEditDifferentDeliveryAddress,
  ] = useState(false);
  const [
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState<string | null>(null);

  const [
    selectedCustomerTab,
    setSelectedCustomerTab,
  ] = useState("master");

  const selectedCustomer =
    data.customers.find(
      (customer: any) =>
        customer.id === selectedCustomerId
    ) || null;

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Verkauf"
          title="Kunden"
          description={
            <>
              {data.tenant?.name || "Kein Mandant"} · Kunden,
              Ansprechpartner und Kontaktdaten zentral verwalten.
            </>
          }
          actions={
            <>
              <Link
                className={gastarioButtonClass("secondary")}
                to="/auftragseingang"
              >
                Auftrag erfassen
              </Link>

              <button
                type="button"
                className={gastarioButtonClass("primary")}
                onClick={() => {
                  setCreateDifferentDeliveryAddress(false);
                  setCreateCustomerOpen(true);
                }}
              >
                Neuer Kunde
              </button>
            </>
          }
        />

        {data.setupError ? (
          <GastarioNotice type="warning">
            {data.setupError}
          </GastarioNotice>
        ) : null}

        {actionData?.success ? (
          <GastarioNotice type="success">
            {actionData.success}
          </GastarioNotice>
        ) : null}

        {actionData?.error ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}

        <GastarioMetricGrid>
          <GastarioMetric
            label="Kunden gesamt"
            value={data.stats.total}
            description="im Mandanten"
            badge="Gesamt"
          />

          <GastarioMetric
            label="Mit E-Mail"
            value={data.stats.withEmail}
            description="direkt kontaktierbar"
            badge="E-Mail"
          />

          <GastarioMetric
            label="Mit Telefon"
            value={data.stats.withPhone}
            description="für Rückfragen erreichbar"
            badge="Kontakt"
          />

          <GastarioMetric
            label="Mit Aufträgen"
            value={data.stats.withOrders}
            description="aktive Kundenbeziehungen"
            badge="Aufträge"
          />
        </GastarioMetricGrid>

        <GastarioSection
          eyebrow="Kundenübersicht"
          title="Aktuelle Kunden"
          description={
            data.customers.length === 1
              ? "1 Kunde im System"
              : `${data.customers.length} Kunden im System`
          }
        >
          {data.customers.length === 0 ? (
            <GastarioEmptyState title="Noch keine Kunden angelegt">
              Lege deinen ersten Kunden an oder übernimm Kundendaten
              aus einem neuen Auftrag.
            </GastarioEmptyState>
          ) : (
            <GastarioDataList>
              {data.customers.map(
                (customer: any) => (
                  <GastarioDataRow
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerId(
                        customer.id
                      );

                      setEditDifferentDeliveryAddress(
                        customer.differentDeliveryAddress ===
                          true
                      );

                      setSelectedCustomerTab(
                        "master"
                      );
                    }}
                  >
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {customer.name}
                      </strong>

                      <span className="g-ui-data-row-description">
                        {customer.customerNumber ||
                          "Ohne Kundennummer"}
                        {" · "}
                        {customer.contactName ||
                          "Kein Ansprechpartner"}
                        {customer.email
                          ? ` · ${customer.email}`
                          : ""}
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <strong>
                        {customer._count?.orders || 0}
                      </strong>
                      {" "}
                      {(customer._count?.orders || 0) === 1
                        ? "Auftrag"
                        : "Aufträge"}
                    </div>

                    <span
                      className="g-ui-data-row-chevron"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </GastarioDataRow>
                )
              )}
            </GastarioDataList>
          )}
        </GastarioSection>

        <GastarioDetailDialog
          open={Boolean(selectedCustomer)}
          title={
            selectedCustomer?.name ||
            "Kunde"
          }
          description={
            selectedCustomer
              ? `${
                  selectedCustomer.customerNumber ||
                  "Ohne Kundennummer"
                } · ${
                  selectedCustomer._count?.orders ||
                  0
                } Aufträge`
              : undefined
          }
          onClose={() =>
            setSelectedCustomerId(null)
          }
          footer={
            selectedCustomer ? (
              <GastarioToolbar>
                <button
                  type="button"
                  className={gastarioButtonClass("secondary")}
                  onClick={() =>
                    setSelectedCustomerId(null)
                  }
                >
                  Schließen
                </button>

                <button
                  type="submit"
                  form="delete-customer-form"
                  className={gastarioButtonClass("danger")}
                  onClick={(event) => {
                    if (
                      !window.confirm(
                        "Diesen Kunden wirklich löschen?"
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  Löschen
                </button>

                <button
                  type="submit"
                  form="customer-detail-form"
                  className={gastarioButtonClass("primary")}
                >
                  Änderungen speichern
                </button>
              </GastarioToolbar>
            ) : null
          }
        >
          {selectedCustomer ? (
            <>
              <Form
                id="customer-detail-form"
                method="post"
                key={selectedCustomer.id}
              >
                <input
                  type="hidden"
                  name="intent"
                  value="updateCustomer"
                />

                <input
                  type="hidden"
                  name="customerId"
                  value={selectedCustomer.id}
                />

                <GastarioDetailTabs
                  items={[
                    {
                      id: "master",
                      label: "Stammdaten",
                    },
                    {
                      id: "address",
                      label: "Adressen",
                    },
                    {
                      id: "billing",
                      label: "Abrechnung",
                    },
                  ]}
                  activeId={selectedCustomerTab}
                  onChange={setSelectedCustomerTab}
                />

                <GastarioDetailPane
                  active={
                    selectedCustomerTab ===
                    "master"
                  }
                >
                  <GastarioFormGrid>
                    <GastarioField label="Kundennummer">
                      <GastarioInput
                        value={
                          selectedCustomer.customerNumber ||
                          ""
                        }
                        readOnly
                      />
                    </GastarioField>

                    <GastarioField label="Kundentyp">
                      <GastarioSelect
                        name="customerType"
                        defaultValue={
                          selectedCustomer.customerType ||
                          "BUSINESS"
                        }
                      >
                        <option value="BUSINESS">
                          Firmenkunde
                        </option>

                        <option value="PRIVATE">
                          Privatkunde
                        </option>
                      </GastarioSelect>
                    </GastarioField>

                    <GastarioField
                      label="Firmen- oder Kundenname"
                      required
                    >
                      <GastarioInput
                        name="name"
                        defaultValue={
                          selectedCustomer.name ||
                          ""
                        }
                        required
                      />
                    </GastarioField>

                    <GastarioField label="Status">
                      <GastarioSelect
                        name="active"
                        defaultValue={
                          selectedCustomer.active === false
                            ? "false"
                            : "true"
                        }
                      >
                        <option value="true">
                          Aktiv
                        </option>

                        <option value="false">
                          Inaktiv
                        </option>
                      </GastarioSelect>
                    </GastarioField>

                    <GastarioField label="Ansprechpartner">
                      <GastarioInput
                        name="contactName"
                        defaultValue={
                          selectedCustomer.contactName ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="E-Mail">
                      <GastarioInput
                        name="email"
                        type="email"
                        defaultValue={
                          selectedCustomer.email ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="Rechnungs-E-Mail">
                      <GastarioInput
                        name="invoiceEmail"
                        type="email"
                        defaultValue={
                          selectedCustomer.invoiceEmail ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="Telefon">
                      <GastarioInput
                        name="phone"
                        type="tel"
                        defaultValue={
                          selectedCustomer.phone ||
                          ""
                        }
                      />
                    </GastarioField>
                  </GastarioFormGrid>

                  <GastarioField label="Interne Notiz">
                    <GastarioTextarea
                      name="notes"
                      rows={4}
                      defaultValue={
                        selectedCustomer.notes ||
                        ""
                      }
                    />
                  </GastarioField>
                </GastarioDetailPane>

                <GastarioDetailPane
                  active={
                    selectedCustomerTab ===
                    "address"
                  }
                >
                  <GastarioFormGrid>
                    <GastarioField label="Straße">
                      <GastarioInput
                        name="street"
                        defaultValue={
                          selectedCustomer.street ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="Hausnummer">
                      <GastarioInput
                        name="houseNumber"
                        defaultValue={
                          selectedCustomer.houseNumber ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="PLZ">
                      <GastarioInput
                        name="postalCode"
                        defaultValue={
                          selectedCustomer.postalCode ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="Ort">
                      <GastarioInput
                        name="city"
                        defaultValue={
                          selectedCustomer.city ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="Land">
                      <GastarioSelect
                        name="country"
                        defaultValue={
                          selectedCustomer.country ||
                          "DE"
                        }
                      >
                        <option value="DE">
                          Deutschland
                        </option>
                        <option value="AT">
                          Österreich
                        </option>
                        <option value="CH">
                          Schweiz
                        </option>
                        <option value="OTHER">
                          Anderes Land
                        </option>
                      </GastarioSelect>
                    </GastarioField>
                    <GastarioField
                label="Interne Notiz"
                fullWidth
              >
                <GastarioTextarea
                  name="notes"
                  rows={3}
                  defaultValue={
                    selectedCustomer.notes ||
                    ""
                  }
                  placeholder="Besonderheiten, Bestellabläufe oder interne Hinweise"
                />
              </GastarioField>

            </GastarioFormGrid>

                  <GastarioCheckRow
                    name="differentDeliveryAddress"
                    value="on"
                    title="Abweichende Lieferadresse verwenden"
                    description="Wenn aktiviert, verwendet Gastario diese Adresse für Lieferungen."
                    checked={
                      editDifferentDeliveryAddress
                    }
                    onCheckedChange={
                      setEditDifferentDeliveryAddress
                    }
                  />

                  {editDifferentDeliveryAddress ? (
              <GastarioPanel variant="soft">
                <GastarioFormGrid>
                        <GastarioField label="Lieferstraße">
                          <GastarioInput
                            name="deliveryStreet"
                            defaultValue={
                              selectedCustomer.deliveryStreet ||
                              ""
                            }
                          />
                        </GastarioField>

                        <GastarioField label="Hausnummer">
                          <GastarioInput
                            name="deliveryHouseNumber"
                            defaultValue={
                              selectedCustomer.deliveryHouseNumber ||
                              ""
                            }
                          />
                        </GastarioField>

                        <GastarioField label="Liefer-PLZ">
                          <GastarioInput
                            name="deliveryPostalCode"
                            defaultValue={
                              selectedCustomer.deliveryPostalCode ||
                              ""
                            }
                          />
                        </GastarioField>

                        <GastarioField label="Lieferort">
                          <GastarioInput
                            name="deliveryCity"
                            defaultValue={
                              selectedCustomer.deliveryCity ||
                              ""
                            }
                          />
                        </GastarioField>

                        <GastarioField label="Lieferland">
                          <GastarioSelect
                            name="deliveryCountry"
                            defaultValue={
                              selectedCustomer.deliveryCountry ||
                              "DE"
                            }
                          >
                            <option value="DE">
                              Deutschland
                            </option>
                            <option value="AT">
                              Österreich
                            </option>
                            <option value="CH">
                              Schweiz
                            </option>
                            <option value="OTHER">
                              Anderes Land
                            </option>
                          </GastarioSelect>
                        </GastarioField>
                      </GastarioFormGrid>
              </GastarioPanel>
            ) : null}
                </GastarioDetailPane>

                <GastarioDetailPane
                  active={
                    selectedCustomerTab ===
                    "billing"
                  }
                >
                  <GastarioFormGrid>
                    <GastarioField label="USt-IdNr.">
                      <GastarioInput
                        name="vatId"
                        defaultValue={
                          selectedCustomer.vatId ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="Kostenstelle">
                      <GastarioInput
                        name="costCenter"
                        defaultValue={
                          selectedCustomer.costCenter ||
                          ""
                        }
                      />
                    </GastarioField>

                    <GastarioField label="Zahlungsziel">
                      <GastarioSelect
                        name="paymentTermDays"
                        defaultValue={String(
                          selectedCustomer.paymentTermDays ??
                          14
                        )}
                      >
                        <option value="0">
                          Sofort fällig
                        </option>
                        <option value="7">
                          7 Tage
                        </option>
                        <option value="14">
                          14 Tage
                        </option>
                        <option value="30">
                          30 Tage
                        </option>
                      </GastarioSelect>
                    </GastarioField>

                    <GastarioField label="Belegsprache">
                      <GastarioSelect
                        name="invoiceLanguage"
                        defaultValue={
                          selectedCustomer.invoiceLanguage ||
                          "DE"
                        }
                      >
                        <option value="DE">
                          Deutsch
                        </option>
                        <option value="EN">
                          Englisch
                        </option>
                      </GastarioSelect>
                    </GastarioField>
                  </GastarioFormGrid>
                </GastarioDetailPane>
              </Form>

              <Form
                id="delete-customer-form"
                method="post"
              >
                <input
                  type="hidden"
                  name="intent"
                  value="deleteCustomer"
                />

                <input
                  type="hidden"
                  name="customerId"
                  value={selectedCustomer.id}
                />
              </Form>
            </>
          ) : null}
        </GastarioDetailDialog>

        <GastarioDialog
          open={createCustomerOpen}
          title="Neuen Kunden anlegen"
          description="Firmen-, Kontakt-, Rechnungs- und Lieferdaten zentral erfassen."
          onClose={() => {
            setCreateCustomerOpen(false);
            setCreateDifferentDeliveryAddress(false);
          }}
          size="xl"
          footer={
            <GastarioToolbar>
              <button
                type="button"
                className={gastarioButtonClass("secondary")}
                onClick={() => {
                  setCreateCustomerOpen(false);
                  setCreateDifferentDeliveryAddress(false);
                }}
              >
                Abbrechen
              </button>

              <button
                type="submit"
                form="create-customer-form"
                className={gastarioButtonClass("primary")}
              >
                Kunde anlegen
              </button>
            </GastarioToolbar>
          }
        >
          <Form
            id="create-customer-form"
            method="post"
          >
            <input
              type="hidden"
              name="intent"
              value="createCustomer"
            />

            <GastarioFormGrid>
              <GastarioField
                label="Kundentyp"
                required
              >
                <GastarioSelect
                  name="customerType"
                  defaultValue="BUSINESS"
                >
                  <option value="BUSINESS">
                    Firmenkunde
                  </option>

                  <option value="PRIVATE">
                    Privatkunde
                  </option>
                </GastarioSelect>
              </GastarioField>

              <GastarioField
                label="Firmen- oder Kundenname"
                required
              >
                <GastarioInput
                  name="name"
                  placeholder="Firma oder Kunde"
                  required
                />
              </GastarioField>

              <GastarioField label="Status">
                <GastarioSelect
                  name="active"
                  defaultValue="true"
                >
                  <option value="true">
                    Aktiv
                  </option>

                  <option value="false">
                    Inaktiv
                  </option>
                </GastarioSelect>
              </GastarioField>

              <GastarioField label="Ansprechpartner">
                <GastarioInput
                  name="contactName"
                  placeholder="Vor- und Nachname"
                />
              </GastarioField>

              <GastarioField label="E-Mail">
                <GastarioInput
                  name="email"
                  type="email"
                  placeholder="kunde@firma.de"
                />
              </GastarioField>

              <GastarioField label="Rechnungs-E-Mail">
                <GastarioInput
                  name="invoiceEmail"
                  type="email"
                  placeholder="rechnung@firma.de"
                />
              </GastarioField>

              <GastarioField label="Telefon">
                <GastarioInput
                  name="phone"
                  type="tel"
                  placeholder="030 12345678"
                />
              </GastarioField>

              <GastarioField label="Straße">
                <GastarioInput
                  name="street"
                  placeholder="Musterstraße"
                />
              </GastarioField>

              <GastarioField label="Hausnummer">
                <GastarioInput
                  name="houseNumber"
                  placeholder="12a"
                />
              </GastarioField>

              <GastarioField label="PLZ">
                <GastarioInput
                  name="postalCode"
                  inputMode="numeric"
                  placeholder="10115"
                />
              </GastarioField>

              <GastarioField label="Ort">
                <GastarioInput
                  name="city"
                  placeholder="Berlin"
                />
              </GastarioField>

              <GastarioField label="Land">
                <GastarioSelect
                  name="country"
                  defaultValue="DE"
                >
                  <option value="DE">
                    Deutschland
                  </option>

                  <option value="AT">
                    Österreich
                  </option>

                  <option value="CH">
                    Schweiz
                  </option>

                  <option value="OTHER">
                    Anderes Land
                  </option>
                </GastarioSelect>
              </GastarioField>

              <GastarioField label="USt-IdNr.">
                <GastarioInput
                  name="vatId"
                  placeholder="DE123456789"
                />
              </GastarioField>

              <GastarioField label="Kostenstelle">
                <GastarioInput
                  name="costCenter"
                  placeholder="z. B. Marketing"
                />
              </GastarioField>

              <GastarioField label="Zahlungsziel">
                <GastarioSelect
                  name="paymentTermDays"
                  defaultValue="14"
                >
                  <option value="0">
                    Sofort fällig
                  </option>

                  <option value="7">
                    7 Tage
                  </option>

                  <option value="14">
                    14 Tage
                  </option>

                  <option value="30">
                    30 Tage
                  </option>
                </GastarioSelect>
              </GastarioField>

              <GastarioField label="Belegsprache">
                <GastarioSelect
                  name="invoiceLanguage"
                  defaultValue="DE"
                >
                  <option value="DE">
                    Deutsch
                  </option>

                  <option value="EN">
                    Englisch
                  </option>
                </GastarioSelect>
              </GastarioField>
              <GastarioField
                label="Interne Notiz"
                fullWidth
              >
                <GastarioTextarea
                  name="notes"
                  rows={3}
                  placeholder="Besonderheiten, Bestellabläufe oder interne Hinweise"
                />
              </GastarioField>

            </GastarioFormGrid>

            <GastarioCheckRow
              name="differentDeliveryAddress"
              value="on"
              title="Abweichende Lieferadresse verwenden"
              description="Aktivieren, wenn die Lieferung an eine andere Adresse als die Rechnungsadresse geht."
              checked={
                createDifferentDeliveryAddress
              }
              onCheckedChange={
                setCreateDifferentDeliveryAddress
              }
            />

            {createDifferentDeliveryAddress ? (
              <GastarioPanel variant="soft">
                <GastarioFormGrid>
                  <GastarioField label="Lieferstraße">
                    <GastarioInput
                      name="deliveryStreet"
                      placeholder="Lieferstraße"
                    />
                  </GastarioField>

                  <GastarioField label="Hausnummer">
                    <GastarioInput
                      name="deliveryHouseNumber"
                      placeholder="12a"
                    />
                  </GastarioField>

                  <GastarioField label="Liefer-PLZ">
                    <GastarioInput
                      name="deliveryPostalCode"
                      placeholder="10115"
                    />
                  </GastarioField>

                  <GastarioField label="Lieferort">
                    <GastarioInput
                      name="deliveryCity"
                      placeholder="Berlin"
                    />
                  </GastarioField>

                  <GastarioField label="Lieferland">
                    <GastarioSelect
                      name="deliveryCountry"
                      defaultValue="DE"
                    >
                      <option value="DE">
                        Deutschland
                      </option>

                      <option value="AT">
                        Österreich
                      </option>

                      <option value="CH">
                        Schweiz
                      </option>

                      <option value="OTHER">
                        Anderes Land
                      </option>
                    </GastarioSelect>
                  </GastarioField>
                </GastarioFormGrid>
              </GastarioPanel>
            ) : null}


          </Form>
        </GastarioDialog>

      </GastarioPage>
    </AppLayout>
  );
}
