CREATE TYPE "ProductProcurementType" AS ENUM (
  'RECIPE',
  'READY_MADE',
  'BAKE_OFF',
  'THAW',
  'REHEAT',
  'EXTERNAL'
);

ALTER TABLE "Product"
ADD COLUMN "procurementType" "ProductProcurementType" NOT NULL DEFAULT 'RECIPE',
ADD COLUMN "supplierName" TEXT,
ADD COLUMN "supplierArticleName" TEXT,
ADD COLUMN "supplierArticleNumber" TEXT,
ADD COLUMN "purchaseUnit" TEXT,
ADD COLUMN "purchaseQuantityPerUnit" DOUBLE PRECISION,
ADD COLUMN "packageUnit" TEXT,
ADD COLUMN "packageQuantity" DOUBLE PRECISION,
ADD COLUMN "purchasePriceCents" INTEGER,
ADD COLUMN "preparationNotes" TEXT;
