import { Link, NavLink } from "react-router";

const navItems = [
  { label: "\u00dcbersicht", to: "/gastario-control" },
  { label: "Mandanten", to: "/gastario-control/mandanten" },
  { label: "Pakete", to: "/gastario-control/pakete" },
  { label: "Features", to: "/gastario-control/features" },
  { label: "Registrierungscodes", to: "/gastario-control/codes" },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="superAdminShell">
      <style>{`
        :root {
          --bg: #edf2f6;
          --sidebar: #08111f;
          --sidebar-2: #101b2d;
          --card: rgba(255, 255, 255, 0.92);
          --border: rgba(148, 163, 184, 0.28);
          --text: #07111f;
          --muted: #64748b;
          --primary: #0f766e;
          --primary-2: #14b8a6;
          --soft: #eefaf8;
          --shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
          --shadow-soft: 0 12px 32px rgba(15, 23, 42, 0.07);
        }

        * {
          box-sizing: border-box;
        }

        html {
          background: var(--bg);
        }

        body {
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }

        .superAdminShell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 292px minmax(0, 1fr);
          background:
            radial-gradient(circle at 78% 0%, rgba(20, 184, 166, 0.16), transparent 34%),
            radial-gradient(circle at 12% 16%, rgba(15, 118, 110, 0.08), transparent 26%),
            linear-gradient(180deg, #f8fbfd 0%, #edf2f6 100%);
        }

        .sidebar {
          position: sticky;
          top: 0;
          align-self: start;
          min-height: 100vh;
          padding: 24px 18px;
          color: white;
          background:
            radial-gradient(circle at 30% 0%, rgba(20, 184, 166, 0.28), transparent 28%),
            linear-gradient(180deg, #08111f 0%, #0c1422 48%, #070d18 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 18px 0 50px rgba(15, 23, 42, 0.12);
        }

        .logoWrap {
          display: flex;
          align-items: center;
          min-height: 58px;
          padding: 4px 6px 22px;
          margin-bottom: 18px;
          text-decoration: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.10);
        }

        .logo {
          width: 176px;
          max-height: 54px;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.18));
        }

        .nav {
          display: grid;
          gap: 7px;
          margin-top: 8px;
        }

        .nav a {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 48px;
          padding: 13px 14px;
          color: #cbd5e1;
          text-decoration: none;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 820;
          letter-spacing: -0.01em;
          transition: 160ms ease;
        }

        .nav a:hover {
          color: white;
          background: rgba(255, 255, 255, 0.075);
          transform: translateX(2px);
        }

        .nav a.active {
          color: white;
          background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
          box-shadow: 0 16px 32px rgba(20, 184, 166, 0.22);
        }

        .nav a.active::before {
          content: "";
          position: absolute;
          left: -18px;
          top: 12px;
          bottom: 12px;
          width: 4px;
          border-radius: 999px;
          background: #5eead4;
        }

        .navArrow {
          opacity: 0.55;
          font-weight: 900;
        }

        .sideCard {
          margin-top: 26px;
          border-radius: 22px;
          padding: 17px;
          background: linear-gradient(180deg, rgba(255,255,255,0.105), rgba(255,255,255,0.065));
          border: 1px solid rgba(255,255,255,0.11);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .sideCard strong {
          display: block;
          font-size: 15px;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .sideCard p {
          margin: 0;
          color: #cbd5e1;
          font-size: 12.5px;
          line-height: 1.55;
          font-weight: 600;
        }

        .main {
          min-width: 0;
          padding: 34px 34px 48px;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .kicker {
          margin-bottom: 8px;
          color: var(--primary);
          text-transform: uppercase;
          letter-spacing: .11em;
          font-size: 11px;
          font-weight: 950;
        }

        .pageTitle {
          margin: 0;
          color: #07111f;
          font-size: clamp(34px, 3.2vw, 48px);
          line-height: .95;
          letter-spacing: -0.065em;
          font-weight: 920;
        }

        .pageSubtitle {
          max-width: 820px;
          margin: 12px 0 0;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.5;
          font-weight: 650;
        }

        .topActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
        }

        .btn {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(148, 163, 184, 0.32);
          background: rgba(255, 255, 255, 0.78);
          color: #07111f;
          border-radius: 999px;
          padding: 11px 16px;
          font-size: 13.5px;
          font-weight: 900;
          letter-spacing: -0.01em;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
          transition: 160ms ease;
          backdrop-filter: blur(14px);
        }

        .btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.09);
        }

        .btnPrimary {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%);
          border-color: transparent;
          color: white;
          box-shadow: 0 16px 34px rgba(15, 118, 110, 0.24);
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .statCard,
        .panel {
          background: var(--card);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
        }

        .statCard {
          min-height: 132px;
          border-radius: 26px;
          padding: 22px;
        }

        .statLabel {
          margin-bottom: 10px;
          color: var(--muted);
          font-size: 12.5px;
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .statValue {
          color: #07111f;
          font-size: 38px;
          line-height: 1;
          letter-spacing: -0.055em;
          font-weight: 950;
        }

        .statHint {
          margin-top: 10px;
          color: #475569;
          font-size: 13px;
          font-weight: 720;
        }

        .panel {
          border-radius: 28px;
          padding: 22px;
        }

        .panelHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 18px;
        }

        .panelKicker {
          color: var(--primary);
          font-size: 11.5px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .10em;
        }

        .panelTitle {
          margin: 5px 0 0;
          color: #07111f;
          font-size: 24px;
          line-height: 1.1;
          letter-spacing: -0.04em;
          font-weight: 920;
        }

        .tableWrap {
          overflow: auto;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 20px;
          background: white;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: .075em;
          padding: 14px 15px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.24);
          font-weight: 950;
        }

        td {
          padding: 16px 15px;
          border-bottom: 1px solid #eef2f7;
          color: #162033;
          font-size: 14px;
          font-weight: 720;
          vertical-align: top;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr:hover td {
          background: #fbfdff;
        }

        .tenantName {
          color: #07111f;
          font-weight: 950;
          letter-spacing: -0.015em;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11.5px;
          font-weight: 950;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #047857;
          white-space: nowrap;
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

        input,
        select,
        textarea {
          font: inherit;
        }

        @media (max-width: 1180px) {
          .superAdminShell {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: relative;
            min-height: auto;
          }

          .statGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .main {
            padding: 22px;
          }

          .topbar {
            flex-direction: column;
          }

          .statGrid {
            grid-template-columns: 1fr;
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
              <span className="navArrow">{">"}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sideCard">
          <strong>Super Admin</strong>
          <p>Nur fuer Plattform-Betreiber. Hier verwaltest du Mandanten, Pakete, Limits und Registrierungscodes.</p>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
