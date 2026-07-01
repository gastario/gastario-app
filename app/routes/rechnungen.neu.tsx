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
          <p className="muted">Professioneller Editor mit Pflichtangaben-Prüfung und Live-Berechnung.</p>
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
      <Form method="post" style={pageStyle}>
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
              <FloatingInput name="customerName" label="Kunde" placeholder="Name des Kunden" required />
              <FloatingInput name="addressExtra" label="Adresszusatz" placeholder="Adresszusatz" />
              <FloatingInput name="street" label="Straße" placeholder="Straße" required />

              <div style={twoColSmallStyle}>
                <FloatingInput name="zip" label="PLZ" placeholder="PLZ" required />
                <FloatingInput name="city" label="Ort" placeholder="Ort" required />
              </div>

              <label style={labelStyle}>
                <span>Land *</span>
                <select name="country" defaultValue="Deutschland" required style={inputStyle}>
                  <option>Deutschland</option>
                  <option>Österreich</option>
                  <option>Schweiz</option>
                  <option>Andere</option>
                </select>
              </label>
            </div>

            <div style={gridStyle}>
              <FloatingInput name="invoiceNumber" label="Rechnungsnummer" placeholder="z. B. RE-2026-001" required />
              <FloatingInput name="customerNumber" label="Kundennummer" placeholder="wird automatisch vergeben" />

              <FloatingInput name="invoiceDate" label="Rechnungsdatum" type="date" defaultValue={today} required />

              <div style={twoColSmallStyle}>
                <label style={labelStyle}>
                  <span>Lieferung oder Leistung</span>
                  <select name="serviceDateType" defaultValue="Leistungsdatum" style={inputStyle}>
                    <option>Lieferdatum</option>
                    <option>Leistungsdatum</option>
                    <option>Lieferzeitraum</option>
                    <option>Leistungszeitraum</option>
                  </select>
                </label>

                <FloatingInput name="serviceDate" label="Datum" type="date" defaultValue={today} required />
              </div>

              <label style={labelStyle}>
                <span>Belegsprache</span>
                <select name="language" defaultValue="DE" style={inputStyle}>
                  <option value="DE">Deutsch</option>
                  <option value="EN">Englisch</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <p style={sectionLabelStyle}>Eigene Rechnungsdaten</p>
          <div style={sellerInfoStyle}>
            <div>
              <strong>{tenant?.invoiceSellerName || data.tenantName}</strong>
              <span>{tenant?.invoiceSellerAddress || "Keine Adresse hinterlegt"}</span>
            </div>
            <div>
              <span>{tenant?.invoiceTaxNumber ? "Steuernummer: " + tenant.invoiceTaxNumber : ""}</span>
              <span>{tenant?.invoiceVatId ? "USt-ID: " + tenant.invoiceVatId : ""}</span>
            </div>
            <Link to="/einstellungen/rechnungen" style={secondaryButtonStyle}>Bearbeiten</Link>
          </div>
        </section>

        <section style={cardStyle}>
          <FloatingInput name="title" label="Belegtitel" defaultValue="Rechnung" />
          <FloatingInput
            name="introText"
            label="Einleitungstext"
            defaultValue="Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung."
          />
        </section>

        <section style={positionCardStyle}>
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
                <div key={row.id} style={positionRowStyle}>
                  <input type="hidden" name="itemKind" value="item" />

                  <div style={numberCircleStyle}>{index + 1}</div>

                  <FloatingControlledInput name="itemName" label="Artikel" placeholder="Bezeichnung des Artikels" value={row.name} onChange={(value) => updateItem(row.id, "name", value)} required />
                  <FloatingControlledInput name="quantity" label="Menge" value={row.quantity} onChange={(value) => updateItem(row.id, "quantity", value)} />
                  <FloatingControlledInput name="unit" label="Einheit" value={row.unit} onChange={(value) => updateItem(row.id, "unit", value)} />
                  <FloatingControlledInput name="unitPriceEuro" label={priceMode === "GROSS" ? "VK Brutto" : "VK Netto"} placeholder="0,00 €" value={row.price} onChange={(value) => updateItem(row.id, "price", value)} required />
                  <FloatingControlledInput name="discountPercent" label="Rabatt %" value={row.discount} onChange={(value) => updateItem(row.id, "discount", value)} />

                  <div style={amountBoxStyle}>
                    <strong>{centsToEuro(calculateTotals([row], priceMode, "PERCENT", "0").netTotalCents)}</strong>
                    <select name="taxRate" value={row.taxRate} onChange={(event) => updateItem(row.id, "taxRate", event.currentTarget.value)} style={taxPillStyle}>
                      <option value="19">USt 19 %</option>
                      <option value="7">USt 7 %</option>
                      <option value="0">USt 0 %</option>
                    </select>
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
            <button type="button" onClick={addItem} style={outlineButtonStyle}>+ Artikel</button>
            <button type="button" onClick={addText} style={textActionStyle}>Freitext</button>
            <button type="button" onClick={() => setDiscountVisible(true)} style={textActionStyle}>Gesamtrabatt</button>
          </div>

          <div style={totalBarStyle}>
            <div />
            <div style={sumBoxStyle}>
              <span>Summe Netto</span>
              <strong>{centsToEuro(totals.netTotalCents)}</strong>
            </div>
            <div style={grossBoxStyle}>
              <span>Gesamtbetrag</span>
              <strong>{centsToEuro(totals.grossTotalCents)}</strong>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <FloatingInput name="paymentTerms" label="Zahlungsbedingung" defaultValue={tenant?.invoicePaymentTermsDe || "Zahlbar sofort, rein netto."} />
          <FloatingInput name="closingText" label="Nachbemerkung" defaultValue={tenant?.invoiceClosingTextDe || "Vielen Dank für die gute Zusammenarbeit."} />
        </section>

        <div style={footerActionsStyle}>
          <Link to="/rechnungen" style={secondaryButtonStyle}>Abbrechen</Link>
          <button type="submit" disabled={!data.invoiceSettingsComplete} style={data.invoiceSettingsComplete ? primaryButtonStyle : disabledButtonStyle}>
            Rechnungsentwurf speichern
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

const pageStyle: React.CSSProperties = { maxWidth: 1480, margin: "0 auto", display: "grid", gap: 20 };
const cardStyle: React.CSSProperties = { background: "#ffffff", border: "1px solid #dbe5eb", borderRadius: 22, padding: 24, boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)" };
const positionCardStyle: React.CSSProperties = { ...cardStyle, padding: 0, overflow: "hidden" };
const twoColStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 };
const twoColSmallStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "0.7fr 1.3fr", gap: 12 };
const gridStyle: React.CSSProperties = { display: "grid", gap: 14 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 7, color: "#334155", fontSize: 12, fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", minHeight: 46, border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", fontSize: 14, fontWeight: 650, background: "#ffffff" };
const sectionLabelStyle: React.CSSProperties = { margin: "0 0 12px", color: "#00796b", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 11, fontWeight: 700 };
const topSwitchStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end" };
const switchButtonStyle: React.CSSProperties = { minHeight: 40, border: "1px solid #cbd5e1", padding: "0 16px", background: "#ffffff", fontWeight: 700, cursor: "pointer" };
const activeSwitchButtonStyle: React.CSSProperties = { ...switchButtonStyle, background: "#e6f4ef", color: "#047857", borderColor: "#059669" };
const sellerInfoStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 18, alignItems: "center", color: "#475569" };
const positionRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(240px, 1fr) 90px 130px 140px 100px 120px 30px", gap: 10, alignItems: "end", padding: "28px 22px 14px" };
const textRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) 30px", gap: 10, alignItems: "end", padding: "18px 22px 8px" };
const discountRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px minmax(260px, 1fr) 180px 180px 30px", gap: 10, alignItems: "end", padding: "18px 22px", borderTop: "1px solid #eef2f7" };
const numberCircleStyle: React.CSSProperties = { width: 32, height: 32, borderRadius: 999, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, marginBottom: 9 };
const numberCircleDarkStyle: React.CSSProperties = { ...numberCircleStyle, background: "#334155", color: "#ffffff" };
const amountBoxStyle: React.CSSProperties = { display: "grid", justifyItems: "end", gap: 8, paddingBottom: 4 };
const taxPillStyle: React.CSSProperties = { border: "none", borderRadius: 999, background: "#3f3f3f", color: "#ffffff", height: 28, padding: "0 9px", fontWeight: 700 };
const deleteButtonStyle: React.CSSProperties = { border: "none", background: "transparent", color: "#64748b", fontSize: 20, fontWeight: 700, cursor: "pointer", marginBottom: 12 };
const positionActionsStyle: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 18, padding: "12px 22px 26px" };
const outlineButtonStyle: React.CSSProperties = { minHeight: 40, border: "1px solid #059669", background: "#ffffff", color: "#059669", borderRadius: 12, padding: "0 16px", fontWeight: 700, cursor: "pointer" };
const textActionStyle: React.CSSProperties = { minHeight: 40, border: "1px solid transparent", background: "transparent", color: "#334155", borderRadius: 12, padding: "0 12px", fontWeight: 700, cursor: "pointer" };
const totalBarStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 170px 170px", background: "#555", color: "#ffffff" };
const sumBoxStyle: React.CSSProperties = { padding: 16, display: "grid", justifyItems: "center", borderLeft: "1px solid rgba(255,255,255,0.15)" };
const grossBoxStyle: React.CSSProperties = { ...sumBoxStyle, background: "#444" };
const footerActionsStyle: React.CSSProperties = { position: "sticky", bottom: 18, zIndex: 3, background: "rgba(255, 255, 255, 0.94)", backdropFilter: "blur(10px)", border: "1px solid #dbe5eb", borderRadius: 20, padding: 16, display: "flex", justifyContent: "flex-end", gap: 12, boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)" };
const primaryButtonStyle: React.CSSProperties = { minHeight: 44, borderRadius: 13, padding: "0 18px", fontSize: 14, fontWeight: 700, border: "1px solid #036b5a", background: "linear-gradient(135deg, #058872 0%, #04705f 100%)", color: "#ffffff", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 28px rgba(5, 122, 103, 0.24)" };
const secondaryButtonStyle: React.CSSProperties = { minHeight: 44, borderRadius: 13, padding: "0 18px", fontSize: 14, fontWeight: 700, border: "1px solid #c8d4dd", background: "#ffffff", color: "#0f172a", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 20px rgba(15, 23, 42, 0.06)" };
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





