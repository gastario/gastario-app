import { useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Form, redirect, useActionData } from "react-router";

type ManualItem = {
  id: string;
  name: string;
  quantity: string;
  unitPriceEuro: string;
  itemNotes: string;
};

function euroToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "0")
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const number = Number(raw);
  if (!Number.isFinite(number)) return 0;

  return Math.round(number * 100);
}

function euroInputToNumber(value: string) {
  const raw = String(value || "0")
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function formatEuro(value: number) {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function parseGermanDateInput(value: string) {
  const raw = String(value || "").trim();

  const germanMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanMatch) {
    const day = germanMatch[1].padStart(2, "0");
    const month = germanMatch[2].padStart(2, "0");
    const year = germanMatch[3];
    return new Date(year + "-" + month + "-" + day + "T00:00:00");
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(raw + "T00:00:00");
  }

  return null;
}

function createOrderNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return "MAN-" + date + "-" + random;
}

function makeItem(partial: Partial<ManualItem> = {}): ManualItem {
  return {
    id: Math.random().toString(36).slice(2),
    name: partial.name || "",
    quantity: partial.quantity || "1",
    unitPriceEuro: partial.unitPriceEuro || "",
    itemNotes: partial.itemNotes || "",
  };
}

export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");

  const userId = await getUserId(request);

  if (!userId) {
    return redirect("/login");
  }

  return null;
}

export async function action({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    return { error: "Nicht angemeldet." };
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
  });

  if (!tenantUser) {
    return { error: "Kein Mandant gefunden." };
  }

  const formData = await request.formData();

  const customerName = String(formData.get("customerName") || "").trim();
  const customerEmail = String(formData.get("customerEmail") || "").trim().toLowerCase();
  const customerPhone = String(formData.get("customerPhone") || "").trim();

  const deliveryDateRaw = String(formData.get("deliveryDate") || "").trim();
  const deliveryTime = String(formData.get("deliveryTime") || "").trim();

  const deliveryStreet = String(formData.get("deliveryStreet") || "").trim();
  const deliveryZip = String(formData.get("deliveryZip") || "").trim();
  const deliveryCity = String(formData.get("deliveryCity") || "").trim();
  const deliveryAddressNote = String(formData.get("deliveryAddressNote") || "").trim();

  const deliveryAddress = [
    deliveryStreet,
    [deliveryZip, deliveryCity].filter(Boolean).join(" "),
    deliveryAddressNote,
  ]
    .filter(Boolean)
    .join(", ");

  const contactName = String(formData.get("contactName") || "").trim();
  const contactPhone = String(formData.get("contactPhone") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  const itemNames = formData.getAll("itemName").map((value) => String(value || "").trim());
  const quantities = formData.getAll("quantity").map((value) => Number(String(value || "1").replace(",", ".")));
  const unitPrices = formData.getAll("unitPriceEuro").map((value) => euroToCents(value));
  const itemNotes = formData.getAll("itemNotes").map((value) => String(value || "").trim());

  const items = itemNames
    .map((name, index) => {
      const quantity = Number.isFinite(quantities[index]) && quantities[index] > 0 ? quantities[index] : 1;
      const unitCents = unitPrices[index] || 0;

      return {
        name,
        quantity,
        unit: "Stück",
        unitCents,
        totalCents: Math.round(quantity * unitCents),
        notes: itemNotes[index] || null,
      };
    })
    .filter((item) => item.name || item.notes);

  if (!customerName) {
    return { error: "Bitte Kundennamen eintragen." };
  }

  if (!deliveryDateRaw) {
    return { error: "Bitte Lieferdatum eintragen." };
  }

  const deliveryDate = parseGermanDateInput(deliveryDateRaw);

  if (!deliveryDate || Number.isNaN(deliveryDate.getTime())) {
    return { error: "Bitte Lieferdatum im Format TT.MM.JJJJ eintragen." };
  }

  if (items.length === 0) {
    return { error: "Bitte mindestens eine Position oder Freitextposition eintragen." };
  }

  let customer = await prisma.customer.findFirst({
    where: {
      tenantId: tenantUser.tenantId,
      OR: [
        ...(customerEmail ? [{ email: customerEmail }] : []),
        { name: customerName },
      ],
    } as any,
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId: tenantUser.tenantId,
        name: customerName,
        email: customerEmail || null,
        phone: customerPhone || null,
      } as any,
    });
  }

  await prisma.order.create({
    data: {
      tenantId: tenantUser.tenantId,
      customerId: customer.id,
      orderNumber: createOrderNumber(),
      source: "DIRECT" as any,
      status: "AUTO_CREATED" as any,
      customerName,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      deliveryDate,
      deliveryTimeText: deliveryTime || null,
      deliveryAddress: deliveryAddress || null,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      notes: notes || null,
      items: {
        create: items.map((item) => ({
          name: item.name || "Freitextposition",
          quantity: item.quantity,
          unit: item.unit,
          unitCents: item.unitCents,
          totalCents: item.totalCents,
          notes: item.notes,
        })),
      },
    } as any,
  });

  return redirect("/auftragseingang?status=AUTO_CREATED");
}

export default function NeuerAuftragPage() {
  const actionData = useActionData<typeof action>();

  const [items, setItems] = useState<ManualItem[]>([
    makeItem({ name: "", quantity: "1" }),
    makeItem({ name: "", quantity: "" }),
  ]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(String(item.quantity || "1").replace(",", "."));
      const cleanQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
      const unit = euroInputToNumber(item.unitPriceEuro);
      return sum + cleanQuantity * unit;
    }, 0);
  }, [items]);

  function updateItem(id: string, field: keyof ManualItem, value: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItems((current) => [...current, makeItem({ quantity: "1" })]);
  }

  function addTextItem() {
    setItems((current) => [
      ...current,
      makeItem({
        name: "Freitextposition",
        quantity: "1",
        unitPriceEuro: "",
        itemNotes: "",
      }),
    ]);
  }

  function removeItem(id: string) {
    setItems((current) => {
      if (current.length <= 1) return current;
      return current.filter((item) => item.id !== id);
    });
  }

  const pageStyle: any = {
    padding: "0 0 44px",
    color: "#111827",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  };

  const shellStyle: any = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "0 24px",
  };

  const cardStyle: any = {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: 18,
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.055)",
    padding: 24,
  };

  const labelStyle: any = {
    display: "grid",
    gap: 6,
    color: "#374151",
    fontSize: 12,
    fontWeight: 650,
  };

  const inputStyle: any = {
    width: "100%",
    minHeight: 40,
    border: "1px solid #d6e1ea",
    borderRadius: 10,
    padding: "0 13px",
    fontSize: 14,
    fontWeight: 500,
    color: "#111827",
    background: "#ffffff",
    boxSizing: "border-box",
  };

  const textareaStyle: any = {
    ...inputStyle,
    minHeight: 86,
    padding: 13,
    resize: "vertical",
    lineHeight: 1.45,
  };

  const primaryButtonStyle: any = {
    border: "1px solid #0f9f7a",
    background: "#0f9f7a",
    color: "#ffffff",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 650,
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(15, 159, 122, 0.13)",
  };

  const secondaryButtonStyle: any = {
    border: "1px solid #d6e1ea",
    background: "#ffffff",
    color: "#111827",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 650,
    textDecoration: "none",
    cursor: "pointer",
  };

  const subtleButtonStyle: any = {
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 10,
    padding: "10px 13px",
    fontWeight: 650,
    cursor: "pointer",
  };

  const dangerButtonStyle: any = {
    border: "1px solid #fecaca",
    background: "#fff7f7",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 650,
    cursor: "pointer",
  };

  const sectionTitleStyle: any = {
    margin: "0 0 14px",
    fontSize: 20,
    letterSpacing: "-0.025em",
    fontWeight: 650,
  };

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={shellStyle}>
          <header style={{ ...cardStyle, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={{
                  color: "#047857",
                  textTransform: "uppercase",
                  letterSpacing: ".10em",
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  Auftrag
                </div>

                <h1 style={{ margin: "6px 0 0", fontSize: 34, lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 700 }}>
                  Neuer Auftrag
                </h1>

                <p style={{ margin: "10px 0 0", color: "#64748b", fontWeight: 500 }}>
                  Manuell erfassen und anschließend im Auftragseingang prüfen.
                </p>
              </div>

              <a href="/auftragseingang" style={secondaryButtonStyle}>
                Zurück zum Eingang
              </a>
            </div>
          </header>

          {actionData?.error ? (
            <div style={{
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
              borderRadius: 14,
              padding: 14,
              fontWeight: 650,
              marginBottom: 16,
            }}>
              {actionData.error}
            </div>
          ) : null}

          <Form method="post" style={{ display: "grid", gap: 18 }}>
            <section style={cardStyle}>
              <h2 style={sectionTitleStyle}>Kundendaten</h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                <label style={labelStyle}>
                  Kunde *
                  <input name="customerName" style={inputStyle} placeholder="z. B. Muster GmbH" />
                </label>

                <label style={labelStyle}>
                  E-Mail
                  <input name="customerEmail" type="email" style={inputStyle} placeholder="kunde@example.de" />
                </label>

                <label style={labelStyle}>
                  Telefon
                  <input name="customerPhone" style={inputStyle} placeholder="030..." />
                </label>

                <label style={labelStyle}>
                  Kontaktperson
                  <input name="contactName" style={inputStyle} placeholder="Name" />
                </label>

                <label style={labelStyle}>
                  Kontakt Telefon
                  <input name="contactPhone" style={inputStyle} placeholder="Mobil / Büro" />
                </label>
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={sectionTitleStyle}>Lieferung</h2>

              <div style={{ display: "grid", gridTemplateColumns: "160px 140px minmax(0, 1.4fr) 110px 160px", gap: 12, alignItems: "end" }}>
                <label style={labelStyle}>
                  Lieferdatum *
                  <input name="deliveryDate" inputMode="numeric" style={inputStyle} placeholder="TT.MM.JJJJ" />
                </label>

                <label style={labelStyle}>
                  Lieferzeit
                  <input name="deliveryTime" style={inputStyle} placeholder="12:00" />
                </label>

                <label style={labelStyle}>
                  Straße / Hausnummer
                  <input name="deliveryStreet" style={inputStyle} placeholder="Straße 12" />
                </label>

                <label style={labelStyle}>
                  PLZ
                  <input name="deliveryZip" inputMode="numeric" style={inputStyle} placeholder="10115" />
                </label>

                <label style={labelStyle}>
                  Ort
                  <input name="deliveryCity" style={inputStyle} placeholder="Berlin" />
                </label>
              </div>

              <label style={{ ...labelStyle, marginTop: 12 }}>
                Zusatz zur Lieferadresse
                <textarea name="deliveryAddressNote" style={textareaStyle} placeholder="z. B. Hinterhof, Etage, Ansprechpartner vor Ort, Klingelname..." />
              </label>
            </section>

            <section style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
                <div>
                  <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Positionen</h2>
                  <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
                    Positionen können frei ergänzt oder gelöscht werden.
                  </p>
                </div>

                <div style={{
                  border: "1px solid #dbe7ee",
                  background: "#f8fafc",
                  borderRadius: 14,
                  padding: "10px 14px",
                  minWidth: 160,
                  textAlign: "right",
                }}>
                  <div style={{ color: "#64748b", fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    Gesamtsumme netto
                  </div>
                  <strong style={{ display: "block", fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                    {formatEuro(total)}
                  </strong>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(220px, 1.3fr) 90px 130px minmax(220px, 1fr) auto",
                      gap: 10,
                      alignItems: "end",
                      border: "1px solid #eef2f6",
                      background: "#fcfdff",
                      borderRadius: 14,
                      padding: 10,
                    }}
                  >
                    <label style={labelStyle}>
                      Position {index + 1}
                      <input
                        name="itemName"
                        value={item.name}
                        onChange={(event) => updateItem(item.id, "name", event.target.value)}
                        style={inputStyle}
                        placeholder={index === 0 ? "z. B. Chicken Bowl" : "Weitere Position"}
                      />
                    </label>

                    <label style={labelStyle}>
                      Menge
                      <input
                        name="quantity"
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelStyle}>
                      Einzelpreis netto
                      <input
                        name="unitPriceEuro"
                        value={item.unitPriceEuro}
                        onChange={(event) => updateItem(item.id, "unitPriceEuro", event.target.value)}
                        style={inputStyle}
                        placeholder="0,00"
                      />
                    </label>

                    <label style={labelStyle}>
                      Freitext / Hinweis
                      <input
                        name="itemNotes"
                        value={item.itemNotes}
                        onChange={(event) => updateItem(item.id, "itemNotes", event.target.value)}
                        style={inputStyle}
                        placeholder="Allergene, Besonderheit, Beschreibung..."
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      style={dangerButtonStyle}
                      disabled={items.length <= 1}
                    >
                      Löschen
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button type="button" onClick={addItem} style={subtleButtonStyle}>
                  + Position hinzufügen
                </button>

                <button type="button" onClick={addTextItem} style={secondaryButtonStyle}>
                  + Freitextposition
                </button>
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={sectionTitleStyle}>Notizen</h2>

              <label style={labelStyle}>
                Interne Notizen
                <textarea name="notes" style={textareaStyle} placeholder="Besonderheiten, Absprachen, Hinweise..." />
              </label>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Der Auftrag wird zuerst im Auftragseingang geprüft.
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <a href="/auftragseingang" style={secondaryButtonStyle}>Abbrechen</a>
                  <button type="submit" style={primaryButtonStyle}>Auftrag anlegen</button>
                </div>
              </div>
            </section>
          </Form>
        </div>
      </div>

      <style>{`
        input::placeholder,
        textarea::placeholder {
          color: #8a94a6 !important;
          font-weight: 500 !important;
        }

        button:disabled {
          opacity: .45;
          cursor: not-allowed !important;
        }

        @media (max-width: 1100px) {
          form section div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
