CREATE TABLE "ProcurementIngredient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseUnit" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcurementIngredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcurementIngredientMatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "method" "SupplierMatchMethod" NOT NULL DEFAULT 'MANUAL',
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "conversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcurementIngredientMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcurementIngredient_tenantId_normalizedName_baseUnit_key"
ON "ProcurementIngredient"("tenantId", "normalizedName", "baseUnit");

CREATE INDEX "ProcurementIngredient_tenantId_idx"
ON "ProcurementIngredient"("tenantId");

CREATE INDEX "ProcurementIngredient_normalizedName_idx"
ON "ProcurementIngredient"("normalizedName");

CREATE INDEX "ProcurementIngredient_active_idx"
ON "ProcurementIngredient"("active");

CREATE UNIQUE INDEX "ProcurementIngredientMatch_ingredientId_catalogItemId_key"
ON "ProcurementIngredientMatch"("ingredientId", "catalogItemId");

CREATE INDEX "ProcurementIngredientMatch_tenantId_idx"
ON "ProcurementIngredientMatch"("tenantId");

CREATE INDEX "ProcurementIngredientMatch_ingredientId_idx"
ON "ProcurementIngredientMatch"("ingredientId");

CREATE INDEX "ProcurementIngredientMatch_catalogItemId_idx"
ON "ProcurementIngredientMatch"("catalogItemId");

CREATE INDEX "ProcurementIngredientMatch_preferred_idx"
ON "ProcurementIngredientMatch"("preferred");

CREATE INDEX "ProcurementIngredientMatch_active_idx"
ON "ProcurementIngredientMatch"("active");

ALTER TABLE "ProcurementIngredient"
ADD CONSTRAINT "ProcurementIngredient_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementIngredientMatch"
ADD CONSTRAINT "ProcurementIngredientMatch_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementIngredientMatch"
ADD CONSTRAINT "ProcurementIngredientMatch_ingredientId_fkey"
FOREIGN KEY ("ingredientId") REFERENCES "ProcurementIngredient"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcurementIngredientMatch"
ADD CONSTRAINT "ProcurementIngredientMatch_catalogItemId_fkey"
FOREIGN KEY ("catalogItemId") REFERENCES "SupplierCatalogItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;