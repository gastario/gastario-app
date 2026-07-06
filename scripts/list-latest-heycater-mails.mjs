process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const emails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        { sender: { contains: "heycater", mode: "insensitive" } },
        { sender: { contains: "heykantine", mode: "insensitive" } },
        { subject: { contains: "heycater", mode: "insensitive" } },
        { subject: { contains: "heykantine", mode: "insensitive" } },
        { subject: { contains: "2026-", mode: "insensitive" } }
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
    include: {
      orders: {
        include: {
          items: true,
        },
      },
      attachments: true,
    },
  });

  console.log(JSON.stringify(emails.map((email) => ({
    createdAt: email.createdAt,
    receivedAt: email.receivedAt,
    subject: email.subject,
    sender: email.sender,
    status: email.status,
    errorMessage: email.errorMessage,
    orderCount: email.orders.length,
    attachmentCount: email.attachments.length,
    totalEuro: email.orders.length
      ? (
          email.orders[0].items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0) / 100
        ).toFixed(2)
      : null,
    customerName: email.orders[0]?.customerName || null,
  })), null, 2));
} finally {
  await prisma.$disconnect();
}
