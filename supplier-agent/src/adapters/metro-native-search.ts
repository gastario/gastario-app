import fs from "node:fs";
import path from "node:path";

import type {
  Page
} from "playwright-core";

type MetroNativeOptions = {
  page?: number;
  rows?: number;
  hydrateLimit?: number;
  concurrency?: number;
};

export type MetroNativeProduct = {
  externalId: string;
  articleNumber: string;
  name: string;
  productUrl: string | null;
  orderUnit: string | null;
  packageText: string | null;
  availabilityText: string | null;
  available: boolean | null;
  netPriceCents: number | null;
  grossPriceCents: number | null;
  currency: string;
  promotional: boolean;
  imageUrl: string | null;
};

export type MetroNativeSearchResult = {
  mode: "NATIVE_NETWORK";
  query: string;
  status: number;
  amount: number;
  page: number;
  rows: number;
  totalPages: number;
  resultIds: string[];
  additionalVariantIds: string[];
  products: MetroNativeProduct[];
};

type SearchPriceRecord = {
  price?: unknown;
  isAvailable?: unknown;
};

type SearchPayload = {
  amount?: unknown;
  page?: unknown;
  rows?: unknown;
  totalPages?: unknown;
  resultIds?: unknown;
  additionalVariantIds?: unknown;
  results?: unknown;
};

function asRecord(
  value: unknown
): Record<string, unknown> {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value as Record<string, unknown>
    : {};
}

function asFiniteNumber(
  value: unknown,
  fallback = 0
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : fallback;
}

function asStringArray(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" &&
          item.length > 0
      )
    )
  );
}

function readString(
  ...values: unknown[]
) {
  for (const value of values) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function readBoolean(
  value: unknown
) {
  return typeof value === "boolean"
    ? value
    : null;
}

function getRawNetworkFiles() {
  const rawRoot =
    path.join(
      process.cwd(),
      "artifacts",
      "raw-network"
    );

  if (!fs.existsSync(rawRoot)) {
    throw new Error(
      "METRO raw-network folder not found. Record one authenticated METRO session first."
    );
  }

  return fs.readdirSync(
    rawRoot,
    {
      withFileTypes: true
    }
  )
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith("metro-") &&
        entry.name.endsWith(".ndjson")
    )
    .map(
      (entry) => {
        const filePath =
          path.join(
            rawRoot,
            entry.name
          );

        return {
          filePath,
          mtimeMs:
            fs.statSync(filePath)
              .mtimeMs
        };
      }
    )
    .sort(
      (a, b) =>
        b.mtimeMs -
        a.mtimeMs
    );
}

function findLatestSuccessfulUrl(
  pathPart: string
) {
  for (const file of getRawNetworkFiles()) {
    const lines =
      fs.readFileSync(
        file.filePath,
        "utf8"
      )
        .split(/\r?\n/)
        .filter(Boolean);

    for (
      let index = lines.length - 1;
      index >= 0;
      index -= 1
    ) {
      let record:
        Record<string, unknown>;

      try {
        record =
          JSON.parse(
            lines[index]
          ) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (
        record.method !== "GET" ||
        record.status !== 200 ||
        typeof record.url !== "string" ||
        !record.url.includes(pathPart)
      ) {
        continue;
      }

      return record.url;
    }
  }

  throw new Error(
    `METRO request template missing for ${pathPart}.`
  );
}

function getSearchTemplateUrl() {
  return findLatestSuccessfulUrl(
    "/searchdiscover/articlesearch/search"
  );
}

function getBettyTemplateUrl() {
  return findLatestSuccessfulUrl(
    "/evaluate.article.v1/betty-variants"
  );
}

function priceRecordFor(
  payload: SearchPayload,
  id: string
): SearchPriceRecord {
  const results =
    asRecord(payload.results);

  return asRecord(
    results[id]
  ) as SearchPriceRecord;
}

function mapBettyProduct({
  searchId,
  searchPrice,
  bettyPayload
}: {
  searchId: string;
  searchPrice: SearchPriceRecord;
  bettyPayload: unknown;
}): MetroNativeProduct | null {
  if (
    !searchId.startsWith("BTY-") ||
    searchId.length <= 4
  ) {
    return null;
  }

  const articleId =
    searchId.slice(0, -4);

  const variantNumber =
    searchId.slice(-4);

  const result =
    asRecord(
      asRecord(bettyPayload).result
    );

  const article =
    asRecord(
      result[articleId]
    );

  if (
    Object.keys(article).length === 0
  ) {
    return null;
  }

  const variants =
    asRecord(
      article.variants
    );

  const variant =
    asRecord(
      variants[variantNumber]
    );

  if (
    Object.keys(variant).length === 0
  ) {
    return null;
  }

  const articleSelector =
    asRecord(
      article.variantSelector
    );

  const variantSelector =
    asRecord(
      variant.variantSelector
    );

  const bundleSelector =
    asRecord(
      variant.bundleSelector
    );

  const bundles =
    asRecord(
      variant.bundles
    );

  const bundleNumber =
    Object.keys(bundles)[0] ||
    Object.keys(bundleSelector)[0] ||
    null;

  const bundle =
    bundleNumber
      ? asRecord(
          bundles[bundleNumber]
        )
      : {};

  const bundleDetails =
    asRecord(
      bundle.selector
    );

  const name =
    readString(
      articleSelector[variantNumber],
      variantSelector[variantNumber],
      variant.longDescription,
      variant.description,
      article.longDescription,
      article.description,
      article.name,
      variant.name
    );

  if (!name) {
    return null;
  }

  const contentSize =
    readString(
      bundleDetails.contentSize,
      bundle.contentSize,
      variant.contentSize
    );

  const packagingType =
    readString(
      bundleDetails.packagingType,
      bundle.packagingType,
      variant.packagingType
    );

  const bundleLabel =
    bundleNumber
      ? readString(
          bundleSelector[bundleNumber]
        )
      : null;

  const packageParts =
    [
      contentSize,
      packagingType
    ].filter(Boolean);

  const packageText =
    packageParts.length > 0
      ? packageParts.join(" · ")
      : readString(
          name,
          bundleLabel
        );

  const orderUnit =
    readString(
      bundleLabel,
      packagingType,
      contentSize
    );

  const availabilityCode =
    readString(
      variant.availability,
      bundle.availability,
      article.availability
    );

  const searchAvailable =
    readBoolean(
      searchPrice.isAvailable
    );

  const available =
    searchAvailable !== null
      ? searchAvailable
      : availabilityCode
        ? availabilityCode.toUpperCase() ===
          "AVAILABLE"
        : null;

  const rawPrice =
    typeof searchPrice.price === "number" &&
    Number.isFinite(searchPrice.price) &&
    searchPrice.price > 0 &&
    searchPrice.price < 100000
      ? searchPrice.price
      : null;

  const netPriceCents =
    rawPrice === null
      ? null
      : Math.round(
          rawPrice * 100
        );

  const imageUrl =
    readString(
      variant.imageUrl,
      variant.imageURL,
      bundle.imageUrl,
      bundle.imageURL,
      article.imageUrl,
      article.imageURL
    );

  return {
    externalId:
      searchId,
    articleNumber:
      searchId,
    name,
    productUrl:
      null,
    orderUnit,
    packageText,
    availabilityText:
      availabilityCode ||
      (
        available === true
          ? "AVAILABLE"
          : available === false
            ? "UNAVAILABLE"
            : null
      ),
    available,
    netPriceCents,
    grossPriceCents:
      null,
    currency:
      "EUR",
    promotional:
      false,
    imageUrl
  };
}

async function hydrateOne(
  page: Page,
  bettyTemplateUrl: string,
  searchId: string,
  searchPrice: SearchPriceRecord
) {
  const url =
    new URL(
      bettyTemplateUrl
    );

  url.searchParams.set(
    "ids",
    searchId
  );

  url.searchParams.set(
    "__t",
    String(Date.now())
  );

  const response =
    await page.context().request.get(
      url.toString(),
      {
        timeout: 20_000,
        failOnStatusCode: false,
        headers: {
          accept: "application/json",
          referer:
            "https://lieferservice.metro.de/shop"
        }
      }
    );

  if (!response.ok()) {
    return null;
  }

  const payload =
    await response.json();

  return mapBettyProduct({
    searchId,
    searchPrice,
    bettyPayload:
      payload
  });
}

async function mapWithConcurrency<TInput, TOutput>(
  input: TInput[],
  concurrency: number,
  worker: (
    item: TInput,
    index: number
  ) => Promise<TOutput>
) {
  const results =
    new Array<TOutput>(
      input.length
    );

  let cursor = 0;

  const runners =
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            input.length
          )
      },
      async () => {
        while (true) {
          const index =
            cursor++;

          if (
            index >= input.length
          ) {
            return;
          }

          results[index] =
            await worker(
              input[index],
              index
            );
        }
      }
    );

  await Promise.all(
    runners
  );

  return results;
}

export async function runMetroSearch(
  page: Page,
  _network: unknown,
  query: string,
  options: MetroNativeOptions = {}
): Promise<MetroNativeSearchResult> {
  const normalizedQuery =
    query.trim();

  if (!normalizedQuery) {
    throw new Error(
      "METRO search query is empty."
    );
  }

  const requestedPage =
    Math.max(
      1,
      Math.floor(
        options.page || 1
      )
    );

  const requestedRows =
    Math.min(
      100,
      Math.max(
        1,
        Math.floor(
          options.rows || 80
        )
      )
    );

  const hydrateLimit =
    Math.min(
      requestedRows,
      Math.max(
        1,
        Math.floor(
          options.hydrateLimit ||
          requestedRows
        )
      )
    );

  const concurrency =
    Math.min(
      8,
      Math.max(
        1,
        Math.floor(
          options.concurrency || 4
        )
      )
    );

  const searchUrl =
    new URL(
      getSearchTemplateUrl()
    );

  searchUrl.searchParams.set(
    "query",
    normalizedQuery
  );

  searchUrl.searchParams.set(
    "page",
    String(requestedPage)
  );

  searchUrl.searchParams.set(
    "rows",
    String(requestedRows)
  );

  searchUrl.searchParams.set(
    "__t",
    String(Date.now())
  );

  const response =
    await page.context().request.get(
      searchUrl.toString(),
      {
        timeout: 20_000,
        failOnStatusCode: false,
        headers: {
          accept: "application/json",
          referer:
            "https://lieferservice.metro.de/shop"
        }
      }
    );

  const status =
    response.status();

  if (
    status < 200 ||
    status >= 300
  ) {
    throw new Error(
      `METRO native search returned HTTP ${status}.`
    );
  }

  const payload =
    await response.json() as
      SearchPayload;

  const resultIds =
    asStringArray(
      payload.resultIds
    );

  const additionalVariantIds =
    asStringArray(
      payload.additionalVariantIds
    );

  const idsToHydrate =
    resultIds.slice(
      0,
      hydrateLimit
    );

  const bettyTemplateUrl =
    getBettyTemplateUrl();

  const hydrated =
    await mapWithConcurrency(
      idsToHydrate,
      concurrency,
      async (searchId) =>
        hydrateOne(
          page,
          bettyTemplateUrl,
          searchId,
          priceRecordFor(
            payload,
            searchId
          )
        )
    );

  const products =
    hydrated.filter(
      (
        product
      ): product is MetroNativeProduct =>
        Boolean(product)
    );

  return {
    mode:
      "NATIVE_NETWORK",
    query:
      normalizedQuery,
    status,
    amount:
      asFiniteNumber(
        payload.amount,
        resultIds.length
      ),
    page:
      asFiniteNumber(
        payload.page,
        requestedPage
      ),
    rows:
      asFiniteNumber(
        payload.rows,
        requestedRows
      ),
    totalPages:
      asFiniteNumber(
        payload.totalPages,
        1
      ),
    resultIds,
    additionalVariantIds,
    products
  };
}
