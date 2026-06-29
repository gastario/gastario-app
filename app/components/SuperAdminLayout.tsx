import { Link, useLocation } from "react-router";

const controlNav = [
  { label: "Übersicht", to: "/gastario-control" },
  { label: "Mandanten", to: "/gastario-control/mandanten" },
  { label: "Pakete", to: "/gastario-control/pakete" },
  { label: "Features", to: "/gastario-control/features" },
];

type SuperAdminLayoutProps = {
  children: React.ReactNode;
};

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location = useLocation();

  return (
    <main className="controlShell">
      <aside className="controlSidebar">
        <div className="controlBrand">
          <strong>Gastario</strong>
          <span>Control Center</span>
        </div>

        <nav className="controlNav" aria-label="Super Admin Navigation">
          {controlNav.map((item) => {
            const active =
              item.to === "/gastario-control"
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);

            return (
              <Link className={active ? "active" : undefined} to={item.to} key={item.to}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="controlSecurityBox">
          <strong>Super Admin</strong>
          <span>Später nur mit platformRole SUPER_ADMIN erreichbar.</span>
        </div>
      </aside>

      <section className="controlWorkspace">{children}</section>
    </main>
  );
}
