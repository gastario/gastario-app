import { useEffect } from "react";
import { Link, redirect, useLoaderData } from "react-router";

function getPrintPreset(preset: string) {
  if (preset === "a4-4") {
    return { columns: 4, width: "43mm", height: "32mm", gap: "4mm", logo: "10mm", title: "8pt", base: "5.4pt" };
  }

  if (preset === "a4-3") {
    return { columns: 3, width: "58mm", height: "38mm", gap: "5mm", logo: "13mm", title: "10pt", base: "6.2pt" };
  }

  return { columns: 2, width: "86mm", height: "52mm", gap: "6mm", logo: "18mm", title: "13pt", base: "7.5pt" };
}

async function ensureFoodProductLabelTable(prisma: any) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FoodProductLabel" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "ingredients" TEXT,
      "allergens" TEXT,
      "logoDataUrl" TEXT,
      "labelCount" INTEGER NOT NULL DEFAULT 12,
      "printPreset" TEXT NOT NULL DEFAULT 'a4-3',
      "publicToken" TEXT UNIQUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function meta() {
  return [{ title: "Foodlabel drucken - Gastario" }];
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
    throw redirect("/");
  }

  await ensureFoodProductLabelTable(prisma);

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "FoodProductLabel" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
    params.labelId,
    access.tenantId
  );

  const label = rows[0];

  if (!label) {
    throw redirect("/foodlabels");
  }

  return {
    tenantName: access.tenant.name,
    label,
  };
}

export default function FoodLabelPrintPage() {
  const data = useLoaderData<typeof loader>();
  const label = data.label as any;
  const preset = getPrintPreset(label.printPreset || "a4-3");
  const count = Math.max(1, Math.min(Number(label.labelCount || 1), 200));
  const labels = Array.from({ length: count }, (_, index) => index);

  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 500);
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
            size: A4 portrait;
            margin: 8mm;
          }

          .toolbar {
            padding: 18px;
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
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
            font-weight: 700;
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
            grid-template-columns: repeat(${preset.columns}, ${preset.width});
            gap: ${preset.gap};
            justify-content: start;
            align-items: start;
          }

          .label {
            width: ${preset.width};
            height: ${preset.height};
            border: 2px solid #111827;
            outline: 1px solid #111827;
            outline-offset: -2px;
            background: #ffffff;
            padding: 3mm;
            display: grid;
            gap: 2mm;
            overflow: hidden;
            box-sizing: border-box;
            font-size: ${preset.base};
            break-inside: avoid;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .top {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 2.5mm;
            align-items: center;
            border-bottom: 1px solid #dbe4ea;
            padding-bottom: 1.5mm;
          }

          .logo,
          .logoEmpty {
            width: ${preset.logo};
            height: ${preset.logo};
            object-fit: contain;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            background: #ffffff;
          }

          .logoEmpty {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 8px;
            font-weight: 700;
          }

          .name {
            margin: 0;
            font-size: ${preset.title};
            line-height: 1.05;
            font-weight: 900;
            color: #0f172a;
            word-break: break-word;
          }

          .tenant {
            color: #64748b;
            font-size: 0.85em;
          }

          .info {
            display: grid;
            gap: 1.5mm;
            line-height: 1.15;
            overflow: hidden;
          }

          .section {
            display: grid;
            gap: 0.7mm;
            word-break: break-word;
          }

          .key {
            color: #64748b;
            font-weight: 900;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          @media print {
            .toolbar {
              display: none !important;
            }

            .sheet {
              padding: 0 !important;
              margin: 0 !important;
              display: grid !important;
              grid-template-columns: repeat(${preset.columns}, ${preset.width}) !important;
              gap: ${preset.gap} !important;
            }

            .label {
              border: 2px solid #111827 !important;
              outline: 1px solid #111827 !important;
              outline-offset: -2px !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      <div className="toolbar">
        <strong>Foodlabel drucken - {label.printPreset}</strong>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/foodlabels" className="button">
            Zurueck
          </Link>
          <button className="button primary" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </div>

      <section className="sheet">
        {labels.map((index) => (
          <article key={index} className="label">
            <div className="top">
              {label.logoDataUrl ? <img src={label.logoDataUrl} className="logo" alt="" /> : <div className="logoEmpty">Logo</div>}
              <div>
                <h1 className="name">{label.name}</h1>
                <div className="tenant">{data.tenantName}</div>
              </div>
            </div>

            <div className="info">
              <div className="section">
                <span className="key">Zutaten</span>
                <strong>{label.ingredients || "-"}</strong>
              </div>

              <div className="section">
                <span className="key">Allergene</span>
                <strong>{label.allergens || "-"}</strong>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
