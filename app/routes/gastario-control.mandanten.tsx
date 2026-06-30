import { Form, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";
import { prisma } from "../lib/prisma.server";

export async function loader() {
  const tenants = await prisma.tenant.findMany({
    include: {
      brands: {
        orderBy: { createdAt: "asc" },
      },
      emailAccounts: {
        orderBy: { createdAt: "asc" },
      },
      users: {
        include: {
          user: true,
        },
      },
      orders: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return { tenants };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");
  const tenantId = String(formData.get("tenantId") || "");

  if (!tenantId) {
    return { error: "Mandant fehlt." };
  }

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

export default function MandantenPage() {
  const { tenants } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Mandanten</h1>
          <p className="pageSubtitle">
            Verwalte Caterer, Pakete, Limits, Testphasen und Sperren zentral.
          </p>
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

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Mandantenverwaltung</div>
            <h2 className="panelTitle">Alle SaaS-Kunden</h2>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {tenants.length === 0 ? (
            <div style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 18,
              padding: 22,
              background: "#f8fafc",
              color: "#64748b",
              fontWeight: 800
            }}>
              Noch keine Mandanten vorhanden.
            </div>
          ) : (
            tenants.map((tenant) => (
              <article key={tenant.id} style={{
                border: "1px solid #dbe5ee",
                borderRadius: 22,
                background: "#ffffff",
                padding: 20,
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                  marginBottom: 16
                }}>
                  <div>
                    <div style={{
                      fontSize: 22,
                      fontWeight: 950,
                      letterSpacing: "-0.03em"
                    }}>
                      {tenant.name}
                    </div>

                    <div style={{
                      color: "#64748b",
                      fontWeight: 750,
                      marginTop: 5,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap"
                    }}>
                      <span>Paket: {planLabel(tenant.planCode)}</span>
                      <span>•</span>
                      <span>Status: {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}</span>
                      <span>•</span>
                      <span>Aufträge: {tenant.orders.length}</span>
                    </div>
                  </div>

                  <span className={
                    tenant.lockedAt
                      ? "badge badgeLocked"
                      : tenant.subscriptionStatus === "TRIAL"
                        ? "badge badgeTrial"
                        : "badge"
                  }>
                    {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}
                  </span>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 1fr",
                  gap: 18
                }}>
                  <div className="tableWrap">
                    <table>
                      <tbody>
                        <tr>
                          <th>Marken</th>
                          <td>
                            {tenant.brands.length === 0
                              ? "-"
                              : tenant.brands.map((brand) => brand.name).join(", ")}
                          </td>
                        </tr>
                        <tr>
                          <th>E-Mails</th>
                          <td>
                            {tenant.emailAccounts.length === 0
                              ? "-"
                              : tenant.emailAccounts.map((account) => account.email).join(", ")}
                          </td>
                        </tr>
                        <tr>
                          <th>Benutzer</th>
                          <td>
                            {tenant.users.length === 0
                              ? "-"
                              : tenant.users.map((item) => item.user.email).join(", ")}
                          </td>
                        </tr>
                        <tr>
                          <th>Limits</th>
                          <td>
                            {tenant.maxBrands} Marken / {tenant.maxEmailAccounts} E-Mails / {tenant.maxUsers} Benutzer
                          </td>
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

                  <div style={{
                    display: "grid",
                    gap: 12,
                    alignContent: "start"
                  }}>
                    <Form method="post" style={{
                      display: "grid",
                      gap: 10,
                      border: "1px solid #e2e8f0",
                      borderRadius: 18,
                      padding: 16,
                      background: "#f8fafc"
                    }}>
                      <input type="hidden" name="intent" value="updatePlan" />
                      <input type="hidden" name="tenantId" value={tenant.id} />

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

                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8
                      }}>
                        <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                          Marken
                          <input name="maxBrands" type="number" min="1" defaultValue={tenant.maxBrands} style={{
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            padding: "10px 12px"
                          }} />
                        </label>

                        <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                          E-Mails
                          <input name="maxEmailAccounts" type="number" min="1" defaultValue={tenant.maxEmailAccounts} style={{
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            padding: "10px 12px"
                          }} />
                        </label>

                        <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
                          Benutzer
                          <input name="maxUsers" type="number" min="1" defaultValue={tenant.maxUsers} style={{
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            padding: "10px 12px"
                          }} />
                        </label>
                      </div>

                      <button className="btn btnPrimary" type="submit">
                        Änderungen speichern
                      </button>
                    </Form>

                    {tenant.lockedAt ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="unlock" />
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <button className="btn" type="submit" style={{ width: "100%" }}>
                          Mandant entsperren
                        </button>
                      </Form>
                    ) : (
                      <Form method="post" style={{ display: "grid", gap: 8 }}>
                        <input type="hidden" name="intent" value="lock" />
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input name="lockReason" placeholder="Sperrgrund optional" style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 12,
                          padding: "10px 12px"
                        }} />
                        <button className="btn" type="submit" style={{
                          width: "100%",
                          color: "#b91c1c"
                        }}>
                          Mandant sperren
                        </button>
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
