export type IncomingEmailCategory =
  | "orders"
  | "possible"
  | "inquiries"
  | "reminders"
  | "other"
  | "hidden";

function normalizeEmailText(
  value: unknown
) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function classifyIncomingEmail(
  mail: {
    status?: unknown;
    subject?: unknown;
    sender?: unknown;
  }
): IncomingEmailCategory {
  const subject = normalizeEmailText(
    mail?.subject || ""
  );

  const sender = normalizeEmailText(
    mail?.sender || ""
  );

  const combined =
    subject + " " + sender;

  if (
    String(mail?.status || "") ===
    "IGNORED"
  ) {
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
    "findet nicht statt",
    "nicht statt",
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

  const reminderSignals = [
    "dein morgiges catering",
    "dein morgiges heykantine",
    "morgiges catering mit heycater",
    "morgiges heykantine",
    "delivery note",
    "lieferschein",
  ];

  const inquirySignals = [
    "angebotsanfrage",
    "catering anfrage",
    "catering-anfrage",
    "neue anfrage",
    "anfrage fur",
    "anfrage fuer",
    "angebot erstellen",
    "bitte angebot",
    "bitte um ein angebot",
    "angebot anfordern",
    "kostenvoranschlag",
    "verfugbarkeit anfragen",
    "verfuegbarkeit anfragen",
    "konnen sie uns",
    "koennen sie uns",
    "wir interessieren uns",
    "preis fur",
    "preis fuer",
    "was wurde kosten",
    "was wuerde kosten",
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
    "briefing kw",
    "eure uebersicht",
    "eure übersicht",
    "wochenuebersicht",
    "wochenübersicht",
  ];

  if (
    cancellationSignals.some(
      (signal) =>
        combined.includes(signal)
    )
  ) {
    return "other";
  }

  if (
    orderSignals.some(
      (signal) =>
        subject.includes(signal)
    )
  ) {
    return "orders";
  }

  if (
    reminderSignals.some(
      (signal) =>
        subject.includes(signal)
    )
  ) {
    return "reminders";
  }

  if (
    inquirySignals.some(
      (signal) =>
        subject.includes(signal)
    )
  ) {
    return "inquiries";
  }

  if (
    otherSignals.some(
      (signal) =>
        combined.includes(signal)
    )
  ) {
    return "other";
  }

  const looksLikePlatform =
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
    /\b\d{4}-\d{5,}\b/.test(
      subject
    ) ||
    /\b[a-z]{2,}-?\d{4,}\b/i.test(
      subject
    );

  if (
    looksLikePlatform &&
    hasOrderNumber
  ) {
    return "possible";
  }

  if (
    subject.includes("catering")
  ) {
    return "inquiries";
  }

  return "other";
}

export function isActionableIncomingEmail(
  mail: {
    status?: unknown;
    subject?: unknown;
    sender?: unknown;
  }
) {
  const category =
    classifyIncomingEmail(mail);

  return (
    category === "orders" ||
    category === "possible" ||
    category === "inquiries"
  );
}