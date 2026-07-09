import { Link, useLocation } from "react-router";

const navigationGroups = [
  {
    label: "Uebersicht",
    items: [
      { label: "Dashboard", to: "/" },
    ],
  },
  {
    label: "Auftraege",
    items: [
      { label: "Auftragseingang", to: "/auftragseingang" },
      { label: "Bevorstehende Auftraege", to: "/auftraege" },
      { label: "Vergangene Auftraege", to: "/auftraege?view=past" },
      { label: "Neuer Auftrag", to: "/neuer-auftrag" },
    ],
  },
  {
    label: "Import",
    items: [
      { label: "PDF importieren", to: "/import-pruefen" },
      { label: "E-Mail-Import", to: "/importe" },
      { label: "Import-Regeln", to: "/import-regeln" },
    ],
  },
  {
    label: "Verkauf",
    items: [
      { label: "Angebote", to: "/angebote" },
      { label: "Kunden", to: "/kunden" },
      { label: "Produkte", to: "/produkte" },
      { label: "Produkt-Import", to: "/produkte/import" },
    ],
  },
  {
    label: "Finanzen",
    items: [
      { label: "Rechnungen", to: "/rechnungen" },
      { label: "Neue Rechnung", to: "/rechnungen/neu" },
      { label: "Belege", to: "/belege" },
      { label: "Steuerberater-Export", to: "/steuerberater-export" },
      { label: "Rechnungsdaten", to: "/einstellungen/rechnungen" },
    ],
  },
  {
    label: "Produktion & Labels",
    items: [
      { label: "Produktion", to: "/produktion" },
      { label: "MHD-Labels", to: "/mhd-labels" },
      { label: "Foodlabel erstellen", to: "/foodlabels" },
      { label: "Packlisten", to: "/packlisten" },
    ],
  },
  {
    label: "Lieferung",
    items: [
      { label: "Lieferscheine", to: "/lieferscheine" },
      { label: "Fahrerzettel", to: "/fahrerzettel" },
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
    label: "Konto",
    items: [
      { label: "Plan & Abo", to: "/konto/abo" },
    ],
  },
  {
    label: "System",
    items: [
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
      `}</style>


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
                    : item.to === "/rechnungen"
                      ? location.pathname === "/rechnungen"
                      : item.to === "/einstellungen"
                        ? location.pathname === "/einstellungen"
                        : location.pathname === item.to || location.pathname.startsWith(item.to + "/");

                return (
                  <Link preventScrollReset className={isActive ? "active" : undefined} to={item.to} key={item.to}>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
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





