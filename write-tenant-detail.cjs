const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "routes", "gastario-control.mandanten.$tenantId.tsx");

const content = String.raw`
import { Form, Link, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

export async function loader({ params }: { params: { tenantId?: string } }) {
  const { prisma } = await import("../lib/prisma.server");

  const tenantId = params.tenantId;

  if (!tenantId) {
    throw new Response("Mandant fehlt", { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Response("Mandant nicht gefunden", { status: 404 });
  }

  const [brands, emailAccounts, users, orders, enabledFeatures] = await Promise.all([
    prisma.brand.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),

    prisma.emailAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),

    prisma.tenantUser.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),

    prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }).catch(() => []),

    prisma.tenantFeature.findMany({
      where: { tenantId },
      orderBy: { feature: "asc" },
    }).catch(() => []),
  ]);

  return {
    tenant,
    brands,
    emailAccounts,
    users,
    orders,
    enabledFeatures,
  };
}

export async function action({ request, params }: { request: Request; params: { tenantId?: string } }) {
  const { prisma } = await import("../lib/prisma.server");

  const tenantId = params.tenantId;

  if (!tenantId) {
    return { error: "Mandant fehlt." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createBrand") {
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();

    if (!name) {
      return { error: "Markenname fehlt." };
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const currentCount = await prisma.brand.count({ where: { tenantId } });

    if (tenant && currentCount >= tenant.maxBrands) {
      return { error: "Limit erreicht: Für diesen Mandanten sind keine weiteren Marken erlaubt." };
    }

    await prisma.brand.create({
      data: {
        tenantId,
        name,
        email: email || null,
        active: true,
      },
    });

    return { success: "Marke wurde angelegt." };
  }

  if (intent === "toggleBrand") {
    const brandId = String(formData.get("brandId") || "");
    const active = String(formData.get("active") || "") === "true";

    if (!brandId) {
      return { error: "Marke fehlt." };
    }

    await prisma.brand.update({
      where: { id: brandId },
      data: { active },
    });

    return { success: active ? "Marke wurde aktiviert." : "Marke wurde deaktiviert." };
  }

  if (intent === "deleteBrand") {
    const brandId = String(formData.get("brandId") || "");

    if (!brandId) {
      return { error: "Marke fehlt." };
    }

    const emailCount = await prisma.emailAccount.count({
      where: {
        tenantId,
        brandId,
      },
    }).catch(() => 0);

    if (emailCount > 0) {
      return { error: "Diese Marke hat noch E-Mail-Konten. Bitte zuerst E-Mail-Konten deaktivieren oder löschen." };
    }

    await prisma.brand.delete({
      where: { id: brandId },
    });

    return { success: "Marke wurde gelöscht." };
  }

  if (intent === "createEmailAccount") {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const label = String(formData.get("label") || "").trim();
    const brandId = String(formData.get("brandId") || "").trim();

    if (!email) {
      return { error: "E-Mail-Adresse fehlt." };
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const currentCount = await prisma.emailAccount.count({ where: { tenantId } });

    if (tenant && currentCount >= tenant.maxEmailAccounts) {
      return { error: "Limit erreicht: Für diesen Mandanten sind keine weiteren Import-E-Mails erlaubt." };
    }

    const existing = await prisma.emailAccount.findFirst({
      where: {
        email,
      },
    });

    if (existing) {
      return { error: "Diese E-Mail-Adresse ist bereits als Import-E-Mail angelegt." };
    }

    await prisma.emailAccount.create({
      data: {
        tenantId,
        brandId: brandId || null,
        email,
        label: label || null,
        active: true,
        provider: "IMAP",
        mode: "FORWARDING",
      },
    });

    return { success: "Import-E-Mail wurde angelegt." };
  }

  if (intent === "toggleEmailAccount") {
    const emailAccountId = String(formData.get("emailAccountId") || "");
    const active = String(formData.get("active") || "") === "true";

    if (!emailAccountId) {
      return { error: "E-Mail-Konto fehlt." };
    }

    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { active },
    });

    return { success: active ? "Import-E-Mail wurde aktiviert." : "Import-E-Mail wurde deaktiviert." };
  }

  if (intent === "deleteEmailAccount") {
    const emailAccountId = String(formData.get("emailAccountId") || "");

    if (!emailAccountId) {
      return { error: "E-Mail-Konto fehlt." };
    }

    await prisma.emailAccount.delete({
      where: { id: emailAccountId },
    });

    return { success: "Import-E-Mail wurde gelöscht." };
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

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("de-DE");
}

export default function TenantDetailPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const tenant = data.tenant;
  const brands = data.brands;
  const emailAccounts = data.emailAccounts;
  const users = data.users;
  const orders = data.orders;
  const enabledFeatures = data.enabledFeatures;

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Mandant</div>
          <h1 className="pageTitle">{tenant.name}</h1>
          <p className="pageSubtitle">
            Detailverwaltung für Marken, Import-E-Mails, Benutzer, Aufträge und aktive Module.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn" to="/gastario-control/mandanten">
            Zurück zu Mandanten
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
          <div className="statLabel">Paket</div>
          <div className="statValue" style={{ fontSize: 30 }}>{planLabel(tenant.planCode)}</div>
          <div className="statHint">aktueller Tarif</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Status</div>
          <div className="statValue" style={{ fontSize: 30 }}>{statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}</div>
          <div className="statHint">Mandantenstatus</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Marken</div>
          <div className="statValue">{brands.length}</div>
          <div className="statHint">Limit: {tenant.maxBrands}</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Import-E-Mails</div>
          <div className="statValue">{emailAccounts.length}</div>
          <div className="statHint">Limit: {tenant.maxEmailAccounts}</div>
        </article>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Stammdaten</div>
              <h2 className="panelTitle">Mandant</h2>
            </div>
          </div>

          <div className="tableWrap">
            <table>
              <tbody>
                <tr>
                  <th>ID</th>
                  <td>{tenant.id}</td>
                </tr>
                <tr>
                  <th>Name</th>
                  <td>{tenant.name}</td>
                </tr>
                <tr>
                  <th>Slug</th>
                  <td>{tenant.slug || "-"}</td>
                </tr>
                <tr>
                  <th>Limits</th>
                  <td>{tenant.maxBrands} Marken / {tenant.maxEmailAccounts} E-Mails / {tenant.maxUsers} Benutzer</td>
                </tr>
                <tr>
                  <th>Erstellt</th>
                  <td>{formatDate(tenant.createdAt)}</td>
                </tr>
                <tr>
                  <th>Sperre</th>
                  <td>{tenant.lockedAt ? formatDate(tenant.lockedAt) : "-"}</td>
                </tr>
                <tr>
                  <th>Sperrgrund</th>
                  <td>{tenant.lockReason || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Benutzer</div>
              <h2 className="panelTitle">Zugänge</h2>
            </div>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Noch keine Benutzer vorhanden.</td>
                  </tr>
                ) : (
                  users.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.user.name || "-"}</td>
                      <td>{entry.user.email}</td>
                      <td>{entry.role}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start", marginTop: 20 }}>
        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Marken</div>
              <h2 className="panelTitle">Marken verwalten</h2>
            </div>
          </div>

          <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 14 }}>
            <input type="hidden" name="intent" value="createBrand" />
            <input name="name" placeholder="Markenname" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px" }} />
            <input name="email" type="email" placeholder="E-Mail optional" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px" }} />
            <button className="btn btnPrimary" type="submit">Anlegen</button>
          </Form>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Marke</th>
                  <th>E-Mail</th>
                  <th>Status</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {brands.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Noch keine Marken angelegt.</td>
                  </tr>
                ) : (
                  brands.map((brand) => (
                    <tr key={brand.id}>
                      <td className="tenantName">{brand.name}</td>
                      <td>{brand.email || "-"}</td>
                      <td>
                        <span className={brand.active ? "badge" : "badge badgeLocked"}>
                          {brand.active ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Form method="post">
                            <input type="hidden" name="intent" value="toggleBrand" />
                            <input type="hidden" name="brandId" value={brand.id} />
                            <input type="hidden" name="active" value={brand.active ? "false" : "true"} />
                            <button className="btn" type="submit">
                              {brand.active ? "Deaktivieren" : "Aktivieren"}
                            </button>
                          </Form>

                          <Form method="post">
                            <input type="hidden" name="intent" value="deleteBrand" />
                            <input type="hidden" name="brandId" value={brand.id} />
                            <button className="btn" type="submit" style={{ color: "#b91c1c" }}>
                              Löschen
                            </button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Import</div>
              <h2 className="panelTitle">Import-E-Mails verwalten</h2>
            </div>
          </div>

          <Form method="post" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, marginBottom: 14 }}>
            <input type="hidden" name="intent" value="createEmailAccount" />

            <input name="email" type="email" placeholder="import@firma.de" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px" }} />

            <input name="label" placeholder="Label optional" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px" }} />

            <select name="brandId" defaultValue="" style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "11px 12px" }}>
              <option value="">Keine Marke</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>

            <button className="btn btnPrimary" type="submit">Anlegen</button>
          </Form>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>E-Mail</th>
                  <th>Label</th>
                  <th>Marke</th>
                  <th>Status</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {emailAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Noch keine Import-E-Mail angelegt.</td>
                  </tr>
                ) : (
                  emailAccounts.map((account) => {
                    const brand = brands.find((item) => item.id === account.brandId);

                    return (
                      <tr key={account.id}>
                        <td className="tenantName">{account.email}</td>
                        <td>{account.label || "-"}</td>
                        <td>{brand?.name || "-"}</td>
                        <td>
                          <span className={account.active ? "badge" : "badge badgeLocked"}>
                            {account.active ? "Aktiv" : "Inaktiv"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Form method="post">
                              <input type="hidden" name="intent" value="toggleEmailAccount" />
                              <input type="hidden" name="emailAccountId" value={account.id} />
                              <input type="hidden" name="active" value={account.active ? "false" : "true"} />
                              <button className="btn" type="submit">
                                {account.active ? "Deaktivieren" : "Aktivieren"}
                              </button>
                            </Form>

                            <Form method="post">
                              <input type="hidden" name="intent" value="deleteEmailAccount" />
                              <input type="hidden" name="emailAccountId" value={account.id} />
                              <button className="btn" type="submit" style={{ color: "#b91c1c" }}>
                                Löschen
                              </button>
                            </Form>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Module</div>
            <h2 className="panelTitle">Aktivierte Module</h2>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {enabledFeatures.filter((item) => item.enabled).length === 0 ? (
            <span style={{ color: "#64748b", fontWeight: 800 }}>Noch keine Module aktiviert.</span>
          ) : (
            enabledFeatures.filter((item) => item.enabled).map((item) => (
              <span className="badge" key={item.id}>{item.feature}</span>
            ))
          )}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Aufträge</div>
            <h2 className="panelTitle">Neueste Aufträge</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Kunde</th>
                <th>Event</th>
                <th>Status</th>
                <th>Quelle</th>
                <th>Lieferdatum</th>
                <th>Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7}>Noch keine Aufträge vorhanden.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td className="tenantName">{order.orderNumber}</td>
                    <td>{order.customerName}</td>
                    <td>{order.eventName || "-"}</td>
                    <td>{order.status}</td>
                    <td>{order.source}</td>
                    <td>{formatDate(order.deliveryDate)}</td>
                    <td>{formatDate(order.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SuperAdminLayout>
  );
}
`;

fs.writeFileSync(file, content, "utf8");
console.log("Mandanten-Detailseite geschrieben:", file);
