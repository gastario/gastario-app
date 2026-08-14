import { prisma } from "./prisma.server";
import {
  parseSupplierCatalogCsv,
  type SupplierCatalogImportPreview,
  type SupplierCatalogImportRow,
} from "./supplier-catalog-import.server";
import { buildSupplierCatalogSearchTokens } from "./supplier-search-index.server";

function normalizeProviderCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}

export function parseGlobalSupplierCatalogCsv(
  csvText: string
): SupplierCatalogImportPreview {
  return parseSupplierCatalogCsv(csvText);
}

async function findExistingGlobalCatalogItem(
  params: {
    providerCode: string;
    row: SupplierCatalogImportRow;
  }
) {
  const {
    providerCode,
    row,
  } = params;

  const or: Record<string, unknown>[] = [];

  if (row.externalId) {
    or.push({
      externalId: row.externalId,
    });
  }

  if (row.articleNumber) {
    or.push({
      articleNumber: row.articleNumber,
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
      await prisma.globalSupplierCatalogItem.findFirst({
        where: {
          providerCode,
          OR: or,
        },
      });

    if (exact) {
      return exact;
    }
  }

  return prisma.globalSupplierCatalogItem.findFirst({
    where: {
      providerCode,
      name: row.name,
      brand: row.brand,
      orderUnit: row.orderUnit,
    },
  });
}

export async function importGlobalSupplierCatalogRows(
  params: {
    providerCode: string;
    rows: SupplierCatalogImportRow[];
  }
) {
  const providerCode =
    normalizeProviderCode(
      params.providerCode
    );

  if (!providerCode) {
    throw new Error(
      "Provider-Code fehlt."
    );
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
    const name =
      String(
        row.name || ""
      ).trim();

    if (!name) {
      skipped += 1;
      continue;
    }

    const existing =
      await findExistingGlobalCatalogItem({
        providerCode,
        row,
      });

    const data = {
      providerCode,
      externalId:
        row.externalId,
      articleNumber:
        row.articleNumber,
      ean: row.ean,
      gtin: row.gtin,
      name,
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
          providerCode,
          name,
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
      await prisma.globalSupplierCatalogItem.update({
        where: {
          id: existing.id,
        },
        data,
      });

      updated += 1;
      continue;
    }

    await prisma.globalSupplierCatalogItem.create({
      data,
    });

    created += 1;
  }

  return {
    providerCode,
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
