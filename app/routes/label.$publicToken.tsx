import { useEffect, useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import QRCode from "qrcode";

export function meta() {
  return [{ title: "MHD-Label" }];
}

export async function loader({ request, params }: { request: Request; params: { publicToken?: string } }) {
  const { prisma } = await import("../lib/prisma.server");
  const { ensureFoodLabelTable } = await import("../lib/food-labels.server");

  await ensureFoodLabelTable(prisma);

  const token = params.publicToken;

  if (!token) {
    throw new Response("Label nicht gefunden.", { status: 404 });
  }

  const label = await prisma.foodLabel.findFirst({
    where: { publicToken: token },
  });

  if (!label) {
    throw new Response("Label nicht gefunden.", { status: 404 });
  }

  const url = new URL(request.url);
  const autoPrint = url.searchParams.get("print") === "1";

  return {
    label,
    autoPrint,
    publicUrl: `${url.origin}/label/${token}`,
  };
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function getSizeConfig(labelSize: string) {
  if (labelSize === "57x32") {
    return {
      width: "57mm",
      height: "32mm",
      padding: "2.2mm",
      qr: "13mm",
      baseFont: "6.6pt",
      titleFont: "9pt",
    };
  }

  return {
    width: "76mm",
    height: "51mm",
    padding: "3mm",
    qr: "18mm",
    baseFont: "7.5pt",
    titleFont: "11pt",
  };
}

function buildCopyText(label: any, publicUrl: string) {
  return [
    `Produkt: ${label.productName || "-"}`,
    `Kunde: ${label.customerName || "-"}`,
    `MHD / Verbrauchsdatum: ${formatDate(label.bestBeforeDate)}`,
    `Hergestellt am: ${formatDate(label.productionDate)}`,
    `Los / Charge: ${label.batchNumber || "-"}`,
    `Menge / Portion: ${label.quantityText || "-"}`,
    `Lagerhinweis: ${label.storageNote || "-"}`,
    `Zutaten: ${label.ingredients || "-"}`,
    `Allergene: ${label.allergens || "-"}`,
    `Link: ${publicUrl}`,
  ].join("\n");
}

export default function PublicFoodLabelPage() {
  const data = useLoaderData<typeof loader>();
  const label = data.label as any;
  const size = getSizeConfig(label.labelSize || "76x51");
  const copyText = useMemo(() => buildCopyText(label, data.publicUrl), [label, data.publicUrl]);

  useEffect(() => {
    if (!data.autoPrint) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [data.autoPrint]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText);
      window.alert("Label-Infos wurden kopiert.");
    } catch {
      window.alert("Kopieren nicht möglich.");
    }
  }

  return (
    <main style={pageStyle}>
      <style>
        {`
          @page {
            size: ${size.width} ${size.height};
            margin: 0;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
            }

            .screen-only {
              display: none !important;
            }

            .print-wrap {
              padding: 0 !important;
              margin: 0 !important;
            }

            .print-label {
              box-shadow: none !important;
              border-radius: 0 !important;
              margin: 0 !important;
              page-break-after: always !important;
              break-after: page !important;
            }
          }
        `}
      </style>

      <div className="screen-only" style={toolbarStyle}>
        <div>
          <p style={eyebrowStyle}>Öffentliches Label</p>
          <h1 style={titleStyle}>MHD-Informationen</h1>
          <p style={subtitleStyle}>
            Diese Seite ist öffentlich über den QR-Code erreichbar.
          </p>
        </div>

        <div style={toolbarActionsStyle}>
          <button type="button" onClick={() => window.print()} style={primaryButtonStyle}>
            Drucken / PDF
          </button>
          <button type="button" onClick={handleCopy} style={secondaryButtonStyle}>
            Daten kopieren
          </button>
        </div>
      </div>

      <div style={contentGridStyle}>
        <section className="print-wrap" style={panelStyle}>
          <h2 className="screen-only" style={panelTitleStyle}>Label-Vorschau</h2>
          <div className="print-label" style={{ ...labelShellStyle, width: size.width, minHeight: size.height }}>
            <PublicLabelCard label={label} publicUrl={data.publicUrl} size={size} />
          </div>
        </section>

        <section className="screen-only" style={panelStyle}>
          <h2 style={panelTitleStyle}>Produktdaten</h2>
          <div style={factsGridStyle}>
            <Fact label="Produkt" value={label.productName} />
            <Fact label="Kunde" value={label.customerName || "-"} />
            <Fact label="MHD / Verbrauchsdatum" value={formatDate(label.bestBeforeDate)} />
            <Fact label="Hergestellt am" value={formatDate(label.productionDate)} />
            <Fact label="Los / Charge" value={label.batchNumber || "-"} />
            <Fact label="Menge / Portion" value={label.quantityText || "-"} />
            <Fact label="Lagerhinweis" value={label.storageNote || "-"} />
            <Fact label="Zutaten" value={label.ingredients || "-"} />
            <Fact label="Allergene" value={label.allergens || "-"} />
          </div>

          <div style={linkBlockStyle}>
            <span style={smallLabelStyle}>Öffentlicher Link</span>
            <code style={codeStyle}>{data.publicUrl}</code>
          </div>
        </section>
      </div>
    </main>
  );
}

function PublicLabelCard({
  label,
  publicUrl,
  size,
}: {
  label: any;
  publicUrl: string;
  size: { width: string; height: string; padding: string; qr: string; baseFont: string; titleFont: string };
}) {
  return (
    <article
      style={{
        ...labelStyle,
        minHeight: size.height,
        padding: size.padding,
        fontSize: size.baseFont,
      }}
    >
      <div style={labelTopRowStyle}>
        <strong>{label.quantityText || ""}</strong>
        <span>{label.customerName || ""}</span>
      </div>

      <h3 style={{ ...labelProductStyle, fontSize: size.titleFont }}>
        {label.productName}
      </h3>

      <div style={labelDatesStyle}>
        <div>
          <span style={labelMutedStyle}>mindestens haltbar bis</span>
          <strong>{formatDate(label.bestBeforeDate)}</strong>
        </div>

        <div>
          <span style={labelMutedStyle}>hergestellt am</span>
          <strong>{formatDate(label.productionDate)}</strong>
        </div>
      </div>

      <div style={labelChargeStyle}>
        Los / Charge: <strong>{label.batchNumber || "-"}</strong>
      </div>

      {label.storageNote ? (
        <div style={labelStorageStyle}>{label.storageNote}</div>
      ) : null}

      <div style={{ ...labelBottomStyle, gridTemplateColumns: `1fr ${size.qr}` }}>
        <div style={labelAllergenBlockStyle}>
          {label.ingredients ? (
            <>
              <span style={labelMutedStyle}>Zutaten</span>
              <strong>{label.ingredients}</strong>
            </>
          ) : null}

          <span style={labelMutedStyle}>Allergene</span>
          <strong>{label.allergens || "-"}</strong>
        </div>

        <QrImage value={publicUrl} size={size.qr} />
      </div>
    </article>
  );
}

function QrImage({ value, size }: { value: string; size: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let mounted = true;

    QRCode.toDataURL(value, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 220,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    }).then((url) => {
      if (mounted) setSrc(url);
    });

    return () => {
      mounted = false;
    };
  }, [value]);

  if (!src) {
    return <div style={{ width: size, height: size, background: "#ffffff", border: "1px solid #dbe5ec" }} />;
  }

  return <img src={src} alt="QR-Code" style={{ width: size, height: size, display: "block", background: "#ffffff" }} />;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={factCardStyle}>
      <span style={smallLabelStyle}>{label}</span>
      <strong style={factValueStyle}>{value}</strong>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f4f8fb",
  color: "#102033",
  padding: 24,
  boxSizing: "border-box",
};

const toolbarStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto 20px auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
};

const toolbarActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#0b7a69",
};

const titleStyle: React.CSSProperties = {
  margin: "6px 0 6px 0",
  fontSize: 36,
  lineHeight: 1.05,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: "#526171",
};

const contentGridStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(320px, 420px) minmax(320px, 1fr)",
  gap: 20,
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #d9e3ea",
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
  padding: 20,
};

const panelTitleStyle: React.CSSProperties = {
  margin: "0 0 16px 0",
  fontSize: 24,
  lineHeight: 1.1,
};

const labelShellStyle: React.CSSProperties = {
  display: "inline-block",
};

const labelStyle: React.CSSProperties = {
  boxSizing: "border-box",
  background: "#ffffff",
  border: "1.4px solid #102033",
  borderRadius: 8,
  display: "grid",
  alignContent: "start",
  gap: "1mm",
  lineHeight: 1.15,
};

const labelTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "2mm",
  color: "#334155",
  fontSize: "6.6pt",
  minHeight: "3mm",
};

const labelProductStyle: React.CSSProperties = {
  margin: 0,
  lineHeight: 1.05,
  fontWeight: 700,
  color: "#0f172a",
};

const labelDatesStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.8mm",
};

const labelMutedStyle: React.CSSProperties = {
  display: "block",
  color: "#5c6a79",
  fontSize: "0.92em",
};

const labelChargeStyle: React.CSSProperties = {
  color: "#233446",
};

const labelStorageStyle: React.CSSProperties = {
  borderTop: "1px solid #d3dde5",
  paddingTop: "0.8mm",
};

const labelBottomStyle: React.CSSProperties = {
  display: "grid",
  gap: "2mm",
  alignItems: "end",
};

const labelAllergenBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.5mm",
};

const factsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const factCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 12,
  borderRadius: 14,
  background: "#f8fbfd",
  border: "1px solid #dde7ee",
};

const factValueStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.35,
};

const linkBlockStyle: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 8,
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#617183",
  fontWeight: 600,
};

const codeStyle: React.CSSProperties = {
  display: "block",
  padding: 12,
  borderRadius: 12,
  background: "#f7fafc",
  border: "1px solid #dde6ed",
  overflowWrap: "anywhere",
  fontSize: 12,
  lineHeight: 1.45,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  border: "1px solid #057a67",
  background: "#057a67",
  color: "#ffffff",
  borderRadius: 12,
  padding: "0 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  border: "1px solid #c8d6e2",
  background: "#ffffff",
  color: "#102033",
  borderRadius: 12,
  padding: "0 16px",
  fontWeight: 600,
  cursor: "pointer",
};

