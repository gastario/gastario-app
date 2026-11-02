-- CreateTable
CREATE TABLE "ManualShoppingList" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "planningDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualShoppingListItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "notes" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualShoppingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualShoppingList_tenantId_idx"
ON "ManualShoppingList"("tenantId");

-- CreateIndex
CREATE INDEX "ManualShoppingList_planningDate_idx"
ON "ManualShoppingList"("planningDate");

-- CreateIndex
CREATE INDEX "ManualShoppingList_createdAt_idx"
ON "ManualShoppingList"("createdAt");

-- CreateIndex
CREATE INDEX "ManualShoppingListItem_tenantId_idx"
ON "ManualShoppingListItem"("tenantId");

-- CreateIndex
CREATE INDEX "ManualShoppingListItem_listId_idx"
ON "ManualShoppingListItem"("listId");

-- CreateIndex
CREATE INDEX "ManualShoppingListItem_checked_idx"
ON "ManualShoppingListItem"("checked");

-- CreateIndex
CREATE INDEX "ManualShoppingListItem_sortOrder_idx"
ON "ManualShoppingListItem"("sortOrder");

-- AddForeignKey
ALTER TABLE "ManualShoppingList"
ADD CONSTRAINT "ManualShoppingList_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualShoppingListItem"
ADD CONSTRAINT "ManualShoppingListItem_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualShoppingListItem"
ADD CONSTRAINT "ManualShoppingListItem_listId_fkey"
FOREIGN KEY ("listId")
REFERENCES "ManualShoppingList"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
