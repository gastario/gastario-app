import AppLayout from "../components/AppLayout";
import { Form, redirect, useActionData } from "react-router";

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
  const deliveryAddress = String(formData.get("deliveryAddress") || "").trim();

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
    .filter((item) => item.name);

  if (!customerName) {
    return { error: "Bitte Kundennamen eintragen." };
  }

  if (!deliveryDateRaw) {
    return { error: "Bitte Lieferdatum eintragen." };
  }

  if (items.length === 0) {
    return { error: "Bitte mindestens eine Position eintragen." };
  }

  const deliveryDate = parseGermanDateInput(deliveryDateRaw);

  if (!deliveryDate || Number.isNaN(deliveryDate.getTime())) {
    return { error: "Bitte Lieferdatum im Format TT.MM.JJJJ eintragen." };
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

  const order = await prisma.order.create({
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
          name: item.name,
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

  const pageStyle: any = {
    padding: "0 0 44px",
    color: "#0f172a",
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
    color: "#475569",
    fontSize: 12,
    fontWeight: 650,
  };

  const inputStyle: any = {
    width: "100%",
    minHeight: 40,
    border: "1px solid #d6e1ea",
    borderRadius: 10,
    padding: "0 13px",
    fontWeight: 500,
    color: "#0f172a",
    background: "#ffffff",
    boxSizing: "border-box",
  };

  const textareaStyle: any = {
    ...inputStyle,
    minHeight: 96,
    padding: 13,
    resize: "vertical",
  };

  const primaryButtonStyle: any = {
    border: "1px solid #0f9f7a",
    background: "#0f9f7a",
    color: "#ffffff",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(15, 159, 122, 0.13)",
  };

  const secondaryButtonStyle: any = {
    border: "1px solid #d6e1ea",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 650,
    textDecoration: "none",
  };

  const sectionTitleStyle: any = {
    margin: "0 0 14px",
    fontSize: 20,
    letterSpacing: "-0.035em",
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
                  fontWeight: 950,
                }}>
                  Auftrag
                </div>

                <h1 style={{ margin: "6px 0 0", fontSize: 34, lineHeight: 1, letterSpacing: "-0.055em" }}>
                  Neuer Auftrag
                </h1>

                <p style={{ margin: "10px 0 0", color: "#64748b", fontWeight: 750 }}>
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
              borderRadius: 18,
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

              <div style={{ display: "grid", gridTemplateColumns: "180px 160px minmax(0, 1fr)", gap: 14 }}>
                <label style={labelStyle}>
                  Lieferdatum *
                  <input name="deliveryDate" inputMode="numeric" style={inputStyle} placeholder="TT.MM.JJJJ" />
                </label>

                <label style={labelStyle}>
                  Lieferzeit
                  <input name="deliveryTime" style={inputStyle} placeholder="z. B. 12:00" />
                </label>

                <label style={labelStyle}>
                  Lieferadresse
                  <input name="deliveryAddress" style={inputStyle} placeholder="Straße, PLZ Ort" />
                </label>
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={sectionTitleStyle}>Positionen</h2>

              <div style={{ display: "grid", gap: 10 }}>
                <div id="manual-order-items" style={{ display: "grid", gap: 10 }}>
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="manual-order-item-row"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) 100px 140px minmax(0, 1fr)",
                        gap: 10,
                        alignItems: "end",
                      }}
                    >
                      <label style={labelStyle}>
                        Position {index + 1}
                        <input name="itemName" style={inputStyle} placeholder={index === 0 ? "z. B. Chicken Bowl" : "Optional"} />
                      </label>

                      <label style={labelStyle}>
                        Menge
                        <input name="quantity" type="number" min="0" step="1" defaultValue={index === 0 ? 1 : ""} style={inputStyle} />
                      </label>

                      <label style={labelStyle}>
                        Einzelpreis netto
                        <input name="unitPriceEuro" style={inputStyle} placeholder="0,00" />
                      </label>

                      <label style={labelStyle}>
                        Hinweis
                        <input name="itemNotes" style={inputStyle} placeholder="Allergene / Besonderheit" />
                      </label>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  id="add-manual-order-item"
                  style={{
                    marginTop: 12,
                    border: "1px solid #bbf7d0",
                    background: "#ecfdf5",
                    color: "#047857",
                    borderRadius: 10,
                    padding: "11px 14px",
                    fontWeight: 950,
                    cursor: "pointer",
                    width: "fit-content",
                  }}
                >
                  + Position hinzufügen
                </button>

                <script
                  dangerouslySetInnerHTML={{
                    __html: `
                      (function () {
                        var container = document.getElementById("manual-order-items");
                        var button = document.getElementById("add-manual-order-item");

                        if (!container || !button) return;

                        button.addEventListener("click", function () {
                          var count = container.querySelectorAll(".manual-order-item-row").length + 1;
                          var row = document.createElement("div");

                          row.className = "manual-order-item-row";
                          row.style.display = "grid";
                          row.style.gridTemplateColumns = "minmax(0, 1fr) 100px 140px minmax(0, 1fr)";
                          row.style.gap = "10px";
                          row.style.alignItems = "end";

                          row.innerHTML =
                            '<label style="display:grid;gap:6px;color:#475569;font-size:12px;font-weight:900;">Position ' + count + '<input name="itemName" placeholder="Weitere Position" style="width:100%;min-height:44px;border:1px solid #d6e1ea;border-radius:14px;padding:0 13px;font-weight:800;color:#0f172a;background:#fff;box-sizing:border-box;" /></label>' +
                            '<label style="display:grid;gap:6px;color:#475569;font-size:12px;font-weight:900;">Menge<input name="quantity" type="number" min="0" step="1" style="width:100%;min-height:44px;border:1px solid #d6e1ea;border-radius:14px;padding:0 13px;font-weight:800;color:#0f172a;background:#fff;box-sizing:border-box;" /></label>' +
                            '<label style="display:grid;gap:6px;color:#475569;font-size:12px;font-weight:900;">Einzelpreis netto<input name="unitPriceEuro" placeholder="0,00" style="width:100%;min-height:44px;border:1px solid #d6e1ea;border-radius:14px;padding:0 13px;font-weight:800;color:#0f172a;background:#fff;box-sizing:border-box;" /></label>' +
                            '<label style="display:grid;gap:6px;color:#475569;font-size:12px;font-weight:900;">Hinweis<input name="itemNotes" placeholder="Allergene / Besonderheit" style="width:100%;min-height:44px;border:1px solid #d6e1ea;border-radius:14px;padding:0 13px;font-weight:800;color:#0f172a;background:#fff;box-sizing:border-box;" /></label>';

                          container.appendChild(row);
                        });
                      })();
                    `,
                  }}
                />
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={sectionTitleStyle}>Notizen</h2>

              <label style={labelStyle}>
                Interne Notizen
                <textarea name="notes" style={textareaStyle} placeholder="Besonderheiten, Absprachen, Hinweise..." />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <a href="/auftragseingang" style={secondaryButtonStyle}>Abbrechen</a>
                <button type="submit" style={primaryButtonStyle}>Auftrag anlegen</button>
              </div>
            </section>
          </Form>
        </div>
      </div>
      <style>{`
        /* manual-order-lexoffice-polish */
        input,
        textarea,
        select {
          font-size: 14px !important;
          font-weight: 500 !important;
        }

        input::placeholder,
        textarea::placeholder {
          color: #8a94a6 !important;
          font-weight: 500 !important;
        }

        label {
          font-size: 12px !important;
          font-weight: 650 !important;
        }

        h1 {
          font-weight: 700 !important;
        }

        h2 {
          font-weight: 650 !important;
        }

        button,
        a {
          font-weight: 650 !important;
        }
      `}</style>
    </AppLayout>
  );
}

