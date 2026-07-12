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
    "auftragsbestÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤tigung",
    "auftragsbestaetigung",
    "bestellbestÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¤tigung",
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
    "kÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶nnten sie",
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
    "nicht liefern kÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶nnen",
    "nicht lieferbar",
    "fehlartikel",
    "ersatzartikel",
    "warenverfÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼gbarkeit",
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

  const hasPrice = /\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?\s*ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬/.test(combined);
  const hasDate = /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/.test(combined) || /\b20\d{2}-\d{2}-\d{2}\b/.test(combined);
  const hasQuantity = /\b\d+\s*x\b/i.test(combined) || /\bmenge\b/i.test(combined);

  if ((hasTrashWords || hasSupplierTrashWords) && !hasInquiryWords) {
    return {
      mode: "rules",
      mailType: "TRASH",
      confidence: 0.82,
      shouldCreateOrder: false,
      shouldCreateInquiry: false,
      reason: "RegelprÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼fung: wirkt wie keine Bestellung.",
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
      reason: "RegelprÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼fung: wahrscheinlich Auftrag, aber KI-PrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼fung oder manuelle PrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼fung empfohlen.",
      source: params.source || null,
      items: [],
      warnings: ["Nur RegelprÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼fung, noch keine KI-Antwort."],
    };
  }

  if (hasInquiryWords) {
    return {
      mode: "rules",
      mailType: "INQUIRY",
      confidence: 0.75,
      shouldCreateOrder: false,
      shouldCreateInquiry: true,
      reason: "RegelprÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼fung: wahrscheinlich Angebotsanfrage.",
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
    reason: "RegelprÃ¼fung: Mail konnte nicht sicher eingeordnet werden.",
    source: params.source || null,
    items: [],
    warnings: ["Unsicher. Bitte manuell prÃ¼fen."],
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
  const model = (process.env.OPENAI_IMPORT_MODEL || "gpt-5-nano").trim();
  const aiImportEnabled =
    String(process.env.AI_IMPORT_ENABLED || "").trim().toLowerCase() === "true";

  if (!aiImportEnabled || !apiKey) {
    return fallback;
  }

  const canSkipAi =
    (fallback.mailType === "TRASH" && fallback.confidence >= 0.8) ||
    (fallback.mailType === "DELIVERY_NOTE" && fallback.confidence >= 0.85) ||
    (fallback.mailType === "ORDER_CONFIRMATION" && fallback.confidence >= 0.95) ||
    (fallback.mailType === "INQUIRY" && fallback.confidence >= 0.95);

  if (canSkipAi) {
    return fallback;
  }

  const text = normalize(params.text)
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 7000);

  const prompt = `
Du klassifizierst E-Mails fÃ¼r eine Catering-Betriebssoftware.

Absender: ${normalize(params.sender)}
Betreff: ${normalize(params.subject)}
Quelle: ${normalize(params.source) || "E-Mail"}

Kategorien:
ORDER_CONFIRMATION = verbindlich gebuchter Catering-Auftrag
INQUIRY = Anfrage, Angebot, RÃ¼ckfrage oder Angebotsfreigabe
DELIVERY_NOTE = Erinnerung, Lieferschein oder Information zu bestehendem Auftrag
INVOICE = Rechnung oder Zahlungsbeleg
TRASH = Werbung, Newsletter, Lieferanteninfo oder nicht cateringrelevant
UNKNOWN = nicht sicher einzuordnen

Regeln:
- shouldCreateOrder nur bei eindeutig verbindlicher Buchung.
- Erinnerungen wie "morgiges Catering" erzeugen keinen Auftrag.
- "Bitte Angebot freigeben" ist eine Anfrage, keine Buchung.
- Keine Daten ergÃ¤nzen oder erfinden.
- Fehlende Werte als null oder leere Liste ausgeben.
- Antworte ausschlieÃŸlich als kompaktes JSON.

JSON:
{
  "mailType": "ORDER_CONFIRMATION | INQUIRY | DELIVERY_NOTE | INVOICE | TRASH | UNKNOWN",
  "confidence": 0.0,
  "shouldCreateOrder": false,
  "shouldCreateInquiry": false,
  "reason": "",
  "source": "",
  "customerName": null,
  "contactName": null,
  "contactEmail": null,
  "contactPhone": null,
  "deliveryDate": null,
  "deliveryTime": null,
  "deliveryAddress": null,
  "totalCents": null,
  "items": [],
  "warnings": []
}

E-Mail:
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
        max_output_tokens: 600,
      }),
    });

    if (!response.ok) {
      return {
        ...fallback,
        warnings: [...fallback.warnings, `KI nicht verfÃ¼gbar: ${response.status}`],
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

