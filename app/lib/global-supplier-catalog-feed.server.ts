import { prisma } from "./prisma.server";
import { refreshGlobalSupplierCatalogCsv } from "./global-supplier-catalog-refresh.server";

const DEFAULT_SYNC_INTERVAL_MINUTES = 1440;
const DEFAULT_TIMEOUT_MS = 30_000;

type FeedSettings = {
  headers?: Record<string, string>;
  bearerTokenEnvironmentVariable?: string | null;
  requestTimeoutMs?: number | null;
};

function normalizeProviderCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}

function getSettings(value: unknown): FeedSettings {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as FeedSettings;
  }

  return {};
}

function createNextSyncAt(
  syncIntervalMinutes: number | null | undefined
) {
  const minutes =
    Number(syncIntervalMinutes) > 0
      ? Number(syncIntervalMinutes)
      : DEFAULT_SYNC_INTERVAL_MINUTES;

  return new Date(
    Date.now() +
      minutes * 60 * 1000
  );
}

function buildRequestHeaders(params: {
  credentialReference?: string | null;
  settings: FeedSettings;
}) {
  const headers: Record<string, string> = {
    Accept:
      "text/csv,text/plain,application/octet-stream;q=0.9,*/*;q=0.8",
  };

  for (const [key, value] of Object.entries(
    params.settings.headers || {}
  )) {
    const headerName = String(key || "").trim();
    const headerValue = String(value || "").trim();

    if (!headerName || !headerValue) {
      continue;
    }

    headers[headerName] = headerValue;
  }

  const tokenEnvironmentVariable =
    String(
      params.settings.bearerTokenEnvironmentVariable ||
        params.credentialReference ||
        ""
    ).trim();

  if (tokenEnvironmentVariable) {
    const token =
      String(
        process.env[tokenEnvironmentVariable] ||
          ""
      ).trim();

    if (!token) {
      throw new Error(
        "Feed-Zugang fehlt: Environment Variable " +
          tokenEnvironmentVariable +
          " ist nicht gesetzt."
      );
    }

    headers.Authorization =
      "Bearer " + token;
  }

  return headers;
}

async function fetchCsvFeed(params: {
  endpointUrl: string;
  credentialReference?: string | null;
  settings: FeedSettings;
}) {
  const timeoutMs =
    Number(params.settings.requestTimeoutMs) > 0
      ? Number(params.settings.requestTimeoutMs)
      : DEFAULT_TIMEOUT_MS;

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    const response =
      await fetch(params.endpointUrl, {
        method: "GET",
        headers: buildRequestHeaders({
          credentialReference:
            params.credentialReference,
          settings:
            params.settings,
        }),
        signal: controller.signal,
        redirect: "follow",
      });

    if (!response.ok) {
      throw new Error(
        "Feed-Abruf fehlgeschlagen: HTTP " +
          response.status +
          " " +
          response.statusText
      );
    }

    const csvText =
      await response.text();

    if (!csvText.trim()) {
      throw new Error(
        "Der Feed hat keine Daten geliefert."
      );
    }

    return csvText;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runGlobalSupplierCatalogFeed(
  feedId: string
) {
  const id =
    String(feedId || "").trim();

  if (!id) {
    throw new Error(
      "GlobalSupplierCatalogFeed-ID fehlt."
    );
  }

  const feed =
    await prisma.globalSupplierCatalogFeed.findUnique({
      where: {
        id,
      },
    });

  if (!feed) {
    throw new Error(
      "Globaler Lieferantenkatalog-Feed wurde nicht gefunden."
    );
  }

  if (!feed.active) {
    throw new Error(
      "Der globale Lieferantenkatalog-Feed ist deaktiviert."
    );
  }

  const startedAt =
    new Date();

  await prisma.globalSupplierCatalogFeed.update({
    where: {
      id: feed.id,
    },
    data: {
      lastSyncAt:
        startedAt,
      lastError:
        null,
    },
  });

  try {
    const providerCode =
      normalizeProviderCode(
        feed.providerCode
      );

    if (!providerCode) {
      throw new Error(
        "Provider-Code fehlt."
      );
    }

    const settings =
      getSettings(
        feed.settingsJson
      );

    let refreshResult:
      Awaited<
        ReturnType<
          typeof refreshGlobalSupplierCatalogCsv
        >
      >;

    switch (feed.sourceType) {
      case "CSV_URL": {
        const endpointUrl =
          String(
            feed.endpointUrl || ""
          ).trim();

        if (!endpointUrl) {
          throw new Error(
            "CSV_URL benötigt eine endpointUrl."
          );
        }

        const csvText =
          await fetchCsvFeed({
            endpointUrl,
            credentialReference:
              feed.credentialReference,
            settings,
          });

        refreshResult =
          await refreshGlobalSupplierCatalogCsv({
            providerCode,
            csvText,
            distribute: false,
          });

        break;
      }

      case "BMECAT_URL":
        throw new Error(
          "BMEcat-Feeds sind vorbereitet, aber der Parser ist noch nicht implementiert."
        );

      case "CXML_URL":
        throw new Error(
          "cXML-Feeds sind vorbereitet, aber der Parser ist noch nicht implementiert."
        );

      case "API":
        throw new Error(
          "API-Feeds benötigen einen provider-spezifischen Adapter."
        );

      case "SFTP":
        throw new Error(
          "SFTP-Feeds sind vorbereitet, aber der Transport ist noch nicht implementiert."
        );

      default:
        throw new Error(
          "Unbekannter Feed-Typ."
        );
    }

    const finishedAt =
      new Date();

    const nextSyncAt =
      createNextSyncAt(
        feed.syncIntervalMinutes
      );

    await prisma.globalSupplierCatalogFeed.update({
      where: {
        id: feed.id,
      },
      data: {
        lastSuccessfulSyncAt:
          finishedAt,
        nextSyncAt,
        lastError:
          null,
      },
    });

    return {
      ok: true as const,
      feedId:
        feed.id,
      providerCode,
      sourceType:
        feed.sourceType,
      startedAt,
      finishedAt,
      nextSyncAt,
      refresh:
        refreshResult,
    };
  } catch (error: any) {
    const message =
      String(
        error?.message ||
          error ||
          "Unbekannter Feed-Fehler."
      );

    const nextSyncAt =
      createNextSyncAt(
        feed.syncIntervalMinutes
      );

    await prisma.globalSupplierCatalogFeed.update({
      where: {
        id: feed.id,
      },
      data: {
        nextSyncAt,
        lastError:
          message.slice(0, 2000),
      },
    });

    throw error;
  }
}

export async function runDueGlobalSupplierCatalogFeeds(
  params?: {
    limit?: number;
  }
) {
  const limit =
    Math.max(
      1,
      Math.min(
        Number(params?.limit) || 10,
        50
      )
    );

  const now =
    new Date();

  const feeds =
    await prisma.globalSupplierCatalogFeed.findMany({
      where: {
        active: true,
        automaticSync: true,
        OR: [
          {
            nextSyncAt: null,
          },
          {
            nextSyncAt: {
              lte: now,
            },
          },
        ],
      },
      orderBy: [
        {
          nextSyncAt: "asc",
        },
        {
          updatedAt: "asc",
        },
      ],
      take: limit,
    });

  const results: Array<{
    feedId: string;
    providerCode: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const feed of feeds) {
    try {
      await runGlobalSupplierCatalogFeed(
        feed.id
      );

      results.push({
        feedId:
          feed.id,
        providerCode:
          feed.providerCode,
        ok: true,
      });
    } catch (error: any) {
      results.push({
        feedId:
          feed.id,
        providerCode:
          feed.providerCode,
        ok: false,
        error:
          String(
            error?.message ||
              error
          ),
      });
    }
  }

  return {
    checkedAt:
      now,
    due:
      feeds.length,
    succeeded:
      results.filter(
        (result) =>
          result.ok
      ).length,
    failed:
      results.filter(
        (result) =>
          !result.ok
      ).length,
    results,
  };
}
