import { useEffect, useState } from "react";
import { Link, redirect, useLoaderData } from "react-router";
import QRCode from "qrcode";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function toInputDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function buildQrValue(label: any) {
  if (label.publicToken) {
    return "https://gastario-app-production.up.railway.app/label/" + label.publicToken;
  }

  return "https://gastario-app-production.up.railway.app/mhd-labels?print=" + label.id;
}

function getPageSize(labelSize: string) {
  if (labelSize === "57x32") {
    return {
      width: "57mm",
      height: "32mm",
      qr: "13mm",
      padding: "2.4mm",
      title: "9pt",
      base: "6.8pt",
      columns: 4,
      gap: "4mm",
    };
  }

  return {
    width: "76mm",
    height: "51mm",
    qr: "19mm",
    padding: "3.2mm",
    title: "11pt",
    base: "7.6pt",
    columns: 3,
    gap: "5mm",
  };
}

async function ensureFoodLabelTable(prisma: any) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FoodLabel" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "productName" TEXT NOT NULL,
      "customerName" TEXT,
      "productionDate" TIMESTAMP(3) NOT NULL,
      "bestBeforeDate" TIMESTAMP(3) NOT NULL,
      "batchNumber" TEXT,
      "storageNote" TEXT,
      "allergens" TEXT,
      "quantityText" TEXT,
      "labelCount" INTEGER NOT NULL DEFAULT 1,
      "labelSize" TEXT NOT NULL DEFAULT '76x51',
      "status" TEXT NOT NULL DEFAULT 'CREATED',
      "printedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function meta() {
  return [{ title: "MHD-Label drucken · Gastario" }];
}

export async function loader({ request, params }: { request: Request; params: { labelId?: string } }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!access?.tenant) {
    throw redirect("/mhd-labels");
  }

  await ensureFoodLabelTable(prisma);

  const label = await prisma.foodLabel.findFirst({
    where: {
      id: params.labelId,
      tenantId: access.tenantId,
    },
  });

  if (!label) {
    throw redirect("/mhd-labels");
  }

  return {
    tenantName: access.tenant.name,
    label,
  };
}

export default function MhdLabelPrintPage() {
  const data = useLoaderData<typeof loader>();
  const label = data.label as any;
  const size = getPageSize(label.labelSize);
  const labels = Array.from({ length: Math.max(1, Math.min(label.labelCount || 1, 200)) }, (_, index) => index);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 500);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main>
      <style>
        {`
          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
            font-family: Arial, Helvetica, sans-serif;
          }

          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          .toolbar {
            padding: 18px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
          }

          .toolbar strong {
            font-size: 16px;
          }

          .toolbar div {
            display: flex;
            gap: 10px;
          }

          .button {
            min-height: 40px;
            border-radius: 10px;
            padding: 0 14px;
            border: 1px solid #c8d4dd;
            background: #ffffff;
            color: #0f172a;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            cursor: pointer;
          }

          .button.primary {
            border-color: #057a67;
            background: #057a67;
            color: #ffffff;
          }

          .sheet {
            padding: 18px;
            display: grid;
            grid-template-columns: repeat(${size.columns}, ${size.width});
            gap: ${size.gap};
            align-items: start;
            justify-content: start;
          }

          .label {
            width: ${size.width};
            height: ${size.height};
            border: 1.6px solid #000000;
            padding: ${size.padding};
            display: grid;
            align-content: start;
            gap: 0.8mm;
            overflow: hidden;
            background: #ffffff;
            font-size: ${size.base};
            line-height: 1.12;
            box-sizing: border-box;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .top {
            display: flex;
            justify-content: space-between;
            gap: 2mm;
            color: #334155;
            font-size: 6.5pt;
          }

          .product {
            margin: 0;
            font-size: ${size.title};
            line-height: 1.02;
            font-weight: 700;
          }

          .dates {
            display: grid;
            gap: 0.5mm;
          }

          .charge {
            color: #334155;
          }

          .storage {
            border-top: 1px solid #cbd5e1;
            padding-top: 0.8mm;
          }

          .bottom {
            display: grid;
            grid-template-columns: 1fr ${size.qr};
            gap: 1.5mm;
            align-items: end;
          }

          .allergens {
            display: grid;
            gap: 0.3mm;
            overflow: hidden;
          }

          .qr {
            width: ${size.qr};
            height: ${size.qr};
            display: block;
            background: #ffffff;
          }

          @media print {
            .toolbar {
              display: none !important;
            }

            .sheet {
              display: grid !important;
              grid-template-columns: repeat(${size.columns}, ${size.width}) !important;
              gap: ${size.gap} !important;
              padding: 0 !important;
              margin: 0 !important;
              align-items: start !important;
              justify-content: start !important;
            }

            .label {
              border: none !important;
              border-radius: 0 !important;
              page-break-after: always !important;
              break-after: page !important;
            }
          }
        `}
      </style>

      <div className="toolbar">
        <strong>MHD-Label drucken · {label.labelSize}</strong>
        <div>
          <Link to={`/mhd-labels?print=${label.id}`} className="button">
            Zurück
          </Link>
          <button type="button" onClick={() => window.print()} className="button primary">
            Drucken
          </button>
        </div>
      </div>

      <section className="sheet">
        {labels.map((index) => (
          <PrintLabel key={index} label={label} tenantName={data.tenantName} size={size} />
        ))}
      </section>
    </main>
  );
}

function PrintLabel({ label, tenantName, size }: { label: any; tenantName: string; size: any }) {
  return (
    <article className="label">
      <div className="top">
        <strong>{label.quantityText || ""}</strong>
        <span>{tenantName}</span>
      </div>

      {label.customerName ? <div>{label.customerName}</div> : null}

      <h1 className="product">{label.productName}</h1>

      <div className="dates">
        <span>mindestens haltbar bis: <strong>{formatDate(label.bestBeforeDate)}</strong></span>
        <span>hergestellt am: <strong>{formatDate(label.productionDate)}</strong></span>
      </div>

      <div className="charge">
        Los/Charge: {label.batchNumber ? label.batchNumber.startsWith("L") ? label.batchNumber : "L-" + label.batchNumber : "-"}
      </div>

      {label.storageNote ? <div className="storage">{label.storageNote}</div> : null}

      <div className="bottom">
        <div className="allergens">
          {label.ingredients ? (
            <>
              <span>Zutaten:</span>
              <strong>{label.ingredients}</strong>
            </>
          ) : null}

          <span>Allergene:</span>
          <strong>{label.allergens || "-"}</strong>
        </div>

        <QrCode value={buildQrValue(label)} />
      </div>
    </article>
  );
}

function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(value, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 180,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    }).then((url) => {
      if (active) setSrc(url);
    });

    return () => {
      active = false;
    };
  }, [value]);

  if (!src) return null;

  return <img src={src} alt="QR-Code" className="qr" />;
}



