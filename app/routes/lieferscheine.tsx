import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import lieferscheineStyles from "../styles/lieferscheine.css?url";

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

function CheckItem({ text }: { text: string }) {
  return (
    <div style={checkItemStyle}>
      <span style={checkBoxStyle}></span>
      <span>{text}</span>
    </div>
  );
}

export default function DeliveryNotesPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <div className="deliveryNotesPrintRoot deliveryNotesPage">
      <style>{printCss}</style>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Lieferscheine</h1>
          <span className="pageSubline">
            {data.tenantName} · einfache Lieferscheine aus Auftraegen.
          </span>
        </div>

        <div className="topActions">
          <Link className="primaryButton" to="/lieferungen">
            Zu Lieferungen
          </Link>
        </div>
      </header>

      {data.error ? (
        <section className="panel">
          <div className="noteBox">
            <strong>Hinweis</strong>
            <p>{data.error}</p>
          </div>
        </section>
      ) : null}

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Lieferscheine</p>
            <strong>{data.stats.orders}</strong>
            <span>fuer diesen Tag</span>
          </div>
          <small data-trend="aktiv">Dokument</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Positionen</p>
            <strong>{data.stats.positions}</strong>
            <span>gesamt</span>
          </div>
          <small data-trend="bereit">Liste</small>
        </article>
      </section>


      {/* gastario-delivery-note-archive-v3-20260713 */}
      <section className="panel deliveryNoteArchivePanel">
        <div className="deliveryNoteArchiveHeader">
          <div>
            <p className="eyebrow">PDF-Archiv</p>
            <h2>Gespeicherte Lieferscheine</h2>
            <p>
              Dauerhaft archivierte Lieferscheine aus bevorstehenden
              und vergangenen Aufträgen.
            </p>
          </div>

          <div className="deliveryNoteArchiveCount">
            <strong>{data.savedNotes.length}</strong>
            <span>Dokumente</span>
          </div>
        </div>

        {data.savedNotes.length === 0 ? (
          <div className="deliveryNoteArchiveEmpty">
            <strong>Noch keine PDF-Lieferscheine gespeichert.</strong>
            <p>
              Beim Übernehmen eines Auftrags wird der Lieferschein
              automatisch erzeugt und hier angezeigt.
            </p>
          </div>
        ) : (
          <div className="deliveryNoteArchiveList">
            <div className="deliveryNoteArchiveHead">
              <span>Lieferschein</span>
              <span>Kunde</span>
              <span>Lieferung</span>
              <span>Status</span>
              <span>Erstellt</span>
              <span>Aktion</span>
            </div>

            {data.savedNotes.map((note: any) => {
              const status = String(note.order?.status || "");

              const statusLabel =
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
                  className="deliveryNoteArchiveRow"
                  key={note.id}
                >
                  <div>
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
                      {note.order?.deliveryTimeText || "-"} Uhr
                    </small>
                  </div>

                  <span
                    className={
                      "deliveryNoteArchiveStatus status-" +
                      status.toLowerCase().replace(/_/g, "-")
                    }
                  >
                    {statusLabel}
                  </span>

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
                      })} Uhr
                    </small>
                  </div>

                  <div className="deliveryNoteArchiveActions">
                    <a
                      className="deliveryNotePdfButton"
                      href={
                        "/lieferscheine/" +
                        note.orderId +
                        "/pdf"
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF öffnen
                    </a>

                    <a
                      className="deliveryNoteRefreshButton"
                      href={
                        "/lieferscheine/" +
                        note.orderId +
                        "/pdf?refresh=1"
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Neu erzeugen
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>


            {/* gastario-remove-legacy-delivery-note-view-20260713 */}
      </div>
</AppLayout>
  );
}


const deliveryCheckSectionStyle: React.CSSProperties = {
  marginTop: 22,
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  background: "#ffffff",
};

const checkTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
};

const checkGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const checkItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#0f172a",
  fontWeight: 750,
  fontSize: 13,
};

const checkBoxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  border: "2px solid #0f766e",
  borderRadius: 4,
  display: "inline-block",
  flex: "0 0 auto",
};

const signatureGridStyle: React.CSSProperties = {
  marginTop: 30,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
};

const signatureBoxStyle: React.CSSProperties = {
  borderTop: "1px solid #64748b",
  paddingTop: 10,
  minHeight: 54,
  color: "#475569",
  fontWeight: 850,
};


const printCss = `
@media print {
  body {
    background: #ffffff !important;
  }

  aside,
  nav,
  .sidebar,
  .topActions,
  .orderSummaryGrid,
  .panelHeader {
    display: none !important;
  }

  main,
  section,
  article {
    box-shadow: none !important;
  }

  article {
    page-break-inside: avoid;
  }

  .panel {
    border: none !important;
    padding: 0 !important;
  }

  @page {
    size: A4;
    margin: 14mm;
  }
}
`;
