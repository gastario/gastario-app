-- CreateTable
CREATE TABLE "GlobalSupplierCatalogItem" (
    "id" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "externalId" TEXT,
    "articleNumber" TEXT,
    "ean" TEXT,
    "gtin" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "searchTokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orderUnit" TEXT,
    "baseUnit" TEXT,
    "contentQuantity" DOUBLE PRECISION,
    "packageQuantity" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSupplierCatalogItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SupplierCatalogItem"
ADD COLUMN "globalCatalogItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSupplierCatalogItem_providerCode_externalId_key"
ON "GlobalSupplierCatalogItem"("providerCode", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSupplierCatalogItem_providerCode_articleNumber_key"
ON "GlobalSupplierCatalogItem"("providerCode", "articleNumber");

-- CreateIndex
CREATE INDEX "GlobalSupplierCatalogItem_providerCode_idx"
ON "GlobalSupplierCatalogItem"("providerCode");

-- CreateIndex
CREATE INDEX "GlobalSupplierCatalogItem_ean_idx"
ON "GlobalSupplierCatalogItem"("ean");

-- CreateIndex
CREATE INDEX "GlobalSupplierCatalogItem_gtin_idx"
ON "GlobalSupplierCatalogItem"("gtin");

-- CreateIndex
CREATE INDEX "GlobalSupplierCatalogItem_name_idx"
ON "GlobalSupplierCatalogItem"("name");

-- CreateIndex
CREATE INDEX "GlobalSupplierCatalogItem_searchTokens_idx"
ON "GlobalSupplierCatalogItem"
USING GIN ("searchTokens");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_globalCatalogItemId_idx"
ON "SupplierCatalogItem"("globalCatalogItemId");

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem"
ADD CONSTRAINT "SupplierCatalogItem_globalCatalogItemId_fkey"
FOREIGN KEY ("globalCatalogItemId")
REFERENCES "GlobalSupplierCatalogItem"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;