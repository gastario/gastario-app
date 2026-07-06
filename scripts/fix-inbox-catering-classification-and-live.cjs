const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const backupPath = path + ".backup-before-live-inbox-fix";
fs.writeFileSync(backupPath, content, "utf8");

// 1) Generic Catering-Anfragen besser erkennen
content = content.replace(
`  const otherSignals = [
    "paypal",
    "newsletter",
    "kurz nachgehakt",
    "guthaben",
    "buust",
    "werbung",
    "logistikbeleg",
    "chefs culinar",
  ];

  if (cancellationSignals.some((signal) => combined.includes(signal))) {
    return "other";
  }

  if (orderSignals.some((signal) => subject.includes(signal))) {
    return "orders";
  }

  if (inquirySignals.some((signal) => subject.includes(signal))) {
    return "inquiries";
  }`,
`  const otherSignals = [
    "paypal",
    "newsletter",
    "kurz nachgehakt",
    "guthaben",
    "buust",
    "werbung",
    "logistikbeleg",
    "chefs culinar",
  ];

  const genericCateringInquirySignals = [
    "catering am",
    "catering fur",
    "catering fuer",
    "catering gesucht",
    "catering nahe",
    "catering naehe",
    "buffet",
    "fingerfood",
    "event catering",
    "speisen",
    "personen",
    "gaeste",
    "gaste",
  ];

  if (cancellationSignals.some((signal) => combined.includes(signal))) {
    return "other";
  }

  if (orderSignals.some((signal) => subject.includes(signal))) {
    return "orders";
  }

  if (inquirySignals.some((signal) => subject.includes(signal))) {
    return "inquiries";
  }

  if (
    genericCateringInquirySignals.some((signal) => subject.includes(signal)) &&
    !otherSignals.some((signal) => combined.includes(signal))
  ) {
    return "inquiries";
  }`
);

// 2) Überschrift nicht doppelt "Absagen / Absagen"
content = content.replaceAll("Sonstiges / Absagen / Absagen", "Sonstiges / Absagen");

// 3) Auto-Refresh alle 30 Sekunden ergänzen
if (!content.includes("const [autoRefreshEnabled")) {
  content = content.replace(
`  const [liveGrossTotalCents, setLiveGrossTotalCents] = useState(0);`,
`  const [liveGrossTotalCents, setLiveGrossTotalCents] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  if (typeof window !== "undefined" && autoRefreshEnabled) {
    window.setTimeout(() => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (!isTyping) {
        window.location.reload();
      }
    }, 30000);
  }`
  );
}

// 4) Kleinen Live-Hinweis in die E-Mail-Toolbar setzen
content = content.replace(
`<a href="/importe" style={{ ...toolbarButtonStyle, marginTop: 17, borderColor: "#bbf7d0", color: "#047857", background: "#ecfdf5" }}>
                Import starten
              </a>`,
`<button
                type="button"
                onClick={() => setAutoRefreshEnabled((value) => !value)}
                style={{
                  ...toolbarButtonStyle,
                  marginTop: 17,
                  borderColor: autoRefreshEnabled ? "#bbf7d0" : "#d7e2ec",
                  color: autoRefreshEnabled ? "#047857" : "#334155",
                  background: autoRefreshEnabled ? "#ecfdf5" : "#ffffff",
                }}
              >
                {autoRefreshEnabled ? "Live an" : "Live aus"}
              </button>

              <a href="/importe" style={{ ...toolbarButtonStyle, marginTop: 17, borderColor: "#bbf7d0", color: "#047857", background: "#ecfdf5" }}>
                Import starten
              </a>`
);

fs.writeFileSync(path, content, "utf8");
console.log("Catering-Anfragen und Live-Refresh im Auftragseingang gepatcht.");
