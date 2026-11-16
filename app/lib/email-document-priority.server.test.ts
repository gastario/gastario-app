import { describe, expect, it } from "vitest";
import { detectAdministrativeMail } from "./email-document-priority.server";
import { classifyIncomingMailWithRules } from "./ai-import-classifier.server";

describe("critical administrative email intake", () => {
  const check = (subject: string, sender = "office@example.com", text = "") =>
    detectAdministrativeMail({ subject, sender, text });

  it.each([
    ["2. Mahnung zur Rechnung RE-123", "DUNNING"],
    ["Zahlungserinnerung zu Rechnung 2026-17", "PAYMENT_REMINDER"],
    ["Bestelländerung für 18.11.", "ORDER_CHANGE"],
    ["Auftrag storniert: 48394", "CANCELLATION"],
    ["Gutschrift G-194", "CREDIT_NOTE"],
    ["Ihre Rechnungskorrektur", "CREDIT_NOTE"],
  ] as const)("marks '%s' for review as %s", (subject, type) => {
    const finding = check(subject);
    expect(finding?.mailType).toBe(type);
    expect(finding?.shouldCreateOrder).toBe(false);
    expect(classifyIncomingMailWithRules({ subject, sender: "business@example.com", text: "80 Personen" }).mailType).toBe(type);
  });

  it("detects Lexware-sent confirmation without creating a new order", () => {
    const finding = check("Auftragsbestätigung AB-2026-19", "Lexware Office <mail@lexware.de>");
    expect(finding?.mailType).toBe("LEXWARE_CONFIRMATION");
    expect(finding?.shouldCreateOrder).toBe(false);
  });

  it("detects body-only payment reminders for review, not orders", () => {
    const finding = check("Ihr Dokument", "accounting@example.com",
      "Sehr geehrte Damen und Herren, Zahlungserinnerung: Ihre Rechnung RE-11 ist noch offen.");
    expect(finding?.mailType).toBe("PAYMENT_REMINDER");
    expect(finding?.confidence).toBeLessThan(0.9);
  });

  it.each([
    ["Neue Cateringbestellung für 80 Personen", "kunde@example.com"],
    ["Catering-Anfrage für die Weihnachtsfeier", "kunde@example.com"],
    ["Ihr Newsletter", "promo@example.com"],
    ["Auftragsbestätigung Catering 80 Personen", "kunde@example.com"],
  ])("does not intercept normal mail: %s", (subject, sender) => {
    expect(check(subject, sender)).toBeNull();
  });

  it("does not scan quoted old reminders in long reply threads", () => {
    expect(check("Re: Unsere Terminabsprache", "kunde@example.com",
      "Hallo, danke für die Rückmeldung. " + "Inhalt ".repeat(150) +
      "Am 04.11. erhielten wir eine Zahlungserinnerung zur Rechnung RE-12.")).toBeNull();
  });
});
