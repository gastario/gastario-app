import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  openAgentBrowser
} from "./browser.js";

import {
  runMetroSearch
} from "../adapters/metro-native-search.js";

type BridgeConfig = {
  baseUrl: string;
  connectorCode: string;
};

type ConnectorSearchRequest = {
  id: string;
  query: string;
  requestedAt?: string;
  source?: string;
};

const DEFAULT_BASE_URL =
  "https://gastario-app-production.up.railway.app";

function configPath() {
  const localRoot =
    process.env.LOCALAPPDATA ||
    path.join(
      os.homedir(),
      ".gastario"
    );

  return path.join(
    localRoot,
    "Gastario",
    "SupplierAgent",
    "bridge.json"
  );
}

function normalizeBaseUrl(
  value: string
) {
  const candidate =
    String(value || "")
      .trim()
      .replace(/\/+$/, "");

  if (!candidate) {
    return DEFAULT_BASE_URL;
  }

  const url =
    new URL(candidate);

  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    throw new Error(
      "Gastario Bridge URL must use HTTPS."
    );
  }

  return url.toString()
    .replace(/\/+$/, "");
}

function connectorEndpoint(
  baseUrl: string
) {
  return (
    normalizeBaseUrl(baseUrl) +
    "/api/supplier-browser-connector"
  );
}

export function saveMetroBridgeConfig(
  connectorCode: string,
  baseUrl = DEFAULT_BASE_URL
) {
  const code =
    String(connectorCode || "")
      .trim();

  if (
    !/^GASTARIO-SUPPLIER-CONNECTOR\.[A-Za-z0-9_-]{8,80}\.[A-Za-z0-9_-]{32,100}$/.test(
      code
    )
  ) {
    throw new Error(
      "Ungültiger Gastario Lieferanten-Verbindungscode."
    );
  }

  const target =
    configPath();

  fs.mkdirSync(
    path.dirname(target),
    {
      recursive: true
    }
  );

  const payload: BridgeConfig = {
    baseUrl:
      normalizeBaseUrl(baseUrl),
    connectorCode:
      code
  };

  fs.writeFileSync(
    target,
    JSON.stringify(
      payload,
      null,
      2
    ) + "\n",
    {
      encoding:
        "utf8",
      mode:
        0o600
    }
  );

  return {
    path:
      target,
    baseUrl:
      payload.baseUrl
  };
}

function readBridgeConfig(): BridgeConfig {
  const target =
    configPath();

  if (!fs.existsSync(target)) {
    throw new Error(
      "Gastario Bridge ist noch nicht eingerichtet. Zuerst: npm.cmd run dev -- bridge-config metro \"<VERBINDUNGSCODE>\""
    );
  }

  const parsed =
    JSON.parse(
      fs.readFileSync(
        target,
        "utf8"
      )
    ) as Partial<BridgeConfig>;

  const connectorCode =
    String(
      parsed.connectorCode || ""
    ).trim();

  if (!connectorCode) {
    throw new Error(
      "Gastario Bridge Verbindungscode fehlt."
    );
  }

  return {
    baseUrl:
      normalizeBaseUrl(
        String(
          parsed.baseUrl ||
          DEFAULT_BASE_URL
        )
      ),
    connectorCode
  };
}

async function readConnectorState(
  config: BridgeConfig
) {
  const response =
    await fetch(
      connectorEndpoint(
        config.baseUrl
      ),
      {
        method:
          "GET",
        headers: {
          authorization:
            `Bearer ${config.connectorCode}`,
          accept:
            "application/json"
        },
        cache:
          "no-store"
      }
    );

  const body =
    await response.json()
      .catch(
        () => null
      ) as any;

  if (!response.ok) {
    throw new Error(
      body?.error ||
      `Gastario Connector GET returned HTTP ${response.status}.`
    );
  }

  const raw =
    body?.connection
      ?.searchRequest;

  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return null;
  }

  const id =
    String(
      raw.id || ""
    ).trim();

  const query =
    String(
      raw.query || ""
    ).trim();

  if (
    !id ||
    !query
  ) {
    return null;
  }

  return {
    id,
    query,
    requestedAt:
      raw.requestedAt
        ? String(
            raw.requestedAt
          )
        : undefined,
    source:
      raw.source
        ? String(
            raw.source
          )
        : undefined
  } satisfies ConnectorSearchRequest;
}

async function submitProducts({
  config,
  request,
  products
}: {
  config: BridgeConfig;
  request: ConnectorSearchRequest;
  products: Awaited<
    ReturnType<
      typeof runMetroSearch
    >
  >["products"];
}) {
  const sourceUrl =
    "https://lieferservice.metro.de/shop/search?q=" +
    encodeURIComponent(
      request.query
    );

  const response =
    await fetch(
      connectorEndpoint(
        config.baseUrl
      ),
      {
        method:
          "POST",
        headers: {
          authorization:
            `Bearer ${config.connectorCode}`,
          accept:
            "application/json",
          "content-type":
            "application/json"
        },
        body:
          JSON.stringify({
            sourceUrl,
            searchRequestId:
              request.id,
            searchQuery:
              request.query,
            captureComplete:
              true,
            products
          })
      }
    );

  const body =
    await response.json()
      .catch(
        () => null
      ) as any;

  if (!response.ok) {
    throw new Error(
      body?.error ||
      `Gastario Connector POST returned HTTP ${response.status}.`
    );
  }

  return body;
}

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

export async function runMetroBridge() {
  const config =
    readBridgeConfig();

  const browser =
    await openAgentBrowser();

  const page =
    browser.context.pages()[0] ||
    await browser.context.newPage();

  if (
    !page.url().startsWith(
      "https://lieferservice.metro.de/"
    )
  ) {
    await page.goto(
      "https://lieferservice.metro.de/shop",
      {
        waitUntil:
          "domcontentloaded",
        timeout:
          45_000
      }
    );
  }

  let stopped = false;

  const stop = () => {
    stopped = true;
  };

  process.once(
    "SIGINT",
    stop
  );

  process.once(
    "SIGTERM",
    stop
  );

  const attempted =
    new Map<
      string,
      number
    >();

  console.log(
    "[GASTARIO METRO BRIDGE] active",
    {
      baseUrl:
        config.baseUrl,
      pollIntervalMs:
        1500
    }
  );

  try {
    while (!stopped) {
      try {
        const request =
          await readConnectorState(
            config
          );

        if (!request) {
          await sleep(1500);
          continue;
        }

        const lastAttempt =
          attempted.get(
            request.id
          ) || 0;

        if (
          Date.now() -
          lastAttempt <
          60_000
        ) {
          await sleep(1000);
          continue;
        }

        attempted.set(
          request.id,
          Date.now()
        );

        console.log(
          "[GASTARIO METRO BRIDGE] search",
          {
            id:
              request.id,
            query:
              request.query,
            source:
              request.source ||
              null
          }
        );

        const result =
          await runMetroSearch(
            page,
            null,
            request.query,
            {
              page:
                1,
              rows:
                20,
              hydrateLimit:
                20,
              concurrency:
                6
            }
          );

        if (
          result.products.length === 0
        ) {
          console.warn(
            "[GASTARIO METRO BRIDGE] no products",
            {
              query:
                request.query,
              amount:
                result.amount
            }
          );

          await sleep(1500);
          continue;
        }

        const response =
          await submitProducts({
            config,
            request,
            products:
              result.products
          });

        console.log(
          "[GASTARIO METRO BRIDGE] imported",
          {
            query:
              request.query,
            resolved:
              result.products.length,
            imported:
              response?.itemsCreated ??
              response?.itemsUpdated ??
              response?.productsAccepted ??
              null,
            ok:
              response?.ok === true
          }
        );
      } catch (error) {
        console.error(
          "[GASTARIO METRO BRIDGE] iteration failed",
          error instanceof Error
            ? error.message
            : error
        );

        await sleep(3000);
      }

      await sleep(250);
    }
  } finally {
    await browser.close();
  }

  console.log(
    "[GASTARIO METRO BRIDGE] stopped"
  );
}
