process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const emails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        { subject: { contains: "Fast Track Order bestätigt", mode: "insensitive" } },
        { subject: { contains: "Partner Event Confirmation", mode: "insensitive" } },
        { subject: { contains: "Auftragsbest", mode: "insensitive" } },
        { subject: { contains: "Angebotsbest", mode: "insensitive" } }
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      attachments: true,
      orders: {
        include: {
          items: true,
        },
      },
    },
  });

  for (const email of emails) {
    console.log("\n\n==============================");
    console.log(email.subject);
    console.log("EMAIL STATUS:", email.status);
    console.log("ORDERS:", email.orders.length);
    for (const order of email.orders) {
      const total = order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
      console.log("ORDER:", order.orderNumber, order.customerName, "ITEMS:", order.items.length, "TOTAL:", total);
    }
    console.log("==============================\n");

    for (const attachment of email.attachments) {
      console.log("DATEI:", attachment.filename);
      console.log(String(attachment.textContent || "").slice(0, 7000));
      console.log("\n--- ENDE AUSZUG ---\n");
    }
  }
} finally {
  await prisma.$disconnect();
}
