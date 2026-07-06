const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  'import { Form, useActionData, useLoaderData } from "react-router";',
  'import { Form, redirect, useActionData, useLoaderData } from "react-router";'
);

// Klassifizierung komplett robust ersetzen
const newClassifyBlock = `function normalizeEmailText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");
}

function classifyIncomingEmail(mail: any) {
  const subject = normalizeEmailText(mail?.subject || "");
  const sender = normalizeEmailText(mail?.sender || "");
  const combined = subject + " " + sender;

  if (mail?.status === "IGNORED") {
    return "hidden";
  }

  const cancellationSignals = [
    "storniert",
    "stornierung",
    "abgesagt",
    "absage",
    "canceled",
    "cancelled",
    "cancellation",
    "nicht statt",
    "findet nicht statt",
  ];

  const orderSignals = [
    "fast track order bestatigt",
    "fast track order bestaetigt",
    "order bestatigt",
    "order bestaetigt",
    "auftrag bestatigt",
    "auftrag bestaetigt",
    "auftragsbestatigung",
    "auftragsbestaetigung",
    "angebotsbestatigung",
    "angebotsbestaetigung",
    "partner event confirmation",
    "event confirmation",
    "order confirmation",
  ];

  const inquirySignals = [
    "bitte auftrag bestatigen",
    "bitte auftrag bestaetigen",
    "angebot freigeben",
    "bitte angebot freigeben",
    "angebot erstellen",
    "bitte angebot",
    "angebot",
    "anfrage",
    "angebotsanfrage",
    "catering anfrage",
    "neue anfrage",
    "catering am",
    "catering fur",
    "catering fuer",
    "catering gesucht",
    "catering nahe",
    "catering naehe",
    "nahe ludwigsfelde",
    "naehe ludwigsfelde",
    "buffet",
    "fingerfood",
    "event catering",
    "personen",
    "gaste",
    "gaeste",
  ];

  const reminderSignals = [
    "dein morgiges catering",
    "dein morgiges heykantine",
    "morgiges catering mit heycater",
    "morgiges heykantine",
    "delivery note",
    "lieferschein",
  ];

  const otherSignals = [
    "paypal",
    "newsletter",
    "kurz nachgehakt",
    "guthaben",
    "buust",
    "werbung",
    "logistikbeleg",
    "chefs culinar",
    "logistikbeleg",
  ];

  if (cancellationSignals.some((signal) => combined.includes(signal))) {
    return "other";
  }

  if (orderSignals.some((signal) => subject.includes(signal))) {
    return "orders";
  }

  if (reminderSignals.some((signal) => subject.includes(signal))) {
    return "reminders";
  }

  if (inquirySignals.some((signal) => subject.includes(signal))) {
    return "inquiries";
  }

  if (otherSignals.some((signal) => combined.includes(signal))) {
    return "other";
  }

  const looksLikeHeycater =
    sender.includes("heycater") ||
    subject.includes("heycater") ||
    subject.includes("heykantine");

  const hasOrderNumber = /\\b\\d{4}-\\d{5,}\\b/.test(subject);

  if (looksLikeHeycater && hasOrderNumber) {
    return "possible";
  }

  return "other";
}`;

content = content.replace(
  /function normalizeEmailText\(value: unknown\) \{[\s\S]*?\n\}\n\nfunction isLikelyOrderEmail/,
  newClassifyBlock + "\n\nfunction isLikelyOrderEmail"
);

content = content.replace(
  /function classifyIncomingEmail\(mail: any\) \{[\s\S]*?\n\}\n\nfunction emailCategoryLabel/,
  newClassifyBlock + "\n\nfunction emailCategoryLabel"
);

// Direktabruf-Action ergänzen
if (!content.includes('intent === "runEmailImportNow"')) {
  content = content.replace(
`  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "restoreIncomingEmail") {`,
`  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "runEmailImportNow") {
    const origin = new URL(request.url).origin;
    const secret = process.env.EMAIL_IMPORT_RUN_SECRET || "";
    const runUrl = secret
      ? origin + "/api/email-import/run?secret=" + encodeURIComponent(secret)
      : origin + "/api/email-import/run";

    await fetch(runUrl);

    return redirect("/auftragseingang");
  }

  if (intent === "restoreIncomingEmail") {`
  );
}

// Import starten Link durch echten Abrufen-Button ersetzen
content = content.replace(
`<a href="/importe" style={{ ...toolbarButtonStyle, marginTop: 17, borderColor: "#bbf7d0", color: "#047857", background: "#ecfdf5" }}>
                Import starten
              </a>`,
`<Form method="post" style={{ marginTop: 17 }}>
                <input type="hidden" name="intent" value="runEmailImportNow" />
                <button
                  type="submit"
                  style={{ ...toolbarButtonStyle, borderColor: "#bbf7d0", color: "#047857", background: "#ecfdf5" }}
                >
                  E-Mails jetzt abrufen
                </button>
              </Form>`
);

// Kaputte Umlaute reparieren
const replacements = [
  ["PrÃ¼fen", "Prüfen"],
  ["AuftrÃ¤ge", "Aufträge"],
  ["AuftrÃ¤gen", "Aufträgen"],
  ["prÃ¼fen", "prüfen"],
  ["Ã¼bernehmen", "übernehmen"],
  ["Ãœbernommen", "Übernommen"],
  ["gelÃ¶scht", "gelöscht"],
  ["LÃ¶schen", "Löschen"],
  ["Loeschen", "Löschen"],
  ["Pruefen", "Prüfen"],
  ["Auftragsbestaetigungen", "Auftragsbestätigungen"],
  ["Moegliche Auftraege", "Unklare Heycater-Mails"],
  ["Sonstiges / Absagen / Absagen", "Sonstiges / Absagen"],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang: Anfrage-Kategorie, Direktabruf und Umlaute gefixt.");
