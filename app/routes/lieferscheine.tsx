import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import DeliveryNoteButton from "../components/DeliveryNoteButton";
import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import lieferscheineStyles from "../styles/lieferscheine.css?url";
import deliveryNoteDocumentStyles from "../styles/delivery-note-document.css?url";
import "../styles/gastario-documents.css";
import "../styles/gastario-operations.css";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("de-DE");
  } catch {
    return "-";
  }
}

function emptyData(error: string | null = null) {
  return {
    tenantName: "Gastario",
    selectedDate: todayInput(),
    orders: [],
    savedNotes: [],
    stats: {
      orders: 0,
      positions: 0,
    },
    error,
  };
}

export function links() {
  return [
    {
      rel: "stylesheet",
      href: lieferscheineStyles,
    },
    {
      rel: "stylesheet",
      href: deliveryNoteDocumentStyles,
    },
  ];
}

export function meta() {
  return [{ title: "Lieferscheine · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  try {
    const { prisma } = await import("../lib/prisma.server");
    const { getTenantAccess } = await import("../lib/features.server");

    const access = await getTenantAccess(request);

    if (!access?.tenantId) {
      return emptyData("Kein Mandant gefunden.");
    }

    const url = new URL(request.url);

    const requestedDate =
      url.searchParams.get("date") || "";

    const requestedOrderId =
      url.searchParams.get("orderId") || "";

    /*
     * gastario-auto-create-upcoming-delivery-notes-20260713
     * Für alle bevorstehenden operativen Aufträge automatisch
     * einen dauerhaft gespeicherten Lieferschein erzeugen.
     */
    const refreshSavedPdfs =
      url.searchParams.get("refresh") === "1";

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const upcomingOrders =
      await prisma.order.findMany({
        where: {
          tenantId: access.tenantId,
          status: {
            in: [
              "CONFIRMED",
              "IN_PRODUCTION",
              "PACKING_OPEN",
            ] as any,
          },
          deliveryDate: {
            gte: startOfToday,
          },
        },
        select: {
          id: true,
        },
        take: 500,
      });

    const {
      ensureDeliveryNoteForOrder,
    } = await import("../lib/delivery-note.server");

    await Promise.allSettled(
      upcomingOrders.map((order) =>
        ensureDeliveryNoteForOrder(order.id, {
          force: refreshSavedPdfs,
        })
      )
    );

    const savedNotes = await prisma.deliveryNote.findMany({
      where: {
        tenantId: access.tenantId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            deliveryDate: true,
            deliveryTimeText: true,
            deliveryAddress: true,
            status: true,
          },
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
      take: 500,
    });

    const orders = await prisma.order.findMany({
      where: {
        tenantId: access.tenantId,
        ...(requestedOrderId
          ? { id: requestedOrderId }
          : {}),
        status: {
          in: [
            "CONFIRMED",
            "IN_PRODUCTION",
            "PACKING_OPEN",
            "DELIVERED",
          ] as any,
        },
      },
      include: {
        items: true,
      },
      orderBy: [
        { deliveryDate: "asc" },
        { deliveryTimeText: "asc" },
        { createdAt: "desc" },
      ],
      take: requestedOrderId ? 1 : 300,
    });

    const selectedDate =
      requestedDate ||
      normalizeDate(
        orders.find(
          (order: any) =>
            normalizeDate(order.deliveryDate)
        )?.deliveryDate
      ) ||
      todayInput();

    const relevantOrders = requestedOrderId
      ? orders
      : orders.filter((order: any) => {
          const date =
            normalizeDate(order.deliveryDate);

          return date === selectedDate;
        });

    return {
      tenantName:
        access.tenant?.name || "Gastario",
      selectedDate,
      orders: relevantOrders,
      savedNotes,
      stats: {
        orders: relevantOrders.length,
        positions: relevantOrders.reduce(
          (sum: number, order: any) =>
            sum +
            Number((order.items || []).length),
          0
        ),
      },
      error: null,
    };
  } catch (error: any) {
    console.error(
      "Lieferscheine loader error:",
      error
    );

    return emptyData(
      error?.message ||
        "Lieferscheine konnten nicht geladen werden."
    );
  }
}

export default function DeliveryNotesPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PageShell className="documentsPage deliveryNotesMasterPage">
        <PageHeader
          eyebrow="Betrieb"
          title="Lieferscheine"
          subtitle={
            <>
              {data.tenantName} · Gespeicherte Lieferscheine für
              bevorstehende und vergangene Aufträge.
            </>
          }
          actions={
            <>
              <Link
                className="g-doc-button g-doc-button--secondary"
                to="/lieferscheine?refresh=1"
              >
                Dokumente aktualisieren
              </Link>

              <Link
                className="g-doc-button g-doc-button--primary"
                to="/lieferungen"
              >
                Zu Lieferungen
              </Link>
            </>
          }
        />

        {data.error ? (
          <Notice type="danger">
            <strong>Lieferscheine konnten nicht vollständig geladen werden.</strong>
            <span>{data.error}</span>
          </Notice>
        ) : null}

        <MetricGrid>
          <MetricCard
            label="Aufträge am ausgewählten Tag"
            value={data.stats.orders}
            description={
              data.selectedDate
                ? formatDate(data.selectedDate)
                : "Kein Datum ausgewählt"
            }
            badge="Tag"
          />

          <MetricCard
            label="Positionen"
            value={data.stats.positions}
            description="Positionen der Tagesauswahl"
            badge="Liste"
          />

          <MetricCard
            label="Gespeicherte Dokumente"
            value={data.savedNotes.length}
            description="Dauerhaft im PDF-Archiv"
            badge="Archiv"
          />

          <MetricCard
            label="Automatische Erzeugung"
            value="Aktiv"
            description="Für operative, bevorstehende Aufträge"
            badge="System"
          />
        </MetricGrid>

        <PageSection
          className="deliveryNotesArchiveSection"
          eyebrow="PDF-Archiv"
          title="Gespeicherte Lieferscheine"
          description="Alle automatisch erzeugten Lieferscheine mit Lieferdatum, Status und direktem PDF-Zugriff."
          actions={
            <span className="g-doc-count">
              {data.savedNotes.length}
              <small>Dokumente</small>
            </span>
          }
        >
          {data.savedNotes.length === 0 ? (
            <div className="g-doc-empty-state">
              <span aria-hidden="true">PDF</span>
              <div>
                <strong>Noch keine Lieferscheine gespeichert</strong>
                <p>
                  Beim Übernehmen eines operativen Auftrags wird der
                  Lieferschein automatisch erzeugt und hier archiviert.
                </p>
              </div>
              <Link
                className="g-doc-button g-doc-button--primary"
                to="/lieferungen"
              >
                Lieferungen öffnen
              </Link>
            </div>
          ) : (
            <div className="deliveryNotesArchiveList">
              <div className="deliveryNotesArchiveHead">
                <span>Lieferschein</span>
                <span>Kunde</span>
                <span>Lieferung</span>
                <span>Status</span>
                <span>Erstellt</span>
                <span>Aktionen</span>
              </div>

              {data.savedNotes.map((note: any) => {
                const status = String(
                  note.order?.status || ""
                );

                const readableStatus =
                  status === "CONFIRMED"
                    ? "Bestätigt"
                    : status === "IN_PRODUCTION"
                      ? "In Produktion"
                      : status === "PACKING_OPEN"
                        ? "Packen"
                        : status === "DELIVERED"
                          ? "Ausgeliefert"
                          : status || "-";

                return (
                  <article
                    className="deliveryNotesArchiveRow"
                    key={note.id}
                  >
                    <div className="deliveryNotesPrimaryCell">
                      <strong>{note.number}</strong>
                      <small>
                        Auftrag {note.order?.orderNumber || "-"}
                      </small>
                    </div>

                    <div>
                      <strong>
                        {note.order?.customerName || "Ohne Kunde"}
                      </strong>
                      <small>
                        {note.order?.deliveryAddress || "-"}
                      </small>
                    </div>

                    <div>
                      <strong>
                        {formatDate(note.order?.deliveryDate)}
                      </strong>
                      <small>
                        {note.order?.deliveryTimeText
                          ? note.order.deliveryTimeText + " Uhr"
                          : "-"}
                      </small>
                    </div>

                    <div>
                      <span
                        className={
                          "g-doc-status is-" +
                          status
                            .toLowerCase()
                            .replace(/_/g, "-")
                        }
                      >
                        {readableStatus}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {new Date(
                          note.generatedAt
                        ).toLocaleDateString("de-DE")}
                      </strong>
                      <small>
                        {new Date(
                          note.generatedAt
                        ).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        Uhr
                      </small>
                    </div>

                    <div className="deliveryNoteArchiveActions">
                      <DeliveryNoteButton
                        orderId={note.orderId}
                      />

                      <DeliveryNoteButton
                        orderId={note.orderId}
                        refresh
                        compact
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}
