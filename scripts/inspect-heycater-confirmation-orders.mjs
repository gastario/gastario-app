process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const emails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        { subject: { contains: "Fast Track Order", mode: "insensitive" } },
        { subject: { contains: "Partner Event Confirmation", mode: "insensitive" } },
        { subject: { contains: "Auftragsbest", mode: "insensitive" } }
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      orders: {
        include: {
          items: true,
        },
      },
      attachments: {
        select: {
          filename: true,
          textContent: true,
          extractedJson: true,
        },
      },
    },
  });

  const result = emails.map((email) => ({
    emailId: email.id,
    subject: email.subject,
    status: email.status,
    errorMessage: email.errorMessage,
    attachmentInfo: email.attachments.map((attachment) => ({
      filename: attachment.filename,
      textLength: String(attachment.textContent || "").length,
      pdfTextLength: attachment.extractedJson?.pdfTextLength ?? null,
      pdfTextError: attachment.extractedJson?.pdfTextError ?? null,
    })),
    orders: email.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      source: order.source,
      status: order.status,
      deliveryDate: order.deliveryDate,
      deliveryTimeText: order.deliveryTimeText,
      deliveryAddress: order.deliveryAddress,
      itemCount: order.items.length,
      totalCents: order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0),
      items: order.items.slice(0, 8).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitCents: item.unitCents,
        totalCents: item.totalCents,
      })),
    })),
  }));

  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
