const fs = require("fs");

const path = "app/routes/auftraege.tsx";
let content = fs.readFileSync(path, "utf8");

// Umlaute / Texte reparieren
const replacements = [
  ["Auftraege", "Aufträge"],
  ["Auftraege gesamt", "Aufträge gesamt"],
  ["Aktuelle Auftraege", "Aktuelle Aufträge"],
  ["Pruefen", "Prüfen"],
  ["Pruefseite", "Prüfseite"],
  ["Bestaetigt", "Bestätigt"],
  ["bestaetigt", "bestätigt"],
  ["uebernommene", "übernommene"],
  ["Auftragsuebersicht", "Auftragsübersicht"],
  ["AUFTRAGSUEBERSICHT", "AUFTRAGSÜBERSICHT"],
  ["Oeffnen", "Öffnen"],
  ["Loeschen", "Löschen"],
  ["geprueft", "geprüft"],
  ["Auftragswert", "Auftragswert"],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

// URL-Parameter für Datum ergänzen
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

// where um Datumsfilter erweitern
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

// Sortierung nach Lieferdatum zuerst, dann createdAt
content = content.replace(
`        orderBy: {
          createdAt: "desc",
        },`,
`        orderBy: [
          { deliveryDate: "asc" },
          { createdAt: "desc" },
        ],`
);

// selectedDate in return ergänzen, falls noch nicht vorhanden
content = content.replace(
`      activeStatus: status,`,
`      activeStatus: status,
      selectedDate,`
);

// Header-Buttons erweitern: Datum-Filter neben Statusfiltern
content = content.replace(
`          <div className="sectionActions">
            <Link className="ghostButton" to="/auftraege">
              Alle
            </Link>
            <Link className="ghostButton" to="/auftraege?status=AUTO_CREATED">
              Prüfen
            </Link>
            <Link className="ghostButton" to="/auftraege?status=CONFIRMED">
              Bestätigt
            </Link>
            <Link className="ghostButton" to="/auftraege?status=REJECTED">
              Abgelehnt
            </Link>
          </div>`,
`          <div className="sectionActions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {data.activeStatus ? (
                <input type="hidden" name="status" value={data.activeStatus} />
              ) : null}
              <input
                type="date"
                name="date"
                defaultValue={data.selectedDate || ""}
                style={{
                  height: 38,
                  border: "1px solid #d6e1ea",
                  borderRadius: 999,
                  padding: "0 12px",
                  fontWeight: 850,
                  background: "#ffffff",
                  color: "#0f172a",
                }}
              />
              <button className="ghostButton" type="submit">
                Datum
              </button>
            </Form>

            <Link className="ghostButton" to="/auftraege">
              Alle
            </Link>
            <Link className="ghostButton" to="/auftraege?status=AUTO_CREATED">
              Prüfen
            </Link>
            <Link className="ghostButton" to="/auftraege?status=CONFIRMED">
              Bestätigt
            </Link>
            <Link className="ghostButton" to="/auftraege?status=REJECTED">
              Abgelehnt
            </Link>
          </div>`
);

// Tabellen-Buttontexte nochmal sicher reparieren
content = content.split(">Oeffnen<").join(">Öffnen<");
content = content.split(">Pruefseite<").join(">Prüfseite<");
content = content.split(">Loeschen<").join(">Löschen<");

// Betrag sicher aus totalCents lesen
content = content.replaceAll("(item.totalPriceCents || 0)", "(item.totalCents || item.totalPriceCents || 0)");

fs.writeFileSync(path, content, "utf8");
console.log("Aufträge: Umlaute, Datumsfilter und Sortierung gepatcht.");
