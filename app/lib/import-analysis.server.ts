import type {
  ExtractedOrder,
  ExtractedOrderItem,
} from "./order-import-extract.server";

export type ImportDocumentType =
  | "ORDER_CONFIRMATION"
  | "INQUIRY"
  | "ORDER_CHANGE"
  | "CANCELLATION"
  | "REMINDER"
  | "CHAT_NOTIFICATION"
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
  normalizedCustomerName: string | null;
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
  /\b(bagel|bowl|wrap|salat|curry|pizza|buffet|frühstück|fruehstueck|croissant|schnittchen|chicken|vegan|veggie|dessert|kuchen|gemüse|gemuese|obst|käse|kaese|gouda|weintrauben|petersilie|cornichon|hummus|nudeln|reis|lieferung|abholung)\b/i;

const SENTENCE_WORDS =
  /\b(leider|kunde hat|hat sich|entschieden|angebot nicht angenommen|vielen dank|bitte prüfen|bitte pruefen|guten tag|hallo|mit freundlichen grüßen|mit freundlichen gruessen)\b/i;

const REGISTER_WORDS =
  /\b(HRA|HRB|Amtsgericht|AG Charlottenburg|Handelsregister|Registergericht|USt-IdNr|Steuernummer)\b/i;

const ADDRESS_WORDS =
  /\b(straße|strasse|str\.|weg|allee|platz|damm|ufer|chaussee)\b/i;

const COMPANY_SUFFIX =
  /(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|UG(?:\s*\(haftungsbeschränkt\))?|AG|SE|KG|OHG|GbR|e\.?\s*V\.?|Inc\.?|Ltd\.?|LLC)$/i;

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

function normalizeCustomerCandidate(value: unknown) {
  return normalizeText(value)
    .replace(
      /^(?:kundenname|kunde|firma|unternehmen|company)\s*[:\-]\s*/i,
      ""
    )
    .replace(/[|;,]\s*$/, "")
    .trim();
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

function validateCustomerName(
  value: unknown,
  sourceText: unknown = ""
) {
  const customerName =
    normalizeCustomerCandidate(value);

  const normalized =
    normalizeComparison(customerName);

  if (PLACEHOLDER_CUSTOMERS.has(normalized)) {
    return {
      reliable: false,
      normalizedCustomerName: null,
    };
  }

  if (
    customerName.length < 3 ||
    customerName.length > 100
  ) {
    return {
      reliable: false,
      normalizedCustomerName: null,
    };
  }

  if (
    /^\d/.test(customerName) ||
    PRODUCT_WORDS.test(customerName) ||
    SENTENCE_WORDS.test(customerName) ||
    REGISTER_WORDS.test(customerName)
  ) {
    return {
      reliable: false,
      normalizedCustomerName: null,
    };
  }

  /*
   * Der Parser muss den Firmennamen isolieren.
   * Firmenname plus vollständige Adresse gilt nicht als sicher.
   */
  if (
    /\b\d{5}\b/.test(customerName) ||
    ADDRESS_WORDS.test(customerName) ||
    customerName.includes("|")
  ) {
    return {
      reliable: false,
      normalizedCustomerName: null,
    };
  }

  /*
   * Komma-Listen sind häufig Zutaten oder Fließtext.
   */
  if ((customerName.match(/,/g) || []).length >= 2) {
    return {
      reliable: false,
      normalizedCustomerName: null,
    };
  }

  const escapedCustomerName = customerName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const explicitlyConfirmedInSource =
    new RegExp(
      "\\bDer Kunde\\s+" +
        escapedCustomerName +
        "\\s+hat\\s+(?:Dein|Ihr|das)\\s+Angebot\\s+gebucht\\b",
      "i"
    ).test(String(sourceText || ""));

  if (
    !COMPANY_SUFFIX.test(customerName) &&
    !explicitlyConfirmedInSource
  ) {
    return {
      reliable: false,
      normalizedCustomerName: null,
    };
  }

  return {
    reliable: true,
    normalizedCustomerName: customerName,
  };
}

function resolveDocumentType(
  input: ImportAnalysisInput
): ImportDocumentType {
  const subject = normalizeText(input.subject);
  const text = normalizeText(input.sourceText);
  const combined = `${subject}\n${text}`;

  if (
    /\b(fast track order bestätigt|fast track order bestaetigt|auftrag bestätigt|auftrag bestaetigt|bestellung bestätigt|bestellung bestaetigt)\b/i.test(
      subject
    )
  ) {
    return "ORDER_CONFIRMATION";
  }

  if (
    /\b(passwort|kennwort|password|login|konto bestätigen|konto bestaetigen)\b/i.test(
      combined
    )
  ) {
    return "TRASH";
  }

  if (
    /\b(ungelesene nachrichten|neue nachricht im account|chat-benachrichtigung)\b/i.test(
      subject
    )
  ) {
    return "CHAT_NOTIFICATION";
  }

  if (
    /\b(absage|storniert|stornierung|nicht angenommen|anderes angebot entschieden)\b/i.test(
      combined
    )
  ) {
    return "CANCELLATION";
  }

  if (
    /\b(bestelldetails wurden geändert|bestelldetails wurden geaendert|auftrag geändert|auftrag geaendert|bestelländerung|bestellaenderung)\b/i.test(
      subject
    )
  ) {
    return "ORDER_CHANGE";
  }

  if (
    /\b(dein morgiges|morgen.*catering|erinnerung.*lieferung)\b/i.test(
      subject
    )
  ) {
    return "REMINDER";
  }

  if (
    /\b(menü erhalten|menue erhalten|vielen dank für das menü|vielen dank fuer das menue)\b/i.test(
      subject
    )
  ) {
    return "TRASH";
  }

  if (
    /\b(neue anfrage|bitte.*angebot|angebot freigeben|schickt uns euer angebot|catering-anfrage)\b/i.test(
      subject
    )
  ) {
    return "INQUIRY";
  }



  return input.documentType;
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
  const documentType = resolveDocumentType(input);

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

  const customerValidation =
    validateCustomerName(
      order?.customerName,
      input.sourceText
    );

  const customerReliable =
    customerValidation.reliable;

  if (!customerReliable) {
    issues.push({
      code: "CUSTOMER_NOT_RELIABLE",
      severity: "ERROR",
      field: "customerName",
      message:
        "Kein eindeutig isolierter und belastbarer Firmenkunde erkannt.",
    });
  } else {
    evidence.push({
      field: "customerName",
      value:
        customerValidation.normalizedCustomerName ||
        "",
      source: "parser",
      confidence: 0.85,
      evidence:
        "Isolierter Firmenname mit eindeutiger Rechtsform.",
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
    documentType === "ORDER_CONFIRMATION";

  if (!isOrderDocument) {
    issues.push({
      code: "NOT_CONFIRMED_ORDER",
      severity:
        documentType === "INQUIRY" ||
        documentType === "ORDER_CHANGE"
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

  const rejectedDocumentTypes =
    new Set<ImportDocumentType>([
      "TRASH",
      "INVOICE",
      "CREDIT_NOTE",
      "DELIVERY_NOTE",
      "REMINDER",
      "CHAT_NOTIFICATION",
      "CANCELLATION",
    ]);

  const hasErrors =
    issues.some((issue) => issue.severity === "ERROR");

  const decision: ImportDecision =
    rejectedDocumentTypes.has(documentType)
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
    documentType,
    customerReliable,
    normalizedCustomerName:
      customerValidation.normalizedCustomerName,
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

export function canCreateReviewOrderFromAnalysis(
  analysis: ImportAnalysis
) {
  /*
   * Gastario erstellt automatisch nur einen Prüfauftrag,
   * wenn das Dokument eindeutig eine Auftragsbestätigung ist
   * und alle operativ notwendigen Kerndaten belastbar sind.
   *
   * AUTO_ACCEPT bleibt weiterhin vollständig deaktiviert.
   */
  const hasUsableOrderValue =
    (
      analysis.selectedOrderTotalCents !== null &&
      analysis.selectedOrderTotalCents > 0
    ) ||
    analysis.calculatedItemsTotalCents > 0;

  return (
    analysis.decision !== "REJECT" &&
    analysis.documentType === "ORDER_CONFIRMATION" &&
    analysis.customerReliable &&
    analysis.itemsReliable &&
    analysis.deliveryReliable &&
    hasUsableOrderValue
  );
}
