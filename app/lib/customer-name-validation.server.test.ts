import { describe, expect, it } from "vitest";
import {
  isReliableCustomerCandidate,
  resolveReliableCustomerName,
} from "./customer-name-validation.server";

describe("customer name validation", () => {
  it("erkennt den Kunden aus einem strukturierten Kundenblock", () => {
    const result = resolveReliableCustomerName({
      text: `
        Kunde:
        On Cloud Service GmbH
        Frau Elin Vorbrodt
        Telefon: +45 78 15 26 74
        Lieferadresse:
        Köpenicker Straße 122
        10179 Berlin
      `,
      parserCustomerName:
        "4x halbierte Sesambagel Frischkäse, Gouda-Käse,",
      items: [
        {
          name: "16er halbierte Bagelplatte",
          description:
            "4x halbierte Sesambagel Frischkäse, Gouda-Käse",
        },
      ],
    });

    expect(result).toBe("On Cloud Service GmbH");
  });

  it("erkennt den Kunden aus dem E-Mail-Satz", () => {
    const result = resolveReliableCustomerName({
      text:
        "Der Kunde On Cloud Service GmbH hat Dein Angebot gebucht.",
      parserCustomerName: "",
      items: [],
    });

    expect(result).toBe("On Cloud Service GmbH");
  });

  it("lehnt eine Mengen- und Produktzeile als Kunde ab", () => {
    expect(
      isReliableCustomerCandidate(
        "4x halbierte Sesambagel Frischkäse, Gouda-Käse,"
      )
    ).toBe(false);
  });

  it("lehnt eine Auftragsposition als Kunde ab", () => {
    const result = resolveReliableCustomerName({
      text: "Auftragsbestätigung",
      parserCustomerName: "Erdbeer Schnitte ( vegan )",
      items: [
        {
          name: "Erdbeer Schnitte ( vegan )",
        },
      ],
    });

    expect(result).toBe("");
  });

  it("lehnt eine Adresse als Kunde ab", () => {
    expect(
      isReliableCustomerCandidate(
        "Köpenicker Straße 122"
      )
    ).toBe(false);
  });

  it("lehnt eine Registerzeile als Kunde ab", () => {
    expect(
      isReliableCustomerCandidate(
        "HR B 168352 B Registergericht Berlin"
      )
    ).toBe(false);
  });

  it("übernimmt einen unbekannten plausiblen Firmennamen", () => {
    const result = resolveReliableCustomerName({
      text: "Firma: Beispiel Catering Solutions GmbH",
      parserCustomerName: "",
      items: [],
    });

    expect(result).toBe("Beispiel Catering Solutions GmbH");
  });

  it("liefert bei unsicherem Namen keinen falschen Kunden", () => {
    const result = resolveReliableCustomerName({
      text: "Neue Catering-Anfrage",
      parserCustomerName: "Frisches Gemüse",
      items: [],
    });

    expect(result).toBe("");
  });
});