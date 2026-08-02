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

import "../styles/gastario-administration.css";

export function meta() {
  return [
    {
      title: "Rechnungsdaten · Gastario",
    },
  ];
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  const { getUserId } =
    await import("../lib/session.server");

  const { prisma } =
    await import("../lib/prisma.server");

  const userId =
    await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access =
    await prisma.tenantUser.findFirst({
      where: {
        userId,
      },
      include: {
        tenant: true,
      },
    });

  if (!access?.tenant) {
    return {
      tenant: null,
      requiredComplete: false,
      missingFields: [
        "Mandant",
      ],
    };
  }

  const tenant =
    access.tenant as any;

  const missingFields: string[] = [];

  if (!tenant.invoiceSellerName) {
    missingFields.push(
      "Firmenname"
    );
  }

  if (!tenant.invoiceSellerAddress) {
    missingFields.push(
      "Firmenadresse"
    );
  }

  if (
    !tenant.invoiceTaxNumber &&
    !tenant.invoiceVatId
  ) {
    missingFields.push(
      "Steuernummer oder USt-ID"
    );
  }

  if (!tenant.invoiceIban) {
    missingFields.push(
      "IBAN"
    );
  }

  if (!tenant.invoiceBankName) {
    missingFields.push(
      "Bankname"
    );
  }

  return {
    tenant,
    requiredComplete:
      missingFields.length === 0,
    missingFields,
  };
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const { getUserId } =
    await import("../lib/session.server");

  const { prisma } =
    await import("../lib/prisma.server");

  const userId =
    await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access =
    await prisma.tenantUser.findFirst({
      where: {
        userId,
      },
      include: {
        tenant: true,
      },
    });

  if (!access?.tenant) {
    return {
      error:
        "Kein Mandant gefunden.",
    };
  }

  const formData =
    await request.formData();

  const invoiceSellerName =
    String(
      formData.get(
        "invoiceSellerName"
      ) || ""
    ).trim();

  const invoiceSellerAddress =
    String(
      formData.get(
        "invoiceSellerAddress"
      ) || ""
    ).trim();

  const invoiceTaxNumber =
    String(
      formData.get(
        "invoiceTaxNumber"
      ) || ""
    ).trim();

  const invoiceVatId =
    String(
      formData.get(
        "invoiceVatId"
      ) || ""
    ).trim();

  const invoiceEmail =
    String(
      formData.get(
        "invoiceEmail"
      ) || ""
    ).trim();

  const invoicePhone =
    String(
      formData.get(
        "invoicePhone"
      ) || ""
    ).trim();

  const invoiceIban =
    String(
      formData.get(
        "invoiceIban"
      ) || ""
    ).trim();

  const invoiceBic =
    String(
      formData.get(
        "invoiceBic"
      ) || ""
    ).trim();

  const invoiceBankName =
    String(
      formData.get(
        "invoiceBankName"
      ) || ""
    ).trim();

  const invoicePaymentTermsDe =
    String(
      formData.get(
        "invoicePaymentTermsDe"
      ) || ""
    ).trim();

  const invoicePaymentTermsEn =
    String(
      formData.get(
        "invoicePaymentTermsEn"
      ) || ""
    ).trim();

  const invoiceClosingTextDe =
    String(
      formData.get(
        "invoiceClosingTextDe"
      ) || ""
    ).trim();

  const invoiceClosingTextEn =
    String(
      formData.get(
        "invoiceClosingTextEn"
      ) || ""
    ).trim();

  if (!invoiceSellerName) {
    return {
      error: "Firmenname fehlt.",
    };
  }

  if (!invoiceSellerAddress) {
    return {
      error:
        "Firmenadresse fehlt.",
    };
  }

  if (
    !invoiceTaxNumber &&
    !invoiceVatId
  ) {
    return {
      error:
        "Steuernummer oder USt-ID fehlt.",
    };
  }

  if (!invoiceIban) {
    return {
      error: "IBAN fehlt.",
    };
  }

  if (!invoiceBankName) {
    return {
      error: "Bankname fehlt.",
    };
  }

  await prisma.tenant.update({
    where: {
      id: access.tenantId,
    },
    data: {
      invoiceSellerName,
      invoiceSellerAddress,
      invoiceTaxNumber:
        invoiceTaxNumber || null,
      invoiceVatId:
        invoiceVatId || null,
      invoiceEmail:
        invoiceEmail || null,
      invoicePhone:
        invoicePhone || null,
      invoiceIban,
      invoiceBic:
        invoiceBic || null,
      invoiceBankName,
      invoicePaymentTermsDe:
        invoicePaymentTermsDe ||
        "Zahlbar sofort, rein netto.",
      invoicePaymentTermsEn:
        invoicePaymentTermsEn ||
        "Payable immediately without deduction.",
      invoiceClosingTextDe:
        invoiceClosingTextDe ||
        "Vielen Dank für die gute Zusammenarbeit.",
      invoiceClosingTextEn:
        invoiceClosingTextEn ||
        "Thank you for your business.",
    } as any,
  });

  return {
    success:
      "Rechnungsdaten wurden gespeichert.",
  };
}

export default function RechnungsdatenPage() {
  const data =
    useLoaderData<typeof loader>();

  const actionData =
    useActionData<typeof action>();

  const tenant =
    data.tenant as any;

  return (
    <AppLayout>
      <PageShell className="adminPage invoiceSettingsPage">
        <PageHeader
          eyebrow="Verwaltung"
          title="Rechnungsdaten"
          subtitle="Firmendaten, Steuerangaben, Bankverbindung und Standardtexte zentral für alle neuen Rechnungen pflegen."
          actions={
            <Link
              to="/rechnungen"
              className="adminButton adminButtonSecondary"
            >
              Zurück zu Rechnungen
            </Link>
          }
        />

        {actionData &&
        "error" in actionData ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        {actionData &&
        "success" in actionData ? (
          <Notice type="success">
            {actionData.success}
          </Notice>
        ) : null}

        <PageSection
          className="adminStatusSection"
          eyebrow="Pflichtstatus"
          title={
            data.requiredComplete
              ? "Rechnungsdaten vollständig"
              : "Rechnungsdaten unvollständig"
          }
          description="Diese Angaben werden in neue Rechnungen übernommen und sind Voraussetzung für eine saubere Finalisierung."
          actions={
            <div
              className={
                data.requiredComplete
                  ? "adminStatusBadge isReady"
                  : "adminStatusBadge isWarning"
              }
            >
              <strong>
                {data.requiredComplete
                  ? "Bereit"
                  : "Fehlt noch"}
              </strong>

              <span>
                {data.requiredComplete
                  ? "Finalisierung möglich"
                  : "Pflichtdaten ergänzen"}
              </span>
            </div>
          }
        >
          {!data.requiredComplete ? (
            <div className="adminMissingFields">
              {data.missingFields.map(
                (field) => (
                  <span key={field}>
                    {field}
                  </span>
                )
              )}
            </div>
          ) : (
            <div className="adminInlineSuccess">
              Alle notwendigen Angaben sind hinterlegt.
            </div>
          )}
        </PageSection>

        <Form
          method="post"
          className="adminForm"
        >
          <PageSection
            eyebrow="Unternehmen"
            title="Firmendaten"
            description="Diese Daten erscheinen als Rechnungsaussteller auf Dokumenten und PDF-Dateien."
          >
            <div className="adminFormStack">
              <div className="adminFormGrid adminFormGridTwo">
                <Field label="Firmenname *">
                  <input
                    name="invoiceSellerName"
                    defaultValue={
                      tenant?.invoiceSellerName ||
                      tenant?.name ||
                      ""
                    }
                    required
                  />
                </Field>

                <Field label="E-Mail">
                  <input
                    name="invoiceEmail"
                    type="email"
                    defaultValue={
                      tenant?.invoiceEmail ||
                      ""
                    }
                    placeholder="rechnung@example.de"
                  />
                </Field>
              </div>

              <Field label="Firmenadresse *">
                <textarea
                  name="invoiceSellerAddress"
                  defaultValue={
                    tenant?.invoiceSellerAddress ||
                    ""
                  }
                  required
                  rows={4}
                  placeholder={
                    "Straße Hausnummer\nPLZ Ort\nDeutschland"
                  }
                />
              </Field>

              <div className="adminFormGrid adminFormGridThree">
                <Field label="Steuernummer">
                  <input
                    name="invoiceTaxNumber"
                    defaultValue={
                      tenant?.invoiceTaxNumber ||
                      ""
                    }
                    placeholder="Steuernummer"
                  />
                </Field>

                <Field label="USt-ID">
                  <input
                    name="invoiceVatId"
                    defaultValue={
                      tenant?.invoiceVatId ||
                      ""
                    }
                    placeholder="DE..."
                  />
                </Field>

                <Field label="Telefon">
                  <input
                    name="invoicePhone"
                    defaultValue={
                      tenant?.invoicePhone ||
                      ""
                    }
                    placeholder="+49 ..."
                  />
                </Field>
              </div>

              <Notice type="warning">
                Mindestens Steuernummer oder USt-ID ist erforderlich.
              </Notice>
            </div>
          </PageSection>

          <PageSection
            eyebrow="Zahlung"
            title="Bankverbindung"
            description="Diese Angaben erscheinen später auf Rechnungen und PDF-Ausgaben."
          >
            <div className="adminFormGrid adminFormGridThree">
              <Field label="IBAN *">
                <input
                  name="invoiceIban"
                  defaultValue={
                    tenant?.invoiceIban ||
                    ""
                  }
                  required
                  placeholder="DE..."
                />
              </Field>

              <Field label="BIC">
                <input
                  name="invoiceBic"
                  defaultValue={
                    tenant?.invoiceBic ||
                    ""
                  }
                  placeholder="optional"
                />
              </Field>

              <Field label="Bankname *">
                <input
                  name="invoiceBankName"
                  defaultValue={
                    tenant?.invoiceBankName ||
                    ""
                  }
                  required
                  placeholder="Bankname"
                  list="bankNameOptions"
                />

                <datalist id="bankNameOptions">
                  <option value="Deutsche Bank" />
                  <option value="Commerzbank" />
                  <option value="Sparkasse" />
                  <option value="Berliner Sparkasse" />
                  <option value="Postbank" />
                  <option value="Volksbank" />
                  <option value="Raiffeisenbank" />
                  <option value="DKB" />
                  <option value="N26" />
                  <option value="ING" />
                  <option value="Comdirect" />
                  <option value="Targobank" />
                  <option value="Santander" />
                  <option value="HypoVereinsbank" />
                  <option value="GLS Bank" />
                  <option value="Revolut" />
                  <option value="Wise" />
                </datalist>
              </Field>
            </div>
          </PageSection>

          <PageSection
            eyebrow="Standardtexte"
            title="Zahlungsbedingungen und Nachbemerkung"
            description="Diese Texte werden für neue Rechnungen automatisch vorgeschlagen."
          >
            <div className="adminFormStack">
              <div className="adminFormGrid adminFormGridTwo">
                <Field label="Zahlungsbedingung Deutsch">
                  <input
                    name="invoicePaymentTermsDe"
                    defaultValue={
                      tenant?.invoicePaymentTermsDe ||
                      "Zahlbar sofort, rein netto."
                    }
                  />
                </Field>

                <Field label="Zahlungsbedingung Englisch">
                  <input
                    name="invoicePaymentTermsEn"
                    defaultValue={
                      tenant?.invoicePaymentTermsEn ||
                      "Payable immediately without deduction."
                    }
                  />
                </Field>
              </div>

              <div className="adminFormGrid adminFormGridTwo">
                <Field label="Nachbemerkung Deutsch">
                  <input
                    name="invoiceClosingTextDe"
                    defaultValue={
                      tenant?.invoiceClosingTextDe ||
                      "Vielen Dank für die gute Zusammenarbeit."
                    }
                  />
                </Field>

                <Field label="Nachbemerkung Englisch">
                  <input
                    name="invoiceClosingTextEn"
                    defaultValue={
                      tenant?.invoiceClosingTextEn ||
                      "Thank you for your business."
                    }
                  />
                </Field>
              </div>
            </div>
          </PageSection>

          <div className="adminSaveBar">
            <div>
              <strong>
                Rechnungsdaten speichern
              </strong>

              <span>
                Änderungen gelten für neue Rechnungen und spätere PDF-Ausgaben.
              </span>
            </div>

            <button
              type="submit"
              className="adminButton adminButtonPrimary"
            >
              Rechnungsdaten speichern
            </button>
          </div>
        </Form>
      </PageShell>
    </AppLayout>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="adminField">
      <span>{label}</span>
      {children}
    </label>
  );
}
