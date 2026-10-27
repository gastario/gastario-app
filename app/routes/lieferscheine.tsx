import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

import {
  GastarioDataList,
  GastarioDataRow,
  GastarioDetailDialog,
  GastarioDetailPane,
  GastarioDetailTabs,
  GastarioEmptyState,
  GastarioHeader,
  GastarioMetric,
  GastarioMetricGrid,
  GastarioNotice,
  GastarioPage,
  GastarioSection,
  GastarioStack,
  GastarioToolbar,
  gastarioButtonClass,
} from "../components/ui";

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
  const data =
    useLoaderData<typeof loader>();

  const [
    selectedNoteId,
    setSelectedNoteId,
  ] = useState<string | null>(
    null
  );

  const [
    detailTab,
    setDetailTab,
  ] = useState("overview");

  const selectedNote =
    selectedNoteId
      ? data.savedNotes.find(
          (note: any) =>
            note.id ===
            selectedNoteId
        ) || null
      : null;

  function openNote(
    noteId: string
  ) {
    setSelectedNoteId(
      noteId
    );

    setDetailTab(
      "overview"
    );
  }

  function closeNote() {
    setSelectedNoteId(
      null
    );

    setDetailTab(
      "overview"
    );
  }

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Betrieb"
          title="Lieferscheine"
          description={`${data.tenantName} · gespeicherte Lieferscheine zentral verwalten.`}
          actions={
            <GastarioToolbar>
              <Link
                className={gastarioButtonClass(
                  "secondary"
                )}
                to={`/lieferscheine?date=${encodeURIComponent(
                  data.selectedDate
                )}&refresh=1`}
              >
                PDFs aktualisieren
              </Link>

              <Link
                className={gastarioButtonClass(
                  "primary"
                )}
                to="/lieferungen"
              >
                Zu Lieferungen
              </Link>
            </GastarioToolbar>
          }
        />

        {data.error ? (
          <GastarioNotice type="danger">
            {data.error}
          </GastarioNotice>
        ) : null}

        <GastarioMetricGrid>
          <GastarioMetric
            label="Aufträge"
            value={
              data.stats.orders
            }
            description="am ausgewählten Tag"
          />

          <GastarioMetric
            label="Positionen"
            value={
              data.stats.positions
            }
            description="in diesen Aufträgen"
          />

          <GastarioMetric
            label="Gespeicherte Lieferscheine"
            value={
              data.savedNotes.length
            }
            description="dauerhaft erzeugte PDFs"
          />

          <GastarioMetric
            label="Datum"
            value={formatDate(
              data.selectedDate
            )}
            description="aktuelle Auswahl"
          />
        </GastarioMetricGrid>

        <GastarioSection
          eyebrow="Dokumente"
          title="Lieferschein-Archiv"
          description="Vorhandenen Lieferschein auswählen und im Detailfenster öffnen oder neu erzeugen."
        >
          {data.savedNotes.length ===
          0 ? (
            <GastarioEmptyState title="Noch keine Lieferscheine">
              Sobald operative Aufträge vorhanden sind, erzeugt Gastario die Lieferscheine automatisch.
            </GastarioEmptyState>
          ) : (
            <GastarioDataList>
              {data.savedNotes.map(
                (note: any) => {
                  const status =
                    String(
                      note.order
                        ?.status ||
                        ""
                    );

                  const statusText =
                    status ===
                    "CONFIRMED"
                      ? "Bestätigt"
                      : status ===
                          "IN_PRODUCTION"
                        ? "In Produktion"
                        : status ===
                            "PACKING_OPEN"
                          ? "Lieferbereit"
                          : status ===
                              "DELIVERED"
                            ? "Ausgeliefert"
                            : status ||
                              "–";

                  return (
                    <GastarioDataRow
                      key={note.id}
                    >
                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          {note.number}
                        </strong>

                        <span className="g-ui-data-row-description">
                          Auftrag{" "}
                          {note.order
                            ?.orderNumber ||
                            "–"}{" "}
                          ·{" "}
                          {note.order
                            ?.customerName ||
                            "Ohne Kunde"}
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <span>
                          {formatDate(
                            note.order
                              ?.deliveryDate
                          )}
                        </span>

                        <span>
                          {statusText}
                        </span>

                        <button
                          type="button"
                          className={gastarioButtonClass(
                            "secondary"
                          )}
                          onClick={() =>
                            openNote(
                              note.id
                            )
                          }
                        >
                          Öffnen
                        </button>
                      </div>
                    </GastarioDataRow>
                  );
                }
              )}
            </GastarioDataList>
          )}
        </GastarioSection>

        {selectedNote ? (
          <GastarioDetailDialog
            open
            title={
              selectedNote.number
            }
            description={`Auftrag ${
              selectedNote.order
                ?.orderNumber ||
              "–"
            } · ${
              selectedNote.order
                ?.customerName ||
              "Ohne Kunde"
            }`}
            onClose={
              closeNote
            }
            footer={
              <>
                <button
                  type="button"
                  className={gastarioButtonClass(
                    "secondary"
                  )}
                  onClick={
                    closeNote
                  }
                >
                  Schließen
                </button>

                <a
                  href={`/lieferschein-pdf/${selectedNote.orderId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={gastarioButtonClass(
                    "primary"
                  )}
                >
                  PDF öffnen
                </a>
              </>
            }
          >
            <GastarioStack>
              <GastarioDetailTabs
                items={[
                  {
                    id: "overview",
                    label:
                      "Übersicht",
                  },
                  {
                    id: "document",
                    label:
                      "Dokument",
                  },
                ]}
                activeId={
                  detailTab
                }
                onChange={
                  setDetailTab
                }
              />

              <GastarioDetailPane
                active={
                  detailTab ===
                  "overview"
                }
              >
                <GastarioMetricGrid>
                  <GastarioMetric
                    label="Kunde"
                    value={
                      selectedNote.order
                        ?.customerName ||
                      "Ohne Kunde"
                    }
                    description="Empfänger"
                  />

                  <GastarioMetric
                    label="Lieferdatum"
                    value={formatDate(
                      selectedNote.order
                        ?.deliveryDate
                    )}
                    description={
                      selectedNote.order
                        ?.deliveryTimeText
                        ? `${selectedNote.order.deliveryTimeText} Uhr`
                        : "Keine Uhrzeit"
                    }
                  />

                  <GastarioMetric
                    label="Auftrag"
                    value={
                      selectedNote.order
                        ?.orderNumber ||
                      "–"
                    }
                    description="Auftragsnummer"
                  />
                </GastarioMetricGrid>

                <GastarioSection
                  eyebrow="Lieferung"
                  title="Lieferadresse"
                >
                  {selectedNote.order
                    ?.deliveryAddress ||
                    "Keine Lieferadresse hinterlegt."}
                </GastarioSection>
              </GastarioDetailPane>

              <GastarioDetailPane
                active={
                  detailTab ===
                  "document"
                }
              >
                <GastarioSection
                  eyebrow="PDF"
                  title="Gespeicherter Lieferschein"
                  description="Der Lieferschein wird dauerhaft gespeichert und kann bei Änderungen gezielt neu erzeugt werden."
                >
                  <GastarioStack>
                    <GastarioNotice type="neutral">
                      Erstellt am{" "}
                      {new Date(
                        selectedNote.generatedAt
                      ).toLocaleDateString(
                        "de-DE"
                      )}{" "}
                      um{" "}
                      {new Date(
                        selectedNote.generatedAt
                      ).toLocaleTimeString(
                        "de-DE",
                        {
                          hour:
                            "2-digit",
                          minute:
                            "2-digit",
                        }
                      )}{" "}
                      Uhr.
                    </GastarioNotice>

                    <GastarioToolbar>
                      <a
                        href={`/lieferschein-pdf/${selectedNote.orderId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={gastarioButtonClass(
                          "primary"
                        )}
                      >
                        PDF öffnen
                      </a>

                      <a
                        href={`/lieferschein-pdf/${selectedNote.orderId}?refresh=1`}
                        target="_blank"
                        rel="noreferrer"
                        className={gastarioButtonClass(
                          "secondary"
                        )}
                      >
                        Neu erzeugen
                      </a>
                    </GastarioToolbar>
                  </GastarioStack>
                </GastarioSection>
              </GastarioDetailPane>
            </GastarioStack>
          </GastarioDetailDialog>
        ) : null}
      </GastarioPage>
    </AppLayout>
  );
}