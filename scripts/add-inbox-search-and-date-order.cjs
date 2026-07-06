const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// 1) search param im Loader ergänzen
content = content.replace(
`  const selectedDate = url.searchParams.get("date") || "";
  const selectedEmailCategory = url.searchParams.get("emailCategory") || "orders";`,
`  const selectedDate = url.searchParams.get("date") || "";
  const selectedEmailCategory = url.searchParams.get("emailCategory") || "orders";
  const searchQuery = url.searchParams.get("q") || "";`
);

// 2) where für E-Mail-Suche ergänzen
content = content.replace(
`          ...(selectedDateStart && selectedDateEnd
            ? { receivedAt: { gte: selectedDateStart, lt: selectedDateEnd } }
            : {}),
        },`,
`          ...(selectedDateStart && selectedDateEnd
            ? { receivedAt: { gte: selectedDateStart, lt: selectedDateEnd } }
            : {}),
          ...(searchQuery
            ? {
                OR: [
                  { subject: { contains: searchQuery, mode: "insensitive" } },
                  { sender: { contains: searchQuery, mode: "insensitive" } },
                  { mailbox: { contains: searchQuery, mode: "insensitive" } },
                ],
              }
            : {}),
        },`
);

// 3) selected search zurückgeben
content = content.replace(
`      selectedDate,
      selectedEmailCategory,`,
`      selectedDate,
      selectedEmailCategory,
      searchQuery,`
);

// fallback return ergänzen
content = content.replaceAll(
`      selectedEmailCategory: "orders",
      emailBuckets:`,
`      selectedEmailCategory: "orders",
      searchQuery: "",
      emailBuckets:`
);

// catch return ergänzen, falls noch nicht
content = content.replace(
`      selectedDate: "",
      selectedEmailCategory: "orders",
      emailBuckets:`,
`      selectedDate: "",
      selectedEmailCategory: "orders",
      searchQuery: "",
      emailBuckets:`
);

// 4) Bucket Links sollen q behalten
content = content.replace(
`                if (data.selectedDate) params.set("date", data.selectedDate);
                params.set("emailCategory", bucket.key);`,
`                if (data.selectedDate) params.set("date", data.selectedDate);
                if (data.searchQuery) params.set("q", data.searchQuery);
                params.set("emailCategory", bucket.key);`
);

// 5) Datumsformular mit Suche erweitern
content = content.replace(
`                <Form method="get" style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                  <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />
                  <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    Datum
                    <input type="date" name="date" defaultValue={data.selectedDate || ""} style={inputStyle} />
                  </label>
                  <button type="submit" style={secondaryButtonStyle}>Anzeigen</button>
                </Form>
                <a href="/auftragseingang" style={secondaryButtonStyle}>Alle zeigen</a>`,
`                <Form method="get" style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                  <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />

                  <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    Suche
                    <input
                      type="search"
                      name="q"
                      defaultValue={data.searchQuery || ""}
                      placeholder="Betreff, Absender, Kunde..."
                      style={{ ...inputStyle, minWidth: 240 }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 5, color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    Datum
                    <input type="date" name="date" defaultValue={data.selectedDate || ""} style={inputStyle} />
                  </label>

                  <button type="submit" style={secondaryButtonStyle}>Filtern</button>
                </Form>
                <a href={"/auftragseingang?emailCategory=" + data.selectedEmailCategory} style={secondaryButtonStyle}>Filter löschen</a>`
);

// 6) Hinweis bei leerer Kategorie mit Suche verbessern
content = content.replace(
`                Keine ungeprüften E-Mails in dieser Kategorie.`,
`                {data.searchQuery
                  ? "Keine E-Mails für diese Suche gefunden."
                  : "Keine ungeprüften E-Mails in dieser Kategorie."}`
);

// 7) Sortierung bleibt neueste zuerst, sicherstellen
content = content.replace(
`        orderBy: { receivedAt: "desc" },`,
`        orderBy: [
          { receivedAt: "desc" },
          { createdAt: "desc" },
        ],`
);

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang: Suche und saubere Datumsreihenfolge ergänzt.");
