import { prisma } from "./prisma.server";
import { buildSupplierCatalogSearchTokens } from "./supplier-search-index.server";

function normalizeProviderCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}

async function findExistingTenantCatalogItem(params: {
  tenantId: string;
  supplierId: string;
  globalItemId: string;
  externalId?: string | null;
  articleNumber?: string | null;
  ean?: string | null;
  gtin?: string | null;
}) {
  const {
    tenantId,
    supplierId,
    globalItemId,
    externalId,
    articleNumber,
    ean,
    gtin,
  } = params;

  const byGlobal =
    await prisma.supplierCatalogItem.findFirst({
      where: {
        tenantId,
        supplierId,
        globalCatalogItemId:
          globalItemId,
      },
    });

  if (byGlobal) {
    return byGlobal;
  }

  const or: Record<string, unknown>[] = [];

  if (externalId) {
    or.push({
      externalId,
    });
  }

  if (articleNumber) {
    or.push({
      articleNumber,
    });
  }

  if (ean) {
    or.push({
      ean,
    });
  }

  if (gtin) {
    or.push({
      gtin,
    });
  }

  if (or.length === 0) {
    return null;
  }

  return prisma.supplierCatalogItem.findFirst({
    where: {
      tenantId,
      supplierId,
      OR: or,
    },
  });
}

export async function materializeGlobalSupplierCatalog(params: {
  tenantId: string;
  supplierId: string;
  providerCode: string;
  connectionId?: string | null;
  onlyActive?: boolean;
  limit?: number;
}) {
  const providerCode =
    normalizeProviderCode(
      params.providerCode
    );

  if (!providerCode) {
    throw new Error(
      "Provider-Code fehlt."
    );
  }

  const supplier =
    await prisma.supplier.findFirst({
      where: {
        id: params.supplierId,
        tenantId: params.tenantId,
      },
      select: {
        id: true,
        active: true,
      },
    });

  if (!supplier) {
    throw new Error(
      "Lieferant wurde nicht gefunden."
    );
  }

  if (params.connectionId) {
    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: params.connectionId,
          tenantId: params.tenantId,
          supplierId: params.supplierId,
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

  const safeLimit = Math.min(
    25_000,
    Math.max(
      1,
      Math.floor(
        Number(params.limit) || 10_000
      )
    )
  );

  const globalItems =
    await prisma.globalSupplierCatalogItem.findMany({
      where: {
        providerCode,
        ...(params.onlyActive === false
          ? {}
          : {
              active: true,
            }),
      },
      orderBy: [
        {
          name: "asc",
        },
        {
          id: "asc",
        },
      ],
      take: safeLimit,
    });

  let created = 0;
  let updated = 0;
  let linkedExisting = 0;
  let skipped = 0;

  const materializedAt =
    new Date();

  for (const globalItem of globalItems) {
    const existing =
      await findExistingTenantCatalogItem({
        tenantId:
          params.tenantId,
        supplierId:
          params.supplierId,
        globalItemId:
          globalItem.id,
        externalId:
          globalItem.externalId,
        articleNumber:
          globalItem.articleNumber,
        ean:
          globalItem.ean,
        gtin:
          globalItem.gtin,
      });

    const data = {
      connectionId:
        params.connectionId || null,
      globalCatalogItemId:
        globalItem.id,
      externalId:
        globalItem.externalId,
      articleNumber:
        globalItem.articleNumber,
      ean:
        globalItem.ean,
      gtin:
        globalItem.gtin,
      name:
        globalItem.name,
      brand:
        globalItem.brand,
      description:
        globalItem.description,
      orderUnit:
        globalItem.orderUnit,
      baseUnit:
        globalItem.baseUnit,
      contentQuantity:
        globalItem.contentQuantity,
      packageQuantity:
        globalItem.packageQuantity,
      searchTokens:
        buildSupplierCatalogSearchTokens({
          providerCode,
          name:
            globalItem.name,
          brand:
            globalItem.brand,
          description:
            globalItem.description,
          externalId:
            globalItem.externalId,
          articleNumber:
            globalItem.articleNumber,
          ean:
            globalItem.ean,
          gtin:
            globalItem.gtin,
          orderUnit:
            globalItem.orderUnit,
          baseUnit:
            globalItem.baseUnit,
        }),
      active:
        globalItem.active,
      lastSeenAt:
        materializedAt,
    };

    if (existing) {
      const wasAlreadyLinked =
        existing.globalCatalogItemId ===
        globalItem.id;

      await prisma.supplierCatalogItem.update({
        where: {
          id: existing.id,
        },
        data,
      });

      if (wasAlreadyLinked) {
        updated += 1;
      } else {
        linkedExisting += 1;
      }

      continue;
    }

    if (!globalItem.name.trim()) {
      skipped += 1;
      continue;
    }

    await prisma.supplierCatalogItem.create({
      data: {
        tenantId:
          params.tenantId,
        supplierId:
          params.supplierId,
        ...data,
      },
    });

    created += 1;
  }

  return {
    providerCode,
    globalItems:
      globalItems.length,
    created,
    updated,
    linkedExisting,
    skipped,
    materializedAt,
  };
}
