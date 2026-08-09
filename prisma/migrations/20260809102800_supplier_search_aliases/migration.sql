CREATE TABLE "SupplierSearchAlias" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "canonicalTerm" TEXT NOT NULL,
  "aliasTerm" TEXT NOT NULL,
  "canonicalNormalized" TEXT NOT NULL,
  "aliasNormalized" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierSearchAlias_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "SupplierSearchAlias_tenantId_aliasNormalized_key"
ON "SupplierSearchAlias"(
  "tenantId",
  "aliasNormalized"
);

CREATE INDEX
  "SupplierSearchAlias_tenantId_idx"
ON "SupplierSearchAlias"("tenantId");

CREATE INDEX
  "SupplierSearchAlias_tenantId_canonicalNormalized_idx"
ON "SupplierSearchAlias"(
  "tenantId",
  "canonicalNormalized"
);

CREATE INDEX
  "SupplierSearchAlias_tenantId_active_idx"
ON "SupplierSearchAlias"(
  "tenantId",
  "active"
);