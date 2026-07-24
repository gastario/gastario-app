import type {
  ImportDocumentType,
} from "./types";

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyImportDocument(input: {
  subject?: string;
  bodyText?: string;
  documentText?: string;
}): ImportDocumentType {
  const subject = normalizeText(input.subject);

  const combined = normalizeText(
    [
      input.subject,
      input.bodyText,
      input.documentText,
    ].join("\n")
  );

  /*
   * Spezifische geschäftliche Ereignisse müssen immer
   * vor allgemeinen Begriffen wie Login oder Account
   * geprüft werden.
   */
  if (
    /\b(absage|storniert|stornierung|cancelled|canceled|cancellation)\b/.test(
      subject
    )
  ) {
    return "CANCELLATION";
  }

  if (
    /\b(bestelldetails wurden geandert|auftrag geandert|bestellung geandert|order changed|order updated|amendment)\b/.test(
      subject
    )
  ) {
    return "ORDER_CHANGE";
  }

  if (
    /\b(fast track order bestatigt|auftrag bestatigt|auftragsbestatigung|bestellung bestatigt|order confirmation|booking confirmation|event confirmation)\b/.test(
      subject
    )
  ) {
    return "ORDER_CONFIRMATION";
  }

  if (
    /\b(lieferschein|delivery note)\b/.test(
      combined
    )
  ) {
    return "DELIVERY_NOTE";
  }

  if (
    /\b(dein morgiges catering|morgiges catering|reminder|erinnerung)\b/.test(
      subject
    )
  ) {
    return "REMINDER";
  }

  if (
    /\b(anfrage|angebotsanfrage|request for proposal|catering request|inquiry)\b/.test(
      combined
    )
  ) {
    return "INQUIRY";
  }

  if (
    /\b(passwort|password|login|newsletter|konto bestatigen)\b/.test(
      combined
    )
  ) {
    return "IRRELEVANT";
  }

  return "UNKNOWN";
}