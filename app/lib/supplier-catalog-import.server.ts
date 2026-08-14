import { prisma } from "./prisma.server";
import { buildSupplierCatalogSearchTokens } from "./supplier-search-index.server";

export type SupplierCatalogImportRow = {
  rowNumber: number;
  externalId: string | null;
  articleNumber: string | null;
  ean: string | null;
  gtin: string | null;
  name: string;
  brand: string | null;
  description: string | null;
  orderUnit: string | null;
  baseUnit: string | null;
  packageQuantity: number | null;
  active: boolean;
  errors: string[];
  warnings: string[];
};

export type SupplierCatalogImportPreview = {
  rows: SupplierCatalogImportRow[];
  fatalError: string | null;
  summary: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
  };
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeHeader(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(
  headers: string[],
  aliases: string[]
) {
  const normalizedHeaders =
    headers.map(normalizeHeader);

  const normalizedAliases =
    aliases.map(normalizeHeader);

  return normalizedHeaders.findIndex(
    (header) =>
      normalizedAliases.includes(header)
  );
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const char = text[index];
    const next = text[index + 1];

    if (
      char === '"' &&
      quoted &&
      next === '"'
    ) {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (
      (char === ";" || char === ",") &&
      !quoted
    ) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (
      (char === "\n" || char === "\r") &&
      !quoted
    ) {
      if (
        char === "\r" &&
        next === "\n"
      ) {
        index += 1;
      }

      row.push(cell.trim());
      cell = "";

      if (
        row.some((value) =>
          value.trim()
        )
      ) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());

  if (
    row.some((value) =>
      value.trim()
    )
  ) {
    rows.push(row);
  }

  return rows;
}

function parsePositiveNumber(
  value: unknown
) {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");

  if (!raw) {
    return null;
  }

  const number = Number(raw);

  return Number.isFinite(number) &&
    number > 0
    ? number
    : null;
}

function parseActive(value: unknown) {
  const normalized =
    String(value ?? "")
      .trim()
      .toLocaleLowerCase("de-DE");

  if (!normalized) {
    return true;
  }

  if (
    [
      "ja",
      "yes",
      "true",
      "1",
      "aktiv",
      "active",
    ].includes(normalized)
  ) {
    return true;
  }

  if (
    [
      "nein",
      "no",
      "false",
      "0",
      "inaktiv",
      "inactive",
    ].includes(normalized)
  ) {
    return false;
  }

  return true;
}

function stableImportKey(
  row: SupplierCatalogImportRow
) {
  return (
    row.externalId ||
    row.articleNumber ||
    row.ean ||
    row.gtin ||
    [
      row.name.toLocaleLowerCase(
        "de-DE"
      ),
      row.brand
        ?.toLocaleLowerCase(
          "de-DE"
        ) || "",
      row.orderUnit
        ?.toLocaleLowerCase(
          "de-DE"
        ) || "",
    ].join("|")
  );
}

export function parseSupplierCatalogCsv(
  csvText: string
): SupplierCatalogImportPreview {
  const parsed = parseCsv(
    String(csvText || "")
      .replace(/^\uFEFF/, "")
  );

  if (parsed.length < 2) {
    return {
      rows: [],
      fatalError:
        "Die CSV braucht eine Kopfzeile und mindestens eine Artikelzeile.",
      summary: {
        total: 0,
        valid: 0,
        warnings: 0,
        errors: 0,
      },
    };
  }

  const headers = parsed[0];

  const nameIndex = findColumn(
    headers,
    [
      "name",
      "artikel",
      "artikelname",
      "produkt",
      "produktname",
      "bezeichnung",
    ]
  );

  const externalIdIndex =
    findColumn(
      headers,
      [
        "externalid",
        "externeid",
        "externeartikelid",
        "productid",
        "itemid",
      ]
    );

  const articleNumberIndex =
    findColumn(
      headers,
      [
        "artikelnummer",
        "artikelnr",
        "artnr",
        "sku",
        "article",
        "articlenumber",
      ]
    );

  const eanIndex = findColumn(
    headers,
    [
      "ean",
      "ean13",
      "barcode",
    ]
  );

  const gtinIndex = findColumn(
    headers,
    [
      "gtin",
      "gtin13",
      "gtin14",
    ]
  );

  const brandIndex = findColumn(
    headers,
    [
      "marke",
      "brand",
      "hersteller",
    ]
  );

  const descriptionIndex =
    findColumn(
      headers,
      [
        "beschreibung",
        "description",
        "text",
      ]
    );

  const orderUnitIndex =
    findColumn(
      headers,
      [
        "bestelleinheit",
        "orderunit",
        "einheit",
        "gebinde",
        "purchaseunit",
      ]
    );

  const baseUnitIndex =
    findColumn(
      headers,
      [
        "basiseinheit",
        "baseunit",
        "grundeinheit",
      ]
    );

  const packageQuantityIndex =
    findColumn(
      headers,
      [
        "packungsmenge",
        "packagequantity",
        "gebindemenge",
        "mengeprogebinde",
      ]
    );

  const activeIndex = findColumn(
    headers,
    [
      "aktiv",
      "active",
      "status",
    ]
  );

  if (nameIndex === -1) {
    return {
      rows: [],
      fatalError:
        "Spalte für Artikelname fehlt. Erlaubt sind z. B. name, artikel, artikelname, produktname oder bezeichnung.",
      summary: {
        total: 0,
        valid: 0,
        warnings: 0,
        errors: 0,
      },
    };
  }

  const seen = new Set<string>();

  const rows = parsed
    .slice(1)
    .map(
      (
        values,
        index
      ): SupplierCatalogImportRow => {
        const rowNumber =
          index + 2;

        const errors: string[] = [];
        const warnings: string[] = [];

        const name =
          String(
            values[nameIndex] || ""
          ).trim();

        const externalId =
          externalIdIndex >= 0
            ? cleanText(
                values[
                  externalIdIndex
                ]
              )
            : null;

        const articleNumber =
          articleNumberIndex >= 0
            ? cleanText(
                values[
                  articleNumberIndex
                ]
              )
            : null;

        const ean =
          eanIndex >= 0
            ? cleanText(
                values[
                  eanIndex
                ]
              )
            : null;

        const gtin =
          gtinIndex >= 0
            ? cleanText(
                values[
                  gtinIndex
                ]
              )
            : null;

        const brand =
          brandIndex >= 0
            ? cleanText(
                values[
                  brandIndex
                ]
              )
            : null;

        const description =
          descriptionIndex >= 0
            ? cleanText(
                values[
                  descriptionIndex
                ]
              )
            : null;

        const orderUnit =
          orderUnitIndex >= 0
            ? cleanText(
                values[
                  orderUnitIndex
                ]
              )
            : null;

        const baseUnit =
          baseUnitIndex >= 0
            ? cleanText(
                values[
                  baseUnitIndex
                ]
              )
            : null;

        const packageQuantity =
          packageQuantityIndex >= 0
            ? parsePositiveNumber(
                values[
                  packageQuantityIndex
                ]
              )
            : null;

        const active =
          activeIndex >= 0
            ? parseActive(
                values[
                  activeIndex
                ]
              )
            : true;

        if (!name) {
          errors.push(
            "Artikelname fehlt."
          );
        }

        if (
          !externalId &&
          !articleNumber &&
          !ean &&
          !gtin
        ) {
          warnings.push(
            "Keine externe Artikelkennung vorhanden; Abgleich erfolgt ersatzweise über Artikeldaten."
          );
        }

        const row: SupplierCatalogImportRow =
          {
            rowNumber,
            externalId,
            articleNumber,
            ean,
            gtin,
            name,
            brand,
            description,
            orderUnit,
            baseUnit,
            packageQuantity,
            active,
            errors,
            warnings,
          };

        const key =
          stableImportKey(row);

        if (
          key &&
          seen.has(key)
        ) {
          errors.push(
            "Artikel kommt in der Datei doppelt vor."
          );
        }

        if (key) {
          seen.add(key);
        }

        return row;
      }
    );

  return {
    rows,
    fatalError: null,
    summary: {
      total: rows.length,
      valid: rows.filter(
        (row) =>
          row.errors.length === 0
      ).length,
      warnings: rows.filter(
        (row) =>
          row.errors.length === 0 &&
          row.warnings.length > 0
      ).length,
      errors: rows.filter(
        (row) =>
          row.errors.length > 0
      ).length,
    },
  };
}

async function findExistingCatalogItem(
  params: {
    tenantId: string;
    supplierId: string;
    row: SupplierCatalogImportRow;
  }
) {
  const {
    tenantId,
    supplierId,
    row,
  } = params;

  const or: Record<
    string,
    unknown
  >[] = [];

  if (row.externalId) {
    or.push({
      externalId:
        row.externalId,
    });
  }

  if (row.articleNumber) {
    or.push({
      articleNumber:
        row.articleNumber,
    });
  }

  if (row.ean) {
    or.push({
      ean: row.ean,
    });
  }

  if (row.gtin) {
    or.push({
      gtin: row.gtin,
    });
  }

  if (or.length > 0) {
    const exact =
      await prisma.supplierCatalogItem.findFirst({
        where: {
          tenantId,
          supplierId,
          OR: or,
        },
      });

    if (exact) {
      return exact;
    }
  }

  return prisma.supplierCatalogItem.findFirst({
    where: {
      tenantId,
      supplierId,
      name: row.name,
      brand: row.brand,
      orderUnit: row.orderUnit,
    },
  });
}

export async function importSupplierCatalogRows(
  params: {
    tenantId: string;
    supplierId: string;
    connectionId?: string | null;
    rows: SupplierCatalogImportRow[];
  }
) {
  const {
    tenantId,
    supplierId,
    connectionId = null,
  } = params;

  const supplier =
    await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

  if (!supplier) {
    throw new Error(
      "Lieferant wurde nicht gefunden."
    );
  }

  if (connectionId) {
    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: connectionId,
          tenantId,
          supplierId,
        },
        select: {
          id: true,
        },
      });

    if (!connection) {
      throw new Error(
        "Lieferantenverbindung wurde nicht gefunden."
      );
    }
  }

  const validRows =
    params.rows.filter(
      (row) =>
        row.errors.length === 0
    );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  const importedAt = new Date();

  for (const row of validRows) {
    if (!row.name.trim()) {
      skipped += 1;
      continue;
    }

    const existing =
      await findExistingCatalogItem({
        tenantId,
        supplierId,
        row,
      });

    const data = {
      connectionId,
      externalId:
        row.externalId,
      articleNumber:
        row.articleNumber,
      ean: row.ean,
      gtin: row.gtin,
      name: row.name.trim(),
      brand: row.brand,
      description:
        row.description,
      orderUnit:
        row.orderUnit,
      baseUnit:
        row.baseUnit,
      packageQuantity:
        row.packageQuantity,
      searchTokens:
        buildSupplierCatalogSearchTokens({
          name: row.name,
          brand: row.brand,
          description:
            row.description,
          externalId:
            row.externalId,
          articleNumber:
            row.articleNumber,
          ean: row.ean,
          gtin: row.gtin,
          orderUnit:
            row.orderUnit,
          baseUnit:
            row.baseUnit,
        }),
      active: row.active,
      lastSeenAt: importedAt,
    };

    if (existing) {
      await prisma.supplierCatalogItem.update({
        where: {
          id: existing.id,
        },
        data,
      });

      updated += 1;
      continue;
    }

    await prisma.supplierCatalogItem.create({
      data: {
        tenantId,
        supplierId,
        ...data,
      },
    });

    created += 1;
  }

  return {
    total:
      params.rows.length,
    valid:
      validRows.length,
    created,
    updated,
    skipped,
    importedAt,
  };
}
