import { prisma } from "./prisma.server";
import { renderDeliveryNotePdf } from "./delivery-note-pdf.server";

export async function ensureDeliveryNoteForOrder(
  orderId: string,
  options?: {
    force?: boolean;
  }
) {
  const existing = await prisma.deliveryNote.findUnique({
    where: {
      orderId,
    },
  });

  if (existing && !options?.force) {
    return existing;
  }

  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      items: true,
      tenant: true,
    },
  });

  if (!order) {
    throw new Error("Auftrag nicht gefunden.");
  }

  const allowedStatuses = [
    "CONFIRMED",
    "IN_PRODUCTION",
    "PACKING_OPEN",
    "DELIVERED",
  ];

  if (!allowedStatuses.includes(String(order.status))) {
    throw new Error(
      "Für diesen Auftragsstatus kann noch kein Lieferschein erstellt werden."
    );
  }

  const number = "LS-" + order.orderNumber;
  const filename =
    number.replace(/[^a-zA-Z0-9._-]+/g, "-") + ".pdf";

  const pdfData = await renderDeliveryNotePdf({
    number,
    orderNumber: order.orderNumber,
    tenantName: order.tenant.name,
    customerName: order.customerName,
    deliveryAddress: order.deliveryAddress,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    deliveryDate: order.deliveryDate,
    deliveryTimeText: order.deliveryTimeText,
    notes: order.notes,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
    })),
  });

  return prisma.deliveryNote.upsert({
    where: {
      orderId: order.id,
    },
    update: {
      number,
      filename,
      mimeType: "application/pdf",
      pdfData,
      generatedAt: new Date(),
    },
    create: {
      tenantId: order.tenantId,
      orderId: order.id,
      number,
      filename,
      mimeType: "application/pdf",
      pdfData,
    },
  });
}
