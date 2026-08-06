import type { ReactNode } from "react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  useFetcher,
  useLocation,
} from "react-router";

import "../styles/gastario-layout.css";

type NavigationCountKey =
  | "inbox"
  | "upcomingOrders"
  | "openQuotes"
  | "production"
  | "packing"
  | "deliveries"
  | "financeOpen"
  | "inventoryWarnings";

type NavigationCounts = Record<
  NavigationCountKey,
  number
>;

type NavigationItem = {
  label: string;
  to: string;
  countKey?: NavigationCountKey;
};

type NavigationGroup = {
  id: string;
  label: string;
  countKeys?: NavigationCountKey[];
  items: NavigationItem[];
};

type AppLayoutProps = {
  children: ReactNode;
};

const emptyNavigationCounts: NavigationCounts = {
  inbox: 0,
  upcomingOrders: 0,
  openQuotes: 0,
  production: 0,
  packing: 0,
  deliveries: 0,
  financeOpen: 0,
  inventoryWarnings: 0,
};

const navigationGroups: NavigationGroup[] = [
  {
    id: "overview",
    label: "Übersicht",
    items: [
      {
        label: "Dashboard",
        to: "/",
      },
      {
        label: "Auswertungen",
        to: "/auswertungen",
      },
    ],
  },

  {
    id: "inbox",
    label: "Eingang",
    countKeys: ["inbox"],
    items: [
      {
        label: "Eingangszentrale",
        to: "/auftragseingang",
        countKey: "inbox",
      },
      {
        label: "E-Mail-Konten",
        to: "/importe",
      },
      {
        label: "Import-Regeln",
        to: "/import-regeln",
      },
    ],
  },

  {
    id: "orders",
    label: "Aufträge",
    countKeys: ["upcomingOrders"],
    items: [
      {
        label: "Bevorstehende Aufträge",
        to: "/auftraege",
        countKey: "upcomingOrders",
      },
      {
        label: "Vergangene Aufträge",
        to: "/auftraege?view=past",
      },
      {
        label: "Neuer Auftrag",
        to: "/neuer-auftrag",
      },
    ],
  },

  {
    id: "sales",
    label: "Verkauf",
    countKeys: ["openQuotes"],
    items: [
      {
        label: "Angebote",
        to: "/angebote",
        countKey: "openQuotes",
      },
      {
        label: "Kunden",
        to: "/kunden",
      },
      {
        label: "Produkte",
        to: "/produkte",
      },
      {
        label: "Produkt-Import",
        to: "/produkte/import",
      },
    ],
  },

  {
    id: "operations",
    label: "Betrieb",
    countKeys: [
      "production",
      "packing",
    ],
    items: [
      {
        label: "Produktion",
        to: "/produktion",
        countKey: "production",
      },
      {
        label: "Packlisten",
        to: "/packlisten",
        countKey: "packing",
      },
      {
        label: "Lieferungen",
        to: "/lieferungen",
        countKey: "deliveries",
      },
      {
        label: "Lieferscheine",
        to: "/lieferscheine",
      },
      {
        label: "MHD-Labels",
        to: "/mhd-labels",
      },
      {
        label: "Foodlabels",
        to: "/foodlabels",
      },
    ],
  },

  {
    id: "purchasing",
    label: "Einkauf",
    countKeys: ["inventoryWarnings"],
    items: [
      {
        label: "Einkaufsplanung",
        to: "/einkauf",
      },
      {
        label: "Bestellungen",
        to: "/einkaufsbestellungen",
      },
      {
        label: "Lager",
        to: "/lager",
        countKey: "inventoryWarnings",
      },
      {
        label: "Lieferanten",
        to: "/lieferanten",
      },
      {
        label: "Rezepte",
        to: "/rezepte",
      },
    ],
  },

  {
    id: "finance",
    label: "Finanzen",
    countKeys: ["financeOpen"],
    items: [
      {
        label: "Rechnungen",
        to: "/rechnungen",
        countKey: "financeOpen",
      },
      {
        label: "Buchhaltung",
        to: "/buchhaltung",
      },
      {
        label: "Belege",
        to: "/belege",
      },
      {
        label: "Steuerberater-Export",
        to: "/steuerberater-export",
      },
    ],
  },

  {
    id: "administration",
    label: "Verwaltung",
    items: [
      {
        label: "Einstellungen",
        to: "/einstellungen",
      },
      {
        label: "Rechnungseinstellungen",
        to: "/einstellungen/rechnungen",
      },
      {
        label: "Konto & Abo",
        to: "/konto/abo",
      },
    ],
  },
];

function formatNavigationCount(
  count: number
) {
  const normalizedCount = Math.max(
    0,
    Math.trunc(Number(count) || 0)
  );

  return new Intl.NumberFormat(
    "de-DE"
  ).format(normalizedCount);
}
export default function AppLayout({
  children,
}: AppLayoutProps) {
  const location = useLocation();
  const countFetcher = useFetcher();

  const sidebarRef =
    useRef<HTMLElement | null>(null);

  const sidebarScrollReadyRef =
    useRef(false);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] =
    useState(false);

  const [isMobileNavigation, setIsMobileNavigation] =
    useState(false);

  const currentPathWithSearch =
    location.pathname + location.search;

  const navigationCounts =
    (
      countFetcher.data as
        | NavigationCounts
        | undefined
    ) || emptyNavigationCounts;

  const countForKeys = (
    keys?: NavigationCountKey[]
  ) => {
    if (!keys?.length) {
      return 0;
    }

    return keys.reduce(
      (sum, key) =>
        sum +
        Number(navigationCounts[key] || 0),
      0
    );
  };

  const isNavigationItemActive = (
    to: string
  ) => {
    const itemPath =
      to.split("?")[0];

    const itemHasQuery =
      to.includes("?");

    if (to === "/") {
      return (
        location.pathname === "/"
      );
    }

    if (itemHasQuery) {
      return (
        currentPathWithSearch === to
      );
    }

    if (
      to === "/auftraege" &&
      location.pathname ===
        "/auftraege"
    ) {
      return !new URLSearchParams(
        location.search
      ).has("view");
    }

    if (
      location.pathname === itemPath
    ) {
      return true;
    }

    const hasMoreSpecificItem =
      navigationGroups.some(
        (group) =>
          group.items.some(
            (candidateItem) => {
              const candidatePath =
                candidateItem.to.split(
                  "?"
                )[0];

              if (
                candidatePath === itemPath ||
                !candidatePath.startsWith(
                  itemPath + "/"
                )
              ) {
                return false;
              }

              return (
                location.pathname ===
                  candidatePath ||
                location.pathname.startsWith(
                  candidatePath + "/"
                )
              );
            }
          )
      );

    if (hasMoreSpecificItem) {
      return false;
    }

    return location.pathname.startsWith(
      itemPath + "/"
    );
  };

  const activeGroupId = useMemo(() => {
    const activeGroup =
      navigationGroups.find((group) =>
        group.items.some((item) =>
          isNavigationItemActive(item.to)
        )
      );

    return activeGroup?.id || "overview";
  }, [currentPathWithSearch]);

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
        currentGroupIds.includes(
          activeGroupId
        )
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

  const sidebarScrollStorageKey =
    "gastario-sidebar-scroll-top-v3";

  const rememberSidebarScrollPosition =
    () => {
      if (isMobileNavigation) {
        return;
      }

      const sidebar =
        sidebarRef.current;

      if (!sidebar) {
        return;
      }

      window.sessionStorage.setItem(
        sidebarScrollStorageKey,
        String(sidebar.scrollTop)
      );
    };

  /*
   * gastario-sidebar-scroll-memory-v3-20260802
   *
   * Beim Routenwechsel wird die Position vor dem
   * Navigieren gespeichert. Während des neuen
   * Renderings ignoriert die Sidebar eigene
   * Scroll-Ereignisse, damit der gespeicherte Wert
   * nicht versehentlich mit 0 überschrieben wird.
   */
  useLayoutEffect(() => {
    if (isMobileNavigation) {
      sidebarScrollReadyRef.current =
        false;

      return;
    }

    const sidebar =
      sidebarRef.current;

    if (!sidebar) {
      return;
    }

    sidebarScrollReadyRef.current =
      false;

    const storedScrollTop =
      Number(
        window.sessionStorage.getItem(
          sidebarScrollStorageKey
        ) || "0"
      );

    const restorePosition = () => {
      if (
        !Number.isFinite(
          storedScrollTop
        ) ||
        storedScrollTop < 0
      ) {
        return;
      }

      const maximumScrollTop =
        Math.max(
          0,
          sidebar.scrollHeight -
            sidebar.clientHeight
        );

      sidebar.scrollTop =
        Math.min(
          storedScrollTop,
          maximumScrollTop
        );
    };

    let secondFrame = 0;

    const firstFrame =
      window.requestAnimationFrame(
        () => {
          restorePosition();

          secondFrame =
            window.requestAnimationFrame(
              restorePosition
            );
        }
      );

    const shortRestore =
      window.setTimeout(
        restorePosition,
        120
      );

    const finalRestore =
      window.setTimeout(
        () => {
          restorePosition();

          sidebarScrollReadyRef.current =
            true;
        },
        360
      );

    return () => {
      window.cancelAnimationFrame(
        firstFrame
      );

      if (secondFrame) {
        window.cancelAnimationFrame(
          secondFrame
        );
      }

      window.clearTimeout(
        shortRestore
      );

      window.clearTimeout(
        finalRestore
      );
    };
  }, [
    currentPathWithSearch,
    isMobileNavigation,
  ]);
  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        "(max-width: 980px)"
      );

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

  /*
   * Beim Wechsel zwischen Gastario-Modulen immer
   * am Seitenanfang starten. Änderungen an Filtern
   * und Query-Parametern derselben Route behalten
   * ihre aktuelle Scrollposition.
   */
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

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

  useEffect(() => {
    const loadCounts = () => {
      countFetcher.load(
        "/api/navigation-counts"
      );
    };

    loadCounts();

    const refreshInterval =
      window.setInterval(
        loadCounts,
        60000
      );

    return () => {
      window.clearInterval(
        refreshInterval
      );
    };
  }, []);

  const toggleNavigationGroup = (
    groupId: string
  ) => {
    if (groupId === "overview") {
      return;
    }

    setOpenGroupIds(
      (currentGroupIds) => {
        const nextGroupIds =
          isMobileNavigation
            ? currentGroupIds.includes(
                groupId
              )
              ? []
              : [groupId]
            : currentGroupIds.includes(
                  groupId
                )
              ? currentGroupIds.filter(
                  (currentGroupId) =>
                    currentGroupId !==
                    groupId
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
      }
    );
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
          aria-expanded={
            isMobileSidebarOpen
          }
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
          (
            isMobileSidebarOpen
              ? " isVisible"
              : ""
          )
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
        ref={sidebarRef}
        onScroll={(event) => {
          if (
            !isMobileNavigation &&
            sidebarScrollReadyRef.current
          ) {
            window.sessionStorage.setItem(
              sidebarScrollStorageKey,
              String(
                event.currentTarget.scrollTop
              )
            );
          }
        }}
        className={
          "sidebar" +
          (
            isMobileSidebarOpen
              ? " isMobileOpen"
              : ""
          )
        }
      >
        <div className="brand">
          <Link
            to="/"
            className="sidebarBrandLink"
            aria-label="Zum Dashboard"
            onClick={() => {
              rememberSidebarScrollPosition();
              setIsMobileSidebarOpen(false);
            }}
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
            onClick={() => {
              rememberSidebarScrollPosition();
              setIsMobileSidebarOpen(false);
            }}
            aria-label="Navigation schließen"
          >
            ×
          </button>
        </div>

        <nav
          className="navGroups navAccordion"
          aria-label="Hauptnavigation"
        >
          {navigationGroups.map(
            (group) => {
              const isOverview =
                group.id === "overview";

              const groupContainsActiveItem =
                group.items.some((item) =>
                  isNavigationItemActive(
                    item.to
                  )
                );

              const isOpen =
                isOverview ||
                openGroupIds.includes(
                  group.id
                ) ||
                groupContainsActiveItem;

              const groupCount =
                countForKeys(
                  group.countKeys
                );

              return (
                <div
                  className={
                    "navGroup navAccordionGroup" +
                    (
                      isOpen
                        ? " isOpen"
                        : ""
                    ) +
                    (
                      groupContainsActiveItem
                        ? " hasActiveItem"
                        : ""
                    )
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
                        toggleNavigationGroup(
                          group.id
                        )
                      }
                      aria-expanded={isOpen}
                      aria-controls={
                        "navigation-group-" +
                        group.id
                      }
                    >
                      <span className="navAccordionTriggerContent">
                        <span>
                          {group.label}
                        </span>

                        {groupCount > 0 ? (
                          <span
                            className="navCountBadge navCountBadgeGroup"
                            aria-label={
                              groupCount +
                              " offene Vorgänge"
                            }
                          >
                            {formatNavigationCount(
                              groupCount
                            )}
                          </span>
                        ) : null}
                      </span>

                      <span
                        className="navAccordionChevron"
                        aria-hidden="true"
                      >
                        ›
                      </span>
                    </button>
                  )}

                  <div
                    id={
                      "navigation-group-" +
                      group.id
                    }
                    className="navAccordionItems"
                    hidden={!isOpen}
                  >
                    {group.items.map(
                      (item) => {
                        const isActive =
                          isNavigationItemActive(
                            item.to
                          );

                        const itemCount =
                          item.countKey
                            ? Number(
                                navigationCounts[
                                  item.countKey
                                ] || 0
                              )
                            : 0;

                        return (
                          <Link
                            onClick={() => {
                              rememberSidebarScrollPosition();
                              setIsMobileSidebarOpen(
                                false
                              );
                            }}
                            className={
                              isActive
                                ? "active"
                                : undefined
                            }
                            to={item.to}
                            key={item.to}
                          >
                            <span className="navItemLabel">
                              {item.label}
                            </span>

                            {itemCount > 0 ? (
                              <span
                                className="navCountBadge"
                                aria-label={
                                  itemCount +
                                  " offene Vorgänge"
                                }
                              >
                                {formatNavigationCount(
                                  itemCount
                                )}
                              </span>
                            ) : null}
                          </Link>
                        );
                      }
                    )}
                  </div>
                </div>
              );
            }
          )}
        </nav>

        <div className="sidebarFooter">
          <a
            className="sidebarLogoutButton"
            href="/logout"
          >
            Ausloggen
          </a>
        </div>
      </aside>

      <section className="workspace">
        {children}
      </section>
    </main>
  );
}