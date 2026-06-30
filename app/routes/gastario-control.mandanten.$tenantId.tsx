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
    include: {
      brands: {
        orderBy: { createdAt: "asc" },
      },
      emailAccounts: {
        include: {
          brand: true,
        },
        orderBy: { createdAt: "asc" },
      },
      users: {
        include: {
          user: true,
        },
        orderBy: { createdAt: "asc" },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      enabledFeatures: {
        orderBy: { feature: "asc" },
      },
    },
  });

  if (!tenant) {
    throw new Response("Mandant nicht gefunden", { status: 404 });
  }

  return { tenant };
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

  if (intent === "createEmailAccount") {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const label = String(formData.get("label") || "").trim();
    const brandIdRaw = String(formData.get("brandId") || "").trim();

    if (!email) {
      return { error: "E-Mail-Adresse fehlt." };
    }

    await prisma.emailAccount.create({
      data: {
        tenantId,
        brandId: brandIdRaw || null,
        email,
        label: label || null,
        active: true,
        provider: "IMAP",
        mode: "FORWARDING",
      },
    });

    return { success: "E-Mail-Konto wurde angelegt." };
  }

  if (intent === "toggleBrand") {
    const brandId = String(formData.get("brandId") || "");
    const active = String(formData.get("active") || "") === "true";

    await prisma.brand.update({
      where: { id: brandId },
      data: { active },
    });

    return { success: active ? "Marke wurde aktiviert." : "Marke wurde deaktiviert." };
  }

  if (intent === "toggleEmailAccount") {
    const emailAccountId = String(formData.get("emailAccountId") || "");
    const active = String(formData.get("active") || "") === "true";

    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { active },
    });

    return { success: active ? "E-Mail-Konto wurde aktiviert." : "E-Mail-Konto wurde deaktiviert." };
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
  const { tenant } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Mandant</div>
          <h1 className="pageTitle">{tenant.name}</h1>
          <p className="pageSubtitle">
            Detailansicht für Paket, Status, Limits, Marken, E-Mail-Konten, Benutzer und Aufträge.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn" to="/gastario-control/mandanten">
            Zurück zu Mandanten
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
          <div className="statLabel">Aufträge</div>
          <div className="statValue">{tenant.orders.length}</div>
          <div className="statHint">neueste 25 geladen</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Module</div>
          <div className="statValue">{tenant.enabledFeatures.filter((item) => item.enabled).length}</div>
          <div className="statHint">aktiv geschaltet</div>
        </article>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        alignItems: "start"
      }}>
        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Stammdaten</div>
              <h2 className="panelTitle">Mandanten-Informationen</h2>
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
                  <td>{tenant.slug}</td>
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
                  <th>Gesperrt</th>
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
                {tenant.users.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Noch keine Benutzer vorhanden.</td>
                  </tr>
                ) : (
                  tenant.users.map((entry) => (
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

      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        alignItems: "start",
        marginTop: 20
      }}>
        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Marken</div>
              <h2 className="panelTitle">Brands verwalten</h2>
            </div>
          </div>

          <Form method="post" style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 10,
            marginBottom: 14
          }}>
            <input type="hidden" name="intent" value="createBrand" />
            <input name="name" placeholder="Markenname" style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "11px 12px"
            }} />
            <input name="email" type="email" placeholder="marke@firma.de optional" style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "11px 12px"
            }} />
            <button className="btn btnPrimary" type="submit">Hinzufügen</button>
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
                {tenant.brands.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Noch keine Marken angelegt.</td>
                  </tr>
                ) : (
                  tenant.brands.map((brand) => (
                    <tr key={brand.id}>
                      <td className="tenantName">{brand.name}</td>
                      <td>{brand.email || "-"}</td>
                      <td>
                        <span className={brand.active ? "badge" : "badge badgeLocked"}>
                          {brand.active ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                      <td>
                        <Form method="post">
                          <input type="hidden" name="intent" value="toggleBrand" />
                          <input type="hidden" name="brandId" value={brand.id} />
                          <input type="hidden" name="active" value={brand.active ? "false" : "true"} />
                          <button className="btn" type="submit">
                            {brand.active ? "Deaktivieren" : "Aktivieren"}
                          </button>
                        </Form>
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
              <h2 className="panelTitle">E-Mail-Konten</h2>
            </div>
          </div>

          <Form method="post" style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr auto",
            gap: 10,
            marginBottom: 14
          }}>
            <input type="hidden" name="intent" value="createEmailAccount" />

            <input name="email" type="email" placeholder="import@firma.de" style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "11px 12px"
            }} />

            <input name="label" placeholder="Label optional" style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "11px 12px"
            }} />

            <select name="brandId" defaultValue="" style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "11px 12px"
            }}>
              <option value="">Keine Marke</option>
              {tenant.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>

            <button className="btn btnPrimary" type="submit">Hinzufügen</button>
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
                {tenant.emailAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Noch keine Import-E-Mail angelegt.</td>
                  </tr>
                ) : (
                  tenant.emailAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className="tenantName">{account.email}</td>
                      <td>{account.label || "-"}</td>
                      <td>{account.brand?.name || "-"}</td>
                      <td>
                        <span className={account.active ? "badge" : "badge badgeLocked"}>
                          {account.active ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                      <td>
                        <Form method="post">
                          <input type="hidden" name="intent" value="toggleEmailAccount" />
                          <input type="hidden" name="emailAccountId" value={account.id} />
                          <input type="hidden" name="active" value={account.active ? "false" : "true"} />
                          <button className="btn" type="submit">
                            {account.active ? "Deaktivieren" : "Aktivieren"}
                          </button>
                        </Form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
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
              {tenant.orders.length === 0 ? (
                <tr>
                  <td colSpan={7}>Noch keine Aufträge vorhanden.</td>
                </tr>
              ) : (
                tenant.orders.map((order) => (
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
