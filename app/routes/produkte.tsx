import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

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
    const products = await prisma.product.findMany({
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

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontWeight: 750,
  width: "100%",
};

export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Produkte</h1>
          <span className="pageSubline">
            {data.tenant?.name || "Kein Mandant"} · Produkte mit Preisen und Rezepturmengen fuer automatische Einkaufsliste.
          </span>
        </div>

        <div className="topActions">
          <a className="secondaryButton" href="/einkauf">Einkauf</a>
          <button className="primaryButton" type="button">Neues Produkt</button>
        </div>
      </header>

      {data.setupError ? (
        <div style={{
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {data.setupError}
        </div>
      ) : null}

      {actionData?.success ? (
        <div style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          color: "#065f46",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.success}
        </div>
      ) : null}

      {actionData?.error ? (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
          padding: 16,
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.error}
        </div>
      ) : null}

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Produkte</p>
            <strong>{data.stats.total}</strong>
            <span>{data.stats.active} aktiv</span>
          </div>
          <small data-trend="aktiv">echt</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Kategorien</p>
            <strong>{data.stats.categories}</strong>
            <span>Produktgruppen</span>
          </div>
          <small data-trend="bereit">Sortiment</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Rezepturpositionen</p>
            <strong>{data.stats.recipeItems}</strong>
            <span>Zutaten / Material</span>
          </div>
          <small data-trend="pruefen">Einkauf</small>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Neues Produkt</p>
            <h2>Produkt anlegen</h2>
          </div>
        </div>

        <Form method="post" style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr .7fr .7fr .5fr", gap: 12, alignItems: "end" }}>
          <input type="hidden" name="intent" value="createProduct" />

          <label>
            Produkt
            <input name="name" placeholder="Chicken Bowl" style={inputStyle} required />
          </label>

          <label>
            Kategorie
            <input name="category" placeholder="Bowls" style={inputStyle} />
          </label>

          <label>
            Einheit
            <input name="unit" placeholder="Portion" defaultValue="Portion" style={inputStyle} />
          </label>

          <label>
            Preis EUR
            <input name="priceEuro" placeholder="10,90" style={inputStyle} />
          </label>

          <label>
            MwSt %
            <input name="taxRate" type="number" step="0.01" defaultValue="7" style={inputStyle} />
          </label>

          <label style={{ gridColumn: "1 / -2" }}>
            Notiz / Produktion
            <input name="notes" placeholder="Reis, Huhn, Gemuese, Sauce..." style={inputStyle} />
          </label>

          <button className="primaryButton" type="submit">
            Anlegen
          </button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Produktuebersicht</p>
            <h2>Produkte und Rezepturmengen</h2>
          </div>
        </div>

        <div className="productsTable">
          <div className="productsHead">
            <span>Produkt</span>
            <span>Kategorie</span>
            <span>Preis</span>
            <span>Einheit</span>
            <span>Rezeptur</span>
            <span>Status</span>
            <span>Aktion</span>
          </div>

          {data.products.length === 0 ? (
            <div className="productsRow">
              <div>
                <strong>Noch keine Produkte angelegt.</strong>
                <small>-</small>
              </div>
              <span>-</span>
              <strong>{centsToEuro(0)}</strong>
              <span>-</span>
              <span>-</span>
              <em>Leer</em>
              <span>-</span>
            </div>
          ) : (
            data.products.map((product: any) => (
              <div className="productsRow" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <small>MwSt {product.taxRate ?? 7}%</small>
                </div>

                <span>{product.category || "-"}</span>
                <strong>{centsToEuro(product.priceCents)}</strong>
                <span>{product.unit || "Portion"}</span>

                <span>
                  {product.recipeItems.length === 0 ? (
                    "Keine Rezeptur"
                  ) : (
                    product.recipeItems.map((item: any) => (
                      <span key={item.id} style={{ display: "block" }}>
                        {item.quantityPerUnit} {item.unit} {item.ingredientName}
                        {item.supplierName ? ` · ${item.supplierName}` : ""}
                      </span>
                    ))
                  )}
                </span>

                <em>{product.active ? "Aktiv" : "Inaktiv"}</em>

                <div style={{ display: "grid", gap: 8 }}>
                  <details>
                    <summary className="ghostButton" style={{ listStyle: "none", cursor: "pointer" }}>
                      Rezeptur
                    </summary>

                    <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 1fr auto", gap: 8, marginTop: 10 }}>
                      <input type="hidden" name="intent" value="addRecipeItem" />
                      <input type="hidden" name="productId" value={product.id} />

                      <input name="ingredientName" placeholder="Zutat / Material" style={inputStyle} />
                      <input name="quantityPerUnit" type="number" step="0.001" placeholder="Menge" style={inputStyle} />
                      <input name="ingredientUnit" placeholder="g" defaultValue="g" style={inputStyle} />
                      <input name="supplierName" placeholder="Lieferant optional" style={inputStyle} />

                      <button className="primaryButton" type="submit">Hinzufuegen</button>
                    </Form>

                    {product.recipeItems.map((item: any) => (
                      <Form method="post" key={item.id} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <input type="hidden" name="intent" value="deleteRecipeItem" />
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="recipeItemId" value={item.id} />
                        <button className="ghostButton" type="submit" style={{ color: "#b91c1c" }}>
                          {item.quantityPerUnit} {item.unit} {item.ingredientName} loeschen
                        </button>
                      </Form>
                    ))}
                  </details>

                  <details>
                    <summary className="ghostButton" style={{ listStyle: "none", cursor: "pointer" }}>
                      Bearbeiten
                    </summary>

                    <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      <input type="hidden" name="intent" value="updateProduct" />
                      <input type="hidden" name="productId" value={product.id} />

                      <input name="name" defaultValue={product.name} style={inputStyle} />
                      <input name="category" defaultValue={product.category || ""} style={inputStyle} />
                      <input name="unit" defaultValue={product.unit || "Portion"} style={inputStyle} />
                      <input name="priceEuro" defaultValue={String((product.priceCents || 0) / 100).replace(".", ",")} style={inputStyle} />
                      <input name="taxRate" type="number" step="0.01" defaultValue={product.taxRate ?? 7} style={inputStyle} />
                      <input name="notes" defaultValue={product.notes || ""} style={{ ...inputStyle, gridColumn: "1 / -1" }} />

                      <button className="primaryButton" type="submit" style={{ gridColumn: "1 / -1" }}>
                        Speichern
                      </button>
                    </Form>
                  </details>

                  <Form method="post">
                    <input type="hidden" name="intent" value="toggleActive" />
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="active" value={product.active ? "false" : "true"} />
                    <button className="ghostButton" type="submit">
                      {product.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </Form>

                  <Form method="post">
                    <input type="hidden" name="intent" value="deleteProduct" />
                    <input type="hidden" name="productId" value={product.id} />
                    <button className="ghostButton" type="submit" style={{ color: "#b91c1c" }}>
                      Loeschen
                    </button>
                  </Form>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </AppLayout>
  );
}
