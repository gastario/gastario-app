-- CreateEnum
CREATE TYPE "SupplierConnectionType" AS ENUM ('API', 'PUNCHOUT', 'BMECAT', 'CXML', 'EDI', 'CSV', 'EXCEL', 'EMAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "SupplierConnectionStatus" AS ENUM ('DISCONNECTED', 'CONFIGURED', 'ACTIVE', 'ERROR', 'PAUSED');

-- CreateEnum
CREATE TYPE "SupplierSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SupplierPriceSource" AS ENUM ('API', 'PUNCHOUT', 'CATALOG', 'CSV', 'EXCEL', 'EMAIL', 'INVOICE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SupplierMatchMethod" AS ENUM ('ARTICLE_NUMBER', 'EAN', 'GTIN', 'MANUAL', 'AI_SUGGESTION');

-- CreateTable
CREATE TABLE "SupplierConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" "SupplierConnectionType" NOT NULL,
    "status" "SupplierConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "label" TEXT,
    "customerNumber" TEXT,
    "endpointUrl" TEXT,
    "credentialsEncrypted" TEXT,
    "settingsJson" JSONB,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCatalogItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "connectionId" TEXT,
    "externalId" TEXT,
    "articleNumber" TEXT,
    "ean" TEXT,
    "gtin" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "orderUnit" TEXT,
    "baseUnit" TEXT,
    "contentQuantity" DOUBLE PRECISION,
    "packageQuantity" DOUBLE PRECISION,
    "minimumOrderQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "availabilityStatus" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPriceSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "netPriceCents" INTEGER NOT NULL,
    "grossPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceUnitQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "priceUnit" TEXT,
    "minimumQuantity" DOUBLE PRECISION,
    "available" BOOLEAN,
    "stockText" TEXT,
    "promotional" BOOLEAN NOT NULL DEFAULT false,
    "source" "SupplierPriceSource" NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSyncRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "SupplierSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsSeen" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "pricesCreated" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "detailsJson" JSONB,

    CONSTRAINT "SupplierSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSupplierMatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "method" "SupplierMatchMethod" NOT NULL DEFAULT 'MANUAL',
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "conversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSupplierMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierConnection_tenantId_idx" ON "SupplierConnection"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierConnection_supplierId_idx" ON "SupplierConnection"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierConnection_status_idx" ON "SupplierConnection"("status");

-- CreateIndex
CREATE INDEX "SupplierConnection_nextSyncAt_idx" ON "SupplierConnection"("nextSyncAt");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_tenantId_idx" ON "SupplierCatalogItem"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_supplierId_idx" ON "SupplierCatalogItem"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_connectionId_idx" ON "SupplierCatalogItem"("connectionId");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_ean_idx" ON "SupplierCatalogItem"("ean");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_gtin_idx" ON "SupplierCatalogItem"("gtin");

-- CreateIndex
CREATE INDEX "SupplierCatalogItem_name_idx" ON "SupplierCatalogItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCatalogItem_supplierId_articleNumber_key" ON "SupplierCatalogItem"("supplierId", "articleNumber");

-- CreateIndex
CREATE INDEX "SupplierPriceSnapshot_tenantId_idx" ON "SupplierPriceSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierPriceSnapshot_catalogItemId_idx" ON "SupplierPriceSnapshot"("catalogItemId");

-- CreateIndex
CREATE INDEX "SupplierPriceSnapshot_fetchedAt_idx" ON "SupplierPriceSnapshot"("fetchedAt");

-- CreateIndex
CREATE INDEX "SupplierPriceSnapshot_validUntil_idx" ON "SupplierPriceSnapshot"("validUntil");

-- CreateIndex
CREATE INDEX "SupplierPriceSnapshot_netPriceCents_idx" ON "SupplierPriceSnapshot"("netPriceCents");

-- CreateIndex
CREATE INDEX "SupplierSyncRun_tenantId_idx" ON "SupplierSyncRun"("tenantId");

-- CreateIndex
CREATE INDEX "SupplierSyncRun_connectionId_idx" ON "SupplierSyncRun"("connectionId");

-- CreateIndex
CREATE INDEX "SupplierSyncRun_status_idx" ON "SupplierSyncRun"("status");

-- CreateIndex
CREATE INDEX "SupplierSyncRun_startedAt_idx" ON "SupplierSyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "ProductSupplierMatch_tenantId_idx" ON "ProductSupplierMatch"("tenantId");

-- CreateIndex
CREATE INDEX "ProductSupplierMatch_productId_idx" ON "ProductSupplierMatch"("productId");

-- CreateIndex
CREATE INDEX "ProductSupplierMatch_catalogItemId_idx" ON "ProductSupplierMatch"("catalogItemId");

-- CreateIndex
CREATE INDEX "ProductSupplierMatch_preferred_idx" ON "ProductSupplierMatch"("preferred");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSupplierMatch_productId_catalogItemId_key" ON "ProductSupplierMatch"("productId", "catalogItemId");

-- AddForeignKey
ALTER TABLE "SupplierConnection" ADD CONSTRAINT "SupplierConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierConnection" ADD CONSTRAINT "SupplierConnection_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SupplierConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceSnapshot" ADD CONSTRAINT "SupplierPriceSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceSnapshot" ADD CONSTRAINT "SupplierPriceSnapshot_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "SupplierCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSyncRun" ADD CONSTRAINT "SupplierSyncRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSyncRun" ADD CONSTRAINT "SupplierSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SupplierConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplierMatch" ADD CONSTRAINT "ProductSupplierMatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplierMatch" ADD CONSTRAINT "ProductSupplierMatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplierMatch" ADD CONSTRAINT "ProductSupplierMatch_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "SupplierCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
