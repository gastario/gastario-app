import { Link, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

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
      enabledFeatures: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return { tenants };
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

export default function MandantenPage() {
  const { tenants } = useLoaderData<typeof loader>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Mandanten</h1>
          <p className="pageSubtitle">
            Uebersicht aller Caterer, Pakete, Limits, Marken, E-Mail-Konten und Benutzer.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn btnPrimary" to="/gastario-control/codes">
            Neuen Zugangscode erstellen
          </Link>
        </div>
      </header>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{tenants.length}</div>
          <div className="statHint">gesamt</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Testphasen</div>
          <div className="statValue">
            {tenants.filter((tenant) => tenant.subscriptionStatus === "TRIAL").length}
          </div>
          <div className="statHint">aktuell</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aktiv</div>
          <div className="statValue">
            {tenants.filter((tenant) => tenant.subscriptionStatus === "ACTIVE").length}
          </div>
          <div className="statHint">zahlende Kunden</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Gesperrt</div>
          <div className="statValue">
            {tenants.filter((tenant) => tenant.lockedAt).length}
          </div>
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

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Firma</th>
                <th>Paket</th>
                <th>Status</th>
                <th>Marken</th>
                <th>E-Mails</th>
                <th>Benutzer</th>
                <th>Auftraege</th>
                <th>Module</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={8}>Noch keine Mandanten vorhanden.</td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <div className="tenantName">{tenant.name}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                        ID: {tenant.id}
                      </div>
                    </td>
                    <td>{planLabel(tenant.planCode)}</td>
                    <td>
                      <span
                        className={
                          tenant.lockedAt
                            ? "badge badgeLocked"
                            : tenant.subscriptionStatus === "TRIAL"
                              ? "badge badgeTrial"
                              : "badge"
                        }
                      >
                        {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}
                      </span>
                    </td>
                    <td>
                      {tenant.brands.length === 0
                        ? "-"
                        : tenant.brands.map((brand) => brand.name).join(", ")}
                    </td>
                    <td>
                      {tenant.emailAccounts.length === 0
                        ? "-"
                        : tenant.emailAccounts.map((account) => account.email).join(", ")}
                    </td>
                    <td>
                      {tenant.users.length === 0
                        ? "-"
                        : tenant.users.map((item) => item.user.email).join(", ")}
                    </td>
                    <td>{tenant.orders.length}</td>
                    <td>{tenant.enabledFeatures.filter((item) => item.enabled).length}</td>
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
