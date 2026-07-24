import { describe, expect, it } from "vitest";

import {
  runImportEngine,
} from "./import-engine.server";

import {
  resolveMoneyRow,
} from "./money-resolver";

describe("plattformunabhängige Import Engine", () => {
  it("erkennt eine Bestätigung unabhängig vom Plattformnamen", () => {
    const result = runImportEngine({
      draft: {
        sourceChannel: "EMAIL",
        sourceName: "Beliebige Plattform",
        subject:
          "2026-300001 - Auftragsbestätigung",
        bodyText:
          "Der Kunde Musterfirma GmbH hat den Auftrag bestätigt.",
        externalOrderNumber:
          "2026-300001",
        customerName:
          "Musterfirma GmbH",
        deliveryDate:
          "30.07.2026",
        deliveryTime: "10:00",
        deliveryAddress:
          "Musterstraße 1, 10115 Berlin",
        netTotalCents: 16800,
        items: [
          {
            name: "Frühstück",
            quantity: 10,
            unitCents: 1680,
            totalCents: 16800,
          },
        ],
      },
    });

    expect(result.documentType).toBe(
      "ORDER_CONFIRMATION"
    );

    expect(result.action).toBe(
      "CREATE_ORDER"
    );

    expect(
      result.selectedOrderTotalCents
    ).toBe(16800);
  });

  it("wählt bei On Running mathematisch 12,80 Euro statt 12,00 Euro", () => {
    const resolved = resolveMoneyRow({
      quantity: 100,
      unitCandidates: [
        {
          cents: 1200,
          source: "PDF_TEXT_12",
        },
        {
          cents: 1280,
          source: "PDF_TABLE_12_8",
        },
      ],
      statedTotalCents: 128000,
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.unitCents).toBe(
      1280
    );
    expect(resolved?.totalCents).toBe(
      128000
    );
    expect(resolved?.exact).toBe(true);
  });

  it("berechnet On Running vollständig mit 1.348,00 Euro", () => {
    const result = runImportEngine({
      draft: {
        sourceChannel: "EMAIL",
        subject:
          "2026-260262 - Fast Track Order bestätigt",
        bodyText:
          "Der Kunde On Running hat den Auftrag gebucht.",
        externalOrderNumber:
          "2026-260262",
        customerName: "On Running",
        deliveryDate:
          "13.08.2026",
        deliveryTime: "08:00",
        deliveryAddress:
          "Köpenicker Straße 122, 10179 Berlin",
        items: [
          {
            name: "Frühstück",
            quantity: 100,
            unitCents: 1280,
            totalCents: 128000,
          },
          {
            name:
              "Lieferung und Abholung",
            quantity: 1,
            unitCents: 6800,
            totalCents: 6800,
          },
        ],
      },
    });

    expect(
      result.calculatedItemsTotalCents
    ).toBe(134800);

    expect(
      result.selectedOrderTotalCents
    ).toBe(134800);

    expect(result.action).toBe(
      "CREATE_ORDER"
    );
  });

  it("verliert Sirius trotz Summenabweichung nicht", () => {
    const result = runImportEngine({
      draft: {
        sourceChannel: "EMAIL",
        subject:
          "2026-259900 - Fast Track Order bestätigt",
        externalOrderNumber:
          "2026-259900",
        customerName:
          "Sirius Facilities GmbH",
        deliveryDate:
          "30.07.2026",
        deliveryTime: "09:00",
        deliveryAddress:
          "Eichhornstraße 3, 10785 Berlin",
        netTotalCents: 31530,
        items: [
          {
            name:
              "Extrahierte Positionen",
            quantity: 1,
            unitCents: 29240,
            totalCents: 29240,
          },
        ],
      },
    });

    expect(result.documentType).toBe(
      "ORDER_CONFIRMATION"
    );

    expect(result.action).toBe(
      "CREATE_REVIEW"
    );

    expect(
      result.issues.some(
        (issue) =>
          issue.code ===
          "TOTAL_MISMATCH"
      )
    ).toBe(true);
  });

  it("erkennt vorhandene externe Auftragsnummern plattformübergreifend", () => {
    const result = runImportEngine({
      existingOrders: [
        {
          id: "existing-order",
          externalOrderNumber:
            "2026-300002",
          status: "REVIEW_NEEDED",
        },
      ],
      draft: {
        sourceChannel: "UPLOAD",
        subject:
          "2026-300002 - Auftragsbestätigung",
        externalOrderNumber:
          "2026-300002",
        customerName:
          "Beispiel AG",
        deliveryDate:
          "01.08.2026",
        items: [
          {
            name: "Lunch",
            quantity: 20,
            unitCents: 1500,
            totalCents: 30000,
          },
        ],
      },
    });

    expect(result.action).toBe(
      "UPDATE_EXISTING"
    );

    expect(
      result.matchingExistingOrder?.id
    ).toBe("existing-order");
  });

  it("legt Absagen niemals als neuen Auftrag an", () => {
    const result = runImportEngine({
      draft: {
        sourceChannel: "EMAIL",
        subject:
          "2026-300003 - Absage",
        externalOrderNumber:
          "2026-300003",
        items: [],
      },
    });

    expect(result.documentType).toBe(
      "CANCELLATION"
    );

    expect(result.action).toBe(
      "MANUAL_REVIEW"
    );
  });
});