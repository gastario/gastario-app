import { Link, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const [tenantCount, trialCount, lockedCount, tenants] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { subscriptionStatus: "TRIAL" } }),
    prisma.tenant.count({ where: { lockedAt: { not: null } } }),
    prisma.tenant.findMany({
      include: {
        brands: true,
        emailAccounts: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return { tenantCount, trialCount, lockedCount, tenants };
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
  return status;
}

export default function GastarioControl() {
  const { tenantCount, trialCount, lockedCount, tenants } = useLoaderData<typeof loader>();

  const monthlyRevenue = tenants.reduce((sum, tenant) => {
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
          <p className="pageSubtitle">Mandanten, Pakete, Module, Limits und Freischaltungen zentral verwalten.</p>
        </div>

        <div className="topActions">
          <Link className="btn" to="/gastario-control/codes">Registrierungscodes</Link>
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">Mandanten verwalten</Link>
        </div>
      </header>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{tenantCount}</div>
          <div className="statHint">aktive Caterer und Testkunden</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Monatsumsatz SaaS</div>
          <div className="statValue">{monthlyRevenue} EUR</div>
          <div className="statHint">wiederkehrend geplant</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Testphasen</div>
          <div className="statValue">{trialCount}</div>
          <div className="statHint">laufen aktuell</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Gesperrt</div>
          <div className="statValue">{lockedCount}</div>
          <div className="statHint">Mandanten mit Sperre</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Mandanten</div>
            <h2 className="panelTitle">Aktuelle SaaS-Kunden</h2>
          </div>

          <Link className="btn" to="/gastario-control/mandanten">
            Alle Mandanten oeffnen
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
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6}>Noch keine Mandanten vorhanden.</td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="tenantName">{tenant.name}</td>
                    <td>{planLabel(tenant.planCode)}</td>
                    <td>
                      <span className={tenant.lockedAt ? "badge badgeLocked" : tenant.subscriptionStatus === "TRIAL" ? "badge badgeTrial" : "badge"}>
                        {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}
                      </span>
                    </td>
                    <td>{tenant.brands.length}</td>
                    <td>{tenant.emailAccounts.length}</td>
                    <td>
                      <Link className="btn" to="/gastario-control/mandanten">
                        Verwalten
                      </Link>
                    </td>
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
