CREATE TABLE "DeliveryNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "pdfData" BYTEA NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryNote_orderId_key"
ON "DeliveryNote"("orderId");

CREATE INDEX "DeliveryNote_tenantId_idx"
ON "DeliveryNote"("tenantId");

CREATE INDEX "DeliveryNote_generatedAt_idx"
ON "DeliveryNote"("generatedAt");

ALTER TABLE "DeliveryNote"
ADD CONSTRAINT "DeliveryNote_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "DeliveryNote"
ADD CONSTRAINT "DeliveryNote_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "Order"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
