import { Form, Link, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

const FEATURES = [
  { code: "DASHBOARD", label: "Dashboard", group: "Basis" },
  { code: "ORDERS", label: "Auftraege", group: "Basis" },
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

function packageFeatures(planCode: string) {
  if (planCode === "PREMIUM") return PREMIUM_FEATURES;
  if (planCode === "PROFESSIONAL") return PROFESSIONAL_FEATURES;
  return STARTER_FEATURES;
}

function packageLimits(planCode: string) {
  if (planCode === "PREMIUM") {
    return { maxBrands: 999, maxEmailAccounts: 999, maxUsers: 999 };
  }

  if (planCode === "PROFESSIONAL") {
    return { maxBrands: 3, maxEmailAccounts: 3, maxUsers: 5 };
  }

  return { maxBrands: 1, maxEmailAccounts: 1, maxUsers: 1 };
}

function makeSlug(name: string) {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "mandant";

  return `${base}-${Date.now().toString(36)}`;
}

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      brands: { orderBy: { createdAt: "asc" } },
      emailAccounts: { orderBy: { createdAt: "asc" } },
      users: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      enabledFeatures: true,
      _count: {
        select: {
          orders: true,
          customers: true,
          products: true,
        },
      },
    },
  });

  return { tenants, features: FEATURES };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createTenant") {
    const name = String(formData.get("name") || "").trim();
    const adminEmail = String(formData.get("adminEmail") || "").trim().toLowerCase();
    const adminName = String(formData.get("adminName") || "").trim();
    const brandName = String(formData.get("brandName") || "").trim();
    const importEmail = String(formData.get("importEmail") || "").trim().toLowerCase();
    const planCode = String(formData.get("planCode") || "STARTER");
    const subscriptionStatus = String(formData.get("subscriptionStatus") || "TRIAL");

    if (!name) return { error: "Firmenname fehlt." };
    if (!adminEmail || !adminEmail.includes("@")) return { error: "Admin-E-Mail fehlt oder ist ungueltig." };

    const limits = packageLimits(planCode);
    const selectedFeatures = packageFeatures(planCode);
    const slug = makeSlug(name);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          planCode: planCode as any,
          subscriptionStatus: subscriptionStatus as any,
          maxBrands: limits.maxBrands,
          maxEmailAccounts: limits.maxEmailAccounts,
          maxUsers: limits.maxUsers,
        },
      });

      const user = await tx.user.upsert({
        where: { email: adminEmail },
        update: {
          name: adminName || undefined,
        },
        create: {
          email: adminEmail,
          name: adminName || adminEmail,
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "OWNER" as any,
        },
      });

      if (brandName) {
        await tx.brand.create({
          data: {
            tenantId: tenant.id,
            name: brandName,
            email: importEmail || null,
            active: true,
          },
        });
      }

      if (importEmail) {
        await tx.emailAccount.create({
          data: {
            tenantId: tenant.id,
            email: importEmail,
            label: brandName || name,
            active: true,
          },
        });
      }

      await Promise.all(
        FEATURES.map((feature) =>
          tx.tenantFeature.create({
            data: {
              tenantId: tenant.id,
              feature: feature.code as any,
              enabled: selectedFeatures.includes(feature.code),
            },
          })
        )
      );

      return tenant;
    });

    return {
      success: `Mandant "${result.name}" wurde erstellt.`,
    };
  }

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
    const selected = packageFeatures(planCode);

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
  if (status === "CANCELED") return "Gekuendigt";
  return status;
}

function isFeatureEnabled(tenant: any, featureCode: string) {
  const entry = tenant.enabledFeatures.find((item: any) => item.feature === featureCode);
  return Boolean(entry?.enabled);
}

function alertBox(type: "success" | "error", text: string) {
  const styles =
    type === "success"
      ? { background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }
      : { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" };

  return (
    <div style={{ ...styles, padding: 16, borderRadius: 16, fontWeight: 900, marginBottom: 16 }}>
      {text}
    </div>
  );
}

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontWeight: 750,
  width: "100%",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 900,
  color: "#0f172a",
};

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

      {actionData?.success ? alertBox("success", actionData.success) : null}
      {actionData?.error ? alertBox("error", actionData.error) : null}

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
            <div className="panelKicker">Neuer Mandant</div>
            <h2 className="panelTitle">Caterer direkt anlegen</h2>
          </div>
        </div>

        <Form method="post" style={{ display: "grid", gap: 14, marginTop: 18 }}>
          <input type="hidden" name="intent" value="createTenant" />

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14 }}>
            <label style={labelStyle}>
              Firmenname
              <input name="name" placeholder="z.B. Muster Catering GmbH" style={inputStyle} required />
            </label>

            <label style={labelStyle}>
              Admin-Name
              <input name="adminName" placeholder="z.B. Max Mustermann" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Admin-E-Mail
              <input name="adminEmail" type="email" placeholder="admin@firma.de" style={inputStyle} required />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
            <label style={labelStyle}>
              Marke
              <input name="brandName" placeholder="z.B. Let Me Bowl" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Import-E-Mail
              <input name="importEmail" type="email" placeholder="orders@firma.de" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Paket
              <select name="planCode" defaultValue="STARTER" style={inputStyle}>
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </label>

            <label style={labelStyle}>
              Status
              <select name="subscriptionStatus" defaultValue="TRIAL" style={inputStyle}>
                <option value="TRIAL">Testphase</option>
                <option value="ACTIVE">Aktiv</option>
                <option value="PAST_DUE">Zahlung offen</option>
                <option value="CANCELED">Gekuendigt</option>
              </select>
            </label>
          </div>

          <button className="btn btnPrimary" type="submit" style={{ justifySelf: "start" }}>
            Mandant erstellen
          </button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Mandantenverwaltung</div>
            <h2 className="panelTitle">Alle SaaS-Kunden</h2>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          {tenants.length === 0 ? (
            <div style={{ border: "1px dashed #cbd5e1", borderRadius: 18, padding: 22, background: "#f8fafc", color: "#64748b", fontWeight: 800 }}>
              Noch keine Mandanten vorhanden. Lege oben den ersten Caterer an.
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
                      <span>Auftraege: {tenant._count.orders}</span>
                      <span>•</span>
                      <span>Kunden: {tenant._count.customers}</span>
                      <span>•</span>
                      <span>Produkte: {tenant._count.products}</span>
                    </div>
                  </div>

                  <span className={tenant.lockedAt ? "badge badgeLocked" : "badge"}>
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

                      <label style={labelStyle}>
                        Paket
                        <select name="planCode" defaultValue={tenant.planCode} style={inputStyle}>
                          <option value="STARTER">Starter</option>
                          <option value="PROFESSIONAL">Professional</option>
                          <option value="PREMIUM">Premium</option>
                        </select>
                      </label>

                      <label style={labelStyle}>
                        Status
                        <select name="subscriptionStatus" defaultValue={tenant.subscriptionStatus} style={inputStyle}>
                          <option value="TRIAL">Testphase</option>
                          <option value="ACTIVE">Aktiv</option>
                          <option value="PAST_DUE">Zahlung offen</option>
                          <option value="CANCELED">Gekuendigt</option>
                        </select>
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <label style={labelStyle}>
                          Marken
                          <input name="maxBrands" type="number" min="1" defaultValue={tenant.maxBrands} style={inputStyle} />
                        </label>

                        <label style={labelStyle}>
                          E-Mails
                          <input name="maxEmailAccounts" type="number" min="1" defaultValue={tenant.maxEmailAccounts} style={inputStyle} />
                        </label>

                        <label style={labelStyle}>
                          Benutzer
                          <input name="maxUsers" type="number" min="1" defaultValue={tenant.maxUsers} style={inputStyle} />
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
                        <input name="lockReason" placeholder="Sperrgrund optional" style={inputStyle} />
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
