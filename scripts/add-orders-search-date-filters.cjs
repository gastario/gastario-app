const fs = require("fs");

const path = "app/routes/auftraege.tsx";
let content = fs.readFileSync(path, "utf8");

// URL-Parameter ergänzen
if (!content.includes('const searchQuery = url.searchParams.get("q") || "";')) {
  content = content.replace(
`  const status = url.searchParams.get("status") || "";`,
`  const status = url.searchParams.get("status") || "";
  const searchQuery = url.searchParams.get("q") || "";
  const dateRange = url.searchParams.get("dateRange") || "";
  const selectedDate = url.searchParams.get("date") || "";

  let deliveryDateStart = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  let deliveryDateEnd = deliveryDateStart ? new Date(deliveryDateStart) : null;

  if (deliveryDateEnd) {
    deliveryDateEnd.setDate(deliveryDateEnd.getDate() + 1);
  }

  if (!selectedDate && dateRange) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === "today") {
      deliveryDateStart = new Date(today);
      deliveryDateEnd = new Date(today);
      deliveryDateEnd.setDate(deliveryDateEnd.getDate() + 1);
    }

    if (dateRange === "tomorrow") {
      deliveryDateStart = new Date(today);
      deliveryDateStart.setDate(deliveryDateStart.getDate() + 1);
      deliveryDateEnd = new Date(deliveryDateStart);
      deliveryDateEnd.setDate(deliveryDateEnd.getDate() + 1);
    }

    if (dateRange === "week") {
      deliveryDateStart = new Date(today);
      deliveryDateEnd = new Date(today);
      deliveryDateEnd.setDate(deliveryDateEnd.getDate() + 7);
    }
  }`
  );
}

// Where-Filter erweitern
content = content.replace(
`          ...(status ? { status: status as any } : {}),
        },`,
`          ...(status ? { status: status as any } : {}),
          ...(deliveryDateStart && deliveryDateEnd
            ? {
                deliveryDate: {
                  gte: deliveryDateStart,
                  lt: deliveryDateEnd,
                },
              }
            : {}),
          ...(searchQuery
            ? {
                OR: [
                  { orderNumber: { contains: searchQuery, mode: "insensitive" } },
                  { customerName: { contains: searchQuery, mode: "insensitive" } },
                  { customerEmail: { contains: searchQuery, mode: "insensitive" } },
                  { deliveryAddress: { contains: searchQuery, mode: "insensitive" } },
                ],
              }
            : {}),
        },`
);

// Sortierung: Lieferdatum zuerst
content = content.replace(
`        orderBy: [
          { deliveryDate: "asc" },
          { createdAt: "desc" },
        ],`,
`        orderBy: [
          { deliveryDate: "asc" },
          { deliveryTimeText: "asc" },
          { createdAt: "desc" },
        ],`
);

content = content.replace(
`        orderBy: {
          createdAt: "desc",
        },`,
`        orderBy: [
          { deliveryDate: "asc" },
          { deliveryTimeText: "asc" },
          { createdAt: "desc" },
        ],`
);

// Return-Werte ergänzen
if (!content.includes("searchQuery,")) {
  content = content.replace(
`      activeStatus: status,`,
`      activeStatus: status,
      searchQuery,
      dateRange,
      selectedDate,`
  );
}

// Filterleiste ersetzen
content = content.replace(
/<div className="sectionActions[\s\S]*?<\/div>\s*<\/div>\s*<div className="ordersTable/s,
`<div className="sectionActions niceOrdersFilterBar">
            <Form method="get" className="ordersFilterForm">
              {data.activeStatus ? (
                <input type="hidden" name="status" value={data.activeStatus} />
              ) : null}

              <label className="filterLabel">
                Suche
                <input
                  type="search"
                  name="q"
                  defaultValue={data.searchQuery || ""}
                  placeholder="Kunde, Nummer, Adresse..."
                  className="filterInput"
                />
              </label>

              <label className="filterLabel">
                Lieferzeitraum
                <select
                  name="dateRange"
                  defaultValue={data.dateRange || ""}
                  className="filterInput"
                >
                  <option value="">Alle Lieferungen</option>
                  <option value="today">Heute</option>
                  <option value="tomorrow">Morgen</option>
                  <option value="week">Nächste 7 Tage</option>
                </select>
              </label>

              <button className="ghostButton primaryGhostButton" type="submit">
                Filtern
              </button>

              <Link className="ghostButton" to={data.activeStatus ? "/auftraege?status=" + data.activeStatus : "/auftraege"}>
                Zurücksetzen
              </Link>
            </Form>

            <div className="statusFilterGroup">
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
            </div>
          </div>
        </div>

        <div className="ordersTable`
);

// CSS ergänzen
if (!content.includes("/* orders-filter-redesign */")) {
  const css = `
      <style>{\`
        /* orders-filter-redesign */
        .niceOrdersFilterBar {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 14px !important;
          align-items: end !important;
          margin-top: 14px !important;
        }

        .ordersFilterForm {
          display: flex !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
          align-items: end !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 20px !important;
          padding: 10px !important;
        }

        .statusFilterGroup {
          display: flex !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
          justify-content: flex-end !important;
        }

        .filterLabel {
          display: grid !important;
          gap: 5px !important;
          color: #64748b !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          text-transform: uppercase !important;
          letter-spacing: .06em !important;
        }

        .filterInput {
          min-width: 210px !important;
          height: 42px !important;
          border: 1px solid #d6e1ea !important;
          border-radius: 16px !important;
          padding: 0 13px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          font-weight: 850 !important;
          outline: none !important;
        }

        .filterInput:focus {
          border-color: #99d5ca !important;
          box-shadow: 0 0 0 4px rgba(15, 159, 122, 0.10) !important;
        }

        .ghostButton {
          min-height: 42px !important;
          border-radius: 999px !important;
          padding: 9px 15px !important;
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

        .primaryGhostButton,
        .activeFilter {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        @media (max-width: 1150px) {
          .niceOrdersFilterBar {
            grid-template-columns: 1fr !important;
          }

          .statusFilterGroup {
            justify-content: flex-start !important;
          }
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

fs.writeFileSync(path, content, "utf8");
console.log("Aufträge: Suche, Lieferzeitraum und Statusfilter ergänzt.");
