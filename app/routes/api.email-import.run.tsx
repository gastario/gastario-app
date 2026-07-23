import crypto from "node:crypto";
import { createRequire } from "node:module";
import { simpleParser } from "mailparser";
import { prisma } from "../lib/prisma.server";
import { extractUniversalOrder } from "../lib/order-import-extract.server";
import {
  analyzeImportedOrder,
  canCreateReviewOrderFromAnalysis,
} from "../lib/import-analysis.server";
import {
  classifyIncomingMailWithAi,
  classifyIncomingMailWithRules,
} from "../lib/ai-import-classifier.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function decryptSecret(value: string) {
  const keyValue = process.env.IMAP_ENCRYPTION_KEY || "";

  if (!keyValue) {
    throw new Error("IMAP_ENCRYPTION_KEY fehlt.");
  }

  const [ivValue, tagValue, encryptedValue] = value.split(".");
  const key = Buffer.from(keyValue, "base64");
  const iv = Buffer.from(ivValue, "base64");
  const tag = Buffer.from(tagValue, "base64");
  const encrypted = Buffer.from(encryptedValue, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

function parseGermanDate(value: string) {
  const match = String(value || "").match(/^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/);

  if (!match) return null;

  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function createOrderNumber() {
  const now = new Date();
  const datePart =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  return "MAIL-" + datePart + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function isPlausibleImportedCustomerName(
  value: unknown,
  items: any[] = []
) {
  const name = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = normalizeImportText(name);

  if (!name || name.length < 3 || name.length > 120) {
    return false;
  }

  const blockedExactValues = new Set([
    "e-mail import",
    "email import",
    "heycater",
    "hey cater",
    "kunde unbekannt",
    "unbekannt",
    "auftrag",
    "bestellung",
    "catering",
    "lieferung",
    "lieferung und abholung",
    "fehlende position",
  ]);

  if (blockedExactValues.has(normalized)) {
    return false;
  }

  if (/^\d+\s*[x×]\s+/i.test(name)) {
    return false;
  }

  if (/^\d+[.,]?\d*\s*(stück|stueck|portionen?|personen?|pax)\b/i.test(name)) {
    return false;
  }

  const foodWords = [
    "salat",
    "bowl",
    "bagel",
    "sesambagel",
    "pizza",
    "wrap",
    "lasagne",
    "curry",
    "halloumi",
    "käse",
    "kaese",
    "hähnchen",
    "haehnchen",
    "chicken",
    "beef",
    "falafel",
    "croissant",
    "schnitte",
    "mousse",
    "frühstücksbuffet",
    "fruehstuecksbuffet",
    "lieferkosten",
    "abholung",
    "gegrillt",
    "vegan",
    "vegetarisch",
  ];

  const looksLikeFood =
    foodWords.some((word) =>
      normalized.includes(
        normalizeImportText(word)
      )
    );

  const matchesImportedItem = (items || []).some(
    (item: any) => {
      const itemName = normalizeImportText(
        item?.name || ""
      );

      if (!itemName) {
        return false;
      }

      return (
        itemName === normalized ||
        itemName.includes(normalized) ||
        normalized.includes(itemName)
      );
    }
  );

  if (looksLikeFood || matchesImportedItem) {
    return false;
  }

  const hasCompanySuffix =
    /\b(gmbh|ug|ag|kg|gbr|se|e\.?\s*v\.?|mbh|ltd|limited|inc|corp|corporation|company|group|holding)\b/i.test(
      name
    );

  const hasBusinessWord =
    /\b(deutschland|berlin|services?|solutions?|systems?|technologies?|consulting|consultants?|studios?|media|logistik|logistics|immobilien|versicherung|bank|hotel|academy|university|universität|klinikum|stiftung)\b/i.test(
      name
    );

  const looksLikePersonName =
    /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){1,3}$/.test(
      name
    );

  return Boolean(
    hasCompanySuffix ||
    hasBusinessWord ||
    looksLikePersonName
  );
}
function hasEnoughOrderData(order: any) {
  if (!order) return false;

  const items = Array.isArray(order.items) ? order.items : [];
  const realItems = items.filter((item: any) => {
    const name = String(item?.name || "").trim().toLowerCase();
    const totalCents = Number(item?.totalCents || 0);
    const quantity = Number(item?.quantity || 0);

    if (!name) return false;
    if (name.includes("lieferkosten")) return false;
    if (name.includes("lieferung")) return false;
    if (name.includes("summe")) return false;
    if (name.includes("netto")) return false;
    if (name.includes("brutto")) return false;
    if (name.includes("rabatt")) return false;
    if (name.includes("gutschein")) return false;

    return quantity > 0 && totalCents > 0;
  });

  const customerName = String(order.customerName || "").trim();
  const deliveryAddress = String(order.deliveryAddress || "").trim();
  const deliveryDate = String(order.deliveryDate || "").trim();
  const deliveryTime = String(order.deliveryTime || "").trim();

  const hasRealCustomer =
    isPlausibleImportedCustomerName(
      customerName,
      realItems
    );

  const totalCents = realItems.reduce((sum: number, item: any) => {
    return sum + Number(item?.totalCents || 0);
  }, 0);

  return Boolean(
    hasRealCustomer &&
    deliveryDate &&
    deliveryTime &&
    deliveryAddress &&
    realItems.length > 0 &&
    totalCents > 0
  );
}



async function ensureOrderImportRuleTableForEmailImport() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "OrderImportRule" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "sourceName" TEXT,
      "fieldKey" TEXT NOT NULL,
      "keywords" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderImportRule_tenantId_idx" ON "OrderImportRule" ("tenantId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderImportRule_fieldKey_idx" ON "OrderImportRule" ("fieldKey");`);
}

function splitImportRuleKeywords(value: unknown) {
  return String(value || "")
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function findOrderImportRuleMatches(params: {
  tenantId: string;
  subject: string;
  sender: string;
  bestText: string;
}) {
  const { tenantId, subject, sender, bestText } = params;

  try {
    await ensureOrderImportRuleTableForEmailImport();

    const rules = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "OrderImportRule"
       WHERE "tenantId" = $1 AND "active" = true
       ORDER BY "fieldKey" ASC`,
      tenantId
    );

    const combined = normalizeImportText(subject + "\n" + sender + "\n" + bestText);

    return rules
      .map((rule) => {
        const sourceName = normalizeImportText(rule.sourceName || "");

        if (sourceName && sourceName !== "allgemein" && !combined.includes(sourceName)) {
          return null;
        }

        const hits = splitImportRuleKeywords(rule.keywords).filter((keyword) =>
          combined.includes(normalizeImportText(keyword))
        );

        if (hits.length === 0) {
          return null;
        }

        return {
          id: rule.id,
          fieldKey: rule.fieldKey,
          sourceName: rule.sourceName || "Allgemein",
          keywords: hits,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("OrderImportRule check failed", error);
    return [];
  }
}

function hasStrongOrderKeyword(bestText: string) {
  const combined = normalizeImportText(bestText);

  return (
    combined.includes("auftragsbest") ||
    combined.includes("auftragsbestatigung") ||
    combined.includes("auftragsbestaetigung") ||
    combined.includes("order confirmation") ||
    combined.includes("event confirmation") ||
    combined.includes("booking confirmation") ||
    combined.includes("catering confirmation") ||
    combined.includes("bestellung bestatigt") ||
    combined.includes("bestellung bestaetigt") ||
    combined.includes("bestellung bestÃƒÂ¤tigt") ||
    combined.includes("auftrag bestatigt") ||
    combined.includes("auftrag bestaetigt") ||
    combined.includes("auftrag bestÃƒÂ¤tigt")
  );
}

function getMeaningfulImportRuleFields(importRuleMatches: any[]) {
  return new Set(
    (importRuleMatches || [])
      .map((match: any) => String(match?.fieldKey || "").trim())
      .filter((fieldKey: string) =>
        [
          "customerName",
          "deliveryDate",
          "deliveryTime",
          "deliveryAddress",
          "items",
          "budget",
          "contactName",
          "contactPhone",
        ].includes(fieldKey)
      )
  );
}

function hasMinimumOrderSignal(extractedOrder: any, bestText: string) {
  const realItems = Array.isArray(extractedOrder?.items)
    ? extractedOrder.items.filter((item: any) => {
        const name = String(item?.name || "").trim();
        const quantity = Number(item?.quantity || 0);
        const totalCents = Number(item?.totalCents || 0);

        return Boolean(name) && (quantity > 0 || totalCents > 0);
      })
    : [];

  const totalCents = Array.isArray(extractedOrder?.items)
    ? extractedOrder.items.reduce((sum: number, item: any) => sum + Number(item?.totalCents || 0), 0)
    : 0;

  return Boolean(
    hasStrongOrderKeyword(bestText) ||
    (
      realItems.length > 0 &&
      (
        extractedOrder?.customerName ||
        extractedOrder?.deliveryDate ||
        extractedOrder?.deliveryAddress ||
        totalCents > 0
      )
    )
  );
}

function shouldCreateOrderFromImportRules(extractedOrder: any, bestText: string, importRuleMatches: any[]) {
  if (hasEnoughOrderData(extractedOrder)) {
    return true;
  }

  const customerName = String(extractedOrder?.customerName || "").trim().toLowerCase();
  const contactName = String(extractedOrder?.contactName || "").trim().toLowerCase();
  const sourceName = String(extractedOrder?.source || extractedOrder?.sourceName || "").trim().toLowerCase();

  const realItems = Array.isArray(extractedOrder?.items)
    ? extractedOrder.items.filter((item: any) => {
        const name = String(item?.name || "").trim().toLowerCase();
        const quantity = Number(item?.quantity || 0);
        const totalCents = Number(item?.totalCents || 0);

        if (!name) return false;
        if (name.includes("fehlende position")) return false;
        if (name.includes("habe ") || name.includes("kosten fÃƒÂ¼r") || name.includes("servicepersonal")) return false;
        if (name.includes("gas or electric grills") || name.includes("onsite")) return false;

        return quantity > 0 || totalCents > 0;
      })
    : [];

  const totalCents = Array.isArray(extractedOrder?.items)
    ? extractedOrder.items.reduce((sum: number, item: any) => sum + Number(item?.totalCents || 0), 0)
    : 0;

  const hasTrashCustomer =
    !customerName ||
    customerName === "e-mail import" ||
    customerName === "email import" ||
    customerName === "kunde unbekannt";

  const hasTrashContact =
    !contactName ||
    contactName === "keine kontaktperson erkannt" ||
    contactName === "kontakt unbekannt";

  const meaningfulFields = getMeaningfulImportRuleFields(importRuleMatches);

  const hasImportRuleMatch =
    importRuleMatches.length > 0 &&
    meaningfulFields.size > 0;

  const hasStrongRuleMatch =
    hasImportRuleMatch &&
    (
      meaningfulFields.has("customerName") ||
      meaningfulFields.has("deliveryDate") ||
      meaningfulFields.has("deliveryTime") ||
      meaningfulFields.has("deliveryAddress") ||
      meaningfulFields.has("items") ||
      meaningfulFields.has("budget") ||
      meaningfulFields.has("contactName") ||
      meaningfulFields.has("orderNumber")
    );

  const normalizedText = normalizeImportText(bestText);
  const hasPlatformOrderSignal =
    normalizedText.includes("egora") ||
    normalizedText.includes("heycater") ||
    normalizedText.includes("hey cater") ||
    normalizedText.includes("feedr") ||
    normalizedText.includes("auftragsbest") ||
    normalizedText.includes("bestellbest") ||
    normalizedText.includes("order confirmation") ||
    normalizedText.includes("booking confirmation");

  const isPureTrash =
    hasTrashCustomer &&
    hasTrashContact &&
    realItems.length === 0 &&
    totalCents <= 0 &&
    !hasPlatformOrderSignal &&
    !hasStrongRuleMatch;

  if (isPureTrash) {
    return false;
  }

  if (hasStrongRuleMatch) {
    return true;
  }

  return Boolean(
    importRuleMatches.length > 0 &&
    (
      hasMinimumOrderSignal(extractedOrder, bestText) ||
      hasStrongOrderKeyword(bestText) ||
      hasPlatformOrderSignal
    )
  );
}

function isHeycaterTomorrowReminder(subject: unknown) {
  const normalizedSubject = String(subject || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return (
    normalizedSubject.includes("dein morgiges catering mit heycater") ||
    normalizedSubject.includes("dein morgiges heykantine! catering mit heycater") ||
    normalizedSubject.includes("dein morgiges heykantine catering mit heycater")
  );
}
function normalizeImportText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getHeycaterOrderNumber(...values: unknown[]) {
  const text = values.map((value) => String(value || "")).join("\n");
  const match = text.match(/\b(20[0-9]{2}-[0-9]{5,})\b/);
  return match?.[1] || "";
}

function getHeycaterEmailKind(subject: string, text: string) {
  const combined = normalizeImportText(subject + "\n" + text);

  const isDeliveryNote =
    combined.includes("delivery note") ||
    combined.includes("lieferschein") ||
    combined.includes("dein morgiges catering") ||
    combined.includes("dein morgiges heykantine") ||
    combined.includes("morgiges catering mit heycater") ||
    combined.includes("morgiges heykantine");

  const isConfirmation =
    combined.includes("partner event confirmation") ||
    combined.includes("event confirmation") ||
    combined.includes("order confirmation") ||
    combined.includes("fast track order bestatigt") ||
    combined.includes("fast track order bestaetigt") ||
    combined.includes("order bestatigt") ||
    combined.includes("order bestaetigt") ||
    combined.includes("auftrag bestatigt") ||
    combined.includes("auftrag bestaetigt") ||
    combined.includes("auftragsbestatigung") ||
    combined.includes("auftragsbestaetigung") ||
    combined.includes("angebotsbestatigung") ||
    combined.includes("angebotsbestaetigung");

  const isRequestOrOffer =
    combined.includes("bitte auftrag bestatigen") ||
    combined.includes("bitte auftrag bestaetigen") ||
    combined.includes("angebot freigeben") ||
    combined.includes("bitte angebot freigeben") ||
    combined.includes("angebot erstellen") ||
    combined.includes("bitte angebot") ||
    combined.includes("anfrage") ||
    combined.includes("angebotsanfrage") ||
    combined.includes("catering anfrage");

  return {
    isDeliveryNote,
    isConfirmation,
    isRequestOrOffer,
  };
}

function parseImportMoneyToCents(value: unknown) {
  const raw = String(value || "")
    .replace(/[Ã¢â€šÂ¬\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

function extractHeycaterPdfNetCents(text: string) {
  const normalized = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ");

  const patterns = [
    /Gesamtbetrag\s+Netto\s*(?:€|EUR)?\s*([0-9][0-9.\s]*[,.][0-9]{2})/i,
    /Nettosumme\s*(?:€|EUR)?\s*([0-9][0-9.\s]*[,.][0-9]{2})/i,
    /Gesamtsumme\s+Netto\s*(?:€|EUR)?\s*([0-9][0-9.\s]*[,.][0-9]{2})/i,
    /Netto(?:betrag)?\s*(?:€|EUR)?\s*([0-9][0-9.\s]*[,.][0-9]{2})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match) {
      const cents = parseImportMoneyToCents(
        match[1]
      );

      if (cents > 0) {
        return cents;
      }
    }
  }

  return 0;
}

function getItemsWithHeycaterSumCorrection(extractedOrder: any, bestText: string) {
  return Array.isArray(extractedOrder?.items) ? extractedOrder.items : [];
}

async function findImportIgnoreRuleMatch(params: {
  tenantId: string;
  subject: string;
  sender: string;
  bestText: string;
}) {
  const subject = normalizeImportText(params.subject);
  const sender = normalizeImportText(params.sender);
  const bestText = normalizeImportText(params.bestText);
  const combined = normalizeImportText(params.subject + "\n" + params.sender + "\n" + params.bestText);

  const rules = await prisma.importIgnoreRule.findMany({
    where: {
      tenantId: params.tenantId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rules.find((rule: any) => {
    const senderContains = normalizeImportText(rule.senderContains || "");
    const subjectContains = normalizeImportText(rule.subjectContains || "");
    const textContains = normalizeImportText(rule.textContains || "");

    const senderMatch = senderContains ? sender.includes(senderContains) || combined.includes(senderContains) : false;
    const subjectMatch = subjectContains ? subject.includes(subjectContains) || combined.includes(subjectContains) : false;
    const textMatch = textContains ? bestText.includes(textContains) || combined.includes(textContains) : false;

    return senderMatch || subjectMatch || textMatch;
  }) || null;
}
async function findExistingHeycaterOrderByExternalNumber(tenantId: string, heycaterOrderNumber: string) {
  const { prisma } = await import("../lib/prisma.server");

  if (!heycaterOrderNumber) {
    return null;
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
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
    `,
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


async function extractPdfText(buffer: Buffer) {
  let parser: any = null;

  try {
    if (!buffer || buffer.length === 0) {
      return {
        text: "",
        error: "PDF_BUFFER_EMPTY",
      };
    }

    const require = createRequire(import.meta.url);
    const pdfParseModule = require("pdf-parse");

    const pagerender = async (pageData: any) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      const items = Array.isArray(textContent?.items) ? textContent.items : [];

      return items
        .map((item: any) => String(item?.str || "").trim())
        .filter(Boolean)
        .join(" ") + "\n\n";
    };

    let result: any = null;

    if (typeof pdfParseModule === "function") {
      result = await pdfParseModule(buffer, { pagerender });
    } else if (typeof pdfParseModule.default === "function") {
      result = await pdfParseModule.default(buffer, { pagerender });
    } else if (typeof pdfParseModule.PDFParse === "function") {
      parser = new pdfParseModule.PDFParse({ data: buffer });
      result = await parser.getText();
    } else {
      return {
        text: "",
        error: "PDF_PARSE_FUNCTION_NOT_FOUND exports=" + Object.keys(pdfParseModule || {}).join(","),
      };
    }

    const text = String(result?.text || "")
      .replace(/\u0000/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      text,
      error: null,
    };
  } catch (error: any) {
    return {
      text: "",
      error: String(error?.message || error),
    };
  } finally {
    if (parser && typeof parser.destroy === "function") {
      await parser.destroy();
    }
  }
}

function normalizeImportedOrderPart(
  value: unknown
) {
  return normalizeImportText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createImportedItemSignature(
  items: any[]
) {
  return (Array.isArray(items) ? items : [])
    .map((item: any) => {
      const name = normalizeImportedOrderPart(
        item?.name || ""
      );

      const quantity = Math.max(
        0,
        Number(item?.quantity || 0)
      );

      return name
        ? quantity + "x:" + name
        : "";
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

function importTotalsArePlausible(
  firstCents: number,
  secondCents: number
) {
  if (
    firstCents <= 0 ||
    secondCents <= 0
  ) {
    return false;
  }

  const difference = Math.abs(
    firstCents - secondCents
  );

  const permittedDifference = Math.max(
    100,
    Math.round(
      Math.max(
        firstCents,
        secondCents
      ) * 0.02
    )
  );

  return difference <= permittedDifference;
}

async function findExistingImportedOrder(
  params: {
    tenantId: string;
    source: "HEYCATER" | "EMAIL";
    externalOrderNumber: string;
    customerName: string;
    deliveryDate: Date | null;
    deliveryTime: string;
    deliveryAddress: string;
    totalCents: number;
    items: any[];
  }
) {
  const {
    tenantId,
    source,
    externalOrderNumber,
    customerName,
    deliveryDate,
    deliveryTime,
    deliveryAddress,
    totalCents,
    items,
  } = params;

  if (externalOrderNumber) {
    const referenceMatch =
      await prisma.order.findFirst({
        where: {
          tenantId,
          OR: [
            {
              externalOrderNumber,
            },
            {
              platformReference:
                externalOrderNumber,
            },
          ],
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      });

    if (referenceMatch) {
      return {
        order: referenceMatch,
        reason:
          "Externe Auftragsnummer bereits vorhanden.",
      };
    }

    if (source === "HEYCATER") {
      const historicalMatch =
        await findExistingHeycaterOrderByExternalNumber(
          tenantId,
          externalOrderNumber
        );

      if (historicalMatch) {
        return {
          order: historicalMatch,
          reason:
            "Heycater-Auftragsnummer bereits vorhanden.",
        };
      }
    }
  }

  if (!deliveryDate) {
    return null;
  }

  const dayStart = new Date(deliveryDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(deliveryDate);
  dayEnd.setHours(23, 59, 59, 999);

  const candidates =
    await prisma.order.findMany({
      where: {
        tenantId,
        source: source as any,
        deliveryDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 100,
    });

  const normalizedCustomer =
    normalizeImportedOrderPart(
      customerName
    );

  const normalizedTime =
    normalizeImportedOrderPart(
      deliveryTime
    );

  const normalizedAddress =
    normalizeImportedOrderPart(
      deliveryAddress
    );

  const itemSignature =
    createImportedItemSignature(items);

  for (const candidate of candidates) {
    const sameCustomer =
      normalizedCustomer &&
      normalizeImportedOrderPart(
        candidate.customerName
      ) === normalizedCustomer;

    const sameTime =
      !normalizedTime ||
      normalizeImportedOrderPart(
        candidate.deliveryTimeText
      ) === normalizedTime;

    const sameAddress =
      normalizedAddress &&
      normalizeImportedOrderPart(
        candidate.deliveryAddress
      ) === normalizedAddress;

    const sameItems =
      itemSignature &&
      createImportedItemSignature(
        candidate.items
      ) === itemSignature;

    const sameTotal =
      importTotalsArePlausible(
        Number(candidate.totalCents || 0),
        totalCents
      );

    if (
      sameCustomer &&
      sameTime &&
      (sameAddress || sameItems) &&
      (
        sameTotal ||
        totalCents <= 0 ||
        Number(candidate.totalCents || 0) <= 0
      )
    ) {
      return {
        order: candidate,
        reason:
          "Gleicher Kunde, Liefertermin und Auftragsinhalt bereits vorhanden.",
      };
    }
  }

  return null;
}

/*
 * gastario-imported-customer-resolution-20260722
 *
 * Ein technischer Prüfplatzhalter darf niemals als echter
 * Kundenname in einem Auftrag gespeichert werden.
 */
function resolveImportedCustomerName(params: {
  extractedOrder: any;
  subject?: string;
}) {
  const { extractedOrder, subject } = params;

  function cleanCandidate(value: unknown) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/^[,;:|/\-–—\s]+/, "")
      .replace(/[,;:|/\-–—\s]+$/, "")
      .trim();
  }

  function isRejectedCandidate(value: unknown) {
    const candidate = cleanCandidate(value);
    const lower = candidate.toLowerCase();

    if (!candidate || candidate.length < 3) {
      return true;
    }

    if (
      [
        "kunde prüfen",
        "kunde pruefen",
        "kunde unbekannt",
        "unbekannter kunde",
        "e-mail import",
        "email import",
        "keine kontaktperson erkannt",
        "kontakt unbekannt",
        "heycater",
        "hey cater",
        "hey group",
        "gastario",
        "edis gastrobetriebe",
      ].includes(lower)
    ) {
      return true;
    }

    if (
      /^(?:auftrag|bestellung|auftragsbestätigung|auftragsbestaetigung|lieferschein|rechnung|angebot|event|catering)$/i.test(
        candidate
      )
    ) {
      return true;
    }

    if (/^\d+$/.test(candidate)) {
      return true;
    }

    if (!/[A-Za-zÄÖÜäöüß]/.test(candidate)) {
      return true;
    }

    return false;
  }

  const extractedCustomerName = cleanCandidate(
    extractedOrder?.customerName
  );

  if (
    !isRejectedCandidate(extractedCustomerName) &&
    isPlausibleImportedCustomerName(
      extractedCustomerName,
      Array.isArray(extractedOrder?.items)
        ? extractedOrder.items
        : []
    )
  ) {
    return {
      customerName: extractedCustomerName,
      source: "document-customer",
    };
  }

  const contactName = cleanCandidate(
    extractedOrder?.contactName
  );

  if (!isRejectedCandidate(contactName)) {
    return {
      customerName: contactName,
      source: "contact-name",
    };
  }

  const deliveryAddress = cleanCandidate(
    extractedOrder?.deliveryAddress
  );

  const deliveryAddressParts = deliveryAddress
    .split(",")
    .map((part) => cleanCandidate(part))
    .filter(Boolean);

  const addressNameCandidate =
    deliveryAddressParts.find((part) => {
      if (isRejectedCandidate(part)) {
        return false;
      }

      if (
        /\b\d{5}\b/.test(part) ||
        /\b(?:straße|strasse|str\.|weg|allee|platz|damm|ufer|chaussee)\b/i.test(
          part
        ) ||
        /\d/.test(part)
      ) {
        return false;
      }

      return part.length >= 3;
    }) || "";

  if (addressNameCandidate) {
    return {
      customerName: addressNameCandidate,
      source: "delivery-address",
    };
  }

  const cleanedSubject = cleanCandidate(subject)
    .replace(/\b20\d{2}-\d{4,}\b/g, " ")
    .replace(
      /\b(?:bitte|auftrag|bestellung|angebot|freigeben|bestätigt|bestaetigt|heycater|catering|event)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  if (
    cleanedSubject.length >= 3 &&
    cleanedSubject.length <= 100 &&
    !isRejectedCandidate(cleanedSubject)
  ) {
    return {
      customerName: cleanedSubject,
      source: "email-subject",
    };
  }

  return {
    customerName: "Unzugeordneter E-Mail-Auftrag",
    source: "unresolved",
  };
}
async function createReviewOrderFromExtracted(
  params: {
    tenantId: string;
    brandId?: string | null;
    incomingEmailId: string;
    extractedOrder: any;
    bestText?: string;
    subject?: string;
  }
) {
  const {
    tenantId,
    brandId,
    incomingEmailId,
    extractedOrder,
    bestText,
    subject,
  } = params;

  const sourceText = String(
    bestText || ""
  );

  const finalItems =
    getItemsWithHeycaterSumCorrection(
      extractedOrder,
      sourceText
    );

  const itemTotalCents =
    finalItems.reduce(
      (sum: number, item: any) => {
        return (
          sum +
          Math.max(
            0,
            Number(
              item?.totalCents || 0
            )
          )
        );
      },
      0
    );

  const pdfNetCents =
    extractHeycaterPdfNetCents(
      sourceText
    );

  const pdfTotalIsPlausible =
    pdfNetCents > 0 &&
    (
      itemTotalCents <= 0 ||
      importTotalsArePlausible(
        pdfNetCents,
        itemTotalCents
      )
    );

  /*
   * Eine erkannte PDF-Nettosumme ist der verbindliche Auftragswert.
   * Die Positionssumme bleibt ausschließlich Kontrollwert.
   */
  const orderTotalCents =
    pdfNetCents > 0
      ? pdfNetCents
      : itemTotalCents;

  const source =
    extractedOrder.source === "Heycater"
      ? "HEYCATER"
      : "EMAIL";

  const externalOrderNumber =
    String(
      extractedOrder.externalOrderNumber ||
      extractedOrder.platformReference ||
      getHeycaterOrderNumber(
        String(subject || ""),
        sourceText
      ) ||
      ""
    ).trim();

  const deliveryDate =
    parseGermanDate(
      extractedOrder.deliveryDate
    );

  const duplicate =
    await findExistingImportedOrder({
      tenantId,
      source,
      externalOrderNumber,
      customerName:
        extractedOrder.customerName || "",
      deliveryDate,
      deliveryTime:
        extractedOrder.deliveryTime || "",
      deliveryAddress:
        extractedOrder.deliveryAddress || "",
      totalCents:
        orderTotalCents,
      items:
        finalItems,
    });

  if (duplicate) {
    return {
      order: duplicate.order,
      created: false,
      duplicateReason:
        duplicate.reason,
    };
  }

  const reviewReasons = [
    "Automatisch aus E-Mail erstellt. Bitte prüfen.",
  ];

  if (
    pdfNetCents > 0 &&
    itemTotalCents > 0 &&
    !pdfTotalIsPlausible
  ) {
    reviewReasons.push(
      "PDF-Nettosumme und Positionssumme weichen ab. Die PDF-Nettosumme wurde als verbindlicher Auftragswert übernommen."
    );
  }

  if (!externalOrderNumber) {
    reviewReasons.push(
      "Keine eindeutige externe Auftragsnummer erkannt."
    );
  }

  const resolvedCustomer =
    resolveImportedCustomerName({
      extractedOrder: {
        ...extractedOrder,
        items: finalItems,
      },
      subject,
    });

  const safeCustomerName =
    resolvedCustomer.customerName;

  if (
    resolvedCustomer.source !==
    "document-customer"
  ) {
    reviewReasons.push(
      resolvedCustomer.source === "contact-name"
        ? "Der Kundenname wurde aus der erkannten Kontaktperson übernommen."
        : resolvedCustomer.source === "delivery-address"
          ? "Der Kundenname wurde aus dem Lieferadressblock übernommen."
          : resolvedCustomer.source === "email-subject"
            ? "Der Kundenname wurde aus dem E-Mail-Betreff übernommen."
            : "Der Auftrag konnte noch keinem eindeutigen Kunden zugeordnet werden."
    );
  }

  const order =
    await prisma.order.create({
      data: {
        tenantId,
        brandId:
          brandId || null,
        incomingEmailId,
        orderNumber:
          createOrderNumber(),
        externalOrderNumber:
          externalOrderNumber || null,
        platformReference:
          externalOrderNumber || null,
        source:
          source as any,
        status:
          "REVIEW_NEEDED",
        customerName:
          safeCustomerName,
        eventName:
          extractedOrder.presentation ||
          null,
        deliveryDate,
        deliveryTimeText:
          extractedOrder.deliveryTime ||
          null,
        deliveryAddress:
          extractedOrder.deliveryAddress ||
          null,
        contactName:
          extractedOrder.contactName ||
          null,
        contactPhone:
          extractedOrder.contactPhone ||
          null,
        notes:
          "Automatisch aus E-Mail erkannt. Eventdatum: " +
          String(
            extractedOrder.eventDate ||
            "-"
          ) +
          ", Eventbeginn: " +
          String(
            extractedOrder.eventStart ||
            "-"
          ),
        platformName:
          extractedOrder.source ||
          "E-Mail",
        confidenceScore:
          pdfTotalIsPlausible
            ? 80
            : 55,
        reviewReason:
          reviewReasons.join(" "),
        totalCents:
          Math.max(
            0,
            orderTotalCents
          ),
        items: {
          create:
            finalItems.length > 0
              ? finalItems.map(
                  (item: any) => ({
                    name: String(
                      item.name ||
                      "Position"
                    ),
                    quantity:
                      Math.max(
                        1,
                        Number(
                          item.quantity ||
                          1
                        )
                      ),
                    unit: String(
                      item.unit ||
                      "Stueck"
                    ),
                    unitCents:
                      Math.max(
                        0,
                        Number(
                          item.unitCents ||
                          0
                        )
                      ),
                    totalCents:
                      Math.max(
                        0,
                        Number(
                          item.totalCents ||
                          0
                        )
                      ),
                    notes:
                      String(
                        item.description ||
                        ""
                      ).trim() || null,
                  })
                )
              : [],
        },
      } as any,
    });

  return {
    order,
    created: true,
    duplicateReason: null,
  };
}

export async function loader({ request }: { request: Request }) {
  const secret = process.env.EMAIL_IMPORT_RUN_SECRET || "";
  const url = new URL(request.url);
  const givenSecret = url.searchParams.get("secret") || "";

  if (secret && givenSecret !== secret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const { ImapFlow } = await import("imapflow");

  const accounts = await prisma.emailAccount.findMany({
    where: {
      active: true,
      mode: "IMAP",
      imapHost: { not: null },
      imapPasswordEncrypted: { not: null },
    },
  });

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const result = {
    ok: true,
    accounts: accounts.length,
    checked: 0,
    savedEmails: 0,
    createdOrders: 0,
    skippedDuplicates: 0,
    pdfAttachments: 0,
    pdfTextExtracted: 0,
    pdfTextEmpty: 0,
    pdfErrors: [] as string[],
    errors: [] as string[],
  };

  const parsedMaxAiCalls = Number(
    process.env.AI_IMPORT_MAX_CALLS_PER_RUN || "3"
  );

  const maxAiCallsPerRun =
    Number.isFinite(parsedMaxAiCalls) && parsedMaxAiCalls >= 0
      ? Math.floor(parsedMaxAiCalls)
      : 3;

  let aiCallsThisRun = 0;
  let aiBudgetSkippedThisRun = 0;

  async function classifyIncomingMailWithinBudget(params: {
    tenantName?: string | null;
    subject: string;
    sender: string;
    text: string;
    source?: string | null;
  }) {
    const ruleDecision = classifyIncomingMailWithRules(params);

    const canSkipAi =
      (ruleDecision.mailType === "TRASH" && ruleDecision.confidence >= 0.8) ||
      (ruleDecision.mailType === "DELIVERY_NOTE" && ruleDecision.confidence >= 0.85) ||
      (ruleDecision.mailType === "ORDER_CONFIRMATION" && ruleDecision.confidence >= 0.95) ||
      (ruleDecision.mailType === "INQUIRY" && ruleDecision.confidence >= 0.95);

    if (canSkipAi) {
      return ruleDecision;
    }

    if (aiCallsThisRun >= maxAiCallsPerRun) {
      aiBudgetSkippedThisRun += 1;

      return {
        ...ruleDecision,
        warnings: [
          ...(ruleDecision.warnings || []),
          `KI-Limit pro Abruf erreicht (${maxAiCallsPerRun}). Kostenlose Regelprüfung verwendet.`,
        ],
      };
    }

    aiCallsThisRun += 1;
    return classifyIncomingMailWithAi(params);
  }

  for (const account of accounts) {
    try {
      const password = decryptSecret(account.imapPasswordEncrypted || "");

      const client = new ImapFlow({
        host: account.imapHost || "",
        port: account.imapPort || 993,
        secure: account.imapSecure ?? true,
        auth: {
          user: account.imapUsername || account.email,
          pass: password,
        },
        logger: false,
      });

      await client.connect();

      const lock = await client.getMailboxLock("INBOX");

      try {
        const uids = await client.search({ since });

        for await (const message of client.fetch(uids, {
          uid: true,
          envelope: true,
          source: true,
        })) {
          result.checked += 1;

          const parsed = await simpleParser(message.source as Buffer);
          const messageId = String(parsed.messageId || message.uid || "");

          const existing = await prisma.incomingEmail.findFirst({
            where: {
              tenantId: account.tenantId,
              OR: [
                { messageId },
                {
                  mailbox: account.email,
                  subject: String(parsed.subject || "(ohne Betreff)"),
                  sender: String(parsed.from?.text || ""),
                },
              ],
            },
            include: {
              attachments: true,
              orders: {
                select: {
                  id: true,
                },
              },
            },
          });

          if (existing) {
            result.skippedDuplicates += 1;

            let bestText = String(existing.bodyText || parsed.text || "");

            for (const attachment of parsed.attachments || []) {
              let attachmentText = "";

              if (
                attachment.contentType === "application/pdf" ||
                String(attachment.filename || "").toLowerCase().endsWith(".pdf")
              ) {
                result.pdfAttachments += 1;

                const pdfResult = await extractPdfText(Buffer.from(attachment.content));
                attachmentText = pdfResult.text;

                if (attachmentText) {
                  result.pdfTextExtracted += 1;
                } else {
                  result.pdfTextEmpty += 1;
                }

                if (pdfResult.error) {
                  result.pdfErrors.push(String(attachment.filename || "attachment") + ": " + pdfResult.error);
                }

                bestText = attachmentText || bestText;
              }

              const filename = attachment.filename || "attachment";

              const savedAttachment = existing.attachments.find((item: any) => {
                return item.filename === filename;
              });

              if (savedAttachment) {
                if (attachmentText && !savedAttachment.textContent) {
                  await prisma.emailAttachment.update({
                    where: {
                      id: savedAttachment.id,
                    },
                    data: {
                      textContent: attachmentText,
                      extractedJson: {
                        size: attachment.size,
                        contentType: attachment.contentType,
                        pdfTextLength: attachmentText.length,
                        pdfTextError: attachmentText ? null : "PDF_TEXT_EMPTY",
                        reprocessedAt: new Date().toISOString(),
                      },
                    },
                  });
                }
              } else {
                await prisma.emailAttachment.create({
                  data: {
                    incomingEmailId: existing.id,
                    filename,
                    mimeType: attachment.contentType || null,
                    textContent: attachmentText || null,
                    extractedJson: {
                      size: attachment.size,
                      contentType: attachment.contentType,
                      pdfTextLength: attachmentText.length,
                      pdfTextError: attachmentText ? null : "PDF_TEXT_EMPTY",
                      reprocessedAt: new Date().toISOString(),
                    },
                  },
                });
              }
            }

            const ignoreRuleMatch = await findImportIgnoreRuleMatch({
              tenantId: account.tenantId,
              subject: String(parsed.subject || ""),
              sender: String(parsed.from?.text || ""),
              bestText,
            });

            if (ignoreRuleMatch) {
              await prisma.incomingEmail.update({
                where: { id: existing.id },
                data: {
                  status: "IGNORED" as any,
                  processedAt: new Date(),
                  errorMessage: "Automatisch ausgeblendet: trifft auf gelernte Ignore-Regel.",
                },
              });

              (result as any).ignoredByRules = ((result as any).ignoredByRules || 0) + 1;
              continue;
            }

                      if (isHeycaterTomorrowReminder(parsed.subject)) {
                        await prisma.incomingEmail.update({
                          where: { id: existing.id },
                          data: {
                            status: "IGNORED" as any,
                            processedAt: new Date(),
                            errorMessage:
                              "Automatisch ignoriert: Heycater-Erinnerung an ein bereits geplantes morgiges Catering.",
                          },
                        });

                        (result as any).ignoredByRules =
                          ((result as any).ignoredByRules || 0) + 1;

                        continue;
                      }


                      const existingExtractedJson =
                        existing.extractedJson &&
                        typeof existing.extractedJson === "object" &&
                        !Array.isArray(existing.extractedJson)
                          ? (existing.extractedJson as Record<string, any>)
                          : {};

                      const storedAiDecision =
                        existingExtractedJson.aiDecision &&
                        typeof existingExtractedJson.aiDecision === "object"
                          ? (existingExtractedJson.aiDecision as any)
                          : null;

                      const canReuseStoredAiDecision =
                        Boolean(storedAiDecision) &&
                        (
                          storedAiDecision.mode === "ai" ||
                          (
                            storedAiDecision.mode === "rules" &&
                            storedAiDecision.mailType !== "UNKNOWN" &&
                            Number(storedAiDecision.confidence || 0) >= 0.8
                          )
                        );

                      const aiDecision = canReuseStoredAiDecision
                        ? storedAiDecision
                        : await classifyIncomingMailWithinBudget({
                            tenantName: null,
                            subject: String(parsed.subject || ""),
                            sender: String(parsed.from?.text || ""),
                            text: bestText,
                            source: "EMAIL",
                          });

                      if (
                        aiDecision.confidence >= 0.85 &&
                        ["TRASH", "INVOICE", "DELIVERY_NOTE"].includes(aiDecision.mailType)
                      ) {
                        await prisma.incomingEmail.update({
                          where: { id: existing.id },
                          data: {
                            status: "IGNORED" as any,
                            processedAt: new Date(),
                            extractedJson: { aiDecision },
                            errorMessage: "KI ignoriert: " + aiDecision.mailType + " - " + aiDecision.reason,
                          },
                        });
                        (result as any).ignoredByAi = ((result as any).ignoredByAi || 0) + 1;
                        continue;
                      }

                      if (aiDecision.mailType === "INQUIRY" && aiDecision.confidence >= 0.75) {
                        await prisma.incomingEmail.update({
                          where: { id: existing.id },
                          data: {
                            status: "REVIEW_NEEDED" as any,
                            processedAt: new Date(),
                            extractedJson: { aiDecision },
                            errorMessage: "KI: Anfrage erkannt - " + aiDecision.reason,
                          },
                        });
                        (result as any).inquiriesDetected = ((result as any).inquiriesDetected || 0) + 1;
                        continue;
                      }

                      if (aiDecision.mailType === "UNKNOWN" && aiDecision.confidence >= 0.65) {
                        await prisma.incomingEmail.update({
                          where: { id: existing.id },
                          data: {
                            status: "REVIEW_NEEDED" as any,
                            processedAt: new Date(),
                            extractedJson: { aiDecision },
                            errorMessage: "KI unsicher: " + aiDecision.reason,
                          },
                        });
                        (result as any).reviewNeededByAi = ((result as any).reviewNeededByAi || 0) + 1;
                        continue;
                      }

                      const extractedOrder = extractUniversalOrder(bestText);

                      const importAnalysis = analyzeImportedOrder({
                        documentType: aiDecision.mailType as any,
                        classificationConfidence: Number(
                          aiDecision.confidence || 0
                        ),
                        classificationReason: String(
                          aiDecision.reason || ""
                        ),
                        extractedOrder,
                        subject: String(parsed.subject || ""),
                        sender: String(parsed.from?.text || ""),
                        sourceText: bestText,
                      });
            const importRuleMatches = await findOrderImportRuleMatches({
              tenantId: account.tenantId,
              subject: String(parsed.subject || ""),
              sender: String(parsed.from?.text || ""),
              bestText,
            });
            const shouldCreateByRules = shouldCreateOrderFromImportRules(extractedOrder, bestText, importRuleMatches);

          const canCreateReviewOrder =
            shouldCreateByRules &&
            canCreateReviewOrderFromAnalysis(importAnalysis);

            if (existing.orders.length === 0 && canCreateReviewOrder) {
              const creationResult =
                await createReviewOrderFromExtracted({
                  tenantId:
                    account.tenantId,
                  brandId:
                    account.brandId,
                  incomingEmailId:
                    existing.id,
                  extractedOrder,
                  bestText,
                  subject: String(
                    parsed.subject || ""
                  ),
                });

              await prisma.incomingEmail.update({
                where: {
                  id: existing.id,
                },
                data: {
                  status:
                    creationResult.created
                      ? ("ORDER_CREATED" as any)
                      : ("IGNORED" as any),
                  processedAt:
                    new Date(),
                  extractedJson: {
                    ...extractedOrder,
                    aiDecision,
                    importAnalysis,
                    duplicateReason:
                      creationResult
                        .duplicateReason,
                    linkedOrderId:
                      creationResult.order
                        ?.id || null,
                  },
                  errorMessage:
                    creationResult.created
                      ? null
                      : creationResult
                          .duplicateReason,
                },
              });

              if (creationResult.created) {
                result.createdOrders += 1;
              } else {
                result.skippedDuplicates += 1;
              }
            } else if (existing.orders.length === 0) {
              await prisma.incomingEmail.update({
                where: { id: existing.id },
                data: {
                  status: "REVIEW_NEEDED" as any,
                  processedAt: new Date(),
                  extractedJson: extractedOrder ? { ...extractedOrder, aiDecision, importAnalysis } : { aiDecision, importAnalysis },
                  errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",
                },
              });
            }

            continue;
          }

          const incomingEmail = await prisma.incomingEmail.create({
            data: {
              tenantId: account.tenantId,
              emailAccountId: account.id,
              brandId: account.brandId || null,
              mailbox: account.email,
              sender: String(parsed.from?.text || ""),
              subject: String(parsed.subject || "(ohne Betreff)"),
              bodyText: String(parsed.text || ""),
              source: "EMAIL" as any,
              status: "RECEIVED" as any,
              messageId,
              extractedJson: {
                uid: message.uid,
                date: parsed.date?.toISOString?.() || null,
                from: parsed.from?.text || null,
                to: parsed.to?.text || null,
                subject: parsed.subject || null,
              },
            },
          });

          result.savedEmails += 1;

          let bestText = String(parsed.text || "");

          for (const attachment of parsed.attachments || []) {
            let attachmentText = "";

            if (
              attachment.contentType === "application/pdf" ||
              String(attachment.filename || "").toLowerCase().endsWith(".pdf")
            ) {
              result.pdfAttachments += 1;

              const pdfResult = await extractPdfText(Buffer.from(attachment.content));
              attachmentText = pdfResult.text;

              if (attachmentText) {
                result.pdfTextExtracted += 1;
              } else {
                result.pdfTextEmpty += 1;
              }

              if (pdfResult.error) {
                result.pdfErrors.push(String(attachment.filename || "attachment") + ": " + pdfResult.error);
              }

              bestText = attachmentText || bestText;
            }

            await prisma.emailAttachment.create({
              data: {
                incomingEmailId: incomingEmail.id,
                filename: attachment.filename || "attachment",
                mimeType: attachment.contentType || null,
                textContent: attachmentText || null,
                extractedJson: {
                  size: attachment.size,
                  contentType: attachment.contentType,
                  pdfTextLength: attachmentText.length,
                  pdfTextError: attachmentText ? null : "PDF_TEXT_EMPTY",
                },
              },
            });
          }

          const ignoreRuleMatch = await findImportIgnoreRuleMatch({
            tenantId: account.tenantId,
            subject: String(parsed.subject || ""),
            sender: String(parsed.from?.text || ""),
            bestText,
          });

          if (ignoreRuleMatch) {
            await prisma.incomingEmail.update({
              where: { id: incomingEmail.id },
              data: {
                status: "IGNORED" as any,
                processedAt: new Date(),
                errorMessage: "Automatisch ausgeblendet: trifft auf gelernte Ignore-Regel.",
              },
            });

            (result as any).ignoredByRules = ((result as any).ignoredByRules || 0) + 1;
            continue;
          }

          if (isHeycaterTomorrowReminder(parsed.subject)) {
            await prisma.incomingEmail.update({
              where: { id: incomingEmail.id },
              data: {
                status: "IGNORED" as any,
                processedAt: new Date(),
                errorMessage:
                  "Automatisch ignoriert: Heycater-Erinnerung an ein bereits geplantes morgiges Catering.",
              },
            });

            (result as any).ignoredByRules =
              ((result as any).ignoredByRules || 0) + 1;

            continue;
          }

          const aiDecision = await classifyIncomingMailWithinBudget({
            tenantName: null,
            subject: String(parsed.subject || ""),
            sender: String(parsed.from?.text || ""),
            text: bestText,
            source: "EMAIL",
          });

          if (
            aiDecision.confidence >= 0.85 &&
            ["TRASH", "INVOICE", "DELIVERY_NOTE"].includes(aiDecision.mailType)
          ) {
            await prisma.incomingEmail.update({
              where: { id: incomingEmail.id },
              data: {
                status: "IGNORED" as any,
                processedAt: new Date(),
                extractedJson: { aiDecision },
                errorMessage: "KI ignoriert: " + aiDecision.mailType + " - " + aiDecision.reason,
              },
            });
            (result as any).ignoredByAi = ((result as any).ignoredByAi || 0) + 1;
            continue;
          }

          if (aiDecision.mailType === "INQUIRY" && aiDecision.confidence >= 0.75) {
            await prisma.incomingEmail.update({
              where: { id: incomingEmail.id },
              data: {
                status: "REVIEW_NEEDED" as any,
                processedAt: new Date(),
                extractedJson: { aiDecision },
                errorMessage: "KI: Anfrage erkannt - " + aiDecision.reason,
              },
            });
            (result as any).inquiriesDetected = ((result as any).inquiriesDetected || 0) + 1;
            continue;
          }

          if (aiDecision.mailType === "UNKNOWN" && aiDecision.confidence >= 0.65) {
            await prisma.incomingEmail.update({
              where: { id: incomingEmail.id },
              data: {
                status: "REVIEW_NEEDED" as any,
                processedAt: new Date(),
                extractedJson: { aiDecision },
                errorMessage: "KI unsicher: " + aiDecision.reason,
              },
            });
            (result as any).reviewNeededByAi = ((result as any).reviewNeededByAi || 0) + 1;
            continue;
          }

          const extractedOrder = extractUniversalOrder(bestText);

          const importAnalysis = analyzeImportedOrder({
            documentType: aiDecision.mailType as any,
            classificationConfidence: Number(
              aiDecision.confidence || 0
            ),
            classificationReason: String(
              aiDecision.reason || ""
            ),
            extractedOrder,
            subject: String(parsed.subject || ""),
            sender: String(parsed.from?.text || ""),
            sourceText: bestText,
          });
          const importRuleMatches = await findOrderImportRuleMatches({
            tenantId: account.tenantId,
            subject: String(parsed.subject || ""),
            sender: String(parsed.from?.text || ""),
            bestText,
          });
          const shouldCreateByRules = shouldCreateOrderFromImportRules(extractedOrder, bestText, importRuleMatches);

          const canCreateReviewOrder =
            shouldCreateByRules &&
            canCreateReviewOrderFromAnalysis(importAnalysis);

          if (canCreateReviewOrder) {
            const creationResult =
              await createReviewOrderFromExtracted({
                tenantId:
                  account.tenantId,
                brandId:
                  account.brandId,
                incomingEmailId:
                  incomingEmail.id,
                extractedOrder,
                bestText,
                subject: String(
                  parsed.subject || ""
                ),
              });

            await prisma.incomingEmail.update({
              where: {
                id: incomingEmail.id,
              },
              data: {
                status:
                  creationResult.created
                    ? ("ORDER_CREATED" as any)
                    : ("IGNORED" as any),
                processedAt:
                  new Date(),
                extractedJson: {
                  ...extractedOrder,
                  aiDecision,
                  importAnalysis,
                  duplicateReason:
                    creationResult
                      .duplicateReason,
                  linkedOrderId:
                    creationResult.order
                      ?.id || null,
                },
                errorMessage:
                  creationResult.created
                    ? null
                    : creationResult
                        .duplicateReason,
              },
            });

            if (creationResult.created) {
              result.createdOrders += 1;
            } else {
              result.skippedDuplicates += 1;
            }
          } else {
            await prisma.incomingEmail.update({
              where: { id: incomingEmail.id },
              data: {
                status: "REVIEW_NEEDED" as any,
                processedAt: new Date(),
                extractedJson: {
                  ...extractedOrder,
                  aiDecision,
                  importAnalysis,
                },
                errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",
              },
            });
          }
        }

        await prisma.emailAccount.update({
          where: { id: account.id },
          data: {
            imapLastCheckedAt: new Date(),
          },
        });
      } finally {
        lock.release();
        await client.logout();
      }
    } catch (error: any) {
      result.errors.push(account.email + ": " + String(error?.message || error));
    }
  }

  (result as any).aiCallsThisRun = aiCallsThisRun;
  (result as any).aiBudgetSkippedThisRun = aiBudgetSkippedThisRun;
  (result as any).maxAiCallsPerRun = maxAiCallsPerRun;

  return json(result);
}






































