import { Link, useLoaderData, useLocation, useNavigate } from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioBadge,
  GastarioDataList,
  GastarioDataRow,
  GastarioEmptyState,
  GastarioDetailDialog,
  GastarioStack,
  gastarioButtonClass,
} from "../components/ui";

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
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedOpen = new URLSearchParams(location.search).has("product");
  const selected = selectedOpen ? data.selectedProduct : null;

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Einkauf & Lager"
          title="Rezepte"
          subtitle={
            <>Küchenprodukte mit Zutaten, Mengen, Einheiten und Lieferanten für {data.tenant.name}.</>
          }
          actions={
            <>
              <Link to="/einkauf" className={gastarioButtonClass("secondary")}>Einkaufsplanung</Link>
              <Link to="/produkte" className={gastarioButtonClass("primary")}>Produkte verwalten</Link>
            </>
          }
        />

        <GastarioMetricGrid>
          <GastarioMetric
            label="Rezeptprodukte"
            value={data.stats.total}
            description="Aktive Küchenprodukte mit Rezeptur"
            badge="Produkte"
          />
          <GastarioMetric
            label="Vollständig"
            value={data.stats.complete}
            description="Rezepturen mit gültigen Zutaten"
            badge="Bereit"
          />
          <GastarioMetric
            label="Unvollständig"
            value={data.stats.incomplete}
            description="Fehlende oder ungültige Rezepturen"
            badge={data.stats.incomplete ? "Prüfen" : "Sauber"}
            attention={data.stats.incomplete > 0}
          />
          <GastarioMetric
            label="Zutatenzeilen"
            value={data.stats.ingredients}
            description="Über alle Rezeptprodukte"
            badge="Rezeptur"
          />
        </GastarioMetricGrid>

        <GastarioSection
          eyebrow="Rezeptübersicht"
          title="Aktuelle Rezepturen"
          description="Rezeptprodukte prüfen und ihre Zutaten im Detail öffnen."
          action={
            <GastarioBadge variant="neutral">
              {data.products.length === 1 ? "1 Rezept" : `${data.products.length} Rezepte`}
            </GastarioBadge>
          }
        >
          {data.products.length === 0 ? (
            <GastarioEmptyState title="Noch keine Rezeptprodukte vorhanden">
              <GastarioStack compact>
                <p>Ordne unter Produkte ein Küchenprodukt der Beschaffungsart Rezeptur zu.</p>
                <div>
                  <Link to="/produkte" className={gastarioButtonClass("secondary")}>
                    Produkte verwalten
                  </Link>
                </div>
              </GastarioStack>
            </GastarioEmptyState>
          ) : (
            <GastarioDataList>
              {data.products.map((product: any) => {
                const complete = recipeIsComplete(product);
                const suppliers = Array.from(new Set(
                  product.recipeItems
                    .map((item: any) => String(item.supplierName || "").trim())
                    .filter(Boolean)
                ));
                return (
                  <GastarioDataRow
                    key={product.id}
                    onClick={() => navigate(`/rezepte?product=${encodeURIComponent(product.id)}`)}
                  >
                    <div className="g-ui-data-row-main">
                      <span className="g-ui-data-row-description">{product.category || "Ohne Kategorie"}</span>
                      <strong className="g-ui-data-row-title">{product.name}</strong>
                      <span className="g-ui-data-row-description">
                        {product.unit} · {product.recipeItems.length} Zutaten
                        {" · "}{suppliers.length ? suppliers.join(", ") : "Kein Lieferant zugeordnet"}
                      </span>
                    </div>
                    <div className="g-ui-data-row-meta">
                      <GastarioBadge variant={complete ? "success" : "warning"}>
                        {complete ? "Vollständig" : "Prüfen"}
                      </GastarioBadge>
                    </div>
                    <div className="g-ui-data-row-actions">
                      <Link
                        to={`/rezepte?product=${encodeURIComponent(product.id)}`}
                        onClick={(event) => event.stopPropagation()}
                        className={gastarioButtonClass("secondary")}
                      >
                        Öffnen
                      </Link>
                    </div>
                  </GastarioDataRow>
                );
              })}
            </GastarioDataList>
          )}
        </GastarioSection>

        <GastarioDetailDialog
          open={Boolean(selected)}
          title={selected?.name || "Rezeptur"}
          description={selected
            ? `${selected.unit} · ${selected.category || "Ohne Kategorie"}`
            : "Rezepturdetails"}
          onClose={() => navigate("/rezepte")}
          footer={
            <>
              <Link to="/einkauf" className={gastarioButtonClass("secondary")}>
                Einkaufsbedarf ansehen
              </Link>
              <Link to="/rezepte" className={gastarioButtonClass("secondary")}>
                Schließen
              </Link>
            </>
          }
        >
          {!selected ? null : selected.recipeItems.length === 0 ? (
            <GastarioEmptyState title="Noch keine Zutaten hinterlegt">
              Dieses Rezeptprodukt kann noch keinen automatischen Einkaufsbedarf erzeugen.
              Die Rezeptur wird über die Produktverwaltung gepflegt.
            </GastarioEmptyState>
          ) : (
            <GastarioStack>
              <GastarioSection
                eyebrow="Rezeptur"
                title="Zutaten und Mengen"
                description="Menge je Produkteinheit, inklusive hinterlegter Lieferanten."
              >
                <GastarioDataList>
                  {selected.recipeItems.map((item: any) => (
                    <GastarioDataRow key={item.id}>
                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">{item.ingredientName}</strong>
                        <span className="g-ui-data-row-description">
                          {item.supplierName || "Ohne Lieferant"}
                        </span>
                      </div>
                      <div className="g-ui-data-row-meta">
                        <strong>{formatRecipeQuantity(item.quantityPerUnit)} {item.unit}</strong>
                      </div>
                    </GastarioDataRow>
                  ))}
                </GastarioDataList>
              </GastarioSection>
              <GastarioSection
                eyebrow="Einkauf"
                title="Automatische Bedarfsberechnung"
                description="Gastario multipliziert die operative Auftragsmenge mit jeder Zutatenmenge für die Einkaufsplanung."
              >
                <Link to="/einkauf" className={gastarioButtonClass("secondary")}>
                  Bedarf ansehen
                </Link>
              </GastarioSection>
            </GastarioStack>
          )}
        </GastarioDetailDialog>
      </GastarioPage>
    </AppLayout>
  );
}
