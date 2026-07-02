import * as React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { prisma } from "../lib/prisma.server";
import { ensureFoodLabelTable } from "../lib/food-labels.server";

export async function loader({ params }: LoaderFunctionArgs) {
  await ensureFoodLabelTable(prisma);

  const publicToken = params.publicToken || "";

  const label = await prisma.foodLabel.findFirst({
    where: { publicToken },
  });

  if (!label) {
    throw new Response("Label nicht gefunden", { status: 404 });
  }

  return { label };
}

export default function PublicFoodLabelInfoPage() {
  const { label } = useLoaderData<typeof loader>();

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <p style={eyebrowStyle}>Oeffentliche Produktinformation</p>
        <h1 style={titleStyle}>{label.productName}</h1>
        <p style={subtitleStyle}>
          Diese Seite zeigt die gespeicherten MHD-, Zutaten- und Rueckverfolgbarkeitsdaten.
        </p>

        <div style={tableStyle}>
          <InfoRow label="Produkt" value={label.productName} />
          <InfoRow label="Kunde / Anlass" value={label.customerName || "-"} />
          <InfoRow label="Menge / Portion" value={label.quantityText || "-"} />
          <InfoRow label="Hergestellt am" value={formatDate(label.productionDate)} />
          <InfoRow label="MHD / Verbrauch bis" value={formatDate(label.bestBeforeDate)} />
          <InfoRow label="Los / Charge" value={label.batchNumber || "-"} />
          <InfoRow label="Lagerhinweis" value={label.storageNote || "-"} />
          <InfoRow label="Zutaten" value={label.ingredients || "-"} />
          <InfoRow label="Allergene" value={label.allergens || "-"} />
        </div>

        <div style={noteStyle}>
          Hinweis: Diese digitale Ansicht dient als Zusatzinformation. Pflichtangaben sollten weiterhin direkt auf dem Etikett stehen.
        </div>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <div style={rowLabelStyle}>{label}</div>
      <div style={rowValueStyle}>{value}</div>
    </div>
  );
}

function formatDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("de-DE");
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f7f8",
  padding: 24,
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#0f172a",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
};

const eyebrowStyle: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: 12,
  color: "#0f7b61",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.15,
};

const subtitleStyle: React.CSSProperties = {
  margin: "10px 0 22px",
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.5,
};

const tableStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  overflow: "hidden",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "190px 1fr",
  borderBottom: "1px solid #e2e8f0",
};

const rowLabelStyle: React.CSSProperties = {
  background: "#f8fafc",
  padding: "13px 14px",
  color: "#475569",
  fontWeight: 800,
  fontSize: 14,
};

const rowValueStyle: React.CSSProperties = {
  padding: "13px 14px",
  fontWeight: 700,
  fontSize: 14,
  lineHeight: 1.45,
  wordBreak: "break-word",
};

const noteStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.5,
};
