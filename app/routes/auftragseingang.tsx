import {
  useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import auftragseingangStyles from "../styles/auftragseingang.css?url";
import auftragseingangReferenceStyles from "../styles/auftragseingang-reference.css?url";
import { Form, Link, redirect, useActionData, useFetcher, useLoaderData,
  useSearchParams,
} from "react-router";

export function links() {
  return [
    {
      rel: "stylesheet",
      href: auftragseingangStyles,
    },
      {
      rel: "stylesheet",
      href: auftragseingangReferenceStyles,
    },
];
}

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
  if (value === "orders") return "Aufträge";
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
  if (status === "CONFIRMED") return "\u00dcbernommen";
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
          : "Aufträge";

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
      ? "\u00dcbernommene Auftr\u00e4ge"
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

  /* gastario-url-selected-order-fix-20260713 */
  const [selectedOrderSearchParams, setSelectedOrderSearchParams] =
    useSearchParams();

  const selectedOrderId =
    selectedOrderSearchParams.get("selectedOrder") || null;

  function updateSelectedOrder(nextOrderId: string | null) {
    const nextParams = new URLSearchParams(selectedOrderSearchParams);

    if (nextOrderId) {
      nextParams.set("selectedOrder", nextOrderId);
    } else {
      nextParams.delete("selectedOrder");
    }

    setSelectedOrderSearchParams(nextParams, {
      replace: true,
      preventScrollReset: true,
    });
  }

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
                
        <div className="inboxCombinedNavigation">
          <nav className="finalCategoryTabs" aria-label="E-Mail-Kategorien">
            {[
              [
                "orders",
                "Aufträge",
                currentOrderStats.all,
              ],
              [
                "inquiries",
                "Anfragen / Leads",
                data.emailBuckets?.inquiries || 0,
              ],
              [
                "possible",
                "Unklare E-Mails",
                data.emailBuckets?.possible || 0,
              ],
              [
                "hidden",
                "Ignorierte E-Mails",
                data.emailBuckets?.hidden || 0,
              ],
            ].map(([key, label, count]) => {
              const active = data.selectedEmailCategory === key;

              return (
                <Form
                  key={String(key)}
                  method="get"
                  action="/auftragseingang"
                  className="finalCategoryForm"
                >
                  <input
                    type="hidden"
                    name="emailCategory"
                    value={String(key)}
                  />

                  <input
                    type="hidden"
                    name="dateRange"
                    value={data.dateRange || "last7"}
                  />

                  {data.searchQuery ? (
                    <input
                      type="hidden"
                      name="q"
                      value={data.searchQuery}
                    />
                  ) : null}

                  {data.selectedDate ? (
                    <input
                      type="hidden"
                      name="date"
                      value={data.selectedDate}
                    />
                  ) : null}

                  <button
                    type="submit"
                    className={
                      active
                        ? "finalCategoryTab active"
                        : "finalCategoryTab"
                    }
                  >
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </button>
                </Form>
              );
            })}
          </nav>

          <span
            className="inboxNavigationDivider"
            aria-hidden="true"
          />

          {!isEmailFocusedView ? (
            <div className="orderStatusSubnav">
              <span className="orderStatusSubnavLabel">
                Auftragsstatus
              </span>

              <nav className="realOrderTabs" aria-label="Auftragsfilter">
          {[
            ["Alle Aufträge", currentOrderStats.all, ""],
            ["Zu prüfen", currentOrderStats.review, "AUTO_CREATED"],
            ["\u00dcbernommen", currentOrderStats.confirmed, "CONFIRMED"],
            ["Abgelehnt", currentOrderStats.rejected, "REJECTED"],
          ].map(([label, count, status]) => {
            const active = !isEmailFocusedView && (activeOrderStatus === status || (!activeOrderStatus && !status));
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
            </div>
          ) : null}
        </div>
{/* gastario-restored-email-focused-view-20260713 */}
        {isEmailFocusedView ? (
          <section className="leadEmailPanel">
            <div className="leadEmailHeader">
              <div>
                <p>{inboxSubtitle}</p>
                <h2>{inboxHeadline}</h2>
              </div>

              <strong>
                {sortedEmails.length}{" "}
                {sortedEmails.length === 1 ? "Eingang" : "Eingänge"}
              </strong>
            </div>

            {sortedEmails.length === 0 ? (
              <div className="leadEmpty">
                Keine passenden E-Mails in dieser Ansicht.
              </div>
            ) : (
              <div className="leadEmailGrid">
                {sortedEmails.map((mail: any) => {
                  const extracted = mail.extractedJson || {};
                  const aiDecision = extracted.aiDecision || {};

                  const bodyPreview = String(mail.bodyText || "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 260);

                  const receivedAt = mail.receivedAt
                    ? new Date(mail.receivedAt)
                    : null;

                  const sender =
                    mail.fromName ||
                    mail.fromAddress ||
                    mail.fromEmail ||
                    mail.sender ||
                    "Absender unbekannt";

                  return (
                    <article className="leadEmailCard" key={mail.id}>
                      <div className="leadEmailTop">
                        <span className="leadTypePill">
                          {isInquiryView
                            ? "Anfrage"
                            : isReviewMailView
                              ? "Unklar"
                              : isIgnoredMailView
                                ? "Ignoriert"
                                : emailCategoryLabel(
                                    classifyIncomingEmail(mail)
                                  )}
                        </span>

                        <span>
                          {receivedAt &&
                          !Number.isNaN(receivedAt.getTime())
                            ? receivedAt.toLocaleDateString("de-DE")
                            : "-"}
                        </span>
                      </div>

                      <h3>{mail.subject || "Ohne Betreff"}</h3>

                      <div className="leadEmailSender">
                        {String(sender)}
                      </div>

                      {aiDecision?.mailType ? (
                        <div className="leadAiBox">
                          <strong>KI: {aiDecision.mailType}</strong>

                          <span>
                            {Math.round(
                              Number(aiDecision.confidence || 0) * 100
                            )}{" "}
                            % {"\u00b7"}{" "}
                            {aiDecision.reason ||
                              "Keine Begründung gespeichert"}
                          </span>
                        </div>
                      ) : null}

                      <p className="leadPreview">
                        {bodyPreview || "Kein Mailtext gespeichert."}
                      </p>

                      <div className="leadEmailActions">
                        <Link
                          to={"/email-pruefung/" + mail.id}
                          className="leadPrimaryAction"
                        >
                          Öffnen
                        </Link>

                        {!isIgnoredMailView ? (
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="hideIncomingEmail"
                            />

                            <input
                              type="hidden"
                              name="emailId"
                              value={mail.id}
                            />

                            <button
                              type="submit"
                              className="leadSecondaryAction"
                            >
                              Ausblenden
                            </button>
                          </Form>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
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
                      onClick={() => updateSelectedOrder(order.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          updateSelectedOrder(order.id);
                        }
                      }}
                    >
                      <div className="finalOrderIcon">{"\u2709"}</div>

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
                      Der Betrag ist vorl\u00e4ufig und sollte vor \u00dcbernahme gepr\u00fcft werden.
                    </div>
                  ) : null}

                  <div className="finalSelectedActions">
                    <button type="button" className="finalBackButton" onClick={() => updateSelectedOrder(null)}>
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
        )}
</div>


</AppLayout>
  );
}




































































































