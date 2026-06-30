import { Link, useLocation } from "react-router";

const navItems = [
  {
    label: "Übersicht",
    to: "/gastario-control",
    hint: "Dashboard",
  },
  {
    label: "Mandanten",
    to: "/gastario-control/mandanten",
    hint: "Kunden & Firmen",
  },
  {
    label: "Pakete",
    to: "/gastario-control/pakete",
    hint: "Starter bis Premium",
  },
  {
    label: "Features",
    to: "/gastario-control/features",
    hint: "Module & Rechte",
  },
  {
    label: "Registrierungscodes",
    to: "/gastario-control/codes",
    hint: "Einladungen",
  },
];

function isActivePath(pathname: string, to: string) {
  if (to === "/gastario-control") {
    return pathname === to;
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="superAdminShell">
      <style>{`
        :root {
          --gastario-dark: #07111f;
          --gastario-darker: #030712;
          --gastario-green: #009b83;
          --gastario-green-2: #17c3a6;
          --gastario-text: #0f172a;
          --gastario-muted: #64748b;
          --gastario-line: rgba(148, 163, 184, .24);
          --gastario-card: rgba(255, 255, 255, .88);
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background:
            radial-gradient(circle at top right, rgba(23, 195, 166, .22), transparent 34%),
            radial-gradient(circle at 30% 10%, rgba(14, 165, 233, .12), transparent 32%),
            linear-gradient(135deg, #f8fafc 0%, #eef5f5 55%, #e8eef3 100%);
          color: var(--gastario-text);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .superAdminShell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 292px minmax(0, 1fr);
        }

        .superAdminSidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          padding: 28px 18px;
          background:
            radial-gradient(circle at 20% 0%, rgba(23, 195, 166, .24), transparent 28%),
            linear-gradient(180deg, #06202a 0%, #07111f 44%, #030712 100%);
          color: white;
          border-right: 1px solid rgba(255, 255, 255, .08);
          overflow-y: auto;
        }

        .superAdminBrand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 14px;
          border-radius: 18px;
          background: rgba(15, 23, 42, .62);
          border: 1px solid rgba(255, 255, 255, .08);
          box-shadow: 0 18px 50px rgba(0, 0, 0, .22);
          text-decoration: none;
          color: white;
        }

        .superAdminLogo {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, var(--gastario-green), var(--gastario-green-2));
          color: white;
          font-weight: 950;
          box-shadow: 0 12px 26px rgba(23, 195, 166, .26);
        }

        .superAdminBrandText {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .superAdminBrandName {
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .superAdminBrandSub {
          font-size: 11px;
          font-weight: 850;
          color: rgba(226, 232, 240, .64);
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .superAdminDivider {
          height: 1px;
          background: rgba(255, 255, 255, .1);
          margin: 24px 4px;
        }

        .superAdminNav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .superAdminNavItem {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 58px;
          padding: 12px 13px;
          border-radius: 17px;
          color: rgba(241, 245, 249, .82);
          text-decoration: none;
          border: 1px solid transparent;
          transition:
            background .16s ease,
            color .16s ease,
            border-color .16s ease,
            transform .16s ease,
            box-shadow .16s ease;
        }

        .superAdminNavItem:hover {
          background: rgba(255, 255, 255, .07);
          border-color: rgba(255, 255, 255, .08);
          color: white;
          transform: translateX(2px);
        }

        .superAdminNavItemActive {
          background: linear-gradient(135deg, rgba(0, 155, 131, .94), rgba(23, 195, 166, .86));
          color: white;
          box-shadow: 0 18px 45px rgba(0, 155, 131, .24);
        }

        .superAdminNavItemActive::before {
          content: "";
          position: absolute;
          left: -18px;
          top: 14px;
          bottom: 14px;
          width: 4px;
          border-radius: 999px;
          background: var(--gastario-green-2);
          box-shadow: 0 0 18px rgba(23, 195, 166, .8);
        }

        .superAdminNavText {
          min-width: 0;
        }

        .superAdminNavLabel {
          display: block;
          font-size: 14px;
          font-weight: 950;
          line-height: 1.15;
        }

        .superAdminNavHint {
          display: block;
          margin-top: 5px;
          font-size: 11px;
          font-weight: 800;
          color: rgba(226, 232, 240, .58);
          line-height: 1.15;
        }

        .superAdminNavItemActive .superAdminNavHint {
          color: rgba(255, 255, 255, .78);
        }

        .superAdminNavArrow {
          flex: 0 0 auto;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, .08);
          color: rgba(255, 255, 255, .76);
          font-size: 16px;
          font-weight: 950;
        }

        .superAdminSidebarCard {
          margin-top: 24px;
          padding: 18px;
          border-radius: 22px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, .10), rgba(255, 255, 255, .055));
          border: 1px solid rgba(255, 255, 255, .12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
        }

        .superAdminSidebarCardTitle {
          margin: 0 0 8px;
          font-size: 15px;
          font-weight: 950;
          color: white;
        }

        .superAdminSidebarCardText {
          margin: 0;
          color: rgba(226, 232, 240, .78);
          font-size: 12px;
          line-height: 1.55;
          font-weight: 750;
        }

        .superAdminMain {
          min-width: 0;
          padding: 36px 34px 64px;
        }

        .superAdminContent {
          width: 100%;
          max-width: 1540px;
          margin: 0 auto;
        }

        .topbar,
        .panelHeader {
          display: flex;
          justify-content: space-between;
          gap: 22px;
          align-items: flex-start;
        }

        .topbar {
          margin-bottom: 26px;
        }

        .kicker,
        .panelKicker {
          color: #007f6d;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .14em;
          margin-bottom: 8px;
        }

        .pageTitle {
          margin: 0 0 10px;
          font-size: 46px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.06em;
          color: #07111f;
        }

        .pageSubtitle {
          margin: 0;
          color: #64748b;
          font-size: 16px;
          line-height: 1.55;
          font-weight: 750;
          max-width: 860px;
        }

        .topActions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: 0;
          border-radius: 999px;
          padding: 12px 16px;
          background: white;
          color: #0f172a;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, .12);
          transition: transform .15s ease, box-shadow .15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
        }

        .btn:hover {
          transform: translateY(-1px);
          box-shadow:
            0 16px 34px rgba(15, 23, 42, .12),
            inset 0 0 0 1px rgba(15, 23, 42, .12);
        }

        .btnPrimary {
          background: linear-gradient(135deg, #008f7a, #17b79f);
          color: white;
          box-shadow: 0 18px 40px rgba(0, 143, 122, .25);
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .statCard,
        .panel,
        .packageCard {
          background: rgba(255, 255, 255, .9);
          border: 1px solid rgba(148, 163, 184, .24);
          border-radius: 28px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .10);
        }

        .statCard {
          padding: 20px;
        }

        .statLabel {
          color: #007f6d;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .1em;
        }

        .statValue {
          font-size: 34px;
          font-weight: 950;
          letter-spacing: -0.05em;
          color: #07111f;
          margin-top: 8px;
        }

        .statHint {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
          margin-top: 4px;
        }

        .panel {
          padding: 22px;
          margin-top: 18px;
        }

        .panelTitle {
          margin: 4px 0 0;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #07111f;
        }

        .tableWrap {
          margin-top: 18px;
          overflow-x: auto;
          border-radius: 20px;
          border: 1px solid rgba(148, 163, 184, .24);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }

        th {
          text-align: left;
          padding: 15px 16px;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .08em;
          border-bottom: 1px solid rgba(148, 163, 184, .22);
        }

        td {
          padding: 16px;
          color: #0f172a;
          font-size: 14px;
          font-weight: 750;
          border-bottom: 1px solid rgba(148, 163, 184, .16);
          vertical-align: middle;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 7px 10px;
          background: #dcfce7;
          color: #047857;
          font-size: 12px;
          font-weight: 950;
          white-space: nowrap;
        }

        .badgeLocked {
          background: #fee2e2;
          color: #b91c1c;
        }

        @media (max-width: 1180px) {
          .superAdminShell {
            grid-template-columns: 250px minmax(0, 1fr);
          }

          .statGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .superAdminShell {
            grid-template-columns: 1fr;
          }

          .superAdminSidebar {
            position: relative;
            height: auto;
            padding: 16px;
          }

          .superAdminNav {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .superAdminMain {
            padding: 24px 16px 48px;
          }

          .topbar,
          .panelHeader {
            flex-direction: column;
          }

          .pageTitle {
            font-size: 36px;
          }
        }        @media (max-width: 560px) {
          .superAdminNav,
          .statGrid {
            grid-template-columns: 1fr;
          }
        }

        .superAdminLogout {
          display: block;
          margin-top: 18px;
          padding: 13px 16px;
          border-radius: 16px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.22);
          color: #fecaca;
          font-weight: 950;
          text-decoration: none;
          text-align: center;
        }

        .superAdminLogout:hover {
          background: rgba(239, 68, 68, 0.20);
          color: white;
        }      `}</style>

      <aside className="superAdminSidebar">
        <Link to="/gastario-control" className="superAdminBrand">
          <div className="superAdminLogo">G</div>
          <div className="superAdminBrandText">
            <div className="superAdminBrandName">Gastario</div>
            <div className="superAdminBrandSub">Control Center</div>
          </div>
        </Link>

        <div className="superAdminDivider" />

        <nav className="superAdminNav">
          {navItems.map((item) => {
            const active = isActivePath(location.pathname, item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={active ? "superAdminNavItem superAdminNavItemActive" : "superAdminNavItem"}
              >
                <span className="superAdminNavText">
                  <span className="superAdminNavLabel">{item.label}</span>
                  <span className="superAdminNavHint">{item.hint}</span>
                </span>
                <span className="superAdminNavArrow">›</span>
              </Link>
            );
          })}
                </nav>

        <a href="/logout" className="superAdminLogout">
          Ausloggen
        </a>

        <div className="superAdminSidebarCard">
          <h3 className="superAdminSidebarCardTitle">Super Admin</h3>
          <p className="superAdminSidebarCardText">
            Mandanten, Pakete, Limits, Features und Registrierungscodes zentral verwalten.
          </p>
        </div>
      </aside>

      <main className="superAdminMain">
        <div className="superAdminContent">{children}</div>
      </main>
    </div>
  );
}



