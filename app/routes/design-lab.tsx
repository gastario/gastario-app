import { useState } from "react";

import { requireSuperAdmin } from "../lib/session.server";

import "../styles/design-lab.css";

type ThemeId =
  | "intelligence"
  | "precision"
  | "operations";

type DeviceId =
  | "desktop"
  | "mobile";

const themeOptions: Array<{
  id: ThemeId;
  label: string;
  eyebrow: string;
  description: string;
  traits: string[];
}> = [
  {
    id: "intelligence",
    label: "Intelligence Workspace",
    eyebrow: "Variante A",
    description:
      "Hochwertig, ruhig und intelligent. Klare Markenwirkung mit weichen Flächen und modernen Assistenzhinweisen.",
    traits: [
      "Premium",
      "Luftig",
      "Intelligent",
    ],
  },
  {
    id: "precision",
    label: "Precision Minimal",
    eyebrow: "Variante B",
    description:
      "Konzentrierte Business-Software mit klarer Typografie, weniger Dekoration und hoher Präzision.",
    traits: [
      "Minimal",
      "Sachlich",
      "Schnell",
    ],
  },
  {
    id: "operations",
    label: "Operations Control",
    eyebrow: "Variante C",
    description:
      "Kompakteres Kontrollzentrum für Aufträge, Produktion, Einkauf und Lieferungen.",
    traits: [
      "Operativ",
      "Dicht",
      "Kontrolliert",
    ],
  },
];

const navigationItems = [
  {
    icon: "⌂",
    label: "Übersicht",
    active: true,
  },
  {
    icon: "▤",
    label: "Aufträge",
  },
  {
    icon: "✦",
    label: "Anfragen",
    badge: "6",
  },
  {
    icon: "◫",
    label: "Produktion",
  },
  {
    icon: "⇄",
    label: "Einkauf",
  },
  {
    icon: "⌁",
    label: "Lieferungen",
  },
];

const metrics = [
  {
    label: "Offene Aufträge",
    value: "24",
    trend: "+8 %",
    tone: "positive",
  },
  {
    label: "Heute auszuliefern",
    value: "11",
    trend: "3 kritisch",
    tone: "warning",
  },
  {
    label: "Monatsumsatz",
    value: "48.620 €",
    trend: "+12,4 %",
    tone: "positive",
  },
  {
    label: "Offene Prüfungen",
    value: "6",
    trend: "KI geprüft",
    tone: "neutral",
  },
];

const orders = [
  {
    id: "#GA-2684",
    customer: "NinjaOne GmbH",
    date: "Heute, 11:30",
    amount: "1.482,00 €",
    status: "Produktion",
    statusTone: "progress",
  },
  {
    id: "#GA-2683",
    customer: "Urban Sports Club",
    date: "Heute, 13:00",
    amount: "896,50 €",
    status: "Bestätigt",
    statusTone: "success",
  },
  {
    id: "#GA-2682",
    customer: "HeyJobs GmbH",
    date: "Morgen, 09:30",
    amount: "2.140,00 €",
    status: "Prüfung",
    statusTone: "warning",
  },
  {
    id: "#GA-2681",
    customer: "Zalando SE",
    date: "Morgen, 12:00",
    amount: "1.264,00 €",
    status: "Entwurf",
    statusTone: "neutral",
  },
];

const activities = [
  {
    time: "Vor 4 Min.",
    title: "Auftrag automatisch erkannt",
    text: "Heycater-Lieferschein wurde dem Auftrag #GA-2684 zugeordnet.",
    tone: "success",
  },
  {
    time: "Vor 18 Min.",
    title: "Preisänderung erkannt",
    text: "Hähnchenbrust ist bei einem Lieferanten 8,2 % günstiger.",
    tone: "warning",
  },
  {
    time: "Vor 42 Min.",
    title: "Produktionshinweis",
    text: "Für zwei morgige Aufträge fehlen noch Mengenangaben.",
    tone: "neutral",
  },
];

export async function loader({
  request,
}: {
  request: Request;
}) {
  await requireSuperAdmin(request);

  return null;
}

export default function DesignLabPage() {
  const [theme, setTheme] =
    useState<ThemeId>("intelligence");

  const [device, setDevice] =
    useState<DeviceId>("desktop");

  const activeTheme =
    themeOptions.find(
      (option) => option.id === theme
    ) || themeOptions[0];

  return (
    <main className="designLabPage">
      <section className="designLabIntro">
        <div className="designLabIntroCopy">
          <div className="designLabBrandRow">
            <img
              src="/brand/gastario-logo-full.png"
              alt="Gastario"
            />

            <span>
              Design System 2026
            </span>
          </div>

          <p className="designLabEyebrow">
            Gastario Intelligence Workspace
          </p>

          <h1>
            Wir legen das neue zentrale
            Gastario-Design fest.
          </h1>

          <p className="designLabLead">
            Wähle eine Richtung und vergleiche
            direkt Desktop und Mobil. Danach
            übertragen wir das ausgewählte System
            zentral auf alle Routen.
          </p>
        </div>

        <aside className="designLabPlan">
          <span className="designLabPlanNumber">
            01
          </span>

          <div>
            <strong>
              Erst Design festlegen
            </strong>

            <p>
              Danach Tokens, Komponenten,
              App-Layout und einzelne Routen
              kontrolliert umstellen.
            </p>
          </div>
        </aside>
      </section>

      <section className="designLabThemeGrid">
        {themeOptions.map((option) => {
          const selected =
            option.id === theme;

          return (
            <button
              key={option.id}
              type="button"
              className={
                selected
                  ? "designLabThemeCard isSelected"
                  : "designLabThemeCard"
              }
              onClick={() => {
                setTheme(option.id);
              }}
              aria-pressed={selected}
            >
              <div
                className={
                  `designLabThemeVisual ` +
                  `designLabThemeVisual--${option.id}`
                }
                aria-hidden="true"
              >
                <span className="themeVisualSidebar" />

                <div className="themeVisualMain">
                  <span className="themeVisualHeader" />

                  <div className="themeVisualCards">
                    <span />
                    <span />
                    <span />
                  </div>

                  <span className="themeVisualTable" />
                </div>
              </div>

              <div className="designLabThemeCardBody">
                <span className="designLabThemeEyebrow">
                  {option.eyebrow}
                </span>

                <strong>
                  {option.label}
                </strong>

                <p>
                  {option.description}
                </p>

                <div className="designLabTraitRow">
                  {option.traits.map((trait) => (
                    <span key={trait}>
                      {trait}
                    </span>
                  ))}
                </div>
              </div>

              <span className="designLabSelection">
                {selected ? "Ausgewählt" : "Ansehen"}
              </span>
            </button>
          );
        })}
      </section>

      <section className="designLabPreviewSection">
        <header className="designLabPreviewHeader">
          <div>
            <p>
              Live-Vorschau
            </p>

            <h2>
              {activeTheme.label}
            </h2>

            <span>
              Aufbau, Typografie, Navigation,
              Karten, Tabelle und mobile Ansicht.
            </span>
          </div>

          <div
            className="designLabDeviceSwitch"
            aria-label="Vorschaugröße"
          >
            <button
              type="button"
              className={
                device === "desktop"
                  ? "isActive"
                  : ""
              }
              onClick={() => {
                setDevice("desktop");
              }}
              aria-pressed={
                device === "desktop"
              }
            >
              Desktop
            </button>

            <button
              type="button"
              className={
                device === "mobile"
                  ? "isActive"
                  : ""
              }
              onClick={() => {
                setDevice("mobile");
              }}
              aria-pressed={
                device === "mobile"
              }
            >
              Mobil
            </button>
          </div>
        </header>

        <div className="designLabStage">
          <div
            className="designLabViewport"
            data-theme={theme}
            data-device={device}
          >
            <div className="demoApp">
              <aside className="demoSidebar">
                <div className="demoSidebarBrand">
                  <img
                    src="/brand/gastario-logo-full.png"
                    alt=""
                  />

                  <button
                    type="button"
                    aria-label="Navigation einklappen"
                  >
                    ‹
                  </button>
                </div>

                <nav className="demoNavigation">
                  <span className="demoNavSection">
                    Arbeitsbereich
                  </span>

                  {navigationItems.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={
                        item.active
                          ? "demoNavItem isActive"
                          : "demoNavItem"
                      }
                    >
                      <span
                        className="demoNavIcon"
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>

                      <span>
                        {item.label}
                      </span>

                      {item.badge ? (
                        <small>
                          {item.badge}
                        </small>
                      ) : null}
                    </button>
                  ))}
                </nav>

                <div className="demoSidebarFooter">
                  <div className="demoUserAvatar">
                    EM
                  </div>

                  <div>
                    <strong>
                      Edis Mutluer
                    </strong>

                    <span>
                      Administrator
                    </span>
                  </div>
                </div>
              </aside>

              <div className="demoWorkspace">
                <header className="demoTopbar">
                  <button
                    type="button"
                    className="demoMobileMenu"
                    aria-label="Menü öffnen"
                  >
                    ☰
                  </button>

                  <div className="demoSearch">
                    <span aria-hidden="true">
                      ⌕
                    </span>

                    <span>
                      Gastario durchsuchen
                    </span>

                    <kbd>
                      ⌘ K
                    </kbd>
                  </div>

                  <div className="demoTopbarActions">
                    <button
                      type="button"
                      aria-label="Benachrichtigungen"
                    >
                      ◌
                    </button>

                    <button
                      type="button"
                      className="demoProfile"
                    >
                      EM
                    </button>
                  </div>
                </header>

                <main className="demoContent">
                  <header className="demoPageHeader">
                    <div>
                      <p>
                        Samstag, 1. August
                      </p>

                      <h1>
                        Guten Abend, Edis.
                      </h1>

                      <span>
                        Hier ist dein aktueller
                        Betriebsüberblick.
                      </span>
                    </div>

                    <div className="demoHeaderActions">
                      <button
                        type="button"
                        className="demoSecondaryButton"
                      >
                        Bericht öffnen
                      </button>

                      <button
                        type="button"
                        className="demoPrimaryButton"
                      >
                        <span aria-hidden="true">
                          +
                        </span>

                        Neuer Auftrag
                      </button>
                    </div>
                  </header>

                  <section className="demoIntelligencePanel">
                    <div className="demoAiIcon">
                      ✦
                    </div>

                    <div className="demoIntelligenceCopy">
                      <span>
                        Gastario Intelligence
                      </span>

                      <strong>
                        Drei Punkte benötigen heute
                        deine Aufmerksamkeit.
                      </strong>

                      <p>
                        Zwei Lieferungen sind noch
                        unbestätigt. Bei einem
                        Einkaufsartikel wurde ein
                        günstigerer Preis erkannt.
                      </p>
                    </div>

                    <button type="button">
                      Hinweise prüfen
                    </button>
                  </section>

                  <section className="demoMetrics">
                    {metrics.map((metric) => (
                      <article
                        key={metric.label}
                        className="demoMetricCard"
                      >
                        <div>
                          <span>
                            {metric.label}
                          </span>

                          <small
                            data-tone={metric.tone}
                          >
                            {metric.trend}
                          </small>
                        </div>

                        <strong>
                          {metric.value}
                        </strong>

                        <div className="demoMetricLine">
                          <span />
                        </div>
                      </article>
                    ))}
                  </section>

                  <section className="demoMainGrid">
                    <article className="demoPanel demoOrdersPanel">
                      <header className="demoPanelHeader">
                        <div>
                          <span>
                            Aufträge
                          </span>

                          <h2>
                            Nächste Lieferungen
                          </h2>
                        </div>

                        <button type="button">
                          Alle anzeigen
                        </button>
                      </header>

                      <div className="demoOrderTable">
                        <div className="demoOrderRow demoOrderRowHeader">
                          <span>
                            Auftrag
                          </span>

                          <span>
                            Kunde
                          </span>

                          <span>
                            Lieferung
                          </span>

                          <span>
                            Status
                          </span>

                          <span>
                            Betrag
                          </span>
                        </div>

                        {orders.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            className="demoOrderRow"
                          >
                            <strong>
                              {order.id}
                            </strong>

                            <span className="demoCustomerCell">
                              <i>
                                {order.customer
                                  .slice(0, 1)}
                              </i>

                              <span>
                                {order.customer}
                              </span>
                            </span>

                            <span>
                              {order.date}
                            </span>

                            <span>
                              <small
                                className="demoStatus"
                                data-tone={
                                  order.statusTone
                                }
                              >
                                {order.status}
                              </small>
                            </span>

                            <strong>
                              {order.amount}
                            </strong>
                          </button>
                        ))}
                      </div>
                    </article>

                    <article className="demoPanel demoActivityPanel">
                      <header className="demoPanelHeader">
                        <div>
                          <span>
                            Live
                          </span>

                          <h2>
                            Aktivitäten
                          </h2>
                        </div>

                        <button
                          type="button"
                          aria-label="Weitere Optionen"
                        >
                          ···
                        </button>
                      </header>

                      <div className="demoActivityList">
                        {activities.map((activity) => (
                          <div
                            key={activity.title}
                            className="demoActivity"
                          >
                            <span
                              className="demoActivityDot"
                              data-tone={
                                activity.tone
                              }
                            />

                            <div>
                              <small>
                                {activity.time}
                              </small>

                              <strong>
                                {activity.title}
                              </strong>

                              <p>
                                {activity.text}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="demoActivityButton"
                      >
                        Aktivitätsprotokoll öffnen
                      </button>
                    </article>
                  </section>
                </main>

                <nav className="demoMobileNavigation">
                  {navigationItems
                    .slice(0, 4)
                    .map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className={
                          item.active
                            ? "isActive"
                            : ""
                        }
                      >
                        <span aria-hidden="true">
                          {item.icon}
                        </span>

                        <small>
                          {item.label}
                        </small>
                      </button>
                    ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="designLabDecision">
        <div>
          <p>
            Nächster Schritt
          </p>

          <h2>
            Eine Variante wird zur verbindlichen
            Gastario-Basis.
          </h2>
        </div>

        <p>
          Danach erstellen wir zentrale Tokens,
          Buttons, Formulare, Karten, Tabellen,
          Navigation und Responsive-Regeln. Erst
          anschließend stellen wir Route für Route
          um.
        </p>
      </section>
    </main>
  );
}