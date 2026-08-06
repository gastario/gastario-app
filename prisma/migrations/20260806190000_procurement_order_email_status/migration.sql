ALTER TABLE "ProcurementOrderDraft"
  ADD COLUMN "emailedAt" TIMESTAMP(3),
  ADD COLUMN "emailedTo" TEXT,
  ADD COLUMN "emailSubject" TEXT,
  ADD COLUMN "emailMessageId" TEXT,
  ADD COLUMN "emailError" TEXT;