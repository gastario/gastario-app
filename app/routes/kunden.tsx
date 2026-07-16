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
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const contactName = String(formData.get("contactName") || "").trim();

    if (!name) {
      return { error: "Kundenname fehlt." };
    }

    await prisma.customer.create({
      data: {
        tenantId: access.tenantId,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        contactName: contactName || null,
      } as any,
    });

    return { success: "Kunde wurde angelegt." };
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
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const contactName = String(formData.get("contactName") || "").trim();

    if (!name) {
      return { error: "Kundenname fehlt." };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        contactName: contactName || null,
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

            <label className="g-ui-field">
              <span>Kundenname</span>
              <input
                name="name"
                placeholder="Firma oder Kunde"
                required
              />
            </label>

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
              <span>Telefon</span>
              <input
                name="phone"
                placeholder="030 12345678"
              />
            </label>

            <label className="g-ui-field customerAddressField">
              <span>Adresse</span>
              <input
                name="address"
                placeholder="Straße, Hausnummer, PLZ und Ort"
              />
            </label>

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
                        <h3>{customer.name}</h3>
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
                        {customer.address || "Nicht hinterlegt"}
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

                        <label className="g-ui-field">
                          <span>Kundenname</span>
                          <input
                            name="name"
                            defaultValue={customer.name}
                            required
                          />
                        </label>

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
                          <span>Telefon</span>
                          <input
                            name="phone"
                            defaultValue={customer.phone || ""}
                          />
                        </label>

                        <label className="g-ui-field customerEditAddress">
                          <span>Adresse</span>
                          <input
                            name="address"
                            defaultValue={
                              customer.address || ""
                            }
                          />
                        </label>

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

