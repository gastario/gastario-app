import * as React from "react";
import QRCode from "qrcode";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { prisma } from "../lib/prisma.server";
import { ensureFoodLabelTable } from "../lib/food-labels.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  await ensureFoodLabelTable(prisma);

  const publicToken = params.publicToken || "";
  const url = new URL(request.url);
  const autoPrint = url.searchParams.get("print") === "1";
  const origin = url.origin;

  const label = await prisma.foodLabel.findFirst({
    where: { publicToken },
  });

  if (!label) {
    throw new Response("Label nicht gefunden", { status: 404 });
  }

  const publicUrl = `${origin}/label/${label.publicToken}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 220,
  });

  return {
    label,
    publicUrl,
    qrDataUrl,
    autoPrint,
  };
}

export default function PublicFoodLabelPage() {
  const data = useLoaderData<typeof loader>();
  const { label, publicUrl, qrDataUrl, autoPrint } = data;

  React.useEffect(() => {
    if (!autoPrint) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <main style={pageStyle}>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          background: #f4f6f8;
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
        }

        @page {
          size: 76mm 51mm;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 76mm !important;
            height: 51mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          #print-label,
          #print-label * {
            visibility: visible !important;
          }

          #print-label {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 76mm !important;
            height: 51mm !important;
            margin: 0 !important;
            padding: 2.6mm !important;
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          .screen-only {
            display: none !important;
          }
        }
      `}</style>

      <section className="screen-only" style={toolbarStyle}>
        <div>
          <p style={eyebrowStyle}>Öffentliche Lebensmittelinformation</p>
          <h1 style={titleStyle}>{label.productName}</h1>
          <p style={subtitleStyle}>
            Diese Seite ist über den QR-Code erreichbar und zeigt die gespeicherten MHD- und Produktdaten.
          </p>
        </div>

        <div style={toolbarActionsStyle}>
          <button type="button" onClick={() => window.print()} style={printButtonStyle}>
            Label drucken
          </button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(publicUrl)} style={copyButtonStyle}>
            Link kopieren
          </button>
        </div>
      </section>

      <section style={contentGridStyle}>
        <div style={previewPanelStyle}>
          <FoodLabelCard label={label} qrDataUrl={qrDataUrl} />
        </div>

        <div className="screen-only" style={infoPanelStyle}>
          <h2 style={infoTitleStyle}>Strukturierte Daten</h2>

          <InfoRow label="Produkt" value={label.productName} />
          <InfoRow label="Kunde / Anlass" value={label.customerName || "-"} />
          <InfoRow label="Menge / Portion" value={label.quantityText || "-"} />
          <InfoRow label="Hergestellt am" value={formatDate(label.productionDate)} />
          <InfoRow label="MHD / Verbrauch bis" value={formatDate(label.bestBeforeDate)} />
          <InfoRow label="Los / Charge" value={label.batchNumber || "-"} />
          <InfoRow label="Lagerhinweis" value={label.storageNote || "-"} />
          <InfoRow label="Zutaten" value={label.ingredients || "-"} />
          <InfoRow label="Allergene" value={label.allergens || "-"} />

          <div style={noteBoxStyle}>
            <strong>Hinweis:</strong> Der QR-Code ersetzt nicht automatisch alle Pflichtangaben auf dem Etikett.
            Er dient als digitale Zusatzinfo und zur Rückverfolgung.
          </div>
        </div>
      </section>
    </main>
  );
}

function FoodLabelCard({ label, qrDataUrl }: { label: any; qrDataUrl: string }) {
  return (
    <article id="print-label" style={labelStyle}>
      <div style={labelTopStyle}>
        <div>
          <div style={portionStyle}>{label.quantityText || "1 Portion"}</div>
          <h2 style={labelProductStyle}>{label.productName}</h2>
          {label.customerName ? <p style={customerStyle}>{label.customerName}</p> : null}
        </div>
      </div>

      <div style={dateGridStyle}>
        <div>
          <span style={labelMutedStyle}>MHD / Verbrauch bis</span>
          <strong>{formatDate(label.bestBeforeDate)}</strong>
        </div>
        <div>
          <span style={labelMutedStyle}>Hergestellt</span>
          <strong>{formatDate(label.productionDate)}</strong>
        </div>
      </div>

      <div style={chargeStyle}>
        <span>Los / Charge:</span>
        <strong>{label.batchNumber || "-"}</strong>
      </div>

      <div style={bottomStyle}>
        <div style={textBlockStyle}>
          <div style={smallInfoStyle}>
            <span style={labelMutedStyle}>Lagerung</span>
            <strong>{label.storageNote || "-"}</strong>
          </div>

          {label.ingredients ? (
            <div style={smallInfoStyle}>
              <span style={labelMutedStyle}>Zutaten</span>
              <strong>{label.ingredients}</strong>
            </div>
          ) : null}

          <div style={smallInfoStyle}>
            <span style={labelMutedStyle}>Allergene</span>
            <strong>{label.allergens || "-"}</strong>
          </div>
        </div>

        <img src={qrDataUrl} alt="QR-Code" style={qrStyle} />
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
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
  padding: 32,
};

const toolbarStyle: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto 24px",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 20,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
};

const eyebrowStyle: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#64748b",
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  lineHeight: 1.15,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const toolbarActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const printButtonStyle: React.CSSProperties = {
  border: "1px solid #0f7b61",
  background: "#0f7b61",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const copyButtonStyle: React.CSSProperties = {
  border: "1px solid #d7dde5",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const contentGridStyle: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(320px, 460px) 1fr",
  gap: 24,
  alignItems: "start",
};

const previewPanelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
  display: "flex",
  justifyContent: "center",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
};

const infoPanelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
};

const infoTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 20,
  color: "#0f172a",
};

const infoRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "160px 1fr",
  gap: 14,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
  fontSize: 14,
};

const noteBoxStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.5,
};

const labelStyle: React.CSSProperties = {
  width: "76mm",
  height: "51mm",
  padding: "2.6mm",
  background: "#ffffff",
  border: "1px solid #111827",
  borderRadius: 8,
  color: "#111827",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: "1.4mm",
};

const labelTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "2mm",
};

const portionStyle: React.CSSProperties = {
  fontSize: "6.5pt",
  fontWeight: 700,
  lineHeight: 1,
};

const labelProductStyle: React.CSSProperties = {
  margin: "0.8mm 0 0",
  fontSize: "10pt",
  lineHeight: 1.05,
  fontWeight: 800,
  maxHeight: "12mm",
  overflow: "hidden",
};

const customerStyle: React.CSSProperties = {
  margin: "0.7mm 0 0",
  fontSize: "6.5pt",
  lineHeight: 1.1,
  color: "#334155",
};

const dateGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "2mm",
  fontSize: "6.7pt",
};

const labelMutedStyle: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: "5.8pt",
  lineHeight: 1.1,
  fontWeight: 700,
};

const chargeStyle: React.CSSProperties = {
  borderTop: "1px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  padding: "1mm 0",
  display: "flex",
  gap: "1.2mm",
  fontSize: "6.4pt",
  lineHeight: 1.1,
};

const bottomStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 17mm",
  gap: "2mm",
  alignItems: "end",
  minHeight: 0,
  flex: 1,
};

const textBlockStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: "1mm",
};

const smallInfoStyle: React.CSSProperties = {
  fontSize: "6pt",
  lineHeight: 1.12,
  maxHeight: "9mm",
  overflow: "hidden",
};

const qrStyle: React.CSSProperties = {
  width: "16.5mm",
  height: "16.5mm",
  display: "block",
};