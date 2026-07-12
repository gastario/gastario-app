export type ImportAiMailType =
  | "ORDER_CONFIRMATION"
  | "INQUIRY"
  | "DELIVERY_NOTE"
  | "INVOICE"
  | "TRASH"
  | "UNKNOWN";

export type ImportAiItem = {
  name: string;
  quantity?: number | null;
  unitPriceCents?: number | null;
  totalCents?: number | null;
  notes?: string | null;
};

export type ImportAiDecision = {
  mode: "ai" | "rules";
  mailType: ImportAiMailType;
  confidence: number;
  shouldCreateOrder: boolean;
  shouldCreateInquiry: boolean;
  reason: string;
  source?: string | null;
  customerName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  deliveryAddress?: string | null;
  totalCents?: number | null;
  items: ImportAiItem[];
  warnings: string[];
};

function normalize(value: unknown) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampConfidence(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  return Math.max(0, Math.min(1, number));
}

function hasAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeDecision(raw: any, fallback: ImportAiDecision): ImportAiDecision {
  if (!raw || typeof raw !== "object") return fallback;

  const allowedTypes: ImportAiMailType[] = [
    "ORDER_CONFIRMATION",
    "INQUIRY",
    "DELIVERY_NOTE",
    "INVOICE",
    "TRASH",
    "UNKNOWN",
  ];

  const mailType = allowedTypes.includes(raw.mailType) ? raw.mailType : fallback.mailType;
  const confidence = clampConfidence(raw.confidence);

  return {
    mode: "ai",
    mailType,
    confidence,
    shouldCreateOrder:
      typeof raw.shouldCreateOrder === "boolean"
        ? raw.shouldCreateOrder
        : mailType === "ORDER_CONFIRMATION" && confidence >= 0.85,
    shouldCreateInquiry:
      typeof raw.shouldCreateInquiry === "boolean"
        ? raw.shouldCreateInquiry
        : mailType === "INQUIRY" && confidence >= 0.75,
    reason: normalize(raw.reason) || fallback.reason,
    source: normalize(raw.source) || fallback.source || null,
    customerName: normalize(raw.customerName) || fallback.customerName || null,
    contactName: normalize(raw.contactName) || fallback.contactName || null,
    contactEmail: normalize(raw.contactEmail) || fallback.contactEmail || null,
    contactPhone: normalize(raw.contactPhone) || fallback.contactPhone || null,
    deliveryDate: normalize(raw.deliveryDate) || fallback.deliveryDate || null,
    deliveryTime: normalize(raw.deliveryTime) || fallback.deliveryTime || null,
    deliveryAddress: normalize(raw.deliveryAddress) || fallback.deliveryAddress || null,
    totalCents: Number.isFinite(Number(raw.totalCents)) ? Number(raw.totalCents) : fallback.totalCents || null,
    items: Array.isArray(raw.items)
      ? raw.items
          .map((item: any) => ({
            name: normalize(item.name),
            quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null,
            unitPriceCents: Number.isFinite(Number(item.unitPriceCents)) ? Number(item.unitPriceCents) : null,
            totalCents: Number.isFinite(Number(item.totalCents)) ? Number(item.totalCents) : null,
            notes: normalize(item.notes) || null,
          }))
          .filter((item: ImportAiItem) => item.name)
      : fallback.items,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map((warning: any) => normalize(warning)).filter(Boolean)
      : fallback.warnings,
  };
}

export function classifyIncomingMailWithRules(params: {
  subject: string;
  sender: string;
  text: string;
  source?: string | null;
}): ImportAiDecision {
  const subject = normalize(params.subject);
  const sender = normalize(params.sender);
  const text = normalize(params.text);
  const combined = `${subject} ${sender} ${text}`;
  const lower = combined.toLowerCase();

  const hasOrderWords = hasAny(lower, [
    "auftragsbestÃƒÆ’Ã‚Â¤tigung",
    "auftragsbestaetigung",
    "bestellbestÃƒÆ’Ã‚Â¤tigung",
    "bestellbestaetigung",
    "order confirmation",
    "booking confirmation",
    "confirmed order",
    "confirmed booking",
    "lieferdatum",
    "delivery date",
  ]);

  const hasInquiryWords = hasAny(lower, [
    "angebot",
    "anfrage",
    "kÃƒÆ’Ã‚Â¶nnten sie",
    "koennten sie",
    "bitte ein angebot",
    "request",
    "quote",
    "quotation",
    "catering request",
  ]);

  const hasSupplierTrashWords = hasAny(lower, [
    "chefsculinar",
    "transgourmet",
    "metro",
    "selgros",
    "nicht liefern kÃƒÆ’Ã‚Â¶nnen",
    "nicht lieferbar",
    "fehlartikel",
    "ersatzartikel",
    "warenverfÃƒÆ’Ã‚Â¼gbarkeit",
    "bestellten artikel nicht liefern",
  ]);

  const hasTrashWords = hasAny(lower, [
    "newsletter",
    "unsubscribe",
    "abmelden",
    "zahlungserinnerung",
    "passwort",
    "login-code",
    "verification code",
    "kalendereinladung",
  ]);

  const hasPrice = /\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?\s*ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬/.test(combined);
  const hasDate = /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(combined) || /\b20\d{2}-\d{2}-\d{2}\b/.test(combined);
  const hasQuantity = /\b\d+\s*x\b/i.test(combined) || /\bmenge\b/i.test(combined);

  if ((hasTrashWords || hasSupplierTrashWords) && !hasInquiryWords) {
    return {
      mode: "rules",
      mailType: "TRASH",
      confidence: 0.82,
      shouldCreateOrder: false,
      shouldCreateInquiry: false,
      reason: "RegelprÃƒÆ’Ã‚Â¼fung: wirkt wie keine Bestellung.",
      source: params.source || null,
      items: [],
      warnings: [],
    };
  }

  if (hasOrderWords && (hasDate || hasPrice || hasQuantity)) {
    return {
      mode: "rules",
      mailType: "ORDER_CONFIRMATION",
      confidence: 0.78,
      shouldCreateOrder: false,
      shouldCreateInquiry: false,
      reason: "RegelprÃƒÆ’Ã‚Â¼fung: wahrscheinlich Auftrag, aber KI-PrÃƒÆ’Ã‚Â¼fung oder manuelle PrÃƒÆ’Ã‚Â¼fung empfohlen.",
      source: params.source || null,
      items: [],
      warnings: ["Nur RegelprÃƒÆ’Ã‚Â¼fung, noch keine KI-Antwort."],
    };
  }

  if (hasInquiryWords) {
    return {
      mode: "rules",
      mailType: "INQUIRY",
      confidence: 0.75,
      shouldCreateOrder: false,
      shouldCreateInquiry: true,
      reason: "RegelprÃƒÆ’Ã‚Â¼fung: wahrscheinlich Angebotsanfrage.",
      source: params.source || null,
      items: [],
      warnings: [],
    };
  }

  return {
    mode: "rules",
    mailType: "UNKNOWN",
    confidence: 0.45,
    shouldCreateOrder: false,
    shouldCreateInquiry: false,
    reason: "RegelprÃƒÆ’Ã‚Â¼fung: Mail konnte nicht sicher eingeordnet werden.",
    source: params.source || null,
    items: [],
    warnings: ["Unsicher. Bitte manuell prÃƒÆ’Ã‚Â¼fen."],
  };
}

export async function classifyIncomingMailWithAi(params: {
  tenantName?: string | null;
  subject: string;
  sender: string;
  text: string;
  source?: string | null;
}) {
  const fallback = classifyIncomingMailWithRules(params);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = (process.env.OPENAI_IMPORT_MODEL || "gpt-5-mini").trim();
  const aiImportEnabled =
    String(process.env.AI_IMPORT_ENABLED || "").trim().toLowerCase() === "true";

  if (!aiImportEnabled || !apiKey) {
    return fallback;
  }

  const text = normalize(params.text).slice(0, 24000);

  const prompt = `
Du bist der Import-Assistent einer Catering-Betriebssoftware.

Mandant: ${normalize(params.tenantName) || "unbekannt"}
Quelle: ${normalize(params.source) || "E-Mail"}
Absender: ${normalize(params.sender)}
Betreff: ${normalize(params.subject)}

Aufgabe:
Entscheide, ob diese Nachricht ein echter Catering-Auftrag, eine Angebotsanfrage, ein Lieferschein, eine Rechnung, MÃƒÆ’Ã‚Â¼ll oder unklar ist.

Wichtig:
- Erstelle nur dann shouldCreateOrder=true, wenn wirklich Lieferdatum, Kunde und konkrete Positionen oder klare BestÃƒÆ’Ã‚Â¤tigung vorhanden sind.
- Normale RÃƒÆ’Ã‚Â¼ckfragen, Erinnerungen, Newsletter, Werbung, Zahlungsinfos und unklare Mails dÃƒÆ’Ã‚Â¼rfen keine AuftrÃƒÆ’Ã‚Â¤ge werden.
- Wenn unsicher: UNKNOWN oder INQUIRY, aber nicht blind ORDER_CONFIRMATION.
- Extrahiere Lieferadresse nicht aus dem Kundennamen. Adresse braucht StraÃƒÆ’Ã…Â¸e + PLZ/Ort, wenn vorhanden.
- Gib ausschlieÃƒÆ’Ã…Â¸lich JSON zurÃƒÆ’Ã‚Â¼ck.

JSON-Format:
{
  "mailType": "ORDER_CONFIRMATION | INQUIRY | DELIVERY_NOTE | INVOICE | TRASH | UNKNOWN",
  "confidence": 0.0,
  "shouldCreateOrder": false,
  "shouldCreateInquiry": false,
  "reason": "",
  "source": "",
  "customerName": "",
  "contactName": "",
  "contactEmail": "",
  "contactPhone": "",
  "deliveryDate": "",
  "deliveryTime": "",
  "deliveryAddress": "",
  "totalCents": null,
  "items": [
    {
      "name": "",
      "quantity": null,
      "unitPriceCents": null,
      "totalCents": null,
      "notes": ""
    }
  ],
  "warnings": []
}

Nachricht:
${text}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      return {
        ...fallback,
        warnings: [...fallback.warnings, `KI nicht verfÃƒÆ’Ã‚Â¼gbar: ${response.status}`],
      };
    }

    const data: any = await response.json();
    const outputText =
      data.output_text ||
      data.output?.flatMap((item: any) => item.content || [])
        ?.map((part: any) => part.text || "")
        ?.join("\n") ||
      "";

    const parsed = safeJsonParse(outputText);

    return normalizeDecision(parsed, fallback);
  } catch (error: any) {
    return {
      ...fallback,
      warnings: [...fallback.warnings, "KI-Fehler: " + String(error?.message || error)],
    };
  }
}

