import fs from "node:fs";
import path from "node:path";

import type {
  NetworkCaptureEvent
} from "./network-capture.js";

import type {
  SupplierKey
} from "../types.js";

import type {
  SupplierAdapter,
  SupplierEndpointKind
} from "../adapters/types.js";

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

function scalarType(
  value: unknown
) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function collectSchemaFingerprints(
  input: unknown,
  options?: {
    maxDepth?: number;
    maxObjects?: number;
  }
) {
  const maxDepth =
    options?.maxDepth ?? 7;

  const maxObjects =
    options?.maxObjects ?? 1500;

  const seen =
    new Set<object>();

  const signatures =
    new Map<
      string,
      {
        count: number;
        pathSamples: string[];
      }
    >();

  let objectsVisited = 0;

  const visit = (
    value: unknown,
    path: string,
    depth: number
  ) => {
    if (
      value == null ||
      depth > maxDepth ||
      objectsVisited >= maxObjects ||
      typeof value !== "object"
    ) {
      return;
    }

    if (seen.has(value as object)) {
      return;
    }

    seen.add(value as object);

    if (Array.isArray(value)) {
      for (
        let index = 0;
        index < Math.min(
          value.length,
          30
        );
        index += 1
      ) {
        visit(
          value[index],
          `${path}[]`,
          depth + 1
        );
      }

      return;
    }

    objectsVisited += 1;

    const record =
      value as Record<
        string,
        unknown
      >;

    const keys =
      Object.keys(record)
        .sort();

    if (keys.length > 0) {
      const typedKeys =
        keys
          .slice(0, 80)
          .map(
            (key) =>
              `${key}:${scalarType(
                record[key]
              )}`
          );

      const signature =
        typedKeys.join("|");

      const current =
        signatures.get(
          signature
        ) || {
          count: 0,
          pathSamples: []
        };

      current.count += 1;

      if (
        current.pathSamples.length < 5 &&
        !current.pathSamples.includes(
          path
        )
      ) {
        current.pathSamples.push(
          path
        );
      }

      signatures.set(
        signature,
        current
      );
    }

    for (
      const [key, child]
      of Object.entries(record)
    ) {
      visit(
        child,
        `${path}.${key}`,
        depth + 1
      );
    }
  };

  visit(
    input,
    "$",
    0
  );

  return Array.from(
    signatures.entries()
  )
    .map(
      (
        [
          signature,
          details
        ]
      ) => ({
        signature,
        count:
          details.count,
        pathSamples:
          details.pathSamples
      })
    )
    .sort(
      (left, right) =>
        right.count -
        left.count
    )
    .slice(0, 80);
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
    private readonly adapter:
      SupplierAdapter | null = null,
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

      endpointKind:
        this.adapter
          ?.classifyEndpoint
          ? this.adapter
              .classifyEndpoint(
                event.observation.url
              )
          : "OTHER",

      response: {
        status:
          event.observation.status,

        contentType:
          event.observation.contentType,

        shape:
          topLevelShape(
            event.observation.body
          ),

        schemaFingerprints:
          collectSchemaFingerprints(
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
