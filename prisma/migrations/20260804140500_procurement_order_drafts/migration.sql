CREATE TYPE "ProcurementOrderDraftStatus" AS ENUM (
  'DRAFT',
  'ORDERED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED'
);

CREATE TYPE "ProcurementPlanType" AS ENUM (
  'CHEAPEST',
  'PRACTICAL'
);

CREATE TABLE "ProcurementOrderDraft" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT,
  "supplierName" TEXT NOT NULL,
  "planningDate" TIMESTAMP(3) NOT NULL,
  "planType" "ProcurementPlanType" NOT NULL,
  "status" "ProcurementOrderDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "netTotalCents" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "orderedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcurementOrderDraft_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "ProcurementOrderDraftItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "catalogItemId" TEXT,
  "ingredientName" TEXT NOT NULL,
  "catalogItemName" TEXT NOT NULL,
  "articleNumber" TEXT,
  "packageCount" DOUBLE PRECISION NOT NULL,
  "packContent" DOUBLE PRECISION,
  "baseUnit" TEXT,
  "netUnitPriceCents" INTEGER NOT NULL,
  "netTotalCents" INTEGER NOT NULL,
  "receivedPackageCount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcurementOrderDraftItem_pkey"
    PRIMARY KEY ("id")
);

CREATE INDEX "ProcurementOrderDraft_tenantId_idx"
  ON "ProcurementOrderDraft"("tenantId");

CREATE INDEX "ProcurementOrderDraft_supplierId_idx"
  ON "ProcurementOrderDraft"("supplierId");

CREATE INDEX "ProcurementOrderDraft_planningDate_idx"
  ON "ProcurementOrderDraft"("planningDate");

CREATE INDEX "ProcurementOrderDraft_status_idx"
  ON "ProcurementOrderDraft"("status");

CREATE INDEX "ProcurementOrderDraft_planType_idx"
  ON "ProcurementOrderDraft"("planType");

CREATE INDEX "ProcurementOrderDraft_createdAt_idx"
  ON "ProcurementOrderDraft"("createdAt");

CREATE INDEX "ProcurementOrderDraftItem_tenantId_idx"
  ON "ProcurementOrderDraftItem"("tenantId");

CREATE INDEX "ProcurementOrderDraftItem_draftId_idx"
  ON "ProcurementOrderDraftItem"("draftId");

CREATE INDEX "ProcurementOrderDraftItem_catalogItemId_idx"
  ON "ProcurementOrderDraftItem"("catalogItemId");

CREATE INDEX "ProcurementOrderDraftItem_ingredientName_idx"
  ON "ProcurementOrderDraftItem"("ingredientName");

ALTER TABLE "ProcurementOrderDraft"
  ADD CONSTRAINT "ProcurementOrderDraft_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ProcurementOrderDraftItem"
  ADD CONSTRAINT "ProcurementOrderDraftItem_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ProcurementOrderDraftItem"
  ADD CONSTRAINT "ProcurementOrderDraftItem_draftId_fkey"
  FOREIGN KEY ("draftId")
  REFERENCES "ProcurementOrderDraft"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ProcurementOrderDraftItem"
  ADD CONSTRAINT "ProcurementOrderDraftItem_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId")
  REFERENCES "SupplierCatalogItem"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;