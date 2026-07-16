ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "customerNumber" TEXT,
ADD COLUMN IF NOT EXISTS "customerType" "CustomerType" NOT NULL DEFAULT 'BUSINESS',
ADD COLUMN IF NOT EXISTS "invoiceEmail" TEXT,
ADD COLUMN IF NOT EXISTS "street" TEXT,
ADD COLUMN IF NOT EXISTS "houseNumber" TEXT,
ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
ADD COLUMN IF NOT EXISTS "city" TEXT,
ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'DE',
ADD COLUMN IF NOT EXISTS "differentDeliveryAddress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "deliveryStreet" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryHouseNumber" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryPostalCode" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryCity" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryCountry" TEXT,
ADD COLUMN IF NOT EXISTS "vatId" TEXT,
ADD COLUMN IF NOT EXISTS "costCenter" TEXT,
ADD COLUMN IF NOT EXISTS "paymentTermDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN IF NOT EXISTS "invoiceLanguage" "InvoiceLanguage" NOT NULL DEFAULT 'DE',
ADD COLUMN IF NOT EXISTS "notes" TEXT,
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

WITH numbered_customers AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId"
      ORDER BY "createdAt", "id"
    ) AS row_number
  FROM "Customer"
  WHERE
    "customerNumber" IS NULL
    OR BTRIM("customerNumber") = ''
)
UPDATE "Customer" AS customer
SET "customerNumber" =
  'KD-' ||
  LPAD(
    numbered_customers.row_number::TEXT,
    5,
    '0'
  )
FROM numbered_customers
WHERE customer."id" = numbered_customers."id";

ALTER TABLE "Customer"
ALTER COLUMN "customerNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
"Customer_tenantId_customerNumber_key"
ON "Customer"("tenantId", "customerNumber");

CREATE INDEX IF NOT EXISTS
"Customer_tenantId_active_idx"
ON "Customer"("tenantId", "active");