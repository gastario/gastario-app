const fs = require("fs");

const path = "app/components/AppLayout.tsx";
let content = fs.readFileSync(path, "utf8");

if (!content.includes("/* gastario-global-lexoffice-style */")) {
  const globalStyle = `
      <style>{\`
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
      \`}</style>
`;

  content = content.replace("</style>", "</style>" + globalStyle);
}

fs.writeFileSync(path, content, "utf8");
console.log("Globaler Gastario Lexoffice-Style eingefuegt.");
