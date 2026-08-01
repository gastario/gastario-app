import { Link, useLocation } from "react-router";

import "../styles/gastario-super-admin.css";

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
      

      <aside className="superAdminSidebar">
        <Link to="/gastario-control" className="superAdminBrand">
          <img
            className="superAdminBrandLogo"
            src="/brand/gastario-logo.png"
            alt="Gastario"
          />

          <span className="superAdminBrandSub">
            Control Center
          </span>
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



