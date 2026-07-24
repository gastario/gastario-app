export type ImportDocumentType =
  | "ORDER_CONFIRMATION"
  | "ORDER_CHANGE"
  | "CANCELLATION"
  | "INQUIRY"
  | "DELIVERY_NOTE"
  | "REMINDER"
  | "IRRELEVANT"
  | "UNKNOWN";

export type ImportEngineAction =
  | "CREATE_ORDER"
  | "CREATE_REVIEW"
  | "UPDATE_EXISTING"
  | "CANCEL_EXISTING"
  | "MANUAL_REVIEW"
  | "IGNORE";

export type ImportIssueSeverity =
  | "INFO"
  | "WARNING"
  | "ERROR";

export type ImportIssue = {
  code: string;
  severity: ImportIssueSeverity;
  field?: string;
  message: string;
};

export type ImportEvidence = {
  field: string;
  value: string | number | null;
  source:
    | "SUBJECT"
    | "BODY"
    | "DOCUMENT"
    | "TABLE"
    | "CALCULATION"
    | "FALLBACK";
  confidence: number;
  explanation: string;
};

export type UniversalImportItem = {
  name: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitCents: number;
  totalCents: number;
  rawText?: string;
  confidence?: number;
};

export type UniversalImportDraft = {
  sourceChannel:
    | "EMAIL"
    | "UPLOAD"
    | "API";

  sourceName?: string;
  sender?: string;
  subject?: string;
  bodyText?: string;
  documentText?: string;

  externalOrderNumber?: string;
  customerName?: string;
  contactName?: string;
  contactPhone?: string;

  deliveryDate?: string;
  deliveryTime?: string;
  deliveryAddress?: string;

  netTotalCents?: number | null;
  taxTotalCents?: number | null;
  grossTotalCents?: number | null;

  items: UniversalImportItem[];
};

export type ExistingImportOrder = {
  id: string;
  externalOrderNumber?: string | null;
  platformReference?: string | null;
  status?: string;
};

export type ImportEngineResult = {
  documentType: ImportDocumentType;
  action: ImportEngineAction;

  externalOrderNumber: string | null;
  customerName: string | null;

  calculatedItemsTotalCents: number;
  selectedOrderTotalCents: number | null;
  selectedTotalSource:
    | "DOCUMENT_NET"
    | "ITEM_SUM"
    | null;

  confidence: number;
  issues: ImportIssue[];
  evidence: ImportEvidence[];

  normalizedDraft: UniversalImportDraft;
  matchingExistingOrder:
    | ExistingImportOrder
    | null;
};