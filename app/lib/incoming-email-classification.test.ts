import { describe, it, expect } from "vitest";
import { classifyIncomingEmail } from "./incoming-email-classification";

describe("Inbox business document categories", () => {
  it.each([
    ["2. Mahnung zur Rechnung RE-123", "administrative"],
    ["Zahlungserinnerung RE-42", "administrative"],
    ["Auftragsänderung zu Bestellung AB-12", "administrative"],
    ["Stornorechnung RE-11", "administrative"],
    ["Auftragsbestätigung AB-11", "orders"],
  ])("%s is categorized as %s", (subject, expected) => {
    expect(classifyIncomingEmail({ subject, sender: "kundenservice@example.com", status: "REVIEW_NEEDED" })).toBe(expected);
  });
  it("uses stored AI result for documents without a recognizable subject", () => {
    expect(classifyIncomingEmail({
      subject: "Ihr Dokument",
      status: "REVIEW_NEEDED",
      extractedJson: { aiDecision: { mailType: "PAYMENT_REMINDER" } },
    })).toBe("administrative");
  });
  it("does not reveal manually hidden messages as business documents", () => {
    expect(classifyIncomingEmail({
      subject: "Mahnung zu 421", status: "IGNORED",
    })).toBe("hidden");
  });
  it("recognizes Lexware confirmations distinctly from new orders", () => {
    expect(classifyIncomingEmail({
      subject: "Auftragsbestätigung AB-42", sender: "Lexware Office <noreply@lexware.de>", status: "REVIEW_NEEDED",
    })).toBe("administrative");
  });
});
