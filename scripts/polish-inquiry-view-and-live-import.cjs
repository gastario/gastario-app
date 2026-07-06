const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  'import { useEffect, useState } from "react";',
  'import { useEffect, useState } from "react";'
);

content = content.replace(
`  const importFetcher = useFetcher();
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
  }, [liveEnabled]);`,
`  const importFetcher = useFetcher();
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [lastAutoImportAt, setLastAutoImportAt] = useState<string>("");
  const [isImportingNow, setIsImportingNow] = useState(false);

  async function runEmailImportAndReload() {
    if (isImportingNow) return;

    setIsImportingNow(true);

    try {
      const formData = new FormData();
      formData.set("intent", "runEmailImportNow");

      await fetch("/auftragseingang", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      setLastAutoImportAt(new Date().toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }));

      window.location.reload();
    } catch (error) {
      console.error("E-Mail-Abruf fehlgeschlagen", error);
      setIsImportingNow(false);
    }
  }

  useEffect(() => {
    if (!liveEnabled) return;

    const timer = window.setInterval(() => {
      runEmailImportAndReload();
    }, 60000);

    return () => window.clearInterval(timer);
  }, [liveEnabled, isImportingNow]);`
);

content = content.replace(
`                <Form method="post">
                  <input type="hidden" name="intent" value="runEmailImportNow" />
                  <button type="submit" style={primaryButtonStyle}>
                    {importFetcher.state === "submitting" ? "Abrufen..." : "E-Mails jetzt abrufen"}
                  </button>
                </Form>`,
`                <button
                  type="button"
                  onClick={runEmailImportAndReload}
                  style={primaryButtonStyle}
                  disabled={isImportingNow}
                >
                  {isImportingNow ? "Abrufen..." : "E-Mails jetzt abrufen"}
                </button>`
);

content = content.replace(
`  const cardStyle: any = {
    background: "rgba(255,255,255,0.96)",
    border: "1px solid #dbe7ee",
    borderRadius: 24,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  };`,
`  const cardStyle: any = {
    background: "rgba(255,255,255,0.97)",
    border: "1px solid #dbe7ee",
    borderRadius: 24,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  };

  const mailCardStyle: any = {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 15,
    background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "center",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.035)",
  };

  const mailMetaStyle: any = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: 12.5,
    fontWeight: 750,
    marginTop: 8,
  };

  const mailActionBarStyle: any = {
    display: "flex",
    gap: 7,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    minWidth: 430,
  };`
);

content = content.replace(
`                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 18,
                        padding: 14,
                        background: "#ffffff",
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 14,
                        alignItems: "center",
                      }}`,
`                      style={mailCardStyle}`
);

content = content.replace(
`                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 7 }}>
                          <span style={{ borderRadius: 999, padding: "5px 9px", background: "#f1f5f9", color: "#334155", fontSize: 12, fontWeight: 900 }}>
                            {emailCategoryLabel(category)}
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>
                            {mail.receivedAt ? new Date(mail.receivedAt).toLocaleString("de-DE") : "-"}
                          </span>
                        </div>

                        <h3 style={{ margin: 0, fontSize: 16, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                          {mail.subject || "E-Mail ohne Betreff"}
                        </h3>

                        <div style={{ marginTop: 7, display: "flex", gap: 12, flexWrap: "wrap", color: "#64748b", fontSize: 12.5, fontWeight: 750 }}>
                          <span>Von: {mail.sender || "-"}</span>
                          <span>{mail.mailbox || "-"}</span>
                          <span>{mail.attachments?.length || 0} Anhänge</span>
                        </div>`,
`                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                          <span style={{
                            borderRadius: 999,
                            padding: "5px 9px",
                            background: category === "inquiries" ? "#ecfdf5" : "#f1f5f9",
                            color: category === "inquiries" ? "#047857" : "#334155",
                            fontSize: 12,
                            fontWeight: 950,
                          }}>
                            {emailCategoryLabel(category)}
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850 }}>
                            {mail.receivedAt ? new Date(mail.receivedAt).toLocaleString("de-DE") : "-"}
                          </span>
                        </div>

                        <h3 style={{ margin: 0, fontSize: 17, letterSpacing: "-0.025em", lineHeight: 1.22 }}>
                          {mail.subject || "E-Mail ohne Betreff"}
                        </h3>

                        <div style={mailMetaStyle}>
                          <span><strong>Von:</strong> {mail.sender || "-"}</span>
                          <span><strong>Postfach:</strong> {mail.mailbox || "-"}</span>
                          <span><strong>Anhänge:</strong> {mail.attachments?.length || 0}</span>
                        </div>`
);

content = content.replace(
`                      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>`,
`                      <div style={mailActionBarStyle}>`
);

content = content.replace(
`    padding: "9px 13px",
    fontWeight: 950,
    fontSize: 13,`,
`    padding: "9px 14px",
    fontWeight: 950,
    fontSize: 13,`
);

content = content.replace(
`    padding: "9px 13px",
    fontWeight: 900,
    fontSize: 13,`,
`    padding: "9px 14px",
    fontWeight: 900,
    fontSize: 13,`
);

// Kartenbereich optisch enger und ruhiger
content = content.replace(
`            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>`,
`            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10, marginBottom: 16 }}>`
);

content = content.replace(
`                      borderRadius: 18,
                      padding: "12px 14px",`,
`                      borderRadius: 18,
                      padding: "13px 14px",`
);

fs.writeFileSync(path, content, "utf8");
console.log("Anfragen-Ansicht verbessert und E-Mail-Abruf mit Reload abgesichert.");
