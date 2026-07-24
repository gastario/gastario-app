import { useState } from "react";
import { Form, Link, redirect, useLoaderData, useNavigation } from "react-router";
import orderReviewStyles from "../styles/auftrag-pruefung.css?url";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDateInput(value: string | Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isHeycaterCorrectionItem(item: any) {
  const name = normalizeText(item?.name);
  const notes = normalizeText(item?.notes);

  return (
    name.includes("fehlende position") ||
    name.includes("heycater-pdf") ||
    notes.includes("summenabgleich") ||
    notes.includes("gesamtbetrag netto aus der heycater-pdf")
  );
}

function isPlaceholderOrderItem(item: any) {
  const text = normalizeText([
    item?.name,
    item?.unit,
    item?.notes,
  ].join(" "));

  return (
    text.includes("pruefung") ||
    text.includes("prufung") ||
    text.includes("platzhalter") ||
    text.includes("positionen bitte") ||
    text.includes("fast track order") ||
    text.includes("e-mail auftrag") ||
    text.includes("email auftrag")
  );
}

function getOrderReviewState(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const totalCents = items.reduce((sum: number, item: any) => sum + (item?.totalCents || 0), 0);
  const realItems = items.filter((item: any) => !isPlaceholderOrderItem(item));
  const isHeycater = normalizeText(order?.platformName || order?.source).includes("heycater");

  const missing: string[] = [];
  const hints: string[] = [];

  if (!String(order?.deliveryAddress || "").trim()) {
    missing.push("Lieferadresse fehlt");
  }

  if (!String(order?.deliveryTimeText || "").trim()) {
    missing.push("Lieferzeit fehlt");
  }

  if (realItems.length === 0) {
    missing.push("Keine echten bestellten Produkte erkannt");
  }

  if (totalCents <= 0) {
    if (isHeycater && realItems.length > 0) {
      missing.push("Preise fehlen");
      hints.push("Die Positionen wurden aus einem Heycater-Lieferschein erkannt. Dieser Lieferschein enthaelt Mengen und Produkte, aber keine Preise.");
      hints.push("Bitte Preise ergaenzen oder die Heycater-Auftragsbestaetigung mit Preisen importieren.");
    } else {
      missing.push("Summe ist 0 Euro");
    }
  }

  return {
    missing,
    hints,
    totalCents,
    realItemCount: realItems.length,
    isHeycater,
  };
}

function getMissingOrderChecks(order: any) {
  return getOrderReviewState(order).missing;
}

export function links() {
  return [
    {
      rel: "stylesheet",
      href: orderReviewStyles,
    },
  ];
}

export function meta() {
  return [{ title: "Auftragspruefung - Gastario" }];
}

export async function loader({ request, params }: { request: Request; params: { orderId?: string } }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw new Response("Nicht angemeldet", { status: 401 });
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!tenantUser) {
    throw new Response("Kein Mandant gefunden", { status: 404 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      tenantId: tenantUser.tenantId,
    },
    include: {
      items: true,
      customer: true,
    },
  });

  if (!order) {
    throw new Response("Auftrag nicht gefunden", { status: 404 });
  }

  const url = new URL(request.url);

  return {
    tenant: tenantUser.tenant,
    order,
    blocked: url.searchParams.get("blocked") === "1",
  };
}

export async function action({ request, params }: { request: Request; params: { orderId?: string } }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw new Response("Nicht angemeldet", { status: 401 });
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
  });

  if (!tenantUser) {
    throw new Response("Kein Mandant gefunden", { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("_intent") || "");

  if (intent === "confirmOrder") {
    const requestedBillingMode = String(
      formData.get("billingMode") || "UNDECIDED"
    );

    const billingConfiguration: Record<
      string,
      {
        billingMode: string;
        billingStatus: string;
      }
    > = {
      UNDECIDED: {
        billingMode: "UNDECIDED",
        billingStatus: "NOT_BILLED",
      },
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
      billingConfiguration[requestedBillingMode] ||
      billingConfiguration.UNDECIDED;
    const order = await prisma.order.findFirst({
      where: {
        id: params.orderId,
        tenantId: tenantUser.tenantId,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new Response("Auftrag nicht gefunden", { status: 404 });
    }

    const missingChecks = getMissingOrderChecks(order);

    if (missingChecks.length > 0) {
      return redirect("/auftrag-pruefung/" + params.orderId + "?blocked=1");
    }

    await prisma.order.updateMany({
      where: {
        id: params.orderId,
        tenantId: tenantUser.tenantId,
      },
      data: {
        status: "CONFIRMED" as any,
        billingMode:
          billingSelection.billingMode as any,
        billingStatus:
          billingSelection.billingStatus as any,
      },
    });

    /*
     * gastario-auto-products-on-confirm-20260714
     * Fehlende Produkte automatisch anlegen,
     * Mappings speichern und Auftragspositionen verbinden.
     */
    const {
      ensureProductsForOrder,
    } = await import("../lib/order-products.server");

    await ensureProductsForOrder(
      String(params.orderId),
      tenantUser.tenantId
    );

    const {
      ensureDeliveryNoteForOrder,
    } = await import("../lib/delivery-note.server");

    await ensureDeliveryNoteForOrder(
      String(params.orderId)
    );

    if (
      billingSelection.billingMode ===
      "DIRECT_INVOICE"
    ) {
      return redirect(
        "/rechnungen/neu?orderId=" +
          encodeURIComponent(
            String(params.orderId)
          )
      );
    }

    return redirect("/auftraege");
  }

  return redirect("/auftrag-pruefung/" + params.orderId);
}

export default function AuftragPruefungPage() {
  const { tenant, order, blocked } = useLoaderData<typeof loader>();
  const total = order.items.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const correctionItems = order.items.filter((item) => isHeycaterCorrectionItem(item));
  const visibleItems = order.items.filter((item) => !isHeycaterCorrectionItem(item));
  const visibleItemsTotal = visibleItems.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const correctionTotal = correctionItems.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const hasHeycaterCorrection = correctionTotal > 0;
  const reviewState = getOrderReviewState(order);
  const missingChecks = reviewState.missing;
  const canConfirmOrder = missingChecks.length === 0;
  const navigation = useNavigation();

  const [reviewChecks, setReviewChecks] = useState({
    customer: false,
    deliveryAddress: false,
    deliverySchedule: false,
    items: false,
    notes: false,
  });

  const completedReviewChecks =
    Object.values(reviewChecks).filter(Boolean).length;

  const allReviewChecksCompleted =
    completedReviewChecks === 5;

  const isConfirming =
    navigation.state !== "idle" &&
    navigation.formData?.get("_intent") === "confirmOrder";

  function updateReviewCheck(
    key: keyof typeof reviewChecks,
    value: boolean
  ) {
    setReviewChecks((current) => ({
      ...current,
      [key]: value,
    }));
  }

  /*
   * gastario-confirmed-order-details-20260714
   * Bereits übernommene Aufträge werden nur noch als
   * Auftragsdetails angezeigt.
   */
  const isAlreadyConfirmed = [
    "CONFIRMED",
    "IN_PRODUCTION",
    "PACKING_OPEN",
    "DELIVERED",
  ].includes(String(order.status));
  const deliveryHref =
    "/lieferscheine/" + order.id + "/pdf";

  return (
    <main className="orderReviewPage" style={{ background: "linear-gradient(180deg, #eef6f8 0%, #f8fbfc 100%)", minHeight: "100vh", padding: 24 }}>
      <div style={topbarStyle}>
        <div>
          <Link to="/auftraege" style={secondaryButtonStyle}>
            Zurück zu den Aufträgen
          </Link>
        </div>

        
      </div>

      {/* gastario-selected-order-details-view-20260714 */}
      {isAlreadyConfirmed ? (
        <section
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            overflow: "hidden",
            border: "1px solid #d9e5e0",
            borderRadius: 24,
            background: "#ffffff",
            boxShadow: "0 20px 50px rgba(20, 42, 33, 0.08)",
          }}
        >
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
              alignItems: "flex-start",
              padding: "28px 30px 24px",
              borderBottom: "1px solid #e3ebe7",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 26,
                  padding: "0 11px",
                  border: "1px solid #bfe3d6",
                  borderRadius: 999,
                  background: "#eef9f5",
                  color: "#087158",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Auftragsdetails
              </div>

              <div
                style={{
                  marginTop: 17,
                  color: "#557269",
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: "0.045em",
                }}
              >
                {order.orderNumber}
              </div>

              <h1
                style={{
                  margin: "5px 0 0",
                  color: "#102019",
                  fontSize: 34,
                  lineHeight: 1.08,
                  letterSpacing: "-0.045em",
                }}
              >
                {order.customerName || "Kunde unbekannt"}
              </h1>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#71817a",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {order.contactName || "Keine Kontaktperson eingetragen"}
              </p>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 30,
                padding: "0 12px",
                borderRadius: 999,
                background: "#eaf6f1",
                color: "#315c4f",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              {order.platformName || String(order.source || "Direkt")}
            </span>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 280px",
              gap: 24,
              padding: "24px 30px 28px",
            }}
          >
            <section>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 14,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    color: "#172820",
                    fontSize: 21,
                    letterSpacing: "-0.035em",
                  }}
                >
                  Positionen
                </h2>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: 27,
                    padding: "0 10px",
                    border: "1px solid #c5e7db",
                    borderRadius: 999,
                    background: "#eff9f5",
                    color: "#087158",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  {visibleItems.length} Positionen
                </span>
              </div>

              <div
                style={{
                  overflow: "hidden",
                  border: "1px solid #e0e8e4",
                  borderRadius: 17,
                  background: "#ffffff",
                }}
              >
                {visibleItems.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "70px minmax(190px, .8fr) minmax(240px, 1.4fr) 100px",
                      gap: 16,
                      alignItems: "start",
                      padding: "16px 17px",
                      borderBottom:
                        index === visibleItems.length - 1
                          ? "none"
                          : "1px solid #edf2ef",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          display: "block",
                          color: "#102019",
                          fontSize: 15,
                        }}
                      >
                        {item.quantity}x
                      </strong>

                      <span
                        style={{
                          display: "block",
                          marginTop: 3,
                          color: "#829089",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {item.unit}
                      </span>
                    </div>

                    <strong
                      style={{
                        color: "#1b3027",
                        fontSize: 14,
                        lineHeight: 1.4,
                      }}
                    >
                      {item.name}
                    </strong>

                    <p
                      style={{
                        margin: 0,
                        color: "#65776f",
                        fontSize: 11,
                        lineHeight: 1.5,
                      }}
                    >
                      {item.notes
                        ? String(item.notes).length > 160
                          ? String(item.notes).slice(0, 160) + "…"
                          : item.notes
                        : "Keine weiteren Hinweise"}
                    </p>

                    <strong
                      style={{
                        color: "#172820",
                        fontSize: 14,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {centsToEuro(item.totalCents)}
                    </strong>
                  </div>
                ))}
              </div>
            </section>

            <aside
              style={{
                display: "grid",
                alignContent: "start",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: 17,
                  border: "1px solid #dce7e2",
                  borderRadius: 16,
                  background: "#f8fbfa",
                }}
              >
                <span
                  style={{
                    color: "#74877f",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Lieferung
                </span>

                <strong
                  style={{
                    display: "block",
                    marginTop: 7,
                    color: "#172820",
                    fontSize: 15,
                  }}
                >
                  {formatDate(order.deliveryDate)}
                </strong>

                <small
                  style={{
                    display: "block",
                    marginTop: 4,
                    color: "#667970",
                    fontSize: 12,
                    fontWeight: 750,
                  }}
                >
                  {order.deliveryTimeText || "Uhrzeit offen"}
                </small>
              </div>

              <div
                style={{
                  padding: 17,
                  border: "1px solid #dce7e2",
                  borderRadius: 16,
                  background: "#f8fbfa",
                }}
              >
                <span
                  style={{
                    color: "#74877f",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Lieferadresse
                </span>

                <strong
                  style={{
                    display: "block",
                    marginTop: 7,
                    color: "#172820",
                    fontSize: 14,
                  }}
                >
                  {order.customerName || "Kunde unbekannt"}
                </strong>

                <small
                  style={{
                    display: "block",
                    marginTop: 5,
                    color: "#667970",
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.45,
                  }}
                >
                  {order.deliveryAddress || "Keine Lieferadresse eingetragen"}
                </small>

                {order.contactPhone ? (
                  <small
                    style={{
                      display: "block",
                      marginTop: 7,
                      color: "#087158",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    Telefon: {order.contactPhone}
                  </small>
                ) : null}
              </div>

              <div
                style={{
                  padding: 17,
                  border: "1px solid #c8e5da",
                  borderRadius: 16,
                  background: "#eef8f4",
                }}
              >
                <span
                  style={{
                    color: "#548071",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Gesamt
                </span>

                <strong
                  style={{
                    display: "block",
                    marginTop: 7,
                    color: "#0b664e",
                    fontSize: 23,
                    letterSpacing: "-0.035em",
                  }}
                >
                  {centsToEuro(total)}
                </strong>

                <small
                  style={{
                    display: "block",
                    marginTop: 4,
                    color: "#5d786f",
                    fontSize: 10,
                    fontWeight: 800,
                  }}
                >
                  Bestätigter Auftrag
                </small>
              </div>
            </aside>
          </div>

          <footer
            style={{
              display: "grid",
              gridTemplateColumns:
                "150px minmax(180px, 1fr) minmax(180px, 1fr) minmax(200px, 1fr)",
              gap: 10,
              padding: "16px 20px",
              borderTop: "1px solid #e3ebe7",
              background: "#f8fbfa",
            }}
          >
            <Link
              to="/auftraege"
              style={{
                ...secondaryButtonStyle,
                justifyContent: "center",
              }}
            >
              Zurück zur Liste
            </Link>

            <a
              href={deliveryHref}
              target="_blank"
              rel="noreferrer"
              style={{
                ...secondaryButtonStyle,
                justifyContent: "center",
              }}
            >
              Lieferschein öffnen
            </a>

            <Link
              to={"/auftraege/" + order.id + "/foodlabels"}
              style={{
                ...primaryButtonStyle,
                justifyContent: "center",
              }}
            >
              Foodlabels erstellen
            </Link>

            <button
              type="button"
              onClick={() => window.print()}
              style={{
                ...primaryButtonStyle,
                justifyContent: "center",
                border: "1px solid #087158",
                cursor: "pointer",
              }}
            >
              Drucken / als PDF speichern
            </button>
          </footer>
        </section>
      ) : (
      <section className="orderReviewWorkspace" style={{ maxWidth: 1180, margin: "0 auto", background: "#fff", borderRadius: 22, padding: 34, boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)", border: "1px solid #dbe7ec" }}>
        <p style={{ margin: 0, color: "#057a67", fontWeight: 900, textTransform: "uppercase", fontSize: 12 }}>
          {isAlreadyConfirmed
            ? "Auftragsdetails"
            : "Auftragsprüfung"}
        </p>

        <h1 style={{ margin: "6px 0 4px", fontSize: 42, letterSpacing: "-0.04em", color: "#071633" }}>{order.orderNumber}</h1>
        <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>{tenant?.name || "Gastario"}</p>

        {isAlreadyConfirmed ? (
          <div
            style={{
              marginTop: 20,
              padding: "14px 16px",
              borderRadius: 14,
              background: "#eef9f5",
              color: "#087158",
              fontWeight: 850,
              border: "1px solid #bfe6d8",
            }}
          >
            Dieser Auftrag wurde bereits übernommen und ist für die Ausführung eingeplant.
          </div>
        ) : (
          <div
            style={{
              marginTop: 20,
              padding: "14px 16px",
              borderRadius: 14,
              background: "#fff7ed",
              color: "#9a3412",
              fontWeight: 850,
              border: "1px solid #fed7aa",
            }}
          >
            Bitte vor Übernahme prüfen: Kunde, Lieferadresse, Datum, Uhrzeit und Positionen.
          </div>
        )}

        {!isAlreadyConfirmed && !canConfirmOrder ? (
          <div style={dangerBoxStyle}>
            <strong>Nicht übernehmen: Erst Daten ergänzen.</strong>
            <ul style={dangerListStyle}>
              {missingChecks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {reviewState.hints.length > 0 ? (
              <div style={dangerHintBoxStyle}>
                {reviewState.hints.map((hint) => (
                  <div key={hint}>{hint}</div>
                ))}
              </div>
            ) : null}

            {blocked ? (
              <div style={dangerSmallStyle}>
                Der Auftrag wurde nicht übernommen, weil wichtige Daten fehlen.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="orderReviewInfoGrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 20 }}>
          <Info label="Kunde" value={order.customerName} />
          <Info label="Quelle" value={order.platformName || order.source} />
          <Info label="Status" value={order.status} />
          <Info label="Lieferdatum" value={formatDate(order.deliveryDate)} />
          <Info label="Lieferzeit" value={order.deliveryTimeText || "-"} />
          <Info label="Lieferadresse" value={order.deliveryAddress || "-"} />
          <Info label="Kontakt" value={order.contactName || "-"} />
          <Info label="Telefon" value={order.contactPhone || "-"} />
          <Info label="Summe" value={centsToEuro(total)} />
        </div>

        <div className="orderReviewContentGrid" style={contentGridStyle}>
          <section className="orderReviewPositionsCard" style={positionsCardStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Positionen</h2>
              <span style={countBadgeStyle}>{visibleItems.length} Positionen</span>
            </div>

            <table className="orderReviewTable" style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Menge</th>
                  <th style={thStyle}>Position</th>
                  <th style={thStyle}>Hinweis / Rohdaten</th>
                  <th style={thRightStyle}>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id} style={tableRowStyle}>
                    <td style={tdStyle}>
                      <strong>{item.quantity}</strong>
                      <div style={mutedCellStyle}>{item.unit}</div>
                    </td>
                    <td style={tdStyle}><strong>{item.name}</strong></td>
                    <td style={tdMutedStyle}>
                      {item.notes
                        ? String(item.notes).length > 180
                          ? String(item.notes).slice(0, 180) + "..."
                          : item.notes
                        : "-"}
                    </td>
                    <td style={tdRightStyle}>{centsToEuro(item.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {!isAlreadyConfirmed ? (
            <aside
              className="orderReviewChecklistCard"
              style={checklistCardStyle}
            >
              <div className="orderReviewChecklistHeader">
                <div>
                  <p className="orderReviewEyebrow">
                    Freigabe
                  </p>

                  <h2 style={sectionTitleStyle}>
                    Prüfung abschließen
                  </h2>
                </div>

                <span
                  className={
                    allReviewChecksCompleted
                      ? "orderReviewProgressBadge complete"
                      : "orderReviewProgressBadge"
                  }
                >
                  {completedReviewChecks} von 5
                </span>
              </div>

              <div className="orderReviewProgress">
                <span
                  style={{
                    width: completedReviewChecks * 20 + "%",
                  }}
                />
              </div>

              <div className="orderReviewChecks">
                <label className="orderReviewCheck">
                  <input
                    type="checkbox"
                    checked={reviewChecks.customer}
                    onChange={(event) =>
                      updateReviewCheck(
                        "customer",
                        event.currentTarget.checked
                      )
                    }
                  />

                  <span>
                    <strong>Kunde stimmt</strong>
                    <small>
                      Firmenname und Kontakt wurden geprüft.
                    </small>
                  </span>
                </label>

                <label className="orderReviewCheck">
                  <input
                    type="checkbox"
                    checked={reviewChecks.deliveryAddress}
                    onChange={(event) =>
                      updateReviewCheck(
                        "deliveryAddress",
                        event.currentTarget.checked
                      )
                    }
                  />

                  <span>
                    <strong>Lieferadresse stimmt</strong>
                    <small>
                      Standort, Straße und PLZ sind korrekt.
                    </small>
                  </span>
                </label>

                <label className="orderReviewCheck">
                  <input
                    type="checkbox"
                    checked={reviewChecks.deliverySchedule}
                    onChange={(event) =>
                      updateReviewCheck(
                        "deliverySchedule",
                        event.currentTarget.checked
                      )
                    }
                  />

                  <span>
                    <strong>
                      Datum und Uhrzeit stimmen
                    </strong>
                    <small>
                      Der Liefertermin wurde abgeglichen.
                    </small>
                  </span>
                </label>

                <label className="orderReviewCheck">
                  <input
                    type="checkbox"
                    checked={reviewChecks.items}
                    onChange={(event) =>
                      updateReviewCheck(
                        "items",
                        event.currentTarget.checked
                      )
                    }
                  />

                  <span>
                    <strong>
                      Positionen und Mengen stimmen
                    </strong>
                    <small>
                      Produkte, Anzahl und Preise wurden geprüft.
                    </small>
                  </span>
                </label>

                <label className="orderReviewCheck">
                  <input
                    type="checkbox"
                    checked={reviewChecks.notes}
                    onChange={(event) =>
                      updateReviewCheck(
                        "notes",
                        event.currentTarget.checked
                      )
                    }
                  />

                  <span>
                    <strong>
                      Hinweise und Allergene geprüft
                    </strong>
                    <small>
                      Besonderheiten wurden berücksichtigt.
                    </small>
                  </span>
                </label>
              </div>

              {!canConfirmOrder ? (
                <div className="orderReviewBlocked">
                  <strong>
                    Auftrag noch nicht freigabefähig
                  </strong>

                  <span>
                    Fehlende Pflichtangaben müssen zuerst
                    ergänzt werden.
                  </span>
                </div>
              ) : null}

              <Form method="post">
                <input
                  type="hidden"
                  name="_intent"
                  value="confirmOrder"
                />

                <button
                  type="submit"
                  className="orderReviewConfirmButton"
                  disabled={
                    !canConfirmOrder ||
                    !allReviewChecksCompleted ||
                    isConfirming
                  }
                >
                  {isConfirming
                    ? "Auftrag wird übernommen..."
                    : "Auftrag bestätigen und übernehmen"}
                </button>
              </Form>

              <p className="orderReviewHint">
                Nach der Bestätigung erscheint der Auftrag
                unter den bevorstehenden Aufträgen.
              </p>
            </aside>
          ) : (
            <aside style={checklistCardStyle}>
              <h2 style={sectionTitleStyle}>
                Auftragsstatus
              </h2>

              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  borderRadius: 16,
                  border: "1px solid #bfe6d8",
                  background: "#eef9f5",
                }}
              >
                <div
                  style={{
                    color: "#087158",
                    fontSize: 13,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Bestätigt
                </div>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#47675d",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.55,
                  }}
                >
                  Der Auftrag wurde übernommen. Änderungen können über
                  die Auftragsdaten vorgenommen werden.
                </p>
              </div>

              
            </aside>
          )}
        </div>
      </section>
      )}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const isStatus = label === "Status";

  return (
    <div style={infoCardStyle}>
      <div style={infoIconStyle}>{label.slice(0, 1)}</div>
      <div style={{ minWidth: 0 }}>
        <div style={infoLabelStyle}>{label}</div>
        {isStatus ? (
          <strong style={statusBadgeStyle}>{value || "-"}</strong>
        ) : (
          <strong style={infoValueStyle}>{value || "-"}</strong>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #cbd5e1",
  padding: "10px 8px",
  color: "#475569",
  fontSize: 12,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #edf2f7",
  padding: "14px 8px",
  verticalAlign: "top",
  fontSize: 13,
  color: "#0f172a",
};


const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2.1fr) minmax(300px, 0.9fr)",
  gap: 20,
  alignItems: "start",
  marginTop: 28,
};

const positionsCardStyle: React.CSSProperties = {
  border: "1px solid #dbe7ec",
  borderRadius: 22,
  padding: 20,
  background: "#ffffff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
  overflow: "hidden",
};

const checklistCardStyle: React.CSSProperties = {
  border: "1px solid #dbe7ec",
  borderRadius: 22,
  padding: 20,
  background: "#ffffff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
  position: "sticky",
  top: 20,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "#071633",
  letterSpacing: "-0.03em",
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdMutedStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#334155",
  lineHeight: 1.45,
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontWeight: 900,
  whiteSpace: "nowrap",
  color: "#071633",
};

const mutedCellStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 3,
  fontWeight: 650,
};

const checkListStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  fontWeight: 800,
};

const checkItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "14px 0",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  fontWeight: 850,
};

const checkHintStyle: React.CSSProperties = {
  margin: "18px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
};


const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 14,
};

const countBadgeStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#047857",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 900,
};

const tableRowStyle: React.CSSProperties = {
  background: "#ffffff",
};

const checkBoxStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 5,
  border: "2px solid #cbd5e1",
  background: "#ffffff",
  display: "inline-block",
  flex: "0 0 auto",
};

const infoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe7ec",
  borderRadius: 16,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  gap: 12,
  alignItems: "center",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.035)",
};

const infoIconStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  background: "#e6f7f3",
  color: "#057a67",
  display: "grid",
  placeItems: "center",
  fontWeight: 950,
  fontSize: 13,
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 850,
  marginBottom: 3,
};

const infoValueStyle: React.CSSProperties = {
  color: "#071633",
  fontSize: 16,
  lineHeight: 1.25,
  wordBreak: "break-word",
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  borderRadius: 999,
  padding: "4px 9px",
  background: "#dcfce7",
  color: "#047857",
  border: "1px solid #86efac",
  fontSize: 12,
  fontWeight: 950,
};


const topbarStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
};

const backLinkStyle: React.CSSProperties = {
  fontWeight: 850,
  color: "#057a67",
  textDecoration: "none",
};

const actionBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #057a67",
  background: "#057a67",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 850,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 850,
  textDecoration: "none",
};

const printButtonStyle: React.CSSProperties = {
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 850,
  cursor: "pointer",
};

const disabledButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#e2e8f0",
  color: "#64748b",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 850,
  cursor: "not-allowed",
};

const dangerBoxStyle: React.CSSProperties = {
  marginTop: 14,
  padding: "14px 16px",
  borderRadius: 14,
  background: "#fef2f2",
  color: "#991b1b",
  fontWeight: 850,
  border: "1px solid #fecaca",
};

const dangerListStyle: React.CSSProperties = {
  margin: "8px 0 0",
  paddingLeft: 20,
  lineHeight: 1.6,
};

const dangerSmallStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  color: "#7f1d1d",
};

const dangerHintBoxStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontSize: 13,
  lineHeight: 1.55,
};





