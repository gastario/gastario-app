process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

function totalOf(order) {
  return order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
}

function isDeliveryNoteSubject(subject) {
  const value = String(subject || "").toLowerCase();
  return (
    value.includes("dein morgiges catering") ||
    value.includes("dein morgiges heykantine") ||
    value.includes("morgiges catering mit heycater") ||
    value.includes("morgiges heykantine") ||
    value.includes("delivery note") ||
    value.includes("lieferschein")
  );
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
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const deliveryOnlyZeroOrders = [];

  for (const email of emails) {
    if (!isDeliveryNoteSubject(email.subject)) continue;

    for (const order of email.orders) {
      const totalCents = totalOf(order);

      if (totalCents <= 0 && order.status === "AUTO_CREATED") {
        deliveryOnlyZeroOrders.push({
          emailId: email.id,
          subject: email.subject,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          deliveryDate: order.deliveryDate,
          deliveryTimeText: order.deliveryTimeText,
          itemCount: order.items.length,
          totalCents,
        });
      }
    }
  }

  console.log(JSON.stringify({
    mode: process.env.CONFIRM_REMOVE_HEYCATER_DELIVERY_ONLY_ORDERS === "YES" ? "WRITE" : "DRY_RUN",
    count: deliveryOnlyZeroOrders.length,
    orders: deliveryOnlyZeroOrders,
  }, null, 2));

  if (process.env.CONFIRM_REMOVE_HEYCATER_DELIVERY_ONLY_ORDERS !== "YES") {
    process.exit(0);
  }

  for (const item of deliveryOnlyZeroOrders) {
    await prisma.$transaction([
      prisma.deliveryStop.deleteMany({
        where: {
          orderId: item.orderId,
        },
      }),
      prisma.orderItem.deleteMany({
        where: {
          orderId: item.orderId,
        },
      }),
      prisma.order.delete({
        where: {
          id: item.orderId,
        },
      }),
      prisma.incomingEmail.update({
        where: {
          id: item.emailId,
        },
        data: {
          status: "REVIEW_NEEDED",
          errorMessage: "Heycater-Lieferschein ohne Preise. Kein eigener Auftrag. Bitte passende Auftragsbestaetigung mit Preisen importieren.",
        },
      }),
    ]);
  }

  console.log("Fertig.");
} finally {
  await prisma.$disconnect();
}
