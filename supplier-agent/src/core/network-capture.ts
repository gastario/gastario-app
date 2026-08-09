import type {
  BrowserContext,
  Page,
  Response
} from "playwright-core";

import type {
  NetworkObservation,
  SafeRequestShape
} from "../types.js";

import type {
  AdapterRegistry
} from "./adapter-registry.js";

import { agentConfig } from "./config.js";
import { createLogger } from "./logger.js";

const logger =
  createLogger(agentConfig.logLevel);

function sanitizeLoggedUrl(
  value: string
) {
  try {
    const url =
      new URL(value);

    return (
      `${url.protocol}//` +
      `${url.host}` +
      `${url.pathname}`
    );
  } catch {
    return value
      .split("?")[0]
      .slice(0, 500);
  }
}

function isJsonContentType(
  contentType: string
) {
  return (
    contentType.includes(
      "application/json"
    ) ||
    contentType.includes(
      "application/graphql-response+json"
    ) ||
    contentType.includes(
      "text/json"
    )
  );
}

const SAFE_REQUEST_VALUE_KEYS =
  new Set([
    "q",
    "query",
    "search",
    "searchterm",
    "searchTerm",
    "term",
    "text",
    "page",
    "rows",
    "size",
    "limit",
    "offset",
    "locale"
  ]);

function collectSafeValues(
  value: unknown,
  prefix = "",
  depth = 0
): Record<
  string,
  string | number | boolean
> {
  if (
    value == null ||
    depth > 4 ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result:
    Record<
      string,
      string | number | boolean
    > = {};

  for (
    const [key, child]
    of Object.entries(
      value as Record<
        string,
        unknown
      >
    )
  ) {
    const path =
      prefix
        ? `${prefix}.${key}`
        : key;

    if (
      SAFE_REQUEST_VALUE_KEYS.has(key) &&
      (
        typeof child === "string" ||
        typeof child === "number" ||
        typeof child === "boolean"
      )
    ) {
      result[path] = child;
      continue;
    }

    if (
      child &&
      typeof child === "object" &&
      !Array.isArray(child)
    ) {
      Object.assign(
        result,
        collectSafeValues(
          child,
          path,
          depth + 1
        )
      );
    }
  }

  return result;
}

function buildSafeRequestShape(
  response: Response
): SafeRequestShape {
  const request =
    response.request();

  let queryParameterNames:
    string[] = [];

  try {
    queryParameterNames =
      Array.from(
        new URL(
          request.url()
        ).searchParams.keys()
      )
        .filter(
          (
            value,
            index,
            all
          ) =>
            all.indexOf(value) ===
            index
        )
        .sort();
  } catch {
    queryParameterNames = [];
  }

  const postData =
    request.postData();

  if (!postData) {
    return {
      queryParameterNames,
      bodyKind: "none",
      bodyKeys: [],
      safeValues: {}
    };
  }

  try {
    const parsed =
      JSON.parse(postData);

    const bodyKeys =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
        ? Object.keys(
            parsed as Record<
              string,
              unknown
            >
          ).sort()
        : [];

    return {
      queryParameterNames,
      bodyKind: "json",
      bodyKeys,
      safeValues:
        collectSafeValues(parsed)
    };
  } catch {
    // Form/Text weiter prüfen.
  }

  try {
    const form =
      new URLSearchParams(
        postData
      );

    const bodyKeys =
      Array.from(form.keys())
        .filter(
          (
            value,
            index,
            all
          ) =>
            all.indexOf(value) ===
            index
        )
        .sort();

    const safeValues:
      Record<
        string,
        string | number | boolean
      > = {};

    for (const key of bodyKeys) {
      if (
        SAFE_REQUEST_VALUE_KEYS.has(key)
      ) {
        safeValues[key] =
          form.get(key) || "";
      }
    }

    if (bodyKeys.length > 0) {
      return {
        queryParameterNames,
        bodyKind: "form",
        bodyKeys,
        safeValues
      };
    }
  } catch {
    // Text-Fallback.
  }

  return {
    queryParameterNames,
    bodyKind: "text",
    bodyKeys: [],
    safeValues: {}
  };
}
async function readResponseBody(
  response: Response
) {
  const headers =
    await response.allHeaders();

  const contentType =
    headers["content-type"] || "";

  const lengthHeader =
    Number(
      headers["content-length"] || 0
    );

  if (
    Number.isFinite(lengthHeader) &&
    lengthHeader >
      agentConfig.networkBodyLimitBytes
  ) {
    return null;
  }

  if (!isJsonContentType(contentType)) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export interface NetworkCaptureEvent {
  observation: NetworkObservation;
  products: Awaited<
    ReturnType<
      import("../adapters/types.js").SupplierAdapter["extractNetworkProducts"]
    >
  >;
}

export class NetworkCapture {
  private readonly observations:
    NetworkObservation[] = [];

  private readonly observedPages =
    new WeakSet<Page>();

  private readonly subscribers =
    new Set<
      (
        event: NetworkCaptureEvent
      ) => void | Promise<void>
    >();

  constructor(
    private readonly registry:
      AdapterRegistry
  ) {}

  subscribe(
    listener: (
      event: NetworkCaptureEvent
    ) => void | Promise<void>
  ) {
    this.subscribers.add(listener);

    return () => {
      this.subscribers.delete(
        listener
      );
    };
  }

  start(context: BrowserContext) {
    for (const page of context.pages()) {
      this.attachPage(page);
    }

    context.on(
      "page",
      (page) =>
        this.attachPage(page)
    );
  }

  latest() {
    return [
      ...this.observations
    ];
  }

  private attachPage(page: Page) {
    if (this.observedPages.has(page)) {
      return;
    }

    this.observedPages.add(page);

    page.on(
      "response",
      (response) => {
        void this.observeResponse(
          response
        );
      }
    );
  }

  private async observeResponse(
    response: Response
  ) {
    const url = response.url();
    const adapter =
      this.registry.byUrl(url);

    if (!adapter) {
      return;
    }

    const body =
      await readResponseBody(
        response
      );

    if (body == null) {
      return;
    }

    const headers =
      await response.allHeaders();

    const observation:
      NetworkObservation = {
        url,
        method:
          response.request().method(),
        status:
          response.status(),
        contentType:
          headers["content-type"] ||
          null,
        supplierKey:
          adapter.key,
        capturedAt:
          new Date().toISOString(),
        requestShape:
          buildSafeRequestShape(
            response
          ),
        body
      };

    this.observations.push(
      observation
    );

    while (
      this.observations.length >
      agentConfig.networkObservationLimit
    ) {
      this.observations.shift();
    }

    try {
      const products =
        await adapter.extractNetworkProducts(
          observation
        );

      for (
        const subscriber
        of this.subscribers
      ) {
        try {
          await subscriber({
            observation,
            products
          });
        } catch (error) {
          logger.warn(
            "Supplier network subscriber failed",
            {
              supplier:
                adapter.key,
              url,
              error:
                error instanceof Error
                  ? error.message
                  : String(error)
            }
          );
        }
      }

      if (products.length > 0) {
        logger.info(
          "Supplier network products detected",
          {
            supplier:
              adapter.key,
            responseUrl:
              sanitizeLoggedUrl(
                observation.url
              ),
            endpointKind:
              adapter.classifyEndpoint
                ? adapter.classifyEndpoint(
                    observation.url
                  )
                : "OTHER",
            products:
              products.length,
            confidence:
              products.reduce(
                (
                  counts,
                  product
                ) => {
                  counts[
                    product.confidence
                  ] =
                    (
                      counts[
                        product.confidence
                      ] || 0
                    ) + 1;

                  return counts;
                },
                {} as Record<
                  string,
                  number
                >
              )
          }
        );
      }
    } catch (error) {
      logger.warn(
        "Supplier adapter rejected network response",
        {
          supplier:
            adapter.key,
          url:
            sanitizeLoggedUrl(
              url
            ),
          error:
            error instanceof Error
              ? error.message
              : String(error)
        }
      );
    }
  }
}
