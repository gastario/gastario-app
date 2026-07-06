process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const orders = await prisma.order.findMany({
    where: {
      status: "AUTO_CREATED",
      source: { in: ["EMAIL", "HEYCATER"] },
      items: {
        none: {},
      },
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      incomingEmailId: true,
      deliveryDate: true,
      deliveryTimeText: true,
      deliveryAddress: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  const zeroOrders = [];

  for (const order of orders) {
    const sum = await prisma.orderItem.aggregate({
      where: { orderId: order.id },
      _sum: { totalCents: true },
    });

    if ((sum._sum.totalCents || 0) === 0) {
      zeroOrders.push(order);
    }
  }

  console.log("Gefundene leere E-Mail-Auftraege:", zeroOrders.length);
  console.log(JSON.stringify(zeroOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    deliveryDate: order.deliveryDate,
    deliveryTimeText: order.deliveryTimeText,
    deliveryAddress: order.deliveryAddress,
  })), null, 2));

  if (process.env.CONFIRM_DELETE_EMPTY_EMAIL_ORDERS !== "YES") {
    console.log("DRY RUN: Nichts geloescht. Zum Loeschen CONFIRM_DELETE_EMPTY_EMAIL_ORDERS=YES setzen.");
    process.exit(0);
  }

  const orderIds = zeroOrders.map((order) => order.id);
  const incomingEmailIds = zeroOrders
    .map((order) => order.incomingEmailId)
    .filter(Boolean);

  await prisma.$transaction([
    prisma.deliveryStop.deleteMany({
      where: {
        orderId: { in: orderIds },
      },
    }),
    prisma.orderItem.deleteMany({
      where: {
        orderId: { in: orderIds },
      },
    }),
    prisma.order.deleteMany({
      where: {
        id: { in: orderIds },
      },
    }),
    prisma.incomingEmail.updateMany({
      where: {
        id: { in: incomingEmailIds },
      },
      data: {
        status: "REVIEW_NEEDED",
        errorMessage: "Leerer automatisch erzeugter Auftrag wurde entfernt. E-Mail bleibt zur Pruefung sichtbar.",
      },
    }),
  ]);

  console.log("Geloescht:", orderIds.length);
  console.log("E-Mails zurueck auf REVIEW_NEEDED gesetzt:", incomingEmailIds.length);
} finally {
  await prisma.$disconnect();
}
