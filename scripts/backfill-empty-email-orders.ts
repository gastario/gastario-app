import { PrismaClient } from "@prisma/client";
import { extractHeycaterOrder } from "../app/lib/order-import-extract.server";

process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient();

function parseGermanDate(value: string | null | undefined) {
  const match = String(value || "").match(/^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/);

  if (!match) return null;

  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

try {
  const orders = await prisma.order.findMany({
    where: {
      status: "AUTO_CREATED",
      source: "HEYCATER",
      items: {
        none: {},
      },
    },
    include: {
      incomingEmail: {
        include: {
          attachments: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const preview = [];

  for (const order of orders) {
    const attachmentTexts = (order.incomingEmail?.attachments || [])
      .map((attachment) => String(attachment.textContent || "").trim())
      .filter(Boolean);

    const bestText = attachmentTexts.join("\n\n") || String(order.incomingEmail?.bodyText || "");
    const extractedOrder = extractHeycaterOrder(bestText);

    const items = Array.isArray(extractedOrder?.items)
      ? extractedOrder.items.filter((item: any) => {
          const name = String(item?.name || "").trim();
          const quantity = Number(item?.quantity || 0);
          const totalCents = Number(item?.totalCents || 0);

          return Boolean(name) && quantity > 0 && totalCents > 0;
        })
      : [];

    preview.push({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      emailSubject: order.incomingEmail?.subject || null,
      attachmentTextLength: bestText.length,
      extractedCustomerName: extractedOrder?.customerName || null,
      extractedDeliveryDate: extractedOrder?.deliveryDate || null,
      extractedDeliveryTime: extractedOrder?.deliveryTime || null,
      extractedDeliveryAddress: extractedOrder?.deliveryAddress || null,
      extractedItems: items.length,
      extractedTotalCents: items.reduce((sum: number, item: any) => sum + Number(item.totalCents || 0), 0),
      items: items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unitCents: item.unitCents,
        totalCents: item.totalCents,
      })),
    });

    if (process.env.CONFIRM_BACKFILL_EMPTY_EMAIL_ORDERS !== "YES") {
      continue;
    }

    if (items.length === 0) {
      continue;
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        customerName: extractedOrder.customerName || order.customerName,
        deliveryDate: parseGermanDate(extractedOrder.deliveryDate) || order.deliveryDate,
        deliveryTimeText: extractedOrder.deliveryTime || order.deliveryTimeText,
        deliveryAddress: extractedOrder.deliveryAddress || order.deliveryAddress,
        contactName: extractedOrder.contactName || order.contactName,
        contactPhone: extractedOrder.contactPhone || order.contactPhone,
        notes:
          "Aus vorhandener Heycater-PDF nachgetragen. Eventdatum: " +
          String(extractedOrder.eventDate || "-") +
          ", Eventbeginn: " +
          String(extractedOrder.eventStart || "-"),
        reviewReason: "Positionen aus nachtraeglich gelesener Heycater-PDF ergaenzt. Bitte pruefen.",
        items: {
          create: items.map((item: any) => ({
            name: String(item.name || "Position"),
            quantity: Number(item.quantity || 1),
            unit: "Stueck",
            unitCents: Number(item.unitCents || 0),
            totalCents: Number(item.totalCents || 0),
            notes: [item.description, item.rawLine].filter(Boolean).join(" | ") || null,
          })),
        },
      } as any,
    });

    if (order.incomingEmailId) {
      await prisma.incomingEmail.update({
        where: {
          id: order.incomingEmailId,
        },
        data: {
          status: "ORDER_CREATED" as any,
          extractedJson: extractedOrder as any,
          errorMessage: null,
          processedAt: new Date(),
        },
      });
    }
  }

  console.log(JSON.stringify({
    foundOrders: orders.length,
    mode: process.env.CONFIRM_BACKFILL_EMPTY_EMAIL_ORDERS === "YES" ? "WRITE" : "DRY_RUN",
    preview,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
