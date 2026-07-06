const fs = require("fs");

const path = "app/routes/auftraege.tsx";
let content = fs.readFileSync(path, "utf8");

// Loader: Query-Parameter ergänzen
if (!content.includes('const searchQuery = url.searchParams.get("q") || "";')) {
  content = content.replace(
`  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";`,
`  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const searchQuery = url.searchParams.get("q") || "";
  const dateRange = url.searchParams.get("dateRange") || "";

  let deliveryDateStart: Date | null = null;
  let deliveryDateEnd: Date | null = null;

  if (dateRange) {
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

// Order-Where erweitern
if (!content.includes("deliveryDateStart && deliveryDateEnd")) {
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
}

// Sortierung nach Lieferdatum
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

// Return ergänzen
if (!content.includes("searchQuery,")) {
  content = content.replace(
`      activeStatus: status,`,
`      activeStatus: status,
      searchQuery,
      dateRange,`
  );
}

// FilterActions Block robust ersetzen
const start = content.indexOf('          <div className="filterActions">');

if (start === -1) {
  throw new Error("filterActions Start nicht gefunden.");
}

const endMarker = `          </div>
        </div>

        <div className="ordersTable">`;

const end = content.indexOf(endMarker, start);

if (end === -1) {
  throw new Error("filterActions Ende nicht gefunden.");
}

const newBlock = `          <div className="ordersFilterWrap">
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
              {STATUSES.map((status) => {
                const params = new URLSearchParams();

                if (status.value) params.set("status", status.value);
                if (data.searchQuery) params.set("q", data.searchQuery);
                if (data.dateRange) params.set("dateRange", data.dateRange);

                const href = params.toString() ? "/auftraege?" + params.toString() : "/auftraege";

                return (
                  <Link
                    key={status.value || "all"}
                    className={"ghostButton " + (data.activeStatus === status.value ? "activeFilter" : "")}
                    to={href}
                  >
                    {status.label}
                  </Link>
                );
              })}
            </div>
          </div>`;

content = content.slice(0, start) + newBlock + content.slice(end);

// CSS ergänzen
if (!content.includes("/* orders-real-filter-v4 */")) {
  const css = `
      <style>{\`
        /* orders-real-filter-v4 */
        .panelHeader {
          align-items: flex-start !important;
          gap: 18px !important;
        }

        .ordersFilterWrap {
          display: grid !important;
          gap: 10px !important;
          justify-items: end !important;
          max-width: 780px !important;
        }

        .ordersFilterForm {
          display: flex !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
          align-items: end !important;
          justify-content: flex-end !important;
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

        .activeFilter,
        .primaryGhostButton {
          background: #0f9f7a !important;
          color: #ffffff !important;
          border-color: #0f9f7a !important;
          box-shadow: 0 10px 22px rgba(15, 159, 122, 0.18) !important;
        }

        @media (max-width: 1180px) {
          .panelHeader {
            display: grid !important;
          }

          .ordersFilterWrap {
            justify-items: stretch !important;
            max-width: none !important;
          }

          .ordersFilterForm,
          .statusFilterGroup {
            justify-content: flex-start !important;
          }
        }
      \`}</style>
`;

  content = content.replace("</AppLayout>", css + "\n    </AppLayout>");
}

fs.writeFileSync(path, content, "utf8");
console.log("Aufträge: Filterblock robust ersetzt.");
