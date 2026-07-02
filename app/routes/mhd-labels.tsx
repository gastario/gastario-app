import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(dateValue + "T00:00:00.000Z");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = new Date(raw + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function toInputDate(value: Date | string | null | undefined) {
  if (!value) return todayInput();
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function buildQrValue(label: any) {
  return [
    "GASTARIO_FOOD_LABEL",
    "id=" + label.id,
    "product=" + label.productName,
    "batch=" + (label.batchNumber || ""),
    "mhd=" + toInputDate(label.bestBeforeDate),
  ].join("|");
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

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FoodLabel_tenantId_idx" ON "FoodLabel"("tenantId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FoodLabel_createdAt_idx" ON "FoodLabel"("createdAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FoodLabel_bestBeforeDate_idx" ON "FoodLabel"("bestBeforeDate");
  `);
}

export function meta() {
  return [{ title: "MHD-Labels · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const url = new URL(request.url);
  const printId = url.searchParams.get("print");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!access?.tenant) {
    return {
      tenantName: "Gastario",
      labels: [],
      today: todayInput(),
    };
  }

  await ensureFoodLabelTable(prisma);

  const labels = await prisma.foodLabel.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const printLabel = printId
    ? await prisma.foodLabel.findFirst({
        where: {
          id: printId,
          tenantId: access.tenantId,
        },
      })
    : null;

  return {
    tenantName: access.tenant.name || "Gastario",
    labels,
    printLabel,
    today: todayInput(),
  };
}

export async function action({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
  });

  if (!access) {
    return { error: "Kein Mandant gefunden." };
  }

  await ensureFoodLabelTable(prisma);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createLabel") {
    const productName = String(formData.get("productName") || "").trim();
    const customerName = String(formData.get("customerName") || "").trim();
    const productionDate = parseDateInput(formData.get("productionDate"));
    const bestBeforeDate = parseDateInput(formData.get("bestBeforeDate"));
    const batchNumber = String(formData.get("batchNumber") || "").trim();
    const storageNote = String(formData.get("storageNote") || "").trim();
    const allergens = String(formData.get("allergens") || "").trim();
    const quantityText = String(formData.get("quantityText") || "").trim();
    const labelSize = String(formData.get("labelSize") || "76x51").trim();
    const labelCountRaw = Number(String(formData.get("labelCount") || "1"));
    const labelCount = Math.max(1, Math.min(Number.isFinite(labelCountRaw) ? labelCountRaw : 1, 200));

    if (!productName) return { error: "Produktname fehlt." };
    if (!productionDate) return { error: "Produktionsdatum fehlt." };
    if (!bestBeforeDate) return { error: "MHD fehlt." };

    await prisma.foodLabel.create({
      data: {
        tenantId: access.tenantId,
        productName,
        customerName: customerName || null,
        productionDate,
        bestBeforeDate,
        batchNumber: batchNumber || null,
        storageNote: storageNote || null,
        allergens: allergens || null,
        quantityText: quantityText || null,
        labelCount,
        labelSize,
      },
    });

    return { success: "MHD-Label wurde gespeichert." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function MhdLabelsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const today = data.today;
  const defaultMhd = addDays(today, 2);
  const latestLabel = data.labels[0];

  return (
    <AppLayout>
      <style>
        {`
          @media print {
            body {
              background: #ffffff !important;
            }

            .sidebar,
            .topbar,
            .no-print {
              display: none !important;
            }

            .appShell {
              display: block !important;
              background: #ffffff !important;
            }

            .workspace {
              padding: 0 !important;
            }

            .workspace > * {
              max-width: none !important;
              margin: 0 !important;
            }

            .printOnly {
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              width: 76mm !important;
            }

            .labelCard {
              width: 76mm !important;
              height: 51mm !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            @page {
              size: 76mm 51mm;
              margin: 0;
            }
          }
        `}
      </style>

      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>MHD-Labels</h1>
        </div>


      </header>

      {actionData && "error" in actionData ? <div className="no-print" style={errorStyle}>{actionData.error}</div> : null}
      {actionData && "success" in actionData ? <div className="no-print" style={successStyle}>{actionData.success}</div> : null}

      <section className="no-print" style={pageGridStyle}>
        <div style={editorCardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={smallLabelStyle}>Label erstellen</p>
              <h2 style={sectionTitleStyle}>Produktdaten speichern</h2>
            </div>
          </div>

          <Form method="post" style={formGridStyle}>
            <input type="hidden" name="intent" value="createLabel" />

            <Field label="Produktname *">
              <input name="productName" placeholder="z. B. Chicken Bowl" required />
            </Field>

            <Field label="Kunde optional">
              <input name="customerName" placeholder="z. B. Heycater / Kunde" />
            </Field>

            <Field label="Produziert am *">
              <input name="productionDate" type="date" defaultValue={today} required />
            </Field>

            <Field label="MHD / Verbrauchsdatum *">
              <input name="bestBeforeDate" type="date" defaultValue={defaultMhd} required />
            </Field>

            <Field label="Charge / Losnummer">
              <input name="batchNumber" defaultValue={"CH-" + today.replaceAll("-", "") + "-001"} />
            </Field>

            <Field label="Menge / Portion">
              <input name="quantityText" defaultValue="1 Portion" />
            </Field>

            <Field label="Lagerhinweis">
              <input name="storageNote" defaultValue="Gekühlt lagern bei max. +7 °C" />
            </Field>

            <Field label="Allergene">
              <input name="allergens" placeholder="z. B. Soja, Sesam, Gluten" />
            </Field>

            <Field label="Labelgröße">
              <select name="labelSize" defaultValue="76x51">
                <option value="76x51">76 × 51 mm</option>
                <option value="57x32">57 × 32 mm</option>
              </select>
            </Field>

            <Field label="Anzahl Labels">
              <input name="labelCount" type="number" min="1" max="200" defaultValue="12" />
            </Field>

            <div style={formActionStyle}>
              <button type="submit" style={primaryButtonStyle}>
                Label speichern
              </button>
            </div>
          </Form>
        </div>

        <div style={contentGridStyle}>
          <div style={listCardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <p style={smallLabelStyle}>Gespeichert</p>
                <h2 style={sectionTitleStyle}>Letzte Labels</h2>
              </div>
            </div>

            {data.labels.length === 0 ? (
              <div style={emptyStyle}>Noch keine MHD-Labels gespeichert.</div>
            ) : (
              <div style={labelListStyle}>
                {data.labels.map((label) => (
                  <div key={label.id} style={labelRowStyle}>
                    <div>
                      <strong>{label.productName}</strong>
                      <span>
                        MHD: {formatDate(label.bestBeforeDate)} · Charge: {label.batchNumber || "-"}
                      </span>
                    </div>

                    <div style={rowMetaStyle}>
                      <span>{label.labelCount} × {label.labelSize}</span>
                      <span>MHD: {formatDate(label.bestBeforeDate)}</span>
                    </div>

                    <div style={rowActionsStyle}>
                      <Link to={`/mhd-labels?print=${label.id}`} style={secondaryLinkStyle}>
                        Vorschau / Drucken
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={previewCardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <p style={smallLabelStyle}>Vorschau</p>
                <h2 style={sectionTitleStyle}>{data.printLabel ? "Druckvorschau" : "Label auswählen"}</h2>
              </div>

              {data.printLabel ? (
                <button type="button" onClick={() => window.print()} style={primaryButtonStyle}>
                  Drucken
                </button>
              ) : null}
            </div>

            {data.printLabel ? (
              <div style={previewWrapStyle}>
                <LabelCard label={data.printLabel} tenantName={data.tenantName} />
              </div>
            ) : (
              <div style={emptyStyle}>Wähle links ein gespeichertes Label über „Vorschau / Drucken“ aus. Danach erscheint hier die Druckvorschau.</div>
            )}
          </div>
        </div>
      </section>

      <section className="printOnly" style={printOnlyStyle}>
        {data.printLabel
          ? Array.from({ length: data.printLabel.labelCount }, (_, index) => (
              <LabelCard key={index} label={data.printLabel} tenantName={data.tenantName} />
            ))
          : null}
      </section>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 72,
    }).then((url) => {
      if (active) setSrc(url);
    });

    return () => {
      active = false;
    };
  }, [value]);

  if (!src) {
    return <div style={qrPlaceholderStyle} />;
  }

  return <img src={src} alt="QR-Code" style={qrStyle} />;
}

function LabelCard({ label, tenantName }: { label: any; tenantName: string }) {
  const isSmall = label.labelSize === "57x32";

  return (
    <article className="labelCard" style={isSmall ? smallLabelCardStyle : labelCardStyle}>
      <div style={labelTopStyle}>
        <strong>{label.quantityText || ""}</strong>
        <span>{tenantName}</span>
      </div>

      {label.customerName ? <div style={customerStyle}>{label.customerName}</div> : null}

      <h3 style={isSmall ? smallProductTitleStyle : productTitleStyle}>{label.productName}</h3>

      <div style={dateStackStyle}>
        <span>mindestens haltbar bis: <strong>{formatDate(label.bestBeforeDate)}</strong></span>
        <span>hergestellt am: <strong>{formatDate(label.productionDate)}</strong></span>
      </div>

      <div style={batchStyle}>Los/Charge: {label.batchNumber ? label.batchNumber.startsWith("L") ? label.batchNumber : "L-" + label.batchNumber : "-"}</div>

      {label.storageNote ? <div style={storageStyle}>{label.storageNote}</div> : null}

      <div style={labelBottomStyle}>
        <div style={allergenStyle}>
          <span>Allergene:</span>
          <strong>{label.allergens || "-"}</strong>
        </div>

        <QrCode value={buildQrValue(label)} />
      </div>
    </article>
  );
}

const pageGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
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

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#475569",
  fontSize: 12,
  fontWeight: 600,
};

const formActionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "end",
  justifyContent: "flex-end",
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 0.8fr",
  gap: 20,
};

const listCardStyle: React.CSSProperties = {
  ...editorCardStyle,
};

const previewCardStyle: React.CSSProperties = {
  ...editorCardStyle,
};

const labelListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const labelRowStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gridTemplateColumns: "1fr 150px 170px",
  gap: 14,
  alignItems: "center",
};

const rowMetaStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#64748b",
  fontSize: 13,
};

const rowActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

const secondaryLinkStyle: React.CSSProperties = {
  minHeight: 38,
  borderRadius: 11,
  padding: "0 12px",
  fontSize: 13,
  fontWeight: 600,
  border: "1px solid #057a67",
  background: "#eef7f5",
  color: "#057a67",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const previewWrapStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 18,
  display: "flex",
  justifyContent: "center",
};

const emptyStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
};

const printOnlyStyle: React.CSSProperties = {
  display: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  padding: "0 17px",
  fontSize: 14,
  fontWeight: 650,
  border: "1px solid #036b5a",
  background: "#057a67",
  color: "#ffffff",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 38,
  borderRadius: 11,
  padding: "0 12px",
  fontSize: 13,
  fontWeight: 600,
  border: "1px solid #c8d4dd",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
};

const labelCardStyle: React.CSSProperties = {
  width: "76mm",
  height: "51mm",
  border: "1px solid #0f172a",
  borderRadius: 8,
  padding: "3.2mm",
  background: "#ffffff",
  color: "#0f172a",
  display: "grid",
  alignContent: "start",
  gap: "1.1mm",
  fontSize: "8.2pt",
  lineHeight: 1.12,
  overflow: "hidden",
};

const smallLabelCardStyle: React.CSSProperties = {
  ...labelCardStyle,
  width: "57mm",
  height: "32mm",
  padding: "2.8mm",
  fontSize: "7.5pt",
  gap: "1mm",
};

const labelTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: "8pt",
  color: "#334155",
};

const brandStyle: React.CSSProperties = {
  color: "#057a67",
  fontWeight: 700,
};

const customerStyle: React.CSSProperties = {
  fontSize: "7.5pt",
  color: "#64748b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const productTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "12pt",
  lineHeight: 1.02,
  fontWeight: 700,
};

const smallProductTitleStyle: React.CSSProperties = {
  ...productTitleStyle,
  fontSize: "10pt",
};

const dateGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "2mm",
};

const dateStackStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.8mm",
};

const batchStyle: React.CSSProperties = {
  fontSize: "8pt",
  color: "#334155",
};

const storageStyle: React.CSSProperties = {
  borderTop: "1px solid #cbd5e1",
  paddingTop: "1mm",
  fontSize: "7pt",
  color: "#0f172a",
};

const labelBottomStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 13mm",
  gap: "1.5mm",
  alignItems: "end",
  minHeight: "13mm",
};

const allergenStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.4mm",
  fontSize: "6.8pt",
  color: "#334155",
  overflow: "hidden",
};

const qrStyle: React.CSSProperties = {
  width: "13mm",
  height: "13mm",
  display: "block",
  alignSelf: "end",
  justifySelf: "end",
};

const qrPlaceholderStyle: React.CSSProperties = {
  width: "13mm",
  height: "13mm",
  border: "1px solid #e2e8f0",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 650,
};

const successStyle: React.CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#047857",
  borderRadius: 14,
  padding: 14,
  fontWeight: 650,
};








