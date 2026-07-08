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
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            OR: [{ deliveryDate: null }, { deliveryDate: { gte: currentOrdersDateStart } }],
          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "AUTO_CREATED" as any,
            OR: [{ deliveryDate: null }, { deliveryDate: { gte: currentOrdersDateStart } }],
          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "CONFIRMED" as any,
            OR: [{ deliveryDate: null }, { deliveryDate: { gte: currentOrdersDateStart } }],
          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: "REJECTED" as any,
            OR: [{ deliveryDate: null }, { deliveryDate: { gte: currentOrdersDateStart } }],
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

  const visibleOrders = sortedOrders.filter((order: any) => {
    if (order.status !== "AUTO_CREATED") return false;

    if (!order.deliveryDate) return true;

    const deliveryDate = new Date(order.deliveryDate);

    if (Number.isNaN(deliveryDate.getTime())) return true;

    const match = String(order.deliveryTimeText || "").match(/(\d{1,2})[:.](\d{2})/);

    if (match) {
      deliveryDate.setHours(Number(match[1]), Number(match[2]), 0, 0);
    } else {
      deliveryDate.setHours(23, 59, 59, 999);
    }

    return deliveryDate.getTime() >= Date.now();
  });


  const hiddenPastOrderCount = sortedOrders.length - visibleOrders.length;

  const currentOrderStats = {
    all: data.counts?.all || 0,
    review: data.counts?.review || 0,
    confirmed: data.counts?.confirmed || 0,
    rejected: data.counts?.rejected || 0,
  };


  return (
    <AppLayout>
      <div className="inboxPage">
        <section className="simpleTopbar">
          <div>
            <div className="simpleEyebrow">Auftragseingang</div>
            <h1>Prüfen & übernehmen</h1>
            <p>E-Mails abrufen, Aufträge kontrollieren und sauber in die Produktion übernehmen.</p>
          </div>

          <div className="simpleTopActions">
            <button
              type="button"
              className={liveEnabled ? "simpleGhost active" : "simpleGhost"}
              onClick={() => setLiveEnabled((value) => !value)}
              title={lastAutoImportAt ? "Letzter Auto-Abruf: " + lastAutoImportAt : "Automatischer Abruf"}
            >
              {liveEnabled ? "Live an" : "Live aus"}
            </button>

            <button
              type="button"
              className="simplePrimary"
              onClick={runEmailImportAndReload}
              disabled={isImportingNow}
            >
              {isImportingNow ? "Abruf läuft..." : "E-Mails abrufen"}
            </button>
          </div>
        </section>

        <nav className="simpleStatusTabs" aria-label="Auftragsstatus">
          {[
            ["Alle", currentOrderStats.all, ""],
            ["Zu prüfen", currentOrderStats.review, "AUTO_CREATED"],
            ["Übernommen", currentOrderStats.confirmed, "CONFIRMED"],
            ["Abgelehnt", currentOrderStats.rejected, "REJECTED"],
          ].map(([label, count, status]) => {
            const active = data.activeStatus === status || (!data.activeStatus && !status);
            const params = new URLSearchParams();

            if (status) params.set("status", String(status));
            if (data.selectedEmailCategory) params.set("emailCategory", data.selectedEmailCategory);
            if (data.dateRange) params.set("dateRange", data.dateRange);
            if (data.searchQuery) params.set("q", data.searchQuery);
            if (data.selectedDate) params.set("date", data.selectedDate);

            const href = "/auftragseingang" + (params.toString() ? "?" + params.toString() : "");

            return (
              <a key={String(label)} href={href} className={active ? "simpleStatusTab active" : "simpleStatusTab"}>
                <span>{label}</span>
                <strong>{count}</strong>
              </a>
            );
          })}
        </nav>

        {actionData?.error ? (
          <div className="simpleAlert error">{actionData.error}</div>
        ) : null}

        {actionData?.success ? (
          <div className="simpleAlert success">{actionData.success}</div>
        ) : null}

        <section className="simpleMailBox">
          <div className="simpleSectionHead">
            <div>
              <div className="simpleEyebrow">E-Mail Eingang</div>
              <h2>{emailCategoryLabel(data.selectedEmailCategory)}</h2>
              <p>{currentBucket.help}</p>
            </div>

            <Form method="get" className="simpleFilter">
              <input type="hidden" name="emailCategory" value={data.selectedEmailCategory} />
              {data.activeStatus ? <input type="hidden" name="status" value={data.activeStatus} /> : null}

              <input
                name="q"
                defaultValue={data.searchQuery || ""}
                placeholder="Betreff, Absender, Kunde"
              />

              <select name="dateRange" defaultValue={data.dateRange || "last7"}>
                <option value="last7">Letzte 7 Tage</option>
                <option value="today">Heute</option>
                <option value="yesterday">Gestern</option>
              </select>

              <button type="submit">Filtern</button>
              <a href={emailResetHref}>Zurücksetzen</a>
            </Form>
          </div>

          <div className="simpleMailTabs">
            {EMAIL_BUCKETS.map((bucket) => {
              const count = data.emailBuckets[bucket.key as keyof typeof data.emailBuckets] ?? 0;
              const params = new URLSearchParams();

              if (data.searchQuery) params.set("q", data.searchQuery);
              if (data.dateRange) params.set("dateRange", data.dateRange);
              if (data.selectedDate) params.set("date", data.selectedDate);
              if (data.activeStatus) params.set("status", data.activeStatus);
              params.set("emailCategory", bucket.key);

              const active = data.selectedEmailCategory === bucket.key;

              return (
                <a
                  key={bucket.key}
                  href={"/auftragseingang?" + params.toString()}
                  className={active ? "simpleMailTab active" : "simpleMailTab"}
                >
                  <span>{bucket.label}</span>
                  <strong>{count}</strong>
                </a>
              );
            })}
          </div>

          {data.emailInbox.length === 0 ? (
            <div className="simpleEmpty">Keine ungeprüften E-Mails in dieser Kategorie.</div>
          ) : (
            <div className="simpleMailList">
              {sortedEmails.map((mail: any) => {
                const category = classifyIncomingEmail(mail);
                const receivedDate = new Date(mail.receivedAt || mail.createdAt);
                const isInquiry = category === "inquiries";

                return (
                  <div className="simpleMailRow" key={mail.id}>
                    <div>
                      <strong>{mail.subject || "Ohne Betreff"}</strong>
                      <span>{mail.sender || "-"} · {receivedDate.toLocaleDateString("de-DE")}</span>
                    </div>

                    <div className="simpleRowActions">
                      <a href={(isInquiry ? "/angebot-vorbereiten/" : "/email-pruefung/") + mail.id}>
                        {isInquiry ? "Angebot" : "Prüfen"}
                      </a>

                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteIncomingEmail" />
                        <input type="hidden" name="emailId" value={mail.id} />
                        <button type="submit">Löschen</button>
                      </Form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="simpleOrders">
          <div className="simpleOrdersHead">
            <div>
              <div className="simpleEyebrow">Aufträge</div>
              <h2>Zu prüfen</h2>
              <p>Nur Aufträge, die noch kontrolliert und übernommen werden müssen.</p>
            </div>

            <div className="simpleOrderCount">
              <strong>{visibleOrders.length}</strong>
              <span>offen</span>
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <div className="simpleEmpty">Keine ungeprüften aktuellen Aufträge.</div>
          ) : (
            <div className="simpleOrderList">
              {visibleOrders.map((order: any) => {
                const items = Array.isArray(order.items) ? order.items : [];
                const totalInfo = getDisplayedOrderTotal(order);
                const previewItems = items.slice(0, 4);

                return (
                  <article className="simpleOrderCard" key={order.id}>
                    <div className="simpleOrderMain">
                      <div className="simpleOrderMeta">{order.orderNumber}</div>
                      <h3>{order.customerName || order.customer?.name || "Kunde unbekannt"}</h3>
                      <p>{order.contactName || "Keine Kontaktperson erkannt"}</p>

                      <div className="simpleItems">
                        {previewItems.map((item: any) => (
                          <div key={item.id || item.name}>
                            <strong>{item.quantity || 1}x</strong>
                            <span>{item.name || "Position"}</span>
                          </div>
                        ))}

                        {items.length > previewItems.length ? (
                          <small>+ {items.length - previewItems.length} weitere Positionen</small>
                        ) : null}
                      </div>
                    </div>

                    <aside className="simpleOrderSide">
                      <div className="simpleDateBox">
                        <strong>{formatDate(order.deliveryDate)}</strong>
                        <span>{order.deliveryTimeText || "Uhrzeit offen"}</span>
                      </div>

                      <div className="simplePriceBox">
                        <strong>{formatImportCurrencyFromCents(totalInfo.cents)}</strong>
                        <span>{totalInfo.source}</span>
                        {totalInfo.source === "vorläufig" ? (
                          <small>bitte prüfen</small>
                        ) : null}
                      </div>

                      <div className="simpleBadges">
                        <span>{statusLabel(order.status)}</span>
                        <span>{sourceLabel(order.source)}</span>
                      </div>

                      <div className="simpleOrderActions">
                        <a href={"/auftrag-pruefung/" + order.id}>Prüfen</a>

                        <Form method="post">
                          <input type="hidden" name="intent" value="deleteOrder" />
                          <input type="hidden" name="orderId" value={order.id} />
                          <button type="submit">Löschen</button>
                        </Form>
                      </div>
                    </aside>
                  </article>
                );
              })}
            </div>
          )}

          {hiddenPastOrderCount > 0 ? (
            <div className="simpleHint">
              {hiddenPastOrderCount} vergangene Auftrag{hiddenPastOrderCount === 1 ? "" : "e"} ausgeblendet.{" "}
              <a href="/auftraege?view=past">Vergangene Aufträge öffnen</a>
            </div>
          ) : null}
        </section>
      </div>

      <style>{`
        /* gastario-simple-new-structure-20260708 */

        .inboxPage {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 22px 46px;
          color: #0f172a;
        }

        .inboxPage * {
          box-sizing: border-box;
        }

        .simpleTopbar,
        .simpleMailBox,
        .simpleOrderCard {
          background: #ffffff;
          border: 1px solid #dbe7e2;
          border-radius: 18px;
          box-shadow: 0 10px 26px rgba(15, 23, 42, .045);
        }

        .simpleTopbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          margin-bottom: 12px;
        }

        .simpleEyebrow {
          color: #0f9f7a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .simpleTopbar h1,
        .simpleSectionHead h2,
        .simpleOrdersHead h2 {
          margin: 4px 0 0;
          color: #061f1b;
          font-weight: 900;
          letter-spacing: -.8px;
        }

        .simpleTopbar h1 {
          font-size: 28px;
          line-height: 1.1;
        }

        .simpleTopbar p,
        .simpleSectionHead p,
        .simpleOrdersHead p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 650;
        }

        .simpleTopActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .simplePrimary,
        .simpleGhost,
        .simpleFilter button,
        .simpleFilter a,
        .simpleRowActions a,
        .simpleRowActions button,
        .simpleOrderActions a,
        .simpleOrderActions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 13px;
          border-radius: 10px;
          border: 1px solid #d6e5df;
          background: #ffffff;
          color: #0f172a;
          font-weight: 850;
          text-decoration: none;
          cursor: pointer;
        }

        .simplePrimary,
        .simpleFilter button,
        .simpleRowActions a,
        .simpleOrderActions a {
          background: #10a37f;
          border-color: #10a37f;
          color: #ffffff;
        }

        .simpleGhost.active {
          color: #08765d;
          border-color: #b7e4d6;
          background: #f0fdf9;
        }

        .simpleStatusTabs {
          display: flex;
          gap: 8px;
          margin: 0 0 14px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .simpleStatusTab {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 38px;
          padding: 0 13px;
          border: 1px solid #dbe7e2;
          border-radius: 999px;
          background: #ffffff;
          color: #172033;
          text-decoration: none;
          font-weight: 850;
          white-space: nowrap;
        }

        .simpleStatusTab strong,
        .simpleMailTab strong {
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
          font-weight: 900;
        }

        .simpleStatusTab.active,
        .simpleMailTab.active {
          background: #10a37f;
          border-color: #10a37f;
          color: #ffffff;
        }

        .simpleStatusTab.active strong,
        .simpleMailTab.active strong {
          background: rgba(255,255,255,.22);
          color: #ffffff;
        }

        .simpleAlert {
          margin: 0 0 12px;
          padding: 12px 14px;
          border-radius: 12px;
          font-weight: 800;
        }

        .simpleAlert.error {
          background: #fff1f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .simpleAlert.success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .simpleMailBox {
          padding: 18px;
          margin-bottom: 26px;
        }

        .simpleSectionHead {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(520px, 620px);
          gap: 16px;
          align-items: start;
          margin-bottom: 14px;
        }

        .simpleSectionHead h2,
        .simpleOrdersHead h2 {
          font-size: 25px;
          line-height: 1.1;
        }

        .simpleFilter {
          display: grid;
          grid-template-columns: 1fr 165px auto auto;
          gap: 8px;
          padding: 8px;
          border: 1px solid #dbe7e2;
          border-radius: 14px;
          background: #f8fbfa;
        }

        .simpleFilter input,
        .simpleFilter select {
          width: 100%;
          height: 38px;
          padding: 0 11px;
          border: 1px solid #d6e5df;
          border-radius: 10px;
          background: #ffffff;
          color: #0f172a;
          font-weight: 700;
        }

        .simpleMailTabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .simpleMailTab {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 0 12px;
          border: 1px solid #dbe7e2;
          border-radius: 999px;
          background: #ffffff;
          color: #172033;
          text-decoration: none;
          font-size: 13px;
          font-weight: 850;
        }

        .simpleEmpty {
          padding: 14px;
          border: 1px dashed #c9ded7;
          border-radius: 14px;
          background: #f8fbfa;
          color: #64748b;
          font-weight: 800;
        }

        .simpleMailList {
          display: grid;
          gap: 8px;
        }

        .simpleMailRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border: 1px solid #e2ebe7;
          border-radius: 14px;
          background: #ffffff;
        }

        .simpleMailRow strong {
          display: block;
          color: #0f172a;
          font-weight: 850;
        }

        .simpleMailRow span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .simpleRowActions,
        .simpleOrderActions {
          display: flex;
          gap: 7px;
          align-items: center;
          justify-content: flex-end;
        }

        .simpleRowActions button,
        .simpleOrderActions button {
          color: #991b1b;
          border-color: #fecaca;
          background: #fff1f2;
        }

        .simpleOrdersHead {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #dbe7e2;
        }

        .simpleOrderCount {
          display: flex;
          align-items: baseline;
          gap: 6px;
          color: #64748b;
          font-weight: 850;
        }

        .simpleOrderCount strong {
          color: #061f1b;
          font-size: 24px;
          font-weight: 900;
        }

        .simpleOrderList {
          display: grid;
          gap: 12px;
        }

        .simpleOrderCard {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 230px;
          gap: 16px;
          padding: 16px;
        }

        .simpleOrderMeta {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .simpleOrderCard h3 {
          margin: 4px 0 2px;
          color: #061f1b;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: -.5px;
        }

        .simpleOrderCard p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .simpleItems {
          display: grid;
          gap: 5px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #edf3f1;
        }

        .simpleItems div {
          display: flex;
          gap: 9px;
          font-size: 13px;
          font-weight: 750;
        }

        .simpleItems strong {
          min-width: 28px;
          color: #0f9f7a;
          font-weight: 900;
        }

        .simpleItems small {
          color: #64748b;
          font-weight: 800;
        }

        .simpleOrderSide {
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .simpleDateBox,
        .simplePriceBox {
          padding: 12px;
          border-radius: 14px;
          border: 1px solid #dbe7e2;
          background: #f8fbfa;
        }

        .simpleDateBox {
          text-align: right;
        }

        .simpleDateBox strong {
          display: block;
          color: #061f1b;
          font-size: 16px;
          font-weight: 900;
        }

        .simpleDateBox span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .simplePriceBox {
          border-color: #fed7aa;
          background: #fff7ed;
        }

        .simplePriceBox strong {
          display: block;
          color: #061f1b;
          font-size: 25px;
          line-height: 1;
          font-weight: 900;
          white-space: nowrap;
        }

        .simplePriceBox span,
        .simplePriceBox small {
          display: block;
          margin-top: 5px;
          color: #b45309;
          font-size: 11px;
          line-height: 1.2;
          font-weight: 850;
          text-transform: uppercase;
        }

        .simpleBadges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .simpleBadges span {
          display: inline-flex;
          align-items: center;
          min-height: 25px;
          padding: 0 9px;
          border-radius: 999px;
          background: #f1f5f4;
          color: #36534b;
          font-size: 12px;
          font-weight: 800;
        }

        .simpleHint {
          margin-top: 12px;
          color: #64748b;
          font-size: 13px;
          font-weight: 750;
        }

        .simpleHint a {
          color: #0f766e;
          font-weight: 900;
        }

        @media (max-width: 980px) {
          .simpleTopbar,
          .simpleSectionHead,
          .simpleOrderCard {
            grid-template-columns: 1fr;
            display: grid;
          }

          .simpleFilter {
            grid-template-columns: 1fr;
          }

          .simpleDateBox {
            text-align: left;
          }
        }
      
        /* gastario-email-panel-polish-20260708 */

        .simpleMailBox {
          padding: 0 !important;
          overflow: hidden !important;
          border-radius: 18px !important;
          border: 1px solid #dbe7e2 !important;
          background: #ffffff !important;
          box-shadow: 0 10px 26px rgba(15, 23, 42, .045) !important;
        }

        .simpleSectionHead {
          display: grid !important;
          grid-template-columns: minmax(260px, 1fr) minmax(520px, 640px) !important;
          gap: 18px !important;
          align-items: start !important;
          padding: 18px 18px 14px !important;
          margin: 0 !important;
          border-bottom: 1px solid #edf3f1 !important;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdfc 100%) !important;
        }

        .simpleSectionHead h2 {
          margin: 4px 0 0 !important;
          font-size: 25px !important;
          line-height: 1.1 !important;
          font-weight: 900 !important;
          letter-spacing: -.7px !important;
          color: #061f1b !important;
        }

        .simpleSectionHead p {
          margin: 5px 0 0 !important;
          color: #64748b !important;
          font-size: 13px !important;
          font-weight: 650 !important;
        }

        .simpleFilter {
          display: grid !important;
          grid-template-columns: minmax(180px, 1fr) 160px auto auto !important;
          gap: 8px !important;
          padding: 8px !important;
          border-radius: 14px !important;
          border: 1px solid #dbe7e2 !important;
          background: #f8fbfa !important;
        }

        .simpleFilter input,
        .simpleFilter select {
          height: 38px !important;
          border-radius: 10px !important;
          border: 1px solid #d6e5df !important;
          background: #ffffff !important;
          font-size: 13px !important;
          font-weight: 700 !important;
        }

        .simpleFilter button,
        .simpleFilter a {
          min-height: 38px !important;
          border-radius: 10px !important;
          font-size: 13px !important;
          font-weight: 850 !important;
          box-shadow: none !important;
        }

        .simpleMailTabs {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 8px !important;
          padding: 14px 18px 12px !important;
          margin: 0 !important;
          border-bottom: 1px solid #edf3f1 !important;
        }

        .simpleMailTab {
          min-height: 35px !important;
          padding: 0 12px !important;
          border-radius: 999px !important;
          border: 1px solid #dbe7e2 !important;
          background: #ffffff !important;
          color: #172033 !important;
          font-size: 13px !important;
          font-weight: 850 !important;
          box-shadow: none !important;
        }

        .simpleMailTab strong {
          min-width: 23px !important;
          height: 23px !important;
          padding: 0 7px !important;
          border-radius: 999px !important;
          background: #eef6f4 !important;
          color: #0f766e !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }

        .simpleMailTab.active {
          background: #10a37f !important;
          border-color: #10a37f !important;
          color: #ffffff !important;
        }

        .simpleMailTab.active strong {
          background: rgba(255,255,255,.22) !important;
          color: #ffffff !important;
        }

        .simpleEmpty {
          margin: 14px 18px 18px !important;
          padding: 16px 18px !important;
          border-radius: 14px !important;
          border: 1px dashed #c9ded7 !important;
          background: #fbfdfc !important;
          color: #64748b !important;
          font-size: 14px !important;
          font-weight: 800 !important;
        }

        .simpleMailList {
          display: grid !important;
          gap: 8px !important;
          padding: 14px 18px 18px !important;
        }

        .simpleMailRow {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 12px !important;
          align-items: center !important;
          padding: 12px 14px !important;
          border: 1px solid #e2ebe7 !important;
          border-radius: 14px !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        .simpleMailRow strong {
          color: #0f172a !important;
          font-size: 14px !important;
          font-weight: 850 !important;
        }

        .simpleMailRow span {
          display: block !important;
          margin-top: 3px !important;
          color: #64748b !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }

        @media (max-width: 1000px) {
          .simpleSectionHead,
          .simpleFilter {
            grid-template-columns: 1fr !important;
          }
        }
`}</style>
</AppLayout>
  );
}
































