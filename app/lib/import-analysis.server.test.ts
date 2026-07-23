import { describe, expect, it } from "vitest";

import {
  analyzeImportedOrder,
  canCreateReviewOrderFromAnalysis,
} from "./import-analysis.server";
import type { ExtractedOrder } from "./order-import-extract.server";

function createOrder(
  overrides: Partial<ExtractedOrder> = {}
): ExtractedOrder {
  return {
    source: "Heycater",
    customerName: "Salesforce Germany GmbH",
    contactName: "Max Mustermann",
    contactPhone: "+49 30 123456",
    deliveryDate: "25.07.2026",
    deliveryTime: "12:00",
    eventDate: "25.07.2026",
    eventStart: "12:00",
    deliveryAddress: "Musterstraße 1, 10115 Berlin",
    presentation: "Buffet",
    pdfNetTotalCents: 30000,
    pdfTaxTotalCents: 5700,
    pdfGrossTotalCents: 35700,
    items: [
      {
        name: "Business Lunch",
        quantity: 30,
        unitCents: 1000,
        totalCents: 30000,
      },
    ],
    ...overrides,
  };
}

describe("analyzeImportedOrder", () => {
  it("erkennt einen vollständigen Auftrag, gibt ihn aber noch nicht automatisch frei", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.99,
      classificationReason:
        "Eindeutige Auftragsbestätigung mit Auftragsnummer.",
      extractedOrder: createOrder(),
      subject: "Auftragsbestätigung HC-2026-4711",
      sender: "orders@heycater.com",
      sourceText: "Auftragsbestätigung",
    });

    expect(result.decision).toBe("REVIEW_REQUIRED");

    expect(result.customerReliable).toBe(true);
    expect(result.itemsReliable).toBe(true);
    expect(result.deliveryReliable).toBe(true);
    expect(result.totalsReliable).toBe(true);

    expect(result.calculatedItemsTotalCents).toBe(30000);
    expect(result.selectedOrderTotalCents).toBe(30000);
    expect(result.selectedTotalSource).toBe("PDF_NET");

    expect(
      result.issues.some(
        (issue) => issue.severity === "ERROR"
      )
    ).toBe(false);
  });

  it("übernimmt eine Anfrage niemals als Auftrag", () => {
    const result = analyzeImportedOrder({
      documentType: "INQUIRY",
      classificationConfidence: 0.98,
      classificationReason:
        "Kunde bittet um ein unverbindliches Angebot.",
      extractedOrder: createOrder(),
      subject: "Anfrage Catering für 30 Personen",
      sender: "office@example.com",
      sourceText:
        "Bitte senden Sie uns ein Angebot.",
    });

    expect(result.decision).toBe("REVIEW_REQUIRED");

    expect(
      result.issues.some(
        (issue) =>
          issue.code === "NOT_CONFIRMED_ORDER"
      )
    ).toBe(true);

    expect(result.documentType).toBe("INQUIRY");
  });

  it("lehnt einen Produktnamen als angeblichen Kunden ab", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.99,
      extractedOrder: createOrder({
        customerName:
          "4x halbierte Sesambagel mit Frischkäse",
      }),
      subject: "Auftragsbestätigung",
      sender: "orders@example.com",
    });

    expect(result.customerReliable).toBe(false);
    expect(result.decision).toBe("REVIEW_REQUIRED");

    expect(
      result.issues.some(
        (issue) =>
          issue.code === "CUSTOMER_NOT_RELIABLE"
      )
    ).toBe(true);
  });

  it("erkennt eine abweichende PDF- und Positionssumme", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.99,
      extractedOrder: createOrder({
        pdfNetTotalCents: 35000,
        items: [
          {
            name: "Business Lunch",
            quantity: 30,
            unitCents: 1000,
            totalCents: 30000,
          },
        ],
      }),
      subject: "Auftragsbestätigung",
      sender: "orders@example.com",
    });

    expect(result.totalsReliable).toBe(false);
    expect(result.decision).toBe("REVIEW_REQUIRED");

    expect(
      result.issues.some(
        (issue) => issue.code === "TOTAL_MISMATCH"
      )
    ).toBe(true);
  });

  it("weist Rechnungen zurück", () => {
    const result = analyzeImportedOrder({
      documentType: "INVOICE",
      classificationConfidence: 0.99,
      extractedOrder: createOrder(),
      subject: "Rechnung 2026-1004",
      sender: "billing@example.com",
    });

    expect(result.decision).toBe("REJECT");
    expect(result.documentType).toBe("INVOICE");
  });

  it("weist Lieferscheine zurück", () => {
    const result = analyzeImportedOrder({
      documentType: "DELIVERY_NOTE",
      classificationConfidence: 0.99,
      extractedOrder: createOrder(),
      subject: "Lieferschein 4711",
      sender: "delivery@example.com",
    });

    expect(result.decision).toBe("REJECT");
    expect(result.documentType).toBe("DELIVERY_NOTE");
  });
});
describe("reale Import-Fehlerfälle", () => {
  it("weist eine Zutatenliste als Kundennamen zurück", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.99,
      extractedOrder: createOrder({
        customerName:
          "Gouda-Käse, Weintrauben, Petersilie, Cornichon -",
      }),
      subject: "Fast Track Order bestätigt",
    });

    expect(result.customerReliable).toBe(false);
    expect(result.normalizedCustomerName).toBeNull();
  });

  it("weist eine Handelsregisterzeile als Kundennamen zurück", () => {
    const result = analyzeImportedOrder({
      documentType: "INQUIRY",
      classificationConfidence: 0.98,
      extractedOrder: createOrder({
        customerName:
          "HRA 50203 B · AG Charlottenburg",
      }),
      subject: "Angebot Catering",
    });

    expect(result.customerReliable).toBe(false);
  });

  it("erkennt eine Passwort-Mail als Müll", () => {
    const result = analyzeImportedOrder({
      documentType: "UNKNOWN",
      classificationConfidence: 0.45,
      extractedOrder: createOrder({
        customerName: "",
        items: [],
        pdfNetTotalCents: 0,
      }),
      subject: "Lunch Daily – neues Passwort festlegen",
    });

    expect(result.documentType).toBe("TRASH");
    expect(result.decision).toBe("REJECT");
  });

  it("erkennt eine morgige Catering-Erinnerung", () => {
    const result = analyzeImportedOrder({
      documentType: "UNKNOWN",
      classificationConfidence: 0.45,
      extractedOrder: createOrder(),
      subject:
        "2026-260363 - Dein morgiges heykantine! Catering mit heycater!",
    });

    expect(result.documentType).toBe("REMINDER");
    expect(result.decision).toBe("REJECT");
  });

  it("erkennt geänderte Bestelldetails als Auftragsänderung", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.78,
      extractedOrder: createOrder(),
      subject:
        "2026-260189 - Bestelldetails wurden geändert",
    });

    expect(result.documentType).toBe("ORDER_CHANGE");
    expect(result.decision).toBe("REVIEW_REQUIRED");
  });

  it("bereinigt ein Kundenname-Präfix", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.99,
      extractedOrder: createOrder({
        customerName:
          "Kundenname: Grammarly Germany GmbH",
      }),
      subject: "Auftrag bestätigt",
    });

    expect(result.customerReliable).toBe(true);
    expect(result.normalizedCustomerName).toBe(
      "Grammarly Germany GmbH"
    );
  });

  it("erkennt eine Heycater-Bestätigung trotz Login-Link als Auftrag", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.78,
      classificationReason:
        "Regelprüfung: wahrscheinlich bestätigter Auftrag.",
      extractedOrder: createOrder({
        customerName: "Sirius Facilities GmbH",
      }),
      subject:
        "2026-259900 - Fast Track Order bestätigt",
      sender: "milena@heycater.com",
      sourceText:
        "Login Account Der Kunde Sirius Facilities GmbH hat Dein Angebot gebucht. Hiermit erhältst Du die verbindliche Auftragsbestätigung.",
    });

    expect(result.documentType).toBe(
      "ORDER_CONFIRMATION"
    );
    expect(result.customerReliable).toBe(true);
  });

  it("akzeptiert einen ausdrücklich bestätigten Kundennamen ohne Rechtsform", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.78,
      classificationReason:
        "Regelprüfung: wahrscheinlich bestätigter Auftrag.",
      extractedOrder: createOrder({
        customerName: "On Running",
        pdfNetTotalCents: 0,
        pdfTaxTotalCents: 0,
        pdfGrossTotalCents: 144236,
        items: [
          {
            name: "Frühstück",
            quantity: 100,
            unitCents: 1200,
            totalCents: 120000,
          },
          {
            name: "Lieferung und Abholung",
            quantity: 1,
            unitCents: 6800,
            totalCents: 6800,
          },
        ],
      }),
      subject:
        "2026-260262 - Fast Track Order bestätigt",
      sender: "milena@heycater.com",
      sourceText:
        "Der Kunde On Running hat Dein Angebot gebucht. Hiermit erhältst Du die verbindliche Auftragsbestätigung.",
    });

    expect(result.documentType).toBe(
      "ORDER_CONFIRMATION"
    );
    expect(result.customerReliable).toBe(true);
    expect(result.normalizedCustomerName).toBe(
      "On Running"
    );
    expect(result.selectedOrderTotalCents).toBe(
      126800
    );
  });

  it("erlaubt einen Prüfauftrag bei abweichender PDF- und Positionssumme", () => {
    const result = analyzeImportedOrder({
      documentType: "ORDER_CONFIRMATION",
      classificationConfidence: 0.99,
      classificationReason:
        "Eindeutige Plattform-Auftragsbestätigung.",
      extractedOrder: createOrder({
        customerName: "Sirius Facilities GmbH",
        pdfNetTotalCents: 31530,
        pdfTaxTotalCents: 2207,
        pdfGrossTotalCents: 33737,
        items: [
          {
            name: "Cateringpositionen",
            quantity: 1,
            unitCents: 29240,
            totalCents: 29240,
          },
        ],
      }),
      subject:
        "2026-259900 - Fast Track Order bestätigt",
      sender: "milena@heycater.com",
      sourceText:
        "Der Kunde Sirius Facilities GmbH hat Dein Angebot gebucht.",
    });

    expect(result.documentType).toBe(
      "ORDER_CONFIRMATION"
    );
    expect(result.customerReliable).toBe(true);
    expect(result.itemsReliable).toBe(true);
    expect(result.deliveryReliable).toBe(true);
    expect(result.totalsReliable).toBe(false);

    expect(
      canCreateReviewOrderFromAnalysis(result)
    ).toBe(true);
  });
});
