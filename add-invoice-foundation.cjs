const fs = require("fs");

const file = "prisma/schema.prisma";
let schema = fs.readFileSync(file, "utf8");

// 1) Enums ergänzen
const enumBlock = `
enum BillingMode {
  UNDECIDED
  DIRECT_INVOICE
  EXTERNAL_INVOICE
  PLATFORM_CREDIT
  NO_INVOICE
}

enum BillingStatus {
  NOT_BILLED
  READY_TO_INVOICE
  INVOICED
  INVOICED_EXTERNALLY
  WAITING_FOR_CREDIT
  CREDIT_RECEIVED
  NOT_RELEVANT
}

enum InvoiceType {
  DIRECT
  EXTERNAL
  PLATFORM_CREDIT
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
  CANCELLED
  CORRECTED
}

enum InvoiceNumberSource {
  GASTARIO
  CASH_REGISTER
  LEXWARE
  PLATFORM
  MANUAL
}
`;

if (!schema.includes("enum BillingMode")) {
  schema += "\n" + enumBlock + "\n";
}

// 2) Tenant bekommt invoices Relation
const tenantStart = schema.indexOf("model Tenant {");
if (tenantStart === -1) throw new Error("model Tenant nicht gefunden.");

const tenantEnd = schema.indexOf("\n}", tenantStart);
let tenantModel = schema.slice(tenantStart, tenantEnd);

if (!tenantModel.includes("invoices")) {
  tenantModel = tenantModel.replace(
    /(\s+updatedAt\s+DateTime\s+@updatedAt\r?\n)/,
    `$1  invoices  Invoice[]\n`
  );

  schema = schema.slice(0, tenantStart) + tenantModel + schema.slice(tenantEnd);
}

// 3) Order bekommt Abrechnungsfelder und invoices Relation
const orderStart = schema.indexOf("model Order {");
if (orderStart === -1) throw new Error("model Order nicht gefunden.");

const orderEnd = schema.indexOf("\n}", orderStart);
let orderModel = schema.slice(orderStart, orderEnd);

if (!orderModel.includes("billingMode")) {
  orderModel = orderModel.replace(
    /(\s+notes\s+String\?\r?\n)/,
    `$1
  billingMode           BillingMode   @default(UNDECIDED)
  billingStatus         BillingStatus @default(NOT_BILLED)
  platformName          String?
  platformReference     String?
  externalInvoiceNumber String?
`
  );
}

if (!orderModel.includes("invoices")) {
  orderModel = orderModel.replace(
    /(\s+items\s+OrderItem\[\]\r?\n)/,
    `$1  invoices      Invoice[]\n`
  );
}

schema = schema.slice(0, orderStart) + orderModel + schema.slice(orderEnd);

// 4) Invoice und InvoiceItem Models ergänzen
const invoiceModels = `
model Invoice {
  id        String @id @default(cuid())
  tenantId  String
  orderId   String?

  type         InvoiceType         @default(DIRECT)
  status       InvoiceStatus       @default(DRAFT)
  numberSource InvoiceNumberSource @default(MANUAL)

  internalNumber        String?
  externalInvoiceNumber String?
  sourceSystem          String?

  invoiceDate DateTime?
  serviceDate DateTime?
  dueDate     DateTime?

  customerName    String
  customerEmail   String?
  customerAddress String?

  sellerName      String?
  sellerAddress   String?
  sellerTaxNumber String?
  sellerVatId     String?

  currency        String @default("EUR")
  netTotalCents   Int    @default(0)
  taxTotalCents   Int    @default(0)
  grossTotalCents Int    @default(0)

  notes       String?
  issuedAt    DateTime?
  paidAt      DateTime?
  cancelledAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  order  Order? @relation(fields: [orderId], references: [id])

  items InvoiceItem[]

  @@unique([tenantId, externalInvoiceNumber])
  @@index([tenantId])
  @@index([orderId])
  @@index([status])
  @@index([invoiceDate])
}

model InvoiceItem {
  id        String @id @default(cuid())
  invoiceId String

  position Int    @default(1)
  type     String @default("ITEM")

  name        String
  description String?

  quantity Float  @default(1)
  unit     String @default("Stück")

  unitCents          Int @default(0)
  discountPercent    Int @default(0)
  discountCents      Int @default(0)
  netTotalCents      Int @default(0)
  taxRate            Int @default(19)
  taxTotalCents      Int @default(0)
  grossTotalCents    Int @default(0)

  notes String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
  @@index([position])
}
`;

if (!schema.includes("model Invoice {")) {
  schema += "\n" + invoiceModels + "\n";
}

fs.writeFileSync(file, schema, "utf8");
