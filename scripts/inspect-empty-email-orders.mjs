process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const rows = await prisma.order.findMany({
    where: {
      status: "AUTO_CREATED",
      source: "HEYCATER",
      items: {
        none: {},
      },
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      deliveryDate: true,
      deliveryTimeText: true,
      deliveryAddress: true,
      incomingEmail: {
        select: {
          id: true,
          subject: true,
          bodyText: true,
          attachments: {
            select: {
              filename: true,
              mimeType: true,
              textContent: true,
              extractedJson: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const result = rows.map((order) => {
    const attachments = order.incomingEmail?.attachments || [];

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      deliveryDate: order.deliveryDate,
      deliveryTimeText: order.deliveryTimeText,
      deliveryAddress: order.deliveryAddress,
      emailSubject: order.incomingEmail?.subject || null,
      bodyTextLength: String(order.incomingEmail?.bodyText || "").length,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        textLength: String(attachment.textContent || "").length,
        pdfTextLength: attachment.extractedJson?.pdfTextLength ?? null,
        pdfTextError: attachment.extractedJson?.pdfTextError ?? null,
      })),
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
