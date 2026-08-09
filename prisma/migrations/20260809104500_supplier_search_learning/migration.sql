CREATE TABLE "SupplierSearchLearningSuggestion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "queryTerm" TEXT NOT NULL,
  "queryNormalized" TEXT NOT NULL,
  "candidateTerm" TEXT NOT NULL,
  "candidateNormalized" TEXT NOT NULL,
  "evidenceCount" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "lastCatalogItemName" TEXT,
  "lastSupplierName" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierSearchLearningSuggestion_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "SupplierSearchLearningSuggestion_tenantId_queryNormalized_candidateNormalized_key"
ON "SupplierSearchLearningSuggestion"(
  "tenantId",
  "queryNormalized",
  "candidateNormalized"
);

CREATE INDEX
  "SupplierSearchLearningSuggestion_tenantId_idx"
ON "SupplierSearchLearningSuggestion"("tenantId");

CREATE INDEX
  "SupplierSearchLearningSuggestion_tenantId_status_idx"
ON "SupplierSearchLearningSuggestion"(
  "tenantId",
  "status"
);

CREATE INDEX
  "SupplierSearchLearningSuggestion_tenantId_evidenceCount_idx"
ON "SupplierSearchLearningSuggestion"(
  "tenantId",
  "evidenceCount"
);