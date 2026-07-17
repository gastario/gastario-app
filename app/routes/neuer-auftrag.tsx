import { useMemo, useState } from "react";
import auftraegeStyles from "../styles/auftraege.css?url";
import AppLayout from "../components/AppLayout";
import { Form, redirect, useActionData } from "react-router";

export function links() {
  return [
    {
      rel: "stylesheet",
      href: auftraegeStyles,
    },
  ];
}


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
    makeItem({ name: "", quantity: "1" }),
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
    color: "#0f172a",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  };

  const shellStyle: any = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "0 24px",
  };

  const cardStyle: any = {
    background: "#ffffff",
    border: "1px solid #dbe5ec",
    borderRadius: 18,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.035)",
    padding: 24,
  };

  const smallOverlineStyle: any = {
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: ".09em",
    fontSize: 11,
    fontWeight: 700,
  };

  const titleStyle: any = {
    margin: "8px 0 0",
    fontSize: 32,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    fontWeight: 600,
    color: "#0f172a",
  };

  const subtitleStyle: any = {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 500,
  };

  const sectionTitleStyle: any = {
    margin: "0 0 16px",
    fontSize: 18,
    letterSpacing: "-0.02em",
    fontWeight: 600,
    color: "#0f172a",
  };

  const sectionSubtextStyle: any = {
    margin: "-6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 450,
  };

  const labelStyle: any = {
    display: "grid",
    gap: 7,
    color: "#334155",
    fontSize: 12,
    fontWeight: 600,
  };

  const inputStyle: any = {
    width: "100%",
    minHeight: 40,
    border: "1px solid #d6e1ea",
    borderRadius: 10,
    padding: "0 13px",
    fontSize: 14,
    fontWeight: 450,
    color: "#0f172a",
    background: "#ffffff",
    boxSizing: "border-box",
    outline: "none",
  };

  const textareaStyle: any = {
    ...inputStyle,
    minHeight: 82,
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
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(15, 159, 122, 0.12)",
  };

  const secondaryButtonStyle: any = {
    border: "1px solid #d7e2ea",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 600,
    fontSize: 14,
    textDecoration: "none",
    cursor: "pointer",
  };

  const subtleButtonStyle: any = {
    border: "1px solid #cfe9df",
    background: "#edf9f3",
    color: "#047857",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  };

  const dangerButtonStyle: any = {
    border: "1px solid #f3caca",
    background: "#fffafa",
    color: "#b91c1c",
    borderRadius: 10,
    padding: "10px 13px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    minWidth: 96,
  };

  const darkTotalBarStyle: any = {
    marginTop: 18,
    borderRadius: 14,
    background: "#111827",
    color: "#ffffff",
    padding: "18px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  };

  return (
    <AppLayout>
      <div className="newOrderPage" style={pageStyle}>
        <div className="newOrderShell" style={shellStyle}>
          <header className="newOrderHero" style={{ ...cardStyle, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={smallOverlineStyle}>Auftrag</div>
                <h1 style={titleStyle}>Neuer Auftrag</h1>
                <p style={subtitleStyle}>
                  Manuell erfassen und anschließend im Auftragseingang prüfen.
                </p>
              </div>

              <a className="newOrderSecondaryButton" href="/auftragseingang" style={secondaryButtonStyle}>
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
              fontWeight: 600,
              marginBottom: 16,
            }}>
              {actionData.error}
            </div>
          ) : null}

          <Form method="post" className="newOrderForm" style={{ display: "grid", gap: 18 }}>
            <section className="newOrderSection" style={cardStyle}>
              <h2 style={sectionTitleStyle}>Kundendaten</h2>

              <div className="manualOrderGrid customerGrid">
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

            <section className="newOrderSection" style={cardStyle}>
              <h2 style={sectionTitleStyle}>Lieferung</h2>

              <div className="manualOrderGrid deliveryGrid">
                <label style={labelStyle}>
                  Lieferdatum *
                  <input name="deliveryDate" inputMode="numeric" style={inputStyle} placeholder="TT.MM.JJJJ" />
                </label>

                <label style={labelStyle}>
                  Lieferzeit
                  <input name="deliveryTime" style={inputStyle} placeholder="z. B. 12:00" />
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
                <textarea
                  name="deliveryAddressNote"
                  style={textareaStyle}
                  placeholder="z. B. Hinterhof, Etage, Ansprechpartner vor Ort, Klingelname..."
                />
              </label>
            </section>

            <section className="newOrderSection" style={cardStyle}>
              <h2 style={{ ...sectionTitleStyle, marginBottom: 6 }}>Positionen</h2>
              <p style={sectionSubtextStyle}>
                Positionen können frei ergänzt, als Freitext erfasst oder gelöscht werden.
              </p>

              <div className="newOrderItemsList" style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e8eef3",
                      background: "#fcfdff",
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div className="manualOrderItemRow newOrderItemRow">
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

                      <div className="newOrderDeleteCell" style={{ display: "flex", alignItems: "end" }}>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="newOrderDeleteButton" style={dangerButtonStyle}
                          disabled={items.length <= 1}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="newOrderItemActions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <button className="newOrderAddButton" type="button" onClick={addItem} style={subtleButtonStyle}>
                  + Position hinzufügen
                </button>

                <button className="newOrderSecondaryButton" type="button" onClick={addTextItem} style={secondaryButtonStyle}>
                  + Freitextposition
                </button>
              </div>

              <div className="newOrderTotalBar" style={darkTotalBarStyle}>
                <div>
                  <div style={{
                    fontSize: 12,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.72)",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}>
                    Gesamtsumme netto
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.78)",
                    fontWeight: 450,
                  }}>
                    Summe aller aktuell erfassten Positionen
                  </div>
                </div>

                <div style={{
                  fontSize: 34,
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  fontWeight: 600,
                }}>
                  {formatEuro(total)}
                </div>
              </div>
            </section>

            <section className="newOrderSection" style={cardStyle}>
              <h2 style={sectionTitleStyle}>Notizen</h2>

              <label style={labelStyle}>
                Interne Notizen
                <textarea
                  name="notes"
                  style={textareaStyle}
                  placeholder="Besonderheiten, Absprachen, Hinweise..."
                />
              </label>

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 18,
                alignItems: "center",
                flexWrap: "wrap",
              }}>
                <div style={{ color: "#64748b", fontSize: 13, fontWeight: 450 }}>
                  Der Auftrag wird zuerst im Auftragseingang geprüft.
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="newOrderSecondaryButton" href="/auftragseingang" style={secondaryButtonStyle}>
                    Abbrechen
                  </a>
                  <button className="newOrderPrimaryButton" type="submit" style={primaryButtonStyle}>
                    Auftrag anlegen
                  </button>
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
          font-weight: 450 !important;
        }

        input:focus,
        textarea:focus {
          border-color: #9fc9bc !important;
          box-shadow: 0 0 0 3px rgba(15, 159, 122, 0.08) !important;
        }

        button:disabled {
          opacity: .45;
          cursor: not-allowed !important;
        }

        .manualOrderGrid {
          display: grid;
          gap: 14px;
        }

        .customerGrid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .deliveryGrid {
          grid-template-columns: 160px 140px minmax(0, 1.5fr) 110px 160px;
        }

        .manualOrderItemRow {
          display: grid;
          grid-template-columns: minmax(220px, 1.3fr) 90px 130px minmax(240px, 1fr) auto;
          gap: 10px;
          align-items: end;
        }

        @media (max-width: 1100px) {
          .customerGrid,
          .deliveryGrid,
          .manualOrderItemRow {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
