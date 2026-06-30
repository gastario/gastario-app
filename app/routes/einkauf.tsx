import { Form, Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatQty(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function meta() {
  return [{ title: "Einkauf · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "PURCHASING");

  const url = new URL(request.url);
  const selectedDate = url.searchParams.get("date") || todayInput();

  const orders = await prisma.order.findMany({
    where: {
      tenantId: access.tenantId,
      status: "CONFIRMED" as any,
    },
    include: {
      items: true,
      customer: true,
    },
    orderBy: [
      { deliveryDate: "asc" },
      { deliveryTime: "asc" },
      { createdAt: "desc" },
    ],
    take: 300,
  });

  const filteredOrders = orders.filter((order) => {
    if (!order.deliveryDate) return selectedDate === "ohne-datum";
    return normalizeDate(order.deliveryDate) === selectedDate;
  });

  const availableDates = Array.from(
    new Set(
      orders.map((order) =>
        order.deliveryDate ? normalizeDate(order.deliveryDate) : "ohne-datum"
      )
    )
  ).sort();

  if (!availableDates.includes(selectedDate)) {
    availableDates.unshift(selectedDate);
  }

  const products = await prisma.product.findMany({
    where: {
      tenantId: access.tenantId,
      active: true,
    },
    include: {
      recipeItems: true,
    },
  }).catch(() => []);

  const productMap = new Map<string, any>();

  for (const product of products as any[]) {
    productMap.set(product.name.trim().toLowerCase(), product);
  }

  const demandMap = new Map<string, any>();
  const missingRecipes = new Map<string, any>();

  for (const order of filteredOrders as any[]) {
    for (const orderItem of order.items) {
      const orderItemName = String(orderItem.name || "").trim();
      const product = productMap.get(orderItemName.toLowerCase());
      const orderQty = Number(orderItem.quantity || 0);

      if (!product || !product.recipeItems || product.recipeItems.length === 0) {
        const key = orderItemName || "Unbekannte Position";

        if (!missingRecipes.has(key)) {
          missingRecipes.set(key, {
            name: key,
            quantity: 0,
            unit: orderItem.unit || "Stueck",
            orders: [],
          });
        }

        const row = missingRecipes.get(key);
        row.quantity += orderQty;
        row.orders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
        });

        continue;
      }

      for (const recipeItem of product.recipeItems) {
        const ingredientName = String(recipeItem.ingredientName || "").trim();
        const unit = recipeItem.unit || "g";
        const supplierName = recipeItem.supplierName || "Ohne Lieferant";
        const requiredQty = Number(recipeItem.quantityPerUnit || 0) * orderQty;

        const key = `${supplierName}__${ingredientName}__${unit}`;

        if (!demandMap.has(key)) {
          demandMap.set(key, {
            supplierName,
            ingredientName,
            unit,
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
          productName: product.name,
          productQuantity: orderQty,
        });
      }
    }
  }

  const demandItems = Array.from(demandMap.values()).sort((a, b) => {
    const supplierCompare = a.supplierName.localeCompare(b.supplierName, "de");
    if (supplierCompare !== 0) return supplierCompare;
    return a.ingredientName.localeCompare(b.ingredientName, "de");
  });

  const missingRecipeItems = Array.from(missingRecipes.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de")
  );

  const supplierGroups = demandItems.reduce((groups: any[], item: any) => {
    let group = groups.find((entry) => entry.supplierName === item.supplierName);

    if (!group) {
      group = {
        supplierName: item.supplierName,
        items: [],
      };
      groups.push(group);
    }

    group.items.push(item);
    return groups;
  }, []);

  return {
    tenant: access.tenant,
    selectedDate,
    availableDates,
    orders: filteredOrders,
    demandItems,
    supplierGroups,
    missingRecipeItems,
  };
}

export default function PurchasingPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Einkauf & Lager</p>
          <h1>Einkauf</h1>
          <span className="pageSubline">
            Einkaufsvorschlaege aus bestaetigten Auftraegen und Produkt-Rezepturen fuer {data.tenant.name}.
          </span>
        </div>

        <div className="topActions">
          <Form method="get" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              name="date"
              defaultValue={data.selectedDate}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                padding: "11px 12px",
                font: "inherit",
                background: "white",
              }}
            >
              {data.availableDates.map((date: string) => (
                <option key={date} value={date}>
                  {date === "ohne-datum"
                    ? "Ohne Datum"
                    : new Date(date + "T00:00:00").toLocaleDateString("de-DE")}
                </option>
              ))}
            </select>

            <button className="secondaryButton" type="submit">
              Anzeigen
            </button>
          </Form>

          <button className="primaryButton" type="button" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Auftraege</p>
            <strong>{data.orders.length}</strong>
            <span>bestaetigt fuer dieses Datum</span>
          </div>
          <small data-trend="aktiv">echt</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Einkaufspositionen</p>
            <strong>{data.demandItems.length}</strong>
            <span>aus Rezepturen berechnet</span>
          </div>
          <small data-trend="bereit">Rezeptur</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Lieferanten</p>
            <strong>{data.supplierGroups.length}</strong>
            <span>automatisch gruppiert</span>
          </div>
          <small data-trend="bereit">Gruppe</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Ohne Rezeptur</p>
            <strong>{data.missingRecipeItems.length}</strong>
            <span>Produkte bitte pflegen</span>
          </div>
          <small data-trend="kritisch">Pruefen</small>
        </article>
      </section>

      {data.missingRecipeItems.length > 0 ? (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Pruefung</p>
              <h2>Positionen ohne Rezeptur</h2>
            </div>

            <Link className="ghostButton" to="/produkte">
              Rezepturen pflegen
            </Link>
          </div>

          <div className="compactList">
            {data.missingRecipeItems.map((item: any) => (
              <div className="compactItem" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {formatQty(item.quantity)} {item.unit} in Auftraegen vorhanden, aber kein passendes Produkt mit Rezeptur gefunden.
                  </span>
                </div>
                <small>Fehlt</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Bedarf</p>
              <h2>Automatische Einkaufsliste</h2>
            </div>
            <Link className="ghostButton" to="/produkte">
              Produkte / Rezepturen
            </Link>
          </div>

          <div className="purchaseDemandTable">
            <div className="purchaseDemandHead">
              <span>Zutat / Material</span>
              <span>Menge</span>
              <span>Einheit</span>
              <span>Lieferant</span>
              <span>Quelle</span>
            </div>

            {data.demandItems.length === 0 ? (
              <div className="purchaseDemandRow">
                <strong>Keine Einkaufsvorschlaege vorhanden.</strong>
                <span>-</span>
                <span>-</span>
                <span>-</span>
                <span>-</span>
              </div>
            ) : (
              data.demandItems.map((item: any) => (
                <div className="purchaseDemandRow" key={`${item.supplierName}-${item.ingredientName}-${item.unit}`}>
                  <strong>{item.ingredientName}</strong>
                  <span>{formatQty(item.quantity)}</span>
                  <span>{item.unit}</span>
                  <em>{item.supplierName}</em>
                  <span>
                    {item.sources.slice(0, 3).map((source: any) => (
                      <span key={`${source.orderId}-${source.productName}`} style={{ display: "block" }}>
                        {source.productQuantity} x {source.productName} · {source.orderNumber}
                      </span>
                    ))}
                    {item.sources.length > 3 ? (
                      <span style={{ display: "block" }}>+ {item.sources.length - 3} weitere</span>
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Gruppiert</p>
                <h2>Nach Lieferant</h2>
              </div>
            </div>

            <div className="compactList">
              {data.supplierGroups.length === 0 ? (
                <div className="compactItem">
                  <div>
                    <strong>Keine Lieferanten</strong>
                    <span>Noch keine Rezeptur-Lieferanten gefunden.</span>
                  </div>
                  <small>-</small>
                </div>
              ) : (
                data.supplierGroups.map((group: any) => (
                  <div className="compactItem" key={group.supplierName}>
                    <div>
                      <strong>{group.supplierName}</strong>
                      <span>{group.items.length} Positionen</span>
                    </div>
                    <small>Einkauf</small>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Ablauf</p>
                <h2>So rechnet Gastario</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Auftragsmenge x Rezepturmenge</strong>
              <p>
                Beispiel: 80 Chicken Bowls x 100 g Huhn = 8.000 g Huhn.
                Die Rezeptur pflegst du direkt beim Produkt.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
