const fs = require("fs");

const path = "app/routes/api.email-import.run.tsx";
let content = fs.readFileSync(path, "utf8");

const helper = `
function normalizeImportText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");
}

function getHeycaterOrderNumber(...values: unknown[]) {
  const text = values.map((value) => String(value || "")).join("\\n");
  const match = text.match(/\\b(20[0-9]{2}-[0-9]{5,})\\b/);
  return match?.[1] || "";
}

function getHeycaterEmailKind(subject: string, text: string) {
  const combined = normalizeImportText(subject + "\\n" + text);

  const isDeliveryNote =
    combined.includes("delivery note") ||
    combined.includes("lieferschein") ||
    combined.includes("dein morgiges catering") ||
    combined.includes("dein morgiges heykantine");

  const isConfirmation =
    combined.includes("partner event confirmation") ||
    combined.includes("fast track order bestatigt") ||
    combined.includes("fast track order bestaetigt") ||
    combined.includes("order bestatigt") ||
    combined.includes("order bestaetigt") ||
    combined.includes("auftragsbestatigung") ||
    combined.includes("auftragsbestaetigung") ||
    combined.includes("auftrag bestatigt") ||
    combined.includes("auftrag bestaetigt");

  return {
    isDeliveryNote,
    isConfirmation,
  };
}

async function findExistingHeycaterOrderByExternalNumber(tenantId: string, heycaterOrderNumber: string) {
  if (!heycaterOrderNumber) {
    return null;
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    \`
      SELECT o.id, o."orderNumber", o.status
      FROM "Order" o
      LEFT JOIN "IncomingEmail" e ON e.id = o."incomingEmailId"
      WHERE o."tenantId" = $1
        AND o.source = 'HEYCATER'
        AND (
          e.subject ILIKE $2
          OR o.notes ILIKE $2
          OR o."reviewReason" ILIKE $2
        )
      ORDER BY o."createdAt" ASC
      LIMIT 1
    \`,
    tenantId,
    "%" + heycaterOrderNumber + "%"
  );

  return rows[0] || null;
}

function getEmailImportDecision(params: {
  subject: string;
  bestText: string;
  extractedOrder: any;
  existingHeycaterOrder: any;
}) {
  const { subject, bestText, extractedOrder, existingHeycaterOrder } = params;
  const heycaterOrderNumber = getHeycaterOrderNumber(subject, bestText);
  const kind = getHeycaterEmailKind(subject, bestText);

  if (heycaterOrderNumber && kind.isDeliveryNote) {
    return {
      shouldCreateOrder: false,
      heycaterOrderNumber,
      reason: existingHeycaterOrder
        ? "Heycater-Lieferschein erkannt. Kein neuer Auftrag erstellt, weil die Heycater-Auftragsnummer bereits vorhanden ist."
        : "Heycater-Lieferschein erkannt. Kein automatischer Auftrag erstellt, weil Lieferscheine keine Preise enthalten. Bitte Auftragsbestaetigung importieren oder manuell pruefen.",
    };
  }

  if (heycaterOrderNumber && existingHeycaterOrder) {
    return {
      shouldCreateOrder: false,
      heycaterOrderNumber,
      reason: "Heycater-Auftragsnummer bereits vorhanden. Keine Dublette erstellt.",
    };
  }

  return {
    shouldCreateOrder: hasEnoughOrderData(extractedOrder),
    heycaterOrderNumber,
    reason: "",
  };
}

`;

if (!content.includes("function getHeycaterOrderNumber(")) {
  content = content.replace("async function extractPdfText(buffer: Buffer) {", helper + "\nasync function extractPdfText(buffer: Buffer) {");
}

content = content.replace(
`      notes:
        "Automatisch aus E-Mail erkannt. Eventdatum: " +
        String(extractedOrder.eventDate || "-") +
        ", Eventbeginn: " +
        String(extractedOrder.eventStart || "-"),`,
`      notes:
        "Automatisch aus E-Mail erkannt. Heycater-Auftrag: " +
        String(extractedOrder.heycaterOrderNumber || "-") +
        ". Eventdatum: " +
        String(extractedOrder.eventDate || "-") +
        ", Eventbeginn: " +
        String(extractedOrder.eventStart || "-"),`
);

content = content.replace(
`            const extractedOrder = extractHeycaterOrder(bestText);

            if (existing.orders.length === 0 && hasEnoughOrderData(extractedOrder)) {`,
`            const extractedOrder = extractHeycaterOrder(bestText);
            const heycaterOrderNumber = getHeycaterOrderNumber(String(parsed.subject || existing.subject || ""), bestText);
            const existingHeycaterOrder = heycaterOrderNumber
              ? await findExistingHeycaterOrderByExternalNumber(account.tenantId, heycaterOrderNumber)
              : null;
            const importDecision = getEmailImportDecision({
              subject: String(parsed.subject || existing.subject || ""),
              bestText,
              extractedOrder,
              existingHeycaterOrder,
            });

            (extractedOrder as any).heycaterOrderNumber = importDecision.heycaterOrderNumber;

            if (existing.orders.length === 0 && importDecision.shouldCreateOrder) {`
);

content = content.replace(
`                  errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",`,
`                  errorMessage: importDecision.reason || "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",`
);

content = content.replace(
`          const extractedOrder = extractHeycaterOrder(bestText);

          if (hasEnoughOrderData(extractedOrder)) {`,
`          const extractedOrder = extractHeycaterOrder(bestText);
          const heycaterOrderNumber = getHeycaterOrderNumber(String(parsed.subject || ""), bestText);
          const existingHeycaterOrder = heycaterOrderNumber
            ? await findExistingHeycaterOrderByExternalNumber(account.tenantId, heycaterOrderNumber)
            : null;
          const importDecision = getEmailImportDecision({
            subject: String(parsed.subject || ""),
            bestText,
            extractedOrder,
            existingHeycaterOrder,
          });

          (extractedOrder as any).heycaterOrderNumber = importDecision.heycaterOrderNumber;

          if (importDecision.shouldCreateOrder) {`
);

content = content.replace(
`                errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",`,
`                errorMessage: importDecision.reason || "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Import-Entscheidung gepatcht.");
