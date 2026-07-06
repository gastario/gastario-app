process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const emails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        { subject: { contains: "Fast Track", mode: "insensitive" } },
        { subject: { contains: "bestätigt", mode: "insensitive" } },
        { subject: { contains: "bestaetigt", mode: "insensitive" } },
        { subject: { contains: "Auftragsbest", mode: "insensitive" } },
        { subject: { contains: "Order Confirmation", mode: "insensitive" } }
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      attachments: {
        select: {
          filename: true,
          textContent: true,
        },
      },
      orders: {
        include: {
          items: true,
        },
      },
    },
  });

  console.log(JSON.stringify(emails.map((email) => ({
    createdAt: email.createdAt,
    receivedAt: email.receivedAt,
    subject: email.subject,
    sender: email.sender,
    status: email.status,
    errorMessage: email.errorMessage,
    attachmentCount: email.attachments.length,
    pdfTextLength: email.attachments.reduce((sum, a) => sum + String(a.textContent || "").length, 0),
    orderCount: email.orders.length,
    orders: email.orders.map((order) => ({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      itemCount: order.items.length,
      totalEuro: (order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0) / 100).toFixed(2),
    })),
  })), null, 2));
} finally {
  await prisma.$disconnect();
}
