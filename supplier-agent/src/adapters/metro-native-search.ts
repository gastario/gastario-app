import fs from "node:fs";
import path from "node:path";

import type {
  Page
} from "playwright-core";

type MetroNativeOptions = {
  page?: number;
  rows?: number;
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
};

type SearchPayload = {
  amount?: unknown;
  page?: unknown;
  rows?: unknown;
  totalPages?: unknown;
  resultIds?: unknown;
  additionalVariantIds?: unknown;
};

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

function getLatestSearchTemplateUrl() {
  const rawRoot =
    path.join(
      process.cwd(),
      "artifacts",
      "raw-network"
    );

  if (!fs.existsSync(rawRoot)) {
    throw new Error(
      "METRO native search template missing: raw-network folder not found."
    );
  }

  const files =
    fs.readdirSync(
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

  for (const file of files) {
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
          ) as Record<
            string,
            unknown
          >;
      } catch {
        continue;
      }

      if (
        record.method !== "GET" ||
        record.status !== 200 ||
        typeof record.url !== "string" ||
        !record.url.includes(
          "/searchdiscover/articlesearch/search"
        )
      ) {
        continue;
      }

      return record.url;
    }
  }

  throw new Error(
    "METRO native search template missing: no successful recorded search request found."
  );
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

  const url =
    new URL(
      getLatestSearchTemplateUrl()
    );

  url.searchParams.set(
    "query",
    normalizedQuery
  );

  url.searchParams.set(
    "page",
    String(requestedPage)
  );

  url.searchParams.set(
    "rows",
    String(requestedRows)
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

  const status =
    response.status();

  if (status < 200 || status >= 300) {
    throw new Error(
      `METRO native search returned HTTP ${status}.`
    );
  }

  const contentType =
    response.headers()["content-type"] || "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new Error(
      `METRO native search returned unexpected content type: ${contentType || "unknown"}.`
    );
  }

  const payload =
    await response.json() as SearchPayload;

  const resultIds =
    asStringArray(payload.resultIds);

  const additionalVariantIds =
    asStringArray(
      payload.additionalVariantIds
    );

  return {
    mode: "NATIVE_NETWORK",
    query: normalizedQuery,
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
    additionalVariantIds
  };
}
