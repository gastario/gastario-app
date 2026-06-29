import { Link, useLocation } from "react-router";

const navigationGroups = [
  {
    label: "Übersicht",
    items: [{ label: "Dashboard", to: "/" }],
  },
  {
    label: "Verkauf",
    items: [
      { label: "Aufträge", to: "/auftraege" },
      { label: "Angebote", to: "/angebote" },
      { label: "Kunden", to: "/kunden" },
      { label: "Produkte", to: "/produkte" },
    ],
  },
  {
    label: "Betrieb",
    items: [
      { label: "Produktion", to: "/produktion" },
      { label: "Packlisten", to: "/packlisten" },
      { label: "Lieferscheine", to: "/lieferscheine" },
      { label: "Lieferungen", to: "/lieferungen" },
    ],
  },
  {
    label: "Einkauf & Lager",
    items: [
      { label: "Einkauf", to: "/einkauf" },
      { label: "Lager", to: "/lager" },
      { label: "Lieferanten", to: "/lieferanten" },
      { label: "Rezepte", to: "/rezepte" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Auftragseingang", to: "/auftragseingang" },
      { label: "Auswertungen", to: "/auswertungen" },
      { label: "Einstellungen", to: "/einstellungen" },
    ],
  },
];

type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brandLogo" src="/brand/gastario-logo.png" alt="Gastario" />
        </div>

        <nav className="navGroups" aria-label="Hauptnavigation">
          {navigationGroups.map((group) => (
            <div className="navGroup" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const isActive =
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to);

                return (
                  <Link className={isActive ? "active" : undefined} to={item.to} key={item.to}>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <section className="workspace">{children}</section>
    </main>
  );
}

