import { useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import {
  GastarioField,
  GastarioFormGrid,
  GastarioHeader,
  GastarioInput,
  GastarioNotice,
  GastarioPage,
  GastarioSection,
  GastarioTextarea,
  gastarioButtonClass,
  GastarioButton,
  GastarioMetric,
  GastarioMetricGrid,
  GastarioPanel,
  GastarioToolbar,
  GastarioStack,
} from "../components/ui";
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

















  return (
    <AppLayout>
      <GastarioPage>

        <GastarioHeader
          eyebrow="Auftrag"
          title="Neuer Auftrag"
          subtitle="Manuell erfassen und anschließend im Auftragseingang prüfen."
          actions={
            <a
              href="/auftragseingang"
              className={gastarioButtonClass("secondary")}
            >
              Zurück zum Eingang
            </a>
          }
        />

        {actionData?.error ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}

        <Form method="post">
          <GastarioStack>

          <GastarioSection
            eyebrow="Kunde"
            title="Kundendaten"
            description="Kontakt- und Ansprechpartnerdaten für diesen Auftrag."
          >
            <GastarioFormGrid columns={3}>

              <GastarioField
                label="Kunde"
                required
              >
                <GastarioInput
                  name="customerName"
                  placeholder="z. B. Muster GmbH"
                  required
                />
              </GastarioField>

              <GastarioField label="E-Mail">
                <GastarioInput
                  name="customerEmail"
                  type="email"
                  placeholder="kunde@example.de"
                />
              </GastarioField>

              <GastarioField label="Telefon">
                <GastarioInput
                  name="customerPhone"
                  placeholder="030..."
                />
              </GastarioField>

              <GastarioField label="Kontaktperson">
                <GastarioInput
                  name="contactName"
                  placeholder="Name"
                />
              </GastarioField>

              <GastarioField label="Kontakt Telefon">
                <GastarioInput
                  name="contactPhone"
                  placeholder="Mobil / Büro"
                />
              </GastarioField>

            </GastarioFormGrid>
          </GastarioSection>


          <GastarioSection
            eyebrow="Logistik"
            title="Lieferung"
            description="Lieferdatum, Zeitfenster und Zieladresse des Auftrags."
          >
            <GastarioFormGrid columns={3}>

              <GastarioField
                label="Lieferdatum"
                required
              >
                <GastarioInput
                  name="deliveryDate"
                  inputMode="numeric"
                  placeholder="TT.MM.JJJJ"
                  required
                />
              </GastarioField>

              <GastarioField label="Lieferzeit">
                <GastarioInput
                  name="deliveryTime"
                  placeholder="z. B. 12:00"
                />
              </GastarioField>

              <GastarioField label="Straße / Hausnummer">
                <GastarioInput
                  name="deliveryStreet"
                  placeholder="Straße 12"
                />
              </GastarioField>

              <GastarioField label="PLZ">
                <GastarioInput
                  name="deliveryZip"
                  inputMode="numeric"
                  placeholder="10115"
                />
              </GastarioField>

              <GastarioField label="Ort">
                <GastarioInput
                  name="deliveryCity"
                  placeholder="Berlin"
                />
              </GastarioField>

            </GastarioFormGrid>

            <GastarioField label="Zusatz zur Lieferadresse">
              <GastarioTextarea
                name="deliveryAddressNote"
                placeholder="z. B. Hinterhof, Etage, Ansprechpartner vor Ort, Klingelname..."
              />
            </GastarioField>
          </GastarioSection>

          <GastarioSection
            eyebrow="Leistung"
            title="Positionen"
            description="Positionen frei ergänzen, als Freitext erfassen oder wieder entfernen."
          >

            {items.map((item, index) => (
              <GastarioPanel
                key={item.id}
                variant="soft"
              >
                <GastarioFormGrid columns={4}>

                  <GastarioField
                    label={`Position ${index + 1}`}
                  >
                    <GastarioInput
                      name="itemName"
                      value={item.name}
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "name",
                          event.target.value
                        )
                      }
                      placeholder={
                        index === 0
                          ? "z. B. Chicken Bowl"
                          : "Weitere Position"
                      }
                    />
                  </GastarioField>

                  <GastarioField label="Menge">
                    <GastarioInput
                      name="quantity"
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "quantity",
                          event.target.value
                        )
                      }
                    />
                  </GastarioField>

                  <GastarioField label="Einzelpreis netto">
                    <GastarioInput
                      name="unitPriceEuro"
                      value={item.unitPriceEuro}
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "unitPriceEuro",
                          event.target.value
                        )
                      }
                      placeholder="0,00"
                    />
                  </GastarioField>

                  <GastarioField label="Freitext / Hinweis">
                    <GastarioInput
                      name="itemNotes"
                      value={item.itemNotes}
                      onChange={(event) =>
                        updateItem(
                          item.id,
                          "itemNotes",
                          event.target.value
                        )
                      }
                      placeholder="Allergene, Besonderheit, Beschreibung..."
                    />
                  </GastarioField>

                </GastarioFormGrid>

                <GastarioToolbar>
                  <GastarioButton
                    type="button"
                    variant="danger"
                    onClick={() =>
                      removeItem(item.id)
                    }
                    disabled={items.length <= 1}
                  >
                    Löschen
                  </GastarioButton>
                </GastarioToolbar>

              </GastarioPanel>
            ))}


            <GastarioToolbar>

              <GastarioButton
                type="button"
                variant="primary"
                onClick={addItem}
              >
                + Position hinzufügen
              </GastarioButton>

              <GastarioButton
                type="button"
                variant="secondary"
                onClick={addTextItem}
              >
                + Freitextposition
              </GastarioButton>

            </GastarioToolbar>


            <GastarioMetricGrid>
              <GastarioMetric
                label="Gesamtsumme netto"
                value={formatEuro(total)}
                description="Summe aller aktuell erfassten Positionen"
                badge="EUR"
              />
            </GastarioMetricGrid>

          </GastarioSection>


          <GastarioSection
            eyebrow="Intern"
            title="Notizen"
            description="Interne Hinweise und Abschluss des manuellen Auftrags."
          >

            <GastarioField label="Interne Notizen">
              <GastarioTextarea
                name="notes"
                placeholder="Besonderheiten, Absprachen, Hinweise..."
              />
            </GastarioField>

            <GastarioPanel variant="soft">
              Der Auftrag wird zuerst im Auftragseingang geprüft.
            </GastarioPanel>

            <GastarioToolbar>

              <a
                href="/auftragseingang"
                className={gastarioButtonClass(
                  "secondary"
                )}
              >
                Abbrechen
              </a>

              <GastarioButton
                variant="primary"
                type="submit"
              >
                Auftrag anlegen
              </GastarioButton>

            </GastarioToolbar>

          </GastarioSection>
          </GastarioStack>
          </Form>
      </GastarioPage>
    </AppLayout>
  );
}
