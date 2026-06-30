
import { Link, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const tenantCount = await prisma.tenant.count().catch(() => 0);
  const orderCount = await prisma.order.count().catch(() => 0);
  const userCount = await prisma.user.count().catch(() => 0);
  const inviteCount = await prisma.registrationInvite.count().catch(() => 0);

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  }).catch(() => []);

  return { tenantCount, orderCount, userCount, inviteCount, tenants };
}

export default function GastarioControl() {
  const data = useLoaderData<typeof loader>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Control Center</h1>
          <p className="pageSubtitle">
            Zentrale Übersicht für Mandanten, Pakete, Module und Registrierungscodes.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn" to="/gastario-control/codes">Codes öffnen</Link>
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">Mandanten verwalten</Link>
        </div>
      </header>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{data.tenantCount}</div>
          <div className="statHint">gesamt</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aufträge</div>
          <div className="statValue">{data.orderCount}</div>
          <div className="statHint">im System</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Benutzer</div>
          <div className="statValue">{data.userCount}</div>
          <div className="statHint">registriert</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Codes</div>
          <div className="statValue">{data.inviteCount}</div>
          <div className="statHint">Einladungen</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Mandanten</div>
            <h2 className="panelTitle">Neueste Mandanten</h2>
          </div>
          <Link className="btn" to="/gastario-control/mandanten">Alle anzeigen</Link>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Firma</th>
                <th>Paket</th>
                <th>Status</th>
                <th>Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.length === 0 ? (
                <tr>
                  <td colSpan={4}>Noch keine Mandanten vorhanden.</td>
                </tr>
              ) : (
                data.tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="tenantName">
                      <Link to={"/gastario-control/mandanten/" + tenant.id} style={{ color: "inherit", textDecoration: "none" }}>
                        {tenant.name}
                      </Link>
                    </td>
                    <td>{tenant.planCode}</td>
                    <td>{tenant.lockedAt ? "Gesperrt" : tenant.subscriptionStatus}</td>
                    <td>{new Date(tenant.createdAt).toLocaleDateString("de-DE")}</td>
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
