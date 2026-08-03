import { Form, Link, redirect, useLoaderData } from "react-router";

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
import "../styles/gastario-procurement.css";

const PURCHASING_STATUSES = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "PACKING_OPEN",
] as const;

function todayInput() {
  const now = new Date();

  const localDate = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60_000
  );

  return localDate
    .toISOString()
    .slice(0, 10);
}

function normalizeDate(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDateOption(value: string) {
  if (value === "ohne-datum") {
    return "Ohne Datum";
  }

  return new Date(
    `${value}T00:00:00`
  ).toLocaleDateString("de-DE");
}

function formatQty(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
}

function formatPriceAge(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Zeitpunkt unbekannt";
  }

  return date.toLocaleString("de-DE");
}
function effectiveOperationalArea(item: any) {
  return String(
    item?.operationalArea ||
      item?.product?.operationalArea ||
      "REVIEW"
  ).toUpperCase();
}

function effectiveOperationalQuantity(item: any) {
  const value = Number(
    item?.operationalQuantity ??
      item?.quantity ??
      0
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function effectiveOperationalUnit(item: any) {
  return String(
    item?.operationalUnit ||
      item?.product?.unit ||
      item?.unit ||
      "Stueck"
  ).trim();
}

/*
 * gastario-procurement-ingredient-mapping-v1-20260803
 * Manuelle und nachvollziehbare Zuordnung von Zutaten
 * zu echten Lieferantenartikeln.
 */
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

  const returnDate = String(
    formData.get("returnDate") || ""
  ).trim();

  const redirectTarget = returnDate
    ? `/einkauf?date=${encodeURIComponent(
        returnDate
      )}#ingredient-mapping`
    : "/einkauf#ingredient-mapping";

  if (intent === "save-ingredient-match") {
    const ingredientId = String(
      formData.get("ingredientId") || ""
    ).trim();

    const catalogItemId = String(
      formData.get("catalogItemId") || ""
    ).trim();

    const preferred =
      String(
        formData.get("preferred") || ""
      ) === "true";

    if (!ingredientId || !catalogItemId) {
      throw new Response(
        "Zutat und Lieferantenartikel sind erforderlich.",
        {
          status: 400,
        }
      );
    }

    const [ingredient, catalogItem] =
      await Promise.all([
        prisma.procurementIngredient.findFirst({
          where: {
            id: ingredientId,
            tenantId: access.tenantId,
            active: true,
          },
        }),
        prisma.supplierCatalogItem.findFirst({
          where: {
            id: catalogItemId,
            tenantId: access.tenantId,
            active: true,
          },
        }),
      ]);

    if (!ingredient || !catalogItem) {
      throw new Response(
        "Zutat oder Lieferantenartikel wurde nicht gefunden.",
        {
          status: 404,
        }
      );
    }

    if (preferred) {
      await prisma.procurementIngredientMatch.updateMany({
        where: {
          tenantId: access.tenantId,
          ingredientId,
        },
        data: {
          preferred: false,
        },
      });
    }

    await prisma.procurementIngredientMatch.upsert({
      where: {
        ingredientId_catalogItemId: {
          ingredientId,
          catalogItemId,
        },
      },
      update: {
        active: true,
        preferred,
        method: "MANUAL",
        confidence: 100,
      },
      create: {
        tenantId: access.tenantId,
        ingredientId,
        catalogItemId,
        active: true,
        preferred,
        method: "MANUAL",
        confidence: 100,
      },
    });

    return redirect(redirectTarget);
  }

  if (intent === "remove-ingredient-match") {
    const matchId = String(
      formData.get("matchId") || ""
    ).trim();

    if (!matchId) {
      throw new Response(
        "Zuordnung fehlt.",
        {
          status: 400,
        }
      );
    }

    await prisma.procurementIngredientMatch.updateMany({
      where: {
        id: matchId,
        tenantId: access.tenantId,
      },
      data: {
        active: false,
        preferred: false,
      },
    });

    return redirect(redirectTarget);
  }

  throw new Response(
    "Unbekannte Aktion.",
    {
      status: 400,
    }
  );
}
export function meta() {
  return [{ title: "Einkaufsplanung · Gastario" }];
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

  const selectedDate =
    url.searchParams.get("date") ||
    todayInput();

  /*
   * gastario-purchasing-masterdesign-v1-20260802
   *
   * deliveryTimeText ist das echte Order-Feld.
   * Die bisherige Abfrage auf deliveryTime verursachte
   * den Laufzeitfehler der Einkaufsseite.
   */
  const orders = await prisma.order.findMany({
    where: {
      tenantId: access.tenantId,
      status: {
        in: [...PURCHASING_STATUSES] as any,
      },
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              recipeItems: true,
            },
          },
        },
      },
      customer: true,
    },
    orderBy: [
      { deliveryDate: "asc" },
      { deliveryTimeText: "asc" },
      { createdAt: "desc" },
    ],
    take: 500,
  });

  const availableDates = Array.from(
    new Set(
      (orders as any[])
        .map((order) =>
          order.deliveryDate
            ? normalizeDate(order.deliveryDate)
            : "ohne-datum"
        )
        .filter(Boolean)
    )
  ).sort();

  if (!availableDates.includes(selectedDate)) {
    availableDates.unshift(selectedDate);
  }

  const filteredOrders = (orders as any[]).filter(
    (order) => {
      if (!order.deliveryDate) {
        return selectedDate === "ohne-datum";
      }

      return (
        normalizeDate(order.deliveryDate) ===
        selectedDate
      );
    }
  );

  const demandMap = new Map<string, any>();
  const missingMap = new Map<string, any>();

  for (const order of filteredOrders) {
    for (const orderItem of order.items || []) {
      const area =
        effectiveOperationalArea(orderItem);

      if (
        area === "PACKING" ||
        area === "LOGISTICS" ||
        area === "NON_OPERATIONAL"
      ) {
        continue;
      }

      const product = orderItem.product;
      const orderQty =
        effectiveOperationalQuantity(orderItem);

      const productName = String(
        product?.name ||
          orderItem.name ||
          "Unbekannte Position"
      ).trim();

      const unit =
        effectiveOperationalUnit(orderItem);

      let missingReason = "";

      if (area === "REVIEW") {
        missingReason =
          "Operative Zuordnung fehlt";
      } else if (!product) {
        missingReason =
          "Kein Gastario-Produkt verknüpft";
      } else if (
        !Array.isArray(product.recipeItems) ||
        product.recipeItems.length === 0
      ) {
        missingReason =
          "Keine Rezeptur hinterlegt";
      }

      if (missingReason) {
        const key =
          `${product?.id || productName}__${missingReason}`;

        if (!missingMap.has(key)) {
          missingMap.set(key, {
            name: productName,
            quantity: 0,
            unit,
            reason: missingReason,
            orders: [],
          });
        }

        const row = missingMap.get(key);

        row.quantity += orderQty;

        row.orders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
        });

        continue;
      }

      for (const recipeItem of product.recipeItems) {
        const ingredientName = String(
          recipeItem.ingredientName || ""
        ).trim();

        if (!ingredientName) {
          continue;
        }

        const recipeUnit = String(
          recipeItem.unit || "g"
        ).trim();

        const supplierName = String(
          recipeItem.supplierName ||
            "Ohne Lieferant"
        ).trim();

        const requiredQty =
          Number(
            recipeItem.quantityPerUnit || 0
          ) * orderQty;

        const key = [
          supplierName.toLocaleLowerCase("de-DE"),
          ingredientName.toLocaleLowerCase("de-DE"),
          recipeUnit.toLocaleLowerCase("de-DE"),
        ].join("__");

        if (!demandMap.has(key)) {
          demandMap.set(key, {
            supplierName,
            ingredientName,
            unit: recipeUnit,
            quantity: 0,
            sources: [],
          });
        }

        const row = demandMap.get(key);

        row.quantity += requiredQty;

        row.sources.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          productName,
          productQuantity: orderQty,
        });
      }
    }
  }

  const demandItems = Array.from(
    demandMap.values()
  ).sort((left, right) => {
    const supplierCompare =
      left.supplierName.localeCompare(
        right.supplierName,
        "de"
      );

    if (supplierCompare !== 0) {
      return supplierCompare;
    }

    return left.ingredientName.localeCompare(
      right.ingredientName,
      "de"
    );
  });

  const missingRecipeItems = Array.from(
    missingMap.values()
  ).sort((left, right) =>
    left.name.localeCompare(right.name, "de")
  );

  const supplierGroups =
    demandItems.reduce(
      (groups: any[], item: any) => {
        let group = groups.find(
          (entry) =>
            entry.supplierName ===
            item.supplierName
        );

        if (!group) {
          group = {
            supplierName: item.supplierName,
            items: [],
          };

          groups.push(group);
        }

        group.items.push(item);

        return groups;
      },
      []
    );

  const {
    buildProcurementComparisons,
  } = await import(
    "../lib/procurement-comparison.server"
  );

  const comparisonResult =
    await buildProcurementComparisons({
      prisma,
      tenantId: access.tenantId,
      demandItems,
    });
  const currentIngredientIds =
    comparisonResult.items
      .map(
        (item: any) =>
          item.procurementIngredientId
      )
      .filter(Boolean);

  const [
    ingredientMappings,
    catalogItems,
  ] = await Promise.all([
    currentIngredientIds.length > 0
      ? prisma.procurementIngredient.findMany({
          where: {
            tenantId: access.tenantId,
            id: {
              in: currentIngredientIds,
            },
            active: true,
          },
          include: {
            matches: {
              where: {
                active: true,
              },
              include: {
                catalogItem: {
                  include: {
                    supplier: true,
                    prices: {
                      orderBy: {
                        fetchedAt: "desc",
                      },
                      take: 1,
                    },
                  },
                },
              },
              orderBy: [
                {
                  preferred: "desc",
                },
                {
                  createdAt: "asc",
                },
              ],
            },
          },
          orderBy: {
            displayName: "asc",
          },
        })
      : [],
    prisma.supplierCatalogItem.findMany({
      where: {
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
      orderBy: [
        {
          supplier: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
      take: 750,
    }),
  ]);
  const unresolvedCount =
    missingRecipeItems.length;

  return {
    tenant: access.tenant,
    selectedDate,
    availableDates,
    orders: filteredOrders,
    demandItems: comparisonResult.items,
    supplierGroups,
    missingRecipeItems,
    unresolvedCount,
    comparisonStats: comparisonResult.stats,
    ingredientMappings,
    catalogItems,
  };
}

export default function PurchasingPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PageShell className="procurementPage">
        <PageHeader
          eyebrow="Einkauf & Lager"
          title="Einkaufsplanung"
          subtitle={
            <>
              Automatisch berechneter Bedarf aus
              bestätigten Aufträgen, operativen
              Produktzuordnungen und Rezepturen für{" "}
              {data.tenant.name}.
            </>
          }
          actions={
            <>
              <Form
                method="get"
                className="procurementDateFilter"
              >
                <label>
                  <span>Planungstag</span>

                  <select
                    name="date"
                    defaultValue={
                      data.selectedDate
                    }
                  >
                    {data.availableDates.map(
                      (date: string) => (
                        <option
                          key={date}
                          value={date}
                        >
                          {formatDateOption(date)}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <button
                  className="procurementButton procurementButton--secondary"
                  type="submit"
                >
                  Anzeigen
                </button>
              </Form>

              <button
                className="procurementButton procurementButton--secondary procurementPrintButton"
                type="button"
                onClick={() => window.print()}
              >
                Drucken
              </button>
            </>
          }
        />

        <MetricGrid>
          <MetricCard
            label="Aufträge"
            value={data.orders.length}
            description="für den ausgewählten Planungstag"
            badge="Operativ"
          />

          <MetricCard
            label="Einkaufspositionen"
            value={data.demandItems.length}
            description="aus gepflegten Rezepturen"
            badge="Bedarf"
          />

          <MetricCard
            label="Lieferanten"
            value={data.supplierGroups.length}
            description="im aktuellen Bedarf"
            badge="Gruppiert"
          />

          <MetricCard
            label="Zu prüfen"
            value={data.unresolvedCount}
            description="fehlende Zuordnung oder Rezeptur"
            badge={
              data.unresolvedCount > 0
                ? "Offen"
                : "Sauber"
            }
            attention={
              data.unresolvedCount > 0
            }
          />
        </MetricGrid>

        {data.unresolvedCount > 0 ? (
          <Notice type="warning">
            <strong>
              Einkaufsbedarf ist noch nicht
              vollständig.
            </strong>{" "}
            {data.unresolvedCount} Position(en)
            benötigen eine operative Zuordnung
            oder Rezeptur.
          </Notice>
        ) : null}

        {data.comparisonStats.unmatched > 0 ? (
          <Notice type="info">
            <strong>
              Preisvergleich vorbereitet.
            </strong>{" "}
            {data.comparisonStats.unmatched} Zutat(en)
            benötigen noch eine Zuordnung zu einem
            Lieferantenartikel. Diese werden nicht
            automatisch geraten.
          </Notice>
        ) : null}
        <div className="procurementWorkspace">
          <PageSection
            className="procurementMainSection"
            eyebrow="Bedarf"
            title="Automatische Einkaufsliste"
            description="Auftragsmenge × Rezepturmenge. Packstation, Logistik und nicht operative Positionen werden nicht als Küchenbedarf gerechnet."
            actions={
              <Link
                className="procurementButton procurementButton--secondary"
                to="/produkte"
              >
                Produkte & Rezepturen
              </Link>
            }
          >
            <div className="procurementTableWrap">
              <table className="procurementTable">
                <thead>
                  <tr>
                    <th>Zutat / Material</th>
                    <th>Menge</th>
                    <th>Einheit</th>
                    <th>Preisvorschlag</th>
                    <th>Kosten netto</th>
                    <th>Quelle</th>
                  </tr>
                </thead>

                <tbody>
                  {data.demandItems.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="procurementEmpty">
                          <span>0</span>

                          <div>
                            <strong>
                              Keine Einkaufsvorschläge
                              vorhanden
                            </strong>

                            <p>
                              Für diesen Planungstag
                              wurde noch kein Bedarf aus
                              vollständigen Rezepturen
                              berechnet.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.demandItems.map(
                      (item: any) => (
                        <tr
                          key={[
                            item.supplierName,
                            item.ingredientName,
                            item.unit,
                          ].join("-")}
                        >
                          <td>
                            <strong>
                              {item.ingredientName}
                            </strong>
                          </td>

                          <td className="procurementQuantity">
                            {formatQty(item.quantity)}
                          </td>

                          <td>{item.unit}</td>                          <td>
                            {item.bestOffer ? (
                              <div className="procurementOffer">
                                <strong>
                                  {
                                    item.bestOffer
                                      .supplierName
                                  }
                                </strong>

                                <span>
                                  {
                                    item.bestOffer
                                      .catalogItemName
                                  }
                                </span>

                                <small>
                                  {
                                    item.bestOffer
                                      .packageCount
                                  }{" "}
                                  ×{" "}
                                  {formatQty(
                                    item.bestOffer
                                      .packContent
                                  )}{" "}
                                  {
                                    item.bestOffer
                                      .baseUnit
                                  }
                                  {" · "}
                                  {
                                    item.offersCount
                                  }{" "}
                                  Angebot(e)
                                </small>
                              </div>
                            ) : (
                              <div className="procurementOffer procurementOffer--missing">
                                <strong>
                                  Noch keine Zuordnung
                                </strong>

                                <span>
                                  Lieferantenartikel
                                  zuordnen
                                </span>
                              </div>
                            )}
                          </td>

                          <td>
                            {item.bestOffer ? (
                              <div className="procurementCost">
                                <strong>
                                  {formatMoney(
                                    item.bestOffer
                                      .netTotalCents
                                  )}
                                </strong>

                                <small>
                                  Preisstand:{" "}
                                  {formatPriceAge(
                                    item.bestOffer
                                      .fetchedAt
                                  )}
                                </small>
                              </div>
                            ) : (
                              <span className="procurementNoPrice">
                                –
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="procurementSources">
                              {item.sources
                                .slice(0, 3)
                                .map(
                                  (source: any) => (
                                    <span
                                      key={[
                                        source.orderId,
                                        source.productName,
                                      ].join("-")}
                                    >
                                      {formatQty(
                                        source.productQuantity
                                      )}{" "}
                                      ×{" "}
                                      {source.productName} ·{" "}
                                      {source.orderNumber}
                                    </span>
                                  )
                                )}

                              {item.sources.length >
                              3 ? (
                                <small>
                                  +{" "}
                                  {item.sources.length -
                                    3}{" "}
                                  weitere Quellen
                                </small>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </PageSection>

          <aside className="procurementSideStack">
            <PageSection
              eyebrow="Gruppiert"
              title="Nach Lieferant"
              description="Welche Einkaufspositionen aktuell welchem Lieferanten zugeordnet sind."
              soft
            >
              <div className="procurementSupplierList">
                {data.supplierGroups.length ===
                0 ? (
                  <div className="procurementCompactEmpty">
                    Noch keine Lieferantenzuordnung
                    aus Rezepturen gefunden.
                  </div>
                ) : (
                  data.supplierGroups.map(
                    (group: any) => (
                      <article
                        key={group.supplierName}
                        className="procurementSupplierRow"
                      >
                        <div>
                          <strong>
                            {group.supplierName}
                          </strong>

                          <span>
                            {group.items.length}{" "}
                            Position(en)
                          </span>
                        </div>

                        <small>Einkauf</small>
                      </article>
                    )
                  )
                )}
              </div>
            </PageSection>

            <PageSection
              eyebrow="Berechnung"
              title="So entsteht der Bedarf"
              soft
            >
              <div className="procurementFormula">
                <strong>
                  Operative Auftragsmenge ×
                  Rezepturmenge
                </strong>

                <p>
                  Beispiel: 80 Chicken Bowls ×
                  100 g Hähnchen = 8.000 g
                  Einkaufsbedarf.
                </p>
              </div>
            </PageSection>
          </aside>
        </div>

        <PageSection
          className="procurementMappingSection"
          eyebrow="Artikelzuordnung"
          title="Zutaten mit Lieferantenartikeln verbinden"
          description="Ordne jede Zutat einem oder mehreren echten Katalogartikeln zu. Gastario vergleicht anschließend automatisch Packungsgrößen und aktuelle Preise."
          id="ingredient-mapping"
          actions={
            <Link
              className="procurementButton procurementButton--secondary"
              to="/lieferanten"
            >
              Lieferantenkataloge
            </Link>
          }
        >
          {data.ingredientMappings.length === 0 ? (
            <div className="procurementCompactEmpty">
              Für den gewählten Planungstag gibt es
              noch keine berechenbaren Zutaten.
            </div>
          ) : (
            <div className="procurementMappingList">
              {data.ingredientMappings.map(
                (ingredient: any) => (
                  <article
                    className="procurementMappingRow"
                    key={ingredient.id}
                  >
                    <div className="procurementMappingIdentity">
                      <small>Zutat</small>
                      <strong>
                        {ingredient.displayName}
                      </strong>
                      <span>
                        Basiseinheit:{" "}
                        {ingredient.baseUnit}
                      </span>
                    </div>

                    <div className="procurementMappingMatches">
                      {ingredient.matches.length === 0 ? (
                        <div className="procurementMappingEmpty">
                          Noch kein Lieferantenartikel
                          zugeordnet
                        </div>
                      ) : (
                        ingredient.matches.map(
                          (match: any) => {
                            const price =
                              match.catalogItem
                                .prices?.[0] || null;

                            return (
                              <div
                                className="procurementMappedArticle"
                                key={match.id}
                              >
                                <div>
                                  <strong>
                                    {
                                      match
                                        .catalogItem
                                        .supplier
                                        .name
                                    }
                                  </strong>

                                  <span>
                                    {
                                      match
                                        .catalogItem
                                        .name
                                    }
                                  </span>

                                  <small>
                                    {price
                                      ? `${formatMoney(
                                          price.netPriceCents
                                        )} · ${formatPriceAge(
                                          price.fetchedAt
                                        )}`
                                      : "Noch kein Preis vorhanden"}
                                  </small>
                                </div>

                                {match.preferred ? (
                                  <span className="procurementPreferredBadge">
                                    Bevorzugt
                                  </span>
                                ) : null}

                                <Form method="post">
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="remove-ingredient-match"
                                  />
                                  <input
                                    type="hidden"
                                    name="matchId"
                                    value={match.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="returnDate"
                                    value={
                                      data.selectedDate
                                    }
                                  />

                                  <button
                                    type="submit"
                                    className="procurementMappingRemove"
                                  >
                                    Entfernen
                                  </button>
                                </Form>
                              </div>
                            );
                          }
                        )
                      )}
                    </div>

                    <Form
                      method="post"
                      className="procurementMappingForm"
                    >
                      <input
                        type="hidden"
                        name="intent"
                        value="save-ingredient-match"
                      />
                      <input
                        type="hidden"
                        name="ingredientId"
                        value={ingredient.id}
                      />
                      <input
                        type="hidden"
                        name="returnDate"
                        value={data.selectedDate}
                      />

                      <label>
                        <span>
                          Lieferantenartikel
                        </span>

                        <select
                          name="catalogItemId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Artikel auswählen …
                          </option>

                          {data.catalogItems.map(
                            (catalogItem: any) => {
                              const latestPrice =
                                catalogItem
                                  .prices?.[0] ||
                                null;

                              return (
                                <option
                                  key={
                                    catalogItem.id
                                  }
                                  value={
                                    catalogItem.id
                                  }
                                >
                                  {
                                    catalogItem
                                      .supplier.name
                                  }
                                  {" · "}
                                  {catalogItem.name}
                                  {latestPrice
                                    ? ` · ${formatMoney(
                                        latestPrice
                                          .netPriceCents
                                      )}`
                                    : " · ohne Preis"}
                                </option>
                              );
                            }
                          )}
                        </select>
                      </label>

                      <label className="procurementMappingCheck">
                        <input
                          type="checkbox"
                          name="preferred"
                          value="true"
                        />
                        <span>
                          Als bevorzugten Artikel
                          markieren
                        </span>
                      </label>

                      <button
                        className="procurementButton procurementButton--primary"
                        type="submit"
                      >
                        Zuordnen
                      </button>
                    </Form>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
        {data.missingRecipeItems.length > 0 ? (
          <PageSection
            eyebrow="Prüfung"
            title="Noch nicht berechenbare Positionen"
            description="Diese Positionen werden nicht geraten. Erst nach Zuordnung und Rezeptur fließen sie in den Einkauf ein."
            actions={
              <Link
                className="procurementButton procurementButton--primary"
                to="/produkte"
              >
                Zuordnungen pflegen
              </Link>
            }
          >
            <div className="procurementIssueList">
              {data.missingRecipeItems.map(
                (item: any) => (
                  <article
                    className="procurementIssueRow"
                    key={[
                      item.name,
                      item.reason,
                    ].join("-")}
                  >
                    <div>
                      <strong>{item.name}</strong>

                      <span>
                        {formatQty(item.quantity)}{" "}
                        {item.unit} · {item.reason}
                      </span>
                    </div>

                    <small>Prüfen</small>
                  </article>
                )
              )}
            </div>
          </PageSection>
        ) : null}
      </PageShell>
    </AppLayout>
  );
}
