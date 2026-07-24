import {
  describe,
  expect,
  it,
} from "vitest";

import {
  extractUniversalOrder,
} from "./order-import-extract.server";

describe("Heycater Partner Event Confirmation", () => {
  it("liest den strukturierten Kunden und die Dokumentensummen", () => {
    const text = `
CATERING Auftragsbestätigung
Datum: 23.07.2026
Kundennummer: HC23131253
Auftrag: 2026-259900
Liebes Edis Gastrobetriebe GmbH & Co.KG Team,
hiermit erhältst Du die verbindliche Auftragsbestätigung:
Kunde:
Sirius Facilities GmbH
Oliver Loose
Telefon: +4930285010110
Lieferadresse:
Eichhornstraße 3
10785 Berlin
Stockwerk: 6
Aufzug: Vorhanden
Parkmöglichkeiten: Straße
Präsentation:
Lieferungen:
Lieferdatum: 30.07.2026 Lieferzeit: 9:00
Event Datum: 30.07.2026 Event Beginn: 9:30
Bezeichnung Menge Einzelpreis (Netto) Betrag (Netto)
10er Lachs Canape
helles Baguette mit Frischkäse, geräuchertem Lachs,
Paprikastreifen und Dill
1 € 23,9 23.9
Lieferkosten
Beinhaltet die Lieferung des Caterings
1 € 27,5 27.5
Gesamtbetrag Netto € 315,3
Umsatzsteuer 7% € 22,07
Gesamtbestellwert € 337,37
`;

    const result = extractUniversalOrder(text);

    expect(result.source).toBe("Heycater");
    expect(result.customerName).toBe(
      "Sirius Facilities GmbH"
    );
    expect(result.contactName).toBe("Oliver Loose");
    expect(result.contactPhone).toBe(
      "+4930285010110"
    );

    expect(result.deliveryDate).toBe("30.07.2026");
    expect(result.deliveryTime).toBe("9:00");

    expect(result.deliveryAddress).toContain(
      "Eichhornstraße 3"
    );
    expect(result.deliveryAddress).toContain(
      "10785 Berlin"
    );

    expect(result.pdfNetTotalCents).toBe(31530);
    expect(result.pdfTaxTotalCents).toBe(2207);
    expect(result.pdfGrossTotalCents).toBe(33737);

    expect(result.customerName).not.toContain(
      "Frischkäse"
    );
  });

  it("erkennt On Cloud Service GmbH statt einer Sesambagel-Produktzeile", () => {
    const text = `
Der Kunde On Cloud Service GmbH hat Dein Angebot gebucht.

Kunde:
On Cloud Service GmbH
Frau Elin Vorbrodt
Telefon: +45 78 15 26 74

Lieferadresse:
Köpenicker Straße 122
10179 Berlin

Lieferdatum: 30.07.2026
Lieferzeit: 8:15
Event Datum: 30.07.2026
Event Beginn: 9:00

16er halbierte Bagelplatte aus
Sesambagels und Laugenbagel
4x halbierte Sesambagel Frischkäse, Gouda-Käse,
Putenbrust, Lollo-Salat, rote Zwiebeln und Tomate
1 € 68,9 68.9

Erdbeer Schnitte ( vegan )
Vegane Erdbeercreme mit dunklem Muffinboden
15 € 5,5 82.5
`;

    const result = extractUniversalOrder(text);

    expect(result.customerName).toBe(
      "On Cloud Service GmbH"
    );
    expect(result.customerName).not.toContain(
      "Sesambagel"
    );
    expect(result.contactName).toBe(
      "Frau Elin Vorbrodt"
    );
    expect(result.deliveryDate).toBe("30.07.2026");
  });

  it("behält bei Sirius eine Position über einen PDF-Seitenumbruch hinweg", () => {
    const text = `
CATERING Auftragsbestätigung
Auftrag: 2026-259900
hiermit erhältst Du die verbindliche Auftragsbestätigung:

Kunde:
Sirius Facilities GmbH
Oliver Loose
Telefon: +4930285010110

Lieferadresse:
Eichhornstraße 3
10785 Berlin

Lieferdatum: 30.07.2026
Lieferzeit: 9:00
Event Datum: 30.07.2026
Event Beginn: 9:30

Bezeichnung Menge Einzelpreis (Netto) Betrag (Netto)

10er Lachs Canape
1 € 23,9 23.9

10er Camembert Canape
1 € 22,9 22.9

10er Bruschetta Canape

-- 2 of 3 --
Edis Gastrobetriebe GmbH & Co.KG
Goerzallee 299
14167 Berlin
Bezeichnung Menge Einzelpreis (Netto) Betrag (Netto)

1 € 22,9 22.9

Mini Veggie Pizza ( 12 Stück)
1 € 26,9 26.9

Mini Pizza Tonno ( 12 Stück )
1 € 33,9 33.9

Mini Burger Platte ( 10 Stück)
1 € 49,9 49.9

Donauwelle
6 € 4,2 25.2

Muffin Schoko (vegan)
5 € 3,9 19.5

Bunte Obstbecher
11 € 5,7 62.7

kein Schweinefleisch
Beschilderung auf DE + EN
Nuss, Erdbeeren
Lieferkosten
1 € 27,5 27.5

Gesamtbetrag Netto € 315,30
Umsatzsteuer 7% € 22,07
Gesamtbestellwert € 337,37
`;

    const result = extractUniversalOrder(text);

    expect(result.items).toHaveLength(10);

    expect(
      result.items.reduce(
        (sum, item) =>
          sum + item.totalCents,
        0
      )
    ).toBe(31530);

    expect(
      result.items.some(
        (item) =>
          item.name === "10er Bruschetta Canape"
      )
    ).toBe(true);

    const deliveryItem = result.items.find(
      (item) =>
        item.totalCents === 2750
    );

    expect(deliveryItem?.name).toBe("Lieferkosten");
    expect(deliveryItem?.name).not.toContain(
      "Schweinefleisch"
    );
    expect(deliveryItem?.name).not.toContain(
      "Beschilderung"
    );
  });

  it("erkennt bei On Running reguläre Mengen sowie eine zusätzliche Zuschlagsposition", () => {
    const text = `
2026-260262 - Fast Track Order bestätigt

Der Kunde On Running hat Dein Angebot gebucht.

Kunde:
On Running
Kontaktperson

Lieferadresse:
Köpenicker Straße 122
10179 Berlin

Lieferdatum: 13.08.2026
Lieferzeit: 8:00
Event Datum: 13.08.2026
Event Beginn: 8:30

Bezeichnung Menge Einzelpreis (Netto) Betrag (Netto)

Frühstück
Frühstücksbuffet für die Mitarbeitenden
Frühstück 100 € 12 1200.0

Bitte mit mehr Rührei planen 80 € 1 80.0

Lieferung und Abholung
1 € 68 68.0
`;

    const result = extractUniversalOrder(text);

    expect(result.items).toHaveLength(3);

    const breakfast = result.items.find(
      (item) =>
        item.name === "Frühstück"
    );

    expect(breakfast).toMatchObject({
      quantity: 100,
      unitCents: 1200,
      totalCents: 120000,
    });

    const scrambledEggSurcharge =
      result.items.find(
        (item) =>
          item.name ===
          "Bitte mit mehr Rührei planen"
      );

    expect(scrambledEggSurcharge).toMatchObject({
      quantity: 1,
      unitCents: 8000,
      totalCents: 8000,
    });

    const delivery = result.items.find(
      (item) =>
        item.name ===
        "Lieferung und Abholung"
    );

    expect(delivery).toMatchObject({
      quantity: 1,
      unitCents: 6800,
      totalCents: 6800,
    });

    expect(
      result.items.reduce(
        (sum, item) =>
          sum + item.totalCents,
        0
      )
    ).toBe(134800);
  });
});