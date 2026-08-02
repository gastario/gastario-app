import { useState } from "react";
import {
  Form,
  Link,
  redirect,
  useLoaderData,
  useNavigation,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

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
  const { tenant, order, blocked } =
    useLoaderData<typeof loader>();

  const navigation = useNavigation();

  const total = order.items.reduce(
    (sum, item) =>
      sum + (item.totalCents || 0),
    0
  );

  const correctionItems =
    order.items.filter((item) =>
      isHeycaterCorrectionItem(item)
    );

  const visibleItems =
    order.items.filter((item) =>
      !isHeycaterCorrectionItem(item)
    );

  const correctionTotal =
    correctionItems.reduce(
      (sum, item) =>
        sum + (item.totalCents || 0),
      0
    );

  const hasHeycaterCorrection =
    correctionTotal > 0;

  const reviewState =
    getOrderReviewState(order);

  const missingChecks =
    reviewState.missing;

  const canConfirmOrder =
    missingChecks.length === 0;

  const [reviewChecks, setReviewChecks] =
    useState({
      customer: false,
      deliveryAddress: false,
      deliverySchedule: false,
      items: false,
      notes: false,
    });

  const completedReviewChecks =
    Object.values(reviewChecks).filter(
      Boolean
    ).length;

  const allReviewChecksCompleted =
    completedReviewChecks === 5;

  const isConfirming =
    navigation.state !== "idle" &&
    navigation.formData?.get(
      "_intent"
    ) === "confirmOrder";

  const isAlreadyConfirmed = [
    "CONFIRMED",
    "IN_PRODUCTION",
    "PACKING_OPEN",
    "DELIVERED",
  ].includes(String(order.status));

  const deliveryHref =
    "/lieferscheine/" +
    order.id +
    "/pdf";

  const sourceLabel =
    order.platformName ||
    String(order.source || "Direkt");

  const statusLabel =
    formatOrderStatus(order.status);

  function updateReviewCheck(
    key: keyof typeof reviewChecks,
    value: boolean
  ) {
    setReviewChecks((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <AppLayout>
      <PageShell className="orderReviewMasterPage">
        <PageHeader
          eyebrow={
            isAlreadyConfirmed
              ? "Auftragsdetails"
              : "Auftragsprüfung"
          }
          title={
            order.customerName ||
            "Kunde unbekannt"
          }
          subtitle={
            <>
              {order.orderNumber}
              {" · "}
              {tenant?.name || "Gastario"}
              {" · "}
              {sourceLabel}
            </>
          }
          actions={
            <div className="orderReviewHeaderActions">
              <Link
                to="/auftraege"
                className="orderReviewButton orderReviewButtonSecondary"
              >
                Zurück zu den Aufträgen
              </Link>

              <span
                className={
                  "orderReviewStatus " +
                  `orderReviewStatus--${String(
                    order.status || "open"
                  ).toLowerCase()}`
                }
              >
                {statusLabel}
              </span>
            </div>
          }
        />

        {!isAlreadyConfirmed ? (
          <Notice type="warning">
            Prüfe vor der Übernahme Kunde,
            Lieferadresse, Termin,
            Positionen und Hinweise.
          </Notice>
        ) : (
          <Notice type="success">
            Dieser Auftrag wurde bereits
            übernommen und ist für die
            Ausführung eingeplant.
          </Notice>
        )}

        {!isAlreadyConfirmed &&
        !canConfirmOrder ? (
          <Notice
            type="danger"
            className="orderReviewMissingNotice"
          >
            <strong>
              Auftrag noch nicht
              freigabefähig
            </strong>

            <ul>
              {missingChecks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            {reviewState.hints.length > 0 ? (
              <div className="orderReviewMissingHints">
                {reviewState.hints.map(
                  (hint) => (
                    <p key={hint}>
                      {hint}
                    </p>
                  )
                )}
              </div>
            ) : null}

            {blocked ? (
              <p className="orderReviewBlockedHint">
                Der Auftrag wurde nicht
                übernommen, weil wichtige
                Daten fehlen.
              </p>
            ) : null}
          </Notice>
        ) : null}

        <MetricGrid className="orderReviewMetrics">
          <MetricCard
            label="Lieferdatum"
            value={formatDate(
              order.deliveryDate
            )}
            description={
              order.deliveryTimeText ||
              "Uhrzeit offen"
            }
            badge="Termin"
            attention={
              !order.deliveryDate ||
              !order.deliveryTimeText
            }
          />

          <MetricCard
            label="Positionen"
            value={visibleItems.length}
            description="bestellte Leistungen"
            badge="Auftrag"
            attention={
              visibleItems.length === 0
            }
          />

          <MetricCard
            label="Auftragswert"
            value={centsToEuro(total)}
            description="Gesamtsumme"
            badge="EUR"
            attention={total <= 0}
          />

          <MetricCard
            label="Kontakt"
            value={
              order.contactName || "–"
            }
            description={
              order.contactPhone ||
              "Kein Telefon hinterlegt"
            }
            badge="Kunde"
            attention={!order.contactName}
          />
        </MetricGrid>

        <div className="orderReviewLayout">
          <div className="orderReviewMainColumn">
            <PageSection
              eyebrow="Auftragsdaten"
              title="Lieferung und Kontakt"
              description="Alle zentralen Angaben für die operative Ausführung."
            >
              <div className="orderReviewFacts">
                <OrderFact
                  label="Kunde"
                  value={
                    order.customerName || "–"
                  }
                />

                <OrderFact
                  label="Kontakt"
                  value={
                    order.contactName || "–"
                  }
                />

                <OrderFact
                  label="Telefon"
                  value={
                    order.contactPhone || "–"
                  }
                />

                <OrderFact
                  label="Quelle"
                  value={sourceLabel}
                />

                <OrderFact
                  label="Status"
                  value={statusLabel}
                />

                <OrderFact
                  label="Lieferdatum"
                  value={formatDate(
                    order.deliveryDate
                  )}
                />

                <OrderFact
                  label="Lieferzeit"
                  value={
                    order.deliveryTimeText ||
                    "–"
                  }
                />

                <OrderFact
                  label="Lieferadresse"
                  value={
                    order.deliveryAddress ||
                    "–"
                  }
                  wide
                />
              </div>
            </PageSection>

            <PageSection
              eyebrow="Leistungen"
              title="Positionen"
              description={
                visibleItems.length === 1
                  ? "1 Position im Auftrag"
                  : `${visibleItems.length} Positionen im Auftrag`
              }
              actions={
                <span className="orderReviewCountBadge">
                  {visibleItems.length}
                </span>
              }
            >
              {visibleItems.length > 0 ? (
                <div className="orderReviewItems">
                  <div className="orderReviewItemsHeader">
                    <span>Menge</span>
                    <span>Position</span>
                    <span>Hinweis</span>
                    <span>Betrag</span>
                  </div>

                  {visibleItems.map(
                    (item, index) => (
                      <article
                        key={item.id}
                        className="orderReviewItem"
                      >
                        <div className="orderReviewItemQuantity">
                          <strong>
                            {item.quantity}x
                          </strong>

                          <span>
                            {item.unit}
                          </span>
                        </div>

                        <div className="orderReviewItemName">
                          <small>
                            Position {index + 1}
                          </small>

                          <strong>
                            {item.name}
                          </strong>
                        </div>

                        <p className="orderReviewItemNotes">
                          {item.notes
                            ? String(
                                item.notes
                              ).length > 180
                              ? String(
                                  item.notes
                                ).slice(
                                  0,
                                  180
                                ) + "…"
                              : item.notes
                            : "Keine weiteren Hinweise"}
                        </p>

                        <strong className="orderReviewItemTotal">
                          {centsToEuro(
                            item.totalCents
                          )}
                        </strong>
                      </article>
                    )
                  )}
                </div>
              ) : (
                <div className="orderReviewEmptyState">
                  Keine echten
                  Auftragspositionen erkannt.
                </div>
              )}

              {hasHeycaterCorrection ? (
                <div className="orderReviewCorrection">
                  <div>
                    <strong>
                      Heycater-Summenabgleich
                    </strong>

                    <span>
                      Der Korrekturwert wird in
                      der Gesamtsumme
                      berücksichtigt.
                    </span>
                  </div>

                  <strong>
                    {centsToEuro(
                      correctionTotal
                    )}
                  </strong>
                </div>
              ) : null}
            </PageSection>

            {isAlreadyConfirmed ? (
              <PageSection
                eyebrow="Dokumente"
                title="Auftrag weiterverarbeiten"
                description="Lieferschein, Kennzeichnung und Ausdruck für den operativen Ablauf."
              >
                <div className="orderReviewActionGrid">
                  <a
                    href={deliveryHref}
                    target="_blank"
                    rel="noreferrer"
                    className="orderReviewButton orderReviewButtonSecondary"
                  >
                    Lieferschein öffnen
                  </a>

                  <Link
                    to={
                      "/auftraege/" +
                      order.id +
                      "/foodlabels"
                    }
                    className="orderReviewButton orderReviewButtonPrimary"
                  >
                    Foodlabels erstellen
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      window.print()
                    }
                    className="orderReviewButton orderReviewButtonPrimary"
                  >
                    Drucken / als PDF speichern
                  </button>
                </div>
              </PageSection>
            ) : null}
          </div>

          <aside className="orderReviewSideColumn">
            {!isAlreadyConfirmed ? (
              <PageSection
                className="orderReviewApprovalCard"
                eyebrow="Freigabe"
                title="Prüfung abschließen"
                description="Alle fünf Punkte bestätigen und anschließend die Abrechnung festlegen."
                actions={
                  <span
                    className={
                      allReviewChecksCompleted
                        ? "orderReviewProgressBadge isComplete"
                        : "orderReviewProgressBadge"
                    }
                  >
                    {completedReviewChecks} von 5
                  </span>
                }
              >
                <progress
                  className="orderReviewProgress"
                  max={5}
                  value={
                    completedReviewChecks
                  }
                >
                  {completedReviewChecks} von 5
                </progress>

                <div className="orderReviewChecks">
                  <ReviewCheck
                    checked={
                      reviewChecks.customer
                    }
                    title="Kunde stimmt"
                    description="Firmenname und Kontakt wurden geprüft."
                    onChange={(value) =>
                      updateReviewCheck(
                        "customer",
                        value
                      )
                    }
                  />

                  <ReviewCheck
                    checked={
                      reviewChecks.deliveryAddress
                    }
                    title="Lieferadresse stimmt"
                    description="Standort, Straße und PLZ sind korrekt."
                    onChange={(value) =>
                      updateReviewCheck(
                        "deliveryAddress",
                        value
                      )
                    }
                  />

                  <ReviewCheck
                    checked={
                      reviewChecks.deliverySchedule
                    }
                    title="Datum und Uhrzeit stimmen"
                    description="Der Liefertermin wurde abgeglichen."
                    onChange={(value) =>
                      updateReviewCheck(
                        "deliverySchedule",
                        value
                      )
                    }
                  />

                  <ReviewCheck
                    checked={
                      reviewChecks.items
                    }
                    title="Positionen und Mengen stimmen"
                    description="Produkte, Anzahl und Preise wurden geprüft."
                    onChange={(value) =>
                      updateReviewCheck(
                        "items",
                        value
                      )
                    }
                  />

                  <ReviewCheck
                    checked={
                      reviewChecks.notes
                    }
                    title="Hinweise und Allergene geprüft"
                    description="Besonderheiten wurden berücksichtigt."
                    onChange={(value) =>
                      updateReviewCheck(
                        "notes",
                        value
                      )
                    }
                  />
                </div>

                {!canConfirmOrder ? (
                  <div className="orderReviewApprovalBlocked">
                    <strong>
                      Noch nicht freigabefähig
                    </strong>

                    <span>
                      Fehlende Pflichtangaben
                      müssen zuerst ergänzt
                      werden.
                    </span>
                  </div>
                ) : null}

                <Form
                  method="post"
                  className="orderReviewApprovalForm"
                >
                  <input
                    type="hidden"
                    name="_intent"
                    value="confirmOrder"
                  />

                  <label className="orderReviewField">
                    <span>
                      Abrechnung nach Übernahme
                    </span>

                    <select
                      name="billingMode"
                      defaultValue="UNDECIDED"
                    >
                      <option value="UNDECIDED">
                        Später entscheiden
                      </option>

                      <option value="DIRECT_INVOICE">
                        Gastario-Rechnung erstellen
                      </option>

                      <option value="EXTERNAL_INVOICE">
                        Extern fakturiert
                      </option>

                      <option value="PLATFORM_CREDIT">
                        Plattform-Gutschrift
                      </option>

                      <option value="NO_INVOICE">
                        Keine Rechnung erforderlich
                      </option>
                    </select>
                  </label>

                  <button
                    type="submit"
                    className="orderReviewButton orderReviewButtonPrimary orderReviewConfirmButton"
                    disabled={
                      !canConfirmOrder ||
                      !allReviewChecksCompleted ||
                      isConfirming
                    }
                  >
                    {isConfirming
                      ? "Auftrag wird übernommen …"
                      : "Auftrag bestätigen und übernehmen"}
                  </button>
                </Form>

                <p className="orderReviewFinePrint">
                  Nach der Bestätigung erscheint
                  der Auftrag unter den
                  bevorstehenden Aufträgen.
                </p>
              </PageSection>
            ) : (
              <PageSection
                className="orderReviewStatusCard"
                eyebrow="Auftragsstatus"
                title={statusLabel}
                description="Der Auftrag ist übernommen und steht für die operative Bearbeitung bereit."
              >
                <div className="orderReviewStatusSummary">
                  <span>Auftragsnummer</span>
                  <strong>
                    {order.orderNumber}
                  </strong>
                </div>

                <div className="orderReviewStatusSummary">
                  <span>Quelle</span>
                  <strong>
                    {sourceLabel}
                  </strong>
                </div>

                <div className="orderReviewStatusSummary orderReviewStatusSummaryTotal">
                  <span>Gesamt</span>
                  <strong>
                    {centsToEuro(total)}
                  </strong>
                </div>
              </PageSection>
            )}
          </aside>
        </div>
      </PageShell>
    </AppLayout>
  );
}

function OrderFact({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "orderReviewFact orderReviewFactWide"
          : "orderReviewFact"
      }
    >
      <span>{label}</span>
      <strong>{value || "–"}</strong>
    </div>
  );
}

function ReviewCheck({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="orderReviewCheck">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.currentTarget.checked
          )
        }
      />

      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function formatOrderStatus(
  value: unknown
) {
  const status = String(value || "");

  const labels: Record<string, string> = {
    AUTO_CREATED: "Automatisch erkannt",
    REVIEW_NEEDED: "Zu prüfen",
    INCOMPLETE: "Unvollständig",
    POSSIBLE_DUPLICATE:
      "Mögliches Duplikat",
    CONFIRMED: "Bestätigt",
    IN_PRODUCTION: "In Produktion",
    PACKING_OPEN: "Packen offen",
    DELIVERED: "Geliefert",
    CANCELLED: "Storniert",
    REJECTED: "Abgelehnt",
  };

  return labels[status] || status || "Offen";
}
