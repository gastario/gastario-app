import {
  chromium
} from "playwright-core";

const METRO_SHOP_URL =
  "https://lieferservice.metro.de/shop";

const METRO_SEARCH_PATH =
  "/searchdiscover/articlesearch/search";

const METRO_BETTY_PATH =
  "/evaluate.article.v1/betty-variants";

function sleep(
  ms
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function cleanText(
  value
) {
  return String(
    value || ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function asNumber(
  value
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

function priceToCents(
  value
) {
  const number =
    asNumber(value);

  if (
    number == null ||
    number < 0 ||
    number > 100000
  ) {
    return null;
  }

  return Math.round(
    number * 100
  );
}

function uniqueStrings(
  value
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (entry) =>
            cleanText(entry)
        )
        .filter(Boolean)
    )
  );
}

function walkObjects(
  value,
  visit,
  depth = 0
) {
  if (
    value == null ||
    depth > 14
  ) {
    return;
  }

  if (Array.isArray(value)) {
    for (
      const entry of value
    ) {
      walkObjects(
        entry,
        visit,
        depth + 1
      );
    }

    return;
  }

  if (
    typeof value !==
      "object"
  ) {
    return;
  }

  visit(value);

  for (
    const entry
    of Object.values(value)
  ) {
    walkObjects(
      entry,
      visit,
      depth + 1
    );
  }
}

function findObject(
  value,
  predicate
) {
  let found =
    null;

  walkObjects(
    value,
    (candidate) => {
      if (
        found ||
        !predicate(candidate)
      ) {
        return;
      }

      found =
        candidate;
    }
  );

  return found;
}

function findFirstString(
  value,
  keys
) {
  const normalizedKeys =
    new Set(
      keys.map(
        (key) =>
          key.toLowerCase()
      )
    );

  let found =
    null;

  walkObjects(
    value,
    (candidate) => {
      if (found) {
        return;
      }

      for (
        const [
          key,
          entry
        ] of Object.entries(
          candidate
        )
      ) {
        if (
          normalizedKeys.has(
            key.toLowerCase()
          ) &&
          typeof entry ===
            "string" &&
          cleanText(entry)
        ) {
          found =
            cleanText(entry);

          return;
        }
      }
    }
  );

  return found;
}

function findImageUrl(
  value
) {
  let found =
    null;

  walkObjects(
    value,
    (candidate) => {
      if (found) {
        return;
      }

      for (
        const entry
        of Object.values(
          candidate
        )
      ) {
        if (
          typeof entry !==
            "string"
        ) {
          continue;
        }

        const text =
          cleanText(entry);

        if (
          /^https?:\/\//i.test(
            text
          ) &&
          /\.(png|jpe?g|webp)(\?|$)/i.test(
            text
          )
        ) {
          found =
            text;

          return;
        }
      }
    }
  );

  return found;
}

function findUrl(
  value
) {
  return findFirstString(
    value,
    [
      "productUrl",
      "url",
      "href",
      "canonicalUrl"
    ]
  );
}

function findSearchPriceObject(
  payload,
  externalId
) {
  return findObject(
    payload,
    (candidate) =>
      cleanText(
        candidate.id
      ) === externalId &&
      asNumber(
        candidate.price
      ) != null
  );
}

function findBettyVariant(
  payload,
  externalId
) {
  return findObject(
    payload,
    (candidate) =>
      cleanText(
        candidate?.variantId
          ?.bettyVariantId
      ) === externalId ||
      cleanText(
        candidate?.bettyVariantId
      ) === externalId
  );
}

function findVariantSelectorName(
  payload,
  variantNumber
) {
  if (!variantNumber) {
    return null;
  }

  let found =
    null;

  walkObjects(
    payload,
    (candidate) => {
      if (
        found ||
        !candidate
          .variantSelector ||
        typeof candidate
          .variantSelector !==
          "object"
      ) {
        return;
      }

      const value =
        candidate
          .variantSelector[
            variantNumber
          ];

      if (
        typeof value ===
          "string" &&
        cleanText(value)
      ) {
        found =
          cleanText(value);
      }
    }
  );

  return found;
}

function mapProduct({
  externalId,
  searchPayload,
  bettyPayloads
}) {
  const priceObject =
    findSearchPriceObject(
      searchPayload,
      externalId
    );

  let bettyVariant =
    null;

  let bettyPayload =
    null;

  for (
    const payload
    of bettyPayloads
  ) {
    const variant =
      findBettyVariant(
        payload,
        externalId
      );

    if (variant) {
      bettyVariant =
        variant;

      bettyPayload =
        payload;

      break;
    }
  }

  const variantId =
    bettyVariant
      ?.variantId ||
    {};

  const articleNumber =
    cleanText(
      variantId.articleNumber ||
      bettyVariant
        ?.articleNumber
    ) ||
    null;

  const variantNumber =
    cleanText(
      variantId.variantNumber ||
      bettyVariant
        ?.variantNumber
    );

  const selectorName =
    bettyPayload
      ? findVariantSelectorName(
          bettyPayload,
          variantNumber
        )
      : null;

  const name =
    selectorName ||
    findFirstString(
      bettyVariant,
      [
        "name",
        "title",
        "articleName",
        "displayName"
      ]
    ) ||
    externalId;

  const availabilityText =
    findFirstString(
      bettyVariant,
      [
        "availability",
        "availabilityText",
        "stockStatus"
      ]
    );

  const normalizedAvailability =
    cleanText(
      availabilityText
    )
      .toUpperCase();

  const available =
    normalizedAvailability
      ? (
          normalizedAvailability.includes(
            "AVAILABLE"
          ) ||
          normalizedAvailability.includes(
            "VERF"
          )
        )
      : (
          typeof priceObject
            ?.isAvailable ===
            "boolean"
            ? priceObject
                .isAvailable
            : null
        );

  const netPriceCents =
    priceToCents(
      priceObject?.price
    );

  const grossPriceCents =
    priceToCents(
      priceObject
        ?.grossPrice
    );

  return {
    externalId,
    articleNumber,
    name,
    brand:
      findFirstString(
        bettyVariant,
        [
          "brandName",
          "brand"
        ]
      ),
    orderUnit:
      findFirstString(
        bettyVariant,
        [
          "orderUnit",
          "salesUnit",
          "unit"
        ]
      ),
    packageText:
      findFirstString(
        bettyVariant,
        [
          "packageText",
          "packaging",
          "content",
          "size"
        ]
      ),
    netPriceCents,
    grossPriceCents,
    currency:
      "EUR",
    available,
    availabilityText:
      availabilityText ||
      null,
    imageUrl:
      findImageUrl(
        bettyVariant
      ) ||
      (
        bettyPayload
          ? findImageUrl(
              bettyPayload
            )
          : null
      ),
    productUrl:
      findUrl(
        bettyVariant
      ),
    fetchedAt:
      new Date()
        .toISOString()
  };
}

export class MetroNativeTransport {
  constructor({
    executablePath,
    headless = false
  } = {}) {
    this.executablePath =
      cleanText(
        executablePath
      );

    this.headless =
      Boolean(headless);
  }

  launchOptions() {
    const options = {
      headless:
        this.headless,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-features=Translate"
      ]
    };

    if (
      this.executablePath
    ) {
      options.executablePath =
        this.executablePath;
    }

    return options;
  }

  async withSession(
    session,
    callback
  ) {
    const storageState =
      session
        ?.storageState;

    if (
      !storageState ||
      typeof storageState !==
        "object"
    ) {
      const error =
        new Error(
          "METRO Browser-Session enthält keinen Storage-State."
        );

      error.code =
        "REAUTH_REQUIRED";

      throw error;
    }

    const browser =
      await chromium.launch(
        this.launchOptions()
      );

    const context =
      await browser
        .newContext({
          storageState,
          locale:
            "de-DE",
          timezoneId:
            "Europe/Berlin",
          viewport: {
            width: 1280,
            height: 800
          }
        });

    try {
      return await callback(
        context
      );
    }
    finally {
      try {
        await context
          .close();
      }
      catch {}

      try {
        await browser
          .close();
      }
      catch {}
    }
  }

  async health(
    session
  ) {
    const startedAt =
      Date.now();

    try {
      return await this.withSession(
        session,
        async (
          context
        ) => {
          const page =
            await context
              .newPage();

          const response =
            await page.goto(
              METRO_SHOP_URL,
              {
                waitUntil:
                  "domcontentloaded",
                timeout:
                  30_000
              }
            );

          const url =
            page.url();

          const loginLike =
            /login|idam|signin/i.test(
              url
            );

          return {
            ok:
              Boolean(response) &&
              !loginLike,
            latencyMs:
              Date.now() -
              startedAt,
            message:
              loginLike
                ? "METRO Session muss erneuert werden."
                : "METRO Session ist erreichbar.",
            requiresUserAction:
              loginLike
          };
        }
      );
    }
    catch (error) {
      return {
        ok:
          false,
        latencyMs:
          Date.now() -
          startedAt,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        requiresUserAction:
          error?.code ===
          "REAUTH_REQUIRED"
      };
    }
  }

  async search(
    session,
    query,
    limit = 20
  ) {
    const normalizedQuery =
      cleanText(
        query
      );

    if (
      normalizedQuery.length < 2
    ) {
      throw new Error(
        "METRO search query is too short."
      );
    }

    const safeLimit =
      Math.min(
        80,
        Math.max(
          1,
          Math.floor(
            Number(limit) ||
            20
          )
        )
      );

    return await this.withSession(
      session,
      async (
        context
      ) => {
        const page =
          await context
            .newPage();

        const bettyPayloads =
          [];

        page.on(
          "response",
          async (
            response
          ) => {
            try {
              const url =
                new URL(
                  response.url()
                );

              if (
                url.pathname !==
                  METRO_BETTY_PATH ||
                response.status() !==
                  200
              ) {
                return;
              }

              const type =
                response.headers()[
                  "content-type"
                ] || "";

              if (
                !type
                  .toLowerCase()
                  .includes(
                    "application/json"
                  )
              ) {
                return;
              }

              bettyPayloads.push(
                await response
                  .json()
              );
            }
            catch {}
          }
        );

        const searchResponsePromise =
          page.waitForResponse(
            (
              response
            ) => {
              try {
                const url =
                  new URL(
                    response.url()
                  );

                return (
                  url.pathname ===
                    METRO_SEARCH_PATH &&
                  url.searchParams
                    .get(
                      "query"
                    ) ===
                    normalizedQuery &&
                  response.status() ===
                    200
                );
              }
              catch {
                return false;
              }
            },
            {
              timeout:
                30_000
            }
          );

        const searchUrl =
          METRO_SHOP_URL +
          "/search?q=" +
          encodeURIComponent(
            normalizedQuery
          );

        await page.goto(
          searchUrl,
          {
            waitUntil:
              "domcontentloaded",
            timeout:
              30_000
          }
        );

        let searchResponse;

        try {
          searchResponse =
            await searchResponsePromise;
        }
        catch {
          const loginLike =
            /login|idam|signin/i.test(
              page.url()
            );

          if (loginLike) {
            const error =
              new Error(
                "METRO Session ist abgelaufen."
              );

            error.code =
              "REAUTH_REQUIRED";

            throw error;
          }

          throw new Error(
            "METRO Native Search Response wurde nicht beobachtet."
          );
        }

        const searchPayload =
          await searchResponse
            .json();

        const resultIds =
          uniqueStrings(
            searchPayload
              ?.resultIds
          )
            .slice(
              0,
              safeLimit
            );

        /*
         * Die Shop-Seite lädt nach dem Search-Response
         * die Betty-Variantendaten selbst nach.
         * Kurzes Settling-Fenster statt eigener
         * hart codierter Betty-Queryparameter.
         */
        await sleep(
          1_200
        );

        const products =
          resultIds
            .map(
              (externalId) =>
                mapProduct({
                  externalId,
                  searchPayload,
                  bettyPayloads
                })
            )
            .filter(
              (product) =>
                Boolean(
                  product.externalId
                ) &&
                Boolean(
                  product.name
                )
            );

        return products;
      }
    );
  }

  async refreshPrices(
    session,
    externalIds
  ) {
    /*
     * V1 des Hosted Native Transport:
     * Preis-Refresh wird über die nächste normale
     * Suchaktualisierung gefahren. Keine erfundene
     * Produktdetail-API.
     */
    if (
      !Array.isArray(
        externalIds
      ) ||
      externalIds.length ===
        0
    ) {
      return [];
    }

    return [];
  }
}
