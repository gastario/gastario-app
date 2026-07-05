
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      source: "EMAIL",
      status: "AUTO_CREATED",
      customerName: "E-Mail Import",
    },
    include: {
      items: true,
    },
  });

  const emptyOrders = orders.filter((order) => order.items.length === 0);

  for (const order of emptyOrders) {
    await prisma.deliveryStop.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    console.log("Deleted empty mail order:", order.orderNumber);
  }

  console.log("Done. Deleted:", emptyOrders.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
