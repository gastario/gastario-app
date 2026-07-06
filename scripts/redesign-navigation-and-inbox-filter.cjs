const fs = require("fs");

const inboxPath = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(inboxPath, "utf8");

// Datum-Range ergänzen
content = content.replace(
`  const selectedDate = url.searchParams.get("date") || "";
  const selectedEmailCategory = url.searchParams.get("emailCategory") || "orders";
  const searchQuery = url.searchParams.get("q") || "";
  const selectedDateStart = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  const selectedDateEnd = selectedDateStart ? new Date(selectedDateStart) : null;

  if (selectedDateEnd) selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);`,
`  const selectedDate = url.searchParams.get("date") || "";
  const selectedEmailCategory = url.searchParams.get("emailCategory") || "orders";
  const searchQuery = url.searchParams.get("q") || "";
  const dateRange = url.searchParams.get("dateRange") || "";

  let selectedDateStart = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  let selectedDateEnd = selectedDateStart ? new Date(selectedDateStart) : null;

  if (selectedDateEnd) selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);

  if (!selectedDate && dateRange) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === "today") {
      selectedDateStart = new Date(today);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "tomorrow") {
      selectedDateStart = new Date(today);
      selectedDateStart.setDate(selectedDateStart.getDate() + 1);
      selectedDateEnd = new Date(selectedDateStart);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "week") {
      selectedDateStart = new Date(today);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 7);
    }
  }`
);

// dateRange zurückgeben
content = content.replaceAll(
`      selectedDate,
      selectedEmailCategory,
      searchQuery,`,
`      selectedDate,
      selectedEmailCategory,
      searchQuery,
      dateRange,`
);

content = content.replaceAll(
`      selectedEmailCategory: "orders",
      searchQuery: "",
      emailBuckets:`,
`      selectedEmailCategory: "orders",
      searchQuery: "",
      dateRange: "",
      emailBuckets:`
);

// Kategorie-Links behalten Such- und Zeitraumfilter
content = content.replace(
`                if (data.selectedDate) params.set("date", data.selectedDate);
                if (data.searchQuery) params.set("q", data.searchQuery);
                params.set("emailCategory", bucket.key);`,
`                if (data.selectedDate) params.set("date", data.selectedDate);
                if (data.searchQuery) params.set("q", data.searchQuery);
                if (data.dateRange) params.set("dateRange", data.dateRange);
                params.set("emailCategory", bucket.key);`
);

// Alte Filterleiste ersetzen
content = content.replace(
/<Form method="get" style=\{\{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" \}\}>[\s\S]*?<a href=\{"\/auftragseingang\?emailCategory=" \+ data\.selectedEmailCategory\} style=\{secondaryButtonStyle\}>Filter löschen<\/a>/,
`<Form method="get" style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "end",
                  flexWrap: "wrap",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 20,
                  padding: 10,
                }}>
                  <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />

                  <label style={{
                    display: "grid",
                    gap: 5,
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                  }}>
                    Suche
                    <input
                      type="search"
                      name="q"
                      defaultValue={data.searchQuery || ""}
                      placeholder="Betreff, Absender oder Kunde"
                      style={{ ...inputStyle, minWidth: 270, borderRadius: 16 }}
                    />
                  </label>

                  <label style={{
                    display: "grid",
                    gap: 5,
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                  }}>
                    Zeitraum
                    <select
                      name="dateRange"
                      defaultValue={data.dateRange || ""}
                      style={{ ...inputStyle, minWidth: 190, borderRadius: 16 }}
                    >
                      <option value="">Alle Zeiträume</option>
                      <option value="today">Heute</option>
                      <option value="tomorrow">Morgen</option>
                      <option value="week">Nächste 7 Tage</option>
                    </select>
                  </label>

                  <button type="submit" style={{ ...primaryButtonStyle, height: 44 }}>
                    Filtern
                  </button>

                  <a href={"/auftragseingang?emailCategory=" + data.selectedEmailCategory} style={{ ...secondaryButtonStyle, height: 44 }}>
                    Zurücksetzen
                  </a>
                </Form>`
);

// Falls noch Datum-Text sichtbar ist
content = content.replaceAll("Datum", "Zeitraum");
content = content.replaceAll("Alle zeigen", "Zurücksetzen");

fs.writeFileSync(inboxPath, content, "utf8");

const layoutPath = "app/components/AppLayout.tsx";
let layout = fs.readFileSync(layoutPath, "utf8");

// Sidebar-Link und Umlaute sauber
layout = layout.replace('{ label: "Neuer Auftrag", to: "/auftragseingang" },', '{ label: "Neuer Auftrag", to: "/neuer-auftrag" },');

const layoutReplacements = [
  ['"Uebersicht"', '"Übersicht"'],
  ['"Auftraege"', '"Aufträge"'],
  ['"Bevorstehende Auftraege"', '"Bevorstehende Aufträge"'],
  ['"Vergangene Auftraege"', '"Vergangene Aufträge"'],
];

for (const [from, to] of layoutReplacements) {
  layout = layout.split(from).join(to);
}

// Aktiv-Logik eindeutiger machen
layout = layout.replace(
`                const isActive =
                  item.to === "/"
                    ? location.pathname === "/"
                    : item.to === "/rechnungen"
                      ? location.pathname === "/rechnungen"
                      : item.to === "/einstellungen"
                        ? location.pathname === "/einstellungen"
                        : location.pathname === item.to || location.pathname.startsWith(item.to + "/");`,
`                const isActive =
                  item.to === "/"
                    ? location.pathname === "/"
                    : item.to === "/auftragseingang"
                      ? location.pathname === "/auftragseingang" || location.pathname.startsWith("/auftrag-pruefung") || location.pathname.startsWith("/email-pruefung")
                      : item.to === "/auftraege"
                        ? location.pathname === "/auftraege"
                        : item.to === "/neuer-auftrag"
                          ? location.pathname === "/neuer-auftrag"
                          : item.to === "/rechnungen"
                            ? location.pathname === "/rechnungen"
                            : item.to === "/einstellungen"
                              ? location.pathname === "/einstellungen"
                              : location.pathname === item.to || location.pathname.startsWith(item.to + "/");`
);

// Sidebar optisch ruhiger
if (!layout.includes("/* sidebar-polish-v2 */")) {
  layout = layout.replace(
`          .navGroup a.active {
            background: linear-gradient(135deg, #e6f5f2, #f4faf9);
            border-color: #c9e4df;
            color: #064e42;
            box-shadow: inset 3px 0 0 var(--g-warn), 0 10px 24px rgba(15, 23, 42, 0.06);
          }`,
`          /* sidebar-polish-v2 */
          .navGroup {
            margin-bottom: 22px;
          }

          .navGroup p {
            letter-spacing: .10em;
            font-size: 11px;
            font-weight: 950;
            color: #77869a;
          }

          .navGroup a {
            min-height: 42px;
            border-radius: 15px;
            padding: 0 12px;
            display: flex;
            align-items: center;
            font-weight: 850;
            border: 1px solid transparent;
            transition: all .16s ease;
          }

          .navGroup a:hover {
            background: #f8fafc;
            border-color: #e2e8f0;
            transform: translateX(2px);
          }

          .navGroup a.active {
            background: linear-gradient(135deg, #e6f5f2, #f8fffd);
            border-color: #bfe4dc;
            color: #064e42;
            box-shadow: inset 4px 0 0 #f59e0b, 0 12px 26px rgba(15, 23, 42, 0.07);
            font-weight: 950;
          }`
  );
}

fs.writeFileSync(layoutPath, layout, "utf8");

console.log("Navigation und Auftragseingang-Filter neu gestaltet.");
