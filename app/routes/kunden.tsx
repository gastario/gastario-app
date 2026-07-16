import { Form, Link, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import "../styles/kunden.css";

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

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontWeight: 750,
  width: "100%",
};

export default function CustomersPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AppLayout>
      <PageShell className="customersPage">
        <PageHeader
          eyebrow="Verkauf"
          title="Kunden"
          subtitle={
            <>
              {data.tenant?.name || "Kein Mandant"} · Kunden,
              Ansprechpartner und Kontaktdaten zentral verwalten.
            </>
          }
          actions={
            <>
              <Link
                className="g-ui-button g-ui-button--secondary"
                to="/auftragseingang"
              >
                Auftrag erfassen
              </Link>

              <a
                className="g-ui-button g-ui-button--primary"
                href="#kunde-anlegen"
              >
                Neuer Kunde
              </a>
            </>
          }
        />

        {data.setupError ? (
          <Notice type="warning">
            {data.setupError}
          </Notice>
        ) : null}

        {actionData?.success ? (
          <Notice type="success">
            {actionData.success}
          </Notice>
        ) : null}

        {actionData?.error ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        <MetricGrid>
          <MetricCard
            label="Kunden gesamt"
            value={data.stats.total}
            description="im Mandanten"
            badge="Gesamt"
          />

          <MetricCard
            label="Mit E-Mail"
            value={data.stats.withEmail}
            description="direkt kontaktierbar"
            badge="E-Mail"
          />

          <MetricCard
            label="Mit Telefon"
            value={data.stats.withPhone}
            description="für Rückfragen erreichbar"
            badge="Kontakt"
          />

          <MetricCard
            label="Mit Aufträgen"
            value={data.stats.withOrders}
            description="aktive Kundenbeziehungen"
            badge="Aufträge"
          />
        </MetricGrid>

        <PageSection
          className="customerCreateSection"
          eyebrow="Neuer Kunde"
          title="Kunde anlegen"
          description="Lege Firmen, Ansprechpartner und Kontaktdaten vollständig an."
        >
          <Form
            id="kunde-anlegen"
            method="post"
            className="customerCreateForm"
          >
            <input
              type="hidden"
              name="intent"
              value="createCustomer"
            />

            {/* gastario-customer-master-data-form-20260716 */}
            <fieldset className="customerFormGroup">
              <legend>Grunddaten</legend>

              <div className="customerFormGrid">
                <label className="g-ui-field">
                  <span>Kundentyp</span>
                  <select name="customerType" defaultValue="BUSINESS">
                    <option value="BUSINESS">Firmenkunde</option>
                    <option value="PRIVATE">Privatkunde</option>
                  </select>
                </label>

                <label className="g-ui-field customerFormWide">
                  <span>Firmen- oder Kundenname *</span>
                  <input
                    name="name"
                    placeholder="Firma oder Kunde"
                    required
                  />
                </label>

                <label className="customerCheckboxField">
                  <input
                    type="checkbox"
                    name="active"
                    value="true"
                    defaultChecked
                  />
                  <span>Kunde ist aktiv</span>
                </label>
              </div>
            </fieldset>

            <fieldset className="customerFormGroup">
              <legend>Kontakt</legend>

              <div className="customerFormGrid">
                <label className="g-ui-field">
                  <span>Ansprechpartner</span>
                  <input
                    name="contactName"
                    placeholder="Vor- und Nachname"
                  />
                </label>

                <label className="g-ui-field">
                  <span>E-Mail</span>
                  <input
                    name="email"
                    type="email"
                    placeholder="kunde@firma.de"
                  />
                </label>

                <label className="g-ui-field">
                  <span>Rechnungs-E-Mail</span>
                  <input
                    name="invoiceEmail"
                    type="email"
                    placeholder="rechnung@firma.de"
                  />
                </label>

                <label className="g-ui-field">
                  <span>Telefon</span>
                  <input
                    name="phone"
                    type="tel"
                    placeholder="030 12345678"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="customerFormGroup">
              <legend>Rechnungsadresse</legend>

              <div className="customerFormGrid customerAddressGrid">
                <label className="g-ui-field customerStreetField">
                  <span>Straße</span>
                  <input name="street" placeholder="Musterstraße" />
                </label>

                <label className="g-ui-field">
                  <span>Hausnummer</span>
                  <input name="houseNumber" placeholder="12a" />
                </label>

                <label className="g-ui-field">
                  <span>PLZ</span>
                  <input
                    name="postalCode"
                    inputMode="numeric"
                    placeholder="10115"
                  />
                </label>

                <label className="g-ui-field">
                  <span>Ort</span>
                  <input name="city" placeholder="Berlin" />
                </label>

                <label className="g-ui-field">
                  <span>Land</span>
                  <select name="country" defaultValue="DE">
                    <option value="DE">Deutschland</option>
                    <option value="AT">Österreich</option>
                    <option value="CH">Schweiz</option>
                    <option value="OTHER">Anderes Land</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset className="customerFormGroup">
              <legend>Abrechnung</legend>

              <div className="customerFormGrid">
                <label className="g-ui-field">
                  <span>USt-IdNr.</span>
                  <input name="vatId" placeholder="DE123456789" />
                </label>

                <label className="g-ui-field">
                  <span>Kostenstelle</span>
                  <input name="costCenter" placeholder="z. B. Marketing" />
                </label>

                <label className="g-ui-field">
                  <span>Zahlungsziel</span>
                  <select name="paymentTermDays" defaultValue="14">
                    <option value="0">Sofort fällig</option>
                    <option value="7">7 Tage</option>
                    <option value="14">14 Tage</option>
                    <option value="30">30 Tage</option>
                  </select>
                </label>

                <label className="g-ui-field">
                  <span>Belegsprache</span>
                  <select name="invoiceLanguage" defaultValue="DE">
                    <option value="DE">Deutsch</option>
                    <option value="EN">Englisch</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <details className="customerOptionalSection">
              <summary>Abweichende Lieferadresse hinzufügen</summary>

              <div className="customerOptionalContent">
                <label className="customerCheckboxField">
                  <input
                    type="checkbox"
                    name="differentDeliveryAddress"
                  />
                  <span>Abweichende Lieferadresse verwenden</span>
                </label>

                <div className="customerFormGrid customerAddressGrid">
                  <label className="g-ui-field customerStreetField">
                    <span>Lieferstraße</span>
                    <input
                      name="deliveryStreet"
                      placeholder="Lieferstraße"
                    />
                  </label>

                  <label className="g-ui-field">
                    <span>Hausnummer</span>
                    <input
                      name="deliveryHouseNumber"
                      placeholder="12a"
                    />
                  </label>

                  <label className="g-ui-field">
                    <span>PLZ</span>
                    <input
                      name="deliveryPostalCode"
                      placeholder="10115"
                    />
                  </label>

                  <label className="g-ui-field">
                    <span>Ort</span>
                    <input
                      name="deliveryCity"
                      placeholder="Berlin"
                    />
                  </label>

                  <label className="g-ui-field">
                    <span>Land</span>
                    <select
                      name="deliveryCountry"
                      defaultValue="DE"
                    >
                      <option value="DE">Deutschland</option>
                      <option value="AT">Österreich</option>
                      <option value="CH">Schweiz</option>
                      <option value="OTHER">Anderes Land</option>
                    </select>
                  </label>
                </div>
              </div>
            </details>

            <fieldset className="customerFormGroup">
              <legend>Interne Angaben</legend>

              <label className="g-ui-field">
                <span>Interne Notiz</span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Besonderheiten, Bestellabläufe oder interne Hinweise"
                />
              </label>
            </fieldset>

            <div className="customerCreateActions">
              <button
                className="g-ui-button g-ui-button--primary"
                type="submit"
              >
                Kunde anlegen
              </button>
            </div>
          </Form>
        </PageSection>

        <PageSection
          className="customerListSection"
          eyebrow="Kundenübersicht"
          title="Aktuelle Kunden"
          description={
            data.customers.length === 1
              ? "1 Kunde im System"
              : `${data.customers.length} Kunden im System`
          }
        >
          {data.customers.length === 0 ? (
            <div className="g-ui-empty customerEmptyState">
              <strong>Noch keine Kunden angelegt</strong>
              <span>
                Lege deinen ersten Kunden an oder übernimm die
                Kundendaten aus einem neuen Auftrag.
              </span>
            </div>
          ) : (
            <div className="customersGrid">
              {data.customers.map((customer: any) => (
                <article
                  className="customerCard"
                  key={customer.id}
                >
                  <div className="customerCardHeader">
                    <div className="customerIdentity">
                      <div
                        className="customerInitial"
                        aria-hidden="true"
                      >
                        {String(customer.name || "K")
                          .trim()
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>

                      <div>
                        <div className="customerTitleLine">
                          <h3>{customer.name}</h3>
                          <span className="customerNumberBadge">
                            {customer.customerNumber || "Ohne Nummer"}
                          </span>
                        </div>
                        <p>
                          {customer.contactName ||
                            "Kein Ansprechpartner"}
                        </p>
                      </div>
                    </div>

                    <span className="customerOrderBadge g-ui-pill">
                      {customer._count?.orders || 0}{" "}
                      {(customer._count?.orders || 0) === 1
                        ? "Auftrag"
                        : "Aufträge"}
                    </span>
                  </div>

                  <div className="customerDetails">
                    <div>
                      <span>Ansprechpartner</span>
                      <strong>
                        {customer.contactName || "Nicht hinterlegt"}
                      </strong>
                    </div>

                    <div>
                      <span>E-Mail</span>
                      <strong>
                        {customer.email || "Nicht hinterlegt"}
                      </strong>
                    </div>

                    <div>
                      <span>Telefon</span>
                      <strong>
                        {customer.phone || "Nicht hinterlegt"}
                      </strong>
                    </div>

                    <div className="customerAddressDetail">
                      <span>Adresse</span>
                      <strong>
                        {[
                            [customer.street, customer.houseNumber]
                              .filter(Boolean)
                              .join(" "),
                            [customer.postalCode, customer.city]
                              .filter(Boolean)
                              .join(" "),
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                            customer.address ||
                            "Nicht hinterlegt"}
                      </strong>
                    </div>
                  </div>

                  <div className="customerCardActions">
                    <details className="customerEditDetails">
                      <summary className="g-ui-button g-ui-button--secondary">
                        Bearbeiten
                      </summary>

                      <Form
                        method="post"
                        className="customerEditForm"
                      >
                        <input
                          type="hidden"
                          name="intent"
                          value="updateCustomer"
                        />
                        <input
                          type="hidden"
                          name="customerId"
                          value={customer.id}
                        />

                        <div className="customerEditSection">
                          <h4>Grunddaten</h4>

                          <div className="customerFormGrid">
                            <label className="g-ui-field">
                              <span>Kundennummer</span>
                              <input
                                value={customer.customerNumber || ""}
                                readOnly
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Kundentyp</span>
                              <select
                                name="customerType"
                                defaultValue={
                                  customer.customerType || "BUSINESS"
                                }
                              >
                                <option value="BUSINESS">
                                  Firmenkunde
                                </option>
                                <option value="PRIVATE">
                                  Privatkunde
                                </option>
                              </select>
                            </label>

                            <label className="g-ui-field customerFormWide">
                              <span>Firmen- oder Kundenname *</span>
                              <input
                                name="name"
                                defaultValue={customer.name}
                                required
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Status</span>
                              <select
                                name="active"
                                defaultValue={
                                  customer.active === false
                                    ? "false"
                                    : "true"
                                }
                              >
                                <option value="true">Aktiv</option>
                                <option value="false">Inaktiv</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="customerEditSection">
                          <h4>Kontakt</h4>

                          <div className="customerFormGrid">
                            <label className="g-ui-field">
                              <span>Ansprechpartner</span>
                              <input
                                name="contactName"
                                defaultValue={
                                  customer.contactName || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>E-Mail</span>
                              <input
                                name="email"
                                type="email"
                                defaultValue={customer.email || ""}
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Rechnungs-E-Mail</span>
                              <input
                                name="invoiceEmail"
                                type="email"
                                defaultValue={
                                  customer.invoiceEmail || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Telefon</span>
                              <input
                                name="phone"
                                type="tel"
                                defaultValue={customer.phone || ""}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="customerEditSection">
                          <h4>Rechnungsadresse</h4>

                          <div className="customerFormGrid customerAddressGrid">
                            <label className="g-ui-field customerStreetField">
                              <span>Straße</span>
                              <input
                                name="street"
                                defaultValue={customer.street || ""}
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Hausnummer</span>
                              <input
                                name="houseNumber"
                                defaultValue={
                                  customer.houseNumber || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>PLZ</span>
                              <input
                                name="postalCode"
                                defaultValue={
                                  customer.postalCode || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Ort</span>
                              <input
                                name="city"
                                defaultValue={customer.city || ""}
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Land</span>
                              <select
                                name="country"
                                defaultValue={customer.country || "DE"}
                              >
                                <option value="DE">Deutschland</option>
                                <option value="AT">Österreich</option>
                                <option value="CH">Schweiz</option>
                                <option value="OTHER">
                                  Anderes Land
                                </option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="customerEditSection">
                          <h4>Abrechnung</h4>

                          <div className="customerFormGrid">
                            <label className="g-ui-field">
                              <span>USt-IdNr.</span>
                              <input
                                name="vatId"
                                defaultValue={customer.vatId || ""}
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Kostenstelle</span>
                              <input
                                name="costCenter"
                                defaultValue={
                                  customer.costCenter || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Zahlungsziel</span>
                              <select
                                name="paymentTermDays"
                                defaultValue={String(
                                  customer.paymentTermDays ?? 14
                                )}
                              >
                                <option value="0">Sofort fällig</option>
                                <option value="7">7 Tage</option>
                                <option value="14">14 Tage</option>
                                <option value="30">30 Tage</option>
                              </select>
                            </label>

                            <label className="g-ui-field">
                              <span>Belegsprache</span>
                              <select
                                name="invoiceLanguage"
                                defaultValue={
                                  customer.invoiceLanguage || "DE"
                                }
                              >
                                <option value="DE">Deutsch</option>
                                <option value="EN">Englisch</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="customerEditSection">
                          <h4>Abweichende Lieferadresse</h4>

                          <label className="customerCheckboxField">
                            <input
                              type="checkbox"
                              name="differentDeliveryAddress"
                              defaultChecked={
                                customer.differentDeliveryAddress === true
                              }
                            />
                            <span>
                              Abweichende Lieferadresse verwenden
                            </span>
                          </label>

                          <div className="customerFormGrid customerAddressGrid">
                            <label className="g-ui-field customerStreetField">
                              <span>Lieferstraße</span>
                              <input
                                name="deliveryStreet"
                                defaultValue={
                                  customer.deliveryStreet || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Hausnummer</span>
                              <input
                                name="deliveryHouseNumber"
                                defaultValue={
                                  customer.deliveryHouseNumber || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>PLZ</span>
                              <input
                                name="deliveryPostalCode"
                                defaultValue={
                                  customer.deliveryPostalCode || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Ort</span>
                              <input
                                name="deliveryCity"
                                defaultValue={
                                  customer.deliveryCity || ""
                                }
                              />
                            </label>

                            <label className="g-ui-field">
                              <span>Land</span>
                              <select
                                name="deliveryCountry"
                                defaultValue={
                                  customer.deliveryCountry || "DE"
                                }
                              >
                                <option value="DE">Deutschland</option>
                                <option value="AT">Österreich</option>
                                <option value="CH">Schweiz</option>
                                <option value="OTHER">
                                  Anderes Land
                                </option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="customerEditSection">
                          <h4>Interne Angaben</h4>

                          <label className="g-ui-field">
                            <span>Interne Notiz</span>
                            <textarea
                              name="notes"
                              rows={3}
                              defaultValue={customer.notes || ""}
                            />
                          </label>
                        </div>

                        <div className="customerEditActions">
                          <button
                            className="g-ui-button g-ui-button--primary"
                            type="submit"
                          >
                            Änderungen speichern
                          </button>
                        </div>
                      </Form>
                    </details>

                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="deleteCustomer"
                      />
                      <input
                        type="hidden"
                        name="customerId"
                        value={customer.id}
                      />

                      <button
                        className="g-ui-button g-ui-button--danger"
                        type="submit"
                      >
                        Löschen
                      </button>
                    </Form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}

