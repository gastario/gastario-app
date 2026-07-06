const fs = require("fs");

const path = "app/routes/auftraege.tsx";
let content = fs.readFileSync(path, "utf8");

// 1) Umlaute und kaputte Zeichen
const replacements = [
  ["Â·", "·"],
  ["Auftraege", "Aufträge"],
  ["Aktuelle Auftraege", "Aktuelle Aufträge"],
  ["Auftraege gesamt", "Aufträge gesamt"],
  ["Auftragsuebersicht", "Auftragsübersicht"],
  ["AUFTRAGSUEBERSICHT", "AUFTRAGSÜBERSICHT"],
  ["Pruefen", "Prüfen"],
  ["Pruefseite", "Prüfseite"],
  ["Bestaetigt", "Bestätigt"],
  ["bestaetigt", "bestätigt"],
  ["uebernommene", "übernommene"],
  ["Oeffnen", "Öffnen"],
  ["Loeschen", "Löschen"],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

// 2) Beträge immer aus totalCents lesen
content = content.replaceAll(
  "(item.totalPriceCents || 0)",
  "(item.totalCents || item.totalPriceCents || 0)"
);

// 3) Doppelte Aktion entfernen: Öffnen + Prüfseite zeigen auf dieselbe Seite.
// Wir behalten nur einen schönen Button "Prüfen".
content = content.replace(
/\s*<Link className="ghostButton" to=\{"\/auftrag-pruefung\/" \+ order\.id\}>\s*Öffnen\s*<\/Link>\s*<Link className="ghostButton" to=\{"\/auftrag-pruefung\/" \+ order\.id\}>\s*Prüfseite\s*<\/Link>/g,
`
                    <Link className="ghostButton primaryGhostButton" to={"/auftrag-pruefung/" + order.id}>
                      Prüfen
                    </Link>`
);

content = content.replace(
/\s*<Link className="ghostButton" to=\{"\/auftrag-pruefung\/" \+ order\.id\}>\s*Öffnen\s*<\/Link>/g,
""
);

content = content.replace(
/<Link className="ghostButton" to=\{"\/auftrag-pruefung\/" \+ order\.id\}>\s*Prüfseite\s*<\/Link>/g,
`<Link className="ghostButton primaryGhostButton" to={"/auftrag-pruefung/" + order.id}>
                      Prüfen
                    </Link>`
);

// 4) Falls Datum noch nicht im Loader ist: ergänzen
if (!content.includes("const selectedDate = url.searchParams.get(\"date\")")) {
  content = content.replace(
`  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";`,
`  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const selectedDate = url.searchParams.get("date") || "";
  const selectedDateStart = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  const selectedDateEnd = selectedDateStart ? new Date(selectedDateStart) : null;

  if (selectedDateEnd) {
    selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
  }`
  );
}

// 5) Falls Datumsfilter noch nicht in order where ist: ergänzen
if (!content.includes("deliveryDate: {") && content.includes("selectedDateStart && selectedDateEnd")) {
  content = content.replace(
`          ...(status ? { status: status as any } : {}),
        },`,
`          ...(status ? { status: status as any } : {}),
          ...(selectedDateStart && selectedDateEnd
            ? {
                deliveryDate: {
                  gte: selectedDateStart,
                  lt: selectedDateEnd,
                },
              }
            : {}),
        },`
  );
}

// 6) Sortierung nach Lieferdatum
content = content.replace(
`        orderBy: {
          createdAt: "desc",
        },`,
`        orderBy: [
          { deliveryDate: "asc" },
          { createdAt: "desc" },
        ],`
);

// 7) selectedDate zurückgeben
if (!content.includes("selectedDate,")) {
  content = content.replace(
`      activeStatus: status,`,
`      activeStatus: status,
      selectedDate,`
  );
}

// 8) Filterleiste schöner machen
content = content.replace(
/<div className="sectionActions">[\s\S]*?<Link className="ghostButton" to="\/auftraege\?status=REJECTED">[\s\S]*?Abgelehnt[\s\S]*?<\/Link>\s*<\/div>/,
`<div className="sectionActions niceFilterBar">
            <Form method="get" className="dateFilterForm">
              {data.activeStatus ? (
                <input type="hidden" name="status" value={data.activeStatus} />
              ) : null}

              <input
                type="date"
                name="date"
                defaultValue={data.selectedDate || ""}
                className="dateFilterInput"
              />

              <button className="ghostButton" type="submit">
                Datum anzeigen
              </button>
            </Form>

            <Link className={"ghostButton " + (!data.activeStatus ? "activeFilter" : "")} to="/auftraege">
              Alle
            </Link>

            <Link className={"ghostButton " + (data.activeStatus === "AUTO_CREATED" ? "activeFilter" : "")} to="/auftraege?status=AUTO_CREATED">
              Prüfen
            </Link>

            <Link className={"ghostButton " + (data.activeStatus === "CONFIRMED" ? "activeFilter" : "")} to="/auftraege?status=CONFIRMED">
              Bestätigt
            </Link>

            <Link className={"ghostButton " + (data.activeStatus === "REJECTED" ? "activeFilter" : "")} to="/auftraege?status=REJECTED">
              Abgelehnt
            </Link>
          </div>`
);

// 9) CSS für schöne Buttons/Filter/Actions ans Ende vor AppLayout-Ende
if (!content.includes("/* auftraege-polish-v2 */")) {
  const css = `
      <style>{\`
        /* auftraege-polish-v2 */
        .niceFilterBar {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
        }

        .dateFilterForm {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
        }

        .dateFilterInput {
          height: 38px !important;
          border: 1px solid #d6e1ea !important;
          border-radius: 999px !important;
          padding: 0 13px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 850 !important;
          outline: none !important;
        }

        .ghostButton {
          min-height: 38px !important;
          border-radius: 999px !important;
          padding: 8px 14px !important;
          border: 1px solid #d6e1ea !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 950 !important;
          text-decoration: none !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
          cursor: pointer !important;
          white-space: nowrap !important;
        }

        .ghostButton:hover {
          border-color: #0f9f7a !important;
          color: #047857 !important;
          background: #f0fdf4 !important;
        }

        .activeFilter {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        .primaryGhostButton {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        .orderStatus {
          border-radius: 999px !important;
          padding: 7px 11px !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }

        .orderRow {
          min-height: 96px !important;
          align-items: center !important;
        }

        .orderRow small {
          color: #64748b !important;
          line-height: 1.35 !important;
        }

        .orderRow form button {
          min-height: 38px !important;
          border-radius: 999px !important;
          border: 1px solid #fecaca !important;
          background: #fff7f7 !important;
          color: #b91c1c !important;
          font-weight: 950 !important;
          padding: 8px 14px !important;
          cursor: pointer !important;
        }

        .orderRow form button:hover {
          background: #fee2e2 !important;
        }

        @media (max-width: 1100px) {
          .niceFilterBar {
            justify-content: flex-start !important;
          }
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

fs.writeFileSync(path, content, "utf8");
console.log("Aufträge: Buttons, Filter und Optik verbessert.");
