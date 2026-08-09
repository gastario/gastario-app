import { normalizeSupplierSearchTerm } from "../lib/supplier-search-index.server";
import {
  assessSupplierPriceQuality,
  autoResolveSuspiciousSupplierPrices,
} from "../lib/supplier-price-quality";
import { buildSupplierCatalogSearchTokens } from "../lib/supplier-search-index.server";
import {
  createHash,
} from "node:crypto";

import {
  parseSupplierBrowserConnectorCode,
  readBearerToken,
  verifySupplierBrowserConnectorCode,
} from "../lib/supplier-browser-connector.server";

const MAX_CAPTURE_ITEMS = 180;
const MAX_BODY_BYTES = 1_500_000;
const ALLOWED_PORTAL_HOSTS = new Set([
  "lieferservice.metro.de",
]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type",
    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type":
      "application/json; charset=utf-8",
  };
}

function json(
  data: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: corsHeaders(),
    }
  );
}

function asRecord(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readText(
  value: unknown,
  maxLength: number
) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function readInteger(
  value: unknown,
  minimum: number,
  maximum: number
) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < minimum ||
    number > maximum
  ) {
    return null;
  }

  return number;
}

function readPositiveNumber(
  value: unknown,
  maximum: number
) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0 ||
    number > maximum
  ) {
    return null;
  }

  return number;
}

function normalizePortalUrl(
  value: unknown
) {
  const text = readText(value, 2_000);

  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);

    if (
      url.protocol !== "https:" ||
      !ALLOWED_PORTAL_HOSTS.has(
        url.hostname.toLowerCase()
      )
    ) {
      return null;
    }

    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function deriveArticleNumber({
  explicitArticleNumber,
  externalId,
  productUrl,
  name,
}: {
  explicitArticleNumber: string;
  externalId: string;
  productUrl: string | null;
  name: string;
}) {
  const preferred =
    explicitArticleNumber || externalId;

  if (preferred) {
    return preferred
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  return (
    "METRO-WEB-" +
    createHash("sha256")
      .update(
        `${productUrl || ""}|${name}`,
        "utf8"
      )
      .digest("hex")
      .slice(0, 24)
  );
}

function parseCaptureProduct(
  value: unknown
) {
  const record = asRecord(value);
  const name = readText(record.name, 260);

  if (!name) {
    return null;
  }

  const productUrl = normalizePortalUrl(
    record.productUrl
  );

  const externalId = readText(
    record.externalId,
    140
  );

  const explicitArticleNumber = readText(
    record.articleNumber,
    140
  );

  const articleNumber = deriveArticleNumber({
    explicitArticleNumber,
    externalId,
    productUrl,
    name,
  });

  const netPriceCents = readInteger(
    record.netPriceCents,
    0,
    100_000_000
  );

  const grossPriceCents = readInteger(
    record.grossPriceCents,
    0,
    100_000_000
  );

  const available =
    typeof record.available === "boolean"
      ? record.available
      : null;

  const tiers = Array.isArray(record.tiers)
    ? record.tiers
        .slice(0, 10)
        .map((tierValue) => {
          const tier = asRecord(tierValue);
          const minimumQuantity =
            readPositiveNumber(
              tier.minimumQuantity,
              100_000
            );

          const tierNetPriceCents =
            readInteger(
              tier.netPriceCents,
              0,
              100_000_000
            );

          const tierGrossPriceCents =
            readInteger(
              tier.grossPriceCents,
              0,
              100_000_000
            );

          if (
            !minimumQuantity ||
            tierNetPriceCents === null
          ) {
            return null;
          }

          return {
            minimumQuantity,
            netPriceCents:
              tierNetPriceCents,
            grossPriceCents:
              tierGrossPriceCents,
            label: readText(tier.label, 120),
          };
        })
        .filter(Boolean)
    : [];

  return {
    name,
    articleNumber,
    externalId:
      externalId || articleNumber,
    productUrl,
    imageUrl: normalizePortalUrl(
      record.imageUrl
    ),
    orderUnit:
      readText(record.orderUnit, 80) ||
      null,
    packageText:
      readText(record.packageText, 180) ||
      null,
    availabilityText:
      readText(
        record.availabilityText,
        180
      ) || null,
    available,
    netPriceCents,
    grossPriceCents,
    currency:
      readText(record.currency, 8) ||
      "EUR",
    promotional:
      Boolean(record.promotional),
    tiers,
  };
}

async function authorizeConnector(
  request: Request
) {
  const { prisma } = await import(
    "../lib/prisma.server"
  );

  const code = readBearerToken(request);
  const parsed =
    parseSupplierBrowserConnectorCode(code);

  if (!parsed) {
    return {
      error: json(
        {
          ok: false,
          error:
            "Ungültiger Gastario-Verbindungscode.",
        },
        401
      ),
    };
  }

  const connection =
    await prisma.supplierConnection.findUnique({
      where: {
        id: parsed.connectionId,
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

  if (
    !connection ||
    !connection.active ||
    !connection.supplier.active
  ) {
    return {
      error: json(
        {
          ok: false,
          error:
            "Die Lieferantenverbindung ist nicht aktiv.",
        },
        403
      ),
    };
  }

  const settings = asRecord(
    connection.settingsJson
  );

  const providerCode = readText(
    settings.providerCode ||
      connection.label ||
      connection.supplier.name,
    80
  ).toUpperCase();

  if (providerCode !== "METRO") {
    return {
      error: json(
        {
          ok: false,
          error:
            "Dieser Browser-Connector ist nicht für METRO eingerichtet.",
        },
        403
      ),
    };
  }

  const valid =
    verifySupplierBrowserConnectorCode({
      connectionId: connection.id,
      secret: parsed.secret,
      expectedHash:
        settings.browserConnectorTokenHash,
    });

  if (!valid) {
    return {
      error: json(
        {
          ok: false,
          error:
            "Der Verbindungscode ist abgelaufen oder wurde widerrufen.",
        },
        401
      ),
    };
  }

  return {
    prisma,
    connection,
    settings,
  };
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  const authorization =
    await authorizeConnector(request);

  if ("error" in authorization) {
    return authorization.error;
  }

  const {
    prisma,
    connection,
    settings,
  } = authorization;

  const heartbeatAt = new Date();

  const rawSearchRequest =
    settings.browserConnectorSearchRequest &&
    typeof settings.browserConnectorSearchRequest ===
      "object" &&
    !Array.isArray(
      settings.browserConnectorSearchRequest
    )
      ? (settings.browserConnectorSearchRequest as Record<
          string,
          unknown
        >)
      : null;

  const searchRequestedAt =
    rawSearchRequest?.requestedAt
      ? new Date(
          String(rawSearchRequest.requestedAt)
        ).getTime()
      : 0;

  const searchRequestIsFresh =
    Number.isFinite(searchRequestedAt) &&
    searchRequestedAt > 0 &&
    heartbeatAt.getTime() - searchRequestedAt <
      90 * 1000;

  const activeSearchRequest =
    searchRequestIsFresh
      ? rawSearchRequest
      : null;

  const rawBackgroundSync =
    settings.browserBackgroundSync &&
    typeof settings.browserBackgroundSync ===
      "object" &&
    !Array.isArray(
      settings.browserBackgroundSync
    )
      ? (settings.browserBackgroundSync as Record<
          string,
          unknown
        >)
      : {};

  let effectiveSearchRequest =
    activeSearchRequest;

  let queuedBackgroundSync = false;

  let backgroundSyncState: Record<
    string,
    unknown
  > = {
    ...rawBackgroundSync,
  };

  /*
   * SUPPLIER INDEX V2
   *
   * Der Browser-Connector ist nur noch Hintergrund-Importer.
   * Er arbeitet ausschließlich ausdrücklich vorgemerkte
   * SupplierSearchDiscovery-Einträge ab.
   *
   * Keine Rotation mehr durch Zutaten, Aliase oder bekannte
   * Katalogartikel.
   */
  if (!effectiveSearchRequest) {
    const retryCutoff =
      new Date(
        heartbeatAt.getTime() -
          15 * 60 * 1000
      );

    const discovery =
      await prisma.supplierSearchDiscovery.findFirst({
        where: {
          tenantId:
            connection.tenantId,
          status: "PENDING",
          OR: [
            {
              lastProcessedAt: null,
            },
            {
              lastProcessedAt: {
                lte: retryCutoff,
              },
            },
          ],
        },
        select: {
          id: true,
          query: true,
          queryNormalized: true,
          priority: true,
          searchCount: true,
        },
        orderBy: [
          {
            priority: "desc",
          },
          {
            lastRequestedAt: "desc",
          },
        ],
      });

    const query =
      readText(
        discovery?.query,
        240
      ) ||
      readText(
        discovery?.queryNormalized,
        240
      );

    if (discovery && query) {
      const requestId =
        "metro-background-" +
        Date.now().toString(36) +
        "-" +
        Math.random()
          .toString(36)
          .slice(2, 10);

      effectiveSearchRequest = {
        id: requestId,
        query,
        originalQuery: query,
        queryTerms: [query],
        requestedAt:
          heartbeatAt.toISOString(),
        status: "PENDING",
        source: "BACKGROUND_SYNC",
        discoveryId:
          discovery.id,
      };

      backgroundSyncState = {
        ...rawBackgroundSync,
        enabled: true,
        mode: "DISCOVERY_ONLY",
        lastRequestedAt:
          heartbeatAt.toISOString(),
        lastQuery: query,
        currentRequestId:
          requestId,
        discoveryId:
          discovery.id,
      };

      queuedBackgroundSync = true;
    } else {
      backgroundSyncState = {
        ...rawBackgroundSync,
        enabled: true,
        mode: "DISCOVERY_ONLY",
        currentRequestId: null,
        discoveryId: null,
      };
    }
  }
  const updatedSettings = {
    ...settings,
    connectionMode:
      "LOCAL_BROWSER_EXTENSION",
    browserConnectorStatus: "ACTIVE",
    browserConnectorLastSeenAt:
      heartbeatAt.toISOString(),
    onboardingStatus:
      "BROWSER_CONNECTOR_ACTIVE",
    sessionStatus:
      "LOCAL_BROWSER_ACTIVE",
    automaticSync: true,
    browserBackgroundSync:
      backgroundSyncState,
    browserConnectorSearchRequest:
      effectiveSearchRequest,
  };

  await prisma.supplierConnection.update({
    where: {
      id: connection.id,
    },
    data: {
      status: "ACTIVE",
      lastError: null,
      nextSyncAt:
        queuedBackgroundSync
          ? new Date(
              heartbeatAt.getTime() +
                2 * 60 * 1000
            )
          : connection.nextSyncAt,
      settingsJson: updatedSettings as any,
    },
  });

  return json({
    ok: true,
    connection: {
      id: connection.id,
      supplierName:
        connection.supplier.name,
      providerCode: "METRO",
      customerNumber:
        connection.customerNumber || null,
      locationName:
        readText(
          settings.locationName,
          160
        ) || null,
      status: "ACTIVE",
      lastSeenAt:
        heartbeatAt.toISOString(),
      lastCaptureAt:
        readText(
          settings.browserConnectorLastCaptureAt,
          80
        ) || null,
      lastCaptureItems:
        readInteger(
          settings.browserConnectorLastCaptureItems,
          0,
          100_000
        ) || 0,
      searchRequest:
        effectiveSearchRequest,
    },
  });
}

export async function action({
  request,
}: {
  request: Request;
}) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== "POST") {
    return json(
      {
        ok: false,
        error: "Methode nicht erlaubt.",
      },
      405
    );
  }

  const contentLength = Number(
    request.headers.get("content-length") || 0
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    return json(
      {
        ok: false,
        error: "Die Übertragung ist zu groß.",
      },
      413
    );
  }

  const authorization =
    await authorizeConnector(request);

  if ("error" in authorization) {
    return authorization.error;
  }

  const {
    prisma,
    connection,
    settings,
  } = authorization;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "Die übertragenen Produktdaten sind ungültig.",
      },
      400
    );
  }

  const payload = asRecord(body);

  const searchRequestId = readText(
    payload.searchRequestId,
    160
  );

  const searchQuery = readText(
    payload.searchQuery,
    240
  );

  const searchQueryTokens =
    Array.from(
      new Set(
        normalizeSupplierSearchTerm(
          searchQuery
        )
          .split(" ")
          .map((token) =>
            token.trim()
          )
          .filter(
            (token) =>
              token.length >= 2
          )
      )
    );

  const captureComplete =
    payload.captureComplete !== false;

  const sourceUrl = normalizePortalUrl(
    payload.sourceUrl
  );

  if (!sourceUrl) {
    return json(
      {
        ok: false,
        error:
          "Die Daten müssen direkt von lieferservice.metro.de stammen.",
      },
      400
    );
  }

  const rawProducts = Array.isArray(
    payload.products
  )
    ? payload.products
    : [];

  if (
    rawProducts.length === 0 ||
    rawProducts.length > MAX_CAPTURE_ITEMS
  ) {
    return json(
      {
        ok: false,
        error:
          "Es wurden keine oder zu viele Produkte übertragen.",
      },
      400
    );
  }

  const products = rawProducts
    .map(parseCaptureProduct)
    .filter(Boolean) as Array<
      NonNullable<
        ReturnType<
          typeof parseCaptureProduct
        >
      >
    >;

  if (products.length === 0) {
    return json(
      {
        ok: false,
        error:
          "Auf der geöffneten METRO-Seite wurden keine verwertbaren Produkte erkannt.",
      },
      400
    );
  }

  const capturedAt = new Date();
  const locationName = readText(
    payload.locationName,
    160
  );

  const syncRun =
    await prisma.supplierSyncRun.create({
      data: {
        tenantId: connection.tenantId,
        connectionId: connection.id,
        status: "RUNNING",
        startedAt: capturedAt,
        detailsJson: {
          mode: "LOCAL_BROWSER_EXTENSION",
          sourceUrl,
          locationName:
            locationName || null,
          productsReceived:
            rawProducts.length,
          productsAccepted:
            products.length,
          captureComplete,
        },
      },
    });

  let itemsCreated = 0;
  let itemsUpdated = 0;
  let pricesCreated = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const existing =
        await prisma.supplierCatalogItem.findUnique({
          where: {
            supplierId_articleNumber: {
              supplierId:
                connection.supplierId,
              articleNumber:
                product.articleNumber,
            },
          },
          select: {
            id: true,
          },
        });

      const catalogItem =
        await prisma.supplierCatalogItem.upsert({
          where: {
            supplierId_articleNumber: {
              supplierId:
                connection.supplierId,
              articleNumber:
                product.articleNumber,
            },
          },
          create: {
            tenantId: connection.tenantId,
            supplierId:
              connection.supplierId,
            connectionId: connection.id,
            externalId: product.externalId,
            articleNumber:
              product.articleNumber,
            name: product.name,
            searchTokens:
              buildSupplierCatalogSearchTokens({
                name: product.name,
                description: product.productUrl,
                externalId: product.externalId,
                articleNumber: product.articleNumber,
                orderUnit: product.orderUnit,
                packageText: product.packageText,
              }),
            description:
              product.productUrl || null,
            orderUnit:
              product.orderUnit ||
              product.packageText,
            availabilityStatus:
              product.availabilityText ||
              (product.available === true
                ? "Verfügbar"
                : product.available === false
                  ? "Nicht verfügbar"
                  : null),
            active: true,
            lastSeenAt: capturedAt,
          },
          update: {
            connectionId: connection.id,
            externalId: product.externalId,
            name: product.name,
            searchTokens:
              buildSupplierCatalogSearchTokens({
                name: product.name,
                description: product.productUrl,
                externalId: product.externalId,
                articleNumber: product.articleNumber,
                orderUnit: product.orderUnit,
                packageText: product.packageText,
              }),
            description:
              product.productUrl || null,
            orderUnit:
              product.orderUnit ||
              product.packageText,
            availabilityStatus:
              product.availabilityText ||
              (product.available === true
                ? "Verfügbar"
                : product.available === false
                  ? "Nicht verfügbar"
                  : null),
            active: true,
            lastSeenAt: capturedAt,
          },
        });

      if (existing) {
        itemsUpdated += 1;
      } else {
        itemsCreated += 1;
      }

      if (product.netPriceCents !== null) {
        const basePriceUnit =
          product.orderUnit ||
          product.packageText ||
          null;

        const basePriceHistory =
          await prisma.supplierPriceSnapshot.findMany({
            where: {
              tenantId: connection.tenantId,
              catalogItemId: catalogItem.id,
              minimumQuantity: 1,
            },
            orderBy: {
              fetchedAt: "desc",
            },
            take: 8,
          });

        const basePriceQuality =
          assessSupplierPriceQuality({
            netPriceCents:
              product.netPriceCents,
            grossPriceCents:
              product.grossPriceCents,
            priceUnit: basePriceUnit,
            minimumQuantity: 1,
            history: basePriceHistory,
          });

        if (
          basePriceQuality.status ===
            "VALID"
        ) {
          await autoResolveSuspiciousSupplierPrices(
            prisma,
            {
              tenantId:
                connection.tenantId,
              catalogItemId:
                catalogItem.id,
              currentNetPriceCents:
                product.netPriceCents,
              currentGrossPriceCents:
                product.grossPriceCents,
              priceUnit:
                basePriceUnit,
              minimumQuantity: 1,
            }
          );
        }

        await prisma.supplierPriceSnapshot.create({
          data: {
            tenantId: connection.tenantId,
            catalogItemId: catalogItem.id,
            netPriceCents:
              product.netPriceCents,
            qualityStatus:
              basePriceQuality.status,
            qualityReason:
              basePriceQuality.reason,
            referencePriceCents:
              basePriceQuality.referencePriceCents,
            priceRatio:
              basePriceQuality.priceRatio,
            qualityCheckedAt:
              new Date(),
            grossPriceCents:
              product.grossPriceCents,
            currency: product.currency,
            priceUnitQuantity: 1,
            priceUnit: basePriceUnit,
            minimumQuantity: 1,
            available: product.available,
            stockText:
              product.availabilityText,
            promotional:
              product.promotional,
            source: "CATALOG",
            fetchedAt: capturedAt,
          },
        });

        pricesCreated += 1;
      }

      for (const tier of product.tiers) {
        if (!tier) {
          continue;
        }

        const tierPriceUnit =
          product.orderUnit ||
          product.packageText ||
          null;

        const tierPriceHistory =
          await prisma.supplierPriceSnapshot.findMany({
            where: {
              tenantId: connection.tenantId,
              catalogItemId: catalogItem.id,
              minimumQuantity:
                tier.minimumQuantity,
            },
            orderBy: {
              fetchedAt: "desc",
            },
            take: 8,
          });

        const tierPriceQuality =
          assessSupplierPriceQuality({
            netPriceCents:
              tier.netPriceCents,
            grossPriceCents:
              tier.grossPriceCents,
            priceUnit: tierPriceUnit,
            minimumQuantity:
              tier.minimumQuantity,
            history: tierPriceHistory,
          });

        if (
          tierPriceQuality.status ===
            "VALID"
        ) {
          await autoResolveSuspiciousSupplierPrices(
            prisma,
            {
              tenantId:
                connection.tenantId,
              catalogItemId:
                catalogItem.id,
              currentNetPriceCents:
                tier.netPriceCents,
              currentGrossPriceCents:
                tier.grossPriceCents,
              priceUnit:
                tierPriceUnit,
              minimumQuantity:
                tier.minimumQuantity,
            }
          );
        }

        await prisma.supplierPriceSnapshot.create({
          data: {
            tenantId: connection.tenantId,
            catalogItemId: catalogItem.id,
            netPriceCents:
              tier.netPriceCents,
            qualityStatus:
              tierPriceQuality.status,
            qualityReason:
              tierPriceQuality.reason,
            referencePriceCents:
              tierPriceQuality.referencePriceCents,
            priceRatio:
              tierPriceQuality.priceRatio,
            qualityCheckedAt:
              new Date(),
            grossPriceCents:
              tier.grossPriceCents,
            currency: product.currency,
            priceUnitQuantity: 1,
            priceUnit: basePriceUnit,
            minimumQuantity:
              tier.minimumQuantity,
            available: product.available,
            stockText:
              tier.label ||
              product.availabilityText,
            promotional: true,
            source: "CATALOG",
            fetchedAt: capturedAt,
          },
        });

        pricesCreated += 1;
      }
    } catch (error: any) {
      errors.push(
        `${product.name}: ${String(
          error?.message || error
        ).slice(0, 300)}`
      );
    }
  }

  if (
    searchQueryTokens.length > 0 &&
    products.length > 0
  ) {
    const capturedArticleNumbers =
      Array.from(
        new Set(
          products
            .map((product) =>
              String(
                product.articleNumber || ""
              ).trim()
            )
            .filter(Boolean)
        )
      );

    if (
      capturedArticleNumbers.length > 0
    ) {
      const capturedItems =
        await prisma.supplierCatalogItem.findMany({
          where: {
            tenantId:
              connection.tenantId,
            supplierId:
              connection.supplierId,
            articleNumber: {
              in: capturedArticleNumbers,
            },
          },
          select: {
            id: true,
            searchTokens: true,
          },
        });

      await Promise.all(
        capturedItems.map(
          (item: any) =>
            prisma.supplierCatalogItem.update({
              where: {
                id: item.id,
              },
              data: {
                searchTokens:
                  Array.from(
                    new Set([
                      ...(item.searchTokens || []),
                      ...searchQueryTokens,
                    ])
                  ),
              },
            })
        )
      );
    }
  }

  const finalStatus =
    errors.length === 0
      ? "SUCCESS"
      : itemsCreated + itemsUpdated > 0
        ? "PARTIAL"
        : "FAILED";

  const currentSearchRequest =
    settings.browserConnectorSearchRequest &&
    typeof settings.browserConnectorSearchRequest ===
      "object" &&
    !Array.isArray(
      settings.browserConnectorSearchRequest
    )
      ? (settings.browserConnectorSearchRequest as Record<
          string,
          unknown
        >)
      : null;

  const rawBackgroundState =
    settings.browserBackgroundSync &&
    typeof settings.browserBackgroundSync ===
      "object" &&
    !Array.isArray(
      settings.browserBackgroundSync
    )
      ? (settings.browserBackgroundSync as Record<
          string,
          unknown
        >)
      : {};

  const completedBackgroundSync =
    Boolean(captureComplete) &&
    Boolean(searchRequestId) &&
    String(
      currentSearchRequest?.id || ""
    ) === String(searchRequestId) &&
    String(
      currentSearchRequest?.source || ""
    ) === "BACKGROUND_SYNC";

  let nextConnectionSyncAt =
    connection.nextSyncAt;

  let nextBackgroundState: Record<
    string,
    unknown
  > = {
    ...rawBackgroundState,
  };

  if (completedBackgroundSync) {
    const discoveryId =
      String(
        currentSearchRequest?.discoveryId ||
          ""
      ).trim();

    if (discoveryId) {
      await prisma.supplierSearchDiscovery.updateMany({
        where: {
          id: discoveryId,
          tenantId: connection.tenantId,
        },
        data: {
          status:
            products.length > 0
              ? "SATISFIED"
              : "PENDING",
          lastProcessedAt:
            capturedAt,
          lastResultCount:
            products.length,
          priority:
            products.length > 0
              ? 10
              : 90,
        },
      });
    }

    const cursor = Math.max(
      0,
      Number(
        currentSearchRequest
          ?.backgroundCursor || 0
      ) || 0
    );

    const termCount = Math.max(
      1,
      Number(
        currentSearchRequest
          ?.backgroundTermCount || 1
      ) || 1
    );

    const nextCursor =
      cursor + 1;

    const cycleComplete =
      nextCursor >= termCount;

    nextBackgroundState = {
      ...rawBackgroundState,
      enabled: true,
      cursor: cycleComplete
        ? 0
        : nextCursor,
      termCount,
      lastCompletedAt:
        capturedAt.toISOString(),
      lastCompletedQuery:
        searchQuery || null,
      currentRequestId: null,
      cycleStartedAt:
        cycleComplete
          ? null
          : rawBackgroundState.cycleStartedAt ||
            capturedAt.toISOString(),
      lastCycleCompletedAt:
        cycleComplete
          ? capturedAt.toISOString()
          : rawBackgroundState
              .lastCycleCompletedAt ||
            null,
    };

    const delayMinutes =
      cycleComplete
        ? Math.max(
            15,
            Number(
              connection.syncIntervalMinutes ||
                1440
            ) || 1440
          )
        : 2;

    nextConnectionSyncAt =
      new Date(
        capturedAt.getTime() +
          delayMinutes * 60 * 1000
      );
  }

  const updatedSettings = {
    ...settings,
    connectionMode:
      "LOCAL_BROWSER_EXTENSION",
    browserConnectorStatus:
      finalStatus === "FAILED"
        ? "CAPTURE_FAILED"
        : "ACTIVE",
    browserConnectorLastSeenAt:
      capturedAt.toISOString(),
    browserConnectorLastCaptureAt:
      capturedAt.toISOString(),
    browserConnectorLastCaptureItems:
      products.length,
    browserConnectorLastSourceUrl:
      sourceUrl,
    browserConnectorLocationName:
      locationName ||
      settings.browserConnectorLocationName ||
      null,
    browserConnectorLastSearch:
      searchQuery && captureComplete
        ? {
            id: searchRequestId || null,
            query: searchQuery,
            completedAt:
              capturedAt.toISOString(),
            items: products.length,
          }
        : settings.browserConnectorLastSearch ||
          null,
    browserConnectorSearchRequest:
      captureComplete &&
      searchRequestId &&
      settings.browserConnectorSearchRequest &&
      typeof settings.browserConnectorSearchRequest ===
        "object" &&
      !Array.isArray(
        settings.browserConnectorSearchRequest
      ) &&
      String(
        (
          settings.browserConnectorSearchRequest as Record<
            string,
            unknown
          >
        ).id || ""
      ) === searchRequestId
        ? null
        : settings.browserConnectorSearchRequest ||
          null,
    onboardingStatus:
      "BROWSER_CONNECTOR_ACTIVE",
    sessionStatus:
      "LOCAL_BROWSER_ACTIVE",
    automaticSync: true,
    browserBackgroundSync:
      nextBackgroundState,
  };

  await prisma.$transaction([
    prisma.supplierSyncRun.update({
      where: {
        id: syncRun.id,
      },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        itemsSeen: products.length,
        itemsCreated,
        itemsUpdated,
        pricesCreated,
        errorsCount: errors.length,
        errorMessage:
          errors.length > 0
            ? errors.slice(0, 8).join(" | ")
            : null,
        detailsJson: {
          mode: "LOCAL_BROWSER_EXTENSION",
          sourceUrl,
          locationName:
            locationName || null,
          productsReceived:
            rawProducts.length,
          productsAccepted:
            products.length,
          captureComplete,
          errors: errors.slice(0, 20),
        },
      },
    }),
    prisma.supplierConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        status:
          finalStatus === "FAILED"
            ? "ERROR"
            : "ACTIVE",
        lastSyncAt: capturedAt,
        lastSuccessfulSyncAt:
          finalStatus === "FAILED"
            ? connection.lastSuccessfulSyncAt
            : capturedAt,
        lastError:
          errors.length > 0
            ? errors.slice(0, 4).join(" | ")
            : null,
        nextSyncAt:
          nextConnectionSyncAt,
        settingsJson: updatedSettings as any,
      },
    }),
  ]);

  return json({
    ok: finalStatus !== "FAILED",
    status: finalStatus,
    supplierName:
      connection.supplier.name,
    itemsReceived: rawProducts.length,
    itemsAccepted: products.length,
    itemsCreated,
    itemsUpdated,
    pricesCreated,
    captureComplete,
    errors: errors.slice(0, 8),
    message:
      finalStatus === "SUCCESS"
        ? `${products.length} METRO-Artikel wurden an Gastario übertragen.`
        : finalStatus === "PARTIAL"
          ? "Die METRO-Daten wurden teilweise übertragen. Einzelne Artikel müssen geprüft werden."
          : "Die METRO-Daten konnten nicht gespeichert werden.",
  });
}
