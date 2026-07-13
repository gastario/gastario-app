import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

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
      <div className="deliveryNotesPrintRoot">
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
          <button className="secondaryButton" type="button" onClick={() => window.print()}>
            Drucken
          </button>
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
                </article>
              );
            })}
          </div>
        )}
      </section>


      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Dokumente</p>
            <h2>Lieferscheine</h2>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {data.orders.length === 0 ? (
            <div className="noteBox">
              <strong>Keine Lieferscheine gefunden.</strong>
              <p>Es gibt keine passenden Auftraege fuer diesen Tag.</p>
            </div>
          ) : (
            data.orders.map((order: any) => (
              <article key={order.id} style={{
                background: "white",
                border: "1px solid #dbe5ee",
                borderRadius: 22,
                padding: 22
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 18,
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: 16,
                  marginBottom: 16,
                  alignItems: "flex-start"
                }}>
                  <div>
                    <p className="eyebrow">Lieferschein</p>
                    <h2 style={{ margin: 0 }}>{order.orderNumber || order.id}</h2>
                    <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 800 }}>
                      {formatDate(order.deliveryDate)} ? {order.deliveryTimeText || "-"} Uhr
                    </p>

                    {String(order.status || "").toUpperCase() === "AUTO_CREATED" ? (
                      <div style={{
                        display: "inline-flex",
                        marginTop: 10,
                        border: "1px solid #fed7aa",
                        background: "#fff7ed",
                        color: "#9a3412",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 900
                      }}>
                        Automatisch aus Import vorbereitet
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                    <strong>{data.tenantName}</strong>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Link className="ghostButton" to={"/auftrag-pruefung/" + order.id}>
                        Auftrag öffnen
                      </Link>

                      <button className="secondaryButton" type="button" onClick={() => window.print()}>
                        Drucken
                      </button>
                    </div>
                  </div>
                </div>

                <div className="routeDetails">
                  <p>
                    <b>Kunde</b>
                    <span>{order.customerName || "Ohne Kunde"}</span>
                  </p>
                  <p>
                    <b>Adresse</b>
                    <span>{order.deliveryAddress || "Keine Adresse eingetragen"}</span>
                  </p>
                  <p>
                    <b>Kontakt</b>
                    <span>{order.contactName || "-"} · {order.contactPhone || order.customerPhone || "-"}</span>
                  </p>
                </div>

                {String(order.status || "").toUpperCase() === "AUTO_CREATED" ? (
                  <div className="noteBox" style={{ marginTop: 16 }}>
                    <strong>Noch nicht uebernommen</strong>
                    <p>
                      Dieser Lieferschein wurde automatisch aus dem Import vorbereitet.
                      Bitte den Auftrag auf der Pruefseite kontrollieren und danach uebernehmen.
                    </p>
                  </div>
                ) : null}

                <div className="purchaseDemandTable" style={{ marginTop: 16 }}>
                  <div className="purchaseDemandHead">
                    <span>Position</span>
                    <span>Menge</span>
                    <span>Einheit</span>
                    <span></span>
                    <span></span>
                  </div>

                  {(order.items || []).map((item: any) => (
                    <div className="purchaseDemandRow" key={item.id || item.name}>
                      <strong>{item.name || "Position"}</strong>
                      <span>{item.quantity || 0}</span>
                      <span>{item.unit || "Stück"}</span>
                      <span></span>
                      <span></span>
                    </div>
                  ))}
                </div>

                <section style={deliveryCheckSectionStyle}>
                  <h3 style={checkTitleStyle}>Vor der Lieferung prüfen</h3>

                  <div style={checkGridStyle}>
                    <CheckItem text="Alle Positionen laut Liste gepackt" />
                    <CheckItem text="Mengen kontrolliert" />
                    <CheckItem text="Kalte Speisen gekühlt" />
                    <CheckItem text="Warme Speisen transportbereit" />
                    <CheckItem text="Allergene / Hinweise geprüft" />
                    <CheckItem text="Besteck / Servietten / Zubehör geprüft" />
                    <CheckItem text="Lieferadresse geprüft" />
                    <CheckItem text="Ansprechpartner / Telefonnummer geprüft" />
                  </div>
                </section>

                <section style={deliveryCheckSectionStyle}>
                  <h3 style={checkTitleStyle}>Fahrer-Check</h3>

                  <div style={checkGridStyle}>
                    <CheckItem text="Fahrzeug beladen" />
                    <CheckItem text="Ware transportsicher verstaut" />
                    <CheckItem text="Lieferzeit eingehalten" />
                    <CheckItem text="Kunde bei Ankunft informiert" />
                  </div>
                </section>

                <section style={deliveryCheckSectionStyle}>
                  <h3 style={checkTitleStyle}>Übergabe beim Kunden</h3>

                  <div style={checkGridStyle}>
                    <CheckItem text="Ware vollständig übergeben" />
                    <CheckItem text="Aufbau / Ablageort abgestimmt" />
                    <CheckItem text="Besonderheiten notiert" />
                    <CheckItem text="Empfang bestätigt" />
                  </div>
                </section>

                <div style={signatureGridStyle}>
                  <div style={signatureBoxStyle}>
                    <span>Fahrer / Übergabe</span>
                  </div>

                  <div style={signatureBoxStyle}>
                    <span>Kunde / Empfang</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    
      <style>{`
        /* gastario-delivery-note-print-layout-20260713 */

        @page {
          size: A4 portrait;
          margin: 12mm 12mm 13mm;
        }

        @media print {
          html,
          body {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 10pt !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          /*
           * Der eigentliche Inhaltsbereich bleibt sichtbar.
           * AppLayout-Navigation und Sidebar werden ausgeblendet.
           */
          main,
          main *,
          [role="main"],
          [role="main"] * {
            visibility: visible !important;
          }

          aside,
          nav,
          .sidebar,
          .appSidebar,
          .layoutSidebar,
          .mobileNavigation,
          .mobileMenuButton {
            display: none !important;
          }

          main,
          [role="main"] {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          main > *,
          [role="main"] > * {
            width: 100% !important;
            max-width: none !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }

          /*
           * Aktionsbuttons werden auf dem Ausdruck nicht benötigt.
           */
          button,
          a[href^="/auftrag-pruefung/"],
          a[href^="/auftraege"],
          .ghostButton,
          .primaryButton,
          .secondaryButton,
          .printButton,
          .noPrint {
            display: none !important;
          }

          /*
           * Kartenoptik für Papier vereinfachen.
           */
          section,
          article,
          .panel,
          .card {
            max-width: none !important;
            box-shadow: none !important;
          }

          /*
           * Der äußere Lieferscheinrahmen.
           */
          main section,
          main article {
            border-color: #9ca3af !important;
            border-radius: 0 !important;
            background: #ffffff !important;
          }

          h1,
          h2,
          h3,
          p {
            color: #000000 !important;
          }

          h2 {
            font-size: 17pt !important;
            line-height: 1.1 !important;
          }

          /*
           * Tabellen im Ausdruck klar und kompakt darstellen.
           */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th,
          td {
            padding: 7px 8px !important;
            border-color: #9ca3af !important;
            color: #000000 !important;
            font-size: 9.5pt !important;
          }

          th {
            background: #eef1f3 !important;
            font-weight: 800 !important;
          }

          /*
           * Kontrollbereiche nicht mitten in zwei Seiten aufteilen.
           */
          main section > div,
          main article > div {
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }

          /*
           * Checklisten etwas kompakter für A4.
           */
          main section > div[style*="grid"],
          main article > div[style*="grid"] {
            gap: 5px !important;
          }

          /*
           * Unterschriftenbereich zusammenhalten.
           */
          main hr,
          main hr + div {
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }

          /*
           * Links nicht mit URL hinter dem Text drucken.
           */
          a::after {
            content: none !important;
          }
        }
      `}</style>
      </div>

      <style>{`
        /* gastario-delivery-note-print-root-fix-20260713 */

        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        @media print {
          html,
          body {
            width: auto !important;
            min-width: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          /*
           * Zuerst alles unsichtbar machen und anschließend nur
           * den echten Lieferschein wieder einblenden.
           */
          body * {
            visibility: hidden !important;
          }

          .deliveryNotesPrintRoot,
          .deliveryNotesPrintRoot * {
            visibility: visible !important;
          }

          .deliveryNotesPrintRoot {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;

            /*
             * Das Bildschirmdesign ist großzügig. Für A4 wird es
             * proportional verkleinert, ohne Inhalte abzuschneiden.
             */
            zoom: 0.80 !important;
          }

          aside,
          nav,
          header,
          .sidebar,
          .appSidebar,
          .layoutSidebar,
          .mobileNavigation,
          .mobileMenuButton,
          .topbar,
          .topActions {
            display: none !important;
          }

          /*
           * Bildschirm-Abstände des AppLayouts vollständig entfernen.
           */
          main,
          [role="main"],
          .appContent,
          .layoutContent,
          .content,
          .pageContent {
            position: static !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          /*
           * Bedienknöpfe gehören nicht auf den Lieferschein.
           */
          button,
          .ghostButton,
          .primaryButton,
          .secondaryButton,
          .printButton,
          .noPrint,
          a[href^="/auftrag-pruefung"],
          a[href^="/auftraege"],
          a[href^="/lieferungen"] {
            display: none !important;
          }

          /*
           * Die alte Druckregel zwang fast jeden div-Block auf eine
           * neue Seite. Das wird hier ausdrücklich zurückgesetzt.
           */
          .deliveryNotesPrintRoot div,
          .deliveryNotesPrintRoot section,
          .deliveryNotesPrintRoot article {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          /*
           * Nur sinnvolle Einheiten zusammenhalten.
           */
          .deliveryNotesPrintRoot table,
          .deliveryNotesPrintRoot tr,
          .deliveryNotesPrintRoot thead,
          .deliveryNotesPrintRoot tbody {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .deliveryNotesPrintRoot table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .deliveryNotesPrintRoot thead {
            display: table-header-group !important;
          }

          .deliveryNotesPrintRoot th,
          .deliveryNotesPrintRoot td {
            padding: 6px 8px !important;
            border-color: #aeb8b4 !important;
            color: #000000 !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
          }

          .deliveryNotesPrintRoot th {
            background: #eef2f0 !important;
          }

          .deliveryNotesPrintRoot h1,
          .deliveryNotesPrintRoot h2,
          .deliveryNotesPrintRoot h3,
          .deliveryNotesPrintRoot p,
          .deliveryNotesPrintRoot span,
          .deliveryNotesPrintRoot strong {
            color: #000000 !important;
          }

          .deliveryNotesPrintRoot h2 {
            font-size: 21px !important;
            line-height: 1.05 !important;
          }

          .deliveryNotesPrintRoot section,
          .deliveryNotesPrintRoot article {
            max-width: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }

          /*
           * Browser soll hinter Links keine URL ergänzen.
           */
          .deliveryNotesPrintRoot a::after {
            content: none !important;
          }
        }
      `}</style>

      <style>{`
        .deliveryNoteArchivePanel {
          margin: 22px 0;
          padding: 24px;
          border: 1px solid #d7e4df;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, .055);
        }

        .deliveryNoteArchiveHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 22px;
        }

        .deliveryNoteArchiveHeader h2 {
          margin: 3px 0 0;
        }

        .deliveryNoteArchiveHeader p:not(.eyebrow) {
          max-width: 680px;
          margin: 7px 0 0;
          color: #687a73;
          font-size: 13px;
          font-weight: 650;
          line-height: 1.5;
        }

        .deliveryNoteArchiveCount {
          display: grid;
          min-width: 105px;
          padding: 13px 16px;
          border: 1px solid #cae0d7;
          border-radius: 14px;
          background: linear-gradient(
            180deg,
            #f7fcfa 0%,
            #eaf6f1 100%
          );
          text-align: right;
        }

        .deliveryNoteArchiveCount strong {
          color: #076b54;
          font-size: 25px;
          line-height: 1;
        }

        .deliveryNoteArchiveCount span {
          margin-top: 6px;
          color: #64766f;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .06em;
          text-transform: uppercase;
        }

        .deliveryNoteArchiveEmpty {
          margin-top: 20px;
          padding: 30px;
          border: 1px dashed #c8d9d2;
          border-radius: 16px;
          background: #f8fbfa;
          text-align: center;
        }

        .deliveryNoteArchiveEmpty p {
          margin: 7px 0 0;
          color: #6c7d76;
        }

        .deliveryNoteArchiveList {
          display: grid;
          gap: 11px;
          margin-top: 20px;
        }

        .deliveryNoteArchiveHead,
        .deliveryNoteArchiveRow {
          display: grid;
          grid-template-columns:
            minmax(160px, 1fr)
            minmax(175px, 1.2fr)
            minmax(110px, .72fr)
            minmax(105px, .7fr)
            minmax(105px, .72fr)
            110px;
          gap: 15px;
          align-items: center;
        }

        .deliveryNoteArchiveHead {
          min-height: 40px;
          padding: 0 16px;
          border: 1px solid #d7e3de;
          border-radius: 11px;
          background: #f2f7f5;
          color: #60736b;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .055em;
          text-transform: uppercase;
        }

        .deliveryNoteArchiveRow {
          position: relative;
          min-height: 82px;
          padding: 14px 16px;
          border: 1px solid #d8e4df;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 8px 22px rgba(15, 23, 42, .045);
        }

        .deliveryNoteArchiveRow::before {
          content: "";
          position: absolute;
          top: 14px;
          bottom: 14px;
          left: 0;
          width: 3px;
          border-radius: 0 5px 5px 0;
          background: #19a982;
        }

        .deliveryNoteArchiveRow > div {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .deliveryNoteArchiveRow strong,
        .deliveryNoteArchiveRow small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .deliveryNoteArchiveRow strong {
          color: #10231c;
          font-size: 12px;
          font-weight: 850;
        }

        .deliveryNoteArchiveRow small {
          color: #73827d;
          font-size: 9px;
          font-weight: 650;
        }

        .deliveryNoteArchiveStatus {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 29px;
          padding: 0 10px;
          border: 1px solid #b8dfd0;
          border-radius: 8px;
          background: #edf9f4;
          color: #08705a;
          font-size: 9px;
          font-weight: 850;
        }

        .deliveryNotePdfButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 13px;
          border: 1px solid #087c60;
          border-radius: 10px;
          background: linear-gradient(
            180deg,
            #0b8968 0%,
            #087458 100%
          );
          color: #ffffff;
          font-size: 10px;
          font-weight: 850;
          text-decoration: none;
          box-shadow: 0 7px 16px rgba(8, 124, 96, .17);
        }

        @media (max-width: 1100px) {
          .deliveryNoteArchiveHead {
            display: none;
          }

          .deliveryNoteArchiveRow {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .deliveryNotePdfButton {
            grid-column: 1 / -1;
          }
        }

        @media print {
          .deliveryNoteArchivePanel {
            display: none !important;
          }
        }
      `}</style>
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
