const fs = require("fs");

const file = "prisma/schema.prisma";
let schema = fs.readFileSync(file, "utf8");

function addFieldToTenant(fieldLine) {
  const start = schema.indexOf("model Tenant {");
  if (start === -1) throw new Error("model Tenant nicht gefunden.");

  const end = schema.indexOf("\n}", start);
  if (end === -1) throw new Error("Ende von model Tenant nicht gefunden.");

  let model = schema.slice(start, end);
  const fieldName = fieldLine.trim().split(/\s+/)[0];

  if (model.includes(`\n  ${fieldName} `)) return;

  const updatedAtLine = /\n  updatedAt\s+DateTime\s+@updatedAt/;

  if (updatedAtLine.test(model)) {
    model = model.replace(updatedAtLine, (match) => `${match}\n${fieldLine}`);
  } else {
    model += `\n${fieldLine}`;
  }

  schema = schema.slice(0, start) + model + schema.slice(end);
}

[
  "  invoiceSellerName       String?",
  "  invoiceSellerAddress    String?",
  "  invoiceTaxNumber        String?",
  "  invoiceVatId            String?",
  "  invoiceEmail            String?",
  "  invoicePhone            String?",
  "  invoiceIban             String?",
  "  invoiceBic              String?",
  "  invoiceBankName         String?",
  "  invoicePaymentTermsDe   String?",
  "  invoicePaymentTermsEn   String?",
  "  invoiceClosingTextDe    String?",
  "  invoiceClosingTextEn    String?"
].forEach(addFieldToTenant);

fs.writeFileSync(file, schema, "utf8");
