import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";

type PositionRow =
  | {
      id: number;
      type: "item";
      name: string;
      quantity: string;
      unit: string;
      price: string;
      discount: string;
      taxRate: string;
    }
  | {
      id: number;
      type: "text";
      text: string;
    };

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function euroToCents(value: FormDataEntryValue | string | null) {
  const normalized = String(value || "0")
    .replace(/€/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

function parseNumber(value: FormDataEntryValue | string | null, fallback = 0) {
  const parsed = Number(String(value || "").replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function parseDateInput(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = new Date(raw + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function calculateTotals(rows: PositionRow[], priceMode: "NET" | "GROSS", discountMode: "PERCENT" | "AMOUNT", globalDiscount: string) {
  let netTotalCents = 0;
  let taxTotalCents = 0;
  let grossTotalCents = 0;

  for (const row of rows) {
    if (row.type !== "item") continue;

    const quantity = Math.max(0, parseNumber(row.quantity, 1));
    const taxRate = Math.max(0, parseNumber(row.taxRate, 19));
    const discountPercent = Math.max(0, Math.min(parseNumber(row.discount, 0), 100));
    const inputCents = euroToCents(row.price);

    let netUnitCents = inputCents;

    if (priceMode === "GROSS" && taxRate > 0) {
      netUnitCents = Math.round(inputCents / (1 + taxRate / 100));
    }

    const beforeDiscountCents = Math.round(netUnitCents * quantity);
    const discountCents = Math.round(beforeDiscountCents * (discountPercent / 100));
    const netLineCents = Math.max(0, beforeDiscountCents - discountCents);
    const taxLineCents = Math.round(netLineCents * (taxRate / 100));
    const grossLineCents = netLineCents + taxLineCents;

    netTotalCents += netLineCents;
    taxTotalCents += taxLineCents;
    grossTotalCents += grossLineCents;
  }

  const discountValue =
    discountMode === "PERCENT"
      ? Math.round(netTotalCents * (Math.max(0, Math.min(parseNumber(globalDiscount, 0), 100)) / 100))
      : Math.min(netTotalCents, euroToCents(globalDiscount));

  if (discountValue > 0 && netTotalCents > 0) {
    const factor = Math.max(0, (netTotalCents - discountValue) / netTotalCents);
    netTotalCents = Math.round(netTotalCents * factor);
    taxTotalCents = Math.round(taxTotalCents * factor);
    grossTotalCents = netTotalCents + taxTotalCents;
  }

  return { netTotalCents, taxTotalCents, grossTotalCents };
}

export function meta() {
  return [{ title: "Neue Rechnung · Gastario" }];
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

  if (!access?.tenant) {
    return {
      tenantName: "Gastario",
      tenant: null,
      invoiceSettingsComplete: false,
      today: todayInput(),
    };
  }

  const tenant = access.tenant as any;

  const invoiceSettingsComplete = Boolean(
    tenant.invoiceSellerName &&
    tenant.invoiceSellerAddress &&
    (tenant.invoiceTaxNumber || tenant.invoiceVatId) &&
    tenant.invoiceIban &&
    tenant.invoiceBankName
  );

  return {
    tenantName: access.tenant.name || "Gastario",
    tenant,
    invoiceSettingsComplete,
    today: todayInput(),
  };
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

  if (!access?.tenant) {
    return { error: "Kein Mandant gefunden." };
  }

  const tenant = access.tenant as any;

  const invoiceSettingsComplete = Boolean(
    tenant.invoiceSellerName &&
    tenant.invoiceSellerAddress &&
    (tenant.invoiceTaxNumber || tenant.invoiceVatId) &&
    tenant.invoiceIban &&
    tenant.invoiceBankName
  );

  if (!invoiceSettingsComplete) {
    return { error: "Rechnungsdaten sind unvollständig. Bitte zuerst unter Verkauf > Rechnungsdaten vervollständigen." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "createInvoiceDraft") {
    return { error: "Unbekannte Aktion." };
  }

  const invoiceNumber = String(formData.get("invoiceNumber") || "").trim();
  const customerNumberInput = String(formData.get("customerNumber") || "").trim();
  const invoiceCount = await prisma.invoice.count({ where: { tenantId: access.tenantId } });
  const customerNumber = customerNumberInput || "KD-" + String(invoiceCount + 1).padStart(5, "0");

  const language = String(formData.get("language") || "DE");
  const priceMode = String(formData.get("priceMode") || "NET");

  const customerName = String(formData.get("customerName") || "").trim();
  const street = String(formData.get("street") || "").trim();
  const zip = String(formData.get("zip") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const country = String(formData.get("country") || "Deutschland").trim();
  const addressExtra = String(formData.get("addressExtra") || "").trim();

  const customerAddress = [
    addressExtra,
    street,
    [zip, city].filter(Boolean).join(" "),
    country,
  ].filter(Boolean).join("\n");

  const invoiceDate = parseDateInput(formData.get("invoiceDate"));
  const serviceDate = parseDateInput(formData.get("serviceDate"));
  const serviceEndDate = parseDateInput(formData.get("serviceEndDate"));
  const serviceDateType = String(formData.get("serviceDateType") || "Leistungsdatum");

  const title = String(formData.get("title") || "Rechnung").trim();
  const introText = String(formData.get("introText") || "").trim();
  const paymentTerms = String(formData.get("paymentTerms") || "").trim();
  const closingText = String(formData.get("closingText") || "").trim();

  const itemKinds = formData.getAll("itemKind").map((value) => String(value || "item"));
  const itemNames = formData.getAll("itemName").map((value) => String(value || "").trim());
  const quantities = formData.getAll("quantity").map((value) => parseNumber(value, 1));
  const units = formData.getAll("unit").map((value) => String(value || "Stück").trim());
  const unitPrices = formData.getAll("unitPriceEuro");
  const discounts = formData.getAll("discountPercent").map((value) => Math.max(0, Math.min(parseNumber(value, 0), 100)));
  const taxRates = formData.getAll("taxRate").map((value) => Math.max(0, parseNumber(value, 19)));

  const globalDiscountMode = String(formData.get("globalDiscountMode") || "PERCENT");
  const globalDiscountValue = String(formData.get("globalDiscountValue") || "0").trim();

  if (!invoiceNumber) return { error: "Rechnungsnummer fehlt." };
  if (!customerName) return { error: "Kunde fehlt." };
  if (!street || !zip || !city || !country) return { error: "Vollständige Rechnungsadresse des Kunden fehlt." };
  if (!invoiceDate) return { error: "Rechnungsdatum fehlt." };
  if (!serviceDate) return { error: "Leistungsdatum fehlt." };
  if (serviceDateType.toLowerCase().includes("zeitraum") && !serviceEndDate) {
    return { error: "Bei Lieferzeitraum oder Leistungszeitraum fehlt das Bis-Datum." };
  }

  const existing = await prisma.invoice.findFirst({
    where: {
      tenantId: access.tenantId,
      externalInvoiceNumber: invoiceNumber,
    },
  });

  if (existing) {
    return { error: "Diese Rechnungsnummer ist bereits vorhanden." };
  }

  const invoiceItems = itemNames
    .map((name, index) => {
      const kind = itemKinds[index] === "text" ? "TEXT" : "ITEM";

      if (!name) return null;

      if (kind === "TEXT") {
        return {
          position: index + 1,
          type: "TEXT",
          name,
          quantity: 1,
          unit: "Text",
          unitCents: 0,
          discountPercent: 0,
          discountCents: 0,
          netTotalCents: 0,
          taxRate: 0,
          taxTotalCents: 0,
          grossTotalCents: 0,
        };
      }

      const quantity = Math.max(0, quantities[index] || 1);
      const taxRate = taxRates[index] ?? 19;
      const discountPercent = discounts[index] ?? 0;
      const inputCents = euroToCents(unitPrices[index]);

      if (inputCents <= 0) return null;

      let netUnitCents = inputCents;

      if (priceMode === "GROSS" && taxRate > 0) {
        netUnitCents = Math.round(inputCents / (1 + taxRate / 100));
      }

      const beforeDiscountCents = Math.round(netUnitCents * quantity);
      const discountCents = Math.round(beforeDiscountCents * (discountPercent / 100));
      const netTotalCents = Math.max(0, beforeDiscountCents - discountCents);
      const taxTotalCents = Math.round(netTotalCents * (taxRate / 100));
      const grossTotalCents = netTotalCents + taxTotalCents;

      return {
        position: index + 1,
        type: "ITEM",
        name,
        quantity,
        unit: units[index] || "Stück",
        unitCents: netUnitCents,
        discountPercent: Math.round(discountPercent),
        discountCents,
        netTotalCents,
        taxRate,
        taxTotalCents,
        grossTotalCents,
      };
    })
    .filter(Boolean) as Array<any>;

  if (invoiceItems.filter((item) => item.type === "ITEM").length === 0) {
    return { error: "Mindestens eine vollständige Artikelposition mit Preis fehlt." };
  }

  let netTotalCents = invoiceItems.reduce((sum, item) => sum + (item.netTotalCents || 0), 0);
  let taxTotalCents = invoiceItems.reduce((sum, item) => sum + (item.taxTotalCents || 0), 0);
  let grossTotalCents = invoiceItems.reduce((sum, item) => sum + (item.grossTotalCents || 0), 0);

  const globalDiscountCents =
    globalDiscountMode === "PERCENT"
      ? Math.round(netTotalCents * (Math.max(0, Math.min(parseNumber(globalDiscountValue, 0), 100)) / 100))
      : Math.min(netTotalCents, euroToCents(globalDiscountValue));

  if (globalDiscountCents > 0 && netTotalCents > 0) {
    const factor = Math.max(0, (netTotalCents - globalDiscountCents) / netTotalCents);
    netTotalCents = Math.round(netTotalCents * factor);
    taxTotalCents = Math.round(taxTotalCents * factor);
    grossTotalCents = netTotalCents + taxTotalCents;
  }

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: access.tenantId,
      type: "DIRECT" as any,
      status: "DRAFT" as any,
      numberSource: "MANUAL" as any,
      externalInvoiceNumber: invoiceNumber,
      language: language as any,
      customerType: "BUSINESS" as any,
      taxTreatment: "DOMESTIC_19" as any,
      invoiceDate,
      serviceDate,
      customerName,
      customerAddress,
      customerCountry: country === "Deutschland" ? "DE" : country,
      sellerName: tenant.invoiceSellerName,
      sellerAddress: tenant.invoiceSellerAddress,
      sellerTaxNumber: tenant.invoiceTaxNumber || null,
      sellerVatId: tenant.invoiceVatId || null,
      currency: "EUR",
      netTotalCents,
      taxTotalCents,
      grossTotalCents,
      paymentTermsDe: paymentTerms || tenant.invoicePaymentTermsDe || "Zahlbar sofort, rein netto.",
      paymentTermsEn: tenant.invoicePaymentTermsEn || "Payable immediately without deduction.",
      notes: [
        "Kundennummer: " + customerNumber,
        "Preisangabe: " + (priceMode === "GROSS" ? "Brutto" : "Netto"),
        "Leistungsangabe: " + serviceDateType,
        serviceEndDate ? "Zeitraum bis: " + serviceEndDate.toISOString().slice(0, 10) : "",
        title,
        introText,
        globalDiscountCents > 0 ? "Gesamtrabatt: " + (globalDiscountMode === "PERCENT" ? globalDiscountValue + "%" : globalDiscountValue + " €") : "",
        closingText || tenant.invoiceClosingTextDe || "",
        tenant.invoiceIban ? "IBAN: " + tenant.invoiceIban : "",
        tenant.invoiceBic ? "BIC: " + tenant.invoiceBic : "",
        tenant.invoiceBankName ? "Bank: " + tenant.invoiceBankName : "",
      ].filter(Boolean).join("\n\n"),
    } as any,
  });

  await prisma.invoiceItem.createMany({
    data: invoiceItems.map((item) => ({
      invoiceId: invoice.id,
      ...item,
    })),
  });

  throw redirect(`/rechnungen/${invoice.id}`);
}

export default function NeueRechnungPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const today = data.today;
  const tenant = data.tenant as any;

  const [language, setLanguage] = useState<"DE" | "EN">("DE");
  const [serviceDateType, setServiceDateType] = useState("Leistungsdatum");
  const isEnglish = language === "EN";
  const isPeriod = serviceDateType.toLowerCase().includes("zeitraum");

  const [priceMode, setPriceMode] = useState<"NET" | "GROSS">("NET");
  const [discountVisible, setDiscountVisible] = useState(false);
  const [discountMode, setDiscountMode] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [globalDiscount, setGlobalDiscount] = useState("0");

  const [rows, setRows] = useState<PositionRow[]>([
    {
      id: Date.now(),
      type: "item",
      name: "",
      quantity: "1,00",
      unit: "Stück",
      price: "",
      discount: "0",
      taxRate: "19",
    },
  ]);

  const totals = useMemo(
    () => calculateTotals(rows, priceMode, discountMode, globalDiscount),
    [rows, priceMode, discountMode, globalDiscount]
  );

  function updateItem(id: number, field: keyof Extract<PositionRow, { type: "item" }>, value: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id || row.type !== "item") return row;
        return { ...row, [field]: value };
      })
    );
  }

  function updateText(id: number, value: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id || row.type !== "text") return row;
        return { ...row, text: value };
      })
    );
  }

  function addItem() {
    setRows((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        type: "item",
        name: "",
        quantity: "1,00",
        unit: "Stück",
        price: "",
        discount: "0",
        taxRate: "19",
      },
    ]);
  }

  function addText() {
    setRows((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        type: "text",
        text: "",
      },
    ]);
  }

  function removeRow(id: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Rechnung erstellen</h1>

        </div>

        <Link className="button secondary" to="/rechnungen">
          Zur Übersicht
        </Link>
      </header>

      {actionData && "error" in actionData ? <div style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div style={successStyle}>{actionData.success}</div> : null}

      {!data.invoiceSettingsComplete ? (
        <div style={blockedPageStyle}>
          <div style={blockedIconStyle}>!</div>
          <div>
            <p style={sectionLabelStyle}>Rechnungserstellung gesperrt</p>
            <h2 style={blockedTitleStyle}>Rechnungsdaten zuerst vervollständigen</h2>
            <p style={blockedTextStyle}>
              Damit Gastario saubere Rechnungen erstellen kann, müssen Firmenadresse, Steuernummer oder USt-ID,
              IBAN und Bankname hinterlegt sein. Danach wird der Rechnungseditor automatisch freigeschaltet.
            </p>
          </div>
          <Link to="/einstellungen/rechnungen" style={primaryButtonStyle}>
            Rechnungsdaten vervollständigen
          </Link>
        </div>
      ) : (
      <Form method="post" style={pageStyle} className="invoiceEditorForm">
        <style>
          {`
            .invoiceEditorForm {
              color: #102033;
            }

            .invoiceEditorForm section {
              box-shadow: 0 10px 26px rgba(15, 23, 42, 0.045) !important;
            }

            .invoiceEditorForm input,
            .invoiceEditorForm select,
            .invoiceEditorForm textarea {
              font-weight: 400 !important;
              font-size: 14px !important;
              border-radius: 9px !important;
              border-color: #d4dee6 !important;
              box-shadow: none !important;
            }

            .invoiceEditorForm input:focus,
            .invoiceEditorForm select:focus,
            .invoiceEditorForm textarea:focus {
              border-color: #0f8a73 !important;
              box-shadow: 0 0 0 3px rgba(15, 138, 115, 0.10) !important;
            }

            .invoiceEditorForm label {
              font-weight: 500 !important;
              color: #5b6b7f !important;
            }

            .invoiceEditorForm strong {
              font-weight: 600 !important;
            }

            .invoiceEditorForm button,
            .invoiceEditorForm a {
              font-weight: 600 !important;
            }

            .invoiceEditorForm .positionCardClean {
              border-radius: 18px !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }

            .invoiceEditorForm .positionHeaderClean {
              background: #f8fafc !important;
              border-bottom: 1px solid #e8eef3 !important;
              color: #738296 !important;
              font-weight: 600 !important;
            }

            .invoiceEditorForm .positionRowClean {
              background: #ffffff !important;
              border-top: none !important;
              border-bottom: 1px solid #eef3f7 !important;
            }

            .invoiceEditorForm .positionRowClean:hover {
              background: #fbfdfd !important;
            }

            .invoiceEditorForm .sumClean {
              background: #fbfdfe !important;
              border-top: 1px solid #e8eef3 !important;
              color: #334155 !important;
            }

            .invoiceEditorForm .sumClean strong {
              font-size: 15px !important;
            }

            .invoiceEditorForm .grossClean {
              background: #f2faf8 !important;
              color: #057a67 !important;
            }

            .invoiceEditorForm .softAction {
              background: transparent !important;
              color: #475569 !important;
              border: 1px solid transparent !important;
              box-shadow: none !important;
            }

            .invoiceEditorForm .softAction:hover {
              background: #f8fafc !important;
              border-color: #e2e8f0 !important;
            }

            .invoiceEditorForm .primarySoft {
              background: #057a67 !important;
              border-color: #057a67 !important;
              box-shadow: 0 8px 18px rgba(5, 122, 103, 0.14) !important;
            }
          `}
        </style>
        <input type="hidden" name="intent" value="createInvoiceDraft" />
        <input type="hidden" name="priceMode" value={priceMode} />
        <input type="hidden" name="globalDiscountMode" value={discountMode} />
        <input type="hidden" name="globalDiscountValue" value={globalDiscount} />

        <div style={topSwitchStyle}>
          <button type="button" onClick={() => setPriceMode("GROSS")} style={priceMode === "GROSS" ? activeSwitchButtonStyle : switchButtonStyle}>
            Brutto
          </button>
          <button type="button" onClick={() => setPriceMode("NET")} style={priceMode === "NET" ? activeSwitchButtonStyle : switchButtonStyle}>
            Netto
          </button>
        </div>

        <section style={cardStyle}>
          <div style={twoColStyle}>
            <div style={gridStyle}>
              <FloatingInput name="customerName" label={isEnglish ? "Customer" : "Kunde"} placeholder={isEnglish ? "Customer name" : "Name des Kunden"} required />
              <FloatingInput name="addressExtra" label={isEnglish ? "Address line 2" : "Adresszusatz"} placeholder={isEnglish ? "Address line 2" : "Adresszusatz"} />
              <FloatingInput name="street" label={isEnglish ? "Street" : "Straße"} placeholder={isEnglish ? "Street" : "Straße"} required />

              <div style={twoColSmallStyle}>
                <FloatingInput name="zip" label={isEnglish ? "ZIP" : "PLZ"} placeholder={isEnglish ? "ZIP" : "PLZ"} required />
                <FloatingInput name="city" label={isEnglish ? "City" : "Ort"} placeholder={isEnglish ? "City" : "Ort"} required />
              </div>

              <label style={labelStyle}>
                <span>{isEnglish ? "Country" : "Land"} *</span>
                <select name="country" defaultValue="Deutschland" required style={inputStyle}>
                  <option>Deutschland</option>
                  <option>Österreich</option>
                  <option>Schweiz</option>
                  <option>Andere</option>
                </select>
              </label>
            </div>

            <div style={gridStyle}>
              <FloatingInput name="invoiceNumber" label={isEnglish ? "Invoice number" : "Rechnungsnummer"} placeholder="z. B. RE-2026-001" required />
              <FloatingInput name="customerNumber" label={isEnglish ? "Customer number" : "Kundennummer"} placeholder={isEnglish ? "assigned automatically" : "wird automatisch vergeben"} />

              <FloatingInput name="invoiceDate" label={isEnglish ? "Invoice date" : "Rechnungsdatum"} type="date" defaultValue={today} required />

              <div style={isPeriod ? threeDateGridStyle : twoColSmallStyle}>
                <label style={labelStyle}>
                  <span>{isEnglish ? "Delivery or service" : "Lieferung oder Leistung"}</span>
                  <select
                    name="serviceDateType"
                    value={serviceDateType}
                    onChange={(event) => setServiceDateType(event.currentTarget.value)}
                    style={inputStyle}
                  >
                    <option>Lieferdatum</option>
                    <option>Leistungsdatum</option>
                    <option>Lieferzeitraum</option>
                    <option>Leistungszeitraum</option>
                  </select>
                </label>

                <FloatingInput name="serviceDate" label={isPeriod ? "Von" : "Datum"} type="date" defaultValue={today} required />

                {isPeriod ? (
                  <FloatingInput name="serviceEndDate" label="Bis" type="date" defaultValue={today} required />
                ) : null}
              </div>

              <label style={labelStyle}>
                <span>{isEnglish ? "Document language" : "Belegsprache"}</span>
                <select
                  name="language"
                  value={language}
                  onChange={(event) => setLanguage(event.currentTarget.value as "DE" | "EN")}
                  style={inputStyle}
                >
                  <option value="DE">Deutsch</option>
                  <option value="EN">Englisch</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <p style={sectionLabelStyle}>{isEnglish ? "Seller details" : "Eigene Rechnungsdaten"}</p>
          <div style={sellerInfoStyle}>
            <div style={sellerBlockStyle}>
              <strong>{tenant?.invoiceSellerName || data.tenantName}</strong>
              <span>{tenant?.invoiceSellerAddress || "Keine Adresse hinterlegt"}</span>
            </div>

            <div style={sellerBlockStyle}>
              {tenant?.invoiceTaxNumber ? <span>Steuernummer: {tenant.invoiceTaxNumber}</span> : null}
              {tenant?.invoiceVatId ? <span>USt-ID: {tenant.invoiceVatId}</span> : null}
              {tenant?.invoiceBankName ? <span>Bank: {tenant.invoiceBankName}</span> : null}
            </div>

            <Link to="/einstellungen/rechnungen" style={secondaryButtonStyle}>{isEnglish ? "Edit" : "Bearbeiten"}</Link>
          </div>
        </section>

        <section key={`text-${language}`} style={simpleTextCardStyle}>
          <div style={sectionHeaderStyle}>
            <p style={sectionLabelStyle}>{isEnglish ? "Text" : "Text"}</p>
            <h2 style={sectionTitleStyle}>{isEnglish ? "Document text" : "Belegtext"}</h2>
          </div>

          <div style={gridStyle}>
            <FloatingInput name="title" label={isEnglish ? "Document title" : "Belegtitel"} defaultValue={isEnglish ? "Invoice" : "Rechnung"} />
            <FloatingInput
              name="introText"
              label={isEnglish ? "Intro text" : "Einleitungstext"}
              defaultValue={isEnglish ? "We invoice you for the following goods/services." : "Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung."}
            />
          </div>
        </section>

        <section style={positionCardStyle} className="positionCardClean">
          <div style={positionHeaderStyle} className="positionHeaderClean">
            <span></span>
            <span>{isEnglish ? "Item" : "Artikel"}</span>
            <span>{isEnglish ? "Qty" : "Menge"}</span>
            <span>{isEnglish ? "Unit" : "Einheit"}</span>
            <span>{priceMode === "GROSS" ? (isEnglish ? "Gross price" : "VK Brutto") : (isEnglish ? "Net price" : "VK Netto")}</span>
            <span>{isEnglish ? "Discount" : "Rabatt"}</span>
            <span>{isEnglish ? "VAT" : "USt"}</span>
            <span style={{ textAlign: "right" }}>{isEnglish ? "Amount" : "Betrag"}</span>
            <span></span>
          </div>

          <div style={{ display: "grid" }}>
            {rows.map((row, index) =>
              row.type === "text" ? (
                <div key={row.id} style={textRowStyle}>
                  <input type="hidden" name="itemKind" value="text" />
                  <input type="hidden" name="quantity" value="1" />
                  <input type="hidden" name="unit" value="Text" />
                  <input type="hidden" name="unitPriceEuro" value="0" />
                  <input type="hidden" name="discountPercent" value="0" />
                  <input type="hidden" name="taxRate" value="0" />

                  <div style={numberCircleStyle}>≡</div>
                  <FloatingControlledInput name="itemName" label="Freitext" placeholder="Text zur Rechnung" value={row.text} onChange={(value) => updateText(row.id, value)} />
                  <button type="button" onClick={() => removeRow(row.id)} style={deleteButtonStyle}>×</button>
                </div>
              ) : (
                <div key={row.id} style={positionRowStyle} className="positionRowClean">
                  <input type="hidden" name="itemKind" value="item" />

                  <div style={numberCircleStyle}>{index + 1}</div>

                  <CleanInput name="itemName" placeholder={isEnglish ? "Item description" : "Bezeichnung des Artikels"} value={row.name} onChange={(value) => updateItem(row.id, "name", value)} required />
                  <CleanInput name="quantity" value={row.quantity} onChange={(value) => updateItem(row.id, "quantity", value)} />
                  <CleanInput name="unit" value={row.unit} onChange={(value) => updateItem(row.id, "unit", value)} />
                  <CleanInput name="unitPriceEuro" placeholder="0,00 €" value={row.price} onChange={(value) => updateItem(row.id, "price", value)} required />
                  <CleanInput name="discountPercent" value={row.discount} onChange={(value) => updateItem(row.id, "discount", value)} />

                  <select name="taxRate" value={row.taxRate} onChange={(event) => updateItem(row.id, "taxRate", event.currentTarget.value)} style={taxPillStyle}>
                    <option value="19">19 %</option>
                    <option value="7">7 %</option>
                    <option value="0">0 %</option>
                  </select>

                  <div style={amountBoxStyle}>
                    <strong style={lineAmountStyle}>{centsToEuro(calculateTotals([row], priceMode, "PERCENT", "0").netTotalCents)}</strong>
                  </div>

                  <button type="button" onClick={() => removeRow(row.id)} style={deleteButtonStyle}>×</button>
                </div>
              )
            )}
          </div>

          {discountVisible ? (
            <div style={discountRowStyle}>
              <div style={numberCircleDarkStyle}>%</div>
              <FloatingInput name="discountTitle" label="Gesamtrabatt" defaultValue="Gesamtrabatt" />
              <label style={labelStyle}>
                <span>Rabatt in</span>
                <select value={discountMode} onChange={(event) => setDiscountMode(event.currentTarget.value as "PERCENT" | "AMOUNT")} style={inputStyle}>
                  <option value="PERCENT">Prozent</option>
                  <option value="AMOUNT">Betrag</option>
                </select>
              </label>
              <FloatingControlledInput
                name="discountVisibleValue"
                label="Wert"
                value={globalDiscount}
                onChange={setGlobalDiscount}
                placeholder={discountMode === "PERCENT" ? "10" : "25,00 €"}
              />
              <button type="button" onClick={() => { setDiscountVisible(false); setGlobalDiscount("0"); }} style={deleteButtonStyle}>×</button>
            </div>
          ) : null}

          <div style={positionActionsStyle}>
            <button type="button" onClick={addItem} style={outlineButtonStyle}>+ {isEnglish ? "Item" : "Artikel"}</button>
            <button type="button" onClick={addText} style={textActionStyle} className="softAction">{isEnglish ? "Text line" : "Freitext"}</button>
            <button type="button" onClick={() => setDiscountVisible(true)} style={textActionStyle} className="softAction">{isEnglish ? "Discount" : "Gesamtrabatt"}</button>
          </div>

          <div style={totalBarStyle} className="sumClean">
            <div />
            <div style={sumBoxStyle}>
              <span>{isEnglish ? "Net amount" : "Summe Netto"}</span>
              <strong>{centsToEuro(totals.netTotalCents)}</strong>
            </div>
            <div style={grossBoxStyle} className="grossClean">
              <span>{isEnglish ? "Total amount" : "Gesamtbetrag"}</span>
              <strong>{centsToEuro(totals.grossTotalCents)}</strong>
            </div>
          </div>
        </section>

        <section key={`terms-${language}`} style={cardStyle}>
          <FloatingInput
            name="paymentTerms"
            label={isEnglish ? "Payment terms" : "Zahlungsbedingung"}
            defaultValue={isEnglish ? tenant?.invoicePaymentTermsEn || "Payable immediately without deduction." : tenant?.invoicePaymentTermsDe || "Zahlbar sofort, rein netto."}
          />
          <FloatingInput
            name="closingText"
            label={isEnglish ? "Closing note" : "Nachbemerkung"}
            defaultValue={isEnglish ? tenant?.invoiceClosingTextEn || "Thank you for your business." : tenant?.invoiceClosingTextDe || "Vielen Dank für die gute Zusammenarbeit."}
          />
        </section>

        <div style={footerActionsStyle}>
          <Link to="/rechnungen" style={secondaryButtonStyle}>{isEnglish ? "Cancel" : "Abbrechen"}</Link>
          <button type="submit" disabled={!data.invoiceSettingsComplete} style={data.invoiceSettingsComplete ? primaryButtonStyle : disabledButtonStyle} className="primarySoft">
            {isEnglish ? "Save invoice draft" : "Rechnungsentwurf speichern"}
          </button>
        </div>
      </Form>
      )}
    </AppLayout>
  );
}

function FloatingInput({
  name,
  label,
  placeholder,
  defaultValue,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label style={labelStyle}>
      <span>{label}{required ? " *" : ""}</span>
      <input name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required={required} style={inputStyle} />
    </label>
  );
}

function FloatingControlledInput({
  name,
  label,
  placeholder,
  value,
  onChange,
  required = false,
}: {
  name: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label style={labelStyle}>
      <span>{label}{required ? " *" : ""}</span>
      <input name={name} placeholder={placeholder} value={value} onChange={(event) => onChange(event.currentTarget.value)} required={required} style={inputStyle} />
    </label>
  );
}

function CleanInput({
  name,
  placeholder,
  value,
  onChange,
  required = false,
}: {
  name: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <input
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      required={required}
      style={cleanInputStyle}
    />
  );
}

const pageStyle: React.CSSProperties = { maxWidth: 1480, margin: "0 auto", display: "grid", gap: 20 };
const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.045)",
};
const positionCardStyle: React.CSSProperties = {
  ...cardStyle,
  padding: 0,
  overflow: "hidden",
};

const simpleTextCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: "grid",
  gap: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 19,
  letterSpacing: "-0.015em",
  fontWeight: 600,
  color: "#0f172a",
};

const positionHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(360px, 1fr) 84px 108px 118px 82px 92px 110px 28px",
  gap: 10,
  padding: "14px 20px",
  color: "#738296",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.045em",
  background: "#f8fafc",
};

const cleanInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  border: "1px solid #ccd7df",
  borderRadius: 10,
  padding: "9px 11px",
  fontSize: 14,
  fontWeight: 500,
  background: "#ffffff",
  color: "#0f172a",
};
const twoColStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 };
const twoColSmallStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "0.7fr 1.3fr", gap: 12 };

const threeDateGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 12,
};
const gridStyle: React.CSSProperties = { display: "grid", gap: 14 };
const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#475569",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.2,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  border: "1px solid #ccd7df",
  borderRadius: 11,
  padding: "10px 12px",
  fontSize: 14,
  fontWeight: 500,
  background: "#ffffff",
  color: "#0f172a",
};
const sectionLabelStyle: React.CSSProperties = { margin: "0 0 12px", color: "#00796b", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 11, fontWeight: 700 };
const topSwitchStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end" };
const switchButtonStyle: React.CSSProperties = { minHeight: 40, border: "1px solid #cbd5e1", padding: "0 16px", background: "#ffffff", fontWeight: 700, cursor: "pointer" };
const activeSwitchButtonStyle: React.CSSProperties = { ...switchButtonStyle, background: "#e6f4ef", color: "#047857", borderColor: "#059669" };
const sellerInfoStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.25fr 1fr auto",
  gap: 24,
  alignItems: "center",
  color: "#475569",
};

const sellerBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  lineHeight: 1.45,
};

const sellerBlockStrongStyle: React.CSSProperties = {
  fontWeight: 650,
  color: "#0f172a",
};
const positionRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(360px, 1fr) 84px 108px 118px 82px 92px 110px 28px",
  gap: 10,
  alignItems: "center",
  padding: "12px 20px",
  borderBottom: "1px solid #eef3f7",
};
const textRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) 30px", gap: 10, alignItems: "end", padding: "18px 22px 8px" };
const discountRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(260px, 1fr) 180px 180px 30px", gap: 10, alignItems: "end", padding: "18px 22px", borderTop: "1px solid #eef2f7" };
const numberCircleStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#475569",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  marginBottom: 8,
};
const numberCircleDarkStyle: React.CSSProperties = { ...numberCircleStyle, background: "#334155", color: "#ffffff" };
const amountBoxStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  alignContent: "center",
  gap: 4,
  color: "#334155",
  minHeight: 42,
  textAlign: "right",
};

const lineAmountStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1,
  color: "#0f172a",
};
const taxPillStyle: React.CSSProperties = {
  border: "1px solid #ccd7df",
  borderRadius: 10,
  background: "#ffffff",
  color: "#334155",
  height: 34,
  padding: "0 10px",
  fontWeight: 600,
  fontSize: 13,
};
const deleteButtonStyle: React.CSSProperties = {
  width: 28,
  height: 34,
  border: "none",
  background: "transparent",
  color: "#94a3b8",
  fontSize: 18,
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: 6,
};
const positionActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
  padding: "16px 20px 22px",
  borderTop: "1px solid #f1f5f9",
};
const outlineButtonStyle: React.CSSProperties = {
  minHeight: 36,
  border: "1px solid #0f8a73",
  background: "#ffffff",
  color: "#057a67",
  borderRadius: 10,
  padding: "0 14px",
  fontWeight: 600,
  cursor: "pointer",
};
const textActionStyle: React.CSSProperties = {
  minHeight: 38,
  border: "1px solid transparent",
  background: "transparent",
  color: "#475569",
  borderRadius: 11,
  padding: "0 12px",
  fontWeight: 600,
  cursor: "pointer",
};
const totalBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 190px 190px",
  background: "#f8fafc",
  color: "#0f172a",
  borderTop: "1px solid #e2e8f0",
};
const sumBoxStyle: React.CSSProperties = {
  padding: "14px 18px",
  display: "grid",
  justifyItems: "end",
  borderLeft: "1px solid #e2e8f0",
  gap: 3,
  fontSize: 13,
  color: "#475569",
};
const grossBoxStyle: React.CSSProperties = {
  ...sumBoxStyle,
  background: "#eef7f5",
  color: "#045f50",
  fontWeight: 650,
};
const footerActionsStyle: React.CSSProperties = {
  position: "sticky",
  bottom: 18,
  zIndex: 3,
  background: "rgba(255, 255, 255, 0.96)",
  backdropFilter: "blur(10px)",
  border: "1px solid #dbe5eb",
  borderRadius: 18,
  padding: 14,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.10)",
};
const primaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  padding: "0 17px",
  fontSize: 14,
  fontWeight: 650,
  border: "1px solid #036b5a",
  background: "#057a67",
  color: "#ffffff",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 20px rgba(5, 122, 103, 0.16)",
};
const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  padding: "0 17px",
  fontSize: 14,
  fontWeight: 650,
  border: "1px solid #c8d4dd",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 8px 16px rgba(15, 23, 42, 0.045)",
};
const disabledButtonStyle: React.CSSProperties = { ...primaryButtonStyle, opacity: 0.45, cursor: "not-allowed" };
const blockingNoticeStyle: React.CSSProperties = { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 18, padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 };

const blockedPageStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "34px auto 0",
  background: "linear-gradient(135deg, #ffffff 0%, #fffaf3 100%)",
  border: "1px solid #fed7aa",
  borderRadius: 24,
  padding: 30,
  display: "grid",
  gridTemplateColumns: "56px 1fr auto",
  alignItems: "center",
  gap: 22,
  boxShadow: "0 22px 55px rgba(154, 52, 18, 0.10)",
};

const blockedIconStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 18,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  fontWeight: 700,
};

const blockedTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 26,
  letterSpacing: "-0.045em",
  color: "#0f172a",
};

const blockedTextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#7c2d12",
  fontWeight: 650,
  lineHeight: 1.55,
};
const errorStyle: React.CSSProperties = { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 14, padding: 14, fontWeight: 700 };
const successStyle: React.CSSProperties = { background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857", borderRadius: 14, padding: 14, fontWeight: 700 };












