import fs from "node:fs";
import path from "node:path";

import type {
  NetworkCaptureEvent
} from "./network-capture.js";

import type {
  SupplierKey
} from "../types.js";

function safeTimestamp() {
  return new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-"
    );
}

function sanitizeUrl(
  value: string
) {
  try {
    const url = new URL(value);

    // Querystrings können Session-, Tracking- oder Kundendaten enthalten.
    // Für Adapter-Learning reichen Host + Path.
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

function compactProduct(
  product: NetworkCaptureEvent["products"][number]
) {
  return {
    externalId:
      product.externalId,
    articleNumber:
      product.articleNumber,
    ean:
      product.ean,
    name:
      product.name,
    brand:
      product.brand,
    orderUnit:
      product.orderUnit,
    packageText:
      product.packageText,
    netPriceCents:
      product.netPriceCents,
    grossPriceCents:
      product.grossPriceCents,
    currency:
      product.currency,
    available:
      product.available,
    availabilityText:
      product.availabilityText,
    source:
      product.source,
    confidence:
      product.confidence,
    productUrl:
      product.productUrl
        ? sanitizeUrl(
            product.productUrl
          )
        : null
  };
}

function topLevelShape(
  body: unknown
) {
  if (Array.isArray(body)) {
    return {
      kind: "array",
      length:
        body.length,
      sampleTypes:
        Array.from(
          new Set(
            body
              .slice(0, 20)
              .map(
                (item) =>
                  Array.isArray(item)
                    ? "array"
                    : item === null
                      ? "null"
                      : typeof item
              )
          )
        )
    };
  }

  if (
    body &&
    typeof body === "object"
  ) {
    return {
      kind: "object",
      keys:
        Object.keys(
          body as Record<
            string,
            unknown
          >
        )
          .sort()
          .slice(0, 120)
    };
  }

  return {
    kind:
      body === null
        ? "null"
        : typeof body
  };
}

export class SupplierNetworkRecorder {
  readonly filePath: string;

  constructor(
    supplierKey: SupplierKey,
    rootDir = path.join(
      process.cwd(),
      "artifacts",
      "network"
    )
  ) {
    fs.mkdirSync(
      rootDir,
      {
        recursive: true
      }
    );

    this.filePath =
      path.join(
        rootDir,
        `${supplierKey}-${safeTimestamp()}.ndjson`
      );
  }

  async record(
    event: NetworkCaptureEvent
  ) {
    if (
      event.observation.supplierKey ==
      null
    ) {
      return;
    }

    const payload = {
      capturedAt:
        event.observation.capturedAt,

      supplierKey:
        event.observation.supplierKey,

      request: {
        method:
          event.observation.method,

        url:
          sanitizeUrl(
            event.observation.url
          )
      },

      response: {
        status:
          event.observation.status,

        contentType:
          event.observation.contentType,

        shape:
          topLevelShape(
            event.observation.body
          )
      },

      productCandidates:
        event.products.length,

      confidence: {
        HIGH:
          event.products.filter(
            (product) =>
              product.confidence ===
              "HIGH"
          ).length,

        MEDIUM:
          event.products.filter(
            (product) =>
              product.confidence ===
              "MEDIUM"
          ).length,

        LOW:
          event.products.filter(
            (product) =>
              product.confidence ===
              "LOW"
          ).length
      },

      sampleProducts:
        event.products
          .slice(0, 12)
          .map(
            compactProduct
          )
    };

    await fs.promises.appendFile(
      this.filePath,
      JSON.stringify(payload) +
        "\n",
      "utf8"
    );
  }
}
