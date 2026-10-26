import AppLayout from "../components/AppLayout";
import NewOrderDialog from "../components/orders/NewOrderDialog";
import {
  GastarioHeader,
  GastarioPage,
} from "../components/ui";
import { Form, redirect, useActionData, useNavigate } from "react-router";



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
  const actionData =
    useActionData<typeof action>();

  const navigate =
    useNavigate();

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Verkauf"
          title="Aufträge"
          description="Manuellen Auftrag schnell und geführt erfassen."
        />

        <NewOrderDialog
          open
          onClose={() =>
            navigate("/auftraege")
          }
          serverError={
            actionData?.error
          }
          formAction="/neuer-auftrag"
        />
      </GastarioPage>
    </AppLayout>
  );
}