-- CreateEnum
CREATE TYPE "GlobalSupplierCatalogFeedType" AS ENUM (
    'CSV_URL',
    'BMECAT_URL',
    'CXML_URL',
    'API',
    'SFTP'
);

-- CreateTable
CREATE TABLE "GlobalSupplierCatalogFeed" (
    "id" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "label" TEXT,
    "sourceType" "GlobalSupplierCatalogFeedType" NOT NULL,
    "endpointUrl" TEXT,
    "credentialReference" TEXT,
    "settingsJson" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "automaticSync" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalSupplierCatalogFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlobalSupplierCatalogFeed_providerCode_idx"
ON "GlobalSupplierCatalogFeed"("providerCode");

-- CreateIndex
CREATE INDEX "GlobalSupplierCatalogFeed_active_automaticSync_nextSyncAt_idx"
ON "GlobalSupplierCatalogFeed"("active", "automaticSync", "nextSyncAt");

-- CreateIndex
CREATE INDEX "GlobalSupplierCatalogFeed_sourceType_idx"
ON "GlobalSupplierCatalogFeed"("sourceType");