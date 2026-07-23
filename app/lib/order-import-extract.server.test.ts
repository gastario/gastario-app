import { describe, expect, it } from "vitest";

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

    expect(result.customerName).toBe("On Cloud Service GmbH");
    expect(result.customerName).not.toContain("Sesambagel");
    expect(result.contactName).toBe("Frau Elin Vorbrodt");
    expect(result.deliveryDate).toBe("30.07.2026");
  });
});