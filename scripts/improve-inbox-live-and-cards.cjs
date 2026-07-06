const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

// React imports erweitern
content = content.replace(
  'import AppLayout from "../components/AppLayout";\nimport { Form, redirect, useActionData, useLoaderData } from "react-router";',
  'import { useEffect, useState } from "react";\nimport AppLayout from "../components/AppLayout";\nimport { Form, redirect, useActionData, useFetcher, useLoaderData } from "react-router";'
);

// Unklar nicht mehr Heycater-only
content = content.replaceAll("Unklare Heycater-Mails", "Unklare Mails");
content = content.replaceAll("Heycater-Mails prüfen", "E-Mails prüfen");
content = content.replaceAll("Heycater-Mails", "E-Mails");

content = content.replace(
  '{ key: "possible", label: "Unklar", help: "Heycater-Mails prüfen" },',
  '{ key: "possible", label: "Unklar", help: "E-Mails prüfen" },'
);

// Klassifizierung allgemeiner machen
content = content.replace(
`  const looksLikeHeycater =
    sender.includes("heycater") ||
    subject.includes("heycater") ||
    subject.includes("heykantine");

  const hasOrderNumber = /\\b\\d{4}-\\d{5,}\\b/.test(subject);

  if (looksLikeHeycater && hasOrderNumber) return "possible";

  return "other";`,
`  const looksLikePlatform =
    sender.includes("heycater") ||
    subject.includes("heycater") ||
    subject.includes("heykantine") ||
    sender.includes("egora") ||
    subject.includes("egora") ||
    sender.includes("feedr") ||
    subject.includes("feedr") ||
    sender.includes("hey") ||
    subject.includes("catering") ||
    subject.includes("auftrag") ||
    subject.includes("order");

  const hasOrderNumber =
    /\\b\\d{4}-\\d{5,}\\b/.test(subject) ||
    /\\b[a-z]{2,}-?\\d{4,}\\b/i.test(subject);

  if (looksLikePlatform && hasOrderNumber) return "possible";

  if (subject.includes("catering")) return "inquiries";

  return "other";`
);

// Weitere Anfrage-Signale
content = content.replace(
`    "gaeste",
  ];`,
`    "gaeste",
    "hochzeit",
    "sommerfest",
    "firmenevent",
    "veranstaltung",
    "geburtstag",
    "lunch",
    "fruhstuck",
    "fruehstueck",
    "abendessen",
    "catering",
  ];`
);

// Component: fetcher + live status einbauen
content = content.replace(
`export default function AuftragseingangPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();`,
`export default function AuftragseingangPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const importFetcher = useFetcher();
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [lastAutoImportAt, setLastAutoImportAt] = useState<string>("");

  useEffect(() => {
    if (!liveEnabled) return;

    const runImport = () => {
      const formData = new FormData();
      formData.set("intent", "runEmailImportNow");

      importFetcher.submit(formData, {
        method: "post",
      });

      setLastAutoImportAt(new Date().toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }));
    };

    const timer = window.setInterval(runImport, 60000);

    return () => window.clearInterval(timer);
  }, [liveEnabled]);`
);

// Header Buttons: Live Button ergänzen
content = content.replace(
`              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Form method="post">
                  <input type="hidden" name="intent" value="runEmailImportNow" />
                  <button type="submit" style={primaryButtonStyle}>E-Mails jetzt abrufen</button>
                </Form>
                <a href="/neuer-auftrag" style={secondaryButtonStyle}>+ Neuer Auftrag</a>
              </div>`,
`              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setLiveEnabled((value) => !value)}
                  style={{
                    ...secondaryButtonStyle,
                    borderColor: liveEnabled ? "#bbf7d0" : "#d6e1ea",
                    color: liveEnabled ? "#047857" : "#64748b",
                    background: liveEnabled ? "#ecfdf5" : "#ffffff",
                  }}
                  title={lastAutoImportAt ? "Letzter Auto-Abruf: " + lastAutoImportAt : "Automatischer Abruf alle 60 Sekunden"}
                >
                  {liveEnabled ? "Live an" : "Live aus"}
                </button>

                <Form method="post">
                  <input type="hidden" name="intent" value="runEmailImportNow" />
                  <button type="submit" style={primaryButtonStyle}>
                    {importFetcher.state === "submitting" ? "Abrufen..." : "E-Mails jetzt abrufen"}
                  </button>
                </Form>

                <a href="/neuer-auftrag" style={secondaryButtonStyle}>+ Neuer Auftrag</a>
              </div>`
);

// Hinweis unter Header ergänzen
content = content.replace(
`          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>`,
`          <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            margin: "-6px 0 16px",
            color: "#64748b",
            fontSize: 13,
            fontWeight: 750,
          }}>
            <span>
              {liveEnabled ? "Live-Abruf aktiv: neue E-Mails werden automatisch geprüft." : "Live-Abruf ist aus."}
            </span>
            {lastAutoImportAt ? <span>Letzter Auto-Abruf: {lastAutoImportAt}</span> : null}
          </div>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>`
);

// E-Mail Karten kompakter machen
content = content.replace(
`                        borderRadius: 20,
                        padding: 16,
                        background: "#ffffff",
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 16,`,
`                        borderRadius: 18,
                        padding: 14,
                        background: "#ffffff",
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 14,
                        alignItems: "center",`
);

content = content.replace(
`                        <h3 style={{ margin: 0, fontSize: 17, letterSpacing: "-0.02em" }}>
                          {mail.subject || "E-Mail ohne Betreff"}
                        </h3>

                        <div style={{ marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap", color: "#64748b", fontSize: 13, fontWeight: 750 }}>
                          <span>Von: {mail.sender || "-"}</span>
                          <span>Postfach: {mail.mailbox || "-"}</span>
                          <span>Anhänge: {mail.attachments?.length || 0}</span>
                        </div>`,
`                        <h3 style={{ margin: 0, fontSize: 16, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                          {mail.subject || "E-Mail ohne Betreff"}
                        </h3>

                        <div style={{ marginTop: 7, display: "flex", gap: 12, flexWrap: "wrap", color: "#64748b", fontSize: 12.5, fontWeight: 750 }}>
                          <span>Von: {mail.sender || "-"}</span>
                          <span>{mail.mailbox || "-"}</span>
                          <span>{mail.attachments?.length || 0} Anhänge</span>
                        </div>`
);

content = content.replace(
`                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>`,
`                      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>`
);

// Buttons in Karten etwas kleiner
content = content.replace(
`    padding: "10px 14px",
    fontWeight: 950,
    fontSize: 14,`,
`    padding: "9px 13px",
    fontWeight: 950,
    fontSize: 13,`
);

content = content.replace(
`    padding: "10px 14px",
    fontWeight: 900,
    fontSize: 14,`,
`    padding: "9px 13px",
    fontWeight: 900,
    fontSize: 13,`
);

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang: plattformoffen, Live-Abruf und kompaktere Anfrageansicht gepatcht.");
