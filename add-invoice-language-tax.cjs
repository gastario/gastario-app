const fs = require("fs");

const file = "prisma/schema.prisma";
let schema = fs.readFileSync(file, "utf8");

function addEnum(name, body) {
  if (!schema.includes(`enum ${name}`)) {
    schema += `

enum ${name} {
${body}
}
`;
  }
}

function addFieldToModel(modelName, fieldLine, afterFieldRegex) {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start === -1) return false;

  const end = schema.indexOf("\n}", start);
  if (end === -1) throw new Error(`Ende von model ${modelName} nicht gefunden.`);

  let model = schema.slice(start, end);

  const fieldName = fieldLine.trim().split(/\s+/)[0];
  if (model.includes(`\n  ${fieldName} `)) return true;

  if (afterFieldRegex && afterFieldRegex.test(model)) {
    model = model.replace(afterFieldRegex, (match) => `${match}${fieldLine}\n`);
  } else {
    model += `\n${fieldLine}`;
  }

  schema = schema.slice(0, start) + model + schema.slice(end);
  return true;
}

addEnum("InvoiceLanguage", `  DE
  EN`);

addEnum("CustomerType", `  PRIVATE
  BUSINESS`);

addEnum("TaxTreatment", `  DOMESTIC_19
  DOMESTIC_7
  TAX_FREE
  REVERSE_CHARGE
  EXPORT
  OTHER`);

addEnum("BillingMode", `  UNDECIDED
  DIRECT_INVOICE
  PLATFORM_CREDIT
  NO_INVOICE`);

addEnum("BillingStatus", `  NOT_BILLED
  READY_TO_INVOICE
  INVOICED
  WAITING_FOR_PLATFORM
  PLATFORM_DONE
  NOT_RELEVANT`);

addEnum("InvoiceType", `  DIRECT
  PLATFORM_NOTE`);

addEnum("InvoiceStatus", `  DRAFT
  ISSUED
  PAID
  CANCELLED
  CORRECTED`);

addEnum("InvoiceNumberSource", `  MANUAL
  GASTARIO`);

// Order für Abrechnung vorbereiten
addFieldToModel("Order", `  billingMode       BillingMode   @default(UNDECIDED)`, /(\n  notes\s+String\?\s*)/);
addFieldToModel("Order", `  billingStatus     BillingStatus @default(NOT_BILLED)`, /(\n  billingMode\s+BillingMode[^\n]*\s*)/);
addFieldToModel("Order", `  invoiceLanguage   InvoiceLanguage @default(DE)`, /(\n  billingStatus\s+BillingStatus[^\n]*\s*)/);
addFieldToModel("Order", `  customerCountry   String @default("DE")`, /(\n  invoiceLanguage\s+InvoiceLanguage[^\n]*\s*)/);
addFieldToModel("Order", `  customerVatId     String?`, /(\n  customerCountry\s+String[^\n]*\s*)/);
addFieldToModel("Order", `  customerType      CustomerType @default(BUSINESS)`, /(\n  customerVatId\s+String\?\s*)/);
addFieldToModel("Order", `  taxTreatment      TaxTreatment @default(DOMESTIC_19)`, /(\n  customerType\s+CustomerType[^\n]*\s*)/);

if (!schema.includes("model Invoice {")) {
  schema += `

model Invoice {
  id       String @id @default(cuid())
  tenantId String
  orderId  String?

  type         InvoiceType         @default(DIRECT)
  status       InvoiceStatus       @default(DRAFT)
  numberSource InvoiceNumberSource @default(MANUAL)

  language     InvoiceLanguage @default(DE)
  customerType CustomerType    @default(BUSINESS)
  taxTreatment TaxTreatment    @default(DOMESTIC_19)

  invoiceNumber String?
  invoiceDate   DateTime?
  serviceDate   DateTime?
  dueDate        DateTime?

  customerName    String
  customerEmail   String?
  customerAddress String?
  customerCountry String @default("DE")
  customerVatId   String?

  sellerName      String?
  sellerAddress   String?
  sellerTaxNumber String?
  sellerVatId     String?

  currency        String @default("EUR")
  netTotalCents   Int    @default(0)
  taxTotalCents   Int    @default(0)
  grossTotalCents Int    @default(0)

  reverseChargeNoteDe String?
  reverseChargeNoteEn String?
  paymentTermsDe      String?
  paymentTermsEn      String?

  notes       String?
  issuedAt    DateTime?
  paidAt      DateTime?
  cancelledAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  order  Order? @relation(fields: [orderId], references: [id])

  items InvoiceItem[]

  @@unique([tenantId, invoiceNumber])
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

  unitCents       Int @default(0)
  discountPercent Int @default(0)
  discountCents   Int @default(0)
  netTotalCents   Int @default(0)
  taxRate         Int @default(19)
  taxTotalCents   Int @default(0)
  grossTotalCents Int @default(0)

  notes String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
  @@index([position])
}
`;
} else {
  addFieldToModel("Invoice", `  language     InvoiceLanguage @default(DE)`, /(\n  numberSource\s+InvoiceNumberSource[^\n]*\s*)/);
  addFieldToModel("Invoice", `  customerType CustomerType    @default(BUSINESS)`, /(\n  language\s+InvoiceLanguage[^\n]*\s*)/);
  addFieldToModel("Invoice", `  taxTreatment TaxTreatment    @default(DOMESTIC_19)`, /(\n  customerType\s+CustomerType[^\n]*\s*)/);
  addFieldToModel("Invoice", `  customerCountry String @default("DE")`, /(\n  customerAddress\s+String\?\s*)/);
  addFieldToModel("Invoice", `  customerVatId   String?`, /(\n  customerCountry\s+String[^\n]*\s*)/);
  addFieldToModel("Invoice", `  reverseChargeNoteDe String?`, /(\n  grossTotalCents\s+Int[^\n]*\s*)/);
  addFieldToModel("Invoice", `  reverseChargeNoteEn String?`, /(\n  reverseChargeNoteDe\s+String\?\s*)/);
  addFieldToModel("Invoice", `  paymentTermsDe      String?`, /(\n  reverseChargeNoteEn\s+String\?\s*)/);
  addFieldToModel("Invoice", `  paymentTermsEn      String?`, /(\n  paymentTermsDe\s+String\?\s*)/);
}

// Tenant Relation
addFieldToModel("Tenant", `  invoices  Invoice[]`, /(\n  updatedAt\s+DateTime\s+@updatedAt\s*)/);

// Order Relation
addFieldToModel("Order", `  invoices Invoice[]`, /(\n  items\s+OrderItem\[\]\s*)/);

fs.writeFileSync(file, schema, "utf8");
