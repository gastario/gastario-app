import { Form, Link, redirect, useLoaderData } from "react-router";

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
      },
    });

    return redirect("/auftraege");
  }

  return redirect("/auftrag-pruefung/" + params.orderId);
}

export default function AuftragPruefungPage() {
  const { tenant, order, blocked } = useLoaderData<typeof loader>();
  const total = order.items.reduce((sum, item) => sum + (item.totalCents || 0), 0);
  const reviewState = getOrderReviewState(order);
  const missingChecks = reviewState.missing;
  const canConfirmOrder = missingChecks.length === 0;
  const deliveryHref = "/lieferscheine" + (order.deliveryDate ? "?date=" + formatDateInput(order.deliveryDate) : "");

  return (
    <main style={{ background: "linear-gradient(180deg, #eef6f8 0%, #f8fbfc 100%)", minHeight: "100vh", padding: 24 }}>
      <div style={topbarStyle}>
        <Link to="/auftragseingang" style={backLinkStyle}>
          Zurueck zum Auftragseingang
        </Link>

        <div style={actionBarStyle}>
          <Link to={deliveryHref} style={secondaryButtonStyle}>
            Lieferschein oeffnen
          </Link>

          <Form method="post">
            <input type="hidden" name="_intent" value="confirmOrder" />
            <button
              type="submit"
              disabled={!canConfirmOrder}
              style={canConfirmOrder ? primaryButtonStyle : disabledButtonStyle}
              title={canConfirmOrder ? "Auftrag uebernehmen" : "Erst Daten ergaenzen"}
            >
              {canConfirmOrder ? "Auftrag uebernehmen" : "Erst Daten ergaenzen"}
            </button>
          </Form>

          <button type="button" onClick={() => window.print()} style={printButtonStyle}>
            Drucken / als PDF speichern
          </button>
        </div>
      </div>

      <section style={{ maxWidth: 1180, margin: "0 auto", background: "#fff", borderRadius: 22, padding: 34, boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)", border: "1px solid #dbe7ec" }}>
        <p style={{ margin: 0, color: "#057a67", fontWeight: 900, textTransform: "uppercase", fontSize: 12 }}>
          Auftragspruefung
        </p>

        <h1 style={{ margin: "6px 0 4px", fontSize: 42, letterSpacing: "-0.04em", color: "#071633" }}>{order.orderNumber}</h1>
        <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>{tenant?.name || "Gastario"}</p>

        <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 14, background: "#fff7ed", color: "#9a3412", fontWeight: 850, border: "1px solid #fed7aa" }}>
          Bitte vor Uebernahme pruefen: Kunde, Lieferadresse, Datum, Uhrzeit und Positionen.
        </div>

        {!canConfirmOrder ? (
          <div style={dangerBoxStyle}>
            <strong>Nicht uebernehmen: Erst Daten ergaenzen.</strong>
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
                Der Auftrag wurde nicht uebernommen, weil wichtige Daten fehlen.
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 20 }}>
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

        <div style={contentGridStyle}>
          <section style={positionsCardStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Positionen</h2>
              <span style={countBadgeStyle}>{order.items.length} Positionen</span>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Menge</th>
                  <th style={thStyle}>Position</th>
                  <th style={thStyle}>Hinweis / Rohdaten</th>
                  <th style={thRightStyle}>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} style={tableRowStyle}>
                    <td style={tdStyle}>
                      <strong>{item.quantity}</strong>
                      <div style={mutedCellStyle}>{item.unit}</div>
                    </td>
                    <td style={tdStyle}><strong>{item.name}</strong></td>
                    <td style={tdMutedStyle}>{item.notes || "-"}</td>
                    <td style={tdRightStyle}>{centsToEuro(item.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside style={checklistCardStyle}>
            <h2 style={sectionTitleStyle}>Checkliste</h2>

            <div style={checkListStyle}>
              <div style={checkItemStyle}><span style={checkBoxStyle}></span><span>Kunde stimmt</span></div>
              <div style={checkItemStyle}><span style={checkBoxStyle}></span><span>Lieferadresse stimmt</span></div>
              <div style={checkItemStyle}><span style={checkBoxStyle}></span><span>Lieferdatum und Lieferzeit stimmen</span></div>
              <div style={checkItemStyle}><span style={checkBoxStyle}></span><span>Positionen stimmen</span></div>
              <div style={checkItemStyle}><span style={checkBoxStyle}></span><span>Hinweise / Allergene geprueft</span></div>
            </div>

            <p style={checkHintStyle}>
              Bitte alle Punkte pruefen, bevor der Auftrag uebernommen wird.
            </p>
          </aside>
        </div>
      </section>
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
