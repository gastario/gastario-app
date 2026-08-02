-- CreateEnum
CREATE TYPE "ProductOperationalArea" AS ENUM (
  'REVIEW',
  'KITCHEN',
  'PACKING',
  'LOGISTICS',
  'NON_OPERATIONAL'
);

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "operationalArea" "ProductOperationalArea" NOT NULL DEFAULT 'REVIEW';

-- AlterTable
ALTER TABLE "OrderItem"
ADD COLUMN "operationalQuantity" DOUBLE PRECISION,
ADD COLUMN "operationalUnit" TEXT,
ADD COLUMN "operationalArea" "ProductOperationalArea";

-- CreateIndex
CREATE INDEX "Product_tenantId_operationalArea_idx"
ON "Product"("tenantId", "operationalArea");
