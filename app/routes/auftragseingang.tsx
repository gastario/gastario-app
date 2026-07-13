import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Form, Link, redirect, useActionData, useFetcher, useLoaderData } from "react-router";

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
      activeStatus: "ALL",
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
      activeStatus: "ALL",
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

  const currentOrdersDateStart = new Date();
  currentOrdersDateStart.setHours(0, 0, 0, 0);

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
    const [orders, emailInbox, counts, totalOrdersInDatabase, latestOrdersAnyTenant, incomingTotal, incomingUnlinked, latestIncomingAnyTenant] = await Promise.all([
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
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,

          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "AUTO_CREATED" as any,

          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "CONFIRMED" as any,

          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "REJECTED" as any,

          },
        }),
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
      debugInfo: {
        userId,
        tenantId: tenantUser.tenantId,
        tenantName: tenantUser.tenant?.name || "",
        ordersLoaded: orders.length,
        ordersInTenant: counts[0],
        totalOrdersInDatabase,
        latestOrdersAnyTenant,
        incomingTotal,
        incomingUnlinked,
        latestIncomingAnyTenant,
      },
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


function toImportNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatImportCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format((Number(cents) || 0) / 100);
}

function getOrderPositionsTotalCents(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];

  return items.reduce((sum: number, item: any) => {
    const directTotal =
      toImportNumber(item?.totalCents) ||
      toImportNumber(item?.totalPriceCents) ||
      toImportNumber(item?.lineTotalCents) ||
      toImportNumber(item?.amountCents);

    if (directTotal > 0) return sum + directTotal;

    const quantity =
      toImportNumber(item?.quantity) ||
      toImportNumber(item?.qty) ||
      1;

    const unitCents =
      toImportNumber(item?.unitCents) ||
      toImportNumber(item?.unitPriceCents) ||
      toImportNumber(item?.priceCents);

    return sum + quantity * unitCents;
  }, 0);
}

function getDisplayedOrderTotal(order: any) {
  const documentTotal =
    toImportNumber(order?.totalCents) ||
    toImportNumber(order?.grossTotalCents) ||
    toImportNumber(order?.netTotalCents) ||
    toImportNumber(order?.amountCents) ||
    toImportNumber(order?.sumCents);

  const positionsTotal = getOrderPositionsTotalCents(order);

  if (documentTotal > 0) {
    return {
      cents: documentTotal,
      source: "PDF-Summe",
      positionsCents: positionsTotal,
    };
  }

  return {
    cents: positionsTotal,
    source: "vorläufig",
    positionsCents: positionsTotal,
  };
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
      
      

    </AppLayout>
    );
  }

  const currentBucket = EMAIL_BUCKETS.find((bucket) => bucket.key === data.selectedEmailCategory) || EMAIL_BUCKETS[0];

  const isInquiryView = data.selectedEmailCategory === "inquiries";
  const isReviewMailView = data.selectedEmailCategory === "possible" || data.selectedEmailCategory === "review";
  const isIgnoredMailView = data.selectedEmailCategory === "hidden" || data.selectedEmailCategory === "ignored";
  const isEmailFocusedView = isInquiryView || isReviewMailView || isIgnoredMailView || data.selectedEmailCategory === "all";

  const inboxHeadline = isInquiryView
    ? "Anfragen / Leads"
    : isReviewMailView
      ? "Unklare E-Mails"
      : isIgnoredMailView
        ? "Ignorierte E-Mails"
        : data.selectedEmailCategory === "all"
          ? "Eingangszentrale"
          : "Auftragsbestätigungen";

  const inboxSubtitle = isInquiryView
    ? "Neue Catering-Anfragen erkennen, prüfen und später direkt in Angebote umwandeln."
    : isReviewMailView
      ? "E-Mails, bei denen Gastario oder die KI noch keine sichere Entscheidung treffen konnte."
      : isIgnoredMailView
        ? "Mails, die ausgeblendet oder automatisch ignoriert wurden."
        : data.selectedEmailCategory === "all"
          ? "Alle aktuellen Eingänge: Aufträge, Anfragen, unklare Mails und ignorierte Vorgänge."
          : "E-Mails abrufen, Aufträge kontrollieren und sauber in die Produktion übernehmen.";

  const emailResetHref = "/auftragseingang?emailCategory=" + data.selectedEmailCategory + "&dateRange=last7";

  const sortedOrders = [...data.orders].sort((a: any, b: any) => {
    const now = Date.now();

    const getDateTime = (order: any) => {
      const date = order.deliveryDate ? new Date(order.deliveryDate) : null;

      if (!date || Number.isNaN(date.getTime())) {
        return Number.MAX_SAFE_INTEGER;
      }

      const match = String(order.deliveryTimeText || "").match(/(\d{1,2})[:.](\d{2})/);

      if (match) {
        date.setHours(Number(match[1]), Number(match[2]), 0, 0);
      } else {
        date.setHours(23, 59, 0, 0);
      }

      return date.getTime();
    };

    const timeA = getDateTime(a);
    const timeB = getDateTime(b);

    const aIsPast = timeA < now;
    const bIsPast = timeB < now;

    if (aIsPast !== bIsPast) {
      return aIsPast ? 1 : -1;
    }

    return timeA - timeB;
  });

  const sortedEmails = [...data.emailInbox].sort((a: any, b: any) => {
    const dateA = new Date(a.receivedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.receivedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const activeOrderStatusRaw = String(data.activeStatus || "ALL");
const activeOrderStatus = activeOrderStatusRaw === "ALL" ? "" : activeOrderStatusRaw;

  const activeOrderViewTitle = isEmailFocusedView ? inboxHeadline :
    activeOrderStatusRaw === "CONFIRMED"
      ? "Übernommene Aufträge"
      : activeOrderStatusRaw === "REJECTED"
        ? "Abgelehnte Aufträge"
        : activeOrderStatusRaw === "AUTO_CREATED"
          ? "Zu prüfen"
          : "Alle Aufträge";

  const activeOrderViewSubtitle = isEmailFocusedView ? inboxSubtitle :
    activeOrderStatusRaw === "CONFIRMED"
      ? "Aufträge, die bereits übernommen wurden."
      : activeOrderStatusRaw === "REJECTED"
        ? "Aufträge, die nicht übernommen wurden."
        : activeOrderStatusRaw === "AUTO_CREATED"
          ? "Nur Aufträge, die noch kontrolliert und übernommen werden müssen."
          : "Alle aktuellen Aufträge im Auftragseingang.";

  const activeOrderViewCountLabel =
    activeOrderStatusRaw === "CONFIRMED"
      ? "übernommen"
      : activeOrderStatusRaw === "REJECTED"
        ? "abgelehnt"
        : activeOrderStatusRaw === "AUTO_CREATED"
          ? "offen"
          : "gesamt";
  const visibleOrders = sortedOrders.filter((order: any) => {
    if (isLikelyTrashImportOrder(order)) return false;

    if (activeOrderStatus && order.status !== activeOrderStatus) {
      return false;
    }

    if (!order.deliveryDate) return true;

    const deliveryDate = new Date(order.deliveryDate);

    if (Number.isNaN(deliveryDate.getTime())) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return deliveryDate >= today;
  });

  const hiddenPastOrderCount = sortedOrders.length - visibleOrders.length;
  function isLikelyTrashImportOrder(order: any) {
    const customerName = String(order?.customerName || order?.customer?.name || "").trim().toLowerCase();
    const contactName = String(order?.contactName || "").trim().toLowerCase();
    const eventName = String(order?.eventName || "").trim().toLowerCase();
    const totalInfo = getDisplayedOrderTotal(order);
    const items = Array.isArray(order?.items) ? order.items : [];

    const hasRealCustomer =
      customerName &&
      customerName !== "e-mail import" &&
      customerName !== "email import" &&
      customerName !== "kunde unbekannt";

    const hasRealItem = items.some((item: any) => {
      const name = String(item?.name || "").trim().toLowerCase();
      const totalCents = Number(item?.totalCents || 0);
      const quantity = Number(item?.quantity || 0);

      if (!name) return false;
      if (name.includes("fehlende position")) return false;
      if (name.includes("habe lieferkosten")) return false;
      if (name.includes("kosten für")) return false;
      if (name.includes("servicepersonal")) return false;
      if (name.includes("gas or electric grills")) return false;
      if (name.includes("onsite")) return false;
      if (name.includes("stattfinden")) return false;

      return name.length >= 4 && (quantity > 0 || totalCents > 0);
    });

    const hasMoney = totalInfo.cents > 0;

    const trashContact =
      !contactName ||
      contactName === "keine kontaktperson erkannt" ||
      contactName === "kontakt unbekannt";

    const trashCustomer =
      !customerName ||
      customerName === "e-mail import" ||
      customerName === "email import" ||
      customerName === "kunde unbekannt";

    const weakText =
      eventName.includes("e-mail import") ||
      eventName.includes("email import") ||
      eventName.includes("habe lieferkosten") ||
      eventName.includes("servicepersonal") ||
      eventName.includes("gas or electric grills") ||
      eventName.includes("onsite") ||
      eventName.includes("stattfinden");

    if (hasRealCustomer && (hasRealItem || hasMoney)) return false;
    if (hasRealItem || hasMoney) return false;

    if (trashCustomer && trashContact) return true;
    if (weakText && !hasRealItem && !hasMoney) return true;

    return false;
  }

  const currentOrderStats = {
    all: data.counts?.all || 0,
    review: data.counts?.review || 0,
    confirmed: data.counts?.confirmed || 0,
    rejected: data.counts?.rejected || 0,
  };

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const selectedOrder: any =
    selectedOrderId
      ? visibleOrders.find((order: any) => order.id === selectedOrderId) || null
      : null;

  const selectedOrderItems = selectedOrder
    ? (Array.isArray(selectedOrder.items) ? selectedOrder.items : []).filter(
        (item: any) => !String(item.name || "").toLowerCase().includes("fehlende position")
      )
    : [];

  const selectedOrderTotal = selectedOrder ? getDisplayedOrderTotal(selectedOrder) : null;


  return (
    <AppLayout>
      <div className="inboxPage inboxFinalPage">
{data.setupError ? (
          <div style={{
            margin: "0 0 18px",
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 800,
          }}>
            {data.setupError}
          </div>
        ) : null}
<section className="finalHeader">
          <div>
            <div className="finalEyebrow">{isEmailFocusedView ? "Eingang" : "Auftragseingang"}</div>
            <h1>{inboxHeadline}</h1>
            <p>{inboxSubtitle}</p>

            <div className="finalMiniSummary">
              <span>
                <strong>{currentOrderStats.all}</strong>
                gesamt
              </span>
              <span>
                <strong>{currentOrderStats.review}</strong>
                offen
              </span>
              <span>
                <strong>{currentOrderStats.confirmed}</strong>
                übernommen
              </span>
            </div>
          </div>

          <div className="finalHeaderActions">
            <button
              type="button"
              className={liveEnabled ? "finalGhost isLive" : "finalGhost"}
              onClick={() => setLiveEnabled((value) => !value)}
              title={lastAutoImportAt ? "Letzter Auto-Abruf: " + lastAutoImportAt : "Automatischer Abruf"}
            >
              <span></span>
              {liveEnabled ? "Live an" : "Live aus"}
            </button>

            <button
              type="button"
              className="finalPrimary"
              onClick={runEmailImportAndReload}
              disabled={isImportingNow}
            >
              {isImportingNow ? "Abruf läuft..." : "E-Mails abrufen"}
            </button>
          </div>
        </section>

        {actionData?.error ? (
          <div className="finalAlert error">{actionData.error}</div>
        ) : null}

        {actionData?.success ? (
          <div className="finalAlert success">{actionData.success}</div>
        ) : null}

        <section className="finalInboxShell">
          <nav className="finalCategoryTabs" aria-label="E-Mail-Kategorien">
            {[
              ["all", "Alle", data.emailBuckets?.all || 0],
              ["orders", "Bestätigungen", data.emailBuckets?.orders || 0],
              ["possible", "Unklar", data.emailBuckets?.possible || 0],
              ["inquiries", "Anfragen", data.emailBuckets?.inquiries || 0],
              ["reminders", "Lieferscheine", data.emailBuckets?.reminders || 0],
              ["other", "Sonstiges", data.emailBuckets?.other || 0],
              ["hidden", "Ausgeblendet", data.emailBuckets?.hidden || 0],
            ].map(([key, label, count]) => {
              const params = new URLSearchParams();

              params.set("emailCategory", String(key));
              if (data.dateRange) params.set("dateRange", data.dateRange);
              if (data.searchQuery) params.set("q", data.searchQuery);
              if (data.selectedDate) params.set("date", data.selectedDate);

              const active = data.selectedEmailCategory === key;

              return (
                <Link
                  key={String(key)}
                  to={"/auftragseingang?" + params.toString()}
                  className={active ? "finalCategoryTab active" : "finalCategoryTab"}
                  prefetch="intent"
                >
                  <span>{label}</span>
                  <strong>{count}</strong>
                </Link>
              );
            })}
          </nav>

          <Form method="get" className="finalToolbar">
            <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />

            <label className="finalSearch">
              <span>Suche</span>
              <input
                name="q"
                defaultValue={data.searchQuery || ""}
                placeholder="Absender, Kunde oder Betreff suchen ..."
              />
            </label>

            <label className="finalSelect">
              <span>Zeitraum</span>
              <select name="dateRange" defaultValue={data.dateRange || "last7"}>
                <option value="last7">Letzte 7 Tage</option>
                <option value="today">Heute</option>
                <option value="yesterday">Gestern</option>
              </select>
            </label>

            <button type="submit" className="finalFilterButton">Weitere Filter</button>
            <Link to={"/auftragseingang?emailCategory=" + data.selectedEmailCategory + "&dateRange=last7"} className="finalResetButton">
              Zurücksetzen
            </Link>
          </Form>
        </section>
                <nav className="realOrderTabs" aria-label="Auftragsfilter">
          {[
            ["Alle Aufträge", currentOrderStats.all, ""],
            ["Zu prüfen", currentOrderStats.review, "AUTO_CREATED"],
            ["Übernommen", currentOrderStats.confirmed, "CONFIRMED"],
            ["Abgelehnt", currentOrderStats.rejected, "REJECTED"],
          ].map(([label, count, status]) => {
            const active = activeOrderStatus === status || (!activeOrderStatus && !status);
            const params = new URLSearchParams();

            if (status) params.set("status", String(status));

            const href = "/auftragseingang" + (params.toString() ? "?" + params.toString() : "");

            return (
              <a key={String(label)} href={href} className={active ? "realOrderTab active" : "realOrderTab"}>
                <span>{label}</span>
                <strong>{count}</strong>
              </a>
            );
          })}
        </nav>
<section className="finalOrdersShell finalOrdersSplitShell">
          <div className="finalOrdersHead">
            <div>
              <h2>{activeOrderViewTitle}</h2>
              <p>{activeOrderViewSubtitle}</p>
            </div>

            <div className="finalOrdersRight">
              <strong>{visibleOrders.length}</strong>
              <span>{activeOrderViewCountLabel}</span>
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <div className="finalEmpty">
              {data.setupError ? data.setupError : 'Keine Aufträge in dieser Ansicht.'}
            </div>
          ) : (
            <div className={selectedOrder ? "finalOrdersGrid selectedFocusMode" : "finalOrdersGrid"}>
              <div className="finalOrderRows">
                {visibleOrders.map((order: any, index: number) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  const totalInfo = getDisplayedOrderTotal(order);
                  const previewItems = items
                    .filter((item: any) => !String(item.name || "").toLowerCase().includes("fehlende position"))
                    .slice(0, 3);

                  return (
                    <article
                      className={selectedOrder?.id === order.id ? "finalOrderRow selected" : "finalOrderRow"}
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedOrderId(order.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedOrderId(order.id);
                        }
                      }}
                    >
                      <div className="finalOrderIcon">✉</div>

                      <div className="finalOrderCustomer">
                        <div className="finalOrderNumber">{order.orderNumber}</div>
                        <h3>{order.customerName || order.customer?.name || "Kunde unbekannt"}</h3>
                        <p>{order.contactName || "Keine Kontaktperson erkannt"}</p>
                        <span className="finalSourceBadge">{sourceLabel(order.source)}</span>
                      </div>

                      <div className="finalOrderItems">
                        {previewItems.map((item: any) => (
                          <div key={item.id || item.name}>
                            <strong>{item.quantity || 1}x</strong>
                            <span>{item.name || "Position"}</span>
                          </div>
                        ))}

                        {items.length > previewItems.length ? (
                          <small>+ {items.length - previewItems.length} weitere Position</small>
                        ) : null}
                      </div>

                      <div className="finalOrderDate">
                        <strong>{formatDate(order.deliveryDate)}</strong>
                        <span>{order.deliveryTimeText || "Uhrzeit offen"}</span>
                      </div>

                      <div className="finalOrderTotal">
                        <strong>{formatImportCurrencyFromCents(totalInfo.cents)}</strong>
                        <span>{totalInfo.source}</span>
                      </div>
                    </article>
                  );
                })}

                <div className="finalLoadMore">Weitere Ergebnisse laden</div>
              </div>

              {selectedOrder ? (
                <aside className="finalSelectedPanel" key={selectedOrder.id}>
                  <div className="finalSelectedTop">
                    <div>
                      <div className="finalSelectedKicker">Ausgewählt</div>
                      <div className="finalOrderNumber">{selectedOrder.orderNumber}</div>
                      <h3>{selectedOrder.customerName || selectedOrder.customer?.name || "Kunde unbekannt"}</h3>
                    </div>

                    <span className="finalSourceBadge big">{sourceLabel(selectedOrder.source)}</span>
                  </div>

                  <div className="finalSelectedFacts">
                    <div>
                      <span>Lieferung</span>
                      <strong>{formatDate(selectedOrder.deliveryDate)}</strong>
                      <small>{selectedOrder.deliveryTimeText || "Uhrzeit offen"}</small>
                    </div>

                    <div>
                      <span>Lieferadresse</span>
                      <strong>{selectedOrder.customerName || selectedOrder.customer?.name || "Kunde unbekannt"}</strong>
                      <small>{selectedOrder.deliveryAddress || "Adresse prüfen"}</small>
                    </div>

                    <div>
                      <span>Gesamt</span>
                      <strong>{selectedOrderTotal ? formatImportCurrencyFromCents(selectedOrderTotal.cents) : "-"}</strong>
                      <small>{selectedOrderTotal?.source || "bitte prüfen"}</small>
                    </div>
                  </div>

                  <div className="finalSelectedItems">
                    <h4>Positionen</h4>

                    {selectedOrderItems.slice(0, 6).map((item: any) => (
                      <div className="finalSelectedItem" key={item.id || item.name}>
                        <span>
                          <strong>{item.quantity || 1}x</strong>
                          {item.name || "Position"}
                        </span>
                        <b>{formatImportCurrencyFromCents(Number(item.totalCents || 0))}</b>
                      </div>
                    ))}

                    {selectedOrderItems.length > 6 ? (
                      <div className="finalSelectedMore">+ {selectedOrderItems.length - 6} weitere Positionen</div>
                    ) : null}
                  </div>

                  {selectedOrderTotal?.source === "vorläufig" ? (
                    <div className="finalSelectedNotice">
                      Der Betrag ist vorläufig und sollte vor Übernahme geprüft werden.
                    </div>
                  ) : null}

                  <div className="finalSelectedActions">
                    <button type="button" className="finalBackButton" onClick={() => setSelectedOrderId(null)}>
                      Zurück zur Liste
                    </button>

                    <Link to={"/auftrag-pruefung/" + selectedOrder.id} prefetch="intent">
                      Prüfen & übernehmen
                    </Link>

                    <Form method="post">
                      <input type="hidden" name="intent" value="deleteOrder" />
                      <input type="hidden" name="orderId" value={selectedOrder.id} />
                      <button type="submit">Löschen</button>
                    </Form>
                  </div>
                </aside>
              ) : null}
            </div>
          )}

          {hiddenPastOrderCount > 0 ? (
            <div className="finalHint">
              {hiddenPastOrderCount} vergangene Auftrag{hiddenPastOrderCount === 1 ? "" : "e"} ausgeblendet.{" "}
              <Link to="/auftraege?view=past">Vergangene Aufträge öffnen</Link>
            </div>
          ) : null}
        </section>
</div>

      <style>{`
        /* gastario-final-auftragseingang-selected-ux-20260709 */

        .inboxFinalPage {
          max-width: 1220px;
          margin: 0 auto;
          padding: 0 24px 52px;
          color: #0f172a;
        }

        .inboxFinalPage * {
          box-sizing: border-box;
        }

        .finalEyebrow {
          color: #0f9f7a;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .finalHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 18px;
        }

        .finalHeader h1 {
          margin: 6px 0 0;
          color: #061f1b;
          font-size: 34px;
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -1.25px;
        }

        .finalHeader p {
          margin: 8px 0 0;
          max-width: 720px;
          color: #526579;
          font-size: 14px;
          line-height: 1.5;
          font-weight: 700;
        }

        .finalMiniSummary {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          margin-top: 16px;
          padding: 8px 12px;
          border: 1px solid #dbe7e2;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 8px 22px rgba(15, 23, 42, .035);
        }

        .finalMiniSummary span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #536579;
          font-size: 13px;
          font-weight: 850;
          white-space: nowrap;
        }

        .finalMiniSummary strong {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          border-radius: 999px;
          background: #eef6f4;
          color: #0f766e;
          font-size: 12px;
          font-weight: 950;
        }

        .finalHeaderActions {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .finalGhost,
        .finalPrimary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 12px;
          border: 1px solid #d6e5df;
          background: #ffffff;
          color: #0f172a;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
        }

        .finalGhost span {
          width: 8px;
          height: 8px;
          margin-right: 8px;
          border-radius: 999px;
          background: #22c55e;
        }

        .finalGhost.isLive {
          color: #08765d;
          background: #f0fdf9;
          border-color: #b7e4d6;
        }

        .finalPrimary {
          border-color: #10a37f;
          background: #10a37f;
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(16, 163, 127, .22);
        }

        .finalAlert {
          margin-bottom: 12px;
          padding: 12px 14px;
          border-radius: 13px;
          font-weight: 850;
        }

        .finalAlert.error {
          background: #fff1f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .finalAlert.success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .finalInboxShell {
          overflow: hidden;
          margin-bottom: 22px;
          border: 1px solid #dbe7e2;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(15, 23, 42, .045);
        }

        .finalCategoryTabs {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
          padding: 16px;
          border-bottom: 1px solid #edf3f1;
        }

        .finalCategoryTab {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 12px;
          border: 1px solid transparent;
          border-radius: 999px;
          color: #172033;
          background: transparent;
          text-decoration: none;
          font-size: 14px;
          font-weight: 900;
          white-space: nowrap;
        }

        .finalCategoryTab strong {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          border-radius: 999px;
          background: #eef2f7;
          color: #475569;
          font-size: 12px;
          font-weight: 950;
        }

        .finalCategoryTab.active {
          background: #10a37f;
          border-color: #10a37f;
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(16, 163, 127, .22);
        }

        .finalCategoryTab.active strong {
          background: rgba(255,255,255,.2);
          color: #ffffff;
        }

        .finalToolbar {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 180px auto auto;
          gap: 10px;
          align-items: end;
          padding: 16px;
        }

        .finalSearch,
        .finalSelect {
          display: grid;
          gap: 6px;
        }

        .finalSearch span,
        .finalSelect span {
          color: #64748b;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .finalSearch input,
        .finalSelect select {
          width: 100%;
          height: 42px;
          padding: 0 13px;
          border: 1px solid #d6e5df;
          border-radius: 12px;
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
          outline: none;
        }

        .finalSearch input:focus,
        .finalSelect select:focus {
          border-color: #10a37f;
          box-shadow: 0 0 0 4px rgba(16, 163, 127, .10);
        }

        .finalFilterButton,
        .finalResetButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 15px;
          border-radius: 12px;
          border: 1px solid #d6e5df;
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .finalFilterButton {
          border-color: #10a37f;
          background: #10a37f;
          color: #ffffff;
        }

        .finalOrdersShell {
          border: 1px solid #dbe7e2;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(15, 23, 42, .045);
          overflow: hidden;
        }

        .finalOrdersHead {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 18px 14px;
          border-bottom: 1px solid #edf3f1;
        }

        .finalOrdersHead h2 {
          margin: 0;
          color: #061f1b;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 950;
          letter-spacing: -.6px;
        }

        .finalOrdersHead p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .finalOrdersRight {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          color: #64748b;
          font-weight: 850;
        }

        .finalOrdersRight strong {
          color: #061f1b;
          font-size: 24px;
          font-weight: 950;
        }

        .finalOrderList {
          display: grid;
          gap: 10px;
          padding: 14px;
        }

        .finalOrderCard {
          display: grid;
          grid-template-columns: 48px minmax(210px, 1.15fr) minmax(220px, 1fr) 135px 125px 150px;
          gap: 14px;
          align-items: center;
          padding: 16px;
          border: 1px solid #e2ebe7;
          border-radius: 16px;
          background: #ffffff;
        }

        .finalOrderCard.selected {
          border-color: rgba(16, 163, 127, .55);
          background: linear-gradient(90deg, rgba(16, 163, 127, .06), #ffffff 42%);
          box-shadow: inset 4px 0 0 #10a37f;
        }

        .finalOrderIcon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid #cde9de;
          background: #f0fdf9;
          color: #0f9f7a;
          display: grid;
          place-items: center;
          font-weight: 950;
        }

        .finalOrderNumber {
          color: #64748b;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .finalOrderCustomer h3 {
          margin: 4px 0 3px;
          color: #061f1b;
          font-size: 18px;
          line-height: 1.1;
          font-weight: 950;
        }

        .finalOrderCustomer p {
          margin: 0;
          color: #64748b;
          font-size: 12.5px;
          font-weight: 700;
        }

        .finalSourceBadge {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          margin-top: 8px;
          padding: 0 9px;
          border-radius: 999px;
          background: #f1f5f4;
          color: #36534b;
          font-size: 11.5px;
          font-weight: 850;
        }

        .finalOrderItems {
          display: grid;
          gap: 5px;
          color: #0f172a;
          font-size: 13px;
          font-weight: 750;
        }

        .finalOrderItems div {
          display: flex;
          gap: 8px;
        }

        .finalOrderItems strong {
          min-width: 28px;
          color: #0f9f7a;
          font-weight: 950;
        }

        .finalOrderItems small {
          color: #64748b;
          font-weight: 850;
        }

        .finalOrderDate strong,
        .finalOrderTotal strong {
          display: block;
          color: #061f1b;
          font-size: 15px;
          font-weight: 950;
          white-space: nowrap;
        }

        .finalOrderDate span,
        .finalOrderTotal span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .finalOrderTotal strong {
          font-size: 21px;
        }

        .finalOrderTotal span {
          display: inline-flex;
          min-height: 23px;
          padding: 0 8px;
          align-items: center;
          border-radius: 7px;
          background: #fff7ed;
          color: #ea580c;
          font-weight: 950;
          text-transform: uppercase;
        }

        .finalOrderActions {
          display: grid;
          gap: 8px;
        }

        .finalOrderActions a,
        .finalOrderActions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 38px;
          border-radius: 11px;
          border: 1px solid #b7e4d6;
          background: #ffffff;
          color: #08765d;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
        }

        .finalOrderActions button {
          color: #dc2626;
          border-color: #fecaca;
          background: #fffafa;
        }

        .finalEmpty {
          margin: 14px;
          padding: 16px;
          border: 1px dashed #c9ded7;
          border-radius: 14px;
          background: #fbfdfc;
          color: #64748b;
          font-weight: 850;
        }

        .finalLoadMore,
        .finalHint {
          padding: 12px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
          font-weight: 850;
        }

        .finalHint a {
          color: #0f766e;
          font-weight: 950;
        }

        @media (max-width: 1180px) {
          .finalCategoryTabs {
            overflow-x: auto;
            display: flex;
          }

          .finalToolbar {
            grid-template-columns: 1fr 180px;
          }

          .finalOrderCard {
            grid-template-columns: 42px minmax(0, 1fr);
          }

          .finalOrderItems,
          .finalOrderDate,
          .finalOrderTotal,
          .finalOrderActions {
            grid-column: 2;
          }
        }

        @media (max-width: 720px) {
          .inboxFinalPage {
            padding: 0 14px 36px;
          }

          .finalHeader {
            display: grid;
          }

          .finalToolbar {
            grid-template-columns: 1fr;
          }

          .finalMiniSummary {
            flex-wrap: wrap;
            border-radius: 14px;
          }
        }
      
        /* gastario-selected-detail-panel-20260709 */

        .finalOrdersSplitShell {
          overflow: visible;
        }

        .finalOrdersGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) 420px;
          gap: 14px;
          padding: 14px;
          align-items: start;
        }

        .finalOrderRows {
          display: grid;
          gap: 10px;
        }

        .finalOrderRow {
          display: grid;
          grid-template-columns: 42px minmax(180px, .95fr) minmax(190px, 1fr) 118px 120px;
          gap: 13px;
          align-items: center;
          padding: 15px;
          border: 1px solid #e2ebe7;
          border-radius: 16px;
          background: #ffffff;
        }

        .finalOrderRow.selected {
          border-color: rgba(16, 163, 127, .55);
          background: linear-gradient(90deg, rgba(16, 163, 127, .07), #ffffff 48%);
          box-shadow: inset 4px 0 0 #10a37f, 0 10px 26px rgba(15, 23, 42, .045);
        }

        .finalSelectedPanel {
          position: sticky;
          top: 18px;
          padding: 18px;
          border: 1px solid #dbe7e2;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, .06);
        }

        .finalSelectedTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          padding-bottom: 14px;
          border-bottom: 1px solid #edf3f1;
        }

        .finalSelectedKicker {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          margin-bottom: 8px;
          border-radius: 999px;
          background: #eaf8f3;
          color: #0f766e;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .finalSelectedTop h3 {
          margin: 5px 0 0;
          color: #061f1b;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 950;
          letter-spacing: -.6px;
        }

        .finalSourceBadge.big {
          min-height: 32px;
          padding: 0 12px;
          background: #eaf8f3;
          color: #0f766e;
          border: 1px solid #cde9de;
        }

        .finalSelectedFacts {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          padding: 14px 0;
          border-bottom: 1px solid #edf3f1;
        }

        .finalSelectedFacts div {
          padding: 12px;
          border: 1px solid #edf3f1;
          border-radius: 14px;
          background: #fbfdfc;
        }

        .finalSelectedFacts span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .06em;
          text-transform: uppercase;
        }

        .finalSelectedFacts strong {
          display: block;
          margin-top: 5px;
          color: #061f1b;
          font-size: 15px;
          font-weight: 950;
        }

        .finalSelectedFacts small {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          font-weight: 750;
        }

        .finalSelectedItems {
          padding: 14px 0;
        }

        .finalSelectedItems h4 {
          margin: 0 0 10px;
          color: #061f1b;
          font-size: 15px;
          font-weight: 950;
        }

        .finalSelectedItem {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #f1f5f4;
          color: #0f172a;
          font-size: 13px;
          font-weight: 750;
        }

        .finalSelectedItem span {
          display: flex;
          gap: 8px;
          min-width: 0;
        }

        .finalSelectedItem span strong {
          min-width: 28px;
          color: #0f9f7a;
          font-weight: 950;
        }

        .finalSelectedItem b {
          white-space: nowrap;
          color: #061f1b;
          font-size: 13px;
          font-weight: 950;
        }

        .finalSelectedMore {
          margin-top: 8px;
          color: #64748b;
          font-size: 13px;
          font-weight: 850;
        }

        .finalSelectedNotice {
          margin-bottom: 14px;
          padding: 11px 12px;
          border-radius: 12px;
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .finalSelectedActions {
          display: grid;
          grid-template-columns: 1fr 120px;
          gap: 10px;
        }

        .finalSelectedActions a,
        .finalSelectedActions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 42px;
          border-radius: 12px;
          border: 1px solid #10a37f;
          background: #10a37f;
          color: #ffffff;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
        }

        .finalSelectedActions button {
          border-color: #fecaca;
          background: #fffafa;
          color: #dc2626;
        }

        @media (max-width: 1250px) {
          .finalOrdersGrid {
            grid-template-columns: 1fr;
          }

          .finalSelectedPanel {
            position: static;
          }
        }

        @media (max-width: 900px) {
          .finalOrderRow {
            grid-template-columns: 42px minmax(0, 1fr);
          }

          .finalOrderItems,
          .finalOrderDate,
          .finalOrderTotal {
            grid-column: 2;
          }
        }

        /* gastario-selected-panel-polish-20260709 */

        .inboxFinalPage {
          max-width: 1320px !important;
        }

        .finalOrdersGrid {
          grid-template-columns: minmax(0, 1fr) 390px !important;
          gap: 16px !important;
          padding: 14px !important;
        }

        .finalOrderRows {
          min-width: 0 !important;
        }

        .finalOrderRow {
          grid-template-columns: 44px minmax(180px, .9fr) minmax(220px, 1fr) 110px 118px !important;
          gap: 12px !important;
          min-height: 112px !important;
          padding: 14px 15px !important;
          border-radius: 16px !important;
        }

        .finalOrderCustomer h3 {
          font-size: 17px !important;
        }

        .finalOrderItems {
          font-size: 13px !important;
        }

        .finalOrderItems div {
          line-height: 1.25 !important;
        }

        .finalOrderDate strong {
          font-size: 15px !important;
        }

        .finalOrderTotal strong {
          font-size: 20px !important;
        }

        .finalSelectedPanel {
          top: 16px !important;
          padding: 16px !important;
          border-radius: 18px !important;
          box-shadow: 0 12px 30px rgba(15, 23, 42, .055) !important;
        }

        .finalSelectedTop {
          padding-bottom: 12px !important;
        }

        .finalSelectedTop h3 {
          font-size: 21px !important;
        }

        .finalSelectedFacts {
          gap: 8px !important;
          padding: 12px 0 !important;
        }

        .finalSelectedFacts div {
          padding: 10px 11px !important;
          border-radius: 13px !important;
        }

        .finalSelectedItems {
          padding: 12px 0 !important;
        }

        .finalSelectedItem {
          padding: 7px 0 !important;
          font-size: 12.5px !important;
        }

        .finalSelectedActions {
          grid-template-columns: 1fr 105px !important;
          gap: 8px !important;
        }

        .finalSelectedActions a,
        .finalSelectedActions button {
          min-height: 40px !important;
          border-radius: 11px !important;
          font-size: 13px !important;
        }

        .finalLoadMore {
          padding: 10px !important;
          border-radius: 14px !important;
          background: transparent !important;
        }

        @media (max-width: 1320px) {
          .finalOrdersGrid {
            grid-template-columns: minmax(0, 1fr) 360px !important;
          }

          .finalOrderRow {
            grid-template-columns: 40px minmax(160px, .9fr) minmax(190px, 1fr) 100px 110px !important;
          }
        }

        @media (max-width: 1180px) {
          .finalOrdersGrid {
            grid-template-columns: 1fr !important;
          }

          .finalSelectedPanel {
            position: static !important;
          }
        }

        /* gastario-click-selected-slide-20260709 */

        .finalOrderRow {
          cursor: pointer !important;
          transition:
            transform .16s ease,
            border-color .16s ease,
            box-shadow .16s ease,
            background .16s ease !important;
        }

        .finalOrderRow:hover {
          transform: translateX(3px) !important;
          border-color: rgba(16, 163, 127, .35) !important;
          box-shadow: 0 10px 24px rgba(15, 23, 42, .045) !important;
        }

        .finalOrderRow.selected {
          transform: translateX(0) !important;
          position: relative !important;
          z-index: 2 !important;
        }

        .finalSelectedPanel {
          animation: gastarioSelectedSlideIn .22s ease both !important;
          transform-origin: right center !important;
        }

        @keyframes gastarioSelectedSlideIn {
          from {
            opacity: 0;
            transform: translateX(22px) scale(.985);
          }

          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        /* gastario-fix-selected-overlap-20260709 */

        .finalOrdersGrid {
          grid-template-columns: minmax(0, 1fr) 390px !important;
          overflow: hidden !important;
        }

        .finalOrderRows {
          min-width: 0 !important;
          overflow: hidden !important;
        }

        .finalOrderRow {
          position: relative !important;
          z-index: 0 !important;
          transform: none !important;
          grid-template-columns: 40px minmax(145px, .85fr) minmax(170px, 1fr) 92px 128px !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }

        .finalOrderRow:hover {
          transform: none !important;
          z-index: 0 !important;
        }

        .finalOrderRow.selected {
          z-index: 0 !important;
          transform: none !important;
          box-shadow: inset 4px 0 0 #10a37f !important;
        }

        .finalOrderCustomer,
        .finalOrderItems,
        .finalOrderDate,
        .finalOrderTotal {
          min-width: 0 !important;
        }

        .finalOrderCustomer h3,
        .finalOrderCustomer p,
        .finalOrderItems span {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .finalOrderItems div {
          min-width: 0 !important;
        }

        .finalOrderTotal {
          justify-self: end !important;
          text-align: right !important;
        }

        .finalOrderTotal strong {
          font-size: 19px !important;
          white-space: nowrap !important;
        }

        .finalSelectedPanel {
          position: sticky !important;
          z-index: 3 !important;
          background: #ffffff !important;
        }

        @media (max-width: 1320px) {
          .finalOrdersGrid {
            grid-template-columns: minmax(0, 1fr) 360px !important;
          }

          .finalOrderRow {
            grid-template-columns: 38px minmax(135px, .8fr) minmax(150px, 1fr) 84px 116px !important;
          }

          .finalOrderTotal strong {
            font-size: 18px !important;
          }
        }

        @media (max-width: 1180px) {
          .finalOrdersGrid {
            grid-template-columns: 1fr !important;
            overflow: visible !important;
          }

          .finalSelectedPanel {
            position: static !important;
          }
        }

        /* gastario-selected-orange-clean-20260709 */

        .finalMiniSummary {
          display: none !important;
        }

        .finalHeader {
          margin-bottom: 20px !important;
        }

        .finalOrderRow.selected {
          border-color: #f59e0b !important;
          background:
            linear-gradient(90deg, rgba(245, 158, 11, .10), #ffffff 46%) !important;
          box-shadow: inset 4px 0 0 #f59e0b, 0 10px 26px rgba(15, 23, 42, .045) !important;
        }

        .finalOrderRow.selected .finalOrderIcon {
          border-color: #facc15 !important;
          background: #fffbeb !important;
          color: #b45309 !important;
        }

        .finalOrderRow.selected .finalSourceBadge {
          background: #fff7ed !important;
          color: #b45309 !important;
          border: 1px solid #fed7aa !important;
        }

        .finalOrderRow.selected .finalOrderItems {
          opacity: .35 !important;
        }

        .finalOrderRow.selected .finalOrderItems::before {
          content: "Details rechts geöffnet";
          display: inline-flex;
          align-items: center;
          width: max-content;
          min-height: 26px;
          padding: 0 9px;
          border-radius: 999px;
          background: #fff7ed;
          color: #b45309;
          font-size: 12px;
          font-weight: 900;
        }

        .finalOrderRow.selected .finalOrderItems div,
        .finalOrderRow.selected .finalOrderItems small {
          display: none !important;
        }

        .finalSelectedPanel {
          border-color: #f5c16c !important;
          box-shadow: 0 14px 34px rgba(146, 64, 14, .08) !important;
        }

        .finalSelectedKicker {
          background: #fff7ed !important;
          color: #b45309 !important;
        }

        /* gastario-selected-row-compact-20260709 */

        .finalOrderRow.selected {
          grid-template-columns: 44px minmax(0, 1fr) !important;
          min-height: 92px !important;
          align-items: center !important;
          border-color: #f59e0b !important;
          background:
            linear-gradient(90deg, rgba(245, 158, 11, .12), #ffffff 54%) !important;
          box-shadow: inset 4px 0 0 #f59e0b, 0 10px 26px rgba(146, 64, 14, .06) !important;
        }

        .finalOrderRow.selected .finalOrderItems,
        .finalOrderRow.selected .finalOrderDate,
        .finalOrderRow.selected .finalOrderTotal {
          display: none !important;
        }

        .finalOrderRow.selected .finalOrderCustomer {
          display: grid !important;
          gap: 3px !important;
        }

        .finalOrderRow.selected .finalOrderCustomer h3 {
          font-size: 19px !important;
          margin: 2px 0 0 !important;
        }

        .finalOrderRow.selected .finalOrderCustomer p {
          color: #64748b !important;
          font-size: 13px !important;
        }

        .finalOrderRow.selected .finalSourceBadge {
          width: max-content !important;
          margin-top: 7px !important;
          background: #fff7ed !important;
          color: #b45309 !important;
          border: 1px solid #fed7aa !important;
        }

        .finalOrderRow.selected .finalSourceBadge::after {
          content: " · Details rechts geöffnet";
          color: #b45309;
          font-weight: 900;
        }

        .finalSelectedPanel {
          border-color: #f5c16c !important;
          box-shadow: 0 16px 38px rgba(146, 64, 14, .09) !important;
        }

        .finalSelectedKicker {
          background: #fff7ed !important;
          color: #b45309 !important;
        }

        .finalSelectedPanel::before {
          content: "";
          display: block;
          height: 4px;
          margin: -18px -18px 14px;
          border-radius: 18px 18px 0 0;
          background: linear-gradient(90deg, #f59e0b, #10a37f);
        }

        /* gastario-selected-row-mini-animated-20260709 */

        .finalOrderRow {
          transition:
            min-height .22s ease,
            padding .22s ease,
            transform .18s ease,
            border-color .18s ease,
            background .18s ease,
            box-shadow .18s ease !important;
        }

        .finalOrderRow.selected {
          grid-template-columns: 40px minmax(0, 1fr) !important;
          min-height: 72px !important;
          padding: 11px 13px !important;
          align-items: center !important;
          border-color: #f59e0b !important;
          background: linear-gradient(90deg, rgba(245, 158, 11, .13), #ffffff 58%) !important;
          box-shadow: inset 4px 0 0 #f59e0b, 0 8px 20px rgba(146, 64, 14, .055) !important;
          animation: gastarioSelectedRowMini .22s ease both !important;
        }

        @keyframes gastarioSelectedRowMini {
          from {
            opacity: .88;
            transform: translateX(8px) scale(.985);
          }

          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .finalOrderRow.selected .finalOrderIcon {
          width: 34px !important;
          height: 34px !important;
          border-radius: 11px !important;
          border-color: #facc15 !important;
          background: #fffbeb !important;
          color: #b45309 !important;
        }

        .finalOrderRow.selected .finalOrderCustomer {
          min-width: 0 !important;
          display: grid !important;
          gap: 1px !important;
        }

        .finalOrderRow.selected .finalOrderNumber {
          font-size: 11px !important;
          line-height: 1.1 !important;
        }

        .finalOrderRow.selected .finalOrderCustomer h3 {
          margin: 1px 0 0 !important;
          font-size: 16px !important;
          line-height: 1.05 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .finalOrderRow.selected .finalOrderCustomer p {
          font-size: 12px !important;
          line-height: 1.15 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .finalOrderRow.selected .finalSourceBadge {
          min-height: 22px !important;
          width: max-content !important;
          max-width: 100% !important;
          margin-top: 5px !important;
          padding: 0 8px !important;
          border-radius: 999px !important;
          background: #fff7ed !important;
          color: #b45309 !important;
          border: 1px solid #fed7aa !important;
          font-size: 11px !important;
        }

        .finalOrderRow.selected .finalSourceBadge::after {
          content: " · geöffnet";
          color: #b45309;
          font-weight: 900;
        }

        .finalOrderRow.selected .finalOrderItems,
        .finalOrderRow.selected .finalOrderDate,
        .finalOrderRow.selected .finalOrderTotal {
          display: none !important;
        }

        .finalSelectedPanel {
          animation: gastarioSelectedPanelFocus .24s ease both !important;
        }

        @keyframes gastarioSelectedPanelFocus {
          from {
            opacity: .82;
            transform: translateX(14px) scale(.99);
          }

          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .finalOrderRow:not(.selected):hover {
          transform: translateX(3px) !important;
        }

        @media (max-width: 1180px) {
          .finalOrderRow.selected {
            min-height: 78px !important;
          }
        }

        /* gastario-selected-focus-mode-20260709 */

        .finalOrdersGrid.selectedFocusMode {
          display: grid !important;
          grid-template-columns: 1fr !important;
          place-items: center !important;
          min-height: 560px !important;
          padding: 26px !important;
          background:
            radial-gradient(circle at center, rgba(245, 158, 11, .08), transparent 42%),
            #ffffff !important;
          overflow: hidden !important;
          animation: gastarioFocusBackground .22s ease both !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalOrderRows {
          display: none !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          position: relative !important;
          top: auto !important;
          width: min(680px, 100%) !important;
          max-width: 680px !important;
          z-index: 10 !important;
          border-color: #f59e0b !important;
          box-shadow:
            0 28px 70px rgba(15, 23, 42, .14),
            0 0 0 8px rgba(245, 158, 11, .08) !important;
          animation: gastarioSelectedCenterIn .28s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::before {
          background: linear-gradient(90deg, #f59e0b, #10a37f) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedTop h3 {
          font-size: 28px !important;
          letter-spacing: -1px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
          grid-template-columns: 150px 1fr 120px !important;
        }

        .finalBackButton {
          border-color: #d6e5df !important;
          background: #ffffff !important;
          color: #0f172a !important;
        }

        @keyframes gastarioSelectedCenterIn {
          from {
            opacity: 0;
            transform: translateY(24px) scale(.96);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes gastarioFocusBackground {
          from {
            background-color: #ffffff;
          }

          to {
            background-color: #ffffff;
          }
        }

        @media (max-width: 900px) {
          .finalOrdersGrid.selectedFocusMode {
            padding: 14px !important;
            min-height: auto !important;
          }

          .finalOrdersGrid.selectedFocusMode .finalSelectedFacts,
          .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
            grid-template-columns: 1fr !important;
          }
        }

        /* gastario-soft-focus-transition-20260709 */

        .finalOrdersGrid {
          position: relative !important;
        }

        .finalOrderRows {
          transition:
            opacity .28s ease,
            transform .28s ease,
            max-height .32s ease,
            margin .28s ease !important;
          max-height: 900px !important;
          opacity: 1 !important;
          transform: translateX(0) scale(1) !important;
        }

        .finalOrdersGrid.selectedFocusMode {
          grid-template-columns: 1fr !important;
          place-items: center !important;
          min-height: 520px !important;
          padding: 26px !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalOrderRows {
          display: grid !important;
          pointer-events: none !important;
          max-height: 0 !important;
          margin: 0 !important;
          opacity: 0 !important;
          transform: translateX(-36px) scale(.985) !important;
          overflow: hidden !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          position: relative !important;
          top: auto !important;
          width: min(660px, 100%) !important;
          max-width: 660px !important;
          border: 1.5px solid #f59e0b !important;
          box-shadow: 0 22px 54px rgba(15, 23, 42, .11) !important;
          animation: gastarioSoftPanelIn .32s cubic-bezier(.2,.8,.2,1) both !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::before {
          height: 3px !important;
          margin: -16px -16px 14px !important;
          background: #f59e0b !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedKicker {
          background: #fff7ed !important;
          color: #b45309 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedTop h3 {
          font-size: 26px !important;
          letter-spacing: -.8px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
          grid-template-columns: 150px 1fr 115px !important;
        }

        @keyframes gastarioSoftPanelIn {
          0% {
            opacity: 0;
            transform: translateX(34px) scale(.965);
          }

          70% {
            opacity: 1;
            transform: translateX(-3px) scale(1.005);
          }

          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @media (max-width: 900px) {
          .finalOrdersGrid.selectedFocusMode {
            padding: 14px !important;
            min-height: auto !important;
          }

          .finalOrdersGrid.selectedFocusMode .finalSelectedFacts,
          .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
            grid-template-columns: 1fr !important;
          }
        }

        /* gastario-soft-focus-polish-no-topline-20260709 */

        .finalOrdersGrid.selectedFocusMode {
          min-height: 560px !important;
          background:
            radial-gradient(circle at center, rgba(245, 158, 11, .055), transparent 45%),
            #ffffff !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          border: 1px solid #f6c66f !important;
          border-radius: 20px !important;
          box-shadow:
            0 30px 80px rgba(15, 23, 42, .11),
            0 0 0 1px rgba(245, 158, 11, .08) !important;
          animation: gastarioSofterPanelIn .44s cubic-bezier(.16,1,.3,1) both !important;
        }

        .finalSelectedPanel::before,
        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::before {
          display: none !important;
          content: none !important;
        }

        .finalSelectedKicker {
          border: 1px solid #fed7aa !important;
          background: #fff7ed !important;
          color: #b45309 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalOrderRows {
          transition:
            opacity .42s ease,
            transform .42s cubic-bezier(.16,1,.3,1),
            max-height .46s ease !important;
          opacity: 0 !important;
          transform: translateX(-44px) scale(.975) !important;
        }

        @keyframes gastarioSofterPanelIn {
          0% {
            opacity: 0;
            transform: translateY(18px) translateX(28px) scale(.965);
          }

          55% {
            opacity: 1;
            transform: translateY(0) translateX(-4px) scale(1.006);
          }

          100% {
            opacity: 1;
            transform: translateY(0) translateX(0) scale(1);
          }
        }

        /* gastario-focus-panel-scroll-polish-20260709 */

        .finalOrdersShell {
          min-height: auto !important;
        }

        .finalOrdersGrid.selectedFocusMode {
          min-height: 500px !important;
          padding: 22px !important;
          align-items: start !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          width: min(690px, 100%) !important;
          max-height: calc(100vh - 220px) !important;
          overflow-y: auto !important;
          scrollbar-width: thin !important;
          border: 1px solid #f6c66f !important;
          border-radius: 18px !important;
          box-shadow: 0 24px 60px rgba(15, 23, 42, .10) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::-webkit-scrollbar {
          width: 8px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::-webkit-scrollbar-thumb {
          background: #d9e4df !important;
          border-radius: 999px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::before {
          display: none !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedTop {
          position: sticky !important;
          top: 0 !important;
          z-index: 2 !important;
          background: #ffffff !important;
          margin: -16px -16px 12px !important;
          padding: 16px !important;
          border-bottom: 1px solid #eef3f1 !important;
          border-radius: 18px 18px 0 0 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
          position: sticky !important;
          bottom: 0 !important;
          z-index: 2 !important;
          background: linear-gradient(180deg, rgba(255,255,255,.86), #ffffff 40%) !important;
          margin: 12px -16px -16px !important;
          padding: 12px 16px 16px !important;
          border-top: 1px solid #eef3f1 !important;
        }

        /* gastario-review-box-clean-empty-20260709 */

        .finalOrdersShell {
          background: #ffffff !important;
          border: 1px solid #dbe7e2 !important;
          border-radius: 22px !important;
          overflow: hidden !important;
          box-shadow: 0 18px 44px rgba(15, 23, 42, .055) !important;
        }

        .finalOrdersHeader {
          padding: 22px 22px 16px !important;
          border-bottom: 1px solid #eef3f1 !important;
          background: linear-gradient(180deg, #ffffff, #fbfdfc) !important;
        }

        .finalOrdersGrid {
          min-height: 340px !important;
          background:
            linear-gradient(180deg, #ffffff 0%, #ffffff 70%, #fbfdfc 100%) !important;
        }

        .finalOrderRows {
          padding-bottom: 6px !important;
        }

        .finalOrderRow {
          background: #ffffff !important;
        }

        .finalLoadMore {
          margin-top: 8px !important;
          color: #64748b !important;
          font-weight: 850 !important;
        }

        .finalHint {
          margin: 0 !important;
          padding: 14px 18px !important;
          border-top: 1px solid #eef3f1 !important;
          background: #fbfdfc !important;
          text-align: center !important;
          border-radius: 0 !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode)::after {
          content: "";
          display: block;
          min-height: 22px;
        }

        /* gastario-hide-email-tabs-from-order-workflow-20260709 */

        .finalEmailTabs,
        .mailTabs,
        .emailTabs {
          display: none !important;
        }

        .finalEmailPanel {
          padding: 18px !important;
        }

        .finalEmailPanelHeader {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(420px, 620px) !important;
          gap: 18px !important;
          align-items: end !important;
        }

        .finalEmailPanel h2 {
          margin-bottom: 4px !important;
        }

        .finalEmailPanel p {
          margin-bottom: 0 !important;
        }

        .finalOrdersShell {
          margin-top: 22px !important;
        }

        .finalOrdersHeader {
          display: flex !important;
          justify-content: space-between !important;
          align-items: end !important;
          gap: 18px !important;
        }

        .finalOrdersHeader h2 {
          font-size: 30px !important;
          letter-spacing: -1px !important;
        }

        .finalOrdersHeader strong,
        .finalOrdersHeader .finalOpenCount {
          font-size: 30px !important;
        }

        .finalOrdersGrid {
          padding: 18px !important;
        }

        .finalOrderRows {
          display: grid !important;
          gap: 12px !important;
        }

        .finalOrderRow {
          width: min(760px, 100%) !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode) {
          display: grid !important;
          grid-template-columns: minmax(0, 760px) !important;
          justify-content: start !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode)::after {
          content: "Auftrag anklicken, um die Prüfung zu öffnen.";
          position: absolute;
          right: 34px;
          top: 34px;
          width: 300px;
          padding: 18px;
          border: 1px dashed #cfe1dc;
          border-radius: 18px;
          background: #fbfdfc;
          color: #64748b;
          font-weight: 800;
          line-height: 1.35;
        }

        @media (max-width: 1250px) {
          .finalOrdersGrid:not(.selectedFocusMode)::after {
            display: none !important;
          }

          .finalOrdersGrid:not(.selectedFocusMode) {
            grid-template-columns: 1fr !important;
          }

          .finalOrderRow {
            width: 100% !important;
          }
        }

        /* gastario-remove-confusing-email-tabs-20260709 */

        .finalEmailTabs,
        .mailTabs,
        .emailTabs,
        .finalInboxTabs {
          display: none !important;
        }

        .finalEmailPanel {
          display: none !important;
        }

        .finalOrdersShell {
          margin-top: 18px !important;
        }

        /* gastario-real-order-tabs-20260709 */

        .realOrderTabs {
          display: flex !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
          margin: 18px 0 14px !important;
          padding: 8px !important;
          width: max-content !important;
          max-width: 100% !important;
          background: #ffffff !important;
          border: 1px solid #dbe7e2 !important;
          border-radius: 18px !important;
          box-shadow: 0 12px 30px rgba(15, 23, 42, .045) !important;
        }

        .realOrderTab {
          min-height: 42px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 10px !important;
          padding: 0 15px !important;
          border-radius: 13px !important;
          color: #0f172a !important;
          text-decoration: none !important;
          font-weight: 900 !important;
          border: 1px solid transparent !important;
          background: transparent !important;
        }

        .realOrderTab strong {
          min-width: 24px !important;
          height: 24px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 999px !important;
          background: #edf6f4 !important;
          color: #057a67 !important;
          font-size: 12px !important;
        }

        .realOrderTab.active {
          background: #10a37f !important;
          color: #ffffff !important;
          box-shadow: 0 12px 26px rgba(16, 163, 127, .22) !important;
        }

        .realOrderTab.active strong {
          background: rgba(255,255,255,.22) !important;
          color: #ffffff !important;
        }

        /* gastario-force-hide-email-workflow-card-20260709 */

        .finalEmailCard,
        .finalEmailPanel,
        .emailInboxPanel,
        .inboxPanel,
        .mailWorkbench,
        .finalCategoryTabs,
        .finalEmailTabs,
        .mailTabs,
        .emailTabs,
        .finalInboxTabs {
          display: none !important;
        }

        .realOrderTabs {
          margin-top: 20px !important;
          margin-bottom: 16px !important;
        }

        .finalOrdersShell {
          margin-top: 0 !important;
        }

        /* gastario-remove-click-hint-final-20260710 */

        .finalOrdersGrid:not(.selectedFocusMode)::after {
          display: none !important;
          content: none !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode) {
          display: block !important;
          padding: 18px !important;
          overflow: hidden !important;
        }

        .finalOrderRows,
        .finalOrderRow {
          width: 100% !important;
          max-width: 100% !important;
        }

        /* gastario-selected-card-larger-20260710 */

        .finalOrdersGrid.selectedFocusMode {
          padding: 42px 24px 34px !important;
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          width: min(820px, 100%) !important;
          max-width: 820px !important;
          padding: 28px !important;
          border-radius: 24px !important;
          border: 1.5px solid #f59e0b !important;
          box-shadow: 0 28px 70px rgba(15, 23, 42, .13) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedTop {
          margin: -28px -28px 22px !important;
          padding: 24px 28px 20px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedTop h3 {
          font-size: 32px !important;
          line-height: 1.05 !important;
          letter-spacing: -1px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalOrderNumber {
          font-size: 14px !important;
          margin-top: 8px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedKicker {
          font-size: 12px !important;
          padding: 6px 12px !important;
          border-radius: 999px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 12px !important;
          padding: 0 0 18px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts div {
          min-height: 88px !important;
          padding: 16px !important;
          border-radius: 18px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts span {
          font-size: 12px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts strong {
          font-size: 19px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems h4 {
          font-size: 20px !important;
          margin-bottom: 12px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItem {
          padding: 12px 0 !important;
          font-size: 15px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItem span {
          gap: 12px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItem span strong {
          font-size: 16px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItem > strong {
          font-size: 15px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedNotice {
          padding: 15px 16px !important;
          border-radius: 16px !important;
          font-size: 14px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
          grid-template-columns: 160px 1fr 140px !important;
          gap: 12px !important;
          margin-top: 18px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions a,
        .finalOrdersGrid.selectedFocusMode .finalSelectedActions button {
          min-height: 50px !important;
          border-radius: 14px !important;
          font-size: 15px !important;
          font-weight: 900 !important;
        }

        /* gastario-wider-order-inbox-20260710 */

        .inboxFinalPage {
          max-width: 1520px !important;
        }

        .workspace {
          padding-left: 42px !important;
          padding-right: 42px !important;
        }

        .finalOrdersShell {
          width: 100% !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode) {
          padding: 20px !important;
        }

        .finalOrderRow {
          grid-template-columns: 48px minmax(250px, .9fr) minmax(360px, 1.2fr) 140px 150px !important;
          gap: 18px !important;
          min-height: 112px !important;
          padding: 17px 18px !important;
        }

        .finalOrderCustomer h3 {
          font-size: 19px !important;
        }

        .finalOrderItems {
          font-size: 14px !important;
        }

        .finalOrderTotal strong {
          font-size: 24px !important;
        }

        @media (max-width: 1350px) {
          .finalOrderRow {
            grid-template-columns: 44px minmax(210px, .9fr) minmax(260px, 1fr) 120px 130px !important;
          }
        }

        /* gastario-force-wide-auftragseingang-20260710 */

        .workspace:has(.inboxFinalPage),
        .workspace:has(.inboxPage) {
          padding-left: 28px !important;
          padding-right: 28px !important;
        }

        .inboxPage,
        .inboxFinalPage {
          width: 100% !important;
          max-width: 1580px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .finalEmailPanel,
        .finalOrdersShell,
        .realOrderTabs {
          width: 100% !important;
          max-width: 100% !important;
        }

        .realOrderTabs {
          width: fit-content !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode) {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: 22px !important;
          overflow: hidden !important;
        }

        .finalOrderRows {
          width: 100% !important;
          max-width: 100% !important;
          display: grid !important;
          gap: 14px !important;
        }

        .finalOrderRow {
          width: 100% !important;
          max-width: 100% !important;
          grid-template-columns: 52px minmax(270px, .85fr) minmax(420px, 1.25fr) 150px 165px !important;
          gap: 22px !important;
          padding: 18px 22px !important;
          min-height: 112px !important;
        }

        .finalOrderCustomer h3 {
          font-size: 20px !important;
        }

        .finalOrderItems {
          font-size: 14.5px !important;
        }

        .finalOrderDate strong {
          font-size: 17px !important;
        }

        .finalOrderTotal strong {
          font-size: 25px !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode)::after {
          display: none !important;
          content: none !important;
        }

        @media (max-width: 1450px) {
          .finalOrderRow {
            grid-template-columns: 48px minmax(230px, .85fr) minmax(320px, 1.15fr) 130px 145px !important;
            gap: 16px !important;
          }
        }

        /* gastario-remove-load-more-polish-20260710 */

        .finalLoadMore,
        .loadMoreButton,
        .loadMore,
        button:has(+ .pastOrdersHint) {
          display: none !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode) {
          padding-bottom: 8px !important;
        }

        .pastOrdersHint {
          margin-top: 18px !important;
          padding: 14px 18px !important;
          border-top: 1px solid #e5eee9 !important;
          background: #fbfdfc !important;
          color: #64748b !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          text-align: center !important;
        }

        .pastOrdersHint a {
          color: #047857 !important;
          font-weight: 900 !important;
          text-decoration: none !important;
          border-bottom: 1px solid rgba(4, 120, 87, .35) !important;
        }

        .pastOrdersHint a:hover {
          border-bottom-color: #047857 !important;
        }

        .finalOrdersShell {
          overflow: hidden !important;
        }

        /* gastario-wide-clean-orders-20260710 */

        .workspace:has(.inboxFinalPage),
        .workspace:has(.inboxPage) {
          padding-left: 28px !important;
          padding-right: 28px !important;
        }

        .inboxPage,
        .inboxFinalPage {
          width: 100% !important;
          max-width: 1580px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .finalOrdersShell,
        .finalOrdersGrid,
        .finalOrderRows,
        .finalOrderRow {
          width: 100% !important;
          max-width: 100% !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode) {
          display: block !important;
          padding: 22px !important;
          overflow: hidden !important;
        }

        .finalOrdersGrid:not(.selectedFocusMode)::after {
          display: none !important;
          content: none !important;
        }

        .finalOrderRows {
          display: grid !important;
          gap: 14px !important;
        }

        .finalOrderRow {
          grid-template-columns: 52px minmax(280px, .85fr) minmax(420px, 1.25fr) 150px 165px !important;
          gap: 22px !important;
          padding: 18px 22px !important;
          min-height: 112px !important;
        }

        .finalOrderCustomer h3 {
          font-size: 20px !important;
        }

        .finalOrderItems {
          font-size: 14.5px !important;
        }

        .finalOrderDate strong {
          font-size: 17px !important;
        }

        .finalOrderTotal strong {
          font-size: 25px !important;
        }

        .finalLoadMore,
        .loadMoreButton,
        .loadMore {
          display: none !important;
        }

        .pastOrdersHint {
          margin-top: 18px !important;
          padding: 14px 18px !important;
          border-top: 1px solid #e5eee9 !important;
          background: #fbfdfc !important;
          color: #64748b !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          text-align: center !important;
        }

        .pastOrdersHint a {
          color: #047857 !important;
          font-weight: 900 !important;
          text-decoration: none !important;
          border-bottom: 1px solid rgba(4, 120, 87, .35) !important;
        }

        @media (max-width: 1450px) {
          .finalOrderRow {
            grid-template-columns: 48px minmax(230px, .85fr) minmax(320px, 1.15fr) 130px 145px !important;
            gap: 16px !important;
          }
        }

        /* gastario-selected-focus-center-fix-20260710 */

        .finalOrdersGrid.selectedFocusMode {
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          padding: 34px 24px 38px !important;
          min-height: 520px !important;
          width: 100% !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalOrderRows {
          display: none !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          position: relative !important;
          left: auto !important;
          right: auto !important;
          top: auto !important;
          width: min(760px, 100%) !important;
          max-width: 760px !important;
          margin: 0 auto !important;
          border: 1.5px solid #f59e0b !important;
          border-top: 1.5px solid #f59e0b !important;
          border-radius: 22px !important;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .12) !important;
          overflow: hidden !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedTop {
          margin: 0 !important;
          padding: 22px 24px 18px !important;
          border-bottom: 1px solid #edf2f0 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 12px !important;
          padding: 18px 24px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems {
          padding: 0 24px 18px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedNotice {
          margin: 0 24px 16px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
          grid-template-columns: 170px minmax(0, 1fr) 140px !important;
          gap: 12px !important;
          padding: 0 24px 24px !important;
          margin: 0 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions a,
        .finalOrdersGrid.selectedFocusMode .finalSelectedActions button {
          min-height: 48px !important;
          height: 48px !important;
          border-radius: 14px !important;
          font-size: 14px !important;
          line-height: 1.1 !important;
          white-space: normal !important;
          text-align: center !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions a:first-child {
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #d9e5e1 !important;
          box-shadow: none !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions a:not(:first-child) {
          background: #10a37f !important;
          color: #ffffff !important;
          border-color: #10a37f !important;
        }

        /* gastario-selected-panel-beautify-20260710 */

        .finalOrdersGrid.selectedFocusMode {
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          padding: 34px 28px 42px !important;
          min-height: 540px !important;
          width: 100% !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalOrderRows {
          display: none !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          width: min(920px, 100%) !important;
          max-width: 920px !important;
          margin: 0 auto !important;
          border: 1.5px solid #f3b24d !important;
          border-radius: 26px !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,251,250,1) 100%) !important;
          box-shadow:
            0 18px 40px rgba(15, 23, 42, 0.08),
            0 4px 10px rgba(15, 23, 42, 0.04) !important;
          overflow: hidden !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::before {
          content: "" !important;
          display: block !important;
          height: 6px !important;
          background: linear-gradient(90deg, #10a37f 0%, #36c29a 100%) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedTop {
          padding: 28px 30px 22px !important;
          margin: 0 !important;
          border-bottom: 1px solid #edf2f0 !important;
          background: linear-gradient(180deg, rgba(240,248,245,0.75) 0%, rgba(255,255,255,0) 100%) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedTop h2,
        .finalOrdersGrid.selectedFocusMode .finalSelectedTop h3 {
          margin: 8px 0 0 !important;
          font-size: 26px !important;
          line-height: 1.12 !important;
          font-weight: 800 !important;
          letter-spacing: -0.03em !important;
          color: #0f172a !important;
        }

        .finalSelectedKicker {
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 8px 14px !important;
          border: 1px solid #fed7aa !important;
          border-radius: 999px !important;
          background: #fff7ed !important;
          color: #b45309 !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          letter-spacing: 0.06em !important;
          text-transform: uppercase !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 14px !important;
          padding: 22px 30px 20px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts > div,
        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts > article {
          min-height: 108px !important;
          padding: 16px 16px 14px !important;
          border: 1px solid #e4ece8 !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.03) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts strong,
        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts b {
          display: block !important;
          margin: 0 0 8px !important;
          font-size: 13px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          letter-spacing: 0.04em !important;
          text-transform: uppercase !important;
          color: #64748b !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts span,
        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts p,
        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts div {
          color: #0f172a !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts > div > :last-child,
        .finalOrdersGrid.selectedFocusMode .finalSelectedFacts > article > :last-child {
          font-size: 15px !important;
          line-height: 1.4 !important;
          font-weight: 700 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems {
          padding: 0 30px 22px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems h4,
        .finalOrdersGrid.selectedFocusMode .finalSelectedItems h3 {
          margin: 4px 0 14px !important;
          font-size: 16px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems > div,
        .finalOrdersGrid.selectedFocusMode .finalSelectedItems > li,
        .finalOrdersGrid.selectedFocusMode .finalSelectedItems table {
          width: 100% !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems tr td,
        .finalOrdersGrid.selectedFocusMode .finalSelectedItems > div > div,
        .finalOrdersGrid.selectedFocusMode .finalSelectedItems > div > article {
          padding-top: 14px !important;
          padding-bottom: 14px !important;
          border-top: 1px solid #edf2f0 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems tr:first-child td {
          border-top: 1px solid #edf2f0 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems td:first-child,
        .finalOrdersGrid.selectedFocusMode .finalSelectedItems strong:first-child {
          color: #10a37f !important;
          font-weight: 800 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedItems td:last-child,
        .finalOrdersGrid.selectedFocusMode .finalSelectedItems strong:last-child {
          text-align: right !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }

        .finalSelectedNotice {
          margin: 0 30px 18px !important;
          padding: 14px 16px !important;
          border: 1px solid #dceee7 !important;
          border-radius: 16px !important;
          background: #f5fbf8 !important;
          color: #36534b !important;
          font-size: 14px !important;
          line-height: 1.45 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
          display: grid !important;
          grid-template-columns: 180px minmax(0, 1fr) 150px !important;
          gap: 12px !important;
          padding: 0 30px 30px !important;
          margin: 0 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions a,
        .finalOrdersGrid.selectedFocusMode .finalSelectedActions button {
          min-height: 50px !important;
          height: 50px !important;
          border-radius: 15px !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          line-height: 1.1 !important;
          box-shadow: 0 10px 22px rgba(16, 163, 127, 0.12) !important;
          transition: transform .15s ease, box-shadow .15s ease !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions a:hover,
        .finalOrdersGrid.selectedFocusMode .finalSelectedActions button:hover {
          transform: translateY(-1px) !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions a:first-child {
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #d8e6df !important;
          box-shadow: none !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions a:not(:first-child),
        .finalOrdersGrid.selectedFocusMode .finalSelectedActions button {
          background: linear-gradient(180deg, #15ad87 0%, #0f9c79 100%) !important;
          color: #ffffff !important;
          border: none !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedActions > *:last-child {
          background: linear-gradient(180deg, #18a97f 0%, #11946f 100%) !important;
        }

        @media (max-width: 980px) {
          .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
            width: 100% !important;
            max-width: 100% !important;
          }

          .finalOrdersGrid.selectedFocusMode .finalSelectedFacts {
            grid-template-columns: 1fr !important;
          }

          .finalOrdersGrid.selectedFocusMode .finalSelectedActions {
            grid-template-columns: 1fr !important;
          }
        }
`}
        {`
        /* gastario-softer-order-design-20260713 */

        .finalOrdersHeader h2,
        .finalSelectedTop h2,
        .finalSelectedTop h3,
        .finalSelectedPanel h2,
        .finalSelectedPanel h3 {
          font-weight: 720 !important;
          letter-spacing: -0.025em !important;
        }

        .finalOrdersHeader h2 {
          font-size: 25px !important;
        }

        .finalOrdersHeader p,
        .finalSelectedPanel p,
        .finalSelectedPanel span,
        .finalOrderRow span,
        .finalOrderRow p {
          font-weight: 500 !important;
        }

        .finalOrderRow {
          min-height: 112px !important;
          padding: 18px 20px !important;
          border: 1px solid #dce6eb !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 5px 18px rgba(15, 23, 42, 0.035) !important;
          transition:
            border-color 0.16s ease,
            box-shadow 0.16s ease,
            transform 0.16s ease !important;
        }

        .finalOrderRow:hover {
          border-color: #b9d7cf !important;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.065) !important;
          transform: translateY(-1px);
        }

        .finalOrderRow strong {
          font-weight: 650 !important;
        }

        .finalOrderRow h3,
        .finalOrderRow h4 {
          font-weight: 720 !important;
          letter-spacing: -0.02em !important;
        }

        .finalOrderCustomer,
        .finalOrderCustomerName {
          font-size: 18px !important;
          font-weight: 720 !important;
          line-height: 1.2 !important;
        }

        .finalOrderNumber {
          font-size: 12px !important;
          font-weight: 650 !important;
          letter-spacing: 0.045em !important;
          color: #64748b !important;
        }

        .finalOrderItems,
        .finalOrderItems li,
        .finalOrderItem {
          font-size: 14px !important;
          font-weight: 540 !important;
          line-height: 1.45 !important;
        }

        .finalOrderItems strong,
        .finalOrderItem strong {
          font-weight: 680 !important;
        }

        .finalOrderAmount,
        .finalOrderTotal {
          font-size: 24px !important;
          font-weight: 740 !important;
          letter-spacing: -0.035em !important;
        }

        .finalOrderDate {
          font-size: 16px !important;
          font-weight: 680 !important;
        }

        .finalOrderStatus,
        .finalOrderBadge {
          font-size: 11px !important;
          font-weight: 680 !important;
          letter-spacing: 0.025em !important;
        }

        .finalOrdersGrid.selectedFocusMode {
          padding: 30px 24px 38px !important;
          background: #fbfcfd !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          width: min(860px, 100%) !important;
          max-width: 860px !important;
          padding: 0 !important;
          border: 1px solid #d8e4e9 !important;
          border-radius: 22px !important;
          background: #ffffff !important;
          box-shadow: 0 18px 46px rgba(15, 23, 42, 0.085) !important;
          overflow: hidden !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::before {
          height: 4px !important;
          background: #0e9f7b !important;
        }

        .finalSelectedTop {
          margin: 0 !important;
          padding: 24px 26px 20px !important;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbfa 100%) !important;
          border-bottom: 1px solid #e2e9ed !important;
        }

        .finalSelectedTop h2,
        .finalSelectedTop h3 {
          margin-top: 8px !important;
          font-size: 24px !important;
          font-weight: 720 !important;
        }

        .finalSelectedFacts {
          gap: 12px !important;
          padding: 20px 26px !important;
        }

        .finalSelectedFact {
          min-height: 94px !important;
          padding: 16px 17px !important;
          border: 1px solid #e0e8ec !important;
          border-radius: 16px !important;
          background: #fbfcfd !important;
          box-shadow: none !important;
        }

        .finalSelectedFact strong {
          font-size: 11px !important;
          font-weight: 680 !important;
          letter-spacing: 0.045em !important;
        }

        .finalSelectedFact span {
          font-size: 14px !important;
          font-weight: 560 !important;
          line-height: 1.45 !important;
        }

        .finalSelectedPositions {
          padding: 0 26px 18px !important;
        }

        .finalSelectedPositions h3 {
          font-size: 15px !important;
          font-weight: 700 !important;
        }

        .finalSelectedPosition {
          padding: 12px 6px !important;
          border-bottom: 1px solid #edf1f3 !important;
          font-size: 14px !important;
          font-weight: 540 !important;
        }

        .finalSelectedPosition strong {
          font-weight: 680 !important;
        }

        .finalSelectedNotice {
          margin: 0 26px 18px !important;
          padding: 13px 15px !important;
          border: 1px solid #d6e9e2 !important;
          border-radius: 14px !important;
          background: #f3faf7 !important;
          font-size: 13px !important;
          font-weight: 550 !important;
        }

        .finalSelectedActions {
          gap: 10px !important;
          padding: 18px 26px 24px !important;
          background: #fbfcfd !important;
          border-top: 1px solid #e8edef !important;
        }

        .finalSelectedActions a,
        .finalSelectedActions button {
          min-height: 44px !important;
          border-radius: 12px !important;
          font-size: 14px !important;
          font-weight: 650 !important;
          box-shadow: none !important;
        }

        .finalSelectedActions a:first-child {
          background: #ffffff !important;
          color: #334155 !important;
          border: 1px solid #d3dde3 !important;
        }

        .finalSelectedActions a:not(:first-child),
        .finalSelectedActions button:not(:last-child) {
          background: #0e9f7b !important;
          color: #ffffff !important;
          border: 1px solid #0e9f7b !important;
        }

        .finalSelectedActions > *:last-child {
          background: #ffffff !important;
          color: #b42318 !important;
          border: 1px solid #efc5c2 !important;
        }

        .finalSelectedBadge,
        .finalSelectedSourceBadge {
          font-weight: 650 !important;
          box-shadow: none !important;
        }
        `}

        {`
        /* gastario-selected-panel-polish-20260713 */

        .finalOrdersGrid.selectedFocusMode {
          padding: 28px 28px 42px !important;
          background:
            radial-gradient(circle at top left, rgba(15, 157, 123, 0.05), transparent 28%),
            #f7faf9 !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          width: min(980px, 100%) !important;
          max-width: 980px !important;
          margin: 0 auto !important;
          border-radius: 24px !important;
          border: 1px solid #d8e5e1 !important;
          background: #ffffff !important;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08) !important;
          overflow: hidden !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel::before {
          height: 5px !important;
          background: linear-gradient(90deg, #0f9d7b 0%, #19b394 100%) !important;
        }

        .finalSelectedTop {
          padding: 26px 28px 22px !important;
          background:
            linear-gradient(180deg, #fbfefd 0%, #f4faf8 100%) !important;
          border-bottom: 1px solid #e4ece8 !important;
        }

        .finalSelectedTop h2,
        .finalSelectedTop h3 {
          margin: 10px 0 0 !important;
          font-size: 22px !important;
          line-height: 1.18 !important;
          letter-spacing: -0.03em !important;
          font-weight: 730 !important;
          color: #0f172a !important;
        }

        .finalSelectedTop p,
        .finalSelectedTop span {
          color: #64748b !important;
        }

        .finalSelectedBadge,
        .finalSelectedSourceBadge {
          display: inline-flex !important;
          align-items: center !important;
          min-height: 32px !important;
          padding: 0 14px !important;
          border-radius: 999px !important;
          font-size: 12px !important;
          font-weight: 680 !important;
          letter-spacing: 0.02em !important;
          box-shadow: none !important;
        }

        .finalSelectedFacts {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 14px !important;
          padding: 22px 28px 18px !important;
        }

        .finalSelectedFact {
          min-height: 96px !important;
          padding: 16px 16px 15px !important;
          border-radius: 16px !important;
          border: 1px solid #dde7e4 !important;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfc 100%) !important;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03) !important;
        }

        .finalSelectedFact strong {
          display: block !important;
          margin-bottom: 8px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          letter-spacing: 0.07em !important;
          text-transform: uppercase !important;
          color: #64748b !important;
        }

        .finalSelectedFact span,
        .finalSelectedFact div {
          font-size: 14px !important;
          line-height: 1.45 !important;
          font-weight: 590 !important;
          color: #1e293b !important;
        }

        .finalSelectedPositions {
          padding: 8px 28px 18px !important;
        }

        .finalSelectedPositions h3 {
          margin: 0 0 12px !important;
          font-size: 16px !important;
          font-weight: 710 !important;
          color: #0f172a !important;
        }

        .finalSelectedPosition {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 14px !important;
          padding: 13px 0 !important;
          border-bottom: 1px solid #edf2f1 !important;
          font-size: 15px !important;
          line-height: 1.45 !important;
          color: #0f172a !important;
        }

        .finalSelectedPosition:last-child {
          border-bottom: none !important;
        }

        .finalSelectedPosition strong {
          font-weight: 720 !important;
        }

        .finalSelectedNotice {
          margin: 2px 28px 18px !important;
          padding: 14px 16px !important;
          border-radius: 14px !important;
          border: 1px solid #d9ebe4 !important;
          background: #f3fbf7 !important;
          color: #315b4d !important;
          font-size: 13px !important;
          line-height: 1.45 !important;
          font-weight: 560 !important;
        }

        .finalSelectedActions {
          display: grid !important;
          grid-template-columns: 180px minmax(240px, 1fr) 150px !important;
          gap: 12px !important;
          padding: 20px 28px 26px !important;
          background: #fbfcfc !important;
          border-top: 1px solid #e7eeeb !important;
        }

        .finalSelectedActions a,
        .finalSelectedActions button {
          min-height: 46px !important;
          border-radius: 14px !important;
          font-size: 14px !important;
          font-weight: 680 !important;
          letter-spacing: -0.01em !important;
          box-shadow: none !important;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease,
            background 0.15s ease !important;
        }

        .finalSelectedActions a:hover,
        .finalSelectedActions button:hover {
          transform: translateY(-1px);
        }

        .finalSelectedActions > *:first-child {
          background: #ffffff !important;
          color: #334155 !important;
          border: 1px solid #d7e0dd !important;
        }

        .finalSelectedActions > *:nth-child(2) {
          background: linear-gradient(180deg, #16a37f 0%, #0f9d7b 100%) !important;
          color: #ffffff !important;
          border: 1px solid #109c7a !important;
          box-shadow: 0 10px 24px rgba(15, 157, 123, 0.18) !important;
        }

        .finalSelectedActions > *:last-child {
          background: #ffffff !important;
          color: #c2410c !important;
          border: 1px solid #f1c5b0 !important;
        }

        .finalSelectedActions > *:last-child:hover {
          background: #fff7f3 !important;
        }

        @media (max-width: 1100px) {
          .finalSelectedFacts {
            grid-template-columns: 1fr !important;
          }

          .finalSelectedActions {
            grid-template-columns: 1fr !important;
          }
        }
        `}

        {`
        /* gastario-final-selected-card-refine-20260713 */

        .finalOrdersGrid.selectedFocusMode {
          padding: 22px 24px 32px !important;
        }

        .finalOrdersGrid.selectedFocusMode .finalSelectedPanel {
          width: min(940px, 100%) !important;
          border-radius: 20px !important;
          border: 1px solid #dce7e3 !important;
          box-shadow: 0 14px 38px rgba(15, 23, 42, 0.07) !important;
        }

        .finalSelectedTop {
          padding: 22px 24px 18px !important;
        }

        .finalSelectedTop h2,
        .finalSelectedTop h3 {
          font-size: 21px !important;
          font-weight: 680 !important;
        }

        .finalSelectedTop p,
        .finalSelectedTop span {
          font-weight: 520 !important;
        }

        .finalSelectedFacts {
          gap: 12px !important;
          padding: 18px 24px !important;
        }

        .finalSelectedFact {
          min-height: 88px !important;
          padding: 14px 15px !important;
          border-radius: 14px !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        .finalSelectedFact:nth-child(1) {
          border-left: 3px solid #1aa17f !important;
        }

        .finalSelectedFact:nth-child(2) {
          border-left: 3px solid #6b8afd !important;
        }

        .finalSelectedFact:nth-child(3) {
          border-left: 3px solid #f59e0b !important;
        }

        .finalSelectedFact strong {
          margin-bottom: 6px !important;
          font-size: 10px !important;
          font-weight: 650 !important;
        }

        .finalSelectedFact span,
        .finalSelectedFact div {
          font-size: 14px !important;
          font-weight: 540 !important;
        }

        .finalSelectedPositions {
          padding: 0 24px 16px !important;
        }

        .finalSelectedPositions h3 {
          margin: 0 0 8px !important;
          font-size: 15px !important;
          font-weight: 660 !important;
        }

        .finalSelectedPosition {
          padding: 11px 8px !important;
          border-bottom: 1px solid #edf2f0 !important;
          font-size: 14px !important;
          font-weight: 500 !important;
        }

        .finalSelectedPosition:hover {
          background: #f8fbfa !important;
          border-radius: 10px !important;
        }

        .finalSelectedPosition strong {
          font-weight: 650 !important;
        }

        .finalSelectedNotice {
          margin: 0 24px 16px !important;
          padding: 12px 14px !important;
          border-radius: 12px !important;
          font-size: 12.5px !important;
          font-weight: 520 !important;
        }

        .finalSelectedActions {
          grid-template-columns: 170px minmax(260px, 1fr) 130px !important;
          gap: 10px !important;
          padding: 16px 24px 22px !important;
        }

        .finalSelectedActions a,
        .finalSelectedActions button {
          min-height: 44px !important;
          border-radius: 12px !important;
          font-size: 13.5px !important;
          font-weight: 620 !important;
        }

        .finalSelectedActions > *:nth-child(2) {
          box-shadow: 0 8px 18px rgba(15, 157, 123, 0.14) !important;
        }

        .finalSelectedActions > *:last-child {
          background: #ffffff !important;
          color: #b42318 !important;
          border: 1px solid #efc9c5 !important;
        }

        .finalSelectedActions > *:last-child:hover {
          background: #fff5f4 !important;
          border-color: #eaa9a2 !important;
        }

        .finalSelectedBadge {
          background: #fff8ee !important;
          color: #b45309 !important;
          border: 1px solid #f4c98d !important;
        }

        .finalSelectedSourceBadge {
          background: #edf9f5 !important;
          color: #15745f !important;
          border: 1px solid #cde8df !important;
        }
        `}
</style>
</AppLayout>
  );
}




































































































