process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const emails = await prisma.incomingEmail.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      attachments: {
        select: {
          filename: true,
          mimeType: true,
          textContent: true,
          extractedJson: true,
        },
      },
      orders: {
        include: {
          items: true,
        },
      },
    },
  });

  const result = emails.map((email) => ({
    id: email.id,
    createdAt: email.createdAt,
    receivedAt: email.receivedAt,
    subject: email.subject,
    sender: email.sender,
    status: email.status,
    errorMessage: email.errorMessage,
    orderCount: email.orders.length,
    attachmentCount: email.attachments.length,
    attachments: email.attachments.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      textLength: String(attachment.textContent || "").length,
      firstText: String(attachment.textContent || "").slice(0, 700),
    })),
    orders: email.orders.map((order) => ({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      status: order.status,
      itemCount: order.items.length,
      totalCents: order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0),
    })),
    extractedJson: email.extractedJson,
  }));

  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
