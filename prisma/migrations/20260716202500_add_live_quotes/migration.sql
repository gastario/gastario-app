DO $$
BEGIN
  CREATE TYPE "QuoteStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'WAITING',
    'CONFIRMED',
    'REJECTED',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "Quote" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT,

  "quoteNumber" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',

  "customerName" TEXT NOT NULL,
  "eventName" TEXT,

  "eventDate" TIMESTAMP(3),
  "deliveryTimeText" TEXT,
  "deliveryAddress" TEXT,

  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,

  "validUntil" TIMESTAMP(3),
  "notes" TEXT,

  "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  "discountCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,

  "convertedOrderId" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QuoteItem" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "productId" TEXT,

  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT 'Portion',
  "unitCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,

  "taxRate" INTEGER NOT NULL DEFAULT 7,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS
"Quote_tenantId_quoteNumber_key"
ON "Quote"("tenantId", "quoteNumber");

CREATE INDEX IF NOT EXISTS
"Quote_tenantId_idx"
ON "Quote"("tenantId");

CREATE INDEX IF NOT EXISTS
"Quote_customerId_idx"
ON "Quote"("customerId");

CREATE INDEX IF NOT EXISTS
"Quote_status_idx"
ON "Quote"("status");

CREATE INDEX IF NOT EXISTS
"Quote_eventDate_idx"
ON "Quote"("eventDate");

CREATE INDEX IF NOT EXISTS
"Quote_createdAt_idx"
ON "Quote"("createdAt");

CREATE INDEX IF NOT EXISTS
"QuoteItem_quoteId_idx"
ON "QuoteItem"("quoteId");

CREATE INDEX IF NOT EXISTS
"QuoteItem_productId_idx"
ON "QuoteItem"("productId");

DO $$
BEGIN
  ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_customerId_fkey"
  FOREIGN KEY ("customerId")
  REFERENCES "Customer"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "QuoteItem_quoteId_fkey"
  FOREIGN KEY ("quoteId")
  REFERENCES "Quote"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "QuoteItem_productId_fkey"
  FOREIGN KEY ("productId")
  REFERENCES "Product"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;