import { Link, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

const PACKAGES = [
  {
    code: "STARTER",
    name: "Starter",
    price: "59 €",
    description: "Fuer kleine Caterer, die Auftraege und Kunden sauber verwalten wollen.",
    limits: ["1 Marke", "1 Import-E-Mail", "1 Benutzer"],
    modules: ["Auftraege", "Kunden", "Produkte", "Packlisten", "Lieferscheine"],
    target: "Kleine Caterer / Startphase",
  },
  {
    code: "PROFESSIONAL",
    name: "Professional",
    price: "179 €",
    description: "Fuer wachsende Caterer mit mehreren Marken, E-Mail-Eingang und operativer Planung.",
    limits: ["bis 3 Marken", "bis 3 Import-E-Mails", "bis 5 Benutzer"],
    modules: [
      "Auftragseingang",
      "Angebote",
      "Produktion",
      "PDF-Erkennung",
      "E-Mail-Automatik",
      "Einkauf",
      "Lager",
      "Lieferanten",
      "Rezepte",
      "Auswertungen",
    ],
    target: "Wachsende Catering-Betriebe",
  },
  {
    code: "PREMIUM",
    name: "Premium",
    price: "299 €",
    description: "Fuer groessere Caterer mit mehreren Marken, Integrationen und erweiterten Workflows.",
    limits: ["unbegrenzte Marken", "unbegrenzte Import-E-Mails", "unbegrenzte Benutzer"],
    modules: [
      "alle Module",
      "Fahreransicht",
      "Integrationen",
      "Produkt-Mapping",
      "Lexware / DATEV / API spaeter",
      "priorisierter Support",
    ],
    target: "Groessere Caterer / SaaS-Premium",
  },
];

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const [total, starter, professional, premium, trial, active, locked] = await Promise.all([
    prisma.tenant.count().catch(() => 0),
    prisma.tenant.count({ where: { planCode: "STARTER" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { planCode: "PROFESSIONAL" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { planCode: "PREMIUM" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { subscriptionStatus: "TRIAL" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { subscriptionStatus: "ACTIVE" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { lockedAt: { not: null } } }).catch(() => 0),
  ]);

  return {
    total,
    packageCounts: {
      STARTER: starter,
      PROFESSIONAL: professional,
      PREMIUM: premium,
    },
    statusCounts: {
      trial,
      active,
      locked,
    },
  };
}

export default function PaketePage() {
  const data = useLoaderData<typeof loader>();

  return (
    <SuperAdminLayout>
      <style>{`
        .packageGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          margin-top: 24px;
        }

        .packageCard {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-height: 100%;
        }

        .packageTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        .packageCode {
          color: #007f6d;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .12em;
          margin-bottom: 7px;
        }

        .packageName {
          margin: 0;
          color: #07111f;
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.05em;
        }

        .packageCount {
          min-width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #ecfdf5;
          color: #047857;
          font-size: 24px;
          font-weight: 950;
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, .18);
        }

        .packagePrice {
          font-size: 38px;
          font-weight: 950;
          letter-spacing: -0.06em;
          color: #07111f;
        }

        .packageMonth {
          color: #64748b;
          font-size: 14px;
          font-weight: 900;
          margin-left: 4px;
        }

        .packageDescription {
          color: #64748b;
          font-size: 15px;
          line-height: 1.5;
          font-weight: 800;
          margin: 0;
        }

        .packageBox {
          border: 1px solid rgba(148, 163, 184, .28);
          border-radius: 20px;
          padding: 16px;
          background: #ffffff;
        }

        .packageBoxTitle {
          margin: 0 0 10px;
          font-size: 15px;
          font-weight: 950;
          color: #07111f;
        }

        .packageList {
          margin: 0;
          padding-left: 18px;
          color: #0f172a;
          font-weight: 750;
          line-height: 1.7;
        }

        .packageModules {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .packageModule {
          display: inline-flex;
          border-radius: 999px;
          padding: 7px 10px;
          background: #dcfce7;
          color: #047857;
          font-size: 12px;
          font-weight: 950;
        }

        .packageTarget {
          margin-top: auto;
          padding: 13px 14px;
          border-radius: 18px;
          background: #f8fafc;
          color: #475569;
          font-size: 13px;
          font-weight: 850;
          border: 1px solid rgba(148, 163, 184, .22);
        }

        .packageCompareGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }

        .packageCompareCard {
          border: 1px solid rgba(148, 163, 184, .24);
          border-radius: 22px;
          padding: 18px;
          background: #ffffff;
        }

        .packageCompareLabel {
          color: #007f6d;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .packageCompareValue {
          margin-top: 8px;
          font-size: 30px;
          color: #07111f;
          font-weight: 950;
          letter-spacing: -0.05em;
        }

        .packageCompareHint {
          margin-top: 4px;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        @media (max-width: 1150px) {
          .packageGrid,
          .packageCompareGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Pakete</h1>
          <p className="pageSubtitle">
            Verwalte die Paketlogik fuer Gastario. Pakete werden nicht oeffentlich ausgewaehlt, sondern pro Mandant im Super Admin gesetzt.
          </p>
        </div>

        <div className="topActions">
          <Link className="btn btnPrimary" to="/gastario-control/mandanten">
            Mandanten verwalten
          </Link>
          <Link className="btn" to="/gastario-control/features">
            Features ansehen
          </Link>
        </div>
      </header>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{data.total}</div>
          <div className="statHint">gesamt im System</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aktiv</div>
          <div className="statValue">{data.statusCounts.active}</div>
          <div className="statHint">zahlende Kunden</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Testphase</div>
          <div className="statValue">{data.statusCounts.trial}</div>
          <div className="statHint">Trials</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Gesperrt</div>
          <div className="statValue">{data.statusCounts.locked}</div>
          <div className="statHint">mit Sperre</div>
        </article>
      </section>

      <section className="packageGrid">
        {PACKAGES.map((item) => (
          <article className="packageCard" key={item.code}>
            <div className="packageTop">
              <div>
                <div className="packageCode">{item.code}</div>
                <h2 className="packageName">{item.name}</h2>
              </div>

              <div className="packageCount" title="Mandanten in diesem Paket">
                {data.packageCounts[item.code as keyof typeof data.packageCounts] || 0}
              </div>
            </div>

            <div>
              <span className="packagePrice">{item.price}</span>
              <span className="packageMonth">/ Monat</span>
            </div>

            <p className="packageDescription">{item.description}</p>

            <div className="packageBox">
              <h3 className="packageBoxTitle">Limits</h3>
              <ul className="packageList">
                {item.limits.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="packageBoxTitle">Enthaltene Module</h3>
              <div className="packageModules">
                {item.modules.map((module) => (
                  <span className="packageModule" key={module}>
                    {module}
                  </span>
                ))}
              </div>
            </div>

            <div className="packageTarget">
              Zielgruppe: {item.target}
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Kontrolle</div>
            <h2 className="panelTitle">Paket-Verteilung</h2>
          </div>
        </div>

        <div className="packageCompareGrid">
          {PACKAGES.map((item) => {
            const count = data.packageCounts[item.code as keyof typeof data.packageCounts] || 0;
            const percent = data.total > 0 ? Math.round((count / data.total) * 100) : 0;

            return (
              <article className="packageCompareCard" key={item.code}>
                <div className="packageCompareLabel">{item.name}</div>
                <div className="packageCompareValue">{count}</div>
                <div className="packageCompareHint">{percent}% aller Mandanten</div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Hinweis</div>
            <h2 className="panelTitle">Pakete werden nicht oeffentlich ausgewaehlt</h2>
          </div>
        </div>

        <p className="pageSubtitle">
          Neue Caterer registrieren sich nur mit Einladungscode. Das Paket wird danach durch den Super Admin beim Mandanten gesetzt.
          So bleibt Gastario kontrolliert, mandantenfaehig und spaeter sauber als SaaS verkaufbar.
        </p>
      </section>
    </SuperAdminLayout>
  );
}
