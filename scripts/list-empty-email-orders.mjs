process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT 
      o.id,
      o."orderNumber",
      o."customerName",
      o.source,
      o.status,
      o."deliveryDate",
      o."deliveryTimeText",
      o."deliveryAddress",
      COUNT(i.id)::int AS "itemCount",
      COALESCE(SUM(i."totalCents"), 0)::int AS "totalCents"
    FROM "Order" o
    LEFT JOIN "OrderItem" i ON i."orderId" = o.id
    WHERE o.status = 'AUTO_CREATED'
      AND o.source IN ('EMAIL', 'HEYCATER')
    GROUP BY o.id
    HAVING COALESCE(SUM(i."totalCents"), 0) = 0 OR COUNT(i.id) = 0
    ORDER BY o."createdAt" DESC;
  `);

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await prisma.$disconnect();
}
