-- Gastario production and packing workflow
ALTER TABLE "Order"
ADD COLUMN "productionStartedAt" TIMESTAMP(3),
ADD COLUMN "productionCompletedAt" TIMESTAMP(3),
ADD COLUMN "packingStartedAt" TIMESTAMP(3),
ADD COLUMN "packingCompletedAt" TIMESTAMP(3),
ADD COLUMN "packingChecklist" JSONB;
