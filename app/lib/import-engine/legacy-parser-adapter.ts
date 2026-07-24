import {
  extractUniversalOrder,
} from "../order-import-extract.server";

import {
  resolveMoneyRow,
} from "./money-resolver";

import {
  runImportEngine,
} from "./import-engine.server";

import type {
  ExistingImportOrder,
  ImportEngineResult,
  UniversalImportDraft,
  UniversalImportItem,
} from "./types";

function clean(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(parsed)
  );
}

function extractExternalOrderNumber(input: {
  subject?: string;
  bodyText?: string;
  documentText?: string;
}) {
  const combined = [
    input.subject,
    input.bodyText,
    input.documentText,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    combined.match(
      /\b20\d{2}-\d{5,}\b/
    )?.[0] || undefined
  );
}

function normalizeImportedItem(
  item: any
): UniversalImportItem | null {
  const name = clean(item?.name);
  const description =
    clean(item?.description) ||
    undefined;

  if (!name) {
    return null;
  }

  const quantity = Math.max(
    1,
    positiveInteger(item?.quantity) || 1
  );

  const importedUnitCents =
    positiveInteger(item?.unitCents);

  const importedTotalCents =
    positiveInteger(item?.totalCents);

  const candidates = [];

  if (importedUnitCents > 0) {
    candidates.push({
      cents: importedUnitCents,
      source: "LEGACY_UNIT_PRICE",
    });
  }

  if (
    importedTotalCents > 0 &&
    quantity > 0
  ) {
    const inferredUnitCents =
      Math.round(
        importedTotalCents / quantity
      );

    candidates.push({
      cents: inferredUnitCents,
      source:
        "INFERRED_FROM_LEGACY_ROW_TOTAL",
    });
  }

  const resolution = resolveMoneyRow({
    quantity,
    unitCandidates: candidates,
    statedTotalCents:
      importedTotalCents || null,
  });

  const unitCents =
    resolution?.unitCents ||
    importedUnitCents ||
    (
      importedTotalCents > 0
        ? Math.round(
            importedTotalCents / quantity
          )
        : 0
    );

  const totalCents =
    resolution?.totalCents ||
    importedTotalCents ||
    quantity * unitCents;

  return {
    name,
    description,
    quantity,
    unit:
      clean(item?.unit) ||
      undefined,
    unitCents,
    totalCents,
    rawText:
      clean(item?.rawLine) ||
      undefined,
    confidence:
      resolution?.exact
        ? 0.98
        : unitCents > 0 &&
            totalCents > 0
          ? 0.75
          : 0.4,
  };
}

export function convertLegacyExtractedOrderToDraft(
  input: {
    subject?: string;
    sender?: string;
    bodyText?: string;
    documentText?: string;
    sourceName?: string;
  },
  extractedOrder: ReturnType<
    typeof extractUniversalOrder
  >
): UniversalImportDraft {
  const items = Array.isArray(
    extractedOrder?.items
  )
    ? extractedOrder.items
        .map(normalizeImportedItem)
        .filter(
          (
            item
          ): item is UniversalImportItem =>
            Boolean(item)
        )
    : [];

  return {
    sourceChannel: "EMAIL",
    sourceName:
      clean(input.sourceName) ||
      clean(extractedOrder?.source) ||
      "EMAIL",

    sender:
      clean(input.sender) ||
      undefined,

    subject:
      clean(input.subject) ||
      undefined,

    bodyText:
      input.bodyText || undefined,

    documentText:
      input.documentText || undefined,

    externalOrderNumber:
      extractExternalOrderNumber({
        subject: input.subject,
        bodyText: input.bodyText,
        documentText:
          input.documentText,
      }),

    customerName:
      clean(
        extractedOrder?.customerName
      ) || undefined,

    contactName:
      clean(
        extractedOrder?.contactName
      ) || undefined,

    contactPhone:
      clean(
        extractedOrder?.contactPhone
      ) || undefined,

    deliveryDate:
      clean(
        extractedOrder?.deliveryDate ||
          extractedOrder?.eventDate
      ) || undefined,

    deliveryTime:
      clean(
        extractedOrder?.deliveryTime ||
          extractedOrder?.eventStart
      ) || undefined,

    deliveryAddress:
      clean(
        extractedOrder?.deliveryAddress
      ) || undefined,

    netTotalCents:
      positiveInteger(
        extractedOrder
          ?.pdfNetTotalCents
      ) || null,

    taxTotalCents:
      positiveInteger(
        extractedOrder
          ?.pdfTaxTotalCents
      ) || null,

    grossTotalCents:
      positiveInteger(
        extractedOrder
          ?.pdfGrossTotalCents
      ) || null,

    items,
  };
}

export function extractAndAnalyzeImport(input: {
  subject?: string;
  sender?: string;
  bodyText?: string;
  documentText?: string;
  sourceName?: string;
  existingOrders?: ExistingImportOrder[];
}): ImportEngineResult {
  const bestText = [
    input.bodyText,
    input.documentText,
  ]
    .filter(Boolean)
    .join("\n\n");

  const extractedOrder =
    extractUniversalOrder(bestText);

  const draft =
    convertLegacyExtractedOrderToDraft(
      input,
      extractedOrder
    );

  return runImportEngine({
    draft,
    existingOrders:
      input.existingOrders || [],
  });
}