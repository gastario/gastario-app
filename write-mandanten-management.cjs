const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes", "gastario-control.mandanten.tsx");

const content = String.raw`
import { Form, Link, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

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

const STARTER_FEATURES = [
  "DASHBOARD",
  "ORDERS",
  "CUSTOMERS",
  "PRODUCTS",
  "PACKING_LISTS",
  "DELIVERY_NOTES",
];

const PROFESSIONAL_FEATURES = [
  ...STARTER_FEATURES,
  "QUOTES",
  "PRODUCTION",
  "DELIVERIES",
  "INCOMING_ORDERS",
  "PDF_EXTRACTION",
  "EMAIL_AUTOMATION",
  "PRODUCT_MAPPING",
  "PURCHASING",
  "INVENTORY",
  "SUPPLIERS",
  "RECIPES",
  "REPORTS",
  "MULTI_USER",
];

const PREMIUM_FEATURES = [
  ...PROFESSIONAL_FEATURES,
  "DRIVER_VIEW",
  "INTEGRATIONS",
];

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
  });

  const rows = await Promise.all(
    tenants.map(async (tenant) => {
      const [brands, emailAccounts, users, orders, enabledFeatures] = await Promise.all([
        prisma.brand.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "asc" },
        }).catch(() => []),

        prisma.emailAccount.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "asc" },
        }).catch(() => []),

        prisma.tenantUser.findMany({
          where: { tenantId: tenant.id },
          include: { user: true },
          orderBy: { createdAt: "asc" },
        }).catch(() => []),

        prisma.order.count({
          where: { tenantId: tenant.id },
        }).catch(() => 0),

        prisma.tenantFeature.findMany({
          where: { tenantId: tenant.id },
        }).catch(() => []),
      ]);

      return {
        ...tenant,
        brands,
        emailAccounts,
        users,
        orderCount: orders,
        enabledFeatures,
      };
    })
  );

  return { tenants: rows, features: FEATURES };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const tenantId = String(formData.get("tenantId") || "");

  if (!tenantId) {
    return { error: "Mandant fehlt." };
  }

  if (intent === "updateTenant") {
    const planCode = String(formData.get("planCode") || "STARTER");
    const subscriptionStatus = String(formData.get("subscriptionStatus") || "TRIAL");

    let maxBrands = Number(formData.get("maxBrands") || 1);
    let maxEmailAccounts = Number(formData.get("maxEmailAccounts") || 1);
    let maxUsers = Number(formData.get("maxUsers") || 1);

    if (planCode === "STARTER") {
      maxBrands = Math.max(maxBrands, 1);
      maxEmailAccounts = Math.max(maxEmailAccounts, 1);
      maxUsers = Math.max(maxUsers, 1);
    }

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

    return { success: "Mandant wurde gespeichert." };
  }

  if (intent === "lockTenant") {
    const lockReason = String(formData.get("lockReason") || "").trim();

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        lockedAt: new Date(),
        lockReason: lockReason || "Durch Super Admin gesperrt",
      },
    });

    return { success: "Mandant wurde gesperrt." };
  }

  if (intent === "unlockTenant") {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        lockedAt: null,
        lockReason: null,
      },
    });

    return { success: "Mandant wurde entsperrt." };
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

  if (intent === "applyPackageFeatures") {
    const planCode = String(formData.get("planCode") || "STARTER");

    const selected =
      planCode === "PREMIUM"
        ? PREMIUM_FEATURES
        : planCode === "PROFESSIONAL"
          ? PROFESSIONAL_FEATURES
          : STARTER_FEATURES;

    await prisma.$transaction(
      FEATURES.map((feature) =>
        prisma.tenantFeature.upsert({
          where: {
            tenantId_feature: {
              tenantId,
              feature: feature.code as any,
            },
          },
          update: {
            enabled: selected.includes(feature.code),
          },
          create: {
            tenantId,
            feature: feature.code as any,
            enabled: selected.includes(feature.code),
          },
        })
      )
    );

    return { success: "Module wurden passend zum Paket gesetzt." };
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
  const entry = tenant.enabledFeatures.find((item: any) => item.feature === featureCode);
  return Boolean(entry?.enabled);
}

export default function MandantenPage() {
  const { tenants, features } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Mandanten</h1>
          <p className="pageSubtitle">
            Verwalte Caterer, Pakete, Status, Limits, Sperren und Modul-Freischaltungen.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn btnPrimary" to="/gastario-control/codes">
            Zugangscode erstellen
          </Link>
        </div>
      </header>

      {actionData?.success ? (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: 16, borderRadius: 16, fontWeight: 900, marginBottom: 16 }}>
          {actionData.success}
        </div>
      ) : null}

      {actionData?.error ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 16, borderRadius: 16, fontWeight: 900, marginBottom: 16 }}>
          {actionData.error}
        </div>
      ) : null}

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{tenants.length}</div>
          <div className="statHint">gesamt</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aktiv</div>
          <div className="statValue">{tenants.filter((tenant) => tenant.subscriptionStatus === "ACTIVE").length}</div>
          <div className="statHint">zahlende Kunden</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Testphase</div>
          <div className="statValue">{tenants.filter((tenant) => tenant.subscriptionStatus === "TRIAL").length}</div>
          <div className="statHint">Trials</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Gesperrt</div>
          <div className="statValue">{tenants.filter((tenant) => tenant.lockedAt).length}</div>
          <div className="statHint">mit Sperre</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Mandantenverwaltung</div>
            <h2 className="panelTitle">Alle SaaS-Kunden</h2>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {tenants.length === 0 ? (
            <div style={{ border: "1px dashed #cbd5e1", borderRadius: 18, padding: 22, background: "#f8fafc", color: "#64748b", fontWeight: 800 }}>
              Noch keine Mandanten vorhanden.
            </div>
          ) : (
            tenants.map((tenant) => (
              <article key={tenant.id} style={{ border: "1px solid #dbe5ee", borderRadius: 24, background: "#ffffff", padding: 20, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 950, letterSpacing: "-0.04em" }}>
                      <Link to={"/gastario-control/mandanten/" + tenant.id} style={{ color: "inherit", textDecoration: "none" }}>
                        {tenant.name}
                      </Link>
                    </div>

                    <div style={{ color: "#64748b", fontWeight: 750, marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>Paket: {planLabel(tenant.planCode)}</span>
                      <span>•</span>
                      <span>Status: {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}</span>
                      <span>•</span>
                      <span>Aufträge: {tenant.orderCount}</span>
                      <span>•</span>
                      <span>Module: {tenant.enabledFeatures.filter((item: any) => item.enabled).length}</span>
                    </div>
                  </div>

                  <span className={tenant.lockedAt ? "badge badgeLocked" : tenant.subscriptionStatus === "TRIAL" ? "badge badgeTrial" : "badge"}>
                    {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(360px, .8fr)", gap: 18, alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div className="tableWrap">
                      <table>
                        <tbody>
                          <tr>
                            <th>Marken</th>
                            <td>{tenant.brands.length ? tenant.brands.map((brand: any) => brand.name).join(", ") : "-"}</td>
                          </tr>
                          <tr>
                            <th>E-Mail-Konten</th>
                            <td>{tenant.emailAccounts.length ? tenant.emailAccounts.map((account: any) => account.email).join(", ") : "-"}</td>
                          </tr>
                          <tr>
                            <th>Benutzer</th>
                            <td>{tenant.users.length ? tenant.users.map((entry: any) => entry.user.email).join(", ") : "-"}</td>
                          </tr>
                          <tr>
                            <th>Limits</th>
                            <td>{tenant.maxBrands} Marken / {tenant.maxEmailAccounts} E-Mails / {tenant.maxUsers} Benutzer</td>
                          </tr>
                          {tenant.lockedAt ? (
                            <tr>
                              <th>Sperrgrund</th>
                              <td>{tenant.lockReason || "-"}</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ border: "1px solid #dbe5ee", borderRadius: 18, padding: 16, background: "#f8fafc" }}>
                      <div style={{ fontWeight: 950, marginBottom: 12 }}>Module freischalten</div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                        {features.map((feature) => {
                          const enabled = isFeatureEnabled(tenant, feature.code);

                          return (
                            <Form method="post" key={feature.code}>
                              <input type="hidden" name="intent" value="toggleFeature" />
                              <input type="hidden" name="tenantId" value={tenant.id} />
                              <input type="hidden" name="feature" value={feature.code} />
                              <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />

                              <button type="submit" style={{ width: "100%", textAlign: "left", border: enabled ? "1px solid #99f6e4" : "1px solid #dbe5ee", background: enabled ? "#ecfdf5" : "#ffffff", color: enabled ? "#065f46" : "#334155", borderRadius: 14, padding: "11px 12px", fontWeight: 900, cursor: "pointer" }}>
                                <span style={{ display: "block", fontSize: 13 }}>{enabled ? "✓ " : "+ "}{feature.label}</span>
                                <span style={{ display: "block", fontSize: 11, color: enabled ? "#047857" : "#64748b", marginTop: 3 }}>{feature.group}</span>
                              </button>
                            </Form>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <Form method="post" style={{ display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#f8fafc" }}>
                      <input type="hidden" name="intent" value="updateTenant" />
                      <input type="hidden" name="tenantId" value={tenant.id} />

                      <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                        Paket
                        <select name="planCode" defaultValue={tenant.planCode} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }}>
                          <option value="STARTER">Starter</option>
                          <option value="PROFESSIONAL">Professional</option>
                          <option value="PREMIUM">Premium</option>
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                        Status
                        <select name="subscriptionStatus" defaultValue={tenant.subscriptionStatus} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }}>
                          <option value="TRIAL">Testphase</option>
                          <option value="ACTIVE">Aktiv</option>
                          <option value="PAST_DUE">Zahlung offen</option>
                          <option value="CANCELED">Gekündigt</option>
                        </select>
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                          Marken
                          <input name="maxBrands" type="number" min="1" defaultValue={tenant.maxBrands} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }} />
                        </label>

                        <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                          E-Mails
                          <input name="maxEmailAccounts" type="number" min="1" defaultValue={tenant.maxEmailAccounts} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }} />
                        </label>

                        <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                          Benutzer
                          <input name="maxUsers" type="number" min="1" defaultValue={tenant.maxUsers} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }} />
                        </label>
                      </div>

                      <button className="btn btnPrimary" type="submit">Speichern</button>
                    </Form>

                    <Form method="post">
                      <input type="hidden" name="intent" value="applyPackageFeatures" />
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <input type="hidden" name="planCode" value={tenant.planCode} />
                      <button className="btn" type="submit" style={{ width: "100%" }}>
                        Module passend zum Paket setzen
                      </button>
                    </Form>

                    {tenant.lockedAt ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="unlockTenant" />
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <button className="btn" type="submit" style={{ width: "100%" }}>Mandant entsperren</button>
                      </Form>
                    ) : (
                      <Form method="post" style={{ display: "grid", gap: 8 }}>
                        <input type="hidden" name="intent" value="lockTenant" />
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input name="lockReason" placeholder="Sperrgrund optional" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }} />
                        <button className="btn" type="submit" style={{ width: "100%", color: "#b91c1c" }}>Mandant sperren</button>
                      </Form>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </SuperAdminLayout>
  );
}
`;

fs.writeFileSync(file, content, "utf8");
console.log("Mandantenverwaltung geschrieben:", file);
