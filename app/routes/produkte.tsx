import { useMemo, useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import productsStyles from "../styles/produkte.css?url";

function euroToCents(value: FormDataEntryValue | null) {
  const raw = String(value || "0").replace(",", ".").trim();
  const number = Number(raw);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function toNumber(value: FormDataEntryValue | null, fallback = 0) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value || "").replace(",", ".").trim();

  if (!raw) {
    return null;
  }

  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function optionalEuroToCents(value: FormDataEntryValue | null) {
  const number = toOptionalNumber(value);

  if (number === null) {
    return null;
  }

  return Math.round(number * 100);
}

export function links() {
  return [
    {
      rel: "stylesheet",
      href: productsStyles,
    },
  ];
}

export function meta() {
  return [{ title: "Produkte · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId || !access.tenant) {
    return {
      tenant: null,
      setupError: access.setupError || "Kein Mandant gefunden.",
      products: [],
      stats: {
        total: 0,
        active: 0,
        categories: 0,
        recipeItems: 0,
      },
    };
  }

  try {
    /*
     * gastario-product-loader-recipe-fallback-20260715
     * Produkte auch dann anzeigen, wenn die Rezeptur-Relation
     * wegen eines Datenbank- oder Schemafehlers nicht geladen
     * werden kann.
     */
    let products: any[] = [];

    try {
      products = await prisma.product.findMany({
        where: {
          tenantId: access.tenantId,
        },
        include: {
          recipeItems: {
            orderBy: {
              ingredientName: "asc",
            },
          },
        },
        orderBy: [
          { active: "desc" },
          { name: "asc" },
        ],
      });
    } catch (recipeError) {
      console.error(
        "Produkte wurden ohne Rezepturen geladen:",
        recipeError
      );

      const productsWithoutRecipes =
        await prisma.product.findMany({
          where: {
            tenantId: access.tenantId,
          },
          orderBy: [
            { active: "desc" },
            { name: "asc" },
          ],
        });

      products = productsWithoutRecipes.map(
        (product) => ({
          ...product,
          recipeItems: [],
        })
      );
    }

    const categories = Array.from(
      new Set(products.map((product) => product.category).filter(Boolean))
    );

    return {
      tenant: access.tenant,
      setupError: null,
      products,
      stats: {
        total: products.length,
        active: products.filter((product) => product.active).length,
        categories: categories.length,
        recipeItems: products.reduce((sum, product: any) => sum + product.recipeItems.length, 0),
      },
    };
  } catch (error) {
    console.error("Produkte loader failed:", error);

    return {
      tenant: access.tenant,
      setupError: "Produkte konnten nicht geladen werden. Bitte Datenbank/Schema pruefen.",
      products: [],
      stats: {
        total: 0,
        active: 0,
        categories: 0,
        recipeItems: 0,
      },
    };
  }
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId) {
    return { error: access.setupError || "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createProduct") {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      return { error: "Produktname fehlt." };
    }

    await prisma.product.create({
      data: {
        tenantId: access.tenantId,
        name,
        category: String(formData.get("category") || "").trim() || null,
        unit: String(formData.get("unit") || "Portion").trim() || "Portion",
        priceCents: euroToCents(formData.get("priceEuro")),
        taxRate: toNumber(formData.get("taxRate"), 7),
        notes: String(formData.get("notes") || "").trim() || null,
        active: true,
      } as any,
    });

    return { success: "Produkt wurde angelegt." };
  }

  const productId = String(formData.get("productId") || "");

  if (!productId) {
    return { error: "Produkt fehlt." };
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      tenantId: access.tenantId,
    },
  });

  if (!product) {
    return { error: "Produkt nicht gefunden." };
  }

  if (intent === "updateProduct") {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      return { error: "Produktname fehlt." };
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        name,
        category: String(formData.get("category") || "").trim() || null,
        unit: String(formData.get("unit") || "Portion").trim() || "Portion",
        priceCents: euroToCents(formData.get("priceEuro")),
        taxRate: toNumber(formData.get("taxRate"), 7),
        notes: String(formData.get("notes") || "").trim() || null,
      } as any,
    });

    return { success: "Produkt wurde gespeichert." };
  }

  if (intent === "updateProcurement") {
    const allowedTypes = new Set([
      "RECIPE",
      "READY_MADE",
      "BAKE_OFF",
      "THAW",
      "REHEAT",
      "EXTERNAL",
    ]);

    const requestedType = String(
      formData.get("procurementType") || "RECIPE"
    );

    const procurementType = allowedTypes.has(requestedType)
      ? requestedType
      : "RECIPE";

    const supplierName = String(
      formData.get("supplierName") || ""
    ).trim();

    const supplierArticleName = String(
      formData.get("supplierArticleName") || ""
    ).trim();

    const supplierArticleNumber = String(
      formData.get("supplierArticleNumber") || ""
    ).trim();

    const purchaseUnit = String(
      formData.get("purchaseUnit") || ""
    ).trim();

    const packageUnit = String(
      formData.get("packageUnit") || ""
    ).trim();

    const preparationNotes = String(
      formData.get("preparationNotes") || ""
    ).trim();

    const purchaseQuantityPerUnit = toOptionalNumber(
      formData.get("purchaseQuantityPerUnit")
    );

    const packageQuantity = toOptionalNumber(
      formData.get("packageQuantity")
    );

    const purchasePriceCents = optionalEuroToCents(
      formData.get("purchasePriceEuro")
    );

    await prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        procurementType,
        supplierName: supplierName || null,
        supplierArticleName: supplierArticleName || null,
        supplierArticleNumber:
          supplierArticleNumber || null,
        purchaseUnit: purchaseUnit || null,
        purchaseQuantityPerUnit,
        packageUnit: packageUnit || null,
        packageQuantity,
        purchasePriceCents,
        preparationNotes: preparationNotes || null,
      } as any,
    });

    return {
      success:
        procurementType === "RECIPE"
          ? "Beschaffung wurde auf Eigenproduktion gestellt."
          : "Beschaffungsdaten wurden gespeichert.",
    };
  }

  if (intent === "toggleActive") {
    const active = String(formData.get("active") || "") === "true";

    await prisma.product.update({
      where: { id: product.id },
      data: { active } as any,
    });

    return { success: active ? "Produkt wurde aktiviert." : "Produkt wurde deaktiviert." };
  }

  if (intent === "deleteProduct") {
    await prisma.productRecipeItem.deleteMany({
      where: {
        tenantId: access.tenantId,
        productId: product.id,
      },
    });

    await prisma.product.delete({
      where: { id: product.id },
    });

    return { success: "Produkt wurde geloescht." };
  }

  if (intent === "addRecipeItem") {
    const ingredientName = String(formData.get("ingredientName") || "").trim();
    const quantityPerUnit = toNumber(formData.get("quantityPerUnit"));
    const unit = String(formData.get("ingredientUnit") || "g").trim() || "g";
    const supplierName = String(formData.get("supplierName") || "").trim();
    const notes = String(formData.get("recipeNotes") || "").trim();

    if (!ingredientName) {
      return { error: "Zutat fehlt." };
    }

    if (quantityPerUnit <= 0) {
      return { error: "Menge pro Einheit muss groesser als 0 sein." };
    }

    await prisma.productRecipeItem.create({
      data: {
        tenantId: access.tenantId,
        productId: product.id,
        ingredientName,
        quantityPerUnit,
        unit,
        supplierName: supplierName || null,
        notes: notes || null,
      },
    });

    return { success: "Rezepturposition wurde hinzugefuegt." };
  }

  if (intent === "deleteRecipeItem") {
    const recipeItemId = String(formData.get("recipeItemId") || "");

    if (!recipeItemId) {
      return { error: "Rezepturposition fehlt." };
    }

    await prisma.productRecipeItem.deleteMany({
      where: {
        id: recipeItemId,
        tenantId: access.tenantId,
        productId: product.id,
      },
    });

    return { success: "Rezepturposition wurde geloescht." };
  }

  return { error: "Unbekannte Aktion." };
}

﻿export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recipeFilter, setRecipeFilter] = useState("all");

  const products = Array.isArray(data.products) ? data.products : [];

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product: any) => String(product.category || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "de"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("de");

    return products.filter((product: any) => {
      const recipeItems = Array.isArray(product.recipeItems)
        ? product.recipeItems
        : [];

      const matchesSearch =
        !normalizedSearch ||
        [
          product.name,
          product.category,
          product.unit,
          product.notes,
          ...recipeItems.map((item: any) => item.ingredientName),
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLocaleLowerCase("de")
              .includes(normalizedSearch)
          );

      const matchesCategory =
        categoryFilter === "all" ||
        String(product.category || "") === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.active) ||
        (statusFilter === "inactive" && !product.active);

      const matchesRecipe =
        recipeFilter === "all" ||
        (recipeFilter === "complete" && recipeItems.length > 0) ||
        (recipeFilter === "missing" && recipeItems.length === 0);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesRecipe
      );
    });
  }, [
    products,
    searchTerm,
    categoryFilter,
    statusFilter,
    recipeFilter,
  ]);

  const selectedProduct = products.find(
    (product: any) => product.id === selectedProductId
  );

  const selectedRecipeItems =
    selectedProduct &&
    Array.isArray(selectedProduct.recipeItems)
      ? selectedProduct.recipeItems
      : [];

  return (
    <AppLayout>
      <div className="productsPage">
        <header className="productsTopbar">
          <div>
            <p className="eyebrow">Verkauf</p>
            <h1>Produkte</h1>
            <span className="pageSubline">
              {data.tenant?.name || "Kein Mandant"} · Sortiment,
              Verkaufspreise und Rezepturen zentral verwalten.
            </span>
          </div>

          <div className="productsTopActions">
            <a className="productsSecondaryButton" href="/einkauf">
              Einkauf öffnen
            </a>

            <button
              className="productsPrimaryButton"
              type="button"
              onClick={() => {
                setSelectedProductId(null);
                setShowCreateForm((current) => !current);
              }}
            >
              {showCreateForm ? "Formular schließen" : "Neues Produkt"}
            </button>
          </div>
        </header>

        {data.setupError ? (
          <div className="productsNotice productsNoticeWarning">
            {data.setupError}
          </div>
        ) : null}

        {actionData?.success ? (
          <div className="productsNotice productsNoticeSuccess">
            {actionData.success}
          </div>
        ) : null}

        {actionData?.error ? (
          <div className="productsNotice productsNoticeError">
            {actionData.error}
          </div>
        ) : null}

        <section className="productsMetrics">
          <article className="productsMetricCard">
            <div>
              <p>Produkte</p>
              <strong>{data.stats.total}</strong>
              <span>{data.stats.active} aktiv</span>
            </div>
            <small>Sortiment</small>
          </article>

          <article className="productsMetricCard">
            <div>
              <p>Kategorien</p>
              <strong>{data.stats.categories}</strong>
              <span>Produktgruppen</span>
            </div>
            <small>Übersicht</small>
          </article>

          <article className="productsMetricCard">
            <div>
              <p>Rezepturpositionen</p>
              <strong>{data.stats.recipeItems}</strong>
              <span>Zutaten und Material</span>
            </div>
            <small>Einkauf</small>
          </article>

          <article className="productsMetricCard productsMetricAttention">
            <div>
              <p>Ohne Rezeptur</p>
              <strong>
                {
                  products.filter(
                    (product: any) =>
                      !Array.isArray(product.recipeItems) ||
                      product.recipeItems.length === 0
                  ).length
                }
              </strong>
              <span>Noch zu vervollständigen</span>
            </div>
            <small>Prüfen</small>
          </article>
        </section>

        {showCreateForm ? (
          <section className="productsCreatePanel">
            <div className="productsSectionHeader">
              <div>
                <p className="eyebrow">Neues Produkt</p>
                <h2>Produkt manuell anlegen</h2>
                <span>
                  Produkte können zusätzlich automatisch aus übernommenen
                  Aufträgen entstehen.
                </span>
              </div>
            </div>

            <Form method="post" className="productsCreateForm">
              <input
                type="hidden"
                name="intent"
                value="createProduct"
              />

              <label className="productsField productsFieldWide">
                <span>Produktname</span>
                <input
                  name="name"
                  placeholder="Zum Beispiel Chicken Bowl"
                  required
                />
              </label>

              <label className="productsField">
                <span>Kategorie</span>
                <input
                  name="category"
                  placeholder="Zum Beispiel Bowls"
                />
              </label>

              <label className="productsField">
                <span>Einheit</span>
                <input
                  name="unit"
                  defaultValue="Portion"
                  placeholder="Portion"
                />
              </label>

              <label className="productsField">
                <span>Verkaufspreis</span>
                <div className="productsInputSuffix">
                  <input
                    name="priceEuro"
                    inputMode="decimal"
                    placeholder="10,90"
                  />
                  <small>EUR</small>
                </div>
              </label>

              <label className="productsField">
                <span>Mehrwertsteuer</span>
                <div className="productsInputSuffix">
                  <input
                    name="taxRate"
                    type="number"
                    step="0.01"
                    defaultValue="7"
                  />
                  <small>%</small>
                </div>
              </label>

              <label className="productsField productsFieldFull">
                <span>Produktionsnotiz</span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Hinweise für Produktion, Portionierung oder Ausgabe"
                />
              </label>

              <div className="productsCreateActions">
                <button
                  className="productsSecondaryButton"
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                >
                  Abbrechen
                </button>

                <button
                  className="productsPrimaryButton"
                  type="submit"
                >
                  Produkt anlegen
                </button>
              </div>
            </Form>
          </section>
        ) : null}

        {selectedProduct ? (
          <section className="productDetailPanel">
            <div className="productDetailHeader">
              <button
                className="productBackButton"
                type="button"
                onClick={() => setSelectedProductId(null)}
              >
                <span aria-hidden="true">←</span>
                Zurück zur Produktübersicht
              </button>

              <div className="productDetailHeading">
                <div className="productDetailInitial">
                  {String(selectedProduct.name || "P")
                    .trim()
                    .slice(0, 1)
                    .toUpperCase()}
                </div>

                <div>
                  <div className="productDetailTitleLine">
                    <h2>{selectedProduct.name}</h2>

                    <span
                      className={
                        selectedProduct.active
                          ? "productStatusBadge productStatusActive"
                          : "productStatusBadge productStatusInactive"
                      }
                    >
                      {selectedProduct.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>

                  <p>
                    {selectedProduct.category || "Ohne Kategorie"} ·{" "}
                    {selectedProduct.unit || "Portion"} · MwSt.{" "}
                    {selectedProduct.taxRate ?? 7} %
                  </p>
                </div>
              </div>

              <div className="productDetailPrice">
                <small>Verkaufspreis</small>
                <strong>
                  {centsToEuro(selectedProduct.priceCents)}
                </strong>
                <span>
                  je {selectedProduct.unit || "Portion"}
                </span>
              </div>
            </div>

            <section className="productProcurementPanel">
              <div className="productDetailSectionHeader">
                <div>
                  <p className="eyebrow">Herstellung und Beschaffung</p>
                  <h3>Wie wird dieses Produkt bereitgestellt?</h3>
                  <span>
                    Lege fest, ob das Produkt selbst hergestellt,
                    fertig eingekauft, aufgebacken oder nur vorbereitet wird.
                  </span>
                </div>

                <div className="productProcurementBadge">
                  {selectedProduct.procurementType === "READY_MADE"
                    ? "Fertigprodukt"
                    : selectedProduct.procurementType === "BAKE_OFF"
                      ? "Aufbacken"
                      : selectedProduct.procurementType === "THAW"
                        ? "Auftauen"
                        : selectedProduct.procurementType === "REHEAT"
                          ? "Erwärmen"
                          : selectedProduct.procurementType === "EXTERNAL"
                            ? "Extern"
                            : "Eigenproduktion"}
                </div>
              </div>

              <Form method="post" className="productProcurementForm">
                <input
                  type="hidden"
                  name="intent"
                  value="updateProcurement"
                />
                <input
                  type="hidden"
                  name="productId"
                  value={selectedProduct.id}
                />

                <label className="productsField productsFieldFull">
                  <span>Beschaffungsart</span>
                  <select
                    name="procurementType"
                    defaultValue={
                      selectedProduct.procurementType || "RECIPE"
                    }
                  >
                    <option value="RECIPE">
                      Eigenproduktion mit Rezeptur
                    </option>
                    <option value="READY_MADE">
                      Fertig einkaufen
                    </option>
                    <option value="BAKE_OFF">
                      Fertig einkaufen und aufbacken
                    </option>
                    <option value="THAW">
                      Fertig einkaufen und auftauen
                    </option>
                    <option value="REHEAT">
                      Fertig einkaufen und erwärmen
                    </option>
                    <option value="EXTERNAL">
                      Extern produzieren lassen
                    </option>
                  </select>
                </label>

                <div className="productProcurementHint productsFieldFull">
                  <strong>Eigenproduktion</strong>
                  <span>
                    Nutzt die hinterlegte Rezeptur. Bei allen anderen
                    Beschaffungsarten werden Lieferant, Einkaufsartikel
                    und Gebinde für die Einkaufsliste verwendet.
                  </span>
                </div>

                <label className="productsField">
                  <span>Lieferant</span>
                  <input
                    name="supplierName"
                    defaultValue={
                      selectedProduct.supplierName || ""
                    }
                    placeholder="Zum Beispiel Transgourmet"
                  />
                </label>

                <label className="productsField">
                  <span>Einkaufsartikel</span>
                  <input
                    name="supplierArticleName"
                    defaultValue={
                      selectedProduct.supplierArticleName || ""
                    }
                    placeholder="Bezeichnung beim Lieferanten"
                  />
                </label>

                <label className="productsField">
                  <span>Artikelnummer</span>
                  <input
                    name="supplierArticleNumber"
                    defaultValue={
                      selectedProduct.supplierArticleNumber || ""
                    }
                    placeholder="Optional"
                  />
                </label>

                <label className="productsField">
                  <span>Einkaufseinheit</span>
                  <input
                    name="purchaseUnit"
                    defaultValue={
                      selectedProduct.purchaseUnit || "Stück"
                    }
                    placeholder="Stück, kg, Liter"
                  />
                </label>

                <label className="productsField">
                  <span>Bedarf je verkaufter Einheit</span>
                  <input
                    name="purchaseQuantityPerUnit"
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={
                      selectedProduct.purchaseQuantityPerUnit ?? ""
                    }
                    placeholder="1"
                  />
                </label>

                <label className="productsField">
                  <span>Gebindeart</span>
                  <input
                    name="packageUnit"
                    defaultValue={
                      selectedProduct.packageUnit || ""
                    }
                    placeholder="Karton, Beutel, Kiste"
                  />
                </label>

                <label className="productsField">
                  <span>Inhalt je Gebinde</span>
                  <input
                    name="packageQuantity"
                    type="number"
                    min="0"
                    step="0.001"
                    defaultValue={
                      selectedProduct.packageQuantity ?? ""
                    }
                    placeholder="48"
                  />
                </label>

                <label className="productsField">
                  <span>Einkaufspreis je Gebinde</span>
                  <div className="productsInputSuffix">
                    <input
                      name="purchasePriceEuro"
                      inputMode="decimal"
                      defaultValue={
                        selectedProduct.purchasePriceCents == null
                          ? ""
                          : String(
                              selectedProduct.purchasePriceCents / 100
                            ).replace(".", ",")
                      }
                      placeholder="31,90"
                    />
                    <small>EUR</small>
                  </div>
                </label>

                <label className="productsField productsFieldFull">
                  <span>Vorbereitung und Verarbeitung</span>
                  <textarea
                    name="preparationNotes"
                    rows={3}
                    defaultValue={
                      selectedProduct.preparationNotes || ""
                    }
                    placeholder="Zum Beispiel über Nacht auftauen und vor Ausgabe vier Minuten aufbacken"
                  />
                </label>

                <div className="productProcurementPreview productsFieldFull">
                  <div>
                    <small>Einkaufsgrundlage</small>
                    <strong>
                      {selectedProduct.purchaseQuantityPerUnit
                        ? `${selectedProduct.purchaseQuantityPerUnit} ${selectedProduct.purchaseUnit || "Stück"} je ${selectedProduct.unit || "Portion"}`
                        : "Noch keine Bedarfsmenge hinterlegt"}
                    </strong>
                  </div>

                  <div>
                    <small>Gebinde</small>
                    <strong>
                      {selectedProduct.packageQuantity
                        ? `${selectedProduct.packageQuantity} ${selectedProduct.purchaseUnit || "Stück"} je ${selectedProduct.packageUnit || "Gebinde"}`
                        : "Noch kein Gebinde hinterlegt"}
                    </strong>
                  </div>

                  <div>
                    <small>Lieferant</small>
                    <strong>
                      {selectedProduct.supplierName ||
                        "Noch nicht hinterlegt"}
                    </strong>
                  </div>
                </div>

                <div className="productProcurementActions">
                  <button
                    className="productsPrimaryButton"
                    type="submit"
                  >
                    Beschaffungsdaten speichern
                  </button>
                </div>
              </Form>
            </section>

            <div className="productDetailGrid">
              <section className="productDetailSection">
                <div className="productDetailSectionHeader">
                  <div>
                    <p className="eyebrow">Stammdaten</p>
                    <h3>Produktdetails bearbeiten</h3>
                  </div>
                </div>

                <Form method="post" className="productEditForm">
                  <input
                    type="hidden"
                    name="intent"
                    value="updateProduct"
                  />
                  <input
                    type="hidden"
                    name="productId"
                    value={selectedProduct.id}
                  />

                  <label className="productsField productsFieldFull">
                    <span>Produktname</span>
                    <input
                      name="name"
                      defaultValue={selectedProduct.name}
                      required
                    />
                  </label>

                  <label className="productsField">
                    <span>Kategorie</span>
                    <input
                      name="category"
                      defaultValue={selectedProduct.category || ""}
                    />
                  </label>

                  <label className="productsField">
                    <span>Einheit</span>
                    <input
                      name="unit"
                      defaultValue={
                        selectedProduct.unit || "Portion"
                      }
                    />
                  </label>

                  <label className="productsField">
                    <span>Verkaufspreis</span>
                    <div className="productsInputSuffix">
                      <input
                        name="priceEuro"
                        inputMode="decimal"
                        defaultValue={String(
                          (selectedProduct.priceCents || 0) / 100
                        ).replace(".", ",")}
                      />
                      <small>EUR</small>
                    </div>
                  </label>

                  <label className="productsField">
                    <span>Mehrwertsteuer</span>
                    <div className="productsInputSuffix">
                      <input
                        name="taxRate"
                        type="number"
                        step="0.01"
                        defaultValue={
                          selectedProduct.taxRate ?? 7
                        }
                      />
                      <small>%</small>
                    </div>
                  </label>

                  <label className="productsField productsFieldFull">
                    <span>Produktionsnotiz</span>
                    <textarea
                      name="notes"
                      rows={4}
                      defaultValue={selectedProduct.notes || ""}
                      placeholder="Hinweise für Produktion oder Ausgabe"
                    />
                  </label>

                  <div className="productEditActions">
                    <button
                      className="productsPrimaryButton"
                      type="submit"
                    >
                      Änderungen speichern
                    </button>
                  </div>
                </Form>
              </section>

              <section className="productDetailSection">
                <div className="productDetailSectionHeader">
                  <div>
                    <p className="eyebrow">Rezeptur</p>
                    <h3>Rezeptur pro Verkaufseinheit</h3>
                    <span>
                      Grundlage für Produktion und automatische
                      Einkaufsliste.
                    </span>
                  </div>

                  <div
                    className={
                      selectedRecipeItems.length > 0
                        ? "productRecipeState productRecipeComplete"
                        : "productRecipeState productRecipeMissing"
                    }
                  >
                    {selectedRecipeItems.length > 0
                      ? `${selectedRecipeItems.length} Position${
                          selectedRecipeItems.length === 1 ? "" : "en"
                        }`
                      : "Rezeptur fehlt"}
                  </div>
                </div>

                {selectedRecipeItems.length > 0 ? (
                  <div className="productRecipeList">
                    {selectedRecipeItems.map((item: any) => (
                      <div
                        className="productRecipeRow"
                        key={item.id}
                      >
                        <div className="productRecipeQuantity">
                          <strong>{item.quantityPerUnit}</strong>
                          <span>{item.unit}</span>
                        </div>

                        <div className="productRecipeIdentity">
                          <strong>{item.ingredientName}</strong>
                          <span>
                            {item.supplierName ||
                              "Kein Lieferant hinterlegt"}
                            {item.notes ? ` · ${item.notes}` : ""}
                          </span>
                        </div>

                        <Form
                          method="post"
                          onSubmit={(event) => {
                            if (
                              !window.confirm(
                                "Diese Rezepturposition wirklich löschen?"
                              )
                            ) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input
                            type="hidden"
                            name="intent"
                            value="deleteRecipeItem"
                          />
                          <input
                            type="hidden"
                            name="productId"
                            value={selectedProduct.id}
                          />
                          <input
                            type="hidden"
                            name="recipeItemId"
                            value={item.id}
                          />

                          <button
                            className="productIconDeleteButton"
                            type="submit"
                            aria-label={`${item.ingredientName} löschen`}
                            title="Rezepturposition löschen"
                          >
                            ×
                          </button>
                        </Form>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="productRecipeEmpty">
                    <div>!</div>
                    <strong>Noch keine Rezeptur hinterlegt</strong>
                    <span>
                      Ohne Rezeptur kann Gastario den Bedarf für die
                      Einkaufsliste nicht automatisch berechnen.
                    </span>
                  </div>
                )}

                <Form method="post" className="productRecipeForm">
                  <input
                    type="hidden"
                    name="intent"
                    value="addRecipeItem"
                  />
                  <input
                    type="hidden"
                    name="productId"
                    value={selectedProduct.id}
                  />

                  <label className="productsField productsFieldWide">
                    <span>Zutat oder Material</span>
                    <input
                      name="ingredientName"
                      placeholder="Zum Beispiel Basmatireis"
                      required
                    />
                  </label>

                  <label className="productsField">
                    <span>Menge pro Einheit</span>
                    <input
                      name="quantityPerUnit"
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="150"
                      required
                    />
                  </label>

                  <label className="productsField">
                    <span>Einheit</span>
                    <input
                      name="ingredientUnit"
                      defaultValue="g"
                      placeholder="g"
                      required
                    />
                  </label>

                  <label className="productsField">
                    <span>Lieferant</span>
                    <input
                      name="supplierName"
                      placeholder="Optional"
                    />
                  </label>

                  <label className="productsField productsFieldFull">
                    <span>Notiz</span>
                    <input
                      name="recipeNotes"
                      placeholder="Optionaler Hinweis zur Zutat"
                    />
                  </label>

                  <div className="productRecipeFormActions">
                    <button
                      className="productsPrimaryButton"
                      type="submit"
                    >
                      Rezepturposition hinzufügen
                    </button>
                  </div>
                </Form>
              </section>
            </div>

            <div className="productDangerZone">
              <div>
                <strong>Produktstatus und Löschen</strong>
                <span>
                  Inaktive Produkte bleiben erhalten, erscheinen aber
                  nicht mehr als regulär verwendbares Sortiment.
                </span>
              </div>

              <div className="productDangerActions">
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="toggleActive"
                  />
                  <input
                    type="hidden"
                    name="productId"
                    value={selectedProduct.id}
                  />
                  <input
                    type="hidden"
                    name="active"
                    value={
                      selectedProduct.active ? "false" : "true"
                    }
                  />

                  <button
                    className="productsSecondaryButton"
                    type="submit"
                  >
                    {selectedProduct.active
                      ? "Produkt deaktivieren"
                      : "Produkt aktivieren"}
                  </button>
                </Form>

                <Form
                  method="post"
                  onSubmit={(event) => {
                    if (
                      !window.confirm(
                        `Produkt „${selectedProduct.name}“ wirklich endgültig löschen?`
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input
                    type="hidden"
                    name="intent"
                    value="deleteProduct"
                  />
                  <input
                    type="hidden"
                    name="productId"
                    value={selectedProduct.id}
                  />

                  <button
                    className="productDeleteButton"
                    type="submit"
                  >
                    Produkt löschen
                  </button>
                </Form>
              </div>
            </div>
          </section>
        ) : (
          <section className="productsWorkspace">
            <div className="productsWorkspaceHeader">
              <div>
                <p className="eyebrow">Produktübersicht</p>
                <h2>Produkte und Rezepturen</h2>
                <span>
                  Wähle ein Produkt aus, um Stammdaten und Rezeptur
                  direkt auf dieser Seite zu bearbeiten.
                </span>
              </div>

              <div className="productsWorkspaceCount">
                <strong>{filteredProducts.length}</strong>
                <small>
                  von {products.length} Produkten
                </small>
              </div>
            </div>

            <div className="productsFilters">
              <label className="productsSearchField">
                <span>Produkte durchsuchen</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="Produkt, Kategorie, Zutat oder Notiz"
                />
              </label>

              <label className="productsFilterField">
                <span>Kategorie</span>
                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value)
                  }
                >
                  <option value="all">Alle Kategorien</option>
                  {categories.map((category) => (
                    <option value={category} key={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="productsFilterField">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="all">Alle Produkte</option>
                  <option value="active">Nur aktive</option>
                  <option value="inactive">Nur inaktive</option>
                </select>
              </label>

              <label className="productsFilterField">
                <span>Rezeptur</span>
                <select
                  value={recipeFilter}
                  onChange={(event) =>
                    setRecipeFilter(event.target.value)
                  }
                >
                  <option value="all">Alle Rezepturen</option>
                  <option value="complete">
                    Rezeptur vorhanden
                  </option>
                  <option value="missing">Rezeptur fehlt</option>
                </select>
              </label>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="productsEmptyState">
                <div className="productsEmptyIcon">P</div>
                <strong>Keine passenden Produkte gefunden</strong>
                <span>
                  Suche oder Filter zurücksetzen oder ein neues Produkt
                  anlegen.
                </span>

                <button
                  className="productsSecondaryButton"
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("all");
                    setStatusFilter("all");
                    setRecipeFilter("all");
                  }}
                >
                  Filter zurücksetzen
                </button>
              </div>
            ) : (
              <div className="productCardList">
                {filteredProducts.map((product: any) => {
                  const recipeItems = Array.isArray(
                    product.recipeItems
                  )
                    ? product.recipeItems
                    : [];

                  const hasRecipe = recipeItems.length > 0;

                  return (
                    <article
                      className={
                        product.active
                          ? "productCard"
                          : "productCard productCardInactive"
                      }
                      key={product.id}
                    >
                      <button
                        className="productCardTrigger"
                        type="button"
                        onClick={() => {
                          setShowCreateForm(false);
                          setSelectedProductId(product.id);
                        }}
                      >
                        <div className="productCardIcon">
                          {String(product.name || "P")
                            .trim()
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>

                        <div className="productCardIdentity">
                          <div className="productCardTitleLine">
                            <h3>{product.name}</h3>

                            <span
                              className={
                                product.active
                                  ? "productStatusBadge productStatusActive"
                                  : "productStatusBadge productStatusInactive"
                              }
                            >
                              {product.active
                                ? "Aktiv"
                                : "Inaktiv"}
                            </span>
                          </div>

                          <div className="productCardMeta">
                            <span>
                              {product.category ||
                                "Ohne Kategorie"}
                            </span>
                            <span>
                              {product.unit || "Portion"}
                            </span>
                            <span>
                              MwSt. {product.taxRate ?? 7} %
                            </span>
                          </div>

                          {product.notes ? (
                            <p>{product.notes}</p>
                          ) : (
                            <p className="productCardEmptyNote">
                              Keine Produktionsnotiz hinterlegt
                            </p>
                          )}
                        </div>

                        <div className="productCardPrice">
                          <small>Verkaufspreis</small>
                          <strong>
                            {centsToEuro(product.priceCents)}
                          </strong>
                          <span>
                            je {product.unit || "Portion"}
                          </span>
                        </div>

                        <div
                          className={
                            hasRecipe
                              ? "productCardRecipe productCardRecipeComplete"
                              : "productCardRecipe productCardRecipeMissing"
                          }
                        >
                          <small>Rezeptur</small>
                          <strong>
                            {hasRecipe
                              ? `${recipeItems.length} Position${
                                  recipeItems.length === 1
                                    ? ""
                                    : "en"
                                }`
                              : "Rezeptur fehlt"}
                          </strong>
                          <span>
                            {hasRecipe
                              ? "Für Einkauf vorbereitet"
                              : "Zutaten und Mengen ergänzen"}
                          </span>
                        </div>

                        <span className="productCardArrow">→</span>
                      </button>

                      {hasRecipe ? (
                        <div className="productIngredientsPreview">
                          {recipeItems
                            .slice(0, 4)
                            .map((item: any) => (
                              <span key={item.id}>
                                <strong>
                                  {item.quantityPerUnit} {item.unit}
                                </strong>
                                {item.ingredientName}
                              </span>
                            ))}

                          {recipeItems.length > 4 ? (
                            <span className="productMoreIngredients">
                              + {recipeItems.length - 4} weitere
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
