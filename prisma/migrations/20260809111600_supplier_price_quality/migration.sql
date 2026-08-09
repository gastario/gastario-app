ALTER TABLE "SupplierPriceSnapshot"
ADD COLUMN "qualityStatus" TEXT NOT NULL DEFAULT 'UNCHECKED',
ADD COLUMN "qualityReason" TEXT,
ADD COLUMN "referencePriceCents" INTEGER,
ADD COLUMN "priceRatio" DOUBLE PRECISION,
ADD COLUMN "qualityCheckedAt" TIMESTAMP(3);

CREATE INDEX "SupplierPriceSnapshot_qualityStatus_idx"
ON "SupplierPriceSnapshot"("qualityStatus");