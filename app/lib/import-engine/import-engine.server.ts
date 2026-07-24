import {
  classifyImportDocument,
} from "./document-classifier";

import {
  calculateItemsTotal,
  resolveOrderTotal,
} from "./money-resolver";

import type {
  ExistingImportOrder,
  ImportEngineResult,
  ImportIssue,
  UniversalImportDraft,
} from "./types";

function clean(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExternalOrderNumber(
  draft: UniversalImportDraft
) {
  const direct = clean(
    draft.externalOrderNumber
  );

  if (direct) {
    return direct;
  }

  const combined = [
    draft.subject,
    draft.bodyText,
    draft.documentText,
  ].join("\n");

  return (
    combined.match(
      /\b20\d{2}-\d{5,}\b/
    )?.[0] || null
  );
}

function findExistingOrder(
  externalOrderNumber: string | null,
  existingOrders: ExistingImportOrder[]
) {
  if (!externalOrderNumber) {
    return null;
  }

  return (
    existingOrders.find(
      (order) =>
        clean(
          order.externalOrderNumber
        ) === externalOrderNumber ||
        clean(
          order.platformReference
        ) === externalOrderNumber
    ) || null
  );
}

export function runImportEngine(input: {
  draft: UniversalImportDraft;
  existingOrders?: ExistingImportOrder[];
}): ImportEngineResult {
  const existingOrders =
    input.existingOrders || [];

  const normalizedDraft: UniversalImportDraft = {
    ...input.draft,
    externalOrderNumber:
      clean(
        input.draft.externalOrderNumber
      ) || undefined,
    customerName:
      clean(input.draft.customerName) ||
      undefined,
    deliveryDate:
      clean(input.draft.deliveryDate) ||
      undefined,
    deliveryTime:
      clean(input.draft.deliveryTime) ||
      undefined,
    deliveryAddress:
      clean(
        input.draft.deliveryAddress
      ) || undefined,
    items: Array.isArray(
      input.draft.items
    )
      ? input.draft.items
          .map((item) => ({
            ...item,
            name: clean(item.name),
            description:
              clean(item.description) ||
              undefined,
            quantity: Math.max(
              0,
              Math.round(
                Number(item.quantity || 0)
              )
            ),
            unitCents: Math.max(
              0,
              Math.round(
                Number(item.unitCents || 0)
              )
            ),
            totalCents: Math.max(
              0,
              Math.round(
                Number(item.totalCents || 0)
              )
            ),
          }))
          .filter(
            (item) =>
              item.name &&
              item.quantity > 0
          )
      : [],
  };

  const documentType =
    classifyImportDocument({
      subject: normalizedDraft.subject,
      bodyText:
        normalizedDraft.bodyText,
      documentText:
        normalizedDraft.documentText,
    });

  const externalOrderNumber =
    extractExternalOrderNumber(
      normalizedDraft
    );

  const customerName =
    clean(normalizedDraft.customerName) ||
    null;

  const calculatedItemsTotalCents =
    calculateItemsTotal(
      normalizedDraft.items
    );

  const totalResolution =
    resolveOrderTotal({
      calculatedItemsTotalCents,
      documentNetTotalCents:
        normalizedDraft.netTotalCents,
    });

  const matchingExistingOrder =
    findExistingOrder(
      externalOrderNumber,
      existingOrders
    );

  const issues: ImportIssue[] = [];
  let confidence = 1;

  if (!externalOrderNumber) {
    confidence -= 0.2;

    issues.push({
      code: "EXTERNAL_NUMBER_MISSING",
      severity: "WARNING",
      field: "externalOrderNumber",
      message:
        "Keine eindeutige externe Auftragsnummer erkannt.",
    });
  }

  if (!customerName) {
    confidence -= 0.25;

    issues.push({
      code: "CUSTOMER_MISSING",
      severity: "WARNING",
      field: "customerName",
      message:
        "Kein eindeutiger Kunde erkannt.",
    });
  }

  if (!normalizedDraft.deliveryDate) {
    confidence -= 0.2;

    issues.push({
      code: "DELIVERY_DATE_MISSING",
      severity: "WARNING",
      field: "deliveryDate",
      message:
        "Kein Lieferdatum erkannt.",
    });
  }

  if (
    normalizedDraft.items.length === 0
  ) {
    confidence -= 0.35;

    issues.push({
      code: "ITEMS_MISSING",
      severity: "ERROR",
      field: "items",
      message:
        "Keine verwertbaren Positionen erkannt.",
    });
  }

  if (
    normalizedDraft.netTotalCents &&
    calculatedItemsTotalCents > 0 &&
    !totalResolution.consistent
  ) {
    confidence -= 0.15;

    issues.push({
      code: "TOTAL_MISMATCH",
      severity: "WARNING",
      field: "totalCents",
      message:
        "Dokumentensumme und Positionssumme stimmen nicht überein. Der Vorgang wird zur Prüfung angelegt.",
    });
  }

  let action:
    ImportEngineResult["action"];

  if (
    documentType === "IRRELEVANT" ||
    documentType === "REMINDER" ||
    documentType === "DELIVERY_NOTE"
  ) {
    action = "IGNORE";
  } else if (
    documentType === "CANCELLATION"
  ) {
    action = matchingExistingOrder
      ? "CANCEL_EXISTING"
      : "MANUAL_REVIEW";
  } else if (
    documentType === "ORDER_CHANGE"
  ) {
    action = matchingExistingOrder
      ? "UPDATE_EXISTING"
      : "MANUAL_REVIEW";
  } else if (
    documentType ===
    "ORDER_CONFIRMATION"
  ) {
    if (matchingExistingOrder) {
      action = "UPDATE_EXISTING";
    } else if (
      normalizedDraft.items.length > 0 &&
      normalizedDraft.deliveryDate &&
      calculatedItemsTotalCents > 0
    ) {
      action =
        issues.length === 0
          ? "CREATE_ORDER"
          : "CREATE_REVIEW";
    } else {
      action = "CREATE_REVIEW";
    }
  } else if (
    documentType === "INQUIRY"
  ) {
    action = "MANUAL_REVIEW";
  } else {
    action = "MANUAL_REVIEW";
  }

  return {
    documentType,
    action,
    externalOrderNumber,
    customerName,
    calculatedItemsTotalCents,
    selectedOrderTotalCents:
      totalResolution
        .selectedOrderTotalCents,
    selectedTotalSource:
      totalResolution
        .selectedTotalSource,
    confidence: Math.max(
      0,
      Math.min(1, confidence)
    ),
    issues,
    evidence: [
      {
        field: "documentType",
        value: documentType,
        source: "SUBJECT",
        confidence:
          documentType === "UNKNOWN"
            ? 0.3
            : 0.9,
        explanation:
          "Dokumenttyp aus Betreff und Dokumentinhalt bestimmt.",
      },
      {
        field: "totalCents",
        value:
          totalResolution
            .selectedOrderTotalCents,
        source: "CALCULATION",
        confidence:
          totalResolution.consistent
            ? 0.95
            : 0.5,
        explanation:
          "Gesamtwert mathematisch aus Positionen und Dokumentensumme validiert.",
      },
    ],
    normalizedDraft,
    matchingExistingOrder,
  };
}