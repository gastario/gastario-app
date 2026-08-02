import { Form, useActionData, useLoaderData } from "react-router";

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
import "../styles/gastario-supply-masterdesign.css";

export function meta() {
  return [{ title: "Lager · Gastario" }];
}

function toNumber(value: FormDataEntryValue | null, fallback = 0) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "INVENTORY");

  const items = await prisma.inventoryItem.findMany({
    where: {
      tenantId: access.tenantId,
    },
    orderBy: [
      { active: "desc" },
      { name: "asc" },
    ],
  });

  const activeItems = items.filter((item) => item.active);
  const lowItems = activeItems.filter((item) => item.minStock > 0 && item.currentStock <= item.minStock);

  const estimatedValue = activeItems.reduce((sum, item) => sum + item.currentStock, 0);

  return {
    tenant: access.tenant,
    items,
    stats: {
      total: items.length,
      active: activeItems.length,
      low: lowItems.length,
      stockSum: estimatedValue,
    },
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "INVENTORY");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createItem") {
    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const unit = String(formData.get("unit") || "Stueck").trim() || "Stueck";
    const currentStock = toNumber(formData.get("currentStock"));
    const minStock = toNumber(formData.get("minStock"));
    const supplierName = String(formData.get("supplierName") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!name) {
      return { error: "Artikelname fehlt." };
    }

    await prisma.inventoryItem.create({
      data: {
        tenantId: access.tenantId,
        name,
        category: category || null,
        unit,
        currentStock,
        minStock,
        supplierName: supplierName || null,
        location: location || null,
        notes: notes || null,
        active: true,
      },
    });

    return { success: "Lagerartikel wurde angelegt." };
  }

  const itemId = String(formData.get("itemId") || "");

  if (!itemId) {
    return { error: "Lagerartikel fehlt." };
  }

  const item = await prisma.inventoryItem.findFirst({
    where: {
      id: itemId,
      tenantId: access.tenantId,
    },
  });

  if (!item) {
    return { error: "Lagerartikel nicht gefunden." };
  }

  if (intent === "adjustStock") {
    const change = toNumber(formData.get("change"));
    const nextStock = Math.max(0, item.currentStock + change);

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        currentStock: nextStock,
      },
    });

    return { success: "Bestand wurde aktualisiert." };
  }

  if (intent === "updateItem") {
    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const unit = String(formData.get("unit") || "Stueck").trim() || "Stueck";
    const currentStock = toNumber(formData.get("currentStock"));
    const minStock = toNumber(formData.get("minStock"));
    const supplierName = String(formData.get("supplierName") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!name) {
      return { error: "Artikelname fehlt." };
    }

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        name,
        category: category || null,
        unit,
        currentStock,
        minStock,
        supplierName: supplierName || null,
        location: location || null,
        notes: notes || null,
      },
    });

    return { success: "Lagerartikel wurde gespeichert." };
  }

  if (intent === "toggleActive") {
    const active = String(formData.get("active") || "") === "true";

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { active },
    });

    return { success: active ? "Lagerartikel wurde aktiviert." : "Lagerartikel wurde deaktiviert." };
  }

  if (intent === "deleteItem") {
    await prisma.inventoryItem.delete({
      where: { id: item.id },
    });

    return { success: "Lagerartikel wurde geloescht." };
  }

  return { error: "Unbekannte Aktion." };
}

function stockStatus(item: any) {
  if (!item.active) return "Inaktiv";
  if (item.minStock > 0 && item.currentStock <= item.minStock) return "Unter Mindestbestand";
  return "Ausreichend";
}

function statusClass(item: any) {
  const status = stockStatus(item);
  if (status === "Inaktiv") return "warning";
  if (status === "Unter Mindestbestand") return "danger";
  return "success";
}

function formatInventoryNumber(value: unknown) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(number);
}

export default function InventoryPage() {
  /*
   * gastario-inventory-masterdesign-v1-20260802
   *
   * Bestehende Lageraktionen bleiben unverändert.
   */
  const data = useLoaderData<typeof loader>();
  const actionData =
    useActionData<typeof action>() as any;

  return (
    <AppLayout>
      <PageShell className="supplyPage inventoryMasterPage">
        <PageHeader
          eyebrow="Einkauf & Lager"
          title="Lager"
          subtitle={
            <>
              Bestand, Mindestbestand, Lieferant und
              Lagerort für {data.tenant.name}.
            </>
          }
          actions={
            <button
              className="supplyButton supplyButton--secondary supplyPrintButton"
              type="button"
              onClick={() => window.print()}
            >
              Drucken
            </button>
          }
        />

        {actionData?.success ? (
          <Notice type="success">
            {actionData.success}
          </Notice>
        ) : null}

        {actionData?.error ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        <MetricGrid>
          <MetricCard
            label="Lagerartikel"
            value={data.stats.total}
            description={`${data.stats.active} aktiv`}
            badge="Bestand"
          />

          <MetricCard
            label="Unter Mindestbestand"
            value={data.stats.low}
            description="müssen nachbestellt werden"
            badge={
              data.stats.low > 0
                ? "Kritisch"
                : "Sauber"
            }
            attention={data.stats.low > 0}
          />

          <MetricCard
            label="Bestandssumme"
            value={formatInventoryNumber(
              data.stats.stockSum
            )}
            description="alle aktiven Mengen addiert"
            badge="Mengen"
          />

          <MetricCard
            label="Inaktiv"
            value={
              data.stats.total -
              data.stats.active
            }
            description="aktuell nicht im Bestand geführt"
            badge="Archiv"
          />
        </MetricGrid>

        <PageSection
          eyebrow="Neuer Artikel"
          title="Lagerartikel anlegen"
          description="Artikel, Einheit, Bestand, Mindestbestand und Lagerort in einem Schritt erfassen."
        >
          <Form
            method="post"
            className="inventoryCreateForm"
          >
            <input
              type="hidden"
              name="intent"
              value="createItem"
            />

            <label className="supplyField inventoryField--name">
              <span>Artikel</span>
              <input
                name="name"
                placeholder="z. B. Reis"
                required
              />
            </label>

            <label className="supplyField">
              <span>Kategorie</span>
              <input
                name="category"
                placeholder="Zutaten"
              />
            </label>

            <label className="supplyField">
              <span>Einheit</span>
              <input
                name="unit"
                placeholder="kg"
                defaultValue="Stueck"
              />
            </label>

            <label className="supplyField">
              <span>Bestand</span>
              <input
                name="currentStock"
                type="number"
                step="0.01"
                defaultValue="0"
              />
            </label>

            <label className="supplyField">
              <span>Mindestbestand</span>
              <input
                name="minStock"
                type="number"
                step="0.01"
                defaultValue="0"
              />
            </label>

            <label className="supplyField">
              <span>Lieferant</span>
              <input
                name="supplierName"
                placeholder="z. B. METRO"
              />
            </label>

            <label className="supplyField">
              <span>Lagerort</span>
              <input
                name="location"
                placeholder="Trockenlager"
              />
            </label>

            <label className="supplyField inventoryField--note">
              <span>Notiz</span>
              <input
                name="notes"
                placeholder="optional"
              />
            </label>

            <button
              className="supplyButton supplyButton--primary"
              type="submit"
            >
              Lagerartikel anlegen
            </button>
          </Form>
        </PageSection>

        <PageSection
          eyebrow="Bestände"
          title="Aktuelle Lagerartikel"
          description="Bestände buchen, Stammdaten bearbeiten und kritische Mengen früh erkennen."
        >
          <div className="inventoryMasterTableWrap">
            <table className="inventoryMasterTable">
              <thead>
                <tr>
                  <th>Artikel</th>
                  <th>Kategorie</th>
                  <th>Bestand</th>
                  <th>Mindestbestand</th>
                  <th>Lieferant</th>
                  <th>Lagerort</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>

              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="supplyEmpty">
                        <strong>
                          Noch keine Lagerartikel
                          angelegt
                        </strong>
                        <p>
                          Lege oben den ersten
                          Zutaten- oder
                          Verpackungsartikel an.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.items.map((item: any) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        {item.notes ? (
                          <small>{item.notes}</small>
                        ) : null}
                      </td>

                      <td>
                        {item.category || "–"}
                      </td>

                      <td className="inventoryMasterQuantity">
                        {formatInventoryNumber(
                          item.currentStock
                        )}{" "}
                        <small>{item.unit}</small>
                      </td>

                      <td>
                        {formatInventoryNumber(
                          item.minStock
                        )}{" "}
                        {item.unit}
                      </td>

                      <td>
                        {item.supplierName || "–"}
                      </td>

                      <td>
                        {item.location || "–"}
                      </td>

                      <td>
                        <span
                          className={[
                            "supplyStatus",
                            statusClass(item) ===
                            "danger"
                              ? "supplyStatus--danger"
                              : statusClass(item) ===
                                  "warning"
                                ? "supplyStatus--warning"
                                : "supplyStatus--success",
                          ].join(" ")}
                        >
                          {stockStatus(item)}
                        </span>
                      </td>

                      <td>
                        <details className="supplyDetails inventoryActions">
                          <summary className="supplyButton supplyButton--secondary">
                            Bearbeiten
                          </summary>

                          <div className="inventoryActionPanel">
                            <Form
                              method="post"
                              className="inventoryStockForm"
                            >
                              <input
                                type="hidden"
                                name="intent"
                                value="adjustStock"
                              />

                              <input
                                type="hidden"
                                name="itemId"
                                value={item.id}
                              />

                              <label className="supplyField">
                                <span>Bestandsänderung</span>
                                <input
                                  name="change"
                                  type="number"
                                  step="0.01"
                                  placeholder="+ / − Menge"
                                />
                              </label>

                              <button
                                className="supplyButton supplyButton--primary"
                                type="submit"
                              >
                                Bestand buchen
                              </button>
                            </Form>

                            <Form
                              method="post"
                              className="inventoryEditGrid"
                            >
                              <input
                                type="hidden"
                                name="intent"
                                value="updateItem"
                              />

                              <input
                                type="hidden"
                                name="itemId"
                                value={item.id}
                              />

                              <input
                                name="name"
                                defaultValue={item.name}
                              />

                              <input
                                name="category"
                                defaultValue={
                                  item.category || ""
                                }
                                placeholder="Kategorie"
                              />

                              <input
                                name="unit"
                                defaultValue={item.unit}
                              />

                              <input
                                name="currentStock"
                                type="number"
                                step="0.01"
                                defaultValue={
                                  item.currentStock
                                }
                              />

                              <input
                                name="minStock"
                                type="number"
                                step="0.01"
                                defaultValue={
                                  item.minStock
                                }
                              />

                              <input
                                name="supplierName"
                                defaultValue={
                                  item.supplierName || ""
                                }
                                placeholder="Lieferant"
                              />

                              <input
                                name="location"
                                defaultValue={
                                  item.location || ""
                                }
                                placeholder="Lagerort"
                              />

                              <input
                                className="inventoryEditWide"
                                name="notes"
                                defaultValue={
                                  item.notes || ""
                                }
                                placeholder="Notiz"
                              />

                              <button
                                className="supplyButton supplyButton--primary inventoryEditWide"
                                type="submit"
                              >
                                Stammdaten speichern
                              </button>
                            </Form>

                            <div className="inventoryDangerActions">
                              <Form method="post">
                                <input
                                  type="hidden"
                                  name="intent"
                                  value="toggleActive"
                                />

                                <input
                                  type="hidden"
                                  name="itemId"
                                  value={item.id}
                                />

                                <input
                                  type="hidden"
                                  name="active"
                                  value={
                                    item.active
                                      ? "false"
                                      : "true"
                                  }
                                />

                                <button
                                  className="supplyButton supplyButton--secondary"
                                  type="submit"
                                >
                                  {item.active
                                    ? "Deaktivieren"
                                    : "Aktivieren"}
                                </button>
                              </Form>

                              <Form method="post">
                                <input
                                  type="hidden"
                                  name="intent"
                                  value="deleteItem"
                                />

                                <input
                                  type="hidden"
                                  name="itemId"
                                  value={item.id}
                                />

                                <button
                                  className="supplyButton supplyButton--danger"
                                  type="submit"
                                >
                                  Löschen
                                </button>
                              </Form>
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}
