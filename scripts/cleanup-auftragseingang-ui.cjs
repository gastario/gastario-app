const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const backupPath = path + ".backup-before-cleanup";
fs.writeFileSync(backupPath, content, "utf8");

const before = content;

content = content.replace(
  /<section style=\{documentStyle\}>\s*<Form[\s\S]*?<button type="submit" style=\{submitButtonStyle\}>Auftrag anlegen<\/button>\s*<\/Form>\s*<\/section>\s*/m,
  ""
);

content = content.replace(
  `<header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
          <div>
            <div style={sectionLabelStyle}>Gastario</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 34, lineHeight: 1, letterSpacing: "-0.05em" }}>
              Auftragseingang
            </h1>
            <p style={{ margin: "8px 0 0", color: "#64748b", fontWeight: 650 }}>
              Neue AuftrÃ¤ge erfassen, prÃ¼fen und Ã¼bernehmen.
            </p>
          </div>

          <div style={{
            border: "1px solid #d2d2d2",
            background: "#ffffff",
            borderRadius: 4,
            padding: "12px 16px",
            fontWeight: 900,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            whiteSpace: "nowrap",
          }}>
            {data.tenant.name}
          </div>
        </header>`,
  `<header style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 18,
          background: "#ffffff",
          border: "1px solid #dbe5ee",
          borderRadius: 18,
          padding: "20px 22px",
          boxShadow: "0 14px 36px rgba(15, 23, 42, 0.06)"
        }}>
          <div>
            <div style={sectionLabelStyle}>Arbeitsbereich</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 34, lineHeight: 1, letterSpacing: "-0.05em" }}>
              Auftragseingang
            </h1>
            <p style={{ margin: "8px 0 0", color: "#64748b", fontWeight: 650, maxWidth: 760 }}>
              E-Mails prüfen, Anfragen vorbereiten, Lieferscheine kontrollieren und bestätigte Aufträge übernehmen.
            </p>
          </div>

          <a href="/neuer-auftrag" style={{
            border: "1px solid #0f9f7a",
            background: "#0f9f7a",
            color: "#ffffff",
            borderRadius: 999,
            padding: "11px 16px",
            fontWeight: 950,
            textDecoration: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 10px 24px rgba(15, 159, 122, 0.18)"
          }}>
            + Neuer Auftrag
          </a>
        </header>`
);

content = content.replace(
  `<section style={{ ...documentStyle, marginTop: 18, borderColor: "#fed7aa", background: "#fffaf0" }}>`,
  `<section style={{
          ...documentStyle,
          marginTop: 18,
          borderColor: "#dbe5ee",
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 14px 36px rgba(15, 23, 42, 0.06)"
        }}>`
);

content = content.replace(
  `<h2 style={{ margin: "5px 0 0", fontSize: 23, letterSpacing: "-0.03em" }}>{emailCategoryLabel(data.selectedEmailCategory)}</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 650 }}>
                Diese E-Mails wurden empfangen, aber noch nicht sicher als Auftrag erkannt.
              </p>`,
  `<h2 style={{ margin: "5px 0 0", fontSize: 25, letterSpacing: "-0.04em" }}>{emailCategoryLabel(data.selectedEmailCategory)}</h2>
              <p style={{ margin: "7px 0 0", color: "#64748b", fontWeight: 650, maxWidth: 620 }}>
                Eingegangene E-Mails sortieren, prüfen und daraus Aufträge oder Angebotsrohlinge vorbereiten.
              </p>`
);

content = content.replace(
  `<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>`,
  `<div style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 14,
            padding: 8,
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            background: "#f8fafc"
          }}>`
);

content = content.replace(
  /style=\{\{\s*\.\.\.smallButtonStyle,\s*background: data\.selectedEmailCategory === key \? "#057a67" : "#ffffff",\s*color: data\.selectedEmailCategory === key \? "#ffffff" : "#0f172a",\s*borderColor: data\.selectedEmailCategory === key \? "#057a67" : "#cbd5e1",\s*\}\}/g,
  `style={{
                    ...smallButtonStyle,
                    background: data.selectedEmailCategory === key ? "#057a67" : "#ffffff",
                    color: data.selectedEmailCategory === key ? "#ffffff" : "#0f172a",
                    borderColor: data.selectedEmailCategory === key ? "#057a67" : "#dbe5ee",
                    borderRadius: 999,
                    padding: "9px 13px",
                    boxShadow: data.selectedEmailCategory === key ? "0 10px 20px rgba(5, 122, 103, 0.14)" : "none",
                    textDecoration: "none",
                  }}`
);

content = content.replace(
  `<div style={{ overflowX: "auto", border: "1px solid #fed7aa", borderRadius: 12 }}>`,
  `<div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 }}>`
);

content = content.replace(
  `<a href={"/email-pruefung/" + mail.id} style={smallButtonStyle}>Pruefen</a>`,
  `<a href={"/email-pruefung/" + mail.id} style={{ ...smallButtonStyle, borderRadius: 999, textDecoration: "none" }}>Pruefen</a>
                          {classifyIncomingEmail(mail) === "inquiries" ? (
                            <a
                              href={"/angebot-vorbereiten/" + mail.id}
                              style={{
                                ...smallButtonStyle,
                                borderRadius: 999,
                                background: "#ecfdf5",
                                borderColor: "#bbf7d0",
                                color: "#047857",
                                textDecoration: "none",
                              }}
                            >
                              Angebot vorbereiten
                            </a>
                          ) : null}`
);

if (content === before) {
  throw new Error("Es wurde nichts geändert. Bitte Datei prüfen.");
}

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang oben bereinigt und E-Mail-Leiste verschönert.");
