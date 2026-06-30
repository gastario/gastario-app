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

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const [tenantCount, activeTenants, lockedTenants, enabledFeatures, featureRows] = await Promise.all([
    prisma.tenant.count().catch(() => 0),
    prisma.tenant.count({ where: { subscriptionStatus: "ACTIVE" as any } }).catch(() => 0),
    prisma.tenant.count({ where: { lockedAt: { not: null } } }).catch(() => 0),
    prisma.tenantFeature.count({ where: { enabled: true } }).catch(() => 0),
    prisma.tenantFeature.findMany({
      where: { enabled: true },
      select: {
        feature: true,
        tenantId: true,
      },
    }).catch(() => []),
  ]);

  const usageByFeature = FEATURES.reduce<Record<string, number>>((acc, feature) => {
    acc[feature.code] = 0;
    return acc;
  }, {});

  for (const row of featureRows) {
    const code = String(row.feature);
    usageByFeature[code] = (usageByFeature[code] || 0) + 1;
  }

  return {
    tenantCount,
    activeTenants,
    lockedTenants,
    enabledFeatures,
    usageByFeature,
  };
}

function yesNo(enabled: boolean) {
  return enabled ? "Ja" : "-";
}

function packageLabel(code: string) {
  const starter = STARTER_FEATURES.includes(code);
  const professional = PROFESSIONAL_FEATURES.includes(code);
  const premium = PREMIUM_FEATURES.includes(code);

  if (starter && professional && premium) return "Alle Pakete";
  if (!starter && professional && premium) return "Professional + Premium";
  if (!starter && !professional && premium) return "Nur Premium";
  return "Individuell";
}

export default function FeaturesPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <SuperAdminLayout>
      <style>{`
        .featureBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 7px 10px;
          background: #ecfdf5;
          color: #047857;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }

        .featureBadgeMuted {
          background: #f1f5f9;
          color: #64748b;
        }

        .featureCode {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-weight: 950;
          color: #0f766e;
          white-space: nowrap;
        }

        .featureGroupGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .featureGroupCard {
          border: 1px solid rgba(148, 163, 184, .24);
          border-radius: 20px;
          background: #ffffff;
          padding: 16px;
        }

        .featureGroupTitle {
          font-size: 13px;
          font-weight: 950;
          color: #007f6d;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 8px;
        }

        .featureGroupCount {
          font-size: 30px;
          font-weight: 950;
          letter-spacing: -0.05em;
          color: #07111f;
        }

        .featureGroupHint {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 800;
          color: #64748b;
        }

        @media (max-width: 1100px) {
          .featureGroupGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .featureGroupGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Features</h1>
          <p className="pageSubtitle">
            Kontrolliere alle SaaS-Module, Paket-Zuordnungen und wie oft einzelne Module bei Mandanten aktiviert sind.
          </p>
        </div>
      </header>

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Module</div>
          <div className="statValue">{FEATURES.length}</div>
          <div className="statHint">verfuegbare Features</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Mandanten</div>
          <div className="statValue">{data.tenantCount}</div>
          <div className="statHint">gesamt im System</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aktivierte Module</div>
          <div className="statValue">{data.enabledFeatures}</div>
          <div className="statHint">ueber alle Mandanten</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Aktive Kunden</div>
          <div className="statValue">{data.activeTenants}</div>
          <div className="statHint">{data.lockedTenants} gesperrt</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Pakete</div>
            <h2 className="panelTitle">Paket-Vergleich</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Modul</th>
                <th>Gruppe</th>
                <th>Starter</th>
                <th>Professional</th>
                <th>Premium</th>
                <th>Paketlogik</th>
                <th>Aktiv bei Mandanten</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feature) => {
                const code = feature.code;
                const usage = data.usageByFeature[code] || 0;

                return (
                  <tr key={code}>
                    <td className="featureCode">{code}</td>
                    <td className="tenantName">{feature.label}</td>
                    <td>{feature.group}</td>
                    <td>
                      <span className={STARTER_FEATURES.includes(code) ? "featureBadge" : "featureBadge featureBadgeMuted"}>
                        {yesNo(STARTER_FEATURES.includes(code))}
                      </span>
                    </td>
                    <td>
                      <span className={PROFESSIONAL_FEATURES.includes(code) ? "featureBadge" : "featureBadge featureBadgeMuted"}>
                        {yesNo(PROFESSIONAL_FEATURES.includes(code))}
                      </span>
                    </td>
                    <td>
                      <span className={PREMIUM_FEATURES.includes(code) ? "featureBadge" : "featureBadge featureBadgeMuted"}>
                        {yesNo(PREMIUM_FEATURES.includes(code))}
                      </span>
                    </td>
                    <td>{packageLabel(code)}</td>
                    <td>
                      <span className="featureBadge">{usage}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Gruppen</div>
            <h2 className="panelTitle">Module nach Bereich</h2>
          </div>
        </div>

        <div className="featureGroupGrid">
          {["Basis", "Betrieb", "Automatisierung", "Warenwirtschaft", "Auswertung", "Premium"].map((group) => {
            const items = FEATURES.filter((feature) => feature.group === group);

            return (
              <article className="featureGroupCard" key={group}>
                <div className="featureGroupTitle">{group}</div>
                <div className="featureGroupCount">{items.length}</div>
                <div className="featureGroupHint">
                  {items.map((item) => item.label).join(", ")}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </SuperAdminLayout>
  );
}
