CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "fileData" BYTEA NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receiptDate" TIMESTAMP(3),
  "supplierName" TEXT,
  "amountCents" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Receipt_tenantId_createdAt_idx" ON "Receipt"("tenantId", "createdAt");
CREATE INDEX "Receipt_tenantId_status_idx" ON "Receipt"("tenantId", "status");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
