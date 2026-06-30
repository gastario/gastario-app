import { Link, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const [
    tenantCount,
    activeTenants,
    trialTenants,
    lockedTenants,
    starterTenants,
    professionalTenants,
    premiumTenants,
    openCodes,
    usedCodes,
    latestTenants,
  ] = await Promise.all([
    prisma.tenant.count().catch(() => 0),
    prisma.tenant.count({ where: { subscriptionStatus: "ACTIVE" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { subscriptionStatus: "TRIAL" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { lockedAt: { not: null } } }).catch(() => 0),
    prisma.tenant.count({ where: { planCode: "STARTER" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { planCode: "PROFESSIONAL" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { planCode: "PREMIUM" as any } }).catch(() => 0),
    prisma.registrationInvite.count({ where: { usedAt: null } }).catch(() => 0),
    prisma.registrationInvite.count({ where: { usedAt: { not: null } } }).catch(() => 0),
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        _count: {
          select: {
            users: true,
            brands: true,
            emailAccounts: true,
            orders: true,
          },
        },
      },
    }).catch(() => []),
  ]);

  return {
    tenantCount,
    activeTenants,
    trialTenants,
    lockedTenants,
    starterTenants,
    professionalTenants,
    premiumTenants,
    openCodes,
    usedCodes,
    latestTenants,
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

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

export default function GastarioControlPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <SuperAdminLayout>
      <style>{`
        .dashboardHero {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(340px, .65fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        .dashboardHeroCard {
          border-radius: 32px;
          padding: 30px;
          background:
            radial-gradient(circle at top right, rgba(23, 195, 166, .25), transparent 36%),
            linear-gradient(135deg, rgba(255,255,255,.94), rgba(255,255,255,.82));
          border: 1px solid rgba(148, 163, 184, .24);
          box-shadow: 0 28px 80px rgba(15, 23, 42, .12);
        }

        .dashboardHeroTitle {
          margin: 0;
          font-size: 46px;
          line-height: .98;
          letter-spacing: -0.06em;
          font-weight: 950;
          color: #07111f;
        }

        .dashboardHeroText {
          margin: 14px 0 0;
          max-width: 760px;
          color: #64748b;
          font-size: 16px;
          line-height: 1.6;
          font-weight: 780;
        }

        .dashboardActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .dashboardSideCard {
          border-radius: 32px;
          padding: 24px;
          background:
            linear-gradient(180deg, #07111f, #030712);
          color: white;
          box-shadow: 0 28px 80px rgba(15, 23, 42, .22);
          border: 1px solid rgba(255,255,255,.1);
        }

        .dashboardSideKicker {
          font-size: 12px;
          font-weight: 950;
          color: #5eead4;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .dashboardSideValue {
          margin-top: 12px;
          font-size: 44px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .dashboardSideText {
          margin-top: 10px;
          color: rgba(226,232,240,.78);
          font-size: 14px;
          font-weight: 750;
          line-height: 1.55;
        }

        .quickGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }

        .quickCard {
          display: block;
          text-decoration: none;
          color: inherit;
          border-radius: 24px;
          padding: 20px;
          background: #ffffff;
          border: 1px solid rgba(148, 163, 184, .24);
          box-shadow: 0 18px 46px rgba(15, 23, 42, .08);
          transition: transform .15s ease, box-shadow .15s ease;
        }

        .quickCard:hover {
          transform: translateY(-2px);
          box-shadow: 0 24px 60px rgba(15, 23, 42, .12);
        }

        .quickIcon {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #ecfdf5;
          color: #047857;
          font-weight: 950;
          margin-bottom: 14px;
        }

        .quickTitle {
          font-size: 17px;
          font-weight: 950;
          color: #07111f;
          letter-spacing: -0.03em;
        }

        .quickText {
          margin-top: 6px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 780;
        }

        .dashboardSplit {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 20px;
          align-items: start;
          margin-top: 20px;
        }

        .packageMiniGrid {
          display: grid;
          gap: 12px;
        }

        .packageMini {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(148, 163, 184, .24);
          border-radius: 18px;
          padding: 15px;
          background: #ffffff;
        }

        .packageMiniName {
          font-weight: 950;
          color: #07111f;
        }

        .packageMiniHint {
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .packageMiniValue {
          font-size: 28px;
          font-weight: 950;
          color: #047857;
        }

        .tenantNameLink {
          color: #07111f;
          font-weight: 950;
          text-decoration: none;
        }

        .tenantNameLink:hover {
          color: #047857;
        }

        @media (max-width: 1150px) {
          .dashboardHero,
          .dashboardSplit {
            grid-template-columns: 1fr;
          }

          .quickGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .quickGrid {
            grid-template-columns: 1fr;
          }

          .dashboardHeroTitle {
            font-size: 34px;
          }
        }
      `}</style>

      <section className="dashboardHero">
        <article className="dashboardHeroCard">
          <div className="kicker">Super Admin</div>
          <h1 className="dashboardHeroTitle">Gastario Control Center</h1>
          <p className="dashboardHeroText">
            Zentrale Verwaltung fuer Mandanten, Pakete, Features und Registrierungscodes.
            Hier steuerst du, welcher Caterer welche Module, Limits und Zugriffe bekommt.
          </p>

          <div className="dashboardActions">
            <Link className="btn btnPrimary" to="/gastario-control/mandanten">
              Mandanten verwalten
            </Link>
            <Link className="btn" to="/gastario-control/codes">
              Registrierungscodes
            </Link>
            <Link className="btn" to="/gastario-control/pakete">
              Pakete ansehen
            </Link>
          </div>
        </article>

        <article className="dashboardSideCard">
          <div className="dashboardSideKicker">SaaS-System</div>
          <div className="dashboardSideValue">{data.tenantCount}</div>
          <div className="dashboardSideText">
            Mandanten sind aktuell im System angelegt. Davon sind {data.activeTenants} aktiv,
            {data.trialTenants} in Testphase und {data.lockedTenants} gesperrt.
          </div>
        </article>
      </section>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{data.tenantCount}</div>
          <div className="statHint">gesamt</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aktiv</div>
          <div className="statValue">{data.activeTenants}</div>
          <div className="statHint">zahlende Kunden</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Testphase</div>
          <div className="statValue">{data.trialTenants}</div>
          <div className="statHint">Trials</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Offene Codes</div>
          <div className="statValue">{data.openCodes}</div>
          <div className="statHint">{data.usedCodes} benutzt/deaktiviert</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Schnellaktionen</div>
            <h2 className="panelTitle">Was moechtest du verwalten?</h2>
          </div>
        </div>

        <div className="quickGrid">
          <Link className="quickCard" to="/gastario-control/mandanten">
            <div className="quickIcon">M</div>
            <div className="quickTitle">Mandanten</div>
            <div className="quickText">Caterer anlegen, Pakete setzen, sperren und Module freischalten.</div>
          </Link>

          <Link className="quickCard" to="/gastario-control/codes">
            <div className="quickIcon">C</div>
            <div className="quickTitle">Codes</div>
            <div className="quickText">Einladungscodes erstellen, deaktivieren, wieder oeffnen oder loeschen.</div>
          </Link>

          <Link className="quickCard" to="/gastario-control/pakete">
            <div className="quickIcon">P</div>
            <div className="quickTitle">Pakete</div>
            <div className="quickText">Starter, Professional und Premium mit Limits und Modulen pruefen.</div>
          </Link>

          <Link className="quickCard" to="/gastario-control/features">
            <div className="quickIcon">F</div>
            <div className="quickTitle">Features</div>
            <div className="quickText">Alle Modul-Codes, Paketlogik und Aktivierungen kontrollieren.</div>
          </Link>
        </div>
      </section>

      <section className="dashboardSplit">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Mandanten</div>
              <h2 className="panelTitle">Neueste Mandanten</h2>
            </div>

            <Link className="btn" to="/gastario-control/mandanten">
              Alle anzeigen
            </Link>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Paket</th>
                  <th>Status</th>
                  <th>Benutzer</th>
                  <th>Marken</th>
                  <th>Import</th>
                  <th>Auftraege</th>
                  <th>Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {data.latestTenants.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Noch keine Mandanten vorhanden.</td>
                  </tr>
                ) : (
                  data.latestTenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>
                        <Link className="tenantNameLink" to={"/gastario-control/mandanten/" + tenant.id}>
                          {tenant.name}
                        </Link>
                      </td>
                      <td>{planLabel(tenant.planCode)}</td>
                      <td>
                        <span className={tenant.lockedAt ? "badge badgeLocked" : "badge"}>
                          {statusLabel(tenant.subscriptionStatus, tenant.lockedAt)}
                        </span>
                      </td>
                      <td>{tenant._count.users}</td>
                      <td>{tenant._count.brands}</td>
                      <td>{tenant._count.emailAccounts}</td>
                      <td>{tenant._count.orders}</td>
                      <td>{formatDate(tenant.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">Pakete</div>
              <h2 className="panelTitle">Verteilung</h2>
            </div>
          </div>

          <div className="packageMiniGrid">
            <div className="packageMini">
              <div>
                <div className="packageMiniName">Starter</div>
                <div className="packageMiniHint">kleine Caterer</div>
              </div>
              <div className="packageMiniValue">{data.starterTenants}</div>
            </div>

            <div className="packageMini">
              <div>
                <div className="packageMiniName">Professional</div>
                <div className="packageMiniHint">wachsende Betriebe</div>
              </div>
              <div className="packageMiniValue">{data.professionalTenants}</div>
            </div>

            <div className="packageMini">
              <div>
                <div className="packageMiniName">Premium</div>
                <div className="packageMiniHint">groessere Caterer</div>
              </div>
              <div className="packageMiniValue">{data.premiumTenants}</div>
            </div>
          </div>
        </aside>
      </section>
    </SuperAdminLayout>
  );
}
