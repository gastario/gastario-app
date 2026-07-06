process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const { extractHeycaterOrder } = await import("../app/lib/order-import-extract.server.ts");

const prisma = new PrismaClient();

function getHeycaterNumber(value) {
  const match = String(value || "").match(/\b(20[0-9]{2}-[0-9]{5,})\b/);
  return match?.[1] || "";
}

function totalOf(order) {
  return order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
}

function parseGermanDate(value) {
  const match = String(value || "").match(/^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

try {
  const emails = await prisma.incomingEmail.findMany({
    where: {
      subject: {
        contains: "2026-",
      },
    },
    include: {
      orders: {
        include: {
          items: true,
        },
      },
      attachments: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const byHeycaterNumber = new Map();

  for (const email of emails) {
    const number = getHeycaterNumber(email.subject);
    if (!number) continue;

    const existing = byHeycaterNumber.get(number) || [];
    existing.push(email);
    byHeycaterNumber.set(number, existing);
  }

  const duplicateZeroOrdersToRemove = [];
  const confirmationOrdersToBackfill = [];
  const preview = [];

  for (const [number, group] of byHeycaterNumber.entries()) {
    const confirmationEmails = group.filter((email) => {
      const subject = String(email.subject || "").toLowerCase();
      return (
        subject.includes("fast track order") ||
        subject.includes("partner event confirmation") ||
        subject.includes("auftragsbest") ||
        subject.includes("angebotsbest")
      );
    });

    const deliveryEmails = group.filter((email) => {
      const subject = String(email.subject || "").toLowerCase();
      return (
        subject.includes("dein morgiges") ||
        subject.includes("delivery note") ||
        subject.includes("lieferschein")
      );
    });

    const pricedConfirmationOrders = confirmationEmails.flatMap((email) =>
      email.orders
        .filter((order) => totalOf(order) > 0)
        .map((order) => ({ email, order }))
    );

    const zeroConfirmationOrders = confirmationEmails.flatMap((email) =>
      email.orders
        .filter((order) => totalOf(order) <= 0)
        .map((order) => ({ email, order }))
    );

    const zeroDeliveryOrders = deliveryEmails.flatMap((email) =>
      email.orders
        .filter((order) => totalOf(order) <= 0)
        .map((order) => ({ email, order }))
    );

    if (pricedConfirmationOrders.length > 0 && zeroDeliveryOrders.length > 0) {
      for (const item of zeroDeliveryOrders) {
        duplicateZeroOrdersToRemove.push(item);
      }
    }

    for (const item of zeroConfirmationOrders) {
      confirmationOrdersToBackfill.push(item);
    }

    preview.push({
      heycaterNumber: number,
      confirmationEmails: confirmationEmails.length,
      deliveryEmails: deliveryEmails.length,
      pricedConfirmationOrders: pricedConfirmationOrders.map(({ order }) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        itemCount: order.items.length,
        totalCents: totalOf(order),
      })),
      zeroConfirmationOrders: zeroConfirmationOrders.map(({ order }) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        itemCount: order.items.length,
        totalCents: totalOf(order),
      })),
      zeroDeliveryOrdersToRemove: zeroDeliveryOrders.map(({ order }) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        itemCount: order.items.length,
        totalCents: totalOf(order),
      })),
    });
  }

  console.log(JSON.stringify({
    mode: process.env.CONFIRM_FIX_HEYCATER_DUPLICATES === "YES" ? "WRITE" : "DRY_RUN",
    duplicateZeroOrdersToRemove: duplicateZeroOrdersToRemove.length,
    confirmationOrdersToBackfill: confirmationOrdersToBackfill.length,
    preview,
  }, null, 2));

  if (process.env.CONFIRM_FIX_HEYCATER_DUPLICATES !== "YES") {
    process.exit(0);
  }

  for (const { email, order } of confirmationOrdersToBackfill) {
    const text = email.attachments
      .map((attachment) => String(attachment.textContent || "").trim())
      .filter(Boolean)
      .join("\n\n");

    const extracted = extractHeycaterOrder(text || String(email.bodyText || ""));
    const items = Array.isArray(extracted.items)
      ? extracted.items.filter((item) => String(item.name || "").trim() && Number(item.quantity || 0) > 0)
      : [];

    if (items.length === 0) continue;

    await prisma.$transaction([
      prisma.orderItem.deleteMany({
        where: {
          orderId: order.id,
        },
      }),
      prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          customerName: extracted.customerName || order.customerName,
          deliveryDate: parseGermanDate(extracted.deliveryDate) || order.deliveryDate,
          deliveryTimeText: extracted.deliveryTime || order.deliveryTimeText,
          deliveryAddress: extracted.deliveryAddress || order.deliveryAddress,
          contactName: extracted.contactName || order.contactName,
          contactPhone: extracted.contactPhone || order.contactPhone,
          notes:
            "Aus Heycater-Auftragsbestaetigung nachgetragen. Heycater-Auftrag: " +
            getHeycaterNumber(email.subject) +
            ". Eventdatum: " +
            String(extracted.eventDate || "-") +
            ", Eventbeginn: " +
            String(extracted.eventStart || "-"),
          reviewReason: "Auftrag aus Heycater-Auftragsbestaetigung mit Preisen ergaenzt. Bitte pruefen.",
          items: {
            create: items.map((item) => ({
              name: String(item.name || "Position"),
              quantity: Number(item.quantity || 1),
              unit: "Stueck",
              unitCents: Number(item.unitCents || 0),
              totalCents: Number(item.totalCents || 0),
              notes: [item.description, item.rawLine].filter(Boolean).join(" | ") || null,
            })),
          },
        },
      }),
      prisma.incomingEmail.update({
        where: {
          id: email.id,
        },
        data: {
          status: "ORDER_CREATED",
          errorMessage: null,
          extractedJson: extracted,
          processedAt: new Date(),
        },
      }),
    ]);
  }

  for (const { email, order } of duplicateZeroOrdersToRemove) {
    await prisma.$transaction([
      prisma.deliveryStop.deleteMany({
        where: {
          orderId: order.id,
        },
      }),
      prisma.orderItem.deleteMany({
        where: {
          orderId: order.id,
        },
      }),
      prisma.order.delete({
        where: {
          id: order.id,
        },
      }),
      prisma.incomingEmail.update({
        where: {
          id: email.id,
        },
        data: {
          status: "REVIEW_NEEDED",
          errorMessage: "Heycater-Lieferschein wurde nicht als eigener Auftrag gefuehrt, weil die Auftragsbestaetigung mit Preisen bereits vorhanden ist.",
        },
      }),
    ]);
  }

  console.log("Fertig.");
} finally {
  await prisma.$disconnect();
}
