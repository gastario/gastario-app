process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const orderNumber = "2026-258999"; // HIER echte Heycater-Nummer eintragen

  const emails = await prisma.incomingEmail.findMany({
    where: {
      subject: {
        contains: orderNumber,
        mode: "insensitive",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    include: {
      orders: {
        include: {
          items: true,
        },
      },
      attachments: true,
    },
  });

  console.log(JSON.stringify(
    emails.map((email) => ({
      createdAt: email.createdAt,
      receivedAt: email.receivedAt,
      subject: email.subject,
      sender: email.sender,
      status: email.status,
      errorMessage: email.errorMessage,
      orderCount: email.orders.length,
      attachmentCount: email.attachments.length,
      orders: email.orders.map((order) => ({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status: order.status,
        itemCount: order.items.length,
        totalEuro: (
          order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0) / 100
        ).toFixed(2),
      })),
    })),
    null,
    2
  ));
} finally {
  await prisma.$disconnect();
}
