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
            ["Alle Aufträge", currentOrderStats.all, ""],
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
              <a key={String(label)} href={href} className={active ? "statCard active" : "statCard"}>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>
                  {status === "AUTO_CREATED"
                    ? "aktuell offen"
                    : status === "CONFIRMED"
                      ? "bevorstehend"
                      : status === "REJECTED"
                        ? "nicht übernommen"
                        : "aktuell / kommend"}
                </small>
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
              if (data.activeStatus) params.set("status", data.activeStatus);
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
            <div className="ordersTable emailTable">
              <div className="ordersHead">
                <span>Betreff</span>
                <span>Absender</span>
                <span>Eingang</span>
                <span>Typ</span>
                <span></span>
                <span>Status</span>
                <span>Aktion</span>
              </div>

              {sortedEmails.map((mail: any) => {
                const category = classifyIncomingEmail(mail);
                const receivedDate = new Date(mail.receivedAt || mail.createdAt);
                const isInquiry = category === "inquiries";

                return (
                  <div className="ordersRow emailRow" key={mail.id}>
                    <div>
                      <strong>{mail.subject || "Ohne Betreff"}</strong>
                      <small>{emailCategoryLabel(category)}</small>
                    </div>

                    <div>
                      <strong>{mail.sender || "-"}</strong>
                      <small>{mail.account?.email || mail.accountEmail || "-"}</small>
                    </div>

                    <div>
                      <strong>{receivedDate.toLocaleDateString("de-DE")}</strong>
                      <small>{receivedDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</small>
                    </div>

                    <div>
                      <strong>{isInquiry ? "Anfrage" : "E-Mail"}</strong>
                      <small>{mail.attachments?.length || 0} Anhänge</small>
                    </div>

                    <strong>-</strong>

                    <span className="statusBadge">{mail.status === "IGNORED" ? "Ausgeblendet" : "Ungeprüft"}</span>

                    <div className="orderActions">
                      <a
                        href={(isInquiry ? "/angebot-vorbereiten/" : "/email-pruefung/") + mail.id}
                        className="primaryBtn small"
                      >
                        {isInquiry ? "Angebot" : "Prüfen"}
                      </a>

                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteIncomingEmail" />
                        <input type="hidden" name="emailId" value={mail.id} />
                        <button type="submit" className="dangerBtn small">Löschen</button>
                      </Form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="ordersPanel orderReviewPanel">
          <div className="orderReviewHeader">
            <div>
              <div className="inboxOverline">Aufträge</div>
              <h2>Zu prüfende Aufträge</h2>
              <p>Automatisch erkannte Aufträge werden hier zuerst geprüft, bevor sie endgültig übernommen werden.</p>
            </div>

            <div className="orderReviewSummary">
              <strong>{visibleOrders.length}</strong>
              <span>offene Prüfaufträge</span>
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <div className="ordersEmpty">Keine ungeprüften aktuellen Aufträge. Übernommene Aufträge findest du unter „Bevorstehende Aufträge“, vergangene unter „Vergangene Aufträge“.</div>
          ) : (
            <div className="orderCards">
              {visibleOrders.map((order: any) => {
                const items = Array.isArray(order.items) ? order.items : [];
                const totalInfo = getDisplayedOrderTotal(order);
                const previewItems = items.slice(0, 3);

                return (
                  <article className="orderCard" key={order.id}>
                    <div className="orderCardTop">
                      <div className="orderCardIdentity">
                        <div className="orderCardNumber">{order.orderNumber}</div>
                        <h3>{order.customerName || order.customer?.name || "Kunde unbekannt"}</h3>
                        <div className="orderCardContact">
                          {order.contactName || "Keine Kontaktperson erkannt"}
                        </div>
                      </div>

                      <div className="orderCardDate">
                        <strong>{formatDate(order.deliveryDate)}</strong>
                        <span>{order.deliveryTimeText || "Uhrzeit offen"}</span>
                      </div>
                    </div>

                    <div className="orderCardBody">
                      <div className="orderCardItems">
                        <div className="orderCardLabel">Positionen</div>

                        {previewItems.length > 0 ? (
                          <ul>
                            {previewItems.map((item: any, index: number) => (
                              <li key={index}>
                                <strong>{Number(item.quantity || 1)}x</strong>
                                <span>{item.name || "Position"}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="orderCardEmpty">Keine Positionen erkannt</div>
                        )}

                        {items.length > 3 ? (
                          <div className="orderCardMore">+ {items.length - 3} weitere Positionen</div>
                        ) : null}
                      </div>

                      <div className="orderCardSide">
                        <div className="orderCardPrice">
                          <strong>{formatImportCurrencyFromCents(totalInfo.cents)}</strong>
                          <span>{totalInfo.source}</span>
                          {totalInfo.source === "vorläufig" ? (
                            <small>aus erkannten Positionen berechnet — bitte prüfen</small>
                          ) : null}

                          {totalInfo.source === "Dokumentsumme" && totalInfo.positionsCents > 0 ? (
                            <small>Positionen: {formatImportCurrencyFromCents(totalInfo.positionsCents)}</small>
                          ) : null}
                        </div>

                        <div className="orderCardBadges">
                          <span className="statusBadge">{statusLabel(order.status)}</span>
                          <span className="sourceBadge">{sourceLabel(order.source)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="orderCardActions">
                      <a href={"/auftrag-pruefung/" + order.id} className="btnPrimary">
                        Prüfen
                      </a>

                      <Form method="post">
                        <input type="hidden" name="intent" value="deleteOrder" />
                        <input type="hidden" name="orderId" value={order.id} />
                        <button type="submit" className="btnDanger">Löschen</button>
                      </Form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {hiddenPastOrderCount > 0 ? (
            <div className="pastOrdersHint">
              {hiddenPastOrderCount} vergangene Auftrag{hiddenPastOrderCount === 1 ? "" : "e"} ausgeblendet.{" "}
              <a href="/auftraege?view=past">Vergangene Aufträge öffnen</a>
            </div>
          ) : null}
        </section>
      </div>
      <style>{`
        /* gastario-auftragseingang-full-redesign-20260708 */

        .inboxPage {
          width: 100%;
          max-width: 1360px;
          margin: 0 auto;
          padding: 0 24px 48px;
          color: #0f172a;
        }

        .inboxPage * {
          box-sizing: border-box;
        }

        .inboxOverline {
          margin-bottom: 6px;
          color: #0f9f7a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        /* HERO */
        .inboxHero {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 28px;
          padding: 30px 34px;
          margin-bottom: 14px;
          border: 1px solid rgba(15, 159, 122, .18);
          border-radius: 28px;
          background:
            radial-gradient(circle at left top, rgba(15, 159, 122, .15), transparent 34%),
            linear-gradient(135deg, #ffffff 0%, #f7fffb 100%);
          box-shadow: 0 24px 60px rgba(15, 23, 42, .08);
          overflow: hidden;
        }

        .inboxHero::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 7px;
          background: linear-gradient(180deg, #10a37f, #f59e0b);
        }

        .inboxHero h1 {
          margin: 0;
          color: #06251f;
          font-size: 38px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -1.6px;
        }

        .inboxHero p {
          max-width: 780px;
          margin: 9px 0 0;
          color: #536579;
          font-size: 15px;
          line-height: 1.5;
          font-weight: 700;
        }

        .heroActions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .heroActions button {
          min-height: 44px;
          padding: 0 18px;
          border-radius: 14px;
          border: 1px solid #d6e5df;
          background: #ffffff;
          color: #0f172a;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(15, 23, 42, .06);
        }

        .heroActions button:last-child {
          border-color: #10a37f;
          background: #10a37f;
          color: #ffffff;
          box-shadow: 0 12px 26px rgba(16, 163, 127, .28);
        }

        .liveInfo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 12px;
          padding: 0 2px;
          color: #526579;
          font-size: 13px;
          font-weight: 800;
        }

        .liveInfo::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #10a37f;
          box-shadow: 0 0 0 4px rgba(16, 163, 127, .12);
        }

        /* STATUS */
        .compactStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 0 0 18px;
        }

        .statCard {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-height: 92px;
          padding: 18px 18px 16px;
          border: 1px solid #dbe7e2;
          border-radius: 22px;
          background: rgba(255, 255, 255, .92);
          color: #172033;
          text-decoration: none;
          box-shadow: 0 16px 36px rgba(15, 23, 42, .055);
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }

        .statCard:hover {
          transform: translateY(-1px);
          border-color: rgba(16, 163, 127, .35);
          box-shadow: 0 20px 42px rgba(15, 23, 42, .075);
        }

        .statCard span {
          color: #526579;
          font-size: 13px;
          font-weight: 900;
        }

        .statCard strong {
          color: #061f1b;
          font-size: 27px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -.6px;
        }

        .statCard small {
          color: #7a8a9d;
          font-size: 12px;
          font-weight: 800;
        }

        .statCard.active {
          border-color: #10a37f;
          background:
            radial-gradient(circle at right top, rgba(255,255,255,.22), transparent 34%),
            linear-gradient(135deg, #10a37f 0%, #0b8769 100%);
          color: #ffffff;
          box-shadow: 0 18px 42px rgba(16, 163, 127, .26);
        }

        .statCard.active span,
        .statCard.active strong,
        .statCard.active small {
          color: #ffffff;
        }

        /* ALERTS */
        .alertBox {
          margin: 0 0 14px;
          padding: 13px 15px;
          border-radius: 16px;
          font-weight: 800;
        }

        .alertBox.error {
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
        }

        .alertBox.success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        /* EMAIL WORKBENCH */
        .inboxPanel {
          margin-bottom: 26px;
          padding: 24px;
          border: 1px solid #dbe7e2;
          border-radius: 28px;
          background: #ffffff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, .075);
        }

        .panelTop {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(560px, 720px);
          align-items: start;
          gap: 22px;
          margin-bottom: 18px;
        }

        .panelTop h2 {
          margin: 0;
          color: #06251f;
          font-size: 29px;
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -1px;
        }

        .panelTop p {
          margin: 8px 0 0;
          color: #536579;
          font-size: 14px;
          line-height: 1.45;
          font-weight: 700;
        }

        .filterBar {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) 190px auto auto;
          gap: 10px;
          padding: 10px;
          border: 1px solid #dbe7e2;
          border-radius: 20px;
          background: #f8fbfa;
        }

        .filterBar label {
          display: flex;
          flex-direction: column;
          gap: 5px;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .filterBar input,
        .filterBar select {
          width: 100%;
          height: 42px;
          padding: 0 12px;
          border: 1px solid #d6e5df;
          border-radius: 13px;
          background: #ffffff;
          color: #0f172a;
          font-weight: 750;
          outline: none;
        }

        .filterBar input:focus,
        .filterBar select:focus {
          border-color: #10a37f;
          box-shadow: 0 0 0 4px rgba(16, 163, 127, .11);
        }

        .filterBar button,
        .filterBar a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 15px;
          border-radius: 13px;
          border: 1px solid #d6e5df;
          background: #ffffff;
          color: #0f172a;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
        }

        .filterBar button {
          border-color: #10a37f;
          background: #10a37f;
          color: #ffffff;
          box-shadow: 0 10px 20px rgba(16, 163, 127, .22);
        }

        .bucketNav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }

        .bucket {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 43px;
          padding: 0 14px;
          border: 1px solid #dbe7e2;
          border-radius: 999px;
          background: #ffffff;
          color: #172033;
          text-decoration: none;
          font-weight: 950;
          box-shadow: 0 8px 18px rgba(15, 23, 42, .045);
        }

        .bucket small {
          display: none;
        }

        .bucket em,
        .bucket b,
        .bucket strong + span,
        .bucket span:last-child {
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
          font-style: normal;
        }

        .bucket.active {
          border-color: #10a37f;
          background: #10a37f;
          color: #ffffff;
          box-shadow: 0 12px 24px rgba(16, 163, 127, .24);
        }

        .bucket.active span:last-child {
          background: rgba(255,255,255,.18);
          color: #ffffff;
        }

        .emptyState,
        .mailEmpty {
          padding: 16px;
          border: 1px dashed #cbded8;
          border-radius: 18px;
          background: #f8fbfa;
          color: #64748b;
          font-weight: 800;
        }

        .emailRow {
          display: grid;
          grid-template-columns: minmax(260px, 1.1fr) minmax(220px, .9fr) 140px auto;
          gap: 14px;
          align-items: center;
          padding: 14px;
          border: 1px solid #e2ebe7;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(15, 23, 42, .045);
        }

        .emailRow + .emailRow {
          margin-top: 10px;
        }

        .emailRow strong {
          color: #10231f;
          font-weight: 900;
        }

        .emailRow small {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-weight: 750;
        }

        /* REVIEW ORDERS */
        .orderReviewPanel {
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          box-shadow: none;
        }

        .orderReviewHeader {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid #dbe7e2;
        }

        .orderReviewHeader h2 {
          margin: 0;
          color: #06251f;
          font-size: 32px;
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -1.2px;
        }

        .orderReviewHeader p {
          margin: 8px 0 0;
          color: #536579;
          font-size: 14px;
          font-weight: 700;
        }

        .orderReviewSummary {
          display: flex;
          align-items: baseline;
          gap: 8px;
          color: #536579;
          font-weight: 850;
        }

        .orderReviewSummary strong {
          color: #06251f;
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
        }

        .orderCards {
          display: grid;
          gap: 16px;
        }

        .orderCard {
          position: relative;
          overflow: hidden;
          padding: 20px;
          border: 1px solid #dbe7e2;
          border-radius: 26px;
          background: #ffffff;
          box-shadow: 0 22px 52px rgba(15, 23, 42, .075);
        }

        .orderCard::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 6px;
          background: #10a37f;
        }

        .orderCardTop {
          display: grid;
          grid-template-columns: minmax(300px, 1fr) auto;
          gap: 18px;
          align-items: start;
          margin-bottom: 16px;
        }

        .orderCardNumber {
          color: #64748b;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .orderCard h3 {
          margin: 5px 0 4px;
          color: #06251f;
          font-size: 24px;
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -.7px;
        }

        .orderCardContact {
          color: #536579;
          font-size: 14px;
          font-weight: 800;
        }

        .orderCardDate {
          min-width: 132px;
          padding: 14px;
          border: 1px solid #dbe7e2;
          border-radius: 18px;
          background: #f8fbfa;
          text-align: right;
        }

        .orderCardDate strong {
          display: block;
          color: #06251f;
          font-size: 17px;
          font-weight: 950;
        }

        .orderCardDate span {
          display: block;
          margin-top: 4px;
          color: #536579;
          font-size: 13px;
          font-weight: 850;
        }

        .orderCardBody {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 250px;
          gap: 22px;
          align-items: stretch;
        }

        .orderCardItems {
          padding: 14px 0 0;
          border-top: 1px solid #eef3f1;
        }

        .orderCardItemsTitle {
          margin-bottom: 8px;
          color: #0f9f7a;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .orderCardItems ul {
          display: grid;
          gap: 7px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .orderCardItems li {
          display: flex;
          gap: 10px;
          color: #0f172a;
          font-size: 14px;
          font-weight: 750;
        }

        .orderCardItems li strong {
          min-width: 34px;
          color: #0f9f7a;
          font-weight: 950;
        }

        .orderCardMore {
          margin-top: 8px;
          color: #64748b;
          font-size: 13px;
          font-weight: 850;
        }

        .orderCardSide {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: stretch;
        }

        .orderCardTotal {
          padding: 16px;
          border: 1px solid #fed7aa;
          border-radius: 20px;
          background: #fff7ed;
          color: #9a3412;
        }

        .orderCardTotal strong {
          display: block;
          color: #06251f;
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -.8px;
        }

        .orderCardTotal span {
          display: block;
          margin-top: 7px;
          color: #b45309;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .orderCardTotal small {
          display: block;
          margin-top: 4px;
          color: #b45309;
          font-size: 11px;
          line-height: 1.25;
          font-weight: 900;
          text-transform: uppercase;
        }

        .orderCardBadges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .orderCardBadges span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border: 1px solid #dbe7e2;
          border-radius: 999px;
          background: #f8fbfa;
          color: #36534b;
          font-size: 12px;
          font-weight: 900;
        }

        .orderCardActions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid #eef3f1;
        }

        .orderCardActions a,
        .orderCardActions button,
        .emailRow a,
        .emailRow button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border: 1px solid #d6e5df;
          border-radius: 13px;
          background: #ffffff;
          color: #0f172a;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
        }

        .orderCardActions a:first-child,
        .emailRow a {
          border-color: #10a37f;
          background: #10a37f;
          color: #ffffff;
          box-shadow: 0 10px 20px rgba(16, 163, 127, .22);
        }

        .orderCardActions button,
        .emailRow button {
          color: #991b1b;
          border-color: #fecaca;
          background: #fff1f2;
        }

        @media (max-width: 1100px) {
          .inboxHero,
          .panelTop,
          .orderCardTop,
          .orderCardBody {
            grid-template-columns: 1fr;
          }

          .filterBar {
            grid-template-columns: 1fr 1fr;
          }

          .compactStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .orderCardDate {
            text-align: left;
          }
        }

        @media (max-width: 720px) {
          .inboxPage {
            padding: 0 14px 34px;
          }

          .inboxHero,
          .inboxPanel,
          .orderCard {
            border-radius: 20px;
            padding: 18px;
          }

          .inboxHero h1 {
            font-size: 30px;
          }

          .compactStats,
          .filterBar {
            grid-template-columns: 1fr;
          }

          .orderReviewHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .emailRow {
            grid-template-columns: 1fr;
          }

          .orderCardActions {
            justify-content: stretch;
            flex-direction: column;
          }
        }
      
        /* gastario-simple-ops-final-20260708 */

        .inboxPage {
          max-width: 1220px !important;
          padding: 0 24px 44px !important;
        }

        .inboxHero {
          min-height: auto !important;
          padding: 18px 22px !important;
          margin-bottom: 12px !important;
          border-radius: 18px !important;
          border: 1px solid #dbe7e2 !important;
          background: #ffffff !important;
          box-shadow: 0 10px 28px rgba(15, 23, 42, .045) !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          gap: 16px !important;
        }

        .inboxHero::before,
        .inboxHero::after {
          display: none !important;
        }

        .inboxHero h1 {
          margin: 0 !important;
          font-size: 28px !important;
          line-height: 1.1 !important;
          letter-spacing: -1px !important;
          font-weight: 900 !important;
          color: #071f1b !important;
        }

        .inboxHero p {
          margin: 5px 0 0 !important;
          font-size: 14px !important;
          color: #64748b !important;
          font-weight: 650 !important;
        }

        .inboxOverline {
          font-size: 11px !important;
          letter-spacing: .12em !important;
          color: #0f9f7a !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
        }

        .heroActions {
          display: flex !important;
          gap: 8px !important;
        }

        .heroActions button {
          min-height: 38px !important;
          padding: 0 14px !important;
          border-radius: 11px !important;
          font-size: 13px !important;
          font-weight: 850 !important;
          box-shadow: none !important;
        }

        .liveInfo {
          margin: 0 0 10px !important;
          padding-left: 2px !important;
          font-size: 12.5px !important;
          color: #64748b !important;
          font-weight: 700 !important;
        }

        .compactStats {
          display: flex !important;
          gap: 8px !important;
          margin: 0 0 14px !important;
        }

        .statCard {
          flex: 1 !important;
          min-height: 58px !important;
          padding: 10px 13px !important;
          border-radius: 14px !important;
          border: 1px solid #dbe7e2 !important;
          background: #ffffff !important;
          box-shadow: 0 8px 20px rgba(15, 23, 42, .035) !important;
        }

        .statCard.active {
          background: #10a37f !important;
          border-color: #10a37f !important;
          box-shadow: none !important;
        }

        .statCard span {
          font-size: 12px !important;
          font-weight: 850 !important;
        }

        .statCard strong {
          font-size: 21px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
        }

        .statCard small {
          font-size: 11px !important;
          font-weight: 700 !important;
        }

        .inboxPanel {
          padding: 18px !important;
          margin-bottom: 24px !important;
          border-radius: 18px !important;
          border: 1px solid #dbe7e2 !important;
          background: #ffffff !important;
          box-shadow: 0 10px 28px rgba(15, 23, 42, .045) !important;
        }

        .panelTop {
          display: grid !important;
          grid-template-columns: 1fr minmax(520px, 620px) !important;
          gap: 16px !important;
          align-items: start !important;
          margin-bottom: 14px !important;
        }

        .panelTop h2 {
          margin: 0 !important;
          font-size: 24px !important;
          line-height: 1.1 !important;
          font-weight: 900 !important;
          letter-spacing: -.7px !important;
        }

        .panelTop p {
          margin: 5px 0 0 !important;
          font-size: 13px !important;
          color: #64748b !important;
          font-weight: 650 !important;
        }

        .filterBar {
          display: grid !important;
          grid-template-columns: 1fr 170px auto auto !important;
          gap: 8px !important;
          padding: 8px !important;
          border-radius: 14px !important;
          border: 1px solid #dbe7e2 !important;
          background: #f8fbfa !important;
        }

        .filterBar input,
        .filterBar select {
          height: 38px !important;
          border-radius: 10px !important;
        }

        .filterBar button,
        .filterBar a {
          min-height: 38px !important;
          border-radius: 10px !important;
          font-weight: 850 !important;
        }

        .bucketNav {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 8px !important;
          margin-bottom: 12px !important;
        }

        .bucket {
          min-height: 36px !important;
          padding: 0 12px !important;
          border-radius: 999px !important;
          font-size: 13px !important;
          box-shadow: none !important;
        }

        .bucket small {
          display: none !important;
        }

        .orderReviewPanel {
          background: transparent !important;
          border: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
        }

        .orderReviewHeader {
          margin-bottom: 12px !important;
          padding-bottom: 10px !important;
          border-bottom: 1px solid #dbe7e2 !important;
        }

        .orderReviewHeader h2 {
          margin: 0 !important;
          font-size: 27px !important;
          line-height: 1.1 !important;
          font-weight: 900 !important;
          letter-spacing: -.8px !important;
        }

        .orderReviewHeader p {
          margin-top: 5px !important;
          font-size: 13px !important;
          color: #64748b !important;
          font-weight: 650 !important;
        }

        .orderCard {
          padding: 18px !important;
          border-radius: 18px !important;
          border: 1px solid #dbe7e2 !important;
          background: #ffffff !important;
          box-shadow: 0 10px 28px rgba(15, 23, 42, .045) !important;
        }

        .orderCard h3 {
          font-size: 21px !important;
          font-weight: 900 !important;
          letter-spacing: -.5px !important;
        }

        .orderCardBody {
          grid-template-columns: minmax(0, 1fr) 220px !important;
          gap: 16px !important;
        }

        .orderCardPrice {
          display: flex !important;
          flex-direction: column !important;
          gap: 5px !important;
          padding: 14px !important;
          border-radius: 15px !important;
          border: 1px solid #fed7aa !important;
          background: #fff7ed !important;
          min-width: 210px !important;
        }

        .orderCardPrice strong {
          display: block !important;
          font-size: 25px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
          color: #071f1b !important;
          white-space: nowrap !important;
        }

        .orderCardPrice span,
        .orderCardPrice small {
          display: block !important;
          font-size: 11px !important;
          line-height: 1.25 !important;
          font-weight: 850 !important;
          color: #b45309 !important;
          text-transform: uppercase !important;
        }

        @media (max-width: 1000px) {
          .inboxHero,
          .panelTop,
          .filterBar,
          .orderCardBody {
            grid-template-columns: 1fr !important;
            display: grid !important;
          }

          .compactStats {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
`}</style>
</AppLayout>
  );
}






























