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

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const selectedOrder: any =
    visibleOrders.find((order: any) => order.id === selectedOrderId) ||
    visibleOrders[0] ||
    null;

  const selectedOrderItems = selectedOrder
    ? (Array.isArray(selectedOrder.items) ? selectedOrder.items : []).filter(
        (item: any) => !String(item.name || "").toLowerCase().includes("fehlende position")
      )
    : [];

  const selectedOrderTotal = selectedOrder ? getDisplayedOrderTotal(selectedOrder) : null;


  return (
    <AppLayout>
      <div className="inboxPage inboxFinalPage">
        <section className="finalHeader">
          <div>
            <div className="finalEyebrow">Auftragseingang</div>
            <h1>Auftragsbestätigungen</h1>
            <p>E-Mails abrufen, Aufträge kontrollieren und sauber in die Produktion übernehmen.</p>

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
        <section className="finalOrdersShell finalOrdersSplitShell">
          <div className="finalOrdersHead">
            <div>
              <h2>Zu prüfen</h2>
              <p>Nur Aufträge, die noch kontrolliert und übernommen werden müssen.</p>
            </div>

            <div className="finalOrdersRight">
              <strong>{visibleOrders.length}</strong>
              <span>offen</span>
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <div className="finalEmpty">
              Keine ungeprüften aktuellen Aufträge.
            </div>
          ) : (
            <div className="finalOrdersGrid">
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
`}</style>
</AppLayout>
  );
}












































