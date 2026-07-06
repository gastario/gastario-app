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
      dateRange: "last7",
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
      dateRange: "last7",
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
  const dateRange = url.searchParams.get("dateRange") || "last7";

  let selectedDateStart = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  let selectedDateEnd = selectedDateStart ? new Date(selectedDateStart) : null;

  if (selectedDateEnd) selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);

  if (!selectedDate && dateRange) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === "last7") {
      selectedDateStart = new Date(today);
      selectedDateStart.setDate(selectedDateStart.getDate() - 7);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "today") {
      selectedDateStart = new Date(today);
      selectedDateEnd = new Date(today);
      selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);
    }

    if (dateRange === "yesterday") {
      selectedDateStart = new Date(today);
      selectedDateStart.setDate(selectedDateStart.getDate() - 1);
      selectedDateEnd = new Date(today);
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
      dateRange: "last7",
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
    background: "#ffffff",
    border: "1px solid #dbe5ec",
    borderRadius: 14,
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.035)",
  };

  const mailCardStyle: any = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    background: "#ffffff",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    boxShadow: "none",
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
    letterSpacing: ".09em",
    fontSize: 10,
    fontWeight: 700,
  };

  const primaryButtonStyle: any = {
    border: "1px solid #0f9f7a",
    background: "#0f9f7a",
    color: "#ffffff",
    borderRadius: 8,
    padding: "7px 11px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
    minHeight: 34,
  };

  const secondaryButtonStyle: any = {
    border: "1px solid #d6e1ea",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 8,
    padding: "7px 11px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
  };

  const dangerButtonStyle: any = {
    ...secondaryButtonStyle,
    color: "#b91c1c",
    borderColor: "#fecaca",
    background: "#fff7f7",
  };

  const inputStyle: any = {
    height: 36,
    border: "1px solid #d6e1ea",
    borderRadius: 8,
    padding: "0 10px",
    fontWeight: 450,
    fontSize: 13,
    color: "#0f172a",
    background: "#ffffff",
  };

  const thStyle: any = {
    textAlign: "left",
    padding: "10px 12px",
    color: "#64748b",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".055em",
    borderBottom: "1px solid #e8eef4",
    fontWeight: 700,
  };

  const tdStyle: any = {
    padding: "11px 12px",
    borderBottom: "1px solid #edf2f7",
    verticalAlign: "top",
    fontSize: 13,
    fontWeight: 450,
  };

  if (data.setupError) {
    return (
      <AppLayout>
        <div style={pageStyle}>
          <div style={shellStyle}>
            <section style={{ ...cardStyle, padding: 20, maxWidth: 760 }}>
              <div style={sectionLabelStyle}>Fehler</div>
              <h1 style={{ margin: "8px 0 10px", fontSize: 25 }}>Auftragseingang konnte nicht geladen werden</h1>
              <p style={{ margin: 0, color: "#475569", fontWeight: 700 }}>{data.setupError}</p>
            </section>
          </div>
        </div>
      
      <style>{`
        /* inbox-lexoffice-polish-final */

        /* Seite insgesamt ruhiger */
        h1 {
          font-size: 32px !important;
          font-weight: 600 !important;
          letter-spacing: -0.04em !important;
        }

        h2 {
          font-size: 22px !important;
          font-weight: 600 !important;
          letter-spacing: -0.03em !important;
        }

        /* Header-Karte */
        div[style*="Arbeitsbereich"],
        header {
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035) !important;
        }

        /* Live Badge */
        a[href*="email-import"],
        button,
        .ghostButton,
        .primaryGhostButton {
          font-weight: 600 !important;
          border-radius: 10px !important;
          box-shadow: none !important;
        }

        /* KPI Karten oben */
        .metricCard,
        article {
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035) !important;
          border-radius: 18px !important;
        }

        .metricCard strong,
        article strong {
          font-weight: 600 !important;
          letter-spacing: -0.035em !important;
        }

        /* Auftragseingang Box */
        .emailInboxCard,
        section {
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035) !important;
          border-radius: 18px !important;
        }

        /* Such-/Filterleiste ruhiger */
        form[method="get"] {
          border-radius: 14px !important;
          box-shadow: none !important;
        }

        form[method="get"] label {
          font-size: 11px !important;
          font-weight: 650 !important;
          color: #64748b !important;
          letter-spacing: .06em !important;
        }

        form[method="get"] input,
        form[method="get"] select {
          min-height: 38px !important;
          border-radius: 9px !important;
          font-size: 14px !important;
          font-weight: 450 !important;
        }

        /* Kategorie-Karten kompakter */
        a[href*="emailCategory"] {
          border-radius: 14px !important;
          box-shadow: none !important;
          font-weight: 600 !important;
        }

        a[href*="emailCategory"] strong,
        a[href*="emailCategory"] span,
        a[href*="emailCategory"] div {
          font-weight: 600 !important;
        }

        /* Aktive Kategorie weniger massiv */
        a[href*="emailCategory"][style*="rgb(15, 159, 122)"],
        a[href*="emailCategory"][style*="#0f9f7a"] {
          box-shadow: none !important;
        }

        /* Kleine Zähler-Badges */
        a[href*="emailCategory"] small,
        a[href*="emailCategory"] em {
          font-weight: 600 !important;
        }

        /* Leere Box unten */
        div[style*="Keine ungeprüften"] {
          font-weight: 500 !important;
        }

        /* Tabellen / Listen */
        table th {
          font-weight: 650 !important;
          color: #64748b !important;
        }

        table td {
          font-weight: 450 !important;
        }

        /* Buttonfarben dezenter */
        button[type="submit"],
        a[href*="api/email-import/run"] {
          background: #0f9f7a !important;
          border-color: #0f9f7a !important;
          color: white !important;
          box-shadow: 0 6px 14px rgba(15, 159, 122, 0.10) !important;
        }

        /* Filterbutton nicht so fett */
        form[method="get"] button {
          height: 38px !important;
          padding: 0 14px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
        }

        /* Zurücksetzen Button */
        form[method="get"] a {
          height: 38px !important;
          padding: 0 14px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
        }

        /* Handy / kleinere Breite */
        @media (max-width: 1100px) {
          form[method="get"] {
            width: 100% !important;
          }

          form[method="get"] input,
          form[method="get"] select {
            min-width: 100% !important;
          }
        }
      `}</style>

    
      <style>{`
        /* inbox-compact-backoffice-v2 */

        /* Seite dichter und professioneller */
        h1 {
          font-size: 30px !important;
          font-weight: 600 !important;
          letter-spacing: -0.035em !important;
        }

        h2 {
          font-size: 21px !important;
          font-weight: 600 !important;
        }

        p {
          font-weight: 450 !important;
        }

        /* obere Headline-Karte kompakter */
        header,
        section:first-of-type {
          padding-top: 22px !important;
          padding-bottom: 22px !important;
        }

        /* KPI-Karten kleiner und weniger dominant */
        article {
          min-height: 78px !important;
          padding: 18px 18px !important;
          border-radius: 16px !important;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.03) !important;
        }

        article strong {
          font-size: 25px !important;
          font-weight: 600 !important;
          letter-spacing: -0.035em !important;
        }

        article p,
        article span,
        article small {
          font-size: 13px !important;
          font-weight: 500 !important;
        }

        /* aktive große grüne KPI weniger laut */
        article[style*="#0f9f7a"],
        article[style*="rgb(15, 159, 122)"] {
          box-shadow: none !important;
        }

        /* E-Mail-Karte kompakter */
        section {
          padding: 16px !important;
          border-radius: 17px !important;
        }

        /* Header in der E-Mail-Karte */
        section h2 {
          margin-bottom: 4px !important;
        }

        section h2 + p {
          margin-top: 0 !important;
          font-size: 14px !important;
          color: #64748b !important;
        }

        /* Suchleiste als flache Toolbar */
        form[method="get"] {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 13px !important;
          padding: 8px !important;
          gap: 8px !important;
        }

        form[method="get"] label {
          gap: 4px !important;
          font-size: 10.5px !important;
          font-weight: 650 !important;
          letter-spacing: .07em !important;
        }

        form[method="get"] input,
        form[method="get"] select {
          height: 36px !important;
          min-height: 36px !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          font-weight: 450 !important;
          padding: 0 11px !important;
        }

        form[method="get"] button,
        form[method="get"] a {
          height: 36px !important;
          min-height: 36px !important;
          border-radius: 8px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
        }

        /* Kategorie-Karten deutlich kompakter */
        a[href*="emailCategory"] {
          min-height: 68px !important;
          padding: 14px 15px !important;
          border-radius: 14px !important;
          box-shadow: none !important;
          background: #f8fafc !important;
          border: 1px solid #dbe5ec !important;
        }

        a[href*="emailCategory"]:hover {
          background: #f5faf8 !important;
          border-color: #bfded6 !important;
        }

        a[href*="emailCategory"] strong,
        a[href*="emailCategory"] b {
          font-size: 15px !important;
          font-weight: 600 !important;
          letter-spacing: -0.01em !important;
        }

        a[href*="emailCategory"] span,
        a[href*="emailCategory"] p,
        a[href*="emailCategory"] div {
          font-size: 12.5px !important;
          font-weight: 450 !important;
          line-height: 1.35 !important;
        }

        /* aktive Kategorie ruhiger, nicht so klobig */
        a[href*="emailCategory"][style*="#0f9f7a"],
        a[href*="emailCategory"][style*="rgb(15, 159, 122)"] {
          background: #0f8f70 !important;
          border-color: #0f8f70 !important;
          box-shadow: none !important;
        }

        a[href*="emailCategory"][style*="#0f9f7a"] *,
        a[href*="emailCategory"][style*="rgb(15, 159, 122)"] * {
          font-weight: 600 !important;
        }

        /* kleine Count-Badges */
        a[href*="emailCategory"] small,
        a[href*="emailCategory"] em {
          min-width: 22px !important;
          height: 22px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }

        /* Empty-State weniger schwer */
        div[style*="Keine ungeprüften"],
        div[style*="Keine E-Mails"] {
          min-height: 52px !important;
          border-radius: 13px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          color: #475569 !important;
          background: #f8fafc !important;
        }

        /* Auftragstabelle unten näher dran, weniger massiv */
        section + section {
          margin-top: 18px !important;
        }

        table th {
          height: 40px !important;
          font-size: 11.5px !important;
          font-weight: 700 !important;
        }

        table td {
          padding-top: 14px !important;
          padding-bottom: 14px !important;
          font-size: 14px !important;
        }

        /* globale Button-Beruhigung auf dieser Seite */
        button,
        a {
          box-shadow: none !important;
        }

        /* Header Button rechts weniger hoch */
        a[href*="email-import"],
        button[type="submit"] {
          min-height: 38px !important;
          border-radius: 9px !important;
          font-size: 13.5px !important;
          font-weight: 600 !important;
        }

        @media (max-width: 1100px) {
          form[method="get"] {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          a[href*="emailCategory"] {
            min-height: 62px !important;
          }
        }
      `}</style>

    
      <style>{`
        /* inbox-density-hard-compact */

        /* komplette Arbeitsfläche kompakter */
        main,
        .appShell {
          font-size: 14px !important;
        }

        /* Header-Karte kleiner */
        header {
          padding: 18px 22px !important;
          border-radius: 14px !important;
          margin-bottom: 14px !important;
        }

        header h1 {
          font-size: 28px !important;
          line-height: 1.05 !important;
          margin: 4px 0 0 !important;
        }

        header p {
          font-size: 14px !important;
          margin-top: 8px !important;
        }

        /* Live Text kompakter */
        header + p,
        div[style*="Live-Abruf"] {
          font-size: 13px !important;
          margin: 8px 0 12px !important;
        }

        /* obere KPI-Karten deutlich kleiner */
        article {
          min-height: 62px !important;
          padding: 13px 16px !important;
          border-radius: 13px !important;
        }

        article strong {
          font-size: 23px !important;
          line-height: 1 !important;
        }

        article p,
        article span,
        article small {
          font-size: 12px !important;
          line-height: 1.25 !important;
        }

        /* grid-Abstände der KPI-Karten reduzieren */
        div[style*="grid-template-columns"][style*="repeat"] {
          gap: 12px !important;
        }

        /* große Karten / Sections kompakter */
        section {
          padding: 18px 20px !important;
          border-radius: 14px !important;
          margin-top: 14px !important;
        }

        section h2 {
          font-size: 20px !important;
          line-height: 1.1 !important;
          margin: 0 0 4px !important;
        }

        section p {
          font-size: 13px !important;
          line-height: 1.35 !important;
        }

        /* Filterleiste kleiner */
        form[method="get"] {
          padding: 6px !important;
          border-radius: 10px !important;
          gap: 6px !important;
        }

        form[method="get"] label {
          font-size: 10px !important;
          gap: 3px !important;
        }

        form[method="get"] input,
        form[method="get"] select {
          height: 32px !important;
          min-height: 32px !important;
          border-radius: 7px !important;
          font-size: 13px !important;
          padding: 0 10px !important;
        }

        form[method="get"] button,
        form[method="get"] a {
          height: 32px !important;
          min-height: 32px !important;
          border-radius: 7px !important;
          padding: 0 11px !important;
          font-size: 13px !important;
        }

        /* Kategorie-Karten wirklich kleiner */
        a[href*="emailCategory"] {
          min-height: 54px !important;
          padding: 10px 12px !important;
          border-radius: 11px !important;
        }

        a[href*="emailCategory"] strong,
        a[href*="emailCategory"] b {
          font-size: 14px !important;
          line-height: 1.1 !important;
        }

        a[href*="emailCategory"] span,
        a[href*="emailCategory"] p,
        a[href*="emailCategory"] div {
          font-size: 11.5px !important;
          line-height: 1.25 !important;
        }

        a[href*="emailCategory"] small,
        a[href*="emailCategory"] em {
          min-width: 18px !important;
          height: 18px !important;
          font-size: 11px !important;
          padding: 0 5px !important;
        }

        /* Empty-State kleiner */
        div[style*="Keine ungeprüften"],
        div[style*="Keine E-Mails"] {
          min-height: 42px !important;
          padding: 12px 14px !important;
          border-radius: 10px !important;
          font-size: 13px !important;
        }

        /* Buttons allgemein kleiner */
        button,
        a {
          font-size: 13px !important;
        }

        a[href*="email-import"],
        button[type="submit"] {
          min-height: 34px !important;
          height: 34px !important;
          border-radius: 8px !important;
          padding: 0 12px !important;
          font-size: 13px !important;
        }

        /* Auftragstabelle unten kompakter */
        table th {
          height: 34px !important;
          font-size: 11px !important;
          padding-top: 8px !important;
          padding-bottom: 8px !important;
        }

        table td {
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          font-size: 13px !important;
        }

        /* große Abstände zwischen Bereichen reduzieren */
        section + section,
        article + article {
          margin-top: 12px !important;
        }

        /* Inhalt nicht so breit-luftig wirken lassen */
        div[style*="max-width: 1180"],
        div[style*="maxWidth: 1180"] {
          max-width: 1120px !important;
        }
      `}</style>

    
      <style>{`
        /* inbox-layout-clean-v5 */

        .inboxPage {
          max-width: 1160px !important;
        }

        .inboxHero {
          border-radius: 10px !important;
          padding: 16px 18px !important;
          margin-bottom: 10px !important;
        }

        .inboxHero h1 {
          font-size: 26px !important;
          font-weight: 600 !important;
        }

        .heroActions {
          gap: 6px !important;
        }

        .primaryBtn,
        .secondaryBtn,
        .softBtn,
        .dangerBtn,
        .statusPill {
          min-height: 31px !important;
          height: 31px !important;
          border-radius: 7px !important;
          padding: 0 10px !important;
          font-size: 12.5px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }

        .compactStats {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 8px !important;
          margin-bottom: 12px !important;
        }

        .statCard {
          min-height: 48px !important;
          padding: 9px 12px !important;
          border-radius: 8px !important;
        }

        .statCard strong {
          font-size: 21px !important;
        }

        .statCard span {
          font-size: 11.5px !important;
        }

        .inboxPanel {
          padding: 14px !important;
          border-radius: 10px !important;
        }

        .panelTop {
          display: grid !important;
          grid-template-columns: minmax(260px, 1fr) minmax(520px, 640px) !important;
          align-items: start !important;
          gap: 14px !important;
          margin-bottom: 12px !important;
        }

        .panelTop h2 {
          font-size: 20px !important;
          margin-top: 3px !important;
        }

        .panelTop p {
          font-size: 13px !important;
        }

        .filterBar {
          width: 100% !important;
          display: grid !important;
          grid-template-columns: minmax(190px, 1.2fr) minmax(170px, .8fr) auto auto !important;
          gap: 7px !important;
          align-items: end !important;
          padding: 7px !important;
          border-radius: 9px !important;
          background: #f8fafc !important;
        }

        .filterBar input,
        .filterBar select {
          width: 100% !important;
          min-width: 0 !important;
          height: 32px !important;
          min-height: 32px !important;
          font-size: 12.5px !important;
          border-radius: 7px !important;
        }

        .filterBar label {
          font-size: 9.8px !important;
          gap: 3px !important;
          min-width: 0 !important;
        }

        .bucketNav {
          display: grid !important;
          grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
          gap: 7px !important;
          margin-bottom: 10px !important;
        }

        .bucket {
          position: relative !important;
          overflow: hidden !important;
          min-height: 48px !important;
          padding: 9px 34px 9px 10px !important;
          border-radius: 8px !important;
          align-items: flex-start !important;
        }

        .bucket strong {
          font-size: 12.8px !important;
          line-height: 1.1 !important;
          white-space: normal !important;
        }

        .bucket small {
          font-size: 10.7px !important;
          line-height: 1.15 !important;
          margin-top: 3px !important;
          max-height: 25px !important;
          overflow: hidden !important;
        }

        .bucket b {
          position: absolute !important;
          right: 8px !important;
          top: 8px !important;
          min-width: 20px !important;
          height: 18px !important;
          padding: 0 5px !important;
          font-size: 10.5px !important;
          z-index: 2 !important;
        }

        .emptyState {
          padding: 11px 12px !important;
          font-size: 12.8px !important;
          border-radius: 8px !important;
        }

        .ordersPanel {
          padding: 14px !important;
          border-radius: 10px !important;
        }

        .ordersHead,
        .ordersRow {
          grid-template-columns: 1.15fr 1.25fr .85fr 1.35fr .75fr .75fr auto !important;
          gap: 10px !important;
        }

        .ordersHead {
          padding: 8px 10px !important;
          font-size: 10px !important;
        }

        .ordersRow {
          padding: 10px !important;
          font-size: 12.8px !important;
        }

        .ordersRow strong {
          font-weight: 600 !important;
        }

        .ordersRow small {
          font-size: 11.5px !important;
        }

        .statusBadge {
          font-size: 11.5px !important;
          padding: 3px 8px !important;
        }

        @media (max-width: 1250px) {
          .bucketNav {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .panelTop {
            grid-template-columns: 1fr !important;
          }

          .filterBar {
            grid-template-columns: 1fr 1fr auto auto !important;
          }
        }

        @media (max-width: 800px) {
          .compactStats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .bucketNav {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .filterBar {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </AppLayout>
    );
  }

  const currentBucket = EMAIL_BUCKETS.find((bucket) => bucket.key === data.selectedEmailCategory) || EMAIL_BUCKETS[0];

  const emailResetHref = "/auftragseingang?emailCategory=" + data.selectedEmailCategory + "&dateRange=last7";

  const sortedOrders = [...data.orders].sort((a: any, b: any) => {
    const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Number.MAX_SAFE_INTEGER;

    if (dateA !== dateB) return dateA - dateB;

    const timeToMinutes = (value: string | null | undefined) => {
      const match = String(value || "").match(/(\d{1,2})[:.](\d{2})/);
      if (!match) return 9999;
      return Number(match[1]) * 60 + Number(match[2]);
    };

    return timeToMinutes(a.deliveryTimeText) - timeToMinutes(b.deliveryTimeText);
  });

  return (
    <AppLayout>
      <div className="inboxPage">
        <header className="inboxHero">
          <div>
            <div className="inboxOverline">Arbeitsbereich</div>
            <h1>Auftragseingang</h1>
            <p>E-Mails abrufen, Anfragen vorbereiten, Aufträge prüfen und Lieferscheine trennen.</p>
          </div>

          <div className="heroActions">
            <button
              type="button"
              className={liveEnabled ? "statusPill isLive" : "statusPill"}
              onClick={() => setLiveEnabled((value) => !value)}
              title={lastAutoImportAt ? "Letzter Auto-Abruf: " + lastAutoImportAt : "Automatischer Abruf"}
            >
              {liveEnabled ? "Live an" : "Live aus"}
            </button>

            <button
              type="button"
              className="primaryBtn"
              onClick={runEmailImportAndReload}
              disabled={isImportingNow}
            >
              {isImportingNow ? "Abrufen..." : "E-Mails abrufen"}
            </button>
          </div>
        </header>

        <div className="liveInfo">
          {liveEnabled ? "Live-Abruf aktiv: neue E-Mails werden automatisch geprüft." : "Live-Abruf ist aus."}
          {lastAutoImportAt ? <span>Letzter Abruf: {lastAutoImportAt}</span> : null}
        </div>

        <section className="compactStats">
          {[
            ["Alle Aufträge", data.counts.all, ""],
            ["Zu prüfen", data.counts.review, "AUTO_CREATED"],
            ["Übernommen", data.counts.confirmed, "CONFIRMED"],
            ["Abgelehnt", data.counts.rejected, "REJECTED"],
          ].map(([label, count, status]) => {
            const active = data.activeStatus === status || (!data.activeStatus && !status);
            const href = status ? "/auftragseingang?status=" + status : "/auftragseingang";

            return (
              <a key={String(label)} href={href} className={active ? "statCard active" : "statCard"}>
                <span>{label}</span>
                <strong>{count}</strong>
              </a>
            );
          })}
        </section>

        {actionData?.error ? (
          <div className="alertBox error">{actionData.error}</div>
        ) : null}

        {actionData?.success ? (
          <div className="alertBox success">{actionData.success}</div>
        ) : null}

        <section className="inboxPanel">
          <div className="panelTop">
            <div>
              <div className="inboxOverline">E-Mail Eingang</div>
              <h2>{emailCategoryLabel(data.selectedEmailCategory)}</h2>
              <p>{currentBucket.help}</p>
            </div>

            <Form method="get" className="filterBar">
              <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />

              <label>
                Suche
                <input
                  name="q"
                  defaultValue={data.searchQuery || ""}
                  placeholder="Betreff, Absender, Kunde"
                />
              </label>

              <label>
                Postfach-Zeitraum
                <select name="dateRange" defaultValue={data.dateRange || "last7"}>
                  <option value="last7">Letzte 7 Tage</option>
                  <option value="today">Heute</option>
                  <option value="yesterday">Gestern</option>
                </select>
              </label>

              <button type="submit" className="primaryBtn small">Filtern</button>
              <a href={emailResetHref} className="secondaryBtn small">Zurücksetzen</a>
            </Form>
          </div>

          <div className="bucketNav">
            {EMAIL_BUCKETS.map((bucket) => {
              const count = data.emailBuckets[bucket.key as keyof typeof data.emailBuckets] ?? 0;
              const params = new URLSearchParams();

              if (data.searchQuery) params.set("q", data.searchQuery);
              if (data.dateRange) params.set("dateRange", data.dateRange);
              if (data.selectedDate) params.set("date", data.selectedDate);
              params.set("emailCategory", bucket.key);

              const active = data.selectedEmailCategory === bucket.key;

              return (
                <a
                  key={bucket.key}
                  href={"/auftragseingang?" + params.toString()}
                  className={active ? "bucket active" : "bucket"}
                >
                  <span>
                    <strong>{bucket.label}</strong>
                    <small>{bucket.help}</small>
                  </span>
                  <b>{count}</b>
                </a>
              );
            })}
          </div>

          {data.emailInbox.length === 0 ? (
            <div className="emptyState">Keine ungeprüften E-Mails in dieser Kategorie.</div>
          ) : (
            <div className="mailList">
              {data.emailInbox.map((mail: any) => {
                const category = classifyIncomingEmail(mail);

                return (
                  <article className="mailRow" key={mail.id}>
                    <div className="mailMain">
                      <div className="mailMeta">
                        <span>{emailCategoryLabel(category)}</span>
                        <time>{new Date(mail.receivedAt || mail.createdAt).toLocaleString("de-DE")}</time>
                      </div>

                      <h3>{mail.subject || "Ohne Betreff"}</h3>

                      <div className="mailSub">
                        <span>Von: {mail.sender || "-"}</span>
                        <span>Postfach: {mail.account?.email || mail.accountEmail || "-"}</span>
                        <span>{mail.attachments?.length || 0} Anhänge</span>
                      </div>

                      {mail.errorMessage ? <p className="mailHint">{mail.errorMessage}</p> : null}
                    </div>

                    <div className="mailActions">
                      <a href={"/email-pruefung/" + mail.id} className="primaryBtn small">Prüfen</a>

                      {category === "inquiries" ? (
                        <a href={"/angebot-vorbereiten/" + mail.id} className="softBtn small">
                          Angebot vorbereiten
                        </a>
                      ) : null}

                      {mail.status !== "IGNORED" ? (
                        <Form method="post">
                          <input type="hidden" name="intent" value="hideIncomingEmail" />
                          <input type="hidden" name="emailId" value={mail.id} />
                          <button type="submit" className="secondaryBtn small">Ausblenden</button>
                        </Form>
                      ) : (
                        <Form method="post">
                          <input type="hidden" name="intent" value="unhideIncomingEmail" />
                          <input type="hidden" name="emailId" value={mail.id} />
                          <button type="submit" className="secondaryBtn small">Einblenden</button>
                        </Form>
                      )}

                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteIncomingEmail" />
                        <input type="hidden" name="emailId" value={mail.id} />
                        <button type="submit" className="dangerBtn small">Löschen</button>
                      </Form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="ordersPanel">
          <div className="panelTop slim">
            <div>
              <div className="inboxOverline">Aufträge</div>
              <h2>Zu prüfende Aufträge</h2>
            </div>
          </div>

          <div className="ordersTable">
            <div className="ordersHead">
              <span>Nummer</span>
              <span>Kunde</span>
              <span>Lieferung</span>
              <span>Positionen</span>
              <span>Summe</span>
              <span>Status</span>
              <span>Aktion</span>
            </div>

            {sortedOrders.length === 0 ? (
              <div className="ordersEmpty">Keine Aufträge im aktuellen Filter.</div>
            ) : (
              sortedOrders.map((order: any) => {
                const total = order.items.reduce((sum: number, item: any) => sum + (item.totalCents || item.totalPriceCents || 0), 0);

                return (
                  <div className="ordersRow" key={order.id}>
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <small>{sourceLabel(order.source)}</small>
                    </div>

                    <div>
                      <strong>{order.customerName || order.customer?.name || "-"}</strong>
                      <small>{order.contactName || "-"}</small>
                    </div>

                    <div>
                      <strong>{formatDate(order.deliveryDate)}</strong>
                      <small>{order.deliveryTimeText || "-"}</small>
                    </div>

                    <div>
                      <strong>{order.items.length} Positionen</strong>
                      <small>{order.items.slice(0, 2).map((item: any) => item.name).join(", ") || "-"}</small>
                    </div>

                    <strong>{centsToEuro(total)}</strong>

                    <span className="statusBadge">{statusLabel(order.status)}</span>

                    <div className="orderActions">
                      <a href={"/auftrag-pruefung/" + order.id} className="primaryBtn small">Prüfen</a>

                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteOrder" />
                        <input type="hidden" name="orderId" value={order.id} />
                        <button type="submit" className="dangerBtn small">Löschen</button>
                      </Form>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <style>{`
        .inboxPage {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 22px 40px;
          color: #111827;
        }

        .inboxHero,
        .inboxPanel,
        .ordersPanel {
          background: #ffffff;
          border: 1px solid #dbe5ec;
          border-radius: 12px;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.035);
        }

        .inboxHero {
          padding: 18px 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 10px;
        }

        .inboxOverline {
          color: #047857;
          text-transform: uppercase;
          letter-spacing: .09em;
          font-size: 10px;
          font-weight: 700;
        }

        .inboxHero h1 {
          margin: 5px 0 0;
          font-size: 28px !important;
          line-height: 1.08;
          font-weight: 600 !important;
          letter-spacing: -0.035em;
        }

        .inboxHero p,
        .panelTop p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 14px;
          font-weight: 450;
        }

        .heroActions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .liveInfo {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
          margin: 0 0 10px;
        }

        .compactStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .statCard {
          min-height: 58px;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid #dbe5ec;
          background: #ffffff;
          text-decoration: none;
          color: #111827;
          display: grid;
          align-content: center;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.025);
        }

        .statCard.active {
          background: #0f8f70;
          border-color: #0f8f70;
          color: white;
        }

        .statCard span {
          font-size: 12px;
          color: inherit;
          opacity: .84;
          font-weight: 600;
        }

        .statCard strong {
          font-size: 24px;
          line-height: 1;
          margin-top: 3px;
          font-weight: 600;
          letter-spacing: -0.035em;
        }

        .inboxPanel,
        .ordersPanel {
          padding: 16px;
          margin-bottom: 14px;
        }

        .panelTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        .panelTop.slim {
          margin-bottom: 10px;
        }

        .panelTop h2 {
          margin: 4px 0 0;
          font-size: 21px !important;
          font-weight: 600 !important;
          letter-spacing: -0.03em;
        }

        .filterBar {
          display: flex;
          align-items: end;
          gap: 8px;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          flex-wrap: wrap;
        }

        .filterBar label {
          display: grid;
          gap: 4px;
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: .065em;
          font-weight: 700;
        }

        .filterBar input,
        .filterBar select {
          height: 34px !important;
          min-height: 34px !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          min-width: 190px;
        }

        .filterBar input {
          min-width: 260px;
        }

        .bucketNav {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }

        .bucket {
          min-height: 52px;
          padding: 10px 12px;
          border: 1px solid #dbe5ec;
          border-radius: 10px;
          background: #f8fafc;
          text-decoration: none;
          color: #111827;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .bucket.active {
          background: #0f8f70;
          border-color: #0f8f70;
          color: #ffffff;
        }

        .bucket strong {
          display: block;
          font-size: 14px;
          line-height: 1.15;
          font-weight: 600;
        }

        .bucket small {
          display: block;
          margin-top: 4px;
          font-size: 11.5px;
          line-height: 1.25;
          color: inherit;
          opacity: .76;
          font-weight: 450;
        }

        .bucket b {
          min-width: 22px;
          height: 20px;
          padding: 0 7px;
          border-radius: 999px;
          background: rgba(255,255,255,.85);
          color: #111827;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 650;
        }

        .bucket.active b {
          background: rgba(255,255,255,.2);
          color: #ffffff;
        }

        .emptyState,
        .ordersEmpty {
          padding: 14px;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          background: #f8fafc;
          color: #475569;
          font-size: 13px;
          font-weight: 500;
        }

        .mailList {
          display: grid;
          gap: 9px;
        }

        .mailRow {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
        }

        .mailMeta,
        .mailSub {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          color: #64748b;
          font-size: 12px;
          font-weight: 500;
        }

        .mailMeta span {
          color: #047857;
          background: #ecfdf5;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 650;
        }

        .mailRow h3 {
          margin: 7px 0 5px;
          font-size: 15px;
          line-height: 1.25;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .mailHint {
          margin: 8px 0 0;
          color: #9a3412;
          font-size: 12px;
          font-weight: 500;
        }

        .mailActions,
        .orderActions {
          display: flex;
          gap: 7px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .primaryBtn,
        .secondaryBtn,
        .softBtn,
        .dangerBtn,
        .statusPill {
          min-height: 34px;
          border-radius: 8px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          white-space: nowrap;
        }

        .primaryBtn {
          background: #0f9f7a;
          border-color: #0f9f7a;
          color: #ffffff;
        }

        .secondaryBtn,
        .statusPill {
          background: #ffffff;
          border-color: #d6e1ea;
          color: #111827;
        }

        .statusPill.isLive,
        .softBtn {
          background: #ecfdf5;
          border-color: #bbf7d0;
          color: #047857;
        }

        .dangerBtn {
          background: #fffafa;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .small {
          min-height: 32px;
          padding: 0 10px;
          font-size: 12.5px;
        }

        .ordersTable {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          background: #ffffff;
        }

        .ordersHead,
        .ordersRow {
          display: grid;
          grid-template-columns: 1.1fr 1.25fr .9fr 1.25fr .75fr .75fr auto;
          gap: 12px;
          align-items: center;
        }

        .ordersHead {
          padding: 10px 12px;
          background: #f8fafc;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .06em;
          border-bottom: 1px solid #e2e8f0;
        }

        .ordersRow {
          padding: 12px;
          border-bottom: 1px solid #edf2f7;
          font-size: 13px;
        }

        .ordersRow:last-child {
          border-bottom: 0;
        }

        .ordersRow strong {
          display: block;
          font-weight: 600;
          line-height: 1.25;
        }

        .ordersRow small {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.25;
          font-weight: 450;
        }

        .statusBadge {
          width: fit-content;
          border-radius: 999px;
          padding: 4px 9px;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #bbf7d0;
          font-size: 12px;
          font-weight: 600;
        }

        .alertBox {
          padding: 11px 13px;
          border-radius: 9px;
          margin-bottom: 12px;
          font-size: 13px;
          font-weight: 600;
        }

        .alertBox.error {
          background: #fff7ed;
          border: 1px solid #fdba74;
          color: #9a3412;
        }

        .alertBox.success {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #047857;
        }

        @media (max-width: 1100px) {
          .inboxHero,
          .panelTop,
          .mailRow {
            grid-template-columns: 1fr;
            display: grid;
          }

          .compactStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ordersHead {
            display: none;
          }

          .ordersRow {
            grid-template-columns: 1fr;
          }

          .filterBar,
          .filterBar input,
          .filterBar select {
            width: 100%;
            min-width: 0;
          }

          .mailActions,
          .orderActions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </AppLayout>
  );
}



