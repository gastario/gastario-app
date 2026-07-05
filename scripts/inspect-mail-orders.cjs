const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { startsWith: "MAIL-" } },
        { customerName: { contains: "E-Mail", mode: "insensitive" } },
        { source: "EMAIL" },
        { source: "MAILJET" },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      source: true,
      status: true,
      totalCents: true,
      createdAt: true,
      _count: {
        select: {
          items: true,
          invoices: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  console.log("Verdächtige Mail-/E-Mail-Auftraege:", orders.length);
  console.log("");

  for (const order of orders) {
    console.log([
      order.id,
      order.orderNumber,
      order.customerName,
      order.source,
      order.status,
      "total=" + order.totalCents,
      "items=" + order._count.items,
      "invoices=" + order._count.invoices,
      order.createdAt.toISOString(),
    ].join(" | "));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
