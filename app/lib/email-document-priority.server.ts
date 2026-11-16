/**
 * Business-critical document signals, evaluated before user ignore rules
 * and before AI/order creation. Only strong evidence is used.
 * No side effects: this module never creates or changes an order.
 */
export type AdministrativeMailType =
  | "DUNNING"
  | "PAYMENT_REMINDER"
  | "ORDER_CHANGE"
  | "CANCELLATION"
  | "CREDIT_NOTE"
  | "LEXWARE_CONFIRMATION";

export type AdministrativeMailFinding = {
  mailType: AdministrativeMailType;
  confidence: number;
  reason: string;
  shouldCreateOrder: false;
  shouldCreateInquiry: false;
  mode: "rules";
  items: [];
  warnings: string[];
  source: string;
};

function simplify(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const signals: Array<{ type: AdministrativeMailType; test: RegExp; reason: string }> = [
  { type: "DUNNING", test: /\b(?:mahnung|letzte mahnung|2\.? mahnung|3\.? mahnung|inkassoandrohung)\b/i, reason: "Mahnung erkannt" },
  { type: "PAYMENT_REMINDER", test: /\b(?:zahlungserinnerung|zahlungsaufforderung|payment reminder|overdue payment)\b/i, reason: "Zahlungserinnerung erkannt" },
  { type: "CANCELLATION", test: /\b(?:auftragsstornierung|bestellung storniert|auftrag storniert|stornierungsbestatigung|cancellation of order)\b/i, reason: "Stornierung erkannt" },
  { type: "ORDER_CHANGE", test: /\b(?:auftragsanderung|bestellanderung|anderung ihres auftrags|auftrag wurde geandert|bestellung wurde geandert|order amendment)\b/i, reason: "Auftragsanderung erkannt" },
  { type: "CREDIT_NOTE", test: /\b(?:gutschrift|stornorechnung|credit note|rechnungskorrektur)\b/i, reason: "Gutschrift oder Rechnungskorrektur erkannt" },
];

export function detectAdministrativeMail(params: {
  subject: string;
  sender?: string;
  text?: string;
}): AdministrativeMailFinding | null {
  // Subject is deliberately preferred: quoted older replies in the body
  // must not turn an unrelated message into a new administrative event.
  const subject = simplify(params.subject).replace(/^(?:(?:re|fw|fwd|aw|wg):\s*)+/i, "");
  const sender = simplify(params.sender);
  const body = simplify(params.text).slice(0, 550);

  const match = (type: AdministrativeMailType, confidence: number, reason: string): AdministrativeMailFinding => ({
    mailType: type,
    confidence,
    reason,
    shouldCreateOrder: false,
    shouldCreateInquiry: false,
    mode: "rules",
    items: [],
    warnings: ["Geschaeftsrelevantes Dokument: Zuordnung und Freigabe manuell pruefen."],
    source: "EMAIL",
  });

  for (const signal of signals) {
    if (signal.test.test(subject)) return match(signal.type, 0.98, signal.reason + " (Betreff)");
  }

  // Confirmations sent by Lexware are not independent customer orders.
  if (/\b(?:lexware|lexoffice)\b/i.test(sender + " " + subject) &&
      /\b(?:auftragsbestatigung|bestellbestatigung|order confirmation)\b/i.test(subject)) {
    return match("LEXWARE_CONFIRMATION", 0.98, "Lexware-Auftragsbestaetigung: bestehenden Auftrag abgleichen, nicht duplizieren");
  }

  // A body-only match is intentionally conservative and should remain in review.
  // Limit to the opening of the message; don't scan entire quoted threads or PDFs.
  for (const signal of signals) {
    if (signal.test.test(body) &&
        /\b(?:rechnung|auftrag|bestellung|zahlung|forderung|gutschrift|catering|stornierung)\b/i.test(body)) {
      return match(signal.type, 0.86, signal.reason + " (Nachrichtentext)");
    }
  }
  return null;
}
