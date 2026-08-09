import type {
  BrowserContext,
  Page,
  Response
} from "playwright-core";

import type {
  NetworkObservation
} from "../types.js";

import type {
  AdapterRegistry
} from "./adapter-registry.js";

import { agentConfig } from "./config.js";
import { createLogger } from "./logger.js";

const logger =
  createLogger(agentConfig.logLevel);

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

export class NetworkCapture {
  private readonly observations:
    NetworkObservation[] = [];

  private readonly observedPages =
    new WeakSet<Page>();

  constructor(
    private readonly registry:
      AdapterRegistry
  ) {}

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

      if (products.length > 0) {
        logger.info(
          "Supplier network products detected",
          {
            supplier:
              adapter.key,
            responseUrl:
              observation.url,
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
          url,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        }
      );
    }
  }
}
