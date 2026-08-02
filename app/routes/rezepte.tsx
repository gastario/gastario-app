import { Link, useLoaderData } from "react-router";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-page-shell.css";
import "../styles/gastario-supply-masterdesign.css";

function formatRecipeQuantity(value: unknown) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(number);
}

function recipeIsComplete(product: any) {
  return (
    Array.isArray(product.recipeItems) &&
    product.recipeItems.length > 0 &&
    product.recipeItems.every(
      (item: any) =>
        String(item.ingredientName || "").trim() &&
        Number(item.quantityPerUnit || 0) > 0 &&
        String(item.unit || "").trim()
    )
  );
}

export function meta() {
  return [{ title: "Rezepte · Gastario" }];
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
    "RECIPES"
  );

  const products = await prisma.product.findMany({
    where: {
      tenantId: access.tenantId,
      active: true,
      operationalArea: "KITCHEN",
      procurementType: "RECIPE",
    },
    include: {
      recipeItems: {
        orderBy: {
          ingredientName: "asc",
        },
      },
    },
    orderBy: [
      { category: "asc" },
      { name: "asc" },
    ],
  });

  const url = new URL(request.url);

  const selectedProductId =
    url.searchParams.get("product") ||
    products[0]?.id ||
    null;

  const selectedProduct =
    products.find(
      (product) =>
        product.id === selectedProductId
    ) ||
    products[0] ||
    null;

  const completeProducts = products.filter(
    recipeIsComplete
  );

  const ingredientCount = products.reduce(
    (sum, product) =>
      sum + product.recipeItems.length,
    0
  );

  return {
    tenant: access.tenant,
    products,
    selectedProduct,
    stats: {
      total: products.length,
      complete: completeProducts.length,
      incomplete:
        products.length -
        completeProducts.length,
      ingredients: ingredientCount,
    },
  };
}

export default function RecipesPage() {
  /*
   * gastario-recipes-masterdesign-v1-20260802
   *
   * Keine Beispiel- oder Fantasiedaten mehr:
   * Die Ansicht verwendet echte Produkte und
   * ProductRecipeItem-Datensätze.
   */
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PageShell className="supplyPage recipesMasterPage">
        <PageHeader
          eyebrow="Einkauf & Lager"
          title="Rezepte"
          subtitle={
            <>
              Küchenprodukte mit echten Zutaten,
              Mengen, Einheiten und Lieferanten für{" "}
              {data.tenant.name}.
            </>
          }
          actions={
            <>
              <Link
                className="supplyButton supplyButton--secondary"
                to="/einkauf"
              >
                Einkaufsplanung
              </Link>

              <Link
                className="supplyButton supplyButton--primary"
                to="/produkte"
              >
                Produkte verwalten
              </Link>
            </>
          }
        />

        <MetricGrid>
          <MetricCard
            label="Rezeptprodukte"
            value={data.stats.total}
            description="aktive Küchenprodukte mit Rezepturtyp"
            badge="Produkte"
          />

          <MetricCard
            label="Vollständig"
            value={data.stats.complete}
            description="mit mindestens einer validen Zutat"
            badge="Bereit"
          />

          <MetricCard
            label="Unvollständig"
            value={data.stats.incomplete}
            description="fehlende oder ungültige Rezeptur"
            badge={
              data.stats.incomplete > 0
                ? "Prüfen"
                : "Sauber"
            }
            attention={
              data.stats.incomplete > 0
            }
          />

          <MetricCard
            label="Zutatenzeilen"
            value={data.stats.ingredients}
            description="über alle Rezeptprodukte"
            badge="Rezeptur"
          />
        </MetricGrid>

        <div className="recipesWorkspace">
          <PageSection
            className="recipesMainSection"
            eyebrow="Rezepturen"
            title="Produktübersicht"
            description="Die Übersicht zeigt nur echte Küchenprodukte mit Beschaffungsart Rezeptur."
          >
            <div className="recipesMasterTableWrap">
              <table className="recipesMasterTable">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>Kategorie</th>
                    <th>Einheit</th>
                    <th>Zutaten</th>
                    <th>Lieferanten</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {data.products.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="supplyEmpty">
                          <strong>
                            Noch keine Rezeptprodukte
                            vorhanden
                          </strong>
                          <p>
                            Ordne unter Produkte ein
                            Küchenprodukt der
                            Beschaffungsart Rezeptur zu.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.products.map(
                      (product: any) => {
                        const complete =
                          recipeIsComplete(product);

                        const suppliers = Array.from(
                          new Set(
                            product.recipeItems
                              .map(
                                (item: any) =>
                                  String(
                                    item.supplierName ||
                                      ""
                                  ).trim()
                              )
                              .filter(Boolean)
                          )
                        );

                        return (
                          <tr key={product.id}>
                            <td>
                              <strong>
                                {product.name}
                              </strong>
                            </td>

                            <td>
                              {product.category ||
                                "–"}
                            </td>

                            <td>{product.unit}</td>

                            <td>
                              {
                                product.recipeItems
                                  .length
                              }
                            </td>

                            <td>
                              {suppliers.length > 0
                                ? suppliers.join(", ")
                                : "Nicht zugeordnet"}
                            </td>

                            <td>
                              <span
                                className={[
                                  "supplyStatus",
                                  complete
                                    ? "supplyStatus--success"
                                    : "supplyStatus--warning",
                                ].join(" ")}
                              >
                                {complete
                                  ? "Vollständig"
                                  : "Prüfen"}
                              </span>
                            </td>

                            <td>
                              <Link
                                className="supplyButton supplyButton--secondary supplyButton--compact"
                                to={`/rezepte?product=${product.id}`}
                              >
                                Öffnen
                              </Link>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>
          </PageSection>

          <aside className="recipesSideStack">
            <PageSection
              eyebrow="Rezeptur"
              title={
                data.selectedProduct?.name ||
                "Kein Produkt ausgewählt"
              }
              description={
                data.selectedProduct
                  ? `${data.selectedProduct.unit} · ${
                      data.selectedProduct.category ||
                      "Ohne Kategorie"
                    }`
                  : "Wähle ein Produkt aus der Übersicht."
              }
              soft
            >
              {!data.selectedProduct ? (
                <div className="supplyEmpty">
                  Keine Rezeptur ausgewählt.
                </div>
              ) : data.selectedProduct.recipeItems
                  .length === 0 ? (
                <div className="supplyEmpty">
                  <strong>
                    Noch keine Zutaten hinterlegt
                  </strong>
                  <p>
                    Dieses Produkt kann noch keinen
                    automatischen Einkaufsbedarf
                    erzeugen.
                  </p>
                </div>
              ) : (
                <div className="recipeIngredientList">
                  {data.selectedProduct.recipeItems.map(
                    (item: any) => (
                      <article
                        className="recipeIngredientRow"
                        key={item.id}
                      >
                        <div>
                          <strong>
                            {item.ingredientName}
                          </strong>

                          <span>
                            {item.supplierName ||
                              "Ohne Lieferant"}
                          </span>
                        </div>

                        <small>
                          {formatRecipeQuantity(
                            item.quantityPerUnit
                          )}{" "}
                          {item.unit}
                        </small>
                      </article>
                    )
                  )}
                </div>
              )}
            </PageSection>

            <PageSection
              eyebrow="Automatik"
              title="Einkauf & Lager"
              soft
            >
              <div className="recipeAutomationInfo">
                <strong>
                  Rezeptur als Berechnungsgrundlage
                </strong>

                <p>
                  Gastario multipliziert die operative
                  Auftragsmenge mit jeder Zutatenmenge
                  und erstellt daraus die
                  Einkaufsplanung.
                </p>

                <Link
                  className="supplyButton supplyButton--secondary"
                  to="/einkauf"
                >
                  Bedarf ansehen
                </Link>
              </div>
            </PageSection>
          </aside>
        </div>
      </PageShell>
    </AppLayout>
  );
}
