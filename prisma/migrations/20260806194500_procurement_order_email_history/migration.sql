CREATE TABLE "ProcurementOrderEmailLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT,
  "status" TEXT NOT NULL,
  "messageId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProcurementOrderEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcurementOrderEmailLog_tenantId_idx"
  ON "ProcurementOrderEmailLog"("tenantId");

CREATE INDEX "ProcurementOrderEmailLog_draftId_idx"
  ON "ProcurementOrderEmailLog"("draftId");

CREATE INDEX "ProcurementOrderEmailLog_status_idx"
  ON "ProcurementOrderEmailLog"("status");

CREATE INDEX "ProcurementOrderEmailLog_createdAt_idx"
  ON "ProcurementOrderEmailLog"("createdAt");

ALTER TABLE "ProcurementOrderEmailLog"
  ADD CONSTRAINT "ProcurementOrderEmailLog_tenantId_fkey"
  FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ProcurementOrderEmailLog"
  ADD CONSTRAINT "ProcurementOrderEmailLog_draftId_fkey"
  FOREIGN KEY ("draftId")
  REFERENCES "ProcurementOrderDraft"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;