const fs = require("fs");

const path = "app/routes/api.email-import.run.tsx";
let content = fs.readFileSync(path, "utf8");

const helper = `
function parseImportMoneyToCents(value: unknown) {
  const raw = String(value || "")
    .replace(/[€\\s]/g, "")
    .replace(/\\./g, "")
    .replace(",", ".");

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

function extractHeycaterPdfNetCents(text: string) {
  const match = String(text || "").match(/Gesamtbetrag\\s+Netto\\s+€\\s*([0-9]+(?:[.,][0-9]+)?)/i);
  return match ? parseImportMoneyToCents(match[1]) : 0;
}

function getItemsWithHeycaterSumCorrection(extractedOrder: any, bestText: string) {
  const baseItems = Array.isArray(extractedOrder?.items) ? extractedOrder.items : [];
  const source = String(extractedOrder?.source || "").toLowerCase();
  const pdfNetCents = extractHeycaterPdfNetCents(bestText);

  const itemTotalCents = baseItems.reduce((sum: number, item: any) => {
    return sum + Number(item?.totalCents || 0);
  }, 0);

  const differenceCents = pdfNetCents - itemTotalCents;

  if (
    source === "heycater" &&
    pdfNetCents > 0 &&
    itemTotalCents > 0 &&
    differenceCents > 2
  ) {
    return [
      ...baseItems,
      {
        name: "Fehlende Position(en) laut Heycater-PDF",
        quantity: 1,
        unitCents: differenceCents,
        totalCents: differenceCents,
        description:
          "Automatische Kontrollposition, damit die Summe mit dem Gesamtbetrag Netto aus der Heycater-PDF uebereinstimmt.",
        rawLine:
          "Heycater Gesamtbetrag Netto: " +
          (pdfNetCents / 100).toFixed(2) +
          " EUR | erkannte Positionen: " +
          (itemTotalCents / 100).toFixed(2) +
          " EUR | Differenz: " +
          (differenceCents / 100).toFixed(2) +
          " EUR",
      },
    ];
  }

  return baseItems;
}
`;

if (!content.includes("function parseImportMoneyToCents")) {
  content = content.replace(
    "\nasync function findExistingHeycaterOrderByExternalNumber",
    helper + "\nasync function findExistingHeycaterOrderByExternalNumber"
  );
}

content = content.replace(
`async function createReviewOrderFromExtracted(params: {
  tenantId: string;
  brandId?: string | null;
  incomingEmailId: string;
  extractedOrder: any;
}) {
  const { tenantId, brandId, incomingEmailId, extractedOrder } = params;`,
`async function createReviewOrderFromExtracted(params: {
  tenantId: string;
  brandId?: string | null;
  incomingEmailId: string;
  extractedOrder: any;
  bestText?: string;
}) {
  const { tenantId, brandId, incomingEmailId, extractedOrder, bestText = "" } = params;
  const itemsForCreate = getItemsWithHeycaterSumCorrection(extractedOrder, bestText);`
);

content = content.replace(
`items: {
        create: Array.isArray(extractedOrder.items)
          ? extractedOrder.items.map((item: any) => ({              name: String(item.name || "Position"),
              quantity: Number(item.quantity || 1),
              unit: "Stueck",
              unitCents: Number(item.unitCents || 0),
              totalCents: Number(item.totalCents || 0),
              notes: [item.description, item.rawLine].filter(Boolean).join(" | ") || null,
            }))
          : [],
      },`,
`items: {
        create: itemsForCreate.map((item: any) => ({
          name: String(item.name || "Position"),
          quantity: Number(item.quantity || 1),
          unit: "Stueck",
          unitCents: Number(item.unitCents || 0),
          totalCents: Number(item.totalCents || 0),
          notes: [item.description, item.rawLine].filter(Boolean).join(" | ") || null,
        })),
      },`
);

content = content.replaceAll(
`extractedOrder,
              });`,
`extractedOrder,
                bestText,
              });`
);

content = content.replaceAll(
`extractedOrder,
            });`,
`extractedOrder,
              bestText,
            });`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater-Summenkorrektur im Import gepatcht.");
