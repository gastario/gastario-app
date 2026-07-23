import type {
  ExtractedOrder,
  ExtractedOrderItem,
} from "./order-import-extract.server";

export type ImportDocumentType =
  | "ORDER_CONFIRMATION"
  | "INQUIRY"
  | "ORDER_CHANGE"
  | "CANCELLATION"
  | "DELIVERY_NOTE"
  | "INVOICE"
  | "CREDIT_NOTE"
  | "TRASH"
  | "UNKNOWN";

export type ImportDecision =
  | "AUTO_ACCEPT"
  | "REVIEW_REQUIRED"
  | "REJECT";

export type ImportEvidence = {
  field: string;
  value: string;
  source:
    | "subject"
    | "sender"
    | "email-body"
    | "pdf"
    | "parser"
    | "calculation"
    | "unknown";
  confidence: number;
  evidence: string;
};

export type ImportValidationIssue = {
  code: string;
  severity: "ERROR" | "WARNING";
  field?: string;
  message: string;
};

export type ImportAnalysisInput = {
  documentType: ImportDocumentType;
  classificationConfidence: number;
  classificationReason?: string;
  extractedOrder: ExtractedOrder;
  subject?: string;
  sender?: string;
  sourceText?: string;
};

export type ImportAnalysis = {
  decision: ImportDecision;
  confidence: number;
  documentType: ImportDocumentType;

  customerReliable: boolean;
  itemsReliable: boolean;
  deliveryReliable: boolean;
  totalsReliable: boolean;

  calculatedItemsTotalCents: number;
  selectedOrderTotalCents: number | null;
  selectedTotalSource:
    | "PDF_NET"
    | "ITEM_SUM"
    | null;

  issues: ImportValidationIssue[];
  evidence: ImportEvidence[];
};

const PLACEHOLDER_CUSTOMERS = new Set([
  "",
  "kunde prüfen",
  "kunde pruefen",
  "kunde unbekannt",
  "unzugeordneter e-mail-auftrag",
  "unzugeordneter e mail auftrag",
  "e-mail import",
  "email import",
]);

const PRODUCT_WORDS =
  /\b(bagel|bowl|wrap|salat|curry|pizza|buffet|frühstück|fruehstueck|croissant|schnittchen|chicken|vegan|veggie|dessert|kuchen|gemüse|gemuese|obst|lieferung|abholung)\b/i;

const COMPANY_WORDS =
  /\b(gmbh|ug|ag|se|kg|ohg|gbr|e\.?\s?v\.?|inc\.?|ltd\.?|llc|holding|group)\b/i;

function normalizeText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparison(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function calculateItemTotal(item: ExtractedOrderItem) {
  const importedTotal = Math.max(
    0,
    Number(item?.totalCents || 0)
  );

  if (importedTotal > 0) {
    return importedTotal;
  }

  const quantity = Math.max(
    0,
    Number(item?.quantity || 0)
  );

  const unitCents = Math.max(
    0,
    Number(item?.unitCents || 0)
  );

  return quantity * unitCents;
}

function isRealItem(item: ExtractedOrderItem) {
  const name = normalizeText(item?.name);

  if (!name || !/[A-Za-zÄÖÜäöüß]/.test(name)) {
    return false;
  }

  if (
    /^(übertrag|uebertrag|zwischensumme|gesamtsumme|nettosumme|bruttosumme|gesamtbetrag)\b/i.test(
      name
    )
  ) {
    return false;
  }

  return (
    Number(item?.quantity || 0) > 0 ||
    Number(item?.unitCents || 0) > 0 ||
    Number(item?.totalCents || 0) > 0
  );
}

function validateCustomerName(value: unknown) {
  const customerName = normalizeText(value);
  const normalized = normalizeComparison(customerName);

  if (PLACEHOLDER_CUSTOMERS.has(normalized)) {
    return false;
  }

  if (customerName.length < 3 || customerName.length > 120) {
    return false;
  }

  if (/^\d/.test(customerName)) {
    return false;
  }

  if (PRODUCT_WORDS.test(customerName)) {
    return false;
  }

  /*
   * Ohne eindeutigen Kundenblock oder Kundenstammabgleich
   * akzeptieren wir zunächst nur klar erkennbare Firmennamen.
   */
  return COMPANY_WORDS.test(customerName);
}

function totalsAreEqual(
  firstCents: number,
  secondCents: number
) {
  return Math.abs(firstCents - secondCents) <= 1;
}

export function analyzeImportedOrder(
  input: ImportAnalysisInput
): ImportAnalysis {
  const issues: ImportValidationIssue[] = [];
  const evidence: ImportEvidence[] = [];

  const order = input.extractedOrder;

  const validItems = Array.isArray(order?.items)
    ? order.items.filter(isRealItem)
    : [];

  const calculatedItemsTotalCents =
    validItems.reduce(
      (sum, item) => sum + calculateItemTotal(item),
      0
    );

  const pdfNetTotalCents = Math.max(
    0,
    Number(order?.pdfNetTotalCents || 0)
  );

  const customerReliable =
    validateCustomerName(order?.customerName);

  if (!customerReliable) {
    issues.push({
      code: "CUSTOMER_NOT_RELIABLE",
      severity: "ERROR",
      field: "customerName",
      message:
        "Kein eindeutig belastbarer Firmenkunde erkannt.",
    });
  } else {
    evidence.push({
      field: "customerName",
      value: normalizeText(order.customerName),
      source: "parser",
      confidence: 0.8,
      evidence:
        "Der Wert entspricht formal einem Firmennamen.",
    });
  }

  const itemsReliable =
    validItems.length > 0 &&
    calculatedItemsTotalCents > 0;

  if (!itemsReliable) {
    issues.push({
      code: "ITEMS_NOT_RELIABLE",
      severity: "ERROR",
      field: "items",
      message:
        "Keine vollständig bepreiste echte Auftragsposition erkannt.",
    });
  }

  const deliveryReliable =
    Boolean(normalizeText(order?.deliveryDate)) &&
    Boolean(normalizeText(order?.deliveryTime)) &&
    Boolean(normalizeText(order?.deliveryAddress));

  if (!deliveryReliable) {
    issues.push({
      code: "DELIVERY_NOT_COMPLETE",
      severity: "ERROR",
      field: "delivery",
      message:
        "Lieferdatum, Lieferzeit oder Lieferadresse fehlen.",
    });
  }

  let totalsReliable = false;
  let selectedOrderTotalCents: number | null = null;
  let selectedTotalSource:
    | "PDF_NET"
    | "ITEM_SUM"
    | null = null;

  if (
    pdfNetTotalCents > 0 &&
    calculatedItemsTotalCents > 0
  ) {
    if (
      totalsAreEqual(
        pdfNetTotalCents,
        calculatedItemsTotalCents
      )
    ) {
      totalsReliable = true;
      selectedOrderTotalCents = pdfNetTotalCents;
      selectedTotalSource = "PDF_NET";
    } else {
      issues.push({
        code: "TOTAL_MISMATCH",
        severity: "ERROR",
        field: "totalCents",
        message:
          "PDF-Nettosumme und Positionssumme stimmen nicht überein.",
      });
    }
  } else if (
    pdfNetTotalCents > 0 &&
    validItems.length > 0
  ) {
    issues.push({
      code: "ITEM_TOTAL_INCOMPLETE",
      severity: "ERROR",
      field: "items",
      message:
        "Eine PDF-Nettosumme wurde erkannt, die Positionen sind jedoch nicht vollständig berechenbar.",
    });
  } else if (calculatedItemsTotalCents > 0) {
    /*
     * Eine reine Positionssumme reicht noch nicht für eine
     * automatische Freigabe. Lieferkosten oder Rabatte könnten fehlen.
     */
    selectedOrderTotalCents =
      calculatedItemsTotalCents;
    selectedTotalSource = "ITEM_SUM";

    issues.push({
      code: "PDF_TOTAL_MISSING",
      severity: "WARNING",
      field: "totalCents",
      message:
        "Keine eindeutig bezeichnete PDF-Nettosumme erkannt.",
    });
  } else {
    issues.push({
      code: "TOTAL_MISSING",
      severity: "ERROR",
      field: "totalCents",
      message:
        "Kein belastbarer Auftragswert erkannt.",
    });
  }

  const isOrderDocument =
    input.documentType === "ORDER_CONFIRMATION";

  if (!isOrderDocument) {
    issues.push({
      code: "NOT_CONFIRMED_ORDER",
      severity:
        input.documentType === "INQUIRY"
          ? "WARNING"
          : "ERROR",
      field: "documentType",
      message:
        "Das Dokument ist keine sicher erkannte Auftragsbestätigung.",
    });
  }

  const classificationReliable =
    isOrderDocument &&
    Number(input.classificationConfidence || 0) >= 0.95;

  if (!classificationReliable && isOrderDocument) {
    issues.push({
      code: "CLASSIFICATION_NOT_RELIABLE",
      severity: "ERROR",
      field: "documentType",
      message:
        "Die Klassifizierung als Auftrag ist nicht sicher genug.",
    });
  }

  const hasErrors =
    issues.some((issue) => issue.severity === "ERROR");

  /*
   * Sicherheitsschalter:
   * AUTO_ACCEPT wird erst freigeschaltet, wenn ein belastbarer
   * Regressionstest-Katalog vorhanden ist.
   */
  const decision: ImportDecision =
    input.documentType === "TRASH" ||
    input.documentType === "INVOICE" ||
    input.documentType === "DELIVERY_NOTE"
      ? "REJECT"
      : hasErrors
        ? "REVIEW_REQUIRED"
        : "REVIEW_REQUIRED";

  const confidenceParts = [
    customerReliable ? 1 : 0,
    itemsReliable ? 1 : 0,
    deliveryReliable ? 1 : 0,
    totalsReliable ? 1 : 0,
    classificationReliable ? 1 : 0,
  ];

  const confidence =
    confidenceParts.reduce(
      (sum, value) => sum + value,
      0
    ) / confidenceParts.length;

  return {
    decision,
    confidence,
    documentType: input.documentType,
    customerReliable,
    itemsReliable,
    deliveryReliable,
    totalsReliable,
    calculatedItemsTotalCents,
    selectedOrderTotalCents,
    selectedTotalSource,
    issues,
    evidence,
  };
}