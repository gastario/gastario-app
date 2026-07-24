import {
  describe,
  expect,
  it,
} from "vitest";

import {
  convertLegacyExtractedOrderToDraft,
  extractAndAnalyzeImport,
} from "./legacy-parser-adapter";

describe("Legacy Parser Adapter", () => {
  it("überführt vorhandene Parserfelder in das zentrale Format", () => {
    const draft =
      convertLegacyExtractedOrderToDraft(
        {
          subject:
            "2026-300100 - Auftragsbestätigung",
          sender:
            "orders@example.com",
          documentText:
            "Auftragsbestätigung",
        },
        {
          source: "unknown-platform",
          customerName:
            "Musterfirma GmbH",
          contactName:
            "Max Mustermann",
          contactPhone:
            "030123456",
          deliveryDate:
            "31.07.2026",
          deliveryTime:
            "10:30",
          eventDate: "",
          eventStart: "",
          deliveryAddress:
            "Musterstraße 1, 10115 Berlin",
          presentation: "",
          pdfNetTotalCents: 25000,
          pdfTaxTotalCents: 4750,
          pdfGrossTotalCents: 29750,
          items: [
            {
              name: "Lunch",
              description:
                "Vegetarisches Buffet",
              rawLine:
                "10 Lunch 25,00 250,00",
              quantity: 10,
              unitCents: 2500,
              totalCents: 25000,
            },
          ],
        }
      );

    expect(
      draft.externalOrderNumber
    ).toBe("2026-300100");

    expect(
      draft.customerName
    ).toBe("Musterfirma GmbH");

    expect(
      draft.items
    ).toHaveLength(1);

    expect(
      draft.items[0].totalCents
    ).toBe(25000);
  });

  it("übernimmt die vollständig erkannten On-Running-Positionen unverändert", () => {
    const draft =
      convertLegacyExtractedOrderToDraft(
        {
          subject:
            "2026-260262 - Fast Track Order bestätigt",
          documentText:
            "Der Kunde On Running hat Dein Angebot gebucht.",
        },
        {
          source: "Heycater",
          customerName:
            "On Running",
          contactName: "",
          contactPhone: "",
          deliveryDate:
            "13.08.2026",
          deliveryTime:
            "08:00",
          eventDate: "",
          eventStart: "",
          deliveryAddress:
            "Köpenicker Straße 122, 10179 Berlin",
          presentation: "",
          items: [
            {
              name: "Frühstück",
              quantity: 100,
              unitCents: 1200,
              totalCents: 120000,
            },
            {
              name:
                "Bitte mit mehr Rührei planen",
              quantity: 1,
              unitCents: 8000,
              totalCents: 8000,
            },
            {
              name:
                "Lieferung und Abholung",
              quantity: 1,
              unitCents: 6800,
              totalCents: 6800,
            },
          ],
        }
      );

    expect(draft.items).toHaveLength(3);

    expect(draft.items[0]).toMatchObject({
      name: "Frühstück",
      quantity: 100,
      unitCents: 1200,
      totalCents: 120000,
    });

    expect(draft.items[1]).toMatchObject({
      name:
        "Bitte mit mehr Rührei planen",
      quantity: 1,
      unitCents: 8000,
      totalCents: 8000,
    });

    expect(
      draft.items.reduce(
        (sum, item) =>
          sum + item.totalCents,
        0
      )
    ).toBe(134800);
  });

  it("analysiert eine vollständige Bestätigung unabhängig von der Plattform", () => {
    const result =
      extractAndAnalyzeImport({
        subject:
          "2026-300101 - Auftragsbestätigung",
        sender:
          "auftrag@beliebig.de",
        documentText: `
Auftragsbestätigung

Kunde
Beispiel AG

Lieferdatum
01.08.2026

Lieferzeit
12:00

Lieferadresse
Beispielstraße 1
10115 Berlin

Bezeichnung Menge Einzelpreis Gesamtpreis
Lunch
10 15,00 150,00

Gesamtbetrag Netto 150,00
        `,
      });

    expect(
      result.documentType
    ).toBe("ORDER_CONFIRMATION");

    expect(
      result.externalOrderNumber
    ).toBe("2026-300101");

    expect(
      result.calculatedItemsTotalCents
    ).toBe(15000);

    expect(
      [
        "CREATE_ORDER",
        "CREATE_REVIEW",
      ]
    ).toContain(result.action);
  });

  it("erkennt eine vorhandene externe Nummer als bestehenden Auftrag", () => {
    const result =
      extractAndAnalyzeImport({
        subject:
          "2026-300102 - Auftragsbestätigung",
        documentText: `
Auftragsbestätigung

Kunde
Beispiel GmbH

Lieferdatum
02.08.2026

Bezeichnung Menge Einzelpreis Gesamtpreis
Lunch
5 20,00 100,00

Gesamtbetrag Netto 100,00
        `,
        existingOrders: [
          {
            id:
              "existing-order",
            externalOrderNumber:
              "2026-300102",
            status:
              "REVIEW_NEEDED",
          },
        ],
      });

    expect(
      result.action
    ).toBe("UPDATE_EXISTING");

    expect(
      result
        .matchingExistingOrder
        ?.id
    ).toBe("existing-order");
  });

  it("legt eine Absage niemals als neuen Auftrag an", () => {
    const result =
      extractAndAnalyzeImport({
        subject:
          "2026-300103 - Absage",
        documentText:
          "Der Auftrag wurde storniert.",
      });

    expect(
      result.documentType
    ).toBe("CANCELLATION");

    expect(
      result.action
    ).toBe("MANUAL_REVIEW");
  });
});