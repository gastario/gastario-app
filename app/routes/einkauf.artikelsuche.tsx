import { selectTrustedSupplierPrice } from "../lib/supplier-price-quality";
import {
  buildSupplierSearchQueryTokens,
  normalizeSupplierSearchTerm,
  extractSupplierSearchLearningCandidates,
} from "../lib/supplier-search-index.server";
import { useEffect } from "react";

import {
  Form,
  Link,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useRevalidator,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  gastarioButtonClass,
  GastarioSection,
  GastarioField,
  GastarioInput,
  GastarioSelect,
  GastarioCheckRow,
  GastarioToolbar,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioEmptyState,
  GastarioDataList,
  GastarioDataRow,
  GastarioStack,
} from "../components/ui";


function formatMoney(cents: number | null | undefined) {
  if (cents == null) {
    return "Kein Preis";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
}

function formatNumber(value: unknown) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(number);
}

function formatDateTime(value: string | Date | null) {
  if (!value) {
    return "Noch nie aktualisiert";
  }

  return new Date(value).toLocaleString("de-DE");
}

function normalizedText(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .trim();
}

const SEARCH_SYNONYM_GROUPS = [
  [
    "marmelade",
    "konfitüre",
    "konfituere",
    "fruchtaufstrich",
    "fruchtgelee",
    "gelee",
  ],
  [
    "sahne",
    "schlagsahne",
    "schlagrahm",
    "kochsa​​hne",
    "küchensahne",
    "kuechensahne",
    "rahm",
  ],
  [
    "mais",
    "zuckermais",
    "gemüsemais",
    "gemuesemais",
    "maiskolben",
    "sweetcorn",
    "corn",
  ],
  [
    "croissant",
    "buttercroissant",
    "croissantteigling",
    "teigling",
    "plunder",
  ],
  [
    "hackfleisch",
    "rinderhack",
    "gemischtes hack",
    "hack",
  ],
  [
    "tomatensoße",
    "tomatensosse",
    "pastasauce",
    "tomatensauce",
    "sugo",
  ],
  [
    "cola",
    "coca-cola",
    "coca cola",
    "pepsi",
  ],
  [
    "kartoffelpüree",
    "kartoffelpueree",
    "kartoffelstampf",
    "püree",
    "pueree",
  ],
  [
    "brötchen",
    "broetchen",
    "semmel",
    "schrippe",
  ],
] as const;

const PREFERRED_PORTAL_TERMS: Record<string, string> = {
  marmelade: "konfitüre",
  konfituere: "konfitüre",
  fruchtaufstrich: "konfitüre",
  sahne: "sahne",
  rahm: "sahne",
  croissants: "croissant",
  croissant: "croissant",
  hackfleisch: "hackfleisch",
  tomatensosse: "tomatensauce",
  "tomatensoße": "tomatensauce",
  broetchen: "brötchen",
};

function editDistance(
  leftValue: string,
  rightValue: string
) {
  const left = normalizedText(leftValue);
  const right = normalizedText(rightValue);

  const matrix = Array.from(
    { length: left.length + 1 },
    () =>
      Array(right.length + 1).fill(0)
  );

  for (
    let row = 0;
    row <= left.length;
    row += 1
  ) {
    matrix[row][0] = row;
  }

  for (
    let column = 0;
    column <= right.length;
    column += 1
  ) {
    matrix[0][column] = column;
  }

  for (
    let row = 1;
    row <= left.length;
    row += 1
  ) {
    for (
      let column = 1;
      column <= right.length;
      column += 1
    ) {
      const cost =
        left[row - 1] === right[column - 1]
          ? 0
          : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] +
          cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function closestKnownSearchTerm(query: string) {
  const normalizedQuery = normalizedText(query);

  if (normalizedQuery.length < 5) {
    return null;
  }

  const knownTerms =
    SEARCH_SYNONYM_GROUPS.flat();

  let bestTerm: string | null = null;
  let bestDistance =
    Number.POSITIVE_INFINITY;

  for (const term of knownTerms) {
    const distance = editDistance(
      normalizedQuery,
      term
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestTerm = term;
    }
  }

  const maximumDistance =
    normalizedQuery.length >= 9 ? 2 : 1;

  return bestDistance <= maximumDistance
    ? bestTerm
    : null;
}

function expandSearchTerms(query: string) {
  const normalizedQuery = normalizedText(query);

  if (!normalizedQuery) {
    return [];
  }

  const correctedTerm =
    closestKnownSearchTerm(query);

  const comparisonTerm =
    correctedTerm || query;

  const matchingGroup =
    SEARCH_SYNONYM_GROUPS.find((group) =>
      group.some(
        (term) =>
          normalizedText(term) ===
          normalizedText(comparisonTerm)
      )
    );

  const terms = matchingGroup
    ? [
        query,
        correctedTerm,
        ...matchingGroup,
      ]
    : [query];

  return Array.from(
    new Set(
      terms
        .filter(Boolean)
        .map((term) =>
          String(term || "").trim()
        )
        .filter((term) => term.length >= 2)
    )
  ).slice(0, 12);
}

function preferredPortalQuery(query: string) {
  const correctedTerm =
    closestKnownSearchTerm(query);

  const normalizedQuery = normalizedText(
    correctedTerm || query
  );

  return (
    PREFERRED_PORTAL_TERMS[normalizedQuery] ||
    correctedTerm ||
    query.trim()
  );
}

function normalizedTokens(value: unknown) {
  return normalizedText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hasMeaningfulTermMatch(
  field: string,
  normalizedQuery: string
) {
  const fieldTokens =
    normalizedTokens(field);

  const queryTokens =
    normalizedTokens(normalizedQuery);

  if (queryTokens.length === 0) {
    return false;
  }

  if (queryTokens.length === 1) {
    const token = queryTokens[0];

    return fieldTokens.some(
      (fieldToken) =>
        fieldToken === token ||
        fieldToken.startsWith(token) ||
        token.startsWith(fieldToken)
    );
  }

  return queryTokens.every(
    (token) =>
      fieldTokens.some(
        (fieldToken) =>
          fieldToken === token ||
          fieldToken.startsWith(token)
      )
  );
}

function resultScore(
  item: any,
  query: string,
  searchTerms: string[]
) {
  if (!query) {
    return 0;
  }

  const normalizedQueries = Array.from(
    new Set(
      [query, ...searchTerms]
        .map(normalizedText)
        .filter(Boolean)
    )
  );
  const fields = [
    item.name,
    item.brand,
    item.description,
    item.articleNumber,
    item.ean,
    item.gtin,
    item.supplier?.name,
  ]
    .filter(Boolean)
    .map(normalizedText);

  let score = 0;

  for (const field of fields) {
    for (const normalizedQuery of normalizedQueries) {
      if (field === normalizedQuery) {
        score = Math.max(score, 100);
      } else if (
        hasMeaningfulTermMatch(
          field,
          normalizedQuery
        )
      ) {
        const fieldTokens =
          normalizedTokens(field);

        const queryTokens =
          normalizedTokens(
            normalizedQuery
          );

        const exactTokenMatches =
          queryTokens.filter(
            (token) =>
              fieldTokens.includes(token)
          ).length;

        score = Math.max(
          score,
          exactTokenMatches ===
            queryTokens.length
            ? 85
            : 70
        );
      }
    }
  }

  return score;
}

function basePrice(item: any) {
  /*
   * Nur bereits vertrauenswürdige Preise dürfen für den Grundpreis
   * verwendet werden. Rohe Snapshots aus item.prices können
   * SUSPICIOUS/REJECTED sein und dürfen hier niemals zurückleaken.
   */
  const price =
    item.latestPrice;

  if (!price) {
    return null;
  }

  const contentQuantity = Number(
    item.contentQuantity ||
      price.priceUnitQuantity ||
      0
  );

  if (!Number.isFinite(contentQuantity) || contentQuantity <= 0) {
    return null;
  }

  return Math.round(
    Number(price.netPriceCents || 0) /
      contentQuantity
  );
}

export function meta() {
  return [
    {
      title:
        "Lieferantenübergreifende Artikelsuche · Gastario",
    },
  ];
}

function isLegacyMetroPriceSuspicious(
  item: any,
  price: any
) {
  if (!price) {
    return false;
  }

  const articleNumber =
    String(
      item?.articleNumber ||
        item?.externalId ||
        ""
    ).toUpperCase();

  if (
    !articleNumber.startsWith(
      "METRO-WEB-"
    )
  ) {
    return false;
  }

  const fetchedAt =
    price.fetchedAt
      ? new Date(
          price.fetchedAt
        ).getTime()
      : 0;

  const parserFixCutoff =
    new Date(
      "2026-08-09T00:00:00.000Z"
    ).getTime();

  const netPriceCents =
    Number(
      price.netPriceCents || 0
    );

  const manuallyConfirmed =
    String(
      price.qualityReason || ""
    )
      .toLocaleLowerCase("de-DE")
      .includes(
        "manuell als plausibel bestätigt"
      );

  return (
    !manuallyConfirmed &&
    fetchedAt > 0 &&
    fetchedAt < parserFixCutoff &&
    netPriceCents >= 25000
  );
}
export async function loader({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const url = new URL(request.url);

  const query = String(
    url.searchParams.get("q") || ""
  ).trim();

  const builtInSearchTerms =
    expandSearchTerms(query);

  const normalizedQuery =
    normalizeSupplierSearchTerm(query);

  const directSearchAliases =
    normalizedQuery
      ? await prisma.supplierSearchAlias.findMany({
          where: {
            tenantId: access.tenantId,
            active: true,
            OR: [
              {
                aliasNormalized:
                  normalizedQuery,
              },
              {
                canonicalNormalized:
                  normalizedQuery,
              },
            ],
          },
          select: {
            canonicalTerm: true,
            aliasTerm: true,
            canonicalNormalized: true,
          },
          take: 40,
        })
      : [];

  const canonicalAliasKeys =
    Array.from(
      new Set(
        directSearchAliases
          .map(
            (entry: any) =>
              entry.canonicalNormalized
          )
          .filter(Boolean)
      )
    );

  const relatedSearchAliases =
    canonicalAliasKeys.length > 0
      ? await prisma.supplierSearchAlias.findMany({
          where: {
            tenantId: access.tenantId,
            active: true,
            canonicalNormalized: {
              in: canonicalAliasKeys,
            },
          },
          select: {
            canonicalTerm: true,
            aliasTerm: true,
          },
          take: 120,
        })
      : [];

  const searchTerms =
    Array.from(
      new Set(
        [
          query,
          ...builtInSearchTerms,
          ...directSearchAliases.flatMap(
            (entry: any) => [
              entry.canonicalTerm,
              entry.aliasTerm,
            ]
          ),
          ...relatedSearchAliases.flatMap(
            (entry: any) => [
              entry.canonicalTerm,
              entry.aliasTerm,
            ]
          ),
        ]
          .map((value) =>
            String(value || "").trim()
          )
          .filter(
            (value) => value.length >= 2
          )
      )
    ).slice(0, 80);

  const indexSearchTokens =
    buildSupplierSearchQueryTokens(
      searchTerms
    );

  const portalQuery =
    preferredPortalQuery(query);

  const supplierId = String(
    url.searchParams.get("supplier") || ""
  ).trim();

  const availableOnly =
    url.searchParams.get("available") === "1";

  const suppliers =
    await prisma.supplier.findMany({
      where: {
        tenantId: access.tenantId,
        active: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

  const metroConnection =
    await prisma.supplierConnection.findFirst({
      where: {
        tenantId: access.tenantId,
        active: true,
        OR: [
          {
            label: {
              equals: "METRO",
              mode: "insensitive",
            },
          },
          {
            supplier: {
              name: {
                equals: "METRO",
                mode: "insensitive",
              },
            },
          },
        ],
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  const metroSettings =
    metroConnection?.settingsJson &&
    typeof metroConnection.settingsJson === "object" &&
    !Array.isArray(metroConnection.settingsJson)
      ? (metroConnection.settingsJson as Record<
          string,
          unknown
        >)
      : {};

  const rawPendingMetroSearch =
    metroSettings.browserConnectorSearchRequest &&
    typeof metroSettings.browserConnectorSearchRequest ===
      "object" &&
    !Array.isArray(
      metroSettings.browserConnectorSearchRequest
    )
      ? (metroSettings.browserConnectorSearchRequest as Record<
          string,
          unknown
        >)
      : null;

  const pendingMetroRequestedAt =
    rawPendingMetroSearch?.requestedAt
      ? new Date(
          String(
            rawPendingMetroSearch.requestedAt
          )
        ).getTime()
      : 0;

  const pendingMetroSearchIsFresh =
    Number.isFinite(pendingMetroRequestedAt) &&
    pendingMetroRequestedAt > 0 &&
    Date.now() - pendingMetroRequestedAt <
      90 * 1000;

  const pendingMetroSearch =
    pendingMetroSearchIsFresh
      ? rawPendingMetroSearch
      : null;

  const lastMetroSearch =
    metroSettings.browserConnectorLastSearch &&
    typeof metroSettings.browserConnectorLastSearch ===
      "object" &&
    !Array.isArray(
      metroSettings.browserConnectorLastSearch
    )
      ? (metroSettings.browserConnectorLastSearch as Record<
          string,
          unknown
        >)
      : null;
  const products =
    await prisma.product.findMany({
      where: {
        tenantId: access.tenantId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        unit: true,
        procurementType: true,
      },
      orderBy: {
        name: "asc",
      },
      take: 500,
    });

  const indexedCatalogItems =
    query.length >= 2
      ? await prisma.supplierCatalogItem.findMany({
          where: {
            tenantId: access.tenantId,
            active: true,
            ...(supplierId
              ? {
                  supplierId,
                }
              : {}),
            searchTokens: {
              hasSome: indexSearchTokens,
            },
          },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
            prices: {
              orderBy: {
                fetchedAt: "desc",
              },
              take: 8,
            },
          },
          take: 700,
        })
      : [];

  /*
   * gastario-supplier-search-reliability-v2-20260813
   *
   * Der GIN-Index bleibt der schnelle Primaerpfad.
   * Ein zweiter, begrenzter Textpfad faengt Artikel ab, deren
   * searchTokens wegen alter oder partieller Imports unvollstaendig sind.
   */
  const fallbackSearchTerms =
    Array.from(
      new Set(
        [
          query,
          ...searchTerms,
        ]
          .map((value) =>
            String(value || "").trim()
          )
          .filter(
            (value) =>
              value.length >= 2 &&
              value.length <= 120
          )
      )
    ).slice(0, 20);

  const fallbackCatalogItems =
    query.length >= 2 &&
    fallbackSearchTerms.length > 0
      ? await prisma.supplierCatalogItem.findMany({
          where: {
            tenantId: access.tenantId,
            active: true,
            ...(supplierId
              ? {
                  supplierId,
                }
              : {}),
            OR: fallbackSearchTerms.flatMap(
              (term) => [
                {
                  name: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  brand: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  articleNumber: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  externalId: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  ean: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  gtin: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
              ]
            ),
          },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
            prices: {
              orderBy: {
                fetchedAt: "desc",
              },
              take: 8,
            },
          },
          take: 700,
        })
      : [];

  /*
   * gastario-global-search-fallback-v1
   *
   * Treffer aus dem zentralen Gastario-Katalog werden im Hintergrund
   * gezielt für verbundene Provider materialisiert. Der Nutzer sieht
   * weiterhin nur die normale Artikelsuche.
   */
  let globalMaterializedCatalogItems: any[] = [];

  if (
    query.length >= 2 &&
    fallbackSearchTerms.length > 0
  ) {
    const tenantConnections =
      await prisma.supplierConnection.findMany({
        where: {
          tenantId: access.tenantId,
          active: true,
          supplier: {
            active: true,
          },
          ...(supplierId
            ? {
                supplierId,
              }
            : {}),
        },
        select: {
          id: true,
          supplierId: true,
          label: true,
          settingsJson: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

    const providerTargets = new Map<
      string,
      {
        providerCode: string;
        supplierId: string;
        connectionId: string;
      }
    >();

    for (const connection of tenantConnections) {
      const settings =
        connection.settingsJson &&
        typeof connection.settingsJson === "object" &&
        !Array.isArray(connection.settingsJson)
          ? (connection.settingsJson as Record<string, unknown>)
          : {};

      const providerCode =
        String(
          settings.providerCode ||
            connection.label ||
            ""
        )
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, "_");

      if (!providerCode) {
        continue;
      }

      const targetKey =
        providerCode +
        ":" +
        connection.supplierId;

      if (!providerTargets.has(targetKey)) {
        providerTargets.set(targetKey, {
          providerCode,
          supplierId: connection.supplierId,
          connectionId: connection.id,
        });
      }
    }

    const providerCodes =
      Array.from(
        new Set(
          Array.from(
            providerTargets.values()
          ).map(
            (target) =>
              target.providerCode
          )
        )
      );

    if (providerCodes.length > 0) {
      const globalIndexedItems =
        indexSearchTokens.length > 0
          ? await prisma.globalSupplierCatalogItem.findMany({
              where: {
                active: true,
                providerCode: {
                  in: providerCodes,
                },
                searchTokens: {
                  hasSome: indexSearchTokens,
                },
              },
              select: {
                id: true,
                providerCode: true,
              },
              take: 300,
            })
          : [];

      const globalFallbackItems =
        await prisma.globalSupplierCatalogItem.findMany({
          where: {
            active: true,
            providerCode: {
              in: providerCodes,
            },
            OR: fallbackSearchTerms.flatMap(
              (term) => [
                {
                  name: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  brand: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  articleNumber: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  externalId: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  ean: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  gtin: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
              ]
            ),
          },
          select: {
            id: true,
            providerCode: true,
          },
          take: 300,
        });

      const globalMatches =
        Array.from(
          new Map(
            [
              ...globalIndexedItems,
              ...globalFallbackItems,
            ].map(
              (item) => [
                item.id,
                item,
              ]
            )
          ).values()
        );

      if (globalMatches.length > 0) {
        const {
          materializeGlobalSupplierCatalog,
        } = await import(
          "../lib/global-supplier-catalog-materialize.server"
        );

        for (const target of providerTargets.values()) {
          const globalItemIds =
            globalMatches
              .filter(
                (item) =>
                  item.providerCode ===
                  target.providerCode
              )
              .map(
                (item) =>
                  item.id
              );

          if (globalItemIds.length === 0) {
            continue;
          }

          await materializeGlobalSupplierCatalog({
            tenantId: access.tenantId,
            supplierId: target.supplierId,
            providerCode: target.providerCode,
            connectionId: target.connectionId,
            globalItemIds,
            limit: globalItemIds.length,
          });
        }

        globalMaterializedCatalogItems =
          await prisma.supplierCatalogItem.findMany({
            where: {
              tenantId: access.tenantId,
              active: true,
              ...(supplierId
                ? {
                    supplierId,
                  }
                : {}),
              globalCatalogItemId: {
                in: globalMatches.map(
                  (item) =>
                    item.id
                ),
              },
            },
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
              prices: {
                orderBy: {
                  fetchedAt: "desc",
                },
                take: 8,
              },
            },
            take: 700,
          });
      }
    }
  }

  const catalogItems =
    Array.from(
      new Map(
        [
          ...indexedCatalogItems,
          ...fallbackCatalogItems,
          ...globalMaterializedCatalogItems,
        ].map(
          (item: any) => [
            item.id,
            item,
          ]
        )
      ).values()
    );
  const results = catalogItems
    .map((item: any) => {
      const trusted =
        selectTrustedSupplierPrice(
          item.prices || []
        );

      const legacyPriceHidden =
        isLegacyMetroPriceSuspicious(
          item,
          trusted.price
        );

      const mapped = {
        ...item,
        latestPrice:
          legacyPriceHidden
            ? null
            : trusted.price,
        rejectedLatestPrice:
          legacyPriceHidden
            ? null
            : trusted.rejectedLatest,
        priceRefreshPending:
          legacyPriceHidden,
        score: resultScore(
          item,
          query,
          searchTerms
        ),
      };

      return {
        ...mapped,
        basePriceCents:
          legacyPriceHidden
            ? null
            : basePrice(mapped),
      };
    })
    .filter(
      (item: any) =>
        item.score > 0 &&
        (
          !availableOnly ||
          item.latestPrice?.available !== false
        )
    )
    .sort((left: any, right: any) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftPrice =
        left.latestPrice?.netPriceCents ??
        Number.MAX_SAFE_INTEGER;

      const rightPrice =
        right.latestPrice?.netPriceCents ??
        Number.MAX_SAFE_INTEGER;

      return leftPrice - rightPrice;
    });

  /*
   * gastario-supplier-search-cache-first-v1-20260809
   *
   * Bekannte Lieferantenartikel werden sofort aus dem lokalen
   * Gastario-Katalog angezeigt. Eine Live-Aktualisierung ist nur
   * nötig, wenn noch kein Treffer oder kein frischer Preis vorliegt.
   */
  const livePriceFreshnessMs =
    5 * 60 * 1000;

  const nowMs = Date.now();

  const freshestPriceAt =
    results.reduce<Date | null>(
      (freshest, item: any) => {
        const fetchedAt =
          item.latestPrice?.fetchedAt;

        if (!fetchedAt) {
          return freshest;
        }

        const date = new Date(fetchedAt);

        if (
          Number.isNaN(date.getTime()) ||
          (freshest &&
            freshest.getTime() >=
              date.getTime())
        ) {
          return freshest;
        }

        return date;
      },
      null
    );

  const cacheHasFreshPrice =
    Boolean(freshestPriceAt) &&
    nowMs -
      Number(freshestPriceAt?.getTime() || 0) <=
      livePriceFreshnessMs;


  const needsLegacyPriceRefresh =
    results.some(
      (item: any) =>
        item.priceRefreshPending ===
        true
    );
if (query.length >= 2) {
    const queryNormalized =
      normalizeSupplierSearchTerm(
        query
      );

    if (queryNormalized) {
      await prisma.supplierSearchDiscovery.upsert({
        where: {
          tenantId_queryNormalized: {
            tenantId: access.tenantId,
            queryNormalized,
          },
        },
        create: {
          tenantId: access.tenantId,
          query,
          queryNormalized,
          priority:
            results.length === 0 ||
            needsLegacyPriceRefresh
              ? 100
              : 20,
          searchCount: 1,
          status:
            results.length === 0 ||
            needsLegacyPriceRefresh
              ? "PENDING"
              : "SATISFIED",
          lastRequestedAt: new Date(),
          lastResultCount:
            results.length,
        },
        update: {
          query,
          priority:
            results.length === 0 ||
            needsLegacyPriceRefresh
              ? 100
              : 20,
          searchCount: {
            increment: 1,
          },
          status:
            results.length === 0 ||
            needsLegacyPriceRefresh
              ? "PENDING"
              : "SATISFIED",
          lastRequestedAt: new Date(),
          lastResultCount:
            results.length,
        },
      });
    }
  }

  return {
    tenant: access.tenant,
    query,
    searchTerms,
    portalQuery,
    supplierId,
    availableOnly,
    suppliers,
    products,
    results,
    searchCache: {
      freshestPriceAt:
        freshestPriceAt?.toISOString() || null,
      hasFreshPrice: cacheHasFreshPrice,
      freshnessMs: livePriceFreshnessMs,
    },
    metroConnector: metroConnection
      ? {
          id: metroConnection.id,
          supplierName:
            metroConnection.supplier.name,
          status:
            String(
              metroSettings.browserConnectorStatus ||
                metroConnection.status ||
                "CONFIGURED"
            ),
          lastSeenAt:
            String(
              metroSettings.browserConnectorLastSeenAt ||
                ""
            ) || null,
          pendingSearch: pendingMetroSearch
            ? {
                id: String(
                  pendingMetroSearch.id || ""
                ),
                query: String(
                  pendingMetroSearch.query || ""
                ),
                requestedAt: String(
                  pendingMetroSearch.requestedAt || ""
                ),
                status: String(
                  pendingMetroSearch.status ||
                    "PENDING"
                ),
              }
            : null,
          lastSearch: lastMetroSearch
            ? {
                id: String(
                  lastMetroSearch.id || ""
                ),
                query: String(
                  lastMetroSearch.query || ""
                ),
                completedAt: String(
                  lastMetroSearch.completedAt || ""
                ),
                items: Number(
                  lastMetroSearch.items || 0
                ),
              }
            : null,
        }
      : null,
    stats: {
      resultCount: results.length,
      supplierCount: new Set(
        results.map(
          (item: any) => item.supplierId
        )
      ).size,
      pricedCount: results.filter(
        (item: any) => item.latestPrice
      ).length,
      availableCount: results.filter(
        (item: any) =>
          item.latestPrice?.available !== false
      ).length,
    },
  };
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const formData = await request.formData();

  const intent = String(
    formData.get("intent") || ""
  ).trim();  if (intent === "request-metro-search") {
    const query = String(
      formData.get("query") || ""
    ).trim();

    if (query.length < 2) {
      return {
        error:
          "Bitte mindestens zwei Zeichen eingeben.",
      };
    }

    const queryNormalized =
      normalizeSupplierSearchTerm(
        query
      );

    if (queryNormalized) {
      await prisma.supplierSearchDiscovery.upsert({
        where: {
          tenantId_queryNormalized: {
            tenantId: access.tenantId,
            queryNormalized,
          },
        },
        create: {
          tenantId: access.tenantId,
          query,
          queryNormalized,
          priority: 100,
          searchCount: 1,
          status: "PENDING",
          lastRequestedAt: new Date(),
          lastResultCount: 0,
        },
        update: {
          query,
          priority: 100,
          searchCount: {
            increment: 1,
          },
          status: "PENDING",
          lastRequestedAt: new Date(),
        },
      });
    }

    return redirect(
      `/einkauf/artikelsuche?q=${encodeURIComponent(
        query
      )}&refreshQueued=1`
    );
  }

  if (intent !== "apply-catalog-item") {
    return {
      error: "Unbekannte Aktion.",
    };
  }

  const productId = String(
    formData.get("productId") || ""
  ).trim();

  const catalogItemId = String(
    formData.get("catalogItemId") || ""
  ).trim();

  const returnQuery = String(
    formData.get("returnQuery") || ""
  ).trim();

  const [product, catalogItem] =
    await Promise.all([
      prisma.product.findFirst({
        where: {
          id: productId,
          tenantId: access.tenantId,
        },
      }),
      prisma.supplierCatalogItem.findFirst({
        where: {
          id: catalogItemId,
          tenantId: access.tenantId,
          active: true,
        },
        include: {
          supplier: true,
          prices: {
            orderBy: {
              fetchedAt: "desc",
            },
            take: 8,
          },
        },
      }),
    ]);

  if (!product || !catalogItem) {
    return {
      error:
        "Produkt oder Lieferantenartikel wurde nicht gefunden.",
    };
  }

  const trustedAppliedPrice =
    selectTrustedSupplierPrice(
      catalogItem.prices || []
    );

  const latestPrice =
    trustedAppliedPrice.price;

  const purchaseUnit =
    catalogItem.baseUnit ||
    latestPrice?.priceUnit ||
    product.purchaseUnit ||
    "Stueck";

  const packageQuantity =
    Number(
      catalogItem.contentQuantity ||
        catalogItem.packageQuantity ||
        latestPrice?.priceUnitQuantity ||
        0
    ) || null;

  await prisma.product.update({
    where: {
      id: product.id,
    },
    data: {
      supplierName:
        catalogItem.supplier.name,
      supplierArticleName:
        catalogItem.name,
      supplierArticleNumber:
        catalogItem.articleNumber ||
        catalogItem.externalId ||
        null,
      purchaseUnit,
      packageUnit:
        catalogItem.orderUnit ||
        "Gebinde",
      packageQuantity,
      purchasePriceCents:
        latestPrice?.netPriceCents ??
        product.purchasePriceCents,
      procurementType:
        product.procurementType === "RECIPE"
          ? "READY_MADE"
          : product.procurementType,
      operationalArea:
        String(
          product.operationalArea ||
            "REVIEW"
        ).toUpperCase() === "REVIEW"
          ? "KITCHEN"
          : product.operationalArea,
    },
  });

  const learningQuery =
    normalizeSupplierSearchTerm(
      returnQuery
    );

  if (learningQuery.length >= 2) {
    const learningCandidates =
      extractSupplierSearchLearningCandidates({
        query: returnQuery,
        itemName: catalogItem.name,
        brand: catalogItem.brand,
      });

    for (const candidateTerm of learningCandidates) {
      const candidateNormalized =
        normalizeSupplierSearchTerm(
          candidateTerm
        );

      if (
        !candidateNormalized ||
        candidateNormalized === learningQuery
      ) {
        continue;
      }

      const existingAlias =
        await prisma.supplierSearchAlias.findUnique({
          where: {
            tenantId_aliasNormalized: {
              tenantId: access.tenantId,
              aliasNormalized:
                candidateNormalized,
            },
          },
          select: {
            id: true,
          },
        });

      if (existingAlias) {
        continue;
      }

      const learningSuggestion =
        await prisma.supplierSearchLearningSuggestion.upsert({
          where: {
            tenantId_queryNormalized_candidateNormalized: {
              tenantId: access.tenantId,
              queryNormalized:
                learningQuery,
              candidateNormalized,
            },
          },
          create: {
            tenantId: access.tenantId,
            queryTerm: returnQuery,
            queryNormalized:
              learningQuery,
            candidateTerm,
            candidateNormalized,
            evidenceCount: 1,
            status: "PENDING",
            lastCatalogItemName:
              catalogItem.name,
            lastSupplierName:
              catalogItem.supplier.name,
            lastSeenAt: new Date(),
          },
          update: {
            queryTerm: returnQuery,
            candidateTerm,
            evidenceCount: {
              increment: 1,
            },
            status: "PENDING",
            lastCatalogItemName:
              catalogItem.name,
            lastSupplierName:
              catalogItem.supplier.name,
            lastSeenAt: new Date(),
          },
        });

      /*
       * Automatisch freigeben nur bei reziproker Evidenz:
       *
       * A -> B mindestens 2x
       * B -> A mindestens 2x
       *
       * Dadurch reicht es nicht, dass z. B. bei "Marmelade"
       * mehrfach "Erdbeere" im Artikelnamen vorkommt. Erst wenn
       * auch die umgekehrte Such-/Auswahlbeziehung beobachtet wurde,
       * darf Gastario selbstständig daraus einen Alias machen.
       */
      if (
        learningSuggestion.evidenceCount >= 2
      ) {
        const reverseSuggestion =
          await prisma.supplierSearchLearningSuggestion.findUnique({
            where: {
              tenantId_queryNormalized_candidateNormalized: {
                tenantId: access.tenantId,
                queryNormalized:
                  candidateNormalized,
                candidateNormalized:
                  learningQuery,
              },
            },
          });

        if (
          reverseSuggestion &&
          reverseSuggestion.status === "PENDING" &&
          reverseSuggestion.evidenceCount >= 2
        ) {
          const existingAliases =
            await prisma.supplierSearchAlias.findMany({
              where: {
                tenantId: access.tenantId,
                aliasNormalized: {
                  in: [
                    learningQuery,
                    candidateNormalized,
                  ],
                },
              },
              select: {
                aliasNormalized: true,
                canonicalNormalized: true,
              },
            });

          /*
           * Sobald einer der beiden Begriffe bereits zu einer
           * bestehenden Gruppe gehört, bleibt der Vorschlag bewusst
           * manuell prüfbar. So überschreibt Auto-Learning niemals
           * vorhandene Suchlogik.
           */
          if (existingAliases.length === 0) {
            const canonicalTerm =
              learningSuggestion.queryTerm;

            const canonicalNormalized =
              learningSuggestion.queryNormalized;

            const combinedEvidence =
              learningSuggestion.evidenceCount +
              reverseSuggestion.evidenceCount;

            await prisma.$transaction([
              prisma.supplierSearchAlias.create({
                data: {
                  tenantId: access.tenantId,
                  canonicalTerm,
                  aliasTerm:
                    learningSuggestion.queryTerm,
                  canonicalNormalized,
                  aliasNormalized:
                    learningSuggestion.queryNormalized,
                  active: true,
                  source: "AUTO_LEARNED",
                  useCount: combinedEvidence,
                },
              }),

              prisma.supplierSearchAlias.create({
                data: {
                  tenantId: access.tenantId,
                  canonicalTerm,
                  aliasTerm:
                    learningSuggestion.candidateTerm,
                  canonicalNormalized,
                  aliasNormalized:
                    learningSuggestion.candidateNormalized,
                  active: true,
                  source: "AUTO_LEARNED",
                  useCount: combinedEvidence,
                },
              }),

              prisma.supplierSearchLearningSuggestion.update({
                where: {
                  id: learningSuggestion.id,
                },
                data: {
                  status: "AUTO_ACCEPTED",
                },
              }),

              prisma.supplierSearchLearningSuggestion.update({
                where: {
                  id: reverseSuggestion.id,
                },
                data: {
                  status: "AUTO_ACCEPTED",
                },
              }),
            ]);
          }
        }
      }
    }
  }

  return redirect(
    `/einkauf/artikelsuche?q=${encodeURIComponent(
      returnQuery
    )}&saved=1`
  );
}

export default function ProcurementSearchPage() {
  const data = useLoaderData<typeof loader>();
  const actionData =
    useActionData<typeof action>();

  const metroFetcher =
    useFetcher<typeof action>();

  const revalidator = useRevalidator();

  const liveSearchFreshnessMs =
    data.searchCache.freshnessMs;

  const lastLiveSearchCompletedAt =
    data.metroConnector?.lastSearch?.completedAt
      ? new Date(
          data.metroConnector.lastSearch.completedAt
        ).getTime()
      : 0;

  const lastLiveSearchMatches =
    data.metroConnector?.lastSearch?.query
      ?.trim()
      .toLocaleLowerCase("de-DE") ===
    data.portalQuery
      .trim()
      .toLocaleLowerCase("de-DE");

  const lastLiveSearchIsFresh =
    lastLiveSearchMatches &&
    Number.isFinite(lastLiveSearchCompletedAt) &&
    Date.now() - lastLiveSearchCompletedAt <=
      liveSearchFreshnessMs;
  const shouldStartMetroSearch = false;
  useEffect(() => {
    if (
      !shouldStartMetroSearch ||
      metroFetcher.state !== "idle"
    ) {
      return;
    }

    const formData = new FormData();

    formData.set(
      "intent",
      "request-metro-search"
    );

    formData.set("query", data.query);

    metroFetcher.submit(formData, {
      method: "post",
    });
  }, [
    data.query,
    metroFetcher,
    shouldStartMetroSearch,
  ]);

  useEffect(() => {
    if (
      metroFetcher.state === "idle" &&
      metroFetcher.data
    ) {
      revalidator.revalidate();
    }
  }, [
    metroFetcher.data,
    metroFetcher.state,
    revalidator,
  ]);

  return (
    <AppLayout>
      <GastarioPage>

        <GastarioHeader
          eyebrow="Einkauf & Lieferanten"
          title="Artikelsuche"
          description={`Durchsuche alle verbundenen Lieferantenkataloge von ${data.tenant.name} und vergleiche aktuelle Preise und Gebinde.`}
          actions={
            <>
              <Link
                className={gastarioButtonClass("secondary")}
                to="/einkauf"
              >
                Zur Einkaufsplanung
              </Link>

              <Link
                className={gastarioButtonClass("secondary")}
                to="/einkauf/preispruefung"
              >
                Preisprüfung
              </Link>

              <Link
                className={gastarioButtonClass("secondary")}
                to="/einkauf/suchbegriffe"
              >
                Suchbegriffe verwalten
              </Link>

              <Link
                className={gastarioButtonClass("secondary")}
                to="/lieferanten"
              >
                Lieferanten verwalten
              </Link>
            </>
          }
        />

        {actionData?.error ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}

        <GastarioSection
          eyebrow="Lieferantenübergreifend"
          title="Was möchtest du einkaufen?"
          description={`Gastario durchsucht den lokalen Lieferantenindex sofort und berücksichtigt verwandte Begriffe wie ${data.searchTerms.slice(0, 4).join(", ") || data.query}. Kataloge und Preise werden im Hintergrund aktualisiert.`}
        >
          <Form method="get">
            <GastarioToolbar>
              <GastarioField label="Artikel, Marke oder Artikelnummer">
                <GastarioInput
                  type="search"
                  name="q"
                  defaultValue={data.query}
                  placeholder="Zum Beispiel Marmelade, Mini Croissant oder Gyoza"
                  autoFocus
                />
              </GastarioField>

              <GastarioField label="Lieferant">
                <GastarioSelect
                  name="supplier"
                  defaultValue={data.supplierId}
                >
                  <option value="">
                    Alle Lieferanten
                  </option>

                  {data.suppliers.map(
                    (supplier: any) => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.name}
                      </option>
                    )
                  )}
                </GastarioSelect>
              </GastarioField>

              <GastarioCheckRow
                name="available"
                value="1"
                defaultChecked={
                  data.availableOnly
                }
                title="Nur verfügbare Artikel"
              />

              <button
                type="submit"
                className={gastarioButtonClass(
                  "primary"
                )}
              >
                Katalog aktualisieren
              </button>
            </GastarioToolbar>
          </Form>
        </GastarioSection>

        {data.query.length >= 2 ? (
          <GastarioMetricGrid>
            <GastarioMetric
              label="Treffer"
              value={data.stats.resultCount}
              description={`für „${data.query}“`}
              badge="Kataloge"
            />

            <GastarioMetric
              label="Lieferanten"
              value={data.stats.supplierCount}
              description="mit passenden Artikeln"
              badge="Vergleich"
            />

            <GastarioMetric
              label="Mit Preis"
              value={data.stats.pricedCount}
              description="aktuell bepreiste Treffer"
              badge="Preis"
            />

            <GastarioMetric
              label="Verfügbar"
              value={data.stats.availableCount}
              description="laut letztem Preisstand"
              badge="Bestand"
            />
          </GastarioMetricGrid>
        ) : null}

        <GastarioSection
          eyebrow="Ergebnisse"
          title={
            data.query.length >= 2
              ? `Angebote für „${data.query}“`
              : "Suche starten"
          }
          description="Sortiert nach Relevanz und anschließend nach Nettopreis."
        >
          {data.query.length < 2 ? (
            <GastarioEmptyState title="Suche starten">
              Gib mindestens zwei Zeichen ein. Gastario durchsucht
              Produktnamen, Marken, Beschreibungen, Artikelnummern,
              EAN und GTIN.
            </GastarioEmptyState>
          ) : data.results.length === 0 ? (
            data.metroConnector ? (
              shouldStartMetroSearch ||
              metroFetcher.state !== "idle" ? (
                <GastarioEmptyState title="Angebote werden gesucht …">
                  Die lokale Artikelsuche wird aktualisiert.
                </GastarioEmptyState>
              ) : (
                <GastarioEmptyState title="Keine passenden Angebote gefunden">
                  Der Begriff wurde bereits in den verbundenen
                  Katalogen geprüft.
                </GastarioEmptyState>
              )
            ) : (
              <GastarioEmptyState title="Keine aktive Lieferantenverbindung">
                <GastarioStack>
                  <span>
                    Für die Live-Suche ist aktuell keine aktive
                    Lieferantenverbindung vorhanden.
                  </span>

                  <Link
                    className={gastarioButtonClass(
                      "secondary"
                    )}
                    to="/lieferanten"
                  >
                    Verbindung prüfen
                  </Link>
                </GastarioStack>
              </GastarioEmptyState>
            )
          ) : (
            <GastarioStack>
              {data.results.map(
                (item: any) => {
                  const priceStatusTitle =
                    item.latestPrice
                      ? "Preis freigegeben"
                      : item.priceRefreshPending ||
                          item.rejectedLatestPrice
                        ? "Preisprüfung"
                        : "Preis offen";

                  const priceStatusDescription =
                    item.latestPrice
                      ? "Vertrauenswürdiger Preis kann verwendet werden."
                      : item.priceRefreshPending ||
                          item.rejectedLatestPrice
                        ? "Preis wird validiert und noch nicht übernommen."
                        : "Noch kein freigegebener Preis vorhanden.";

                  return (
                    <GastarioSection
                      key={item.id}
                      eyebrow={item.supplier.name}
                      title={item.name}
                      description={[
                        item.brand,
                        item.articleNumber
                          ? `Art.-Nr. ${item.articleNumber}`
                          : null,
                        item.ean
                          ? `EAN ${item.ean}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      <GastarioMetricGrid>
                        <GastarioMetric
                          label="Nettopreis"
                          value={formatMoney(
                            item.latestPrice
                              ?.netPriceCents
                          )}
                          description={
                            item.basePriceCents != null
                              ? `${formatMoney(
                                  item.basePriceCents
                                )} je ${
                                  item.baseUnit ||
                                  item.latestPrice
                                    ?.priceUnit ||
                                  "Einheit"
                                }`
                              : "Grundpreis nicht berechenbar"
                          }
                        />

                        <GastarioMetric
                          label="Bestelleinheit"
                          value={
                            item.orderUnit ||
                            "Gebinde"
                          }
                          description="Lieferanteneinheit"
                        />

                        <GastarioMetric
                          label="Gebindeinhalt"
                          value={
                            item.contentQuantity
                              ? `${formatNumber(
                                  item.contentQuantity
                                )} ${
                                  item.baseUnit || ""
                                }`
                              : item.packageQuantity
                                ? `${formatNumber(
                                    item.packageQuantity
                                  )} Packungen`
                                : "Nicht angegeben"
                          }
                          description="Inhalt pro Bestelleinheit"
                        />

                        <GastarioMetric
                          label="Mindestmenge"
                          value={formatNumber(
                            item.minimumOrderQuantity ||
                              1
                          )}
                          description="Bestellmenge"
                        />

                        <GastarioMetric
                          label="Verfügbarkeit"
                          value={
                            item.latestPrice
                              ?.available === false
                              ? "Nicht verfügbar"
                              : item.latestPrice
                                  ?.stockText ||
                                item.availabilityStatus ||
                                "Verfügbar / unbekannt"
                          }
                          description="Letzter Lieferantenstatus"
                        />

                        <GastarioMetric
                          label="Preisstand"
                          value={formatDateTime(
                            item.latestPrice
                              ?.fetchedAt ||
                              item.lastSeenAt
                          )}
                          description="Letzte Aktualisierung"
                        />
                      </GastarioMetricGrid>

                      {item.priceRefreshPending ? (
                        <GastarioNotice type="warning">
                          Preis wird im Hintergrund
                          aktualisiert.
                        </GastarioNotice>
                      ) : item.rejectedLatestPrice &&
                        item.latestPrice ? (
                        <GastarioNotice type="warning">
                          Neuer Preis wird geprüft.
                          Bis dahin wird der letzte
                          plausible Preis verwendet.
                        </GastarioNotice>
                      ) : item.rejectedLatestPrice ? (
                        <GastarioNotice type="warning">
                          Neuer Preis wird geprüft.
                          Es ist noch kein freigegebener
                          Preis verfügbar.
                        </GastarioNotice>
                      ) : null}

                      <GastarioDataList>
                        <GastarioDataRow>
                          <div className="g-ui-data-row-main">
                            <strong className="g-ui-data-row-title">
                              Shop erkannt
                            </strong>
                            <span className="g-ui-data-row-description">
                              Artikel wurde beim Lieferanten gefunden.
                            </span>
                          </div>
                          <div className="g-ui-data-row-meta">
                            Erledigt
                          </div>
                        </GastarioDataRow>

                        <GastarioDataRow>
                          <div className="g-ui-data-row-main">
                            <strong className="g-ui-data-row-title">
                              Gastario Index
                            </strong>
                            <span className="g-ui-data-row-description">
                              Artikel ist lokal gespeichert und suchbar.
                            </span>
                          </div>
                          <div className="g-ui-data-row-meta">
                            Erledigt
                          </div>
                        </GastarioDataRow>

                        <GastarioDataRow>
                          <div className="g-ui-data-row-main">
                            <strong className="g-ui-data-row-title">
                              {priceStatusTitle}
                            </strong>
                            <span className="g-ui-data-row-description">
                              {priceStatusDescription}
                            </span>
                          </div>
                          <div className="g-ui-data-row-meta">
                            {item.latestPrice
                              ? "Erledigt"
                              : item.priceRefreshPending ||
                                  item.rejectedLatestPrice
                                ? "Prüfung"
                                : "Offen"}
                          </div>
                        </GastarioDataRow>
                      </GastarioDataList>

                      {item.description ? (
                        <GastarioNotice type="info">
                          {item.description}
                        </GastarioNotice>
                      ) : null}

                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="apply-catalog-item"
                        />
                        <input
                          type="hidden"
                          name="catalogItemId"
                          value={item.id}
                        />
                        <input
                          type="hidden"
                          name="returnQuery"
                          value={data.query}
                        />

                        <GastarioToolbar>
                          <GastarioField label="Als Einkaufsartikel für Produkt">
                            <GastarioSelect
                              name="productId"
                              required
                              defaultValue=""
                            >
                              <option value="">
                                Produkt auswählen
                              </option>

                              {data.products.map(
                                (product: any) => (
                                  <option
                                    value={product.id}
                                    key={product.id}
                                  >
                                    {product.name}
                                    {product.procurementType !==
                                    "RECIPE"
                                      ? " · Fertigartikel"
                                      : ""}
                                  </option>
                                )
                              )}
                            </GastarioSelect>
                          </GastarioField>

                          <button
                            type="submit"
                            className={gastarioButtonClass(
                              "primary"
                            )}
                          >
                            Übernehmen
                          </button>
                        </GastarioToolbar>
                      </Form>
                    </GastarioSection>
                  );
                }
              )}
            </GastarioStack>
          )}
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}
