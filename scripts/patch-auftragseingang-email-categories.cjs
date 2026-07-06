const fs = require("fs");

const path = "app/routes/auftragseingang.tsx";
let content = fs.readFileSync(path, "utf8");

const newClassify = `function normalizeEmailText(value: unknown) {
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
    "anfrage",
    "angebotsanfrage",
    "catering anfrage",
    "neue anfrage",
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

  if (reminderSignals.some((signal) => subject.includes(signal))) {
    return "reminders";
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
  /function classifyIncomingEmail\(mail: any\) \{[\s\S]*?\n\}\n\nfunction emailCategoryLabel/,
  newClassify + "\n\nfunction emailCategoryLabel"
);

content = content.replace(
  /function emailCategoryLabel\(value: string\) \{[\s\S]*?\n\}/,
  `function emailCategoryLabel(value: string) {
  if (value === "orders") return "Auftragsbestaetigungen";
  if (value === "possible") return "Unklare Heycater-Mails";
  if (value === "inquiries") return "Anfragen / Angebote";
  if (value === "reminders") return "Erinnerungen / Lieferscheine";
  if (value === "hidden") return "Ausgeblendet";
  if (value === "other") return "Sonstiges / Absagen";
  return "Alle E-Mails";
}`
);

content = content.replaceAll("Moegliche Auftraege", "Unklare Heycater-Mails");
content = content.replaceAll("Erinnerungen", "Erinnerungen / Lieferscheine");
content = content.replaceAll("Sonstiges", "Sonstiges / Absagen");

fs.writeFileSync(path, content, "utf8");
console.log("Auftragseingang-Kategorien robust gepatcht.");
