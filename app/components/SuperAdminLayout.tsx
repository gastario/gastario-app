import { Link, NavLink } from "react-router";

const navItems = [
  { label: "Übersicht", to: "/gastario-control" },
  { label: "Mandanten", to: "/gastario-control/mandanten" },
  { label: "Pakete", to: "/gastario-control/pakete" },
  { label: "Features", to: "/gastario-control/features" },
  { label: "Registrierungscodes", to: "/gastario-control/codes" },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="superAdminShell">
      <style>{`
        body {
          margin: 0;
          background: #eef3f7;
          color: #0f172a;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .superAdminShell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px 1fr;
          background: linear-gradient(180deg, #f8fbfd 0%, #eef3f7 100%);
        }

        .sidebar {
          background: #0f172a;
          color: white;
          padding: 24px 20px;
          min-height: 100vh;
        }

        .logoWrap {
          display: block;
          margin-bottom: 28px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(255,255,255,.12);
        }

        .logo {
          width: 170px;
          height: auto;
          display: block;
        }

        .nav {
          display: grid;
          gap: 8px;
        }

        .nav a {
          color: #cbd5e1;
          text-decoration: none;
          padding: 13px 14px;
          border-radius: 14px;
          font-weight: 850;
          display: flex;
          justify-content: space-between;
        }

        .nav a:hover {
          background: rgba(255,255,255,.08);
          color: white;
        }

        .nav a.active {
          background: #0f766e;
          color: white;
        }

        .sideCard {
          margin-top: 28px;
          border-radius: 18px;
          padding: 16px;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.10);
        }

        .sideCard strong {
          display: block;
          margin-bottom: 8px;
        }

        .sideCard p {
          margin: 0;
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.45;
        }

        .main {
          padding: 32px;
          min-width: 0;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-start;
          margin-bottom: 22px;
        }

        .kicker {
          color: #0f766e;
          text-transform: uppercase;
          letter-spacing: .08em;
          font-size: 12px;
          font-weight: 950;
          margin-bottom: 6px;
        }

        .pageTitle {
          margin: 0;
          font-size: 38px;
          letter-spacing: -0.055em;
          line-height: 1;
        }

        .pageSubtitle {
          color: #64748b;
          margin: 9px 0 0;
          font-weight: 650;
        }

        .topActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: 1px solid #dbe5ee;
          background: white;
          color: #0f172a;
          border-radius: 999px;
          padding: 12px 16px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .btnPrimary {
          background: #0f766e;
          border-color: #0f766e;
          color: white;
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }

        .statCard,
        .panel {
          background: white;
          border: 1px solid #dbe5ee;
          border-radius: 24px;
          box-shadow: 0 20px 55px rgba(15, 23, 42, 0.08);
        }

        .statCard {
          padding: 20px;
        }

        .statLabel {
          color: #64748b;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .statValue {
          font-size: 34px;
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .statHint {
          margin-top: 8px;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .panel {
          padding: 20px;
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 16px;
        }

        .panelKicker {
          color: #0f766e;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .panelTitle {
          margin: 4px 0 0;
          font-size: 22px;
          letter-spacing: -0.03em;
        }

        .tableWrap {
          overflow: auto;
          border: 1px solid #dbe5ee;
          border-radius: 18px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }

        th {
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .06em;
          padding: 13px 14px;
          border-bottom: 1px solid #dbe5ee;
        }

        td {
          padding: 15px 14px;
          border-bottom: 1px solid #edf2f7;
          font-size: 14px;
          font-weight: 700;
        }

        tr:last-child td {
          border-bottom: none;
        }

        .tenantName {
          font-weight: 950;
          color: #0f172a;
        }

        .badge {
          display: inline-flex;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 950;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #047857;
        }

        .badgeTrial {
          border-color: #fed7aa;
          background: #fff7ed;
          color: #c2410c;
        }

        .badgeLocked {
          border-color: #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        @media (max-width: 1100px) {
          .superAdminShell {
            grid-template-columns: 1fr;
          }

          .sidebar {
            min-height: auto;
          }

          .statGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <aside className="sidebar">
        <Link to="/gastario-control" className="logoWrap">
          <img className="logo" src="/gastario-logo.svg" alt="Gastario" />
        </Link>

        <nav className="nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/gastario-control"}>
              <span>{item.label}</span>
              <span>›</span>
            </NavLink>
          ))}
        </nav>

        <div className="sideCard">
          <strong>Super Admin</strong>
          <p>Nur für Plattform-Betreiber. Hier verwaltest du Mandanten, Pakete, Limits und Registrierungscodes.</p>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
