import { Link, useLoaderData } from "react-router";

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

  return {
    tenant: tenantUser.tenant,
    order,
  };
}

export default function AuftragPruefungPage() {
  const { tenant, order } = useLoaderData<typeof loader>();
  const total = order.items.reduce((sum, item) => sum + (item.totalCents || 0), 0);

  return (
    <main style={{ background: "#eaf2f5", minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto 16px", display: "flex", justifyContent: "space-between" }}>
        <Link to="/auftragseingang" style={{ fontWeight: 800, color: "#057a67" }}>
          Zurueck
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            border: "1px solid #057a67",
            background: "#057a67",
            color: "#fff",
            borderRadius: 12,
            padding: "10px 14px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Drucken / als PDF speichern
        </button>
      </div>

      <section style={{ maxWidth: 1000, margin: "0 auto", background: "#fff", borderRadius: 18, padding: 28 }}>
        <p style={{ margin: 0, color: "#057a67", fontWeight: 900, textTransform: "uppercase", fontSize: 12 }}>
          Auftragspruefung
        </p>

        <h1 style={{ margin: "6px 0 4px", fontSize: 34 }}>{order.orderNumber}</h1>
        <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>{tenant?.name || "Gastario"}</p>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: "#fff7ed", color: "#9a3412", fontWeight: 800 }}>
          Bitte vor Uebernahme pruefen: Kunde, Lieferadresse, Datum, Uhrzeit und Positionen.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 18 }}>
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

        <h2 style={{ margin: "26px 0 10px", fontSize: 20 }}>Positionen</h2>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Menge</th>
              <th style={thStyle}>Position</th>
              <th style={thStyle}>Hinweis / Rohdaten</th>
              <th style={thStyle}>Betrag</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td style={tdStyle}>{item.quantity} {item.unit}</td>
                <td style={tdStyle}><strong>{item.name}</strong></td>
                <td style={tdStyle}>{item.notes || "-"}</td>
                <td style={tdStyle}>{centsToEuro(item.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ margin: "26px 0 10px", fontSize: 20 }}>Checkliste</h2>
        <div style={{ display: "grid", gap: 6, fontWeight: 800 }}>
          <div>☐ Kunde stimmt</div>
          <div>☐ Lieferadresse stimmt</div>
          <div>☐ Lieferdatum und Lieferzeit stimmen</div>
          <div>☐ Positionen stimmen</div>
          <div>☐ Hinweise / Allergene geprueft</div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc" }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</div>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #cbd5e1",
  padding: 8,
  color: "#475569",
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: 8,
  verticalAlign: "top",
  fontSize: 12,
};
