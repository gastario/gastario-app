import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { buildSupplierCatalogSearchTokens } from "./supplier-search-index.server";

type MetroInvoicePosition = {
  articleNumber: string;
  ean: string | null;
  name: string;
  netPriceCents: number;
  quantity: number | null;
  totalCents: number | null;
};

function normalizeArticleNumber(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

function parseGermanMoneyToCents(value: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function isMetroInvoice(text: string) {
  const normalized = String(text || "").toUpperCase();

  return (
    normalized.includes("METRO DEUTSCHLAND GMBH") &&
    normalized.includes("RECHNUNGS-NR.") &&
    normalized.includes("ART.-NR") &&
    normalized.includes("EAN")
  );
}

export function parseMetroInvoiceNumber(text: string) {
  const value = String(text || "");

  const patterns = [
    /RECHNUNGS-NR\.?\s*:?\s*([A-Z0-9\-\/]+)/i,
    /RECHNUNGSNUMMER\s*:?\s*([A-Z0-9\-\/]+)/i,
    /RECHNUNG\s*NR\.?\s*:?\s*([A-Z0-9\-\/]+)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export function parseMetroInvoiceDate(text: string) {
  const value = String(text || "");

  const patterns = [
    /Rechnungsdatum\s*:?\s*(\d{2}\.\d{2}\.\d{4})/i,
    /Rechnungs-Datum\s*:?\s*(\d{2}\.\d{2}\.\d{4})/i,
    /Rechnung\s+vom\s+(\d{2}\.\d{2}\.\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (!match) {
      continue;
    }

    const [day, month, year] =
      match[1].split(".").map(Number);

    const date = new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    );

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

export function parseMetroInvoicePositions(
  text: string
): MetroInvoicePosition[] {
  if (!isMetroInvoice(text)) {
    return [];
  }

  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  const positions: MetroInvoicePosition[] = [];

  /*
   * Beispiel:
   * 268831.5 4002911810064 250 HOLZSPIESS RED PEARL 7cm PG 7,490 1 7,49 1 7,49 A 7,490
   *
   * Wichtig:
   * Wir nehmen zunächst nur Zeilen mit eindeutiger
   * METRO-Artikelnr + 13-stelliger EAN.
   */
  const linePattern =
    /^(\d{6}\.\d)\s+(\d{13})\s+(.+?)\s+([A-Z]{1,3})\s+(\d+,\d{2,3})\s+(\d+(?:,\d+)?)\s+(\d+,\d{2})\s+(\d+(?:,\d+)?)\s+(\d+,\d{2})\s+[A-Z]\s+(\d+,\d{2,3})(?:\s*\*)?$/i;

  for (const line of lines) {
    const match = line.match(linePattern);

    if (!match) {
      continue;
    }

    const [
      ,
      rawArticleNumber,
      rawEan,
      rawName,
      ,
      rawSinglePrice,
      ,
      ,
      rawQuantity,
      rawTotal,
      rawCustomerPrice,
    ] = match;

    const customerPriceCents =
      parseGermanMoneyToCents(rawCustomerPrice);

    const fallbackSinglePriceCents =
      parseGermanMoneyToCents(rawSinglePrice);

    const netPriceCents =
      customerPriceCents ??
      fallbackSinglePriceCents;

    if (
      netPriceCents == null ||
      netPriceCents <= 0
    ) {
      continue;
    }

    const quantity = Number(
      String(rawQuantity).replace(",", ".")
    );

    positions.push({
      articleNumber:
        normalizeArticleNumber(rawArticleNumber),
      ean: rawEan || null,
      name: rawName.trim(),
      netPriceCents,
      quantity:
        Number.isFinite(quantity)
          ? quantity
          : null,
      totalCents:
        parseGermanMoneyToCents(rawTotal),
    });
  }

  return positions;
}

export async function learnSupplierPricesFromInvoice({
  prisma,
  tenantId,
  text,
}: {
  prisma: PrismaClient;
  tenantId: string;
  text: string;
}) {
  const parsedInvoiceDate = parseMetroInvoiceDate(text);
  const invoiceDate = parsedInvoiceDate || new Date();
  const invoiceNumber = parseMetroInvoiceNumber(text);
  const invoiceDocumentKey = invoiceNumber
    ? `METRO:${invoiceNumber}`
    : `METRO-HASH:${createHash("sha256")
        .update(text)
        .digest("hex")
        .slice(0, 24)}`;

  const positions =
    parseMetroInvoicePositions(text);

  if (positions.length === 0) {
    return {
      recognized: false,
      matched: 0,
      pricesCreated: 0,
      skipped: 0,
    };
  }

  const supplier =
    await prisma.supplier.findFirst({
      where: {
        tenantId,
        name: {
          contains: "METRO",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

  if (!supplier) {
    return {
      recognized: true,
      matched: 0,
      pricesCreated: 0,
      skipped: positions.length,
      supplierMissing: true,
      supplierMessage:
        "Kein METRO-Lieferant für diesen Mandanten gefunden.",
      skippedPositions: positions.map((position) => ({
        articleNumber: position.articleNumber,
        ean: position.ean,
        name: position.name,
        netPriceCents: position.netPriceCents,
        reason:
          "METRO-Lieferant im Mandanten nicht gefunden.",
      })),
    };
  }

  let matched = 0;
  let pricesCreated = 0;
  let skipped = 0;
  const skippedPositions: any[] = [];

  for (const position of positions) {
    let catalogItem =
      await prisma.supplierCatalogItem.findFirst({
        where: {
          tenantId,
          supplierId: supplier.id,
          OR: [
            {
              articleNumber:
                position.articleNumber,
            },
            ...(position.ean
              ? [
                  {
                    ean: position.ean,
                  },
                ]
              : []),
          ],
        },
        select: {
          id: true,
        },
      });

    if (!catalogItem) {
      const globalItem =
        await prisma.globalSupplierCatalogItem.findFirst({
          where: {
            providerCode: "METRO",
            OR: [
              {
                articleNumber:
                  position.articleNumber,
              },
              ...(position.ean
                ? [
                    {
                      ean: position.ean,
                    },
                  ]
                : []),
            ],
          },
        });

      if (globalItem) {
        catalogItem =
          await prisma.supplierCatalogItem.create({
            data: {
              tenantId,
              supplierId: supplier.id,
              globalCatalogItemId: globalItem.id,
              externalId: globalItem.externalId,
              articleNumber: globalItem.articleNumber,
              ean: globalItem.ean,
              gtin: globalItem.gtin,
              name: globalItem.name,
              brand: globalItem.brand,
              description: globalItem.description,
              searchTokens: globalItem.searchTokens,
              orderUnit: globalItem.orderUnit,
              baseUnit: globalItem.baseUnit,
              contentQuantity: globalItem.contentQuantity,
              packageQuantity: globalItem.packageQuantity,
              active: globalItem.active,
              lastSeenAt: new Date(),
            },
            select: {
              id: true,
            },
          });
      }
    }

    if (!catalogItem) {
      catalogItem =
        await prisma.supplierCatalogItem.create({
          data: {
            tenantId,
            supplierId: supplier.id,
            articleNumber:
              position.articleNumber,
            ean:
              position.ean,
            gtin:
              position.ean,
            name:
              position.name,
            searchTokens:
              buildSupplierCatalogSearchTokens({
                providerCode: "METRO",
                name: position.name,
                articleNumber:
                  position.articleNumber,
                ean:
                  position.ean,
                gtin:
                  position.ean,
              }),
            active: true,
            lastSeenAt:
              invoiceDate,
          },
          select: {
            id: true,
          },
        });
    }

    matched += 1;

    const existingInvoicePrice =
      await prisma.supplierPriceSnapshot.findFirst({
        where: {
          tenantId,
          catalogItemId: catalogItem.id,
          source: "INVOICE",
          qualityReason: {
            contains: invoiceDocumentKey,
          },
        },
        select: {
          id: true,
        },
      });

    if (existingInvoicePrice) {
      continue;
    }

    await prisma.supplierPriceSnapshot.create({
      data: {
        tenantId,
        catalogItemId: catalogItem.id,
        netPriceCents:
          position.netPriceCents,
        currency: "EUR",
        priceUnitQuantity: 1,
        source: "INVOICE",
        qualityStatus: "VALID",
        qualityReason:
          `${invoiceDocumentKey} | Preis aus METRO-Rechnung über Artikelnummer oder EAN.`,
        qualityCheckedAt:
          new Date(),
        fetchedAt:
          invoiceDate,
        validFrom:
          invoiceDate,
      },
    });

    pricesCreated += 1;
  }

  return {
    recognized: true,
    matched,
    pricesCreated,
    skipped,
    skippedPositions,
  };
}


















