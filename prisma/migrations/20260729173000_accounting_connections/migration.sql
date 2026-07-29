-- CreateEnum
CREATE TYPE "AccountingProvider" AS ENUM (
  'LEXWARE'
);

-- CreateEnum
CREATE TYPE "AccountingConnectionStatus" AS ENUM (
  'DISCONNECTED',
  'CONFIGURED',
  'ACTIVE',
  'ERROR',
  'PAUSED'
);

-- CreateTable
CREATE TABLE "AccountingConnection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" "AccountingProvider" NOT NULL,
  "status" "AccountingConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "label" TEXT,
  "credentialsEncrypted" TEXT NOT NULL,
  "organizationId" TEXT,
  "companyName" TEXT,
  "settingsJson" JSONB,
  "lastSyncAt" TIMESTAMP(3),
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "nextSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountingConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingConnection_tenantId_provider_key"
ON "AccountingConnection"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "AccountingConnection_tenantId_idx"
ON "AccountingConnection"("tenantId");

-- CreateIndex
CREATE INDEX "AccountingConnection_status_idx"
ON "AccountingConnection"("status");

-- CreateIndex
CREATE INDEX "AccountingConnection_nextSyncAt_idx"
ON "AccountingConnection"("nextSyncAt");

-- AddForeignKey
ALTER TABLE "AccountingConnection"
ADD CONSTRAINT "AccountingConnection_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;