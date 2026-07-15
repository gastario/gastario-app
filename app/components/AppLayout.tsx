import { Link, useLocation } from "react-router";
import { useEffect, useMemo, useState } from "react";

const navigationGroups = [
  {
    id: "overview",
    label: "Übersicht",
    items: [
      { label: "Dashboard", to: "/" },
    ],
  },
  {
    id: "inbox",
    label: "Eingang",
    items: [
      { label: "Eingangszentrale", to: "/auftragseingang" },
    ],
  },
  {
    id: "orders",
    label: "Aufträge",
    items: [
      { label: "Bevorstehende Aufträge", to: "/auftraege" },
      { label: "Vergangene Aufträge", to: "/auftraege?view=past" },
      { label: "Neuer Auftrag", to: "/neuer-auftrag" },
    ],
  },
  {
    id: "import",
    label: "Import",
    items: [
      { label: "E-Mail-Konten", to: "/importe" },
      { label: "PDF importieren", to: "/import-pruefen" },
      { label: "Import-Regeln", to: "/import-regeln" },
    ],
  },
  {
    id: "sales",
    label: "Verkauf",
    items: [
      { label: "Angebote", to: "/angebote" },
      { label: "Kunden", to: "/kunden" },
      { label: "Produkte", to: "/produkte" },
      { label: "Produkt-Import", to: "/produkt-import" },
    ],
  },
  {
    id: "operations",
    label: "Betrieb",
    items: [
      { label: "Produktion", to: "/produktion" },
      { label: "MHD-Labels", to: "/mhd-labels" },
      { label: "Foodlabel erstellen", to: "/foodlabels" },
      { label: "Packlisten", to: "/packlisten" },
      { label: "Lieferungen", to: "/lieferungen" },
      { label: "Lieferscheine", to: "/lieferscheine" },
    ],
  },
  {
    id: "finance",
    label: "Finanzen",
    items: [
      { label: "Rechnungen", to: "/rechnungen" },
      { label: "Abrechnung", to: "/abrechnung" },
    ],
  },
  {
    id: "masterdata",
    label: "Stammdaten",
    items: [
      { label: "Lieferanten", to: "/lieferanten" },
      { label: "Lager", to: "/lager" },
      { label: "Rezepte", to: "/rezepte" },
      { label: "Konto & Abo", to: "/konto/abo" },
    ],
  },
];

type AppLayoutProps = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();

  const currentPathWithSearch =
    location.pathname + location.search;

  const isNavigationItemActive = (to: string) => {
    const itemPath = to.split("?")[0];
    const itemHasQuery = to.includes("?");

    if (to === "/") {
      return location.pathname === "/";
    }

    if (itemHasQuery) {
      return currentPathWithSearch === to;
    }

    return (
      location.pathname === itemPath ||
      location.pathname.startsWith(itemPath + "/")
    );
  };

  const activeGroupId = useMemo(() => {
    const activeGroup = navigationGroups.find((group) =>
      group.items.some((item) =>
        isNavigationItemActive(item.to)
      )
    );

    return activeGroup?.id || "overview";
  }, [currentPathWithSearch]);

  const [openGroupId, setOpenGroupId] = useState<string>(
    activeGroupId
  );

  useEffect(() => {
    const storedGroup =
      window.localStorage.getItem(
        "gastario-open-navigation-group"
      );

    if (
      activeGroupId &&
      activeGroupId !== "overview"
    ) {
      setOpenGroupId(activeGroupId);
      return;
    }

    if (
      storedGroup &&
      navigationGroups.some(
        (group) => group.id === storedGroup
      )
    ) {
      setOpenGroupId(storedGroup);
    }
  }, []);

  useEffect(() => {
    if (
      activeGroupId &&
      activeGroupId !== "overview"
    ) {
      setOpenGroupId(activeGroupId);
    }
  }, [activeGroupId]);

  const toggleNavigationGroup = (groupId: string) => {
    if (groupId === "overview") {
      return;
    }

    setOpenGroupId((currentGroupId) => {
      const nextGroupId =
        currentGroupId === groupId ? "" : groupId;

      if (nextGroupId) {
        window.localStorage.setItem(
          "gastario-open-navigation-group",
          nextGroupId
        );
      } else {
        window.localStorage.removeItem(
          "gastario-open-navigation-group"
        );
      }

      return nextGroupId;
    });
  };

  return (
    <main className="appShell">
      <style>
        {`
          :root {
            --g-bg: #edf3f7;
            --g-sidebar: #f8fbfc;
            --g-card: #ffffff;
            --g-border: #dbe5eb;
            --g-border-strong: #c8d4dd;
            --g-text: #0f172a;
            --g-muted: #64748b;
            --g-green: #057a67;
            --g-green-dark: #045f50;
            --g-warn: #f59e0b;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            background: var(--g-bg);
            color: var(--g-text);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }

          body {
            min-width: 1180px;
          }

          .appShell {
            min-height: 100vh;
            display: grid;
            grid-template-columns: 252px minmax(0, 1fr);
            background:
              radial-gradient(circle at top left, rgba(5, 122, 103, 0.08), transparent 34%),
              var(--g-bg);
          }

          .sidebar {
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
            background: rgba(248, 251, 252, 0.96);
            border-right: 1px solid var(--g-border);
            padding: 28px 18px 18px;
            display: flex;
            flex-direction: column;
            gap: 22px;
          }

          .brand {
            display: flex;
            align-items: center;
            padding: 4px 8px 18px;
          }

          .brandLogo {
            width: 148px;
            height: auto;
            display: block;
          }

          .navGroups {
            display: grid;
            gap: 22px;
            flex: 1;
          }

          .navGroup {
            display: grid;
            gap: 5px;
          }

          .navGroup p {
            margin: 0 0 6px;
            padding: 0 8px;
            color: #718096;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.09em;
            text-transform: uppercase;
          }

          .navGroup a {
            min-height: 38px;
            display: flex;
            align-items: center;
            padding: 0 11px;
            border-radius: 12px;
            color: #172033;
            font-size: 14px;
            font-weight: 650;
            text-decoration: none;
            border: 1px solid transparent;
            transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
          }

          .navGroup a:hover {
            background: #eef7f6;
            border-color: #d2e7e3;
          }

          .navGroup a.active {
            background: linear-gradient(135deg, #e6f5f2, #f4faf9);
            border-color: #c9e4df;
            color: #064e42;
            box-shadow: inset 3px 0 0 var(--g-warn), 0 10px 24px rgba(15, 23, 42, 0.06);
          }

          .sidebarFooter {
            border-top: 1px solid var(--g-border);
            padding-top: 14px;
          }

          .sidebarLogoutButton {
            min-height: 40px;
            width: 100%;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            border: 1px solid var(--g-border-strong);
            color: #0f172a;
            text-decoration: none;
            font-weight: 700;
          }

          .workspace {
            min-width: 0;
            padding: 34px 42px 70px;
          }

          .workspace > * {
            max-width: 1480px;
            margin-left: auto;
            margin-right: auto;
          }

          .topbar {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 24px;
          }

          .topbar h1 {
            margin: 4px 0 0;
            color: var(--g-text);
            font-size: 36px;
            line-height: 1.05;
            letter-spacing: -0.055em;
            font-weight: 700;
          }

          .eyebrow {
            margin: 0;
            color: var(--g-green);
            text-transform: uppercase;
            letter-spacing: 0.09em;
            font-size: 12px;
            font-weight: 700;
          }

          .muted {
            margin: 8px 0 0;
            color: #42526b;
            font-size: 15px;
            line-height: 1.5;
            font-weight: 600;
          }

          .button,
          button,
          input,
          textarea,
          select {
            font: inherit;
          }

          input,
          textarea,
          select {
            min-height: 46px;
            width: 100%;
            border: 1px solid var(--g-border-strong);
            border-radius: 12px;
            background: #ffffff;
            color: var(--g-text);
            padding: 10px 12px;
            font-size: 14px;
            font-weight: 650;
            outline: none;
            box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
          }

          textarea {
            line-height: 1.5;
          }

          input:focus,
          textarea:focus,
          select:focus {
            border-color: var(--g-green);
            box-shadow: 0 0 0 4px rgba(5, 122, 103, 0.12);
          }

          .button {
            min-height: 42px;
            border-radius: 12px;
            padding: 0 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
            font-size: 14px;
            font-weight: 700;
            white-space: nowrap;
          }

          .button.secondary {
            border: 1px solid var(--g-border-strong);
            background: #ffffff;
            color: #0f172a;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.045);
          }

          .button.primary {
            border: 1px solid #036b5a;
            background: linear-gradient(135deg, #058872 0%, #04705f 100%);
            color: #ffffff;
            box-shadow: 0 12px 24px rgba(5, 122, 103, 0.22);
          }

          @media (max-width: 980px) {
            body {
              min-width: 0;
            }

            .appShell {
              grid-template-columns: 1fr;
            }

            .sidebar {
              position: relative;
              height: auto;
            }

            .workspace {
              padding: 24px 18px 48px;
            }

            .topbar {
              flex-direction: column;
            }
          }
        `}
      </style>
      <style>{`
        /* gastario-global-lexoffice-style */

        :root {
          --g-text: #111827;
          --g-muted: #64748b;
          --g-border: #dbe5ec;
          --g-soft-border: #e8eef3;
          --g-bg-soft: #f8fafc;
          --g-green: #0f9f7a;
          --g-green-dark: #047857;
          --g-danger: #b91c1c;
        }

        body {
          color: var(--g-text) !important;
          font-weight: 400 !important;
          letter-spacing: -0.006em;
        }

        h1 {
          font-size: clamp(28px, 3vw, 36px) !important;
          line-height: 1.08 !important;
          font-weight: 600 !important;
          letter-spacing: -0.045em !important;
          color: var(--g-text) !important;
        }

        h2 {
          font-size: clamp(20px, 2vw, 25px) !important;
          line-height: 1.15 !important;
          font-weight: 600 !important;
          letter-spacing: -0.03em !important;
          color: var(--g-text) !important;
        }

        h3 {
          font-weight: 600 !important;
          letter-spacing: -0.02em !important;
        }

        p,
        small,
        span,
        div {
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }

        label {
          font-weight: 600 !important;
          color: #334155 !important;
        }

        input,
        textarea,
        select {
          min-height: 40px !important;
          border: 1px solid #d6e1ea !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          color: var(--g-text) !important;
          font-size: 14px !important;
          font-weight: 450 !important;
          box-shadow: none !important;
          outline: none !important;
        }

        textarea {
          line-height: 1.45 !important;
        }

        input::placeholder,
        textarea::placeholder {
          color: #8a94a6 !important;
          font-weight: 450 !important;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #9fc9bc !important;
          box-shadow: 0 0 0 3px rgba(15, 159, 122, 0.08) !important;
        }

        button,
        a {
          font-weight: 600 !important;
        }

        button {
          cursor: pointer;
        }

        .ghostButton,
        .primaryGhostButton,
        .secondaryButton,
        .toolbarButton,
        .actionButton,
        .navGroup a {
          font-size: 14px !important;
          font-weight: 600 !important;
          border-radius: 10px !important;
        }

        .ghostButton,
        .secondaryButton,
        .toolbarButton {
          min-height: 38px !important;
          border: 1px solid #d7e2ea !important;
          background: #ffffff !important;
          color: var(--g-text) !important;
          box-shadow: none !important;
        }

        .primaryGhostButton,
        .primaryButton,
        button[type="submit"] {
          background: var(--g-green) !important;
          border-color: var(--g-green) !important;
          color: #ffffff !important;
          box-shadow: 0 6px 14px rgba(15, 159, 122, 0.12) !important;
        }

        .ghostButton:hover,
        .secondaryButton:hover,
        .toolbarButton:hover {
          border-color: #b8d8d0 !important;
          background: #f7fbfa !important;
          color: var(--g-green-dark) !important;
        }

        .appShell {
          background:
            radial-gradient(circle at top left, rgba(15, 159, 122, 0.035), transparent 34%),
            #eef5f7 !important;
        }

        .navGroup {
          margin-bottom: 22px !important;
        }

        .navGroup p {
          font-size: 11px !important;
          letter-spacing: .10em !important;
          font-weight: 700 !important;
          color: #7c8a9a !important;
        }

        .navGroup a {
          min-height: 40px !important;
          padding: 0 12px !important;
          border: 1px solid transparent !important;
          background: transparent !important;
          color: #111827 !important;
          box-shadow: none !important;
        }

        .navGroup a:hover {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
          transform: none !important;
        }

        .navGroup a.active {
          background: #edf8f4 !important;
          border-color: #c9e4dc !important;
          color: #064e42 !important;
          box-shadow: inset 3px 0 0 #f59e0b !important;
          font-weight: 650 !important;
        }

        article,
        section,
        .metricCard,
        .panel,
        .card {
          border-color: var(--g-border) !important;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035) !important;
        }

        .metricCard strong {
          font-weight: 600 !important;
          letter-spacing: -0.035em !important;
        }

        table th,
        .tableHeader,
        .ordersTableHeader {
          color: #64748b !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          letter-spacing: .055em !important;
          text-transform: uppercase !important;
          background: #f8fafc !important;
        }

        table td,
        .orderRow,
        .emailRow {
          font-weight: 450 !important;
        }

        .orderStatus,
        .statusBadge,
        .badge {
          font-size: 12px !important;
          font-weight: 600 !important;
          border-radius: 999px !important;
        }

        .dangerButton,
        button[data-danger="true"] {
          background: #fffafa !important;
          border-color: #f3caca !important;
          color: var(--g-danger) !important;
          box-shadow: none !important;
        }

        .dangerButton:hover,
        button[data-danger="true"]:hover {
          background: #fee2e2 !important;
        }

        .pageOverline,
        .overline {
          font-weight: 700 !important;
          letter-spacing: .09em !important;
          color: var(--g-green-dark) !important;
        }

        /*
         * Gastario Sidebar Accordion
         */
        .navGroups.navAccordion {
          display: grid;
          align-content: start;
          gap: 8px !important;
        }

        .navAccordionGroup {
          display: grid;
          gap: 4px !important;
          margin: 0 !important;
        }

        .navAccordionStaticLabel,
        .navAccordionTrigger {
          width: 100%;
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-sizing: border-box;
          border: 1px solid transparent;
          border-radius: 11px;
          padding: 0 10px;
          background: transparent;
          color: #718096;
          font: inherit;
          font-size: 11px;
          font-weight: 750 !important;
          letter-spacing: 0.085em;
          line-height: 1;
          text-align: left;
          text-transform: uppercase;
        }

        .navAccordionTrigger {
          cursor: pointer;
          transition:
            background 140ms ease,
            border-color 140ms ease,
            color 140ms ease;
        }

        .navAccordionTrigger:hover {
          border-color: #e0e9e7;
          background: #f4f8f7 !important;
          color: #315c54 !important;
        }

        .navAccordionGroup.isOpen
          .navAccordionTrigger,
        .navAccordionGroup.hasActiveItem
          .navAccordionTrigger {
          border-color: #d9e9e5;
          background: #f0f7f5 !important;
          color: #17634f !important;
        }

        .navAccordionChevron {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #81918f;
          font-size: 19px;
          font-weight: 500;
          line-height: 1;
          transform: rotate(0deg);
          transition: transform 160ms ease;
        }

        .navAccordionGroup.isOpen
          .navAccordionChevron {
          transform: rotate(90deg);
        }

        .navAccordionItems {
          display: grid;
          gap: 3px;
          padding: 2px 0 5px 8px;
        }

        .navAccordionItems[hidden] {
          display: none !important;
        }

        .navAccordionItems a {
          position: relative;
          min-height: 38px !important;
          padding: 0 11px 0 18px !important;
          border-radius: 10px !important;
          font-size: 13px !important;
          font-weight: 560 !important;
        }

        .navAccordionItems a::before {
          content: "";
          position: absolute;
          left: 7px;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: #bdcbc8;
        }

        .navAccordionItems a.active::before {
          background: #f59e0b;
        }

        .navAccordionItems a.active {
          background: #edf8f4 !important;
          border-color: #c9e4dc !important;
          color: #064e42 !important;
          box-shadow:
            inset 3px 0 0 #f59e0b !important;
          font-weight: 650 !important;
        }

        .sidebar {
          gap: 10px !important;
        }

        .brand {
          padding-bottom: 12px !important;
        }
      `}</style>


      <aside className="sidebar">
        <div className="brand">
          <img className="brandLogo" src="/brand/gastario-logo.png" alt="Gastario" />
        </div>

        <nav
          className="navGroups navAccordion"
          aria-label="Hauptnavigation"
        >
          {navigationGroups.map((group) => {
            const isOverview =
              group.id === "overview";

            const groupContainsActiveItem =
              group.items.some((item) =>
                isNavigationItemActive(item.to)
              );

            const isOpen =
              isOverview ||
              openGroupId === group.id ||
              groupContainsActiveItem;

            return (
              <div
                className={
                  "navGroup navAccordionGroup" +
                  (isOpen ? " isOpen" : "") +
                  (groupContainsActiveItem
                    ? " hasActiveItem"
                    : "")
                }
                key={group.id}
              >
                {isOverview ? (
                  <div className="navAccordionStaticLabel">
                    {group.label}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="navAccordionTrigger"
                    onClick={() =>
                      toggleNavigationGroup(group.id)
                    }
                    aria-expanded={isOpen}
                    aria-controls={
                      "navigation-group-" + group.id
                    }
                  >
                    <span>{group.label}</span>

                    <span
                      className="navAccordionChevron"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                )}

                <div
                  id={"navigation-group-" + group.id}
                  className="navAccordionItems"
                  hidden={!isOpen}
                >
                  {group.items.map((item) => {
                    const isActive =
                      isNavigationItemActive(item.to);

                    return (
                      <Link
                        preventScrollReset
                        className={
                          isActive ? "active" : undefined
                        }
                        to={item.to}
                        key={item.to}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebarFooter">
          <a className="sidebarLogoutButton" href="/logout">
            Ausloggen
          </a>
        </div>
      </aside>

      <section className="workspace">{children}</section>
    </main>
  );
}









