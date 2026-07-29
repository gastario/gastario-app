import { prisma } from "./prisma.server";
import {
  getSupplierConnector,
  resolveSupplierProviderCode,
  type SupplierAvailabilityRecord,
  type SupplierCatalogRecord,
  type SupplierConnectorContext,
  type SupplierConnectorSettings,
  type SupplierPriceRecord,
} from "./supplier-connectors.server";

/*
 * gastario-supplier-sync-service-20260729
 *
 * Gemeinsamer Synchronisierungsdienst fuer Lieferantenkataloge,
 * Tagespreise und Verfuegbarkeiten.
 *
 * Es werden ausschliesslich Daten gespeichert, die ein offizieller
 * Lieferanten-Connector tatsaechlich zurueckliefert.
 */

export type SupplierSyncMode =
  | "FULL"
  | "PRICES"
  | "AVAILABILITY"
  | "LIVE_CHECK";

export type SupplierSyncResult = {
  ok: boolean;
  connectionId: string;
  syncRunId: string;
  providerCode: string;
  providerName: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  message: string;
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
  pricesCreated: number;
  errorsCount: number;
};

type LoadedSupplierConnection = {
  id: string;
  tenantId: string;
  supplierId: string;
  customerNumber: string | null;
  endpointUrl: string | null;
  settingsJson: unknown;
  syncIntervalMinutes: number;
  lastSuccessfulSyncAt: Date | null;
  active: boolean;
  supplier: {
    id: string;
    name: string;
    active: boolean;
  };
};

function getSettings(
  value: unknown
): SupplierConnectorSettings {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as SupplierConnectorSettings;
}

function createNextSyncAt(
  intervalMinutes: number
) {
  const safeMinutes = Math.max(
    60,
    Number(intervalMinutes || 1440)
  );

  return new Date(
    Date.now() + safeMinutes * 60 * 1000
  );
}

function cleanOptionalText(
  value: unknown
) {
  const text = String(value || "").trim();

  return text || null;
}

function cleanPositiveNumber(
  value: unknown,
  fallback: number | null = null
) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function createConnectorContext(
  connection: LoadedSupplierConnection
): SupplierConnectorContext {
  const settings = getSettings(
    connection.settingsJson
  );

  return {
    tenantId: connection.tenantId,
    supplierId: connection.supplierId,
    connectionId: connection.id,
    customerNumber:
      connection.customerNumber ||
      settings.customerNumber ||
      null,
    endpointUrl:
      connection.endpointUrl ||
      settings.endpointUrl ||
      null,
    settings,
  };
}

async function findExistingCatalogItem(params: {
  tenantId: string;
  supplierId: string;
  externalArticleId: string;
  articleNumber?: string | null;
  ean?: string | null;
}) {
  const {
    tenantId,
    supplierId,
    externalArticleId,
    articleNumber,
    ean,
  } = params;

  const conditions: any[] = [];

  if (externalArticleId) {
    conditions.push({
      externalId: externalArticleId,
    });
  }

  if (articleNumber) {
    conditions.push({
      articleNumber,
    });
  }

  if (ean) {
    conditions.push({
      ean,
    });
  }

  if (conditions.length === 0) {
    return null;
  }

  return prisma.supplierCatalogItem.findFirst({
    where: {
      tenantId,
      supplierId,
      OR: conditions,
    },
  });
}

async function saveCatalogRecord(params: {
  connection: LoadedSupplierConnection;
  record: SupplierCatalogRecord;
}) {
  const { connection, record } = params;

  const externalArticleId = String(
    record.externalArticleId || ""
  ).trim();

  const articleNumber = cleanOptionalText(
    record.articleNumber
  );

  const ean = cleanOptionalText(record.ean);

  if (!externalArticleId && !articleNumber && !ean) {
    throw new Error(
      "Katalogartikel ohne externe Kennung empfangen."
    );
  }

  const name = String(record.name || "").trim();

  if (!name) {
    throw new Error(
      "Katalogartikel ohne Namen empfangen."
    );
  }

  const existing =
    await findExistingCatalogItem({
      tenantId: connection.tenantId,
      supplierId: connection.supplierId,
      externalArticleId,
      articleNumber,
      ean,
    });

  const data = {
    connectionId: connection.id,
    externalId: externalArticleId || null,
    articleNumber,
    ean,
    name,
    brand: cleanOptionalText(record.brand),
    description: cleanOptionalText(
      record.description
    ),
    orderUnit: cleanOptionalText(
      record.purchaseUnit
    ),
    packageQuantity: cleanPositiveNumber(
      record.packageQuantity
    ),
    minimumOrderQuantity:
      cleanPositiveNumber(
        (record as any).minimumOrderQuantity,
        1
      ) || 1,
    active: record.active !== false,
    lastSeenAt: new Date(),
  };

  if (existing) {
    const updated =
      await prisma.supplierCatalogItem.update({
        where: {
          id: existing.id,
        },
        data,
      });

    return {
      item: updated,
      created: false,
    };
  }

  const created =
    await prisma.supplierCatalogItem.create({
      data: {
        tenantId: connection.tenantId,
        supplierId: connection.supplierId,
        ...data,
      },
    });

  return {
    item: created,
    created: true,
  };
}

async function findCatalogItemForExternalId(params: {
  connection: LoadedSupplierConnection;
  externalArticleId: string;
}) {
  const { connection, externalArticleId } =
    params;

  return prisma.supplierCatalogItem.findFirst({
    where: {
      tenantId: connection.tenantId,
      supplierId: connection.supplierId,
      connectionId: connection.id,
      OR: [
        {
          externalId: externalArticleId,
        },
        {
          articleNumber: externalArticleId,
        },
        {
          ean: externalArticleId,
        },
        {
          gtin: externalArticleId,
        },
      ],
    },
  });
}

async function savePriceRecord(params: {
  connection: LoadedSupplierConnection;
  record: SupplierPriceRecord;
}) {
  const { connection, record } = params;

  const externalArticleId = String(
    record.externalArticleId || ""
  ).trim();

  if (!externalArticleId) {
    throw new Error(
      "Preisdatensatz ohne Artikelkennung empfangen."
    );
  }

  const netPriceCents = Math.round(
    Number(record.priceCents)
  );

  if (
    !Number.isFinite(netPriceCents) ||
    netPriceCents < 0
  ) {
    throw new Error(
      "Ungueltiger Lieferantenpreis fuer Artikel " +
        externalArticleId +
        "."
    );
  }

  const catalogItem =
    await findCatalogItemForExternalId({
      connection,
      externalArticleId,
    });

  if (!catalogItem) {
    throw new Error(
      "Kein Katalogartikel fuer Preisdatensatz " +
        externalArticleId +
        " gefunden."
    );
  }

  return prisma.supplierPriceSnapshot.create({
    data: {
      tenantId: connection.tenantId,
      catalogItemId: catalogItem.id,
      netPriceCents,
      currency:
        String(record.currency || "EUR")
          .trim()
          .toUpperCase() || "EUR",
      minimumQuantity: cleanPositiveNumber(
        record.minimumOrderQuantity
      ),
      available:
        typeof record.available === "boolean"
          ? record.available
          : null,
      stockText: cleanOptionalText(
        record.stockText
      ),
      source: "API",
      validFrom:
        record.validFrom instanceof Date
          ? record.validFrom
          : new Date(),
      validUntil:
        record.validUntil instanceof Date
          ? record.validUntil
          : null,
      fetchedAt: new Date(),
    },
  });
}

async function saveAvailabilityRecord(params: {
  connection: LoadedSupplierConnection;
  record: SupplierAvailabilityRecord;
}) {
  const { connection, record } = params;

  const externalArticleId = String(
    record.externalArticleId || ""
  ).trim();

  if (!externalArticleId) {
    throw new Error(
      "Verfuegbarkeitsdatensatz ohne Artikelkennung empfangen."
    );
  }

  const catalogItem =
    await findCatalogItemForExternalId({
      connection,
      externalArticleId,
    });

  if (!catalogItem) {
    throw new Error(
      "Kein Katalogartikel fuer Verfuegbarkeit " +
        externalArticleId +
        " gefunden."
    );
  }

  const availabilityStatus =
    cleanOptionalText(record.stockText) ||
    (record.available
      ? "VERFUEGBAR"
      : "NICHT_VERFUEGBAR");

  await prisma.supplierCatalogItem.update({
    where: {
      id: catalogItem.id,
    },
    data: {
      availabilityStatus,
      lastSeenAt:
        record.checkedAt instanceof Date
          ? record.checkedAt
          : new Date(),
    },
  });
}

async function completeFailedSync(params: {
  connection: LoadedSupplierConnection;
  syncRunId: string;
  providerCode: string;
  providerName: string;
  message: string;
  state?: string | null;
  errorsCount?: number;
}) {
  const {
    connection,
    syncRunId,
    providerCode,
    providerName,
    message,
    state,
    errorsCount = 1,
  } = params;

  const finishedAt = new Date();
  const nextSyncAt = createNextSyncAt(
    connection.syncIntervalMinutes
  );

  await prisma.$transaction([
    prisma.supplierSyncRun.update({
      where: {
        id: syncRunId,
      },
      data: {
        status: "FAILED",
        finishedAt,
        errorsCount,
        errorMessage: message,
        detailsJson: {
          providerCode,
          providerName,
          connectorState: state || "ERROR",
        },
      },
    }),

    prisma.supplierConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        lastSyncAt: finishedAt,
        nextSyncAt,
        lastError: message,
      },
    }),
  ]);

  return {
    ok: false,
    connectionId: connection.id,
    syncRunId,
    providerCode,
    providerName,
    status: "FAILED",
    message,
    itemsSeen: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    pricesCreated: 0,
    errorsCount,
  } satisfies SupplierSyncResult;
}

export async function runSupplierSync(params: {
  connectionId: string;
  tenantId?: string;
  mode?: SupplierSyncMode;
  externalArticleIds?: string[];
}): Promise<SupplierSyncResult> {
  const connectionId = String(
    params.connectionId || ""
  ).trim();

  if (!connectionId) {
    throw new Error(
      "SupplierConnection-ID fehlt."
    );
  }

  const connection =
    await prisma.supplierConnection.findFirst({
      where: {
        id: connectionId,
        ...(params.tenantId
          ? {
              tenantId: params.tenantId,
            }
          : {}),
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
    });

  if (!connection) {
    throw new Error(
      "Lieferantenverbindung nicht gefunden."
    );
  }

  const loadedConnection =
    connection as LoadedSupplierConnection;

  const settings = getSettings(
    loadedConnection.settingsJson
  );

  const providerCode =
    resolveSupplierProviderCode(
      settings,
      loadedConnection.supplier.name
    );

  const connector =
    getSupplierConnector(providerCode);

  const syncRun =
    await prisma.supplierSyncRun.create({
      data: {
        tenantId: loadedConnection.tenantId,
        connectionId: loadedConnection.id,
        status: "RUNNING",
        detailsJson: {
          mode: params.mode || "FULL",
          providerCode:
            connector.providerCode,
          providerName:
            connector.providerName,
        },
      },
    });

  if (
    !loadedConnection.active ||
    !loadedConnection.supplier.active
  ) {
    return completeFailedSync({
      connection: loadedConnection,
      syncRunId: syncRun.id,
      providerCode:
        connector.providerCode,
      providerName:
        connector.providerName,
      state: "INACTIVE",
      message:
        "Die Lieferantenverbindung oder der Lieferant ist deaktiviert.",
    });
  }

  const context = createConnectorContext(
    loadedConnection
  );

  try {
    const connectionCheck =
      await connector.testConnection(context);

    if (!connectionCheck.ok) {
      return completeFailedSync({
        connection: loadedConnection,
        syncRunId: syncRun.id,
        providerCode:
          connectionCheck.providerCode,
        providerName:
          connectionCheck.providerName,
        state: connectionCheck.state,
        message: connectionCheck.message,
      });
    }

    const mode = params.mode || "FULL";

    let catalogRecords: SupplierCatalogRecord[] =
      [];

    let priceRecords: SupplierPriceRecord[] = [];

    let availabilityRecords:
      SupplierAvailabilityRecord[] = [];

    if (mode === "FULL") {
      catalogRecords =
        await connector.fetchCatalog(context);
    }

    if (
      mode === "FULL" ||
      mode === "PRICES" ||
      mode === "LIVE_CHECK"
    ) {
      priceRecords =
        await connector.fetchPrices(
          context,
          params.externalArticleIds
        );
    }

    if (
      mode === "FULL" ||
      mode === "AVAILABILITY" ||
      mode === "LIVE_CHECK"
    ) {
      availabilityRecords =
        await connector.fetchAvailability(
          context,
          params.externalArticleIds
        );
    }

    let itemsCreated = 0;
    let itemsUpdated = 0;
    let pricesCreated = 0;
    let errorsCount = 0;

    const errors: string[] = [];

    for (const record of catalogRecords) {
      try {
        const saved =
          await saveCatalogRecord({
            connection: loadedConnection,
            record,
          });

        if (saved.created) {
          itemsCreated += 1;
        } else {
          itemsUpdated += 1;
        }
      } catch (error: any) {
        errorsCount += 1;
        errors.push(
          String(error?.message || error)
        );
      }
    }

    for (const record of priceRecords) {
      try {
        await savePriceRecord({
          connection: loadedConnection,
          record,
        });

        pricesCreated += 1;
      } catch (error: any) {
        errorsCount += 1;
        errors.push(
          String(error?.message || error)
        );
      }
    }

    for (
      const record of availabilityRecords
    ) {
      try {
        await saveAvailabilityRecord({
          connection: loadedConnection,
          record,
        });
      } catch (error: any) {
        errorsCount += 1;
        errors.push(
          String(error?.message || error)
        );
      }
    }

    const finishedAt = new Date();

    const nextSyncAt = createNextSyncAt(
      loadedConnection.syncIntervalMinutes
    );

    const status =
      errorsCount === 0
        ? "SUCCESS"
        : "PARTIAL";

    const message =
      status === "SUCCESS"
        ? "Lieferantendaten wurden erfolgreich synchronisiert."
        : "Die Synchronisierung wurde mit einzelnen Fehlern abgeschlossen.";

    await prisma.$transaction([
      prisma.supplierSyncRun.update({
        where: {
          id: syncRun.id,
        },
        data: {
          status,
          finishedAt,
          itemsSeen:
            catalogRecords.length,
          itemsCreated,
          itemsUpdated,
          pricesCreated,
          errorsCount,
          errorMessage:
            errors.length > 0
              ? errors.slice(0, 5).join(" | ")
              : null,
          detailsJson: {
            mode,
            providerCode:
              connector.providerCode,
            providerName:
              connector.providerName,
            catalogRecords:
              catalogRecords.length,
            priceRecords:
              priceRecords.length,
            availabilityRecords:
              availabilityRecords.length,
            errors: errors.slice(0, 20),
          },
        },
      }),

      prisma.supplierConnection.update({
        where: {
          id: loadedConnection.id,
        },
        data: {
          lastSyncAt: finishedAt,
          lastSuccessfulSyncAt:
            status === "SUCCESS"
              ? finishedAt
              : loadedConnection.lastSuccessfulSyncAt,
          nextSyncAt,
          lastError:
            errors.length > 0
              ? errors.slice(0, 5).join(" | ")
              : null,
        },
      }),
    ]);

    return {
      ok: status === "SUCCESS",
      connectionId:
        loadedConnection.id,
      syncRunId: syncRun.id,
      providerCode:
        connector.providerCode,
      providerName:
        connector.providerName,
      status,
      message,
      itemsSeen: catalogRecords.length,
      itemsCreated,
      itemsUpdated,
      pricesCreated,
      errorsCount,
    };
  } catch (error: any) {
    const message =
      String(error?.message || error) ||
      "Unbekannter Synchronisierungsfehler.";

    return completeFailedSync({
      connection: loadedConnection,
      syncRunId: syncRun.id,
      providerCode:
        connector.providerCode,
      providerName:
        connector.providerName,
      state: "ERROR",
      message,
    });
  }
}