const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const backupPath = path + ".backup-before-polish";
fs.writeFileSync(backupPath, content, "utf8");

// 1) Neue saubere UI-Styles nach tdStyle einfügen
if (!content.includes("const toolbarInputStyle: any =")) {
  content = content.replace(
`  const tdStyle: any = {
    padding: "13px 14px",
    borderBottom: "1px solid #edf2f7",
    verticalAlign: "top",
    fontSize: 14,
  };`,
`  const tdStyle: any = {
    padding: "13px 14px",
    borderBottom: "1px solid #edf2f7",
    verticalAlign: "top",
    fontSize: 14,
  };

  const toolbarInputStyle: any = {
    height: 44,
    border: "1px solid #d7e2ec",
    borderRadius: 14,
    padding: "0 14px",
    fontSize: 14,
    fontWeight: 850,
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  const toolbarButtonStyle: any = {
    height: 44,
    border: "1px solid #d7e2ec",
    background: "#ffffff",
    borderRadius: 14,
    padding: "0 15px",
    fontSize: 14,
    fontWeight: 950,
    color: "#0f172a",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  const primaryActionStyle: any = {
    minHeight: 38,
    border: "1px solid #0f9f7a",
    background: "#0f9f7a",
    color: "#ffffff",
    borderRadius: 12,
    padding: "8px 13px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 18px rgba(15, 159, 122, 0.18)",
  };

  const quietActionStyle: any = {
    minHeight: 38,
    border: "1px solid #dbe5ee",
    background: "#ffffff",
    color: "#334155",
    borderRadius: 12,
    padding: "8px 13px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const dangerActionStyle: any = {
    minHeight: 38,
    border: "1px solid #fecaca",
    background: "#fff7f7",
    color: "#b91c1c",
    borderRadius: 12,
    padding: "8px 13px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const statusPillStyle: any = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #dbe5ee",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    background: "#f8fafc",
    color: "#334155",
  };`
  );
}

// 2) Datum-Filter schöner machen
content = content.replace(
`<Form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="date"
                  name="date"
                  defaultValue={data.selectedDate || ""}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 999,
                    padding: "9px 12px",
                    fontWeight: 800,
                    background: "#ffffff",
                  }}
                />
                <button type="submit" style={smallButtonStyle}>Datum anzeigen</button>
              </Form>

              <a href="/auftragseingang" style={smallButtonStyle}>Alle</a>
              <a href="/importe" style={smallButtonStyle}>E-Mail-Import</a>`,
`<Form method="get" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {data.selectedEmailCategory ? (
                  <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />
                ) : null}

                <label style={{
                  display: "grid",
                  gap: 5,
                  color: "#64748b",
                  fontSize: 11,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: ".05em"
                }}>
                  Datum
                  <input
                    type="date"
                    name="date"
                    defaultValue={data.selectedDate || ""}
                    style={toolbarInputStyle}
                  />
                </label>

                <button type="submit" style={{ ...toolbarButtonStyle, marginTop: 17 }}>
                  Anzeigen
                </button>
              </Form>

              <a href="/auftragseingang" style={{ ...toolbarButtonStyle, marginTop: 17 }}>Alle zeigen</a>
              <a href="/importe" style={{ ...toolbarButtonStyle, marginTop: 17, borderColor: "#bbf7d0", color: "#047857", background: "#ecfdf5" }}>
                Import starten
              </a>`
);

// 3) E-Mail-Aktion Prüfen schöner machen
content = content.replaceAll(
`<a href={"/email-pruefung/" + mail.id} style={{ ...smallButtonStyle, borderRadius: 999, textDecoration: "none" }}>Pruefen</a>`,
`<a href={"/email-pruefung/" + mail.id} style={primaryActionStyle}>Prüfen</a>`
);

content = content.replaceAll(
`<a href={"/email-pruefung/" + mail.id} style={smallButtonStyle}>Pruefen</a>`,
`<a href={"/email-pruefung/" + mail.id} style={primaryActionStyle}>Prüfen</a>`
);

// 4) Angebot vorbereiten Button schöner
content = content.replace(
`style={{
                                ...smallButtonStyle,
                                borderRadius: 999,
                                background: "#ecfdf5",
                                borderColor: "#bbf7d0",
                                color: "#047857",
                                textDecoration: "none",
                              }}`,
`style={{
                                ...quietActionStyle,
                                background: "#ecfdf5",
                                borderColor: "#bbf7d0",
                                color: "#047857",
                              }}`
);

// 5) Ausblenden / Einblenden / Löschen im E-Mail-Eingang schöner
content = content.replace(
`style={{
                                  ...smallButtonStyle,
                                  color: "#475569",
                                  borderColor: "#cbd5e1",
                                  background: "#f8fafc",
                                }}`,
`style={quietActionStyle}`
);

content = content.replace(
`style={{
                                  ...smallButtonStyle,
                                  color: "#047857",
                                  borderColor: "#bbf7d0",
                                  background: "#f0fdf4",
                                }}`,
`style={{
                                  ...quietActionStyle,
                                  color: "#047857",
                                  borderColor: "#bbf7d0",
                                  background: "#f0fdf4",
                                }}`
);

content = content.replace(
`style={{
                                ...smallButtonStyle,
                                color: "#991b1b",
                                borderColor: "#fecaca",
                                background: "#fff1f2",
                              }}`,
`style={dangerActionStyle}`
);

// 6) Auftragstabelle Status-Pill schöner
content = content.replace(
`<span style={{
                            display: "inline-flex",
                            border: "1px solid #d2d2d2",
                            borderRadius: 999,
                            padding: "5px 9px",
                            fontSize: 12,
                            fontWeight: 850,
                          }}>
                            {statusLabel(order.status)}
                          </span>`,
`<span style={{
                            ...statusPillStyle,
                            background: order.status === "AUTO_CREATED" ? "#ecfdf5" : order.status === "CONFIRMED" ? "#eff6ff" : "#fff7ed",
                            color: order.status === "AUTO_CREATED" ? "#047857" : order.status === "CONFIRMED" ? "#1d4ed8" : "#9a3412",
                            borderColor: order.status === "AUTO_CREATED" ? "#bbf7d0" : order.status === "CONFIRMED" ? "#bfdbfe" : "#fed7aa",
                          }}>
                            {statusLabel(order.status)}
                          </span>`
);

// 7) Auftragstabelle Prüfen/Löschen Buttons schöner
content = content.replace(
`<a href={"/auftrag-pruefung/" + order.id} style={smallButtonStyle}>
                              Pruefen
                            </a>`,
`<a href={"/auftrag-pruefung/" + order.id} style={primaryActionStyle}>
                              Prüfen
                            </a>`
);

content = content.replace(
`<button type="submit" style={{ ...smallButtonStyle, width: "100%", color: "#b91c1c" }}>
                                Loeschen
                              </button>`,
`<button type="submit" style={{ ...dangerActionStyle, width: "100%" }}>
                                Löschen
                              </button>`
);

// 8) Tabellenzeilen etwas sauberer
content = content.replaceAll(
`<tr key={order.id}>`,
`<tr key={order.id} style={{ background: "#ffffff" }}>`
);

content = content.replaceAll(
`<tr key={mail.id}>`,
`<tr key={mail.id} style={{ background: "#ffffff" }}>`
);

// 9) Deutsche Umlaute bei Buttontexten anpassen
content = content.replaceAll(">Pruefen<", ">Prüfen<");
content = content.replaceAll(">Loeschen<", ">Löschen<");

fs.writeFileSync(path, content, "utf8");
console.log("Buttons, Datumsauswahl und Tabellenaktionen poliert.");
