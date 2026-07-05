const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const shouldDelete = process.argv.includes("--delete");

  const where = {
    orderNumber: {
      startsWith: "MAIL-",
    },
    customerName: "E-Mail Import",
    totalCents: 0,
    items: {
      none: {},
    },
    invoices: {
      none: {},
    },
  };

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      source: true,
      totalCents: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log("Gefundene leere Mail-Auftraege:", orders.length);

  for (const order of orders) {
    console.log(
      [
        order.id,
        order.orderNumber,
        order.customerName,
        order.source,
        order.totalCents,
        order.createdAt.toISOString(),
      ].join(" | ")
    );
  }

  if (!shouldDelete) {
    console.log("");
    console.log("Noch nichts geloescht. Zum Loeschen mit --delete ausfuehren.");
    return;
  }

  const result = await prisma.order.deleteMany({ where });

  console.log("");
  console.log("Geloescht:", result.count);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
