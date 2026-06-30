import { Link, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const now = new Date();

  const [
    tenantCount,
    activeTenantCount,
    trialTenantCount,
    lockedTenantCount,
    orderCount,
    userCount,
    inviteCount,
    openInviteCount,
    usedInviteCount,
    tenants,
    latestInvites,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { subscriptionStatus: "ACTIVE", lockedAt: null } }),
    prisma.tenant.count({ where: { subscriptionStatus: "TRIAL" } }),
    prisma.tenant.count({ where: { lockedAt: { not: null } } }),
    prisma.order.count(),
    prisma.user.count(),
    prisma.registrationInvite.count(),
    prisma.registrationInvite.count({
      where: {
        usedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    }),
    prisma.registrationInvite.count({
      where: {
        usedAt: { not: null },
      },
    }),
    prisma.tenant.findMany({
      include: {
        brands: true,
        emailAccounts: true,
        users: { include: { user: true } },
        orders: { select: { id: true } },
        enabledFeatures: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.registrationInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    tenantCount,
    activeTenantCount,
    trialTenantCount,
    lockedTenantCount,
    orderCount,
    userCount,
    inviteCount,
    openInviteCount,
    usedInviteCount,
    tenants,
    latestInvites,
  };
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

function inviteStatus(invite: any) {
  if (invite.usedAt) return "Benutzt";
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) return "Abgelaufen";
  return "Offen";
}

export default function GastarioControl() {
  const data = useLoaderData<typeof loader>();

  const monthlyRevenue = data.tenants.reduce((sum, tenant) => {
    if (tenant.subscriptionStatus !== "ACTIVE") return sum;
    if (tenant.planCode === "PREMIUM") return sum + 299;
    if (tenant.planCode === "PROFESSIONAL") return sum + 179;
    return sum + 59;
  }, 0);

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Control Center</h1>
          <p className="pageSubtitle">
            Zentrale Uebersicht fuer Mandanten, Registrierungscodes, Pakete, Module und Plattform-Status.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn" to="/gastario-control/codes">Codes erstellen</Link>
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">Mandanten verwalten</Link>
        </div>
      </header>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{data.tenantCount}</div>
          <div className="statHint">gesamt angelegt</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aktiv</div>
          <div className="statValue">{data.activeTenantCount}</div>
          <div className="statHint">zahlende Kunden</div>
        </article>

        <article className="statCard">
          <div className="statLabel">MRR geplant</div>
          <div className="statValue">{monthlyRevenue} EUR</div>
          <div className="statHint">aus aktiven Paketen</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Auftraege</div>
          <div className="statValue">{data.orderCount}</div>
          <div className="statHint">gesamt im System</div>
        </article>
      </section>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Testphasen</div>
          <div className="statValue">{data.trialTenantCount}</div>
          <div className="statHint">Mandanten in Trial</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Gesperrt</div>
          <div className="statValue">{data.lockedTenantCount}</div>
          <div className="statHint">Mandanten mit Sperre</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Offene Codes</div>
          <div className="statValue">{data.openInviteCount}</div>
          <div className="statHint">noch nutzbar</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Benutzer</div>
          <div className="statValue">{data.userCount}</div>
          <div className="statHint">gesamt registriert</div>
        </article>
      </section>

      <section style={{
        display: "grid",
        gridTemplateColumns: "1.35fr .85fr",
        gap: 20,
        alignItems: "start"
      }}>
        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Mandanten</div>
              <h2 className="panelTitle">Neueste SaaS-Kunden</h2>
            </div>

            <Link className="btn" to="/gastario-control/mandanten">
              Alle anzeigen
            </Link>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Paket</th>
                  <th>Status</th>
                  <th>Marken</th>
                  <th>E-Mails</th>
                  <th>Module</th>
                  <th>Auftraege</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Noch keine Mandanten vorhanden.</td>
                  </tr>
                ) : (
                  data.tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td className="tenantName"><Link to={`/gastario-control/mandanten/${tenant.id}`} style={{ color: "inherit", textDecoration: "none" }}>{tenant.name}</Link></td>
                      <td>{planLabel(tenant.planCode)}</td>
                      <td>
                        <span className={
                          tenant.lockedAt
                            ? "badge badgeLocked"
                            : tenant.subscriptionStatus === "TRIAL"
                              ? "badge badgeTrial"
                              : "badge"
                        }>
                          {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}
                        </span>
                      </td>
                      <td>{tenant.brands.length}</td>
                      <td>{tenant.emailAccounts.length}</td>
                      <td>{tenant.enabledFeatures.filter((item) => item.enabled).length}</td>
                      <td>{tenant.orders.length}</td>
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
              <div className="panelKicker">Registrierung</div>
              <h2 className="panelTitle">Neueste Codes</h2>
            </div>

            <Link className="btn" to="/gastario-control/codes">
              Codes
            </Link>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.latestInvites.length === 0 ? (
                  <tr>
                    <td colSpan={2}>Noch keine Codes erstellt.</td>
                  </tr>
                ) : (
                  data.latestInvites.map((invite) => {
                    const status = inviteStatus(invite);

                    return (
                      <tr key={invite.id}>
                        <td style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontWeight: 950,
                          fontSize: 12
                        }}>
                          {invite.code}
                        </td>
                        <td>
                          <span className={
                            status === "Offen"
                              ? "badge"
                              : status === "Abgelaufen"
                                ? "badge badgeTrial"
                                : "badge badgeLocked"
                          }>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10
          }}>
            <div style={{
              border: "1px solid #dbe5ee",
              borderRadius: 16,
              padding: 13,
              background: "#f8fafc"
            }}>
              <div className="statLabel">Codes</div>
              <div style={{ fontWeight: 950, fontSize: 24 }}>{data.inviteCount}</div>
            </div>

            <div style={{
              border: "1px solid #dbe5ee",
              borderRadius: 16,
              padding: 13,
              background: "#f8fafc"
            }}>
              <div className="statLabel">Offen</div>
              <div style={{ fontWeight: 950, fontSize: 24 }}>{data.openInviteCount}</div>
            </div>

            <div style={{
              border: "1px solid #dbe5ee",
              borderRadius: 16,
              padding: 13,
              background: "#f8fafc"
            }}>
              <div className="statLabel">Benutzt</div>
              <div style={{ fontWeight: 950, fontSize: 24 }}>{data.usedInviteCount}</div>
            </div>
          </div>
        </section>
      </section>
    </SuperAdminLayout>
  );
}

