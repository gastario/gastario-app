const fs = require("fs");

const file = "prisma/schema.prisma";
let schema = fs.readFileSync(file, "utf8");

// kaputte zusammengedrückte Feldzeilen reparieren
schema = schema.replaceAll(
  `customerCountry   String @default("DE")  customerVatId     String?`,
  `customerCountry   String @default("DE")
  customerVatId     String?`
);

schema = schema.replaceAll(
  `customerCountry String @default("DE")  customerVatId     String?`,
  `customerCountry String @default("DE")
  customerVatId     String?`
);

schema = schema.replaceAll(
  `customerType      CustomerType @default(BUSINESS)  taxTreatment      TaxTreatment @default(DOMESTIC_19)`,
  `customerType      CustomerType @default(BUSINESS)
  taxTreatment      TaxTreatment @default(DOMESTIC_19)`
);

schema = schema.replaceAll(
  `customerType CustomerType    @default(BUSINESS)  taxTreatment TaxTreatment    @default(DOMESTIC_19)`,
  `customerType CustomerType    @default(BUSINESS)
  taxTreatment TaxTreatment    @default(DOMESTIC_19)`
);

schema = schema.replaceAll(
  `customerVatId   String?  reverseChargeNoteEn String?`,
  `customerVatId   String?
  reverseChargeNoteEn String?`
);

schema = schema.replaceAll(
  `reverseChargeNoteDe String?  reverseChargeNoteEn String?`,
  `reverseChargeNoteDe String?
  reverseChargeNoteEn String?`
);

schema = schema.replaceAll(
  `reverseChargeNoteEn String?  paymentTermsDe      String?`,
  `reverseChargeNoteEn String?
  paymentTermsDe      String?`
);

schema = schema.replaceAll(
  `paymentTermsDe      String?  paymentTermsEn      String?`,
  `paymentTermsDe      String?
  paymentTermsEn      String?`
);

// allgemeiner Notfall-Fix, falls Felder mehrfach ohne Zeilenumbruch stehen
schema = schema.replace(/(customerCountry\s+String\s+@default\("DE"\))\s+(customerVatId\s+String\?)/g, "$1\n  $2");
schema = schema.replace(/(customerType\s+CustomerType\s+@default\(BUSINESS\))\s+(taxTreatment\s+TaxTreatment\s+@default\(DOMESTIC_19\))/g, "$1\n  $2");
schema = schema.replace(/(customerVatId\s+String\?)\s+(reverseChargeNoteDe\s+String\?)/g, "$1\n  $2");
schema = schema.replace(/(customerVatId\s+String\?)\s+(reverseChargeNoteEn\s+String\?)/g, "$1\n  $2");
schema = schema.replace(/(reverseChargeNoteDe\s+String\?)\s+(reverseChargeNoteEn\s+String\?)/g, "$1\n  $2");
schema = schema.replace(/(reverseChargeNoteEn\s+String\?)\s+(paymentTermsDe\s+String\?)/g, "$1\n  $2");
schema = schema.replace(/(paymentTermsDe\s+String\?)\s+(paymentTermsEn\s+String\?)/g, "$1\n  $2");

fs.writeFileSync(file, schema, "utf8");
