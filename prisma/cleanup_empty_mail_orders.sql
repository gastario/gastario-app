DELETE FROM "Order"
WHERE "orderNumber" LIKE 'MAIL-%'
  AND "customerName" = 'E-Mail Import'
  AND "totalCents" = 0
  AND NOT EXISTS (
    SELECT 1 FROM "OrderItem"
    WHERE "OrderItem"."orderId" = "Order"."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Invoice"
    WHERE "Invoice"."orderId" = "Order"."id"
  );
