import { Form, Link, redirect, useActionData, useLoaderData, useLocation, useNavigate, useNavigation } from "react-router";
import { useState } from "react";

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
  GastarioButton,
  GastarioFormGrid,
  GastarioField,
  GastarioInput,
  GastarioSelect,
  GastarioToolbar,
  GastarioNotice,
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

  const availableProducts = await prisma.product.findMany({
    where: { tenantId: access.tenantId, active: true, NOT: { operationalArea: "KITCHEN", procurementType: "RECIPE" } },
    select: { id: true, name: true, category: true, unit: true, priceCents: true, active: true },
    orderBy: { name: "asc" },
    take: 500,
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

  const activeProducts = products.filter(product => product.active);
  const completeProducts = activeProducts.filter(recipeIsComplete);

  const ingredientCount = products.reduce(
    (sum, product) =>
      sum + product.recipeItems.length,
    0
  );

  return {
    tenant: access.tenant,
    products,
    availableProducts,
    selectedProduct,
    stats: {
      total: activeProducts.length,
      archived: products.length - activeProducts.length,
      complete: completeProducts.length,
      incomplete:
        activeProducts.length -
        completeProducts.length,
      ingredients: ingredientCount,
    },
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");
  const access = await requireTenantFeature(request, "RECIPES");
  const data = await request.formData();
  const intent = String(data.get("intent") || "");
  if (intent === "archiveRecipe" || intent === "restoreRecipe") {
    const productId = String(data.get("productId") || "");
    const changed = await prisma.product.updateMany({
      where: { id: productId, tenantId: access.tenantId, operationalArea: "KITCHEN", procurementType: "RECIPE" },
      data: { active: intent === "restoreRecipe" },
    });
    if (!changed.count) return { error: "Rezept nicht gefunden." };
    return redirect("/rezepte?" + (intent === "restoreRecipe" ? "restored=1" : "archived=1"));
  }
  if (intent !== "saveRecipe") return { error: "Unbekannte Aktion." };

  const productId = String(data.get("productId") || "").trim();
  const existingProductId = String(data.get("existingProductId") || "").trim();
  if (productId && existingProductId) return { error: "Bitte entweder ein Rezept bearbeiten oder ein bestehendes Produkt auswählen." };
  const name = String(data.get("name") || "").trim();
  const category = String(data.get("category") || "").trim();
  const unit = String(data.get("unit") || "Portion").trim();
  const rawPrice = String(data.get("priceEuro") || "0").trim().replace(",", ".");
  const price = Number(rawPrice);
  if (!name || name.length > 180) return { error: "Bitte einen gültigen Rezeptnamen eingeben." };
  if (!unit || unit.length > 40) return { error: "Bitte eine Einheit eingeben." };
  if (!Number.isFinite(price) || price < 0 || price > 100000) return { error: "Ungültiger Verkaufspreis." };

  const names = data.getAll("ingredientName").map(x => String(x).trim());
  const amounts = data.getAll("quantityPerUnit").map(x => String(x).replace(",", ".").trim());
  const units = data.getAll("ingredientUnit").map(x => String(x).trim());
  const suppliers = data.getAll("supplierName").map(x => String(x).trim());
  if (names.length > 100 || amounts.length !== names.length || units.length !== names.length || suppliers.length !== names.length) {
    return { error: "Ungültige Anzahl von Zutaten." };
  }
  const ingredients: Array<{ ingredientName: string; quantityPerUnit: number; unit: string; supplierName: string | null }> = [];
  for (let i = 0; i < names.length; i++) {
    if (!names[i] && !amounts[i] && !suppliers[i]) continue;
    const quantity = Number(amounts[i]);
    if (!names[i] || names[i].length > 180 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || !units[i] || units[i].length > 30) {
      return { error: `Bitte Zutat ${i + 1} mit Name, gültiger Menge und Einheit ausfüllen.` };
    }
    ingredients.push({ ingredientName: names[i], quantityPerUnit: quantity, unit: units[i], supplierName: suppliers[i]?.slice(0, 150) || null });
  }
  if (ingredients.length === 0) return { error: "Bitte mindestens eine Zutat eintragen." };

  const existing = productId ? await prisma.product.findFirst({
    where: { id: productId, tenantId: access.tenantId, operationalArea: "KITCHEN", procurementType: "RECIPE" },
    select: { id: true },
  }) : null;
  if (productId && !existing) return { error: "Rezeptprodukt nicht gefunden." };
  const baseProduct = existingProductId ? await prisma.product.findFirst({
    where: { id: existingProductId, tenantId: access.tenantId, active: true },
    select: { id: true, operationalArea: true, procurementType: true },
  }) : null;
  if (existingProductId && !baseProduct) return { error: "Ausgewähltes Produkt nicht gefunden." };
  if (baseProduct?.operationalArea === "KITCHEN" && baseProduct.procurementType === "RECIPE") {
    return { error: "Für dieses Produkt existiert bereits eine Rezeptur. Bitte die vorhandene Rezeptur bearbeiten." };
  }

  const savedId = await prisma.$transaction(async (tx) => {
    const product = existing || baseProduct
      ? await tx.product.update({
          where: { id: (existing || baseProduct)!.id },
          data: { name, category: category || null, unit, priceCents: Math.round(price * 100), operationalArea: "KITCHEN", procurementType: "RECIPE" },
        })
      : await tx.product.create({
          data: { tenantId: access.tenantId, name, category: category || null, unit, priceCents: Math.round(price * 100), taxRate: 7, active: true, operationalArea: "KITCHEN", procurementType: "RECIPE" },
        });
    if (existing || baseProduct) await tx.productRecipeItem.deleteMany({ where: { tenantId: access.tenantId, productId: product.id } });
    await tx.productRecipeItem.createMany({
      data: ingredients.map(x => ({ ...x, tenantId: access.tenantId, productId: product.id })),
    });
    return product.id;
  });
  return redirect("/rezepte?product=" + encodeURIComponent(savedId) + "&saved=1");
}

type RecipeRow = { key: number; ingredientName: string; quantityPerUnit: string; unit: string; supplierName: string };
function RecipeEditor({ product, availableProducts, error, onClose }: {
  product: any | null;
  availableProducts: Array<{ id: string; name: string; category: string | null; unit: string; priceCents: number }>;
  error?: string;
  onClose: () => void;
}) {
  const [existingProductId, setExistingProductId] = useState("");
  const baseProduct = availableProducts.find(item => item.id === existingProductId);
  const current = product || baseProduct;
  const [rows, setRows] = useState<RecipeRow[]>(() => product?.recipeItems?.length
    ? product.recipeItems.map((item: any, index: number) => ({
        key: index, ingredientName: item.ingredientName || "", quantityPerUnit: String(item.quantityPerUnit || ""),
        unit: item.unit || "g", supplierName: item.supplierName || "",
      }))
    : [{ key: 0, ingredientName: "", quantityPerUnit: "", unit: "g", supplierName: "" }]);
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const update = (key: number, field: keyof Omit<RecipeRow, "key">, value: string) =>
    setRows(previous => previous.map(row => row.key === key ? { ...row, [field]: value } : row));
  return (
    <GastarioDetailDialog open title={product ? "Rezept bearbeiten" : "Neues Rezept anlegen"}
      description="Produkt, Portionsgröße und Zutaten für die Einkaufsplanung hinterlegen."
      onClose={onClose}
      footer={
        <>
          <GastarioButton variant="secondary" onClick={onClose}>Abbrechen</GastarioButton>
          <GastarioButton type="submit" form="gastario-recipe-form" variant="primary" disabled={saving}>
            {saving ? "Speichert …" : "Rezept speichern"}
          </GastarioButton>
        </>
      }
    >
      <Form method="post" id="gastario-recipe-form">
        <input type="hidden" name="intent" value="saveRecipe" />
        <input type="hidden" name="productId" value={product?.id || ""} />
        <input type="hidden" name="existingProductId" value={existingProductId} />
        <GastarioStack>
          {error ? <GastarioNotice type="danger">{error}</GastarioNotice> : null}
          {!product ? <GastarioSection eyebrow="Produktzuordnung" title="Vorhandenes Produkt verwenden"
            description="Optional ein Produkt aus dem Sortiment auswählen, statt ein Duplikat anzulegen.">
            <GastarioField label="Produkt auswählen">
              <GastarioSelect value={existingProductId} onChange={e => setExistingProductId(e.currentTarget.value)}>
                <option value="">Neues Produkt für dieses Rezept erstellen</option>
                {availableProducts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </GastarioSelect>
            </GastarioField>
          </GastarioSection> : null}
          <GastarioSection eyebrow="Stammdaten" title="Rezeptprodukt"
            description="Die Zutatenmengen beziehen sich auf genau eine Einheit des Rezeptprodukts.">
            <GastarioFormGrid columns={2} key={current?.id || "new"}>
              <GastarioField label="Rezeptname" required>
                <GastarioInput name="name" defaultValue={current?.name || ""} placeholder="z. B. Chicken Bowl" required />
              </GastarioField>
              <GastarioField label="Kategorie">
                <GastarioInput name="category" defaultValue={current?.category || ""} placeholder="z. B. Bowls" />
              </GastarioField>
              <GastarioField label="Produkteinheit" required>
                <GastarioSelect name="unit" defaultValue={current?.unit || "Portion"}>
                  <option value="Portion">Portion</option><option value="Stück">Stück</option>
                  <option value="kg">kg</option><option value="Liter">Liter</option>
                </GastarioSelect>
              </GastarioField>
              <GastarioField label="Verkaufspreis netto (EUR)">
                <GastarioInput name="priceEuro" defaultValue={current ? (current.priceCents / 100).toFixed(2).replace(".", ",") : "0,00"} />
              </GastarioField>
            </GastarioFormGrid>
          </GastarioSection>
          <GastarioSection eyebrow="Rezeptur" title="Zutaten pro Produkteinheit"
            description="Beispiel: Eine Portion Chicken Bowl enthält 0,15 kg Reis und 0,18 kg Hähnchen.">
            <GastarioStack>
              {rows.map((row, index) => (
                <div key={row.key}>
                  <GastarioFormGrid columns={4}>
                    <GastarioField label={`Zutat ${index + 1}`} required>
                      <GastarioInput name="ingredientName" value={row.ingredientName} onChange={e => update(row.key, "ingredientName", e.currentTarget.value)} placeholder="z. B. Reis" required />
                    </GastarioField>
                    <GastarioField label="Menge" required>
                      <GastarioInput name="quantityPerUnit" value={row.quantityPerUnit} onChange={e => update(row.key, "quantityPerUnit", e.currentTarget.value)} placeholder="0,15" required />
                    </GastarioField>
                    <GastarioField label="Einheit" required>
                      <GastarioSelect name="ingredientUnit" value={row.unit} onChange={e => update(row.key, "unit", e.currentTarget.value)}>
                        <option value="g">g</option><option value="kg">kg</option>
                        <option value="ml">ml</option><option value="l">l</option>
                        <option value="Stück">Stück</option><option value="Packung">Packung</option>
                      </GastarioSelect>
                    </GastarioField>
                    <GastarioField label="Lieferant">
                      <GastarioInput name="supplierName" value={row.supplierName} onChange={e => update(row.key, "supplierName", e.currentTarget.value)} placeholder="Optional" />
                    </GastarioField>
                  </GastarioFormGrid>
                  {rows.length > 1 ? (
                    <GastarioToolbar>
                      <GastarioButton variant="secondary" onClick={() => setRows(previous => previous.filter(x => x.key !== row.key))}>Zutat entfernen</GastarioButton>
                    </GastarioToolbar>
                  ) : null}
                </div>
              ))}
              <GastarioToolbar align="start">
                <GastarioButton variant="secondary" disabled={rows.length >= 100}
                  onClick={() => setRows(previous => [...previous, { key: Math.max(...previous.map(x => x.key), 0) + 1, ingredientName: "", quantityPerUnit: "", unit: "g", supplierName: "" }])}>
                  + Zutat hinzufügen
                </GastarioButton>
              </GastarioToolbar>
            </GastarioStack>
          </GastarioSection>
        </GastarioStack>
      </Form>
    </GastarioDetailDialog>
  );
}

export default function RecipesPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const selectedOpen = params.has("product") && !params.has("edit");
  const selected = selectedOpen ? data.selectedProduct : null;
  const editing = params.get("edit") ? data.products.find((p: any) => p.id === params.get("edit")) : null;
  const creating = params.has("new");
  const actionData = useActionData<typeof action>();

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
              <Link to="/rezepte?new=1" className={gastarioButtonClass("primary")}>+ Neues Rezept</Link>
            </>
          }
        />

        {params.has("saved") ? <GastarioNotice type="success">Rezept erfolgreich gespeichert.</GastarioNotice> : null}
        {params.has("archived") ? <GastarioNotice type="success">Rezept archiviert. Es kann jederzeit wiederhergestellt werden.</GastarioNotice> : null}
        {params.has("restored") ? <GastarioNotice type="success">Rezept wiederhergestellt.</GastarioNotice> : null}
        {actionData && "error" in actionData ? <GastarioNotice type="danger">{actionData.error}</GastarioNotice> : null}

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
                <p>Erstelle deine erste Rezeptur mit Produkten, Mengen und Lieferanten direkt hier.</p>
                <div>
                  <Link to="/rezepte?new=1" className={gastarioButtonClass("primary")}>
                    + Neues Rezept
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
                      <GastarioBadge variant={!product.active ? "neutral" : complete ? "success" : "warning"}>
                        {!product.active ? "Archiviert" : complete ? "Vollständig" : "Prüfen"}
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
                      <Link to={`/rezepte?edit=${encodeURIComponent(product.id)}`}
                        onClick={event => event.stopPropagation()} className={gastarioButtonClass("secondary")}>
                        Bearbeiten
                      </Link>
                      <Form method="post" onClick={event => event.stopPropagation()}>
                        <input type="hidden" name="productId" value={product.id} />
                        <button className={gastarioButtonClass("secondary")} name="intent" type="submit"
                          value={product.active ? "archiveRecipe" : "restoreRecipe"}
                          onClick={event => {
                            event.stopPropagation();
                            if (product.active && !window.confirm(`Rezept „${product.name}“ archivieren? Produkt und Zutaten bleiben gespeichert.`)) event.preventDefault();
                          }}>
                          {product.active ? "Archivieren" : "Wiederherstellen"}
                        </button>
                      </Form>
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
              {selected ? <Link to={`/rezepte?edit=${encodeURIComponent(selected.id)}`} className={gastarioButtonClass("primary")}>Rezept bearbeiten</Link> : null}
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
              Über „Rezept bearbeiten“ kannst du die Zutaten ergänzen.
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
        {creating || editing ? <RecipeEditor key={editing?.id || "new"} product={editing || null}
          availableProducts={data.availableProducts}
          error={actionData && "error" in actionData ? actionData.error : undefined}
          onClose={() => navigate("/rezepte")} /> : null}
      </GastarioPage>
    </AppLayout>
  );
}
