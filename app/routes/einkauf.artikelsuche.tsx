import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-page-shell.css";
import "../styles/gastario-procurement-search.css";

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

function resultScore(item: any, query: string) {
  if (!query) {
    return 0;
  }

  const normalizedQuery = normalizedText(query);
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
    if (field === normalizedQuery) {
      score = Math.max(score, 100);
    } else if (field.startsWith(normalizedQuery)) {
      score = Math.max(score, 85);
    } else if (field.includes(normalizedQuery)) {
      score = Math.max(score, 70);
    }

    const queryTokens = normalizedQuery
      .split(/\s+/)
      .filter(Boolean);

    const tokenMatches = queryTokens.filter(
      (token) => field.includes(token)
    ).length;

    if (queryTokens.length > 0) {
      score = Math.max(
        score,
        Math.round(
          (tokenMatches / queryTokens.length) * 60
        )
      );
    }
  }

  return score;
}

function basePrice(item: any) {
  const price = item.prices?.[0];

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

  const pendingMetroSearch =
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

  const catalogItems =
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
            OR: [
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                brand: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                articleNumber: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                ean: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                gtin: {
                  contains: query,
                  mode: "insensitive",
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
            prices: {
              orderBy: {
                fetchedAt: "desc",
              },
              take: 1,
            },
          },
          take: 250,
        })
      : [];

  const results = catalogItems
    .map((item: any) => ({
      ...item,
      latestPrice: item.prices?.[0] || null,
      score: resultScore(item, query),
      basePriceCents: basePrice(item),
    }))
    .filter(
      (item: any) =>
        !availableOnly ||
        item.latestPrice?.available !== false
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

  return {
    tenant: access.tenant,
    query,
    supplierId,
    availableOnly,
    suppliers,
    products,
    results,
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
  ).trim();

  if (intent === "request-metro-search") {
    const query = String(
      formData.get("query") || ""
    ).trim();

    if (query.length < 2) {
      return {
        error:
          "Bitte mindestens zwei Zeichen für die METRO-Suche eingeben.",
      };
    }

    const connection =
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
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!connection) {
      return {
        error:
          "Es wurde keine aktive METRO-Verbindung gefunden.",
      };
    }

    const settings =
      connection.settingsJson &&
      typeof connection.settingsJson === "object" &&
      !Array.isArray(connection.settingsJson)
        ? (connection.settingsJson as Record<
            string,
            unknown
          >)
        : {};

    const requestId =
      "metro-search-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10);

    await prisma.supplierConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        settingsJson: {
          ...settings,
          browserConnectorSearchRequest: {
            id: requestId,
            query,
            requestedAt:
              new Date().toISOString(),
            status: "PENDING",
          },
        } as any,
      },
    });

    return redirect(
      `/einkauf/artikelsuche?q=${encodeURIComponent(
        query
      )}&metroRequested=1`
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
            take: 1,
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

  const latestPrice =
    catalogItem.prices?.[0] || null;

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

  return (
    <AppLayout>
      <PageShell className="procurementSearchPage">
        <PageHeader
          eyebrow="Einkauf & Lieferanten"
          title="Artikelsuche"
          subtitle={`Durchsuche alle verbundenen Lieferantenkataloge von ${data.tenant.name} und vergleiche aktuelle Preise und Gebinde.`}
          actions={
            <>
              <Link
                className="procurementSearchButton procurementSearchButton--secondary"
                to="/einkauf"
              >
                Zur Einkaufsplanung
              </Link>

              <Link
                className="procurementSearchButton procurementSearchButton--secondary"
                to="/lieferanten"
              >
                Lieferanten verwalten
              </Link>
            </>
          }
        />

        {actionData?.error ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        <PageSection
          eyebrow="Lieferantenübergreifend"
          title="Was möchtest du einkaufen?"
          description="Die Suche verwendet aktuell alle bereits synchronisierten Kataloge. Spätere Portal-Connectoren liefern ihre Ergebnisse in dieselbe Ansicht."
        >
          <Form
            method="get"
            className="procurementSearchForm"
          >
            <label className="procurementSearchQuery">
              <span>Artikel, Marke oder Artikelnummer</span>
              <input
                type="search"
                name="q"
                defaultValue={data.query}
                placeholder="Zum Beispiel Marmelade, Mini Croissant oder Gyoza"
                autoFocus
              />
            </label>

            <label>
              <span>Lieferant</span>
              <select
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
              </select>
            </label>

            <label className="procurementSearchCheck">
              <input
                type="checkbox"
                name="available"
                value="1"
                defaultChecked={
                  data.availableOnly
                }
              />
              <span>Nur verfügbare Artikel</span>
            </label>

            <button
              type="submit"
              className="procurementSearchButton procurementSearchButton--primary"
            >
              Lieferanten durchsuchen
            </button>
          </Form>
        </PageSection>

        {data.query.length >= 2 ? (
          <MetricGrid>
            <MetricCard
              label="Treffer"
              value={data.stats.resultCount}
              description={`für „${data.query}“`}
              badge="Kataloge"
            />

            <MetricCard
              label="Lieferanten"
              value={data.stats.supplierCount}
              description="mit passenden Artikeln"
              badge="Vergleich"
            />

            <MetricCard
              label="Mit Preis"
              value={data.stats.pricedCount}
              description="aktuell bepreiste Treffer"
              badge="Preis"
            />

            <MetricCard
              label="Verfügbar"
              value={data.stats.availableCount}
              description="laut letztem Preisstand"
              badge="Bestand"
            />
          </MetricGrid>
        ) : null}

        <PageSection
          eyebrow="Ergebnisse"
          title={
            data.query.length >= 2
              ? `Angebote für „${data.query}“`
              : "Suche starten"
          }
          description="Sortiert nach Relevanz und anschließend nach Nettopreis."
        >
          {data.query.length < 2 ? (
            <div className="procurementSearchEmpty">
              Gib mindestens zwei Zeichen ein. Gastario durchsucht Produktnamen, Marken, Beschreibungen, Artikelnummern, EAN und GTIN.
            </div>
          ) : data.results.length === 0 ? (
            <div className="procurementSearchEmpty procurementSearchMetroEmpty">
              <strong>
                Noch kein gespeicherter Treffer
              </strong>

              <span>
                Gastario kann die Suche jetzt an den lokalen
                METRO-Connector übergeben. Die Erweiterung
                übernimmt den Suchbegriff beim nächsten Abruf
                und sendet die sichtbaren Treffer zurück.
              </span>

              {data.metroConnector ? (
                <>
                  <div className="procurementSearchMetroStatus">
                    <span>METRO-Connector</span>
                    <strong>
                      {data.metroConnector.status}
                    </strong>
                    <small>
                      {data.metroConnector.lastSeenAt
                        ? `Zuletzt gesehen: ${formatDateTime(
                            data.metroConnector.lastSeenAt
                          )}`
                        : "Noch keine aktive Rückmeldung"}
                    </small>
                  </div>

                  {data.metroConnector.pendingSearch ? (
                    <div className="procurementSearchMetroPending">
                      <span>Suchauftrag wartet</span>
                      <strong>
                        {
                          data.metroConnector
                            .pendingSearch.query
                        }
                      </strong>
                      <small>
                        Angefordert am{" "}
                        {formatDateTime(
                          data.metroConnector
                            .pendingSearch
                            .requestedAt
                        )}
                      </small>
                    </div>
                  ) : (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="request-metro-search"
                      />
                      <input
                        type="hidden"
                        name="query"
                        value={data.query}
                      />

                      <button
                        type="submit"
                        className="procurementSearchButton procurementSearchButton--primary"
                      >
                        Jetzt bei METRO suchen
                      </button>
                    </Form>
                  )}
                </>
              ) : (
                <Link
                  className="procurementSearchButton procurementSearchButton--secondary"
                  to="/lieferanten"
                >
                  METRO-Verbindung prüfen
                </Link>
              )}
            </div>
          ) : (
            <div className="procurementSearchResults">
              {data.results.map(
                (item: any) => (
                  <article
                    key={item.id}
                    className="procurementSearchResult"
                  >
                    <header>
                      <div>
                        <span>
                          {item.supplier.name}
                        </span>
                        <h3>{item.name}</h3>
                        <p>
                          {[
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
                        </p>
                      </div>

                      <div className="procurementSearchPrice">
                        <small>Nettopreis</small>
                        <strong>
                          {formatMoney(
                            item.latestPrice
                              ?.netPriceCents
                          )}
                        </strong>
                        <span>
                          {item.basePriceCents != null
                            ? `${formatMoney(
                                item.basePriceCents
                              )} je ${item.baseUnit || item.latestPrice?.priceUnit || "Einheit"}`
                            : "Grundpreis nicht berechenbar"}
                        </span>
                      </div>
                    </header>

                    <div className="procurementSearchFacts">
                      <div>
                        <span>Bestelleinheit</span>
                        <strong>
                          {item.orderUnit ||
                            "Gebinde"}
                        </strong>
                      </div>

                      <div>
                        <span>Gebindeinhalt</span>
                        <strong>
                          {item.contentQuantity
                            ? `${formatNumber(
                                item.contentQuantity
                              )} ${item.baseUnit || ""}`
                            : item.packageQuantity
                              ? `${formatNumber(
                                  item.packageQuantity
                                )} Packungen`
                              : "Nicht angegeben"}
                        </strong>
                      </div>

                      <div>
                        <span>Mindestmenge</span>
                        <strong>
                          {formatNumber(
                            item.minimumOrderQuantity ||
                              1
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Verfügbarkeit</span>
                        <strong>
                          {item.latestPrice
                            ?.available === false
                            ? "Nicht verfügbar"
                            : item.latestPrice
                                ?.stockText ||
                              item.availabilityStatus ||
                              "Verfügbar / unbekannt"}
                        </strong>
                      </div>

                      <div>
                        <span>Preisstand</span>
                        <strong>
                          {formatDateTime(
                            item.latestPrice
                              ?.fetchedAt ||
                              item.lastSeenAt
                          )}
                        </strong>
                      </div>
                    </div>

                    {item.description ? (
                      <p className="procurementSearchDescription">
                        {item.description}
                      </p>
                    ) : null}

                    <Form
                      method="post"
                      className="procurementSearchApply"
                    >
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

                      <label>
                        <span>
                          Als Einkaufsartikel für Produkt
                        </span>
                        <select
                          name="productId"
                          required
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
                        </select>
                      </label>

                      <button
                        type="submit"
                        className="procurementSearchButton procurementSearchButton--primary"
                      >
                        Übernehmen
                      </button>
                    </Form>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}