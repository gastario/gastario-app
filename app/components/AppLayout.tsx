import { Link, useLocation } from "react-router";
import { useEffect, useMemo, useState } from "react";

import "../styles/gastario-layout.css";

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
      { label: "Import-Regeln", to: "/import-regeln" },
      { label: "Buchhaltung", to: "/buchhaltung" },
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

  
  /* gastario-mobile-sidebar-drawer-20260729 */
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState(false);

  const [isMobileNavigation, setIsMobileNavigation] =
    useState(false);
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

    if (
      to === "/auftraege" &&
      location.pathname === "/auftraege"
    ) {
      return !new URLSearchParams(location.search).has("view");
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

  /*
   * gastario-sidebar-multi-open-exact-20260716
   *
   * Mehrere Navigationsgruppen dürfen gleichzeitig offen sein.
   * Die Auswahl wird als Array im Browser gespeichert.
   */
  const [openGroupIds, setOpenGroupIds] =
    useState<string[]>(() => {
      if (
        activeGroupId &&
        activeGroupId !== "overview"
      ) {
        return [activeGroupId];
      }

      return [];
    });

  useEffect(() => {
    const storedValue =
      window.localStorage.getItem(
        "gastario-open-navigation-groups"
      );

    let storedGroupIds: string[] = [];

    if (storedValue) {
      try {
        const parsedValue =
          JSON.parse(storedValue);

        if (Array.isArray(parsedValue)) {
          storedGroupIds =
            parsedValue.filter(
              (value): value is string =>
                typeof value === "string" &&
                value !== "overview" &&
                navigationGroups.some(
                  (group) =>
                    group.id === value
                )
            );
        }
      } catch {
        storedGroupIds = [];
      }
    }

    const initialGroupIds =
      activeGroupId &&
      activeGroupId !== "overview"
        ? [
            ...storedGroupIds,
            activeGroupId,
          ]
        : storedGroupIds;

    setOpenGroupIds(
      Array.from(
        new Set(initialGroupIds)
      )
    );

    /*
     * Alten Einzelwert nach erfolgreicher Umstellung entfernen.
     */
    window.localStorage.removeItem(
      "gastario-open-navigation-group"
    );
  }, []);

  useEffect(() => {
    if (
      !activeGroupId ||
      activeGroupId === "overview"
    ) {
      return;
    }

    setOpenGroupIds((currentGroupIds) => {
      if (
        currentGroupIds.includes(activeGroupId)
      ) {
        return currentGroupIds;
      }

      const nextGroupIds = [
        ...currentGroupIds,
        activeGroupId,
      ];

      window.localStorage.setItem(
        "gastario-open-navigation-groups",
        JSON.stringify(nextGroupIds)
      );

      return nextGroupIds;
    });
  }, [activeGroupId]);
  useEffect(() => {
    const mediaQuery =
      window.matchMedia("(max-width: 980px)");

    const updateMobileNavigation = () => {
      const isMobile = mediaQuery.matches;

      setIsMobileNavigation(isMobile);

      if (isMobile) {
        setOpenGroupIds(
          activeGroupId &&
            activeGroupId !== "overview"
            ? [activeGroupId]
            : []
        );
      }
    };

    updateMobileNavigation();

    mediaQuery.addEventListener(
      "change",
      updateMobileNavigation
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        updateMobileNavigation
      );
    };
  }, [activeGroupId]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [currentPathWithSearch]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const closeOnEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      closeOnEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [isMobileSidebarOpen]);


  const toggleNavigationGroup = (
    groupId: string
  ) => {
    if (groupId === "overview") {
      return;
    }

    setOpenGroupIds((currentGroupIds) => {
      const nextGroupIds =
        isMobileNavigation
          ? currentGroupIds.includes(groupId)
            ? []
            : [groupId]
          : currentGroupIds.includes(groupId)
            ? currentGroupIds.filter(
                (currentGroupId) =>
                  currentGroupId !== groupId
              )
            : [
                ...currentGroupIds,
                groupId,
              ];

      window.localStorage.setItem(
        "gastario-open-navigation-groups",
        JSON.stringify(nextGroupIds)
      );

      return nextGroupIds;
    });
  };

  return (
    <main className="appShell">
      <header className="mobileAppBar">

        <button
          type="button"
          className="mobileMenuButton"
          onClick={() =>
            setIsMobileSidebarOpen(true)
          }
          aria-label="Navigation öffnen"
          aria-expanded={isMobileSidebarOpen}
        >
          <span>Navigation</span>
          <span
            className="mobileMenuChevron"
            aria-hidden="true"
          >
            ›
          </span>
        </button>

        <Link
          to="/"
          className="mobileBrandLink"
          aria-label="Zum Dashboard"
          onClick={() =>
            setIsMobileSidebarOpen(false)
          }
        >
          <img
            src="/brand/gastario-logo.png"
            alt="Gastario"
          />
        </Link>
      </header>

      <button
        type="button"
        className={
          "mobileSidebarBackdrop" +
          (isMobileSidebarOpen
            ? " isVisible"
            : "")
        }
        onClick={() =>
          setIsMobileSidebarOpen(false)
        }
        aria-label="Navigation schließen"
        tabIndex={
          isMobileSidebarOpen ? 0 : -1
        }
      />
      
      


      <aside
        className={
          "sidebar" +
          (isMobileSidebarOpen
            ? " isMobileOpen"
            : "")
        }
      >
        <div className="brand">
          <Link
            to="/"
            className="sidebarBrandLink"
            aria-label="Zum Dashboard"
            onClick={() =>
              setIsMobileSidebarOpen(false)
            }
          >
            <img
              className="brandLogo"
              src="/brand/gastario-logo.png"
              alt="Gastario"
            />
          </Link>

          <button
            type="button"
            className="mobileSidebarClose"
            onClick={() =>
              setIsMobileSidebarOpen(false)
            }
            aria-label="Navigation schließen"
          >
            ×
          </button>
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
              openGroupIds.includes(group.id) ||
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
                        onClick={() =>
                          setIsMobileSidebarOpen(false)
                        }
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









