import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Form, redirect, useActionData, useFetcher, useLoaderData } from "react-router";

const EMAIL_BUCKETS = [
  { key: "orders", label: "Bestätigungen", help: "Sichere Auftragsbestätigungen" },
  { key: "possible", label: "Unklar", help: "E-Mails prüfen" },
  { key: "inquiries", label: "Anfragen", help: "Angebote vorbereiten" },
  { key: "reminders", label: "Lieferscheine", help: "Morgen-/Lieferhinweise" },
  { key: "other", label: "Sonstiges", help: "Absagen, Werbung, Belege" },
  { key: "hidden", label: "Ausgeblendet", help: "Manuell ausgeblendet" },
  { key: "all", label: "Alle", help: "Alle ungeprüften E-Mails" },
];

function normalizeEmailText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classifyIncomingEmail(mail: any) {
  const subject = normalizeEmailText(mail?.subject || "");
  const sender = normalizeEmailText(mail?.sender || "");
  const combined = subject + " " + sender;

  if (mail?.status === "IGNORED") return "hidden";

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
    "bitte auftrag bestatigen",
    "bitte auftrag bestaetigen",
    "angebot freigeben",
    "bitte angebot freigeben",
    "angebot erstellen",
    "bitte angebot",
    "angebotsanfrage",
    "catering anfrage",
    "neue anfrage",
    "anfrage",
    "catering am",
    "catering fur",
    "catering fuer",
    "catering gesucht",
    "catering nahe",
    "catering naehe",
    "nahe ludwigsfelde",
    "naehe ludwigsfelde",
    "fingerfood",
    "buffet",
    "personen",
    "gaste",
    "gaeste",
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

  if (cancellationSignals.some((signal) => combined.includes(signal))) return "other";
  if (orderSignals.some((signal) => subject.includes(signal))) return "orders";
  if (reminderSignals.some((signal) => subject.includes(signal))) return "reminders";
  if (inquirySignals.some((signal) => subject.includes(signal))) return "inquiries";
  if (otherSignals.some((signal) => combined.includes(signal))) return "other";

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
    /\b\d{4}-\d{5,}\b/.test(subject) ||
    /\b[a-z]{2,}-?\d{4,}\b/i.test(subject);

  if (looksLikePlatform && hasOrderNumber) return "possible";

  if (subject.includes("catering")) return "inquiries";

  return "other";
}

function emailCategoryLabel(value: string) {
  if (value === "orders") return "Auftragsbestätigungen";
  if (value === "possible") return "Unklare Mails";
  if (value === "inquiries") return "Anfragen / Angebote";
  if (value === "reminders") return "Erinnerungen / Lieferscheine";
  if (value === "hidden") return "Ausgeblendet";
  if (value === "other") return "Sonstiges / Absagen";
  return "Alle E-Mails";
}

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function statusLabel(status: string) {
  if (status === "AUTO_CREATED") return "Prüfen";
  if (status === "CONFIRMED") return "Übernommen";
  if (status === "REJECTED") return "Abgelehnt";
  return status;
}

function sourceLabel(source: string) {
  if (source === "HEYCATER") return "Heycater";
  if (source === "EGORA") return "Egora";
  if (source === "EMAIL") return "E-Mail";
  if (source === "WEBSITE") return "Website";
  if (source === "DIRECT") return "Direkt";
  return source;
}

export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    return {
      tenant: null,
      orders: [],
      emailInbox: [],
      selectedDate: "",
      selectedEmailCategory: "orders",
      searchQuery: "",
      dateRange: "",
      emailBuckets: { orders: 0, possible: 0, inquiries: 0, reminders: 0, hidden: 0, other: 0, all: 0 },
      activeStatus: "",
      counts: { all: 0, review: 0, confirmed: 0, rejected: 0 },
      setupError: "Nicht angemeldet. Bitte neu einloggen.",
    };
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!tenantUser) {
    return {
      tenant: null,
      orders: [],
      emailInbox: [],
      selectedDate: "",
      selectedEmailCategory: "orders",
      searchQuery: "",
      dateRange: "",
      emailBuckets: { orders: 0, possible: 0, inquiries: 0, reminders: 0, hidden: 0, other: 0, all: 0 },
      activeStatus: "",
      counts: { all: 0, review: 0, confirmed: 0, rejected: 0 },
      setupError: "Kein Mandant gefunden. Bitte diesen Benutzer im Super Admin einem Mandanten zuordnen.",
    };
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const selectedDate = url.searchParams.get("date") || "";
  const selectedEmailCategory = url.searchParams.get("emailCategory") || "orders";
  const searchQuery = url.searchParams.get("q") || "";
  const dateRange = url.searchParams.get("dateRange") || "";

  let selectedDateStart = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  let selectedDateEnd = selectedDateStart ? new Date(selectedDateStart) : null;

  if (selectedDateEnd) selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);

  if (!selectedDate && dateRange) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === "today") {
      selectedDateStart = new Date(today);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "tomorrow") {
      selectedDateStart = new Date(today);
      selectedDateStart.setDate(selectedDateStart.getDate() + 1);
      selectedDateEnd = new Date(selectedDateStart);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "week") {
      selectedDateStart = new Date(today);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 7);
    }
  }

  try {
    const [orders, emailInbox, counts] = await Promise.all([
      prisma.order.findMany({
        where: {
          tenantId: tenantUser.tenantId,
          ...(status ? { status: status as any } : {}),
        },
        include: {
          items: true,
          customer: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),

      prisma.incomingEmail.findMany({
        where: {
          tenantId: tenantUser.tenantId,
          status: { in: ["RECEIVED", "REVIEW_NEEDED", "FAILED", "IGNORED"] as any },
          orders: { none: {} },
          ...(selectedDateStart && selectedDateEnd
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
        },
        include: { attachments: true },
        orderBy: [
          { receivedAt: "desc" },
          { createdAt: "desc" },
        ],
        take: 80,
      }),

      Promise.all([
        prisma.order.count({ where: { tenantId: tenantUser.tenantId } }),
        prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "AUTO_CREATED" as any } }),
        prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "CONFIRMED" as any } }),
        prisma.order.count({ where: { tenantId: tenantUser.tenantId, status: "REJECTED" as any } }),
      ]),
    ]);

    const emailBuckets = {
      orders: emailInbox.filter((mail: any) => classifyIncomingEmail(mail) === "orders").length,
      possible: emailInbox.filter((mail: any) => classifyIncomingEmail(mail) === "possible").length,
      inquiries: emailInbox.filter((mail: any) => classifyIncomingEmail(mail) === "inquiries").length,
      reminders: emailInbox.filter((mail: any) => classifyIncomingEmail(mail) === "reminders").length,
      hidden: emailInbox.filter((mail: any) => classifyIncomingEmail(mail) === "hidden").length,
      other: emailInbox.filter((mail: any) => classifyIncomingEmail(mail) === "other").length,
      all: emailInbox.length,
    };

    const filteredEmailInbox =
      selectedEmailCategory === "all"
        ? emailInbox
        : emailInbox.filter((mail: any) => classifyIncomingEmail(mail) === selectedEmailCategory);

    return {
      tenant: tenantUser.tenant,
      orders,
      emailInbox: filteredEmailInbox,
      selectedDate,
      selectedEmailCategory,
      searchQuery,
      dateRange,
      emailBuckets,
      activeStatus: status,
      counts: {
        all: counts[0],
        review: counts[1],
        confirmed: counts[2],
        rejected: counts[3],
      },
      setupError: null,
    };
  } catch (error: any) {
    console.error("Auftragseingang loader failed:", error);

    return {
      tenant: tenantUser.tenant,
      orders: [],
      emailInbox: [],
      selectedDate: "",
      selectedEmailCategory: "orders",
      searchQuery: "",
      dateRange: "",
      emailBuckets: { orders: 0, possible: 0, inquiries: 0, reminders: 0, hidden: 0, other: 0, all: 0 },
      activeStatus: status,
      counts: { all: 0, review: 0, confirmed: 0, rejected: 0 },
      setupError: "Auftragseingang konnte die Auftragsdaten nicht laden.",
    };
  }
}

export async function action({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);
  if (!userId) return { error: "Nicht angemeldet." };

  const tenantUser = await prisma.tenantUser.findFirst({ where: { userId } });
  if (!tenantUser) return { error: "Kein Mandant gefunden." };

  const formData = await request.formData();
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

  if (intent === "restoreIncomingEmail") {
    const emailId = String(formData.get("emailId") || "").trim();
    if (!emailId) return { error: "E-Mail fehlt." };

    const email = await prisma.incomingEmail.findFirst({
      where: { id: emailId, tenantId: tenantUser.tenantId },
    });

    if (!email) return { error: "E-Mail wurde nicht gefunden." };

    await prisma.incomingEmail.update({
      where: { id: email.id },
      data: { status: "REVIEW_NEEDED" as any, errorMessage: null },
    });

    return { success: "E-Mail wurde wieder eingeblendet." };
  }

  if (intent === "hideIncomingEmail") {
    const emailId = String(formData.get("emailId") || "").trim();
    if (!emailId) return { error: "E-Mail fehlt." };

    const email = await prisma.incomingEmail.findFirst({
      where: { id: emailId, tenantId: tenantUser.tenantId },
      include: { orders: { select: { id: true } } },
    });

    if (!email) return { error: "E-Mail wurde nicht gefunden." };
    if (email.orders.length > 0) return { error: "Diese E-Mail ist bereits mit einem Auftrag verbunden." };

    await prisma.incomingEmail.update({
      where: { id: email.id },
      data: { status: "IGNORED" as any, errorMessage: "Manuell ausgeblendet." },
    });

    return { success: "E-Mail wurde ausgeblendet." };
  }

  if (intent === "deleteIncomingEmail") {
    const emailId = String(formData.get("emailId") || "").trim();
    if (!emailId) return { error: "E-Mail fehlt." };

    const email = await prisma.incomingEmail.findFirst({
      where: { id: emailId, tenantId: tenantUser.tenantId },
      include: { orders: { select: { id: true } } },
    });

    if (!email) return { error: "E-Mail wurde nicht gefunden." };
    if (email.orders.length > 0) return { error: "Diese E-Mail ist bereits mit einem Auftrag verbunden." };

    await prisma.incomingEmail.delete({ where: { id: email.id } });
    return { success: "E-Mail wurde gelöscht." };
  }

  if (intent === "deleteOrder") {
    const orderId = String(formData.get("orderId") || "");
    if (!orderId) return { error: "Auftrag fehlt." };

    await prisma.deliveryStop.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId, tenantId: tenantUser.tenantId } });

    return { success: "Auftrag wurde gelöscht." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function AuftragseingangPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const importFetcher = useFetcher();
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
  }, [liveEnabled, isImportingNow]);

  const pageStyle: any = {
    minHeight: "100vh",
    padding: "0 0 46px",
    color: "#0f172a",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  };

  const shellStyle: any = {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
    padding: "0 24px",
  };

  const cardStyle: any = {
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
  };

  const sectionLabelStyle: any = {
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: ".10em",
    fontSize: 11,
    fontWeight: 950,
  };

  const primaryButtonStyle: any = {
    border: "1px solid #0f9f7a",
    background: "#0f9f7a",
    color: "#ffffff",
    borderRadius: 14,
    padding: "9px 14px",
    fontWeight: 950,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 22px rgba(15, 159, 122, 0.18)",
  };

  const secondaryButtonStyle: any = {
    border: "1px solid #d6e1ea",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 14,
    padding: "9px 14px",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const dangerButtonStyle: any = {
    ...secondaryButtonStyle,
    color: "#b91c1c",
    borderColor: "#fecaca",
    background: "#fff7f7",
  };

  const inputStyle: any = {
    height: 44,
    border: "1px solid #d6e1ea",
    borderRadius: 14,
    padding: "0 13px",
    fontWeight: 850,
    color: "#0f172a",
    background: "#ffffff",
  };

  const thStyle: any = {
    textAlign: "left",
    padding: "14px 16px",
    color: "#64748b",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    borderBottom: "1px solid #e8eef4",
  };

  const tdStyle: any = {
    padding: "16px",
    borderBottom: "1px solid #edf2f7",
    verticalAlign: "top",
    fontSize: 14,
  };

  if (data.setupError) {
    return (
      <AppLayout>
        <div style={pageStyle}>
          <div style={shellStyle}>
            <section style={{ ...cardStyle, padding: 28, maxWidth: 760 }}>
              <div style={sectionLabelStyle}>Fehler</div>
              <h1 style={{ margin: "8px 0 10px", fontSize: 32 }}>Auftragseingang konnte nicht geladen werden</h1>
              <p style={{ margin: 0, color: "#475569", fontWeight: 700 }}>{data.setupError}</p>
            </section>
          </div>
        </div>
      </AppLayout>
    );
  }

  const currentBucket = EMAIL_BUCKETS.find((bucket) => bucket.key === data.selectedEmailCategory) || EMAIL_BUCKETS[0];

  return (
    <AppLayout>
      <div style={pageStyle}>
        <div style={shellStyle}>
          <header style={{ ...cardStyle, padding: 24, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={sectionLabelStyle}>Arbeitsbereich</div>
                <h1 style={{ margin: "6px 0 0", fontSize: 38, lineHeight: 1, letterSpacing: "-0.055em" }}>
                  Auftragseingang
                </h1>
                <p style={{ margin: "10px 0 0", color: "#64748b", fontWeight: 700, maxWidth: 740 }}>
                  E-Mails abrufen, Anfragen vorbereiten, Aufträge prüfen und Lieferscheine sauber trennen.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
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

                <button
                  type="button"
                  onClick={runEmailImportAndReload}
                  style={primaryButtonStyle}
                  disabled={isImportingNow}
                >
                  {isImportingNow ? "Abrufen..." : "E-Mails jetzt abrufen"}
                </button>


              </div>
            </div>
          </header>

          <div style={{
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

          <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>
            {[
              ["Alle Aufträge", data.counts.all, ""],
              ["Zu prüfen", data.counts.review, "AUTO_CREATED"],
              ["Übernommen", data.counts.confirmed, "CONFIRMED"],
              ["Abgelehnt", data.counts.rejected, "REJECTED"],
            ].map(([label, count, status]) => {
              const active = data.activeStatus === status;
              return (
                <a
                  key={String(label)}
                  href={status ? "/auftragseingang?status=" + status : "/auftragseingang"}
                  style={{
                    ...cardStyle,
                    padding: 18,
                    textDecoration: "none",
                    background: active ? "#057a67" : "#ffffff",
                    color: active ? "#ffffff" : "#0f172a",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 900, color: active ? "rgba(255,255,255,.8)" : "#64748b" }}>{label}</div>
                  <div style={{ fontSize: 32, fontWeight: 950, lineHeight: 1.1, marginTop: 4 }}>{count}</div>
                </a>
              );
            })}
          </section>

          {actionData?.error ? (
            <div style={{
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
              borderRadius: 18,
              padding: 14,
              fontWeight: 850,
              marginBottom: 16,
            }}>
              {actionData.error}
            </div>
          ) : null}

          <section style={{ ...cardStyle, padding: 22, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <div style={sectionLabelStyle}>E-Mail Eingang</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 26, letterSpacing: "-0.04em" }}>{emailCategoryLabel(data.selectedEmailCategory)}</h2>
                <p style={{ margin: "7px 0 0", color: "#64748b", fontWeight: 700 }}>
                  {currentBucket.help}
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
                <Form method="get" style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "end",
                  flexWrap: "wrap",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 20,
                  padding: 10,
                }}>
                  <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />

                  <label style={{
                    display: "grid",
                    gap: 5,
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                  }}>
                    Suche
                    <input
                      type="search"
                      name="q"
                      defaultValue={data.searchQuery || ""}
                      placeholder="Betreff, Absender oder Kunde"
                      style={{ ...inputStyle, minWidth: 270, borderRadius: 16 }}
                    />
                  </label>

                  <label style={{
                    display: "grid",
                    gap: 5,
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                  }}>
                    Zeitraum
                    <select
                      name="dateRange"
                      defaultValue={data.dateRange || ""}
                      style={{ ...inputStyle, minWidth: 190, borderRadius: 16 }}
                    >
                      <option value="">Alle Zeiträume</option>
                      <option value="today">Heute</option>
                      <option value="tomorrow">Morgen</option>
                      <option value="week">Nächste 7 Tage</option>
                    </select>
                  </label>

                  <button type="submit" style={{ ...primaryButtonStyle, height: 44 }}>
                    Filtern
                  </button>

                  <a href={"/auftragseingang?emailCategory=" + data.selectedEmailCategory} style={{ ...secondaryButtonStyle, height: 44 }}>
                    Zurücksetzen
                  </a>
                </Form>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10, marginBottom: 16 }}>
              {EMAIL_BUCKETS.map((bucket) => {
                const count = data.emailBuckets[bucket.key as keyof typeof data.emailBuckets] ?? 0;
                const params = new URLSearchParams();
                if (data.selectedDate) params.set("date", data.selectedDate);
                if (data.searchQuery) params.set("q", data.searchQuery);
                if (data.dateRange) params.set("dateRange", data.dateRange);
                params.set("emailCategory", bucket.key);
                const active = data.selectedEmailCategory === bucket.key;

                return (
                  <a
                    key={bucket.key}
                    href={"/auftragseingang?" + params.toString()}
                    style={{
                      border: "1px solid " + (active ? "#057a67" : "#dbe7ee"),
                      background: active ? "#057a67" : "#f8fafc",
                      color: active ? "#ffffff" : "#0f172a",
                      borderRadius: 18,
                      padding: "13px 14px",
                      textDecoration: "none",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <strong>{bucket.label}</strong>
                      <span style={{
                        borderRadius: 999,
                        padding: "3px 8px",
                        background: active ? "rgba(255,255,255,.18)" : "#ffffff",
                        fontSize: 12,
                        fontWeight: 950,
                      }}>
                        {count}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: active ? "rgba(255,255,255,.78)" : "#64748b", fontWeight: 700 }}>
                      {bucket.help}
                    </span>
                  </a>
                );
              })}
            </div>

            {data.emailInbox.length === 0 ? (
              <div style={{ border: "1px dashed #cbd5e1", borderRadius: 20, padding: 22, background: "#f8fafc", color: "#475569", fontWeight: 800 }}>
                {data.searchQuery
                  ? "Keine E-Mails für diese Suche gefunden."
                  : "Keine ungeprüften E-Mails in dieser Kategorie."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {data.emailInbox.map((mail: any) => {
                  const category = classifyIncomingEmail(mail);
                  return (
                    <article
                      key={mail.id}
                      style={mailCardStyle}
                    >
                      <div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
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
                        </div>
                      </div>

                      <div style={mailActionBarStyle}>
                        <a href={"/email-pruefung/" + mail.id} style={primaryButtonStyle}>Prüfen</a>

                        {category === "inquiries" ? (
                          <a href={"/angebot-vorbereiten/" + mail.id} style={{ ...secondaryButtonStyle, borderColor: "#bbf7d0", color: "#047857", background: "#ecfdf5" }}>
                            Angebot vorbereiten
                          </a>
                        ) : null}

                        {mail.status !== "IGNORED" ? (
                          <Form method="post">
                            <input type="hidden" name="intent" value="hideIncomingEmail" />
                            <input type="hidden" name="emailId" value={mail.id} />
                            <button type="submit" style={secondaryButtonStyle}>Ausblenden</button>
                          </Form>
                        ) : (
                          <Form method="post">
                            <input type="hidden" name="intent" value="restoreIncomingEmail" />
                            <input type="hidden" name="emailId" value={mail.id} />
                            <button type="submit" style={secondaryButtonStyle}>Einblenden</button>
                          </Form>
                        )}

                        <Form method="post" onSubmit={(event) => {
                          if (!confirm("Diese E-Mail wirklich aus dem Eingang löschen?")) event.preventDefault();
                        }}>
                          <input type="hidden" name="intent" value="deleteIncomingEmail" />
                          <input type="hidden" name="emailId" value={mail.id} />
                          <button type="submit" style={dangerButtonStyle}>Löschen</button>
                        </Form>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{ ...cardStyle, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={sectionLabelStyle}>Aufträge</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 26, letterSpacing: "-0.04em" }}>Zu prüfende Aufträge</h2>
              </div>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 18 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nummer</th>
                    <th style={thStyle}>Kunde</th>
                    <th style={thStyle}>Quelle</th>
                    <th style={thStyle}>Lieferung</th>
                    <th style={thStyle}>Positionen</th>
                    <th style={thStyle}>Summe</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.length === 0 ? (
                    <tr>
                      <td style={tdStyle} colSpan={8}>
                        <strong>Noch keine Aufträge vorhanden.</strong>
                      </td>
                    </tr>
                  ) : (
                    data.orders.map((order: any) => {
                      const total = order.items.reduce((sum: number, item: any) => sum + Number(item.totalCents || 0), 0);

                      return (
                        <tr key={order.id}>
                          <td style={tdStyle}>
                            <strong>{order.orderNumber}</strong>
                            {order.externalOrderNumber ? <div style={{ color: "#64748b", fontSize: 12 }}>{order.externalOrderNumber}</div> : null}
                          </td>
                          <td style={tdStyle}>
                            <strong>{order.customerName}</strong>
                            <div style={{ color: "#64748b", fontSize: 12 }}>{order.customerEmail || "-"}</div>
                          </td>
                          <td style={tdStyle}>{sourceLabel(order.source)}</td>
                          <td style={tdStyle}>
                            {formatDate(order.deliveryDate)}
                            <div style={{ color: "#64748b", fontSize: 12 }}>{order.deliveryTimeText || order.deliveryTime || "-"}</div>
                          </td>
                          <td style={tdStyle}>
                            <strong>{order.items.length} Positionen</strong>
                            <div style={{ display: "grid", gap: 5, marginTop: 7, maxWidth: 320 }}>
                              {order.items.slice(0, 2).map((item: any, index: number) => (
                                <div key={item.id} style={{ color: "#0f172a", fontSize: 13, lineHeight: 1.35 }}>
                                  <strong>{index + 1}.</strong> {item.name}
                                </div>
                              ))}
                              {order.items.length > 2 ? (
                                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 850 }}>
                                  + {order.items.length - 2} weitere Positionen
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td style={tdStyle}><strong>{centsToEuro(total)}</strong></td>
                          <td style={tdStyle}>
                            <span style={{
                              borderRadius: 999,
                              padding: "6px 10px",
                              background: order.status === "AUTO_CREATED" ? "#ecfdf5" : order.status === "CONFIRMED" ? "#eff6ff" : "#fff7ed",
                              color: order.status === "AUTO_CREATED" ? "#047857" : order.status === "CONFIRMED" ? "#1d4ed8" : "#9a3412",
                              fontSize: 12,
                              fontWeight: 950,
                              display: "inline-flex",
                            }}>
                              {statusLabel(order.status)}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "grid", gap: 8, minWidth: 132 }}>
                              <a href={"/auftrag-pruefung/" + order.id} style={primaryButtonStyle}>Prüfen</a>
                              <Form method="post" onSubmit={(event) => {
                                if (!confirm("Diesen Auftrag wirklich löschen?")) event.preventDefault();
                              }}>
                                <input type="hidden" name="intent" value="deleteOrder" />
                                <input type="hidden" name="orderId" value={order.id} />
                                <button type="submit" style={{ ...dangerButtonStyle, width: "100%" }}>Löschen</button>
                              </Form>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

export function ErrorBoundary({ error }: { error: any }) {
  const message = error?.data || error?.message || "Unbekannter Fehler im Auftragseingang.";
  const status = error?.status || 500;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#edf2f6",
      padding: 32,
      fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#07111f"
    }}>
      <section style={{
        maxWidth: 760,
        background: "white",
        border: "1px solid #dbe5ee",
        borderRadius: 28,
        padding: 28,
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.10)"
      }}>
        <div style={{ color: "#b91c1c", textTransform: "uppercase", letterSpacing: ".11em", fontSize: 11, fontWeight: 950, marginBottom: 8 }}>
          Fehler {status}
        </div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1, letterSpacing: "-0.055em" }}>
          Auftragseingang konnte nicht geladen werden
        </h1>
        <p style={{ margin: "14px 0 0", color: "#475569", fontWeight: 750, lineHeight: 1.55 }}>
          {String(message)}
        </p>
      </section>
    </div>
  );
}


