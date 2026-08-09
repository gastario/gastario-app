CREATE TABLE "SupplierSearchDiscovery" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "queryNormalized" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 10,
  "searchCount" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "lastRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastProcessedAt" TIMESTAMP(3),
  "lastResultCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierSearchDiscovery_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "SupplierSearchDiscovery_tenantId_queryNormalized_key"
ON "SupplierSearchDiscovery"(
  "tenantId",
  "queryNormalized"
);

CREATE INDEX
  "SupplierSearchDiscovery_tenantId_status_priority_idx"
ON "SupplierSearchDiscovery"(
  "tenantId",
  "status",
  "priority"
);

CREATE INDEX
  "SupplierSearchDiscovery_tenantId_lastRequestedAt_idx"
ON "SupplierSearchDiscovery"(
  "tenantId",
  "lastRequestedAt"
);