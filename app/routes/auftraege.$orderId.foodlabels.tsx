import { Link, redirect, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

function isPlaceholderOrderItem(item: any) {
  const text = normalizeText([item?.name, item?.unit, item?.notes].join(" "));

  return (
    text.includes("pruefung") ||
    text.includes("prufung") ||
    text.includes("platzhalter") ||
    text.includes("positionen bitte") ||
    text.includes("fast track order") ||
    text.includes("e-mail auftrag") ||
    text.includes("email auftrag") ||
    text.includes("fehlende position") ||
    text.includes("heycater-pdf")
  );
}

function getDefaultAllergens(orderAllergens: string | null | undefined, itemNotes: string | null | undefined) {
  const notes = String(itemNotes || "").trim();
  const allergens = String(orderAllergens || "").trim();

  if (notes && /allergen|gluten|soja|soy|sesam|milch|milk|ei|egg|nuss|nuts|sellerie|celery|senf|mustard/i.test(notes)) {
    return notes;
  }

  return allergens;
}

export function meta() {
  return [{ title: "Foodlabels aus Auftrag - Gastario" }];
}

export async function loader({ request, params }: { request: Request; params: { orderId?: string } }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!tenantUser) {
    throw new Response("Kein Mandant gefunden", { status: 403 });
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

  const items = order.items
    .filter((item: any) => !isPlaceholderOrderItem(item))
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || "Stueck",
      notes: item.notes || "",
      allergens: getDefaultAllergens(order.allergens, item.notes),
    }));

  return {
    tenantName: tenantUser.tenant.name,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      externalOrderNumber: order.externalOrderNumber,
      source: order.source,
      platformName: order.platformName,
      customerName: order.customerName,
      deliveryDate: order.deliveryDate,
      deliveryTimeText: order.deliveryTimeText,
      deliveryAddress: order.deliveryAddress,
      allergens: order.allergens,
    },
    items,
  };
}

export default function OrderFoodLabelsPage() {
  const data = useLoaderData<typeof loader>();
  const order = data.order;
  const totalLabels = data.items.reduce((sum: number, item: any) => sum + Math.max(1, Number(item.quantity || 1)), 0);

  return (
    <AppLayout>
      <section style={pageGridStyle}>
        <div>
          <p style={smallLabelStyle}>Foodlabels aus Auftrag</p>
          <h1 style={pageTitleStyle}>Labels erstellen</h1>
        </div>

        <div style={editorCardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={smallLabelStyle}>Auftrag</p>
              <h2 style={sectionTitleStyle}>{order.orderNumber}</h2>
            </div>

            <Link to={"/auftrag-pruefung/" + order.id} style={secondaryButtonStyle}>
              Zurueck zum Auftrag
            </Link>
          </div>

          <div style={infoGridStyle}>
            <Info label="Kunde" value={order.customerName} />
            <Info label="Lieferdatum" value={formatDate(order.deliveryDate)} />
            <Info label="Lieferzeit" value={order.deliveryTimeText || "-"} />
            <Info label="Quelle" value={order.platformName || order.source} />
            <Info label="Adresse" value={order.deliveryAddress || "-"} wide />
          </div>
        </div>

        <div style={editorCardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={smallLabelStyle}>Positionen</p>
              <h2 style={sectionTitleStyle}>Vorschau fuer Zebra-Labels</h2>
            </div>

            <span style={badgeStyle}>{totalLabels} Labels</span>
          </div>

          {data.items.length === 0 ? (
            <div style={emptyStyle}>Keine echten Auftragspositionen gefunden.</div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Anzahl</th>
                    <th style={thStyle}>Gericht</th>
                    <th style={thStyle}>Info / Allergene</th>
                    <th style={thStyle}>Format</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item: any) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>
                        <strong>{item.quantity}</strong>
                        <div style={mutedStyle}>{item.unit}</div>
                      </td>
                      <td style={tdStyle}>
                        <strong>{item.name}</strong>
                      </td>
                      <td style={tdMutedStyle}>{item.allergens || item.notes || "-"}</td>
                      <td style={tdStyle}>76 x 51 mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={hintBoxStyle}>
            Naechster Schritt: Aus diesen strukturierten Auftragspositionen wird danach direkt eine Zebra-Druckdatei erzeugt. Kein PDF-Auslesen mehr.
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={wide ? { ...infoBoxStyle, gridColumn: "span 2" } : infoBoxStyle}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const pageGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const pageTitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 34,
  letterSpacing: "-0.04em",
  fontWeight: 750,
};

const editorCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.045)",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#057a67",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  fontSize: 11,
  fontWeight: 650,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 21,
  letterSpacing: "-0.02em",
  fontWeight: 650,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const infoBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  padding: "12px 13px",
  border: "1px solid #dbe5eb",
  borderRadius: 14,
  background: "#f8fafc",
  color: "#0f172a",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #c7d8d2",
  background: "#ffffff",
  color: "#075f52",
  fontSize: 13,
  fontWeight: 750,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 30,
  alignItems: "center",
  justifyContent: "center",
  padding: "0 11px",
  borderRadius: 999,
  background: "#ecfdf5",
  color: "#057a67",
  border: "1px solid #bbf7d0",
  fontSize: 12,
  fontWeight: 800,
};

const tableWrapStyle: React.CSSProperties = {
  overflow: "hidden",
  border: "1px solid #dbe5eb",
  borderRadius: 14,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  padding: "11px 12px",
  background: "#f8fafc",
  borderBottom: "1px solid #dbe5eb",
  color: "#64748b",
  fontSize: 12,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  padding: "13px 12px",
  borderBottom: "1px solid #eef2f5",
  color: "#0f172a",
  fontSize: 14,
  verticalAlign: "top",
};

const tdMutedStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#64748b",
  lineHeight: 1.45,
};

const mutedStyle: React.CSSProperties = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 12,
};

const emptyStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 14,
  background: "#f8fafc",
  color: "#64748b",
};

const hintBoxStyle: React.CSSProperties = {
  marginTop: 14,
  padding: "11px 13px",
  border: "1px solid #cfe7dc",
  borderRadius: 12,
  color: "#285244",
  fontSize: 13,
  lineHeight: 1.45,
  background: "#f0fdf8",
};
