import { GastarioStack } from "../components/ui";
import { GastarioDetailDialog } from "../components/ui";
import { GastarioDetailTabs } from "../components/ui";
import { GastarioDetailPane } from "../components/ui";
import { GastarioTabs } from "../components/ui";
import { GastarioCheckRow } from "../components/ui";
import { GastarioDataList, GastarioDataRow, GastarioEmptyState, GastarioToolbar } from "../components/ui";
import { GastarioPage, GastarioHeader, GastarioNotice, GastarioMetricGrid, GastarioMetric, GastarioSection, GastarioFilterBar, GastarioField, GastarioInput, GastarioSelect, gastarioButtonClass } from "../components/ui";
import {
  useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import {
  classifyIncomingEmail,
} from "../lib/incoming-email-classification";

import { Form, Link, redirect, useActionData, useFetcher, useLoaderData,
  useSearchParams,
} from "react-router";


const EMAIL_BUCKETS = [
  { key: "orders", label: "Bestätigungen", help: "Sichere Auftragsbestätigungen" },
  { key: "possible", label: "Unklar", help: "E-Mails prüfen" },
  { key: "inquiries", label: "Anfragen", help: "Angebote vorbereiten" },
  { key: "reminders", label: "Lieferscheine", help: "Morgen-/Lieferhinweise" },
  { key: "other", label: "Sonstiges", help: "Absagen, Werbung, Belege" },
  { key: "hidden", label: "Ausgeblendet", help: "Manuell ausgeblendet" },
  { key: "all", label: "Alle", help: "Alle ungeprüften E-Mails" },
];

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
          ...(status === "CONFIRMED"
            ? {
                status: {
                  in: [
                    "CONFIRMED",
                    "IN_PRODUCTION",
                    "PACKING_OPEN",
                    "DELIVERED",
                  ] as any,
                },
              }
            : status === "REJECTED"
              ? {
                  status: "REJECTED" as any,
                }
              : {
                  status: {
                    in: [
                      "AUTO_CREATED",
                      "REVIEW_NEEDED",
                      "INCOMPLETE",
                      "POSSIBLE_DUPLICATE",
                    ] as any,
                  },
                }),
          ...(searchQuery
            ? {
                OR: [
                  {
                    customerName: {
                      contains: searchQuery,
                      mode: "insensitive",
                    },
                  },
                  {
                    orderNumber: {
                      contains: searchQuery,
                      mode: "insensitive",
                    },
                  },
                  {
                    externalOrderNumber: {
                      contains: searchQuery,
                      mode: "insensitive",
                    },
                  },
                  {
                    platformReference: {
                      contains: searchQuery,
                      mode: "insensitive",
                    },
                  },
                  {
                    contactName: {
                      contains: searchQuery,
                      mode: "insensitive",
                    },
                  },
                  {
                    items: {
                      some: {
                        name: {
                          contains: searchQuery,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
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
            status: {
              in: [
                "AUTO_CREATED",
                "REVIEW_NEEDED",
              ] as any,
            },
          },
        }),
        prisma.order.count({
          where: {
            tenantId: tenantUser.tenantId,
            status: {
              in: [
                "CONFIRMED",
                "IN_PRODUCTION",
                "PACKING_OPEN",
                "DELIVERED",
              ] as any,
            },
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

    try {
      const response = await fetch(runUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        const message =
          result?.error ||
          (Array.isArray(result?.errors) && result.errors.length > 0
            ? result.errors.join(" | ")
            : "Der E-Mail-Abruf ist fehlgeschlagen.");

        return {
          error: message,
          importResult: result,
        };
      }

      if (Array.isArray(result.errors) && result.errors.length > 0) {
        return {
          error:
            "Der Abruf wurde mit Fehlern beendet: " +
            result.errors.join(" | "),
          importResult: result,
        };
      }

      return {
        success:
          "E-Mail-Abruf abgeschlossen: " +
          Number(result.checked || 0) +
          " geprüft, " +
          Number(result.savedEmails || 0) +
          " gespeichert, " +
          Number(result.createdOrders || 0) +
          " Aufträge erstellt.",
        importResult: result,
      };
    } catch (error: any) {
      return {
        error:
          "Der E-Mail-Abruf konnte nicht gestartet werden: " +
          String(error?.message || error),
      };
    }
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

  if (intent === "confirmOrder") {
    const orderId = String(
      formData.get("orderId") || ""
    ).trim();

    if (!orderId) {
      return { error: "Auftrag fehlt." };
    }

    const requiredReviewChecks = [
      "customerChecked",
      "addressChecked",
      "scheduleChecked",
      "itemsChecked",
      "billingChecked",
    ];

    const missingReviewChecks =
      requiredReviewChecks.filter(
        (fieldName) =>
          String(formData.get(fieldName) || "") !== "1"
      );

    if (missingReviewChecks.length > 0) {
      return {
        error:
          "Bitte bestätige alle fünf Prüfpunkte, bevor du den Auftrag übernimmst.",
      };
    }

    const requestedBillingMode = String(
      formData.get("billingMode") || "UNDECIDED"
    )
      .trim()
      .toUpperCase();

    const billingConfiguration: Record<
      string,
      {
        billingMode: string;
        billingStatus: string;
      }
    > = {
      DIRECT_INVOICE: {
        billingMode: "DIRECT_INVOICE",
        billingStatus: "READY_TO_INVOICE",
      },
      EXTERNAL_INVOICE: {
        billingMode: "EXTERNAL_INVOICE",
        billingStatus: "INVOICED_EXTERNALLY",
      },
      PLATFORM_CREDIT: {
        billingMode: "PLATFORM_CREDIT",
        billingStatus: "WAITING_FOR_CREDIT",
      },
      NO_INVOICE: {
        billingMode: "NO_INVOICE",
        billingStatus: "NOT_RELEVANT",
      },
    };

    const billingSelection =
      billingConfiguration[requestedBillingMode];

    if (!billingSelection) {
      return {
        error:
          "Bitte wähle eine verbindliche Abrechnungsart aus.",
      };
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: tenantUser.tenantId,
      },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!order) {
      return {
        error: "Der Auftrag wurde nicht gefunden.",
      };
    }

    const missingOrderData: string[] = [];

    if (
      !String(
        order.customer?.name ||
          order.customerName ||
          ""
      ).trim()
    ) {
      missingOrderData.push("Kundendaten");
    }

    if (!order.deliveryDate) {
      missingOrderData.push("Lieferdatum");
    }

    if (!String(order.deliveryTimeText || "").trim()) {
      missingOrderData.push("Lieferzeit");
    }

    if (!String(order.deliveryAddress || "").trim()) {
      missingOrderData.push("Lieferadresse");
    }

    if (
      !Array.isArray(order.items) ||
      order.items.length === 0
    ) {
      missingOrderData.push("Positionen");
    }

    if (missingOrderData.length > 0) {
      return {
        error:
          "Der Auftrag kann noch nicht übernommen werden. Es fehlen: " +
          missingOrderData.join(", ") +
          ".",
      };
    }

    if (
      ![
        "AUTO_CREATED",
        "REVIEW_NEEDED",
      ].includes(String(order.status || ""))
    ) {
      return {
        error:
          "Dieser Auftrag wurde bereits bearbeitet oder übernommen.",
      };
    }

    const updateResult =
      await prisma.order.updateMany({
        where: {
          id: orderId,
          tenantId: tenantUser.tenantId,
          status: {
            in: [
              "AUTO_CREATED",
              "REVIEW_NEEDED",
            ] as any,
          },
        },
        data: {
          status: "CONFIRMED" as any,
          billingMode:
            billingSelection.billingMode as any,
          billingStatus:
            billingSelection.billingStatus as any,
        },
      });

    if (updateResult.count !== 1) {
      return {
        error:
          "Der Auftrag konnte nicht übernommen werden. Bitte lade die Seite neu.",
      };
    }

    try {
      const {
        ensureProductsForOrder,
      } = await import(
        "../lib/order-products.server"
      );

      await ensureProductsForOrder(
        orderId,
        tenantUser.tenantId
      );

      const {
        ensureDeliveryNoteForOrder,
      } = await import(
        "../lib/delivery-note.server"
      );

      await ensureDeliveryNoteForOrder(orderId);
    } catch (error) {
      console.error(
        "Nachbearbeitung des übernommenen Auftrags fehlgeschlagen:",
        error
      );

      return {
        error:
          "Der Auftrag wurde übernommen, aber Produkte oder Lieferschein konnten nicht vollständig vorbereitet werden.",
      };
    }

    if (
      billingSelection.billingMode ===
      "DIRECT_INVOICE"
    ) {
      return redirect(
        "/rechnungen/neu?orderId=" +
          encodeURIComponent(orderId)
      );
    }

    return redirect(
      "/auftragseingang?dateRange=last7&emailCategory=orders&status=AUTO_CREATED"
    );
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
/* gastario-repair-broken-email-utf8-20260722 */
function repairBrokenEmailText(value: unknown) {
  let current = String(value ?? "");

  if (!current || !/[ÃÂâð�]/.test(current)) {
    return current;
  }

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!/[ÃÂâð�]/.test(current)) break;

      const bytes = Uint8Array.from(
        Array.from(current).map(
          (character) => character.charCodeAt(0) & 0xff
        )
      );

      const repaired = new TextDecoder("utf-8").decode(bytes);

      if (!repaired || repaired === current) break;

      current = repaired;
    }
  } catch {
    return String(value ?? "");
  }

  return current;
}
export default function AuftragseingangPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const importFetcher = useFetcher();
  const [liveEnabled, setLiveEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(
      "gastario-email-live-enabled"
    ) === "true";
  });

  const [lastAutoImportAt, setLastAutoImportAt] =
    useState<string>(() => {
      if (typeof window === "undefined") {
        return "";
      }

      return (
        window.localStorage.getItem(
          "gastario-email-last-import-at"
        ) || ""
      );
    });

  const [isImportingNow, setIsImportingNow] =
    useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      "gastario-email-live-enabled",
      String(liveEnabled)
    );
  }, [liveEnabled]);

  useEffect(() => {
    if (importFetcher.state !== "idle") {
      setIsImportingNow(true);
      return;
    }

    setIsImportingNow(false);

    const result: any = importFetcher.data;

    if (result?.success) {
      const importedAt =
        new Date().toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        });

      setLastAutoImportAt(importedAt);

      window.localStorage.setItem(
        "gastario-email-last-import-at",
        importedAt
      );

      const reloadTimer = window.setTimeout(() => {
        window.location.reload();
      }, 900);

      return () => window.clearTimeout(reloadTimer);
    }
  }, [importFetcher.state, importFetcher.data]);

  function runEmailImportAndReload() {
    if (isImportingNow || importFetcher.state !== "idle") return;

    const formData = new FormData();
    formData.set("intent", "runEmailImportNow");

    importFetcher.submit(formData, {
      method: "post",
      action: "/auftragseingang",
    });
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

    const normalizedOrderStatus = String(order?.status || "").toUpperCase();

     /*
      * Der UI-Filter "Zu prüfen" verwendet AUTO_CREATED,
     * umfasst fachlich aber auch REVIEW_NEEDED.
     */
    const isReviewStatusFilter =
      activeOrderStatus === "AUTO_CREATED";

    if (
      isReviewStatusFilter &&
      ![
        "AUTO_CREATED",
        "REVIEW_NEEDED",
      ].includes(normalizedOrderStatus)
    ) {
      return false;
    }

    if (
      activeOrderStatus === "CONFIRMED" &&
      ![
        "CONFIRMED",
        "IN_PRODUCTION",
        "PACKING_OPEN",
        "DELIVERED",
      ].includes(normalizedOrderStatus)
    ) {
      return false;
    }

    if (
      activeOrderStatus &&
      activeOrderStatus !== "CONFIRMED" &&
      !isReviewStatusFilter &&
      normalizedOrderStatus !== activeOrderStatus
    ) {
      return false;
    }

    if (!order.deliveryDate) return true;

    const deliveryDate = new Date(order.deliveryDate);

    if (Number.isNaN(deliveryDate.getTime())) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return deliveryDate >= today;
  });

  /*
   * Nur echte vergangene Catering-Aufträge zählen.
   * Suchfilter, Statusfilter, Müllimporte und defekte automatische
   * Datensätze dürfen nicht als vergangene Aufträge erscheinen.
   */
  const hiddenPastOrderCount =
    sortedOrders.filter((order: any) => {
      if (isLikelyTrashImportOrder(order)) return false;
      if (isLikelyBrokenAutomaticOrder(order)) return false;

      const status = String(order?.status || "").toUpperCase();

      if (
        status === "REJECTED" ||
        status === "CANCELLED"
      ) {
        return false;
      }

      if (!order?.deliveryDate) return false;

      const deliveryDate = new Date(order.deliveryDate);

      if (Number.isNaN(deliveryDate.getTime())) {
        return false;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return deliveryDate < today;
    }).length;
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
      customerName !== "kunde unbekannt" &&
      customerName !== "kunde prüfen" &&
      customerName !== "kunde pruefen";

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
      customerName === "kunde unbekannt" ||
      customerName === "kunde prüfen" ||
      customerName === "kunde pruefen";

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

  function isLikelyBrokenAutomaticOrder(order: any) {
    const status = String(order?.status || "").toUpperCase();

    if (
      status !== "AUTO_CREATED" &&
      status !== "REVIEW_NEEDED"
    ) {
      return false;
    }

    const customerName = String(
      order?.customerName ||
      order?.customer?.name ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (!customerName) {
      return true;
    }

    const companySignals = [
      "gmbh",
      " ug",
      " ag",
      " se",
      " kg",
      " e.v",
      " berlin",
      "deutschland",
      "holding",
      "group",
      "company",
      "studio",
      "services",
    ];

    if (
      companySignals.some((signal) =>
        customerName.includes(signal)
      )
    ) {
      return false;
    }

    const ignoredWords = new Set([
      "mit",
      "und",
      "oder",
      "der",
      "die",
      "das",
      "dem",
      "den",
      "ein",
      "eine",
      "einer",
      "vom",
      "von",
      "auf",
      "in",
      "am",
      "zum",
      "zur",
      "vegan",
      "vegetarisch",
    ]);

    function getMeaningfulWords(value: string) {
      return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(
          (word) =>
            word.length >= 4 &&
            !ignoredWords.has(word)
        );
    }

    const customerWords =
      getMeaningfulWords(customerName);

    if (customerWords.length === 0) {
      return true;
    }

    const items = Array.isArray(order?.items)
      ? order.items
      : [];

    const matchesFoodPosition = items.some(
      (item: any) => {
        const itemWords = new Set(
          getMeaningfulWords(item?.name)
        );

        const sharedWords =
          customerWords.filter((word) =>
            itemWords.has(word)
          );

        return sharedWords.length >= 2;
      }
    );

    const looksLikeSentenceOrDish =
      /[.!?]$/.test(customerName) ||
      customerName.split(/\s+/).length >= 4;

    return (
      matchesFoodPosition ||
      looksLikeSentenceOrDish
    );
  }
  const metricOrders = sortedOrders.filter((order: any) => {
    if (isLikelyTrashImportOrder(order)) return false;
    if (isLikelyBrokenAutomaticOrder(order)) return false;

    const metricCustomerName = String(
      order?.customerName ||
      order?.customer?.name ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (
      !metricCustomerName ||
      metricCustomerName === "kunde prüfen" ||
      metricCustomerName === "kunde pruefen" ||
      metricCustomerName === "kunde unbekannt" ||
      metricCustomerName === "e-mail import" ||
      metricCustomerName === "email import"
    ) {
      return false;
    }

    if (!Array.isArray(order?.items) || order.items.length === 0) {
      return false;
    }

    if (!order.deliveryDate) return false;

    const deliveryDate = new Date(order.deliveryDate);

    if (Number.isNaN(deliveryDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return deliveryDate >= today;
  });

  const currentOrderStats = {
    all: metricOrders.length,

    review: metricOrders.filter((order: any) =>
      ["AUTO_CREATED", "REVIEW_NEEDED"].includes(
        String(order.status || "").toUpperCase()
      )
    ).length,

    confirmed: metricOrders.filter(
      (order: any) =>
        String(order.status || "").toUpperCase() === "CONFIRMED"
    ).length,

    rejected: metricOrders.filter(
      (order: any) =>
        String(order.status || "").toUpperCase() === "REJECTED"
    ).length,
  };

  /* gastario-url-selected-order-fix-20260713 */
  const [selectedOrderSearchParams, setSelectedOrderSearchParams] =
    useSearchParams();

  const selectedOrderId =
    selectedOrderSearchParams.get("selectedOrder") || null;

  const [selectedOrderDetailTab, setSelectedOrderDetailTab] =
    useState("overview");

  useEffect(() => {
    setSelectedOrderDetailTab("overview");
  }, [selectedOrderId]);

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
      

      {/* gastario-incoming-page-shell-reference-20260716 */}
      <GastarioPage>

        <GastarioHeader
          eyebrow="Eingang"
          title="Auftragseingang"
          description={
            <>
              {data.tenant?.name || "Kein Mandant"}
              {" · "}
              Eingehende Aufträge und E-Mails prüfen, bearbeiten und übernehmen.
            </>
          }
          actions={
            <>
              <button
                type="button"
                className={gastarioButtonClass(
                  liveEnabled
                    ? "primary"
                    : "secondary"
                )}
                onClick={() =>
                  setLiveEnabled((value) => !value)
                }
                title={
                  lastAutoImportAt
                    ? "Letzter Auto-Abruf: " +
                      lastAutoImportAt
                    : "Automatischer Abruf"
                }
              >
                {liveEnabled ? "Live an" : "Live aus"}
              </button>

              <Link
                to="/import-pruefen"
                className={gastarioButtonClass("secondary")}
              >
                Dokument importieren
              </Link>

              <button
                type="button"
                className={gastarioButtonClass("primary")}
                onClick={runEmailImportAndReload}
                disabled={
                  isImportingNow ||
                  importFetcher.state !== "idle"
                }
              >
                {isImportingNow ||
                importFetcher.state !== "idle"
                  ? "Abruf läuft..."
                  : "E-Mails abrufen"}
              </button>
            </>
          }
        />


        {data.setupError ? (
          <GastarioNotice type="warning">
            {data.setupError}
          </GastarioNotice>
        ) : null}


        {actionData?.success ||
        (importFetcher.data as any)?.success ? (
          <GastarioNotice type="success">
            {actionData?.success ||
              (importFetcher.data as any)?.success}
          </GastarioNotice>
        ) : null}


        {actionData?.error ||
        (importFetcher.data as any)?.error ? (
          <GastarioNotice type="danger">
            {actionData?.error ||
              (importFetcher.data as any)?.error}
          </GastarioNotice>
        ) : null}


        <GastarioMetricGrid>

          <GastarioMetric
            label="Aufträge gesamt"
            value={currentOrderStats.all}
            description="Im Auftragseingang"
          />

          <GastarioMetric
            label="Zu prüfen"
            value={currentOrderStats.review}
            description="Noch nicht übernommen"
          />

          <GastarioMetric
            label="Übernommen"
            value={currentOrderStats.confirmed}
            description="Für die Ausführung bestätigt"
          />

          <GastarioMetric
            label="Anfragen"
            value={data.emailBuckets?.inquiries || 0}
            description="Angebote und Rückfragen"
          />

        </GastarioMetricGrid>


        <GastarioSection
          eyebrow="Eingangsübersicht"
          title={inboxHeadline}
          description={inboxSubtitle}
        >

          <Form method="get">

            <GastarioFilterBar
              actions={
                <>
                  <button
                    type="submit"
                    className={gastarioButtonClass("primary")}
                  >
                    Anzeigen
                  </button>

                  <Link
                    to="/auftragseingang"
                    className={gastarioButtonClass("secondary")}
                  >
                    Zurücksetzen
                  </Link>
                </>
              }
            >

              <GastarioField label="Suche">
                <GastarioInput
                  type="search"
                  name="q"
                  defaultValue={data.searchQuery || ""}
                  placeholder="Absender, Kunde, Nummer oder Betreff"
                />
              </GastarioField>


              <GastarioField label="Zeitraum">
                <GastarioSelect
                  name="dateRange"
                  defaultValue={data.dateRange || "last7"}
                >
                  <option value="last7">
                    Letzte 7 Tage
                  </option>
                  <option value="today">
                    Heute
                  </option>
                  <option value="yesterday">
                    Gestern
                  </option>
                </GastarioSelect>
              </GastarioField>


              <GastarioField label="Kategorie">
                <GastarioSelect
                  name="emailCategory"
                  defaultValue={
                    data.selectedEmailCategory ||
                    "orders"
                  }
                >
                  <option value="orders">
                    Aufträge
                  </option>

                  <option value="inquiries">
                    Anfragen / Leads
                  </option>

                  <option value="possible">
                    Unklare E-Mails
                  </option>

                  <option value="hidden">
                    Ignorierte E-Mails
                  </option>
                </GastarioSelect>
              </GastarioField>


              <GastarioField label="Status">
                <GastarioSelect
                  name="status"
                  defaultValue={
                    activeOrderStatus || ""
                  }
                  disabled={isEmailFocusedView}
                >
                  <option value="">
                    Alle Aufträge
                  </option>

                  <option value="AUTO_CREATED">
                    Zu prüfen
                  </option>

                  <option value="CONFIRMED">
                    Übernommen
                  </option>

                  <option value="REJECTED">
                    Abgelehnt
                  </option>
                </GastarioSelect>
              </GastarioField>

            </GastarioFilterBar>

          </Form>

{/* gastario-restored-email-focused-view-20260713 */}
        {isEmailFocusedView ? (

          <GastarioSection
            eyebrow="E-Mail-Eingang"
            title={inboxHeadline}
            description={
              `${inboxSubtitle} · ${
                sortedEmails.length === 1
                  ? "1 Eingang"
                  : `${sortedEmails.length} Eingänge`
              }`
            }
          >

            {sortedEmails.length === 0 ? (

              <GastarioEmptyState title="Keine passenden E-Mails">
                In dieser Ansicht wurden keine passenden Eingänge gefunden.
              </GastarioEmptyState>

            ) : (

              <GastarioDataList>

                {sortedEmails.map((mail: any) => {

                  const extracted =
                    mail.extractedJson || {};

                  const aiDecision =
                    extracted.aiDecision || {};

                  const bodyPreview =
                    repairBrokenEmailText(
                      String(mail.bodyText || "")
                        .replace(/\s+/g, " ")
                        .trim()
                        .slice(0, 260)
                    );

                  const receivedAt =
                    mail.receivedAt
                      ? new Date(mail.receivedAt)
                      : null;

                  const sender =
                    mail.fromName ||
                    mail.fromAddress ||
                    mail.fromEmail ||
                    mail.sender ||
                    "Absender unbekannt";

                  const categoryLabel =
                    isInquiryView
                      ? "Anfrage"
                      : isReviewMailView
                        ? "Unklar"
                        : isIgnoredMailView
                          ? "Ignoriert"
                          : emailCategoryLabel(
                              classifyIncomingEmail(mail)
                            );

                  return (

                    <GastarioDataRow key={mail.id}>

                      <div className="g-ui-data-row-main">

                        <strong className="g-ui-data-row-title">
                          {mail.subject || "Ohne Betreff"}
                        </strong>

                        <span className="g-ui-data-row-description">
                          {String(sender)}
                        </span>

                        <span className="g-ui-data-row-description">
                          {bodyPreview ||
                            "Kein Mailtext gespeichert."}
                        </span>

                        {aiDecision?.mailType ? (

                          <span className="g-ui-data-row-description">
                            KI: {aiDecision.mailType}
                            {" · "}
                            {Math.round(
                              Number(
                                aiDecision.confidence || 0
                              ) * 100
                            )}
                            {" % · "}
                            {repairBrokenEmailText(
                              aiDecision.reason ||
                                "Keine Begründung gespeichert"
                            )}
                          </span>

                        ) : null}

                        <GastarioToolbar align="start">

                          <Link
                            to={
                              "/email-pruefung/" +
                              mail.id
                            }
                            className={
                              gastarioButtonClass(
                                "primary"
                              )
                            }
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
                                className={
                                  gastarioButtonClass(
                                    "secondary"
                                  )
                                }
                              >
                                Ausblenden
                              </button>

                            </Form>

                          ) : null}

                        </GastarioToolbar>

                      </div>


                      <div className="g-ui-data-row-meta">

                        <span>
                          {categoryLabel}
                        </span>

                        <span>
                          {receivedAt &&
                          !Number.isNaN(
                            receivedAt.getTime()
                          )
                            ? receivedAt.toLocaleDateString(
                                "de-DE"
                              )
                            : "-"}
                        </span>

                      </div>

                    </GastarioDataRow>

                  );
                })}

              </GastarioDataList>

            )}

          </GastarioSection>

        ) : (
        <GastarioSection
          eyebrow="Aufträge"
          title={activeOrderViewTitle}
          description={
            `${activeOrderViewSubtitle} · ${
              visibleOrders.length
            } ${activeOrderViewCountLabel}`
          }
        >
          {visibleOrders.length === 0 ? (
            <GastarioEmptyState title="Keine Aufträge">
              {data.setupError
                ? data.setupError
                : "Keine Aufträge in dieser Ansicht."}
            </GastarioEmptyState>
          ) : (
            <>
              <GastarioDataList>
{visibleOrders.map((order: any, index: number) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  const totalInfo = getDisplayedOrderTotal(order);
                  const previewItems = items
                    .filter((item: any) => !String(item.name || "").toLowerCase().includes("fehlende position"))
                    .slice(0, 3);

                  return (
                    <GastarioDataRow
                      key={order.id}
                      className={
                        selectedOrder?.id === order.id
                          ? "is-selected"
                          : undefined
                      }
                      onClick={() =>
                        updateSelectedOrder(order.id)
                      }
                      onKeyDown={(event: any) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          updateSelectedOrder(order.id);
                        }
                      }}
                    >

                      <div className="g-ui-data-row-main">

                        <span className="g-ui-data-row-description">
                          {order.orderNumber}
                          {" · "}
                          {sourceLabel(order.source)}
                        </span>

                        <strong className="g-ui-data-row-title">
                          {order.customerName ||
                            order.customer?.name ||
                            "Kunde unbekannt"}
                        </strong>

                        <span className="g-ui-data-row-description">
                          {order.contactName ||
                            "Keine Kontaktperson erkannt"}
                        </span>


                        {previewItems.length > 0 ? (

                          <span className="g-ui-data-row-description">

                            {previewItems
                              .map(
                                (item: any) =>
                                  `${item.quantity || 1}× ${
                                    item.name || "Position"
                                  }`
                              )
                              .join(" · ")}

                            {items.length >
                            previewItems.length
                              ? ` · +${
                                  items.length -
                                  previewItems.length
                                } weitere`
                              : ""}

                          </span>

                        ) : null}

                      </div>


                      <div className="g-ui-data-row-meta">

                        <span>
                          {formatDate(order.deliveryDate)}
                        </span>

                        <span>
                          {order.deliveryTimeText ||
                            "Uhrzeit offen"}
                        </span>

                        <strong>
                          {formatImportCurrencyFromCents(
                            totalInfo.cents
                          )}
                        </strong>

                      </div>


                      <span
                        className="g-ui-data-row-chevron"
                        aria-hidden="true"
                      >
                        →
                      </span>

                    </GastarioDataRow>
                  );
                })}

                <GastarioToolbar align="start">
                  <span>Weitere Ergebnisse laden</span>
                </GastarioToolbar>
              </GastarioDataList>

              {selectedOrder ? (
              <GastarioDetailDialog
                open
                title="Auftrag prüfen"
                description={
                  [
                    selectedOrder.customer?.name ||
                      selectedOrder.customerName ||
                      "Kunde unbekannt",
                    selectedOrder.orderNumber,
                    selectedOrder.contactName,
                    sourceLabel(selectedOrder.source),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }
                footer={
                  <>
                    <button
                      type="button"
                      className={gastarioButtonClass("secondary")}
                      onClick={() => updateSelectedOrder(null)}
                    >
                      Schließen
                    </button>

                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="deleteOrder"
                      />
                      <input
                        type="hidden"
                        name="orderId"
                        value={selectedOrder.id}
                      />
                      <button
                        type="submit"
                        className={gastarioButtonClass("danger")}
                      >
                        Auftrag löschen
                      </button>
                    </Form>

                    {selectedOrderDetailTab === "review" ? (
                      <button
                        type="submit"
                        form="incoming-confirm-order-form"
                        className={gastarioButtonClass("primary")}
                      >
                        Auftrag bestätigen und übernehmen
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={gastarioButtonClass("primary")}
                        onClick={() => setSelectedOrderDetailTab("review")}
                      >
                        Zur Prüfung
                      </button>
                    )}
                  </>
                }
                onClose={() => updateSelectedOrder(null)}
              >
              <GastarioStack
                  key={selectedOrder.id}
                >

                  <GastarioDetailTabs
                    items={[
                      { id: "overview", label: "Übersicht" },
                      { id: "items", label: "Positionen" },
                      { id: "review", label: "Prüfung" },
                    ]}
                    activeId={selectedOrderDetailTab}
                    onChange={setSelectedOrderDetailTab}
                  />

                  <GastarioDetailPane active={selectedOrderDetailTab === "overview"}>
                    <GastarioSection
                      eyebrow="Auftragsübersicht"
                      title="Auftrag auf einen Blick"
                      description="Die wichtigsten Eckdaten vor der Übernahme."
                    >
                    <GastarioMetricGrid>

                      <GastarioMetric
                        label="Lieferung"
                        value={formatDate(
                          selectedOrder.deliveryDate
                        )}
                        description={
                          selectedOrder.deliveryTimeText ||
                          "Uhrzeit prüfen"
                        }
                      />

                      <GastarioMetric
                        label="Lieferadresse"
                        value={
                          selectedOrder.customer?.name ||
                          selectedOrder.customerName ||
                          "Kunde unbekannt"
                        }
                        description={
                          selectedOrder.deliveryAddress ||
                          "Adresse prüfen"
                        }
                      />

                      <GastarioMetric
                        label="Gesamt"
                        value={
                          selectedOrderTotal
                            ? formatImportCurrencyFromCents(
                                selectedOrderTotal.cents
                              )
                            : "-"
                        }
                        description={
                          selectedOrderTotal?.source ||
                          "Summe prüfen"
                        }
                      />

                    </GastarioMetricGrid>

                      <GastarioNotice type="neutral">
                        Prüfe danach die Positionen und anschließend die Pflichtprüfung.
                      </GastarioNotice>
                    </GastarioSection>
                  </GastarioDetailPane>


                  <GastarioDetailPane active={selectedOrderDetailTab === "items"}>
                  <GastarioSection
                    eyebrow="Auftragsinhalt"
                    title="Positionen"
                    description={
                      selectedOrderItems.length === 1
                        ? "1 Produkt"
                        : `${selectedOrderItems.length} Produkte`
                    }
                  >

                    {selectedOrderItems.length > 0 ? (

                      <GastarioDataList>

                        {selectedOrderItems.map(
                          (item: any, itemIndex: number) => (

                            <GastarioDataRow
                              key={
                                item.id ||
                                `${item.name || "position"}-${itemIndex}`
                              }
                            >

                              <div className="g-ui-data-row-main">

                                <strong className="g-ui-data-row-title">
                                  {item.name || "Position"}
                                </strong>

                                <span className="g-ui-data-row-description">
                                  {item.quantity || 1}
                                  {" × "}
                                  {item.name || "Position"}
                                </span>

                              </div>


                              <div className="g-ui-data-row-meta">

                                <strong>
                                  {formatImportCurrencyFromCents(
                                    Number(item.totalCents || 0)
                                  )}
                                </strong>

                              </div>

                            </GastarioDataRow>

                          )
                        )}

                      </GastarioDataList>

                    ) : (

                      <GastarioEmptyState title="Keine Positionen erkannt">
                        Auftrag bitte manuell kontrollieren.
                      </GastarioEmptyState>

                    )}


                    {selectedOrderTotal?.source === "vorläufig" ? (

                      <GastarioNotice type="warning">
                        Die Gesamtsumme ist vorläufig und muss vor der
                        Übernahme kontrolliert werden.
                      </GastarioNotice>

                    ) : null}

                  </GastarioSection>
                  </GastarioDetailPane>

                  <GastarioDetailPane active={selectedOrderDetailTab === "review"}>
                  <Form
                    id="incoming-confirm-order-form"
                    method="post"
                  >
                    <input
                      type="hidden"
                      name="intent"
                      value="confirmOrder"
                    />

                    <input
                      type="hidden"
                      name="orderId"
                      value={selectedOrder.id}
                    />
                    <GastarioSection
                      eyebrow="Abrechnung"
                      title="Wie soll der Auftrag abgerechnet werden?"
                    >

                      <GastarioField
                        label="Abrechnungsart"
                        required
                      >
                        <GastarioSelect
                          name="billingMode"
                          defaultValue={
                            selectedOrder.billingMode ||
                            "UNDECIDED"
                          }
                          required
                        >
                          <option value="UNDECIDED">
                            Noch nicht entschieden
                          </option>

                          <option value="DIRECT_INVOICE">
                            Direktrechnung an den Kunden
                          </option>

                          <option value="EXTERNAL_INVOICE">
                            Rechnung wurde extern erstellt
                          </option>

                          <option value="PLATFORM_CREDIT">
                            Plattform-Gutschrift
                          </option>

                          <option value="NO_INVOICE">
                            Keine Rechnung erforderlich
                          </option>
                        </GastarioSelect>
                      </GastarioField>

                    </GastarioSection>


                    <GastarioSection
                      eyebrow="Pflichtprüfung"
                      title="Vor der Übernahme kontrollieren"
                      description="Alle fünf Punkte müssen bestätigt werden."
                    >
                      <div className="g-ui-check-list">

                        <GastarioCheckRow
                          name="customerChecked"
                          title="Kundendaten geprüft"
                          description="Firmenname und Ansprechpartner stimmen."
                          required
                        />

                        <GastarioCheckRow
                          name="addressChecked"
                          title="Lieferadresse geprüft"
                          description="Straße, Hausnummer und Ort sind vollständig."
                          required
                        />

                        <GastarioCheckRow
                          name="scheduleChecked"
                          title="Datum und Uhrzeit geprüft"
                          description="Liefertermin und Zeitfenster sind korrekt."
                          required
                        />

                        <GastarioCheckRow
                          name="itemsChecked"
                          title="Positionen und Mengen geprüft"
                          description="Alle Speisen, Mengen und Preise stimmen."
                          required
                        />

                        <GastarioCheckRow
                          name="billingChecked"
                          title="Abrechnungsart geprüft"
                          description="Die spätere Rechnungsbearbeitung ist festgelegt."
                          required
                        />

                      </div>
                    </GastarioSection>

                    <GastarioNotice type="neutral">
                      <strong>
                        Bereit für die vollständige Prüfung?
                      </strong>
                      {" "}
                      Ohne vollständige Checkliste kann der Vorgang
                      nicht fortgesetzt werden.
                    </GastarioNotice>

                  </Form>
                  </GastarioDetailPane>

                </GastarioStack>
              </GastarioDetailDialog>
            ) : null}
          </>
          )}

          {hiddenPastOrderCount > 0 ? (
            <GastarioToolbar align="between">

              <span>
                {hiddenPastOrderCount} vergangene Auftrag
                {hiddenPastOrderCount === 1 ? "" : "e"} ausgeblendet.
              </span>

              <Link
                to="/auftraege?view=past"
                className={gastarioButtonClass("secondary")}
              >
                Vergangene Aufträge öffnen
              </Link>

            </GastarioToolbar>
          ) : null}
        </GastarioSection>
        )}
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}




































































































