process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const orders = await prisma.order.findMany({
    where: {
      id: {
        in: [
          "cmr8u40fe003xmh0eaibu4xan",
          "cmr8u40d2003rmh0eiwxss55t"
        ],
      },
    },
    include: {
      incomingEmail: {
        include: {
          attachments: true,
        },
      },
    },
  });

  for (const order of orders) {
    console.log("\n\n==============================");
    console.log(order.orderNumber + " | " + order.customerName);
    console.log(order.incomingEmail?.subject || "");
    console.log("==============================\n");

    for (const attachment of order.incomingEmail?.attachments || []) {
      console.log("DATEI:", attachment.filename);
      console.log(String(attachment.textContent || "").slice(0, 5000));
    }
  }
} finally {
  await prisma.$disconnect();
}
