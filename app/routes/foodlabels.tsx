import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import AppLayout from "../components/AppLayout";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE");
}

function getPrintPreset(preset: string, labelSize: string = "auto") {
  if (preset === "roll-76x51") {
    return { columns: 2, width: "76mm", height: "51mm", gap: "6mm", logo: "17mm", title: "12pt", base: "7.2pt" };
  }

  if (preset === "roll-57x32") {
    return { columns: 3, width: "57mm", height: "32mm", gap: "5mm", logo: "12mm", title: "9pt", base: "5.8pt" };
  }

  if (labelSize === "76x51") {
    return { columns: 2, width: "76mm", height: "51mm", gap: "6mm", logo: "17mm", title: "12pt", base: "7.2pt" };
  }

  if (labelSize === "57x32") {
    return { columns: 3, width: "57mm", height: "32mm", gap: "5mm", logo: "12mm", title: "9pt", base: "5.8pt" };
  }

  if (labelSize === "50x30") {
    return { columns: 3, width: "50mm", height: "30mm", gap: "5mm", logo: "11mm", title: "8.5pt", base: "5.4pt" };
  }

  if (preset === "a4-4") {
    return { columns: 4, width: "43mm", height: "32mm", gap: "4mm", logo: "10mm", title: "8pt", base: "5.4pt" };
  }

  if (preset === "a4-3") {
    return { columns: 3, width: "58mm", height: "38mm", gap: "5mm", logo: "13mm", title: "10pt", base: "6.2pt" };
  }

  return { columns: 2, width: "86mm", height: "52mm", gap: "6mm", logo: "18mm", title: "13pt", base: "7.5pt" };
}

function safeText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function createPublicToken() {
  return "fl_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
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
      "labelSize" TEXT NOT NULL DEFAULT 'auto',
      "publicToken" TEXT UNIQUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`ALTER TABLE "FoodProductLabel" ADD COLUMN IF NOT EXISTS "logoDataUrl" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "FoodProductLabel" ADD COLUMN IF NOT EXISTS "printPreset" TEXT NOT NULL DEFAULT 'a4-3';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "FoodProductLabel" ADD COLUMN IF NOT EXISTS "labelSize" TEXT NOT NULL DEFAULT 'auto';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "FoodProductLabel" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "FoodProductLabel_publicToken_key" ON "FoodProductLabel"("publicToken");`);
}

export function meta() {
  return [{ title: "Foodlabel erstellen - Gastario" }];
}

export async function loader({ request }: { request: Request }) {
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

  const labels = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "FoodProductLabel" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 60`,
    access.tenantId
  );

  return {
    labels,
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
    include: { tenant: true },
  });

  if (!access?.tenant) {
    throw redirect("/");
  }

  await ensureFoodProductLabelTable(prisma);

  const formData = await request.formData();
  const actionType = safeText(formData.get("_action"));

  if (actionType === "delete") {
    const labelId = safeText(formData.get("labelId"));

    if (!labelId) {
      return { error: "Label wurde nicht gefunden." };
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "FoodProductLabel" WHERE "id" = $1 AND "tenantId" = $2`,
      labelId,
      access.tenantId
    );

    return { success: "Foodlabel wurde geloescht." };
  }

  const name = safeText(formData.get("name"));
  const ingredients = safeText(formData.get("ingredients"));
  const allergens = safeText(formData.get("allergens"));
  const printPreset = safeText(formData.get("printPreset")) || "a4-3";
  const labelSize = "auto";
  const labelCountRaw = Number(safeText(formData.get("labelCount")) || "12");
  const labelCount = Math.max(1, Math.min(Number.isFinite(labelCountRaw) ? labelCountRaw : 12, 200));

  if (!name) {
    return { error: "Bitte einen Namen eintragen." };
  }

  let logoDataUrl = "";
  const logoFile = formData.get("logo");

  if (logoFile && typeof logoFile === "object" && "arrayBuffer" in logoFile && "type" in logoFile) {
    const file = logoFile as File;

    if (file.size > 0) {
      if (file.size > 500000) {
        return { error: "Logo ist zu gross. Bitte maximal 500 KB hochladen." };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "image/png";
      logoDataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    }
  }

  const id = crypto.randomUUID();
  const publicToken = createPublicToken();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "FoodProductLabel"
      ("id", "tenantId", "name", "ingredients", "allergens", "logoDataUrl", "labelCount", "printPreset", "labelSize", "publicToken", "updatedAt")
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
    id,
    access.tenantId,
    name,
    ingredients || null,
    allergens || null,
    logoDataUrl || null,
    labelCount,
    printPreset,
    labelSize,
    publicToken
  );

  return redirect(`/foodlabels?print=${id}`);
}

export default function FoodLabelsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const url = new URL(typeof window !== "undefined" ? window.location.href : "http://localhost");
  const selectedId = url.searchParams.get("print");
  const selected = selectedId ? data.labels.find((label: any) => label.id === selectedId) : data.labels[0];

  return (
    <AppLayout>
      <section style={pageGridStyle}>
        <div>
          <p style={smallLabelStyle}>Betrieb</p>
          <h1 style={pageTitleStyle}>Foodlabel erstellen</h1>
        </div>

        {actionData?.error ? <div style={errorStyle}>{actionData.error}</div> : null}
        {actionData?.success ? <div style={successStyle}>{actionData.success}</div> : null}

        <div style={editorCardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={smallLabelStyle}>Foodlabel</p>
              <h2 style={sectionTitleStyle}>
        
        <section className="heycaterUploadBox">
          <div className="heycaterUploadHeader">
            <div>
              <p>PDF Import</p>
              <h2>Heycater-Labels fuer Zebra vorbereiten</h2>
              <span>A4-PDF hochladen und in einzelne 76 x 51 mm Etiketten schneiden.</span>
            </div>
          </div>

          <form action="/foodlabels/heycater-pdf" method="post" encType="multipart/form-data" className="heycaterUploadForm">
            <label>
              PDF-Datei
              <input type="file" name="pdf" accept="application/pdf" required />
            </label>

            <label>
              Raster
              <select name="columns" defaultValue="3">
                <option value="3">3 Spalten</option>
                <option value="2">2 Spalten</option>
                <option value="1">1 Spalte</option>
              </select>
            </label>

            <label>
              Reihen
              <select name="rows" defaultValue="12">
                <option value="12">12 Reihen</option>
                <option value="6">6 Reihen</option>
                <option value="5">5 Reihen</option>
                <option value="4">4 Reihen</option>
              </select>
            </label>

            <label>
              Etikett
              <select name="labelWidthMm" defaultValue="76">
                <option value="76">76 mm breit</option>
                <option value="70">70 mm breit</option>
                <option value="60">60 mm breit</option>
              </select>
            </label>

            <label>
              Hoehe
              <select name="labelHeightMm" defaultValue="51">
                <option value="51">51 mm hoch</option>
                <option value="50">50 mm hoch</option>
                <option value="38">38 mm hoch</option>
              </select>
            </label>

            <button type="submit">PDF erstellen</button>

            <input type="hidden" name="pageTopMm" value="0" />
            <input type="hidden" name="pageRightMm" value="0" />
            <input type="hidden" name="pageBottomMm" value="0" />
            <input type="hidden" name="pageLeftMm" value="0" />

            <input type="hidden" name="innerTopMm" value="0.4" />
            <input type="hidden" name="innerRightMm" value="0.8" />
            <input type="hidden" name="innerBottomMm" value="0.8" />
            <input type="hidden" name="innerLeftMm" value="0.8" />
          </form>

          <div className="heycaterUploadHint">
            Standard: Heycater A4 mit 3 Spalten x 12 Reihen. Jeder gestrichelte Bereich wird als einzelnes Label geschnitten.
          </div>
        </section>


Labeldaten speichern</h2>
            </div>
          </div>

          <Form method="post" encType="multipart/form-data" style={formGridStyle}>
            <Field label="Name *">
              <input name="name" placeholder="z. B. Chicken Bowl, Wrap, Dessert" required />
            </Field>

            <Field label="Zutaten">
              <input name="ingredients" placeholder="z. B. Reis, Haehnchen, Gemuese, Sauce" />
            </Field>

            <Field label="Allergene">
              <input name="allergens" placeholder="z. B. Soja, Sesam, Gluten" />
            </Field>

            <Field label="Logo">
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
            </Field>

            <Field label="Druckformat">
              <select name="printPreset" defaultValue="a4-3">
                <option value="a4-2">A4 Hochformat - 2 Labels pro Reihe</option>
                <option value="a4-3">A4 Hochformat - 3 Labels pro Reihe</option>
                <option value="a4-4">A4 Hochformat - 4 Labels pro Reihe</option>
                <option value="roll-76x51">Etikettenrolle - 76 x 51 mm</option>
                <option value="roll-57x32">Etikettenrolle - 57 x 32 mm</option>
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
                <h2 style={sectionTitleStyle}>Letzte Foodlabels</h2>
              </div>
            </div>

            {data.labels.length === 0 ? (
              <div style={emptyStyle}>Noch keine Foodlabels gespeichert.</div>
            ) : (
              <div style={labelListStyle}>
                {data.labels.map((label: any) => (
                  <div key={label.id} style={labelRowStyle}>
                    <div style={rowTitleBlockStyle}>
                      <strong style={rowTitleStyle}>{label.name}</strong>
                      <span style={rowSubTextStyle}>
                        {label.ingredients ? <>Zutaten: {label.ingredients}</> : "Ohne Zutatenliste"}
                      </span>
                    </div>

                    <div style={rowMetaStyle}>
                      <span>{label.labelCount} x {label.printPreset}</span>
                    </div>

                    <div style={listActionGroupStyle}>
                      <Link to={`/foodlabels?print=${label.id}`} style={previewButtonStyle}>
                        Vorschau
                      </Link>

                      <Link to={`/foodlabels/print/${label.id}`} style={primaryButtonStyle}>
                        Drucken
                      </Link>

                      <Form
                        method="post"
                        onSubmit={(event) => {
                          if (!window.confirm("Dieses Foodlabel wirklich l\u00f6schen?")) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="_action" value="delete" />
                        <input type="hidden" name="labelId" value={label.id} />
                        <button type="submit" style={dangerButtonStyle}>
                          {"L\u00f6schen"}
                        </button>
                      </Form>
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
                <h2 style={sectionTitleStyle}>{selected ? "Druckvorschau" : "Label auswaehlen"}</h2>
              </div>
            </div>

            {selected ? (
              <>
                <div style={previewWrapStyle}>
                  <FoodLabelCard label={selected} />
                </div>

                <div style={previewFooterActionsStyle}>
                  <Link to={`/foodlabels/print/${selected.id}`} style={primaryButtonStyle}>
                    Drucken
                  </Link>
                </div>
              </>
            ) : (
              <div style={emptyStyle}>Waehle links ein Foodlabel aus.</div>
            )}
          </div>
        </div>
      </section>
    
      <style>{`
        /* heycater-upload-clean-v2 */

        .heycaterUploadBox {
          border: 1px solid #d9e4ea;
          background: #ffffff;
          border-radius: 12px;
          padding: 14px 16px;
          margin: 0 0 18px;
          box-shadow: none;
        }

        .heycaterUploadHeader {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }

        .heycaterUploadHeader p {
          margin: 0 0 4px;
          font-size: 10px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #047857;
        }

        .heycaterUploadHeader h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.2;
          font-weight: 600;
          color: #0f172a;
        }

        .heycaterUploadHeader span {
          display: block;
          margin-top: 4px;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 400;
          color: #64748b;
        }

        .heycaterUploadForm {
          display: grid;
          grid-template-columns: minmax(220px, 1.4fr) repeat(4, minmax(120px, .7fr)) auto;
          gap: 8px;
          align-items: end;
        }

        .heycaterUploadForm label {
          display: grid;
          gap: 5px;
          font-size: 11.5px;
          line-height: 1.2;
          font-weight: 600;
          color: #334155;
        }

        .heycaterUploadForm input,
        .heycaterUploadForm select {
          height: 34px;
          border: 1px solid #d6e2e8;
          border-radius: 7px;
          padding: 0 9px;
          background: #ffffff;
          color: #0f172a;
          font-size: 13px;
          font-weight: 400;
        }

        .heycaterUploadForm input[type="file"] {
          padding: 6px 9px;
        }

        .heycaterUploadForm button {
          height: 34px;
          border: 1px solid #047857;
          border-radius: 7px;
          padding: 0 13px;
          background: #059669;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: none;
        }

        .heycaterUploadHint {
          margin-top: 9px;
          padding: 8px 10px;
          border: 1px dashed #d6e2e8;
          border-radius: 8px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.35;
          background: #f8fafc;
        }

        @media (max-width: 1150px) {
          .heycaterUploadForm {
            grid-template-columns: 1fr 1fr;
          }

          .heycaterUploadForm button {
            width: 100%;
          }
        }
      `}</style>

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

function FoodLabelCard({ label }: { label: any }) {
  const preset = getPrintPreset(label.printPreset || "a4-3", "auto");

  return (
    <article style={{ ...foodLabelCardStyle, width: preset.width, height: preset.height, fontSize: preset.base }}>
      <div style={foodLogoAreaStyle}>
        {label.logoDataUrl ? (
          <img
            src={label.logoDataUrl}
            alt=""
            style={{ ...logoStyle, maxWidth: preset.logo, maxHeight: preset.logo }}
          />
        ) : (
          <div style={{ ...logoPlaceholderStyle, width: preset.logo, height: preset.logo }}>Logo</div>
        )}
      </div>

      <h3 style={{ ...foodNameStyle, fontSize: preset.title }}>{label.name}</h3>

      <div style={foodInfoStyle}>
        <div style={foodSectionStyle}>
          <span style={foodKeyStyle}>Zutaten</span>
          <strong>{label.ingredients || "-"}</strong>
        </div>

        <div style={foodSectionStyle}>
          <span style={foodKeyStyle}>Allergene</span>
          <strong>{label.allergens || "-"}</strong>
        </div>
      </div>
    </article>
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
  alignSelf: "start",
};

const labelListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 520,
  overflowY: "auto",
  paddingRight: 6,
};

const labelRowStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gridTemplateColumns: "1fr 130px 170px",
  gap: 12,
  alignItems: "center",
};

const rowTitleBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const rowTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 750,
  wordBreak: "break-word",
};

const rowSubTextStyle: React.CSSProperties = {
  display: "block",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 500,
  wordBreak: "break-word",
};

const rowMetaStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#64748b",
  fontSize: 12,
};

const listActionGroupStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  width: 128,
  minWidth: 128,
  flexShrink: 0,
};

const buttonBaseStyle: React.CSSProperties = {
  minHeight: 38,
  width: "100%",
  minWidth: "100%",
  padding: "0 14px",
  borderRadius: 11,
  fontWeight: 900,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  cursor: "pointer",
  boxSizing: "border-box",
  whiteSpace: "nowrap",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  background: "#057a67",
  color: "#ffffff",
  borderColor: "#057a67",
};

const previewButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  background: "#ffffff",
  border: "1px solid #c7d8d2",
  color: "#075f52",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  minHeight: 38,
  background: "#fff7f4",
  border: "1px solid #ffb7a8",
  color: "#b42318",
};

const previewWrapStyle: React.CSSProperties = {
  border: "1px solid #dbe5eb",
  borderRadius: 16,
  background: "#f8fafc",
  padding: 20,
  minHeight: 245,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const previewFooterActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 14,
};

const emptyStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  padding: 12,
  borderRadius: 12,
};

const successStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  padding: 12,
  borderRadius: 12,
};

const foodLabelCardStyle: React.CSSProperties = {
  border: "2px solid #111827",
  outline: "1px solid #111827",
  outlineOffset: "-2px",
  background: "#ffffff",
  padding: "4mm",
  display: "grid",
  gridTemplateRows: "auto auto 1fr",
  gap: "2.8mm",
  overflow: "hidden",
  boxSizing: "border-box",
  textAlign: "center",
};

const foodTopStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "2.5mm",
  alignItems: "center",
  borderBottom: "1px solid #dbe4ea",
  paddingBottom: "1.5mm",
};


const foodLogoAreaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "15mm",
  paddingBottom: "1mm",
};

const logoStyle: React.CSSProperties = {
  objectFit: "contain",
  border: "0",
  borderRadius: 0,
  background: "#ffffff",
  display: "block",
};

const logoPlaceholderStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  color: "#94a3b8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 9,
  fontWeight: 700,
};

const foodHeaderTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
  color: "#64748b",
};

const foodNameStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  lineHeight: 1.08,
  fontWeight: 900,
  wordBreak: "break-word",
  paddingBottom: "1.5mm",
  borderBottom: "1px solid #dbe4ea",
};

const foodInfoStyle: React.CSSProperties = {
  display: "grid",
  gap: "1.8mm",
  alignContent: "start",
  textAlign: "left",
};

const foodSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.8mm",
  lineHeight: 1.2,
  color: "#111827",
  wordBreak: "break-word",
};

const foodKeyStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 900,
  fontSize: "0.82em",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};




