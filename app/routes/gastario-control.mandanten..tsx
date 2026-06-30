import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";
import { prisma } from "../lib/prisma.server";
import { requireSuperAdmin } from "../lib/session.server";

const FEATURES = [
  { code: "DASHBOARD", label: "Dashboard", group: "Basis" },
  { code: "ORDERS", label: "Aufträge", group: "Basis" },
  { code: "CUSTOMERS", label: "Kunden", group: "Basis" },
  { code: "PRODUCTS", label: "Produkte", group: "Basis" },
  { code: "QUOTES", label: "Angebote", group: "Basis" },
  { code: "PRODUCTION", label: "Produktion", group: "Betrieb" },
  { code: "PACKING_LISTS", label: "Packlisten", group: "Betrieb" },
  { code: "DELIVERY_NOTES", label: "Lieferscheine", group: "Betrieb" },
  { code: "DELIVERIES", label: "Lieferungen", group: "Betrieb" },
  { code: "INCOMING_ORDERS", label: "Auftragseingang", group: "Automatisierung" },
  { code: "PDF_EXTRACTION", label: "PDF-Erkennung", group: "Automatisierung" },
  { code: "EMAIL_AUTOMATION", label: "E-Mail-Automatik", group: "Automatisierung" },
  { code: "PRODUCT_MAPPING", label: "Produkt-Mapping", group: "Automatisierung" },
  { code: "PURCHASING", label: "Einkauf", group: "Warenwirtschaft" },
  { code: "INVENTORY", label: "Lager", group: "Warenwirtschaft" },
  { code: "SUPPLIERS", label: "Lieferanten", group: "Warenwirtschaft" },
  { code: "RECIPES", label: "Rezepte", group: "Warenwirtschaft" },
  { code: "REPORTS", label: "Auswertungen", group: "Auswertung" },
  { code: "MULTI_USER", label: "Mehrere Benutzer", group: "Premium" },
  { code: "DRIVER_VIEW", label: "Fahreransicht", group: "Premium" },
  { code: "INTEGRATIONS", label: "Integrationen", group: "Premium" },
];

export async function loader({ request, params }: { request: Request; params: { tenantId?: string } }) {
  await requireSuperAdmin(request);

  const tenantId = params.tenantId;

  if (!tenantId) {
    throw redirect("/gastario-control/mandanten");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      brands: {
        orderBy: { createdAt: "asc" },
      },
      emailAccounts: {
        orderBy: { createdAt: "asc" },
      },
      enabledFeatures: true,
      users: {
        include: {
          user: true,
        },
      },
      orders: {
        include: {
          items: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      customers: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!tenant) {
    throw redirect("/gastario-control/mandanten");
  }

  return { tenant, features: FEATURES };
}

export async function action({ request, params }: { request: Request; params: { tenantId?: string } }) {
  await requireSuperAdmin(request);

  const tenantId = params.tenantId;

  if (!tenantId) {
    return { error: "Mandant fehlt." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "updatePlan") {
    const planCode = String(formData.get("planCode") || "STARTER");
    const subscriptionStatus = String(formData.get("subscriptionStatus") || "TRIAL");

    let maxBrands = Number(formData.get("maxBrands") || 1);
    let maxEmailAccounts = Number(formData.get("maxEmailAccounts") || 1);
    let maxUsers = Number(formData.get("maxUsers") || 1);

    if (planCode === "PROFESSIONAL") {
      maxBrands = Math.max(maxBrands, 3);
      maxEmailAccounts = Math.max(maxEmailAccounts, 3);
      maxUsers = Math.max(maxUsers, 5);
    }

    if (planCode === "PREMIUM") {
      maxBrands = Math.max(maxBrands, 999);
      maxEmailAccounts = Math.max(maxEmailAccounts, 999);
      maxUsers = Math.max(maxUsers, 999);
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planCode: planCode as any,
        subscriptionStatus: subscriptionStatus as any,
        maxBrands,
        maxEmailAccounts,
        maxUsers,
      },
    });

    return { success: "Mandant wurde aktualisiert." };
  }

  if (intent === "toggleFeature") {
    const feature = String(formData.get("feature") || "");
    const enabled = String(formData.get("enabled") || "") === "true";

    if (!FEATURES.some((item) => item.code === feature)) {
      return { error: "Unbekanntes Modul." };
    }

    await prisma.tenantFeature.upsert({
      where: {
        tenantId_feature: {
          tenantId,
          feature: feature as any,
        },
      },
      update: {
        enabled,
      },
      create: {
        tenantId,
        feature: feature as any,
        enabled,
      },
    });

    return { success: enabled ? "Modul wurde aktiviert." : "Modul wurde deaktiviert." };
  }

  if (intent === "lock") {
    const lockReason = String(formData.get("lockReason") || "Durch Super Admin gesperrt").trim();

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        lockedAt: new Date(),
        lockReason: lockReason || "Durch Super Admin gesperrt",
      },
    });

    return { success: "Mandant wurde gesperrt." };
  }

  if (intent === "unlock") {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        lockedAt: null,
        lockReason: null,
      },
    });

    return { success: "Mandant wurde entsperrt." };
  }

  return { error: "Unbekannte Aktion." };
}

function planLabel(planCode: string) {
  if (planCode === "PROFESSIONAL") return "Professional";
  if (planCode === "PREMIUM") return "Premium";
  return "Starter";
}

function statusLabel(status: string, lockedAt?: string | Date | null) {
  if (lockedAt) return "Gesperrt";
  if (status === "TRIAL") return "Testphase";
  if (status === "ACTIVE") return "Aktiv";
  if (status === "PAST_DUE") return "Zahlung offen";
  if (status === "CANCELED") return "Gekündigt";
  return status;
}

function isFeatureEnabled(tenant: any, featureCode: string) {
  const item = tenant.enabledFeatures.find((entry: any) => entry.feature === featureCode);
  return Boolean(item?.enabled);
}

export default function TenantDetailPage() {
  const { tenant, features } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Mandant</div>
          <h1 className="pageTitle">{tenant.name}</h1>
          <p className="pageSubtitle">
            Paket: {planLabel(tenant.planCode)} · Status: {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}
          </p>
        </div>

        <div className="topActions">
          <Link className="btn" to="/gastario-control/mandanten">
            Zurück
          </Link>
        </div>
      </header>

      {actionData?.success ? (
        <div style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          color: "#065f46",
          padding: "14px 16px",
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
          padding: "14px 16px",
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.error}
        </div>
      ) : null}

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Marken</div>
          <div className="statValue">{tenant.brands.length}</div>
          <div className="statHint">Limit: {tenant.maxBrands}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">E-Mails</div>
          <div className="statValue">{tenant.emailAccounts.length}</div>
          <div className="statHint">Limit: {tenant.maxEmailAccounts}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Benutzer</div>
          <div className="statValue">{tenant.users.length}</div>
          <div className="statHint">Limit: {tenant.maxUsers}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aufträge</div>
          <div className="statValue">{tenant.orders.length}</div>
          <div className="statHint">letzte 10 geladen</div>
        </article>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 420px",
        gap: 18,
        alignItems: "start"
      }}>
        <div style={{ display: "grid", gap: 18 }}>
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelKicker">Module</div>
                <h2 className="panelTitle">Freischaltungen</h2>
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 10
            }}>
              {features.map((feature) => {
                const enabled = isFeatureEnabled(tenant, feature.code);

                return (
                  <Form method="post" key={feature.code}>
                    <input type="hidden" name="intent" value="toggleFeature" />
                    <input type="hidden" name="feature" value={feature.code} />
                    <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />

                    <button
                      type="submit"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: enabled ? "1px solid #99f6e4" : "1px solid #dbe5ee",
                        background: enabled ? "#ecfdf5" : "#ffffff",
                        color: enabled ? "#065f46" : "#334155",
                        borderRadius: 14,
                        padding: "11px 12px",
                        fontWeight: 900,
                        cursor: "pointer"
                      }}
                    >
                      <span style={{ display: "block", fontSize: 13 }}>
                        {enabled ? "✓ " : "+ "}
                        {feature.label}
                      </span>
                      <span style={{
                        display: "block",
                        fontSize: 11,
                        color: enabled ? "#047857" : "#64748b",
                        marginTop: 3
                      }}>
                        {feature.group}
                      </span>
                    </button>
                  </Form>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelKicker">Daten</div>
                <h2 className="panelTitle">Marken, E-Mails und Benutzer</h2>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <tbody>
                  <tr>
                    <th>Marken</th>
                    <td>{tenant.brands.length ? tenant.brands.map((brand) => brand.name).join(", ") : "-"}</td>
                  </tr>
                  <tr>
                    <th>E-Mails</th>
                    <td>{tenant.emailAccounts.length ? tenant.emailAccounts.map((account) => account.email).join(", ") : "-"}</td>
                  </tr>
                  <tr>
                    <th>Benutzer</th>
                    <td>{tenant.users.length ? tenant.users.map((item) => item.user.email).join(", ") : "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelKicker">Aufträge</div>
                <h2 className="panelTitle">Letzte Aufträge</h2>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Auftrag</th>
                    <th>Kunde</th>
                    <th>Quelle</th>
                    <th>Status</th>
                    <th>Positionen</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.orders.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Noch keine Aufträge vorhanden.</td>
                    </tr>
                  ) : (
                    tenant.orders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.orderNumber}</td>
                        <td>{order.customerName}</td>
                        <td>{order.source}</td>
                        <td>{order.status}</td>
                        <td>{order.items.length}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside style={{ display: "grid", gap: 14 }}>
          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelKicker">Paket & Limits</div>
                <h2 className="panelTitle">Verwaltung</h2>
              </div>
            </div>

            <Form method="post" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="intent" value="updatePlan" />

              <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                Paket
                <select name="planCode" defaultValue={tenant.planCode} style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "10px 12px"
                }}>
                  <option value="STARTER">Starter</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="PREMIUM">Premium</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                Status
                <select name="subscriptionStatus" defaultValue={tenant.subscriptionStatus} style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "10px 12px"
                }}>
                  <option value="TRIAL">Testphase</option>
                  <option value="ACTIVE">Aktiv</option>
                  <option value="PAST_DUE">Zahlung offen</option>
                  <option value="CANCELED">Gekündigt</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                Max. Marken
                <input name="maxBrands" type="number" min="1" defaultValue={tenant.maxBrands} style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "10px 12px"
                }} />
              </label>

              <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                Max. E-Mails
                <input name="maxEmailAccounts" type="number" min="1" defaultValue={tenant.maxEmailAccounts} style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "10px 12px"
                }} />
              </label>

              <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                Max. Benutzer
                <input name="maxUsers" type="number" min="1" defaultValue={tenant.maxUsers} style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "10px 12px"
                }} />
              </label>

              <button className="btn btnPrimary" type="submit">
                Speichern
              </button>
            </Form>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <div className="panelKicker">Sperre</div>
                <h2 className="panelTitle">Mandant sperren</h2>
              </div>
            </div>

            {tenant.lockedAt ? (
              <Form method="post">
                <input type="hidden" name="intent" value="unlock" />
                <button className="btn" type="submit" style={{ width: "100%" }}>
                  Mandant entsperren
                </button>
              </Form>
            ) : (
              <Form method="post" style={{ display: "grid", gap: 10 }}>
                <input type="hidden" name="intent" value="lock" />
                <input name="lockReason" placeholder="Sperrgrund optional" style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: "10px 12px"
                }} />
                <button className="btn" type="submit" style={{ width: "100%", color: "#b91c1c" }}>
                  Mandant sperren
                </button>
              </Form>
            )}
          </section>
        </aside>
      </section>
    </SuperAdminLayout>
  );
}
