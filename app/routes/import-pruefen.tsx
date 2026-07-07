import { redirect, useActionData } from "react-router";
import { useState } from "react";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Import pruefen - Gastario" }];
}

function splitKeywords(value: string) {
  return String(value || "")
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseGermanDate(value: string) {
  const match = String(value || "").match(/^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/);

  if (!match) {
    return null;
  }

  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function createOrderNumber() {
  const now = new Date();
  const datePart =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  return "PDF-" + datePart + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

const FIELD_LABELS: Record<string, string> = {
  customerName: "Kunde",
  eventName: "Eventname",
  deliveryDate: "Lieferdatum",
  deliveryTime: "Lieferzeit",
  deliveryAddress: "Lieferadresse",
  contactName: "Kontaktperson",
  contactPhone: "Telefon",
  personCount: "Personenanzahl",
  items: "Positionen / Produkte",
  allergens: "Allergene / Hinweise",
  budget: "Budget / Preis",
  invoiceAddress: "Rechnungsadresse",
  notes: "Sonstige Hinweise",
};


export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");
  const { extractUniversalOrder } = await import("../lib/order-import-extract.server");

  const access = await getTenantAccess(request);

  if (!access?.tenantId) {
    throw new Response("Nicht angemeldet", { status: 401 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("_intent") || "");

  if (intent === "saveOrder") {
    const orderJson = String(formData.get("orderJson") || "{}");
    const pdfFileName = String(formData.get("pdfFileName") || "upload.pdf");
    const extractedOrder = JSON.parse(orderJson);

    const order = await prisma.order.create({
      data: {
        tenantId: access.tenantId,
        orderNumber: createOrderNumber(),
        source: extractedOrder.source === "Heycater" ? "HEYCATER" : "EMAIL",
        status: "AUTO_CREATED",
        customerName: extractedOrder.customerName || (extractedOrder.source === "Heycater" ? "Heycater Import" : "PDF Import"),
        eventName: extractedOrder.presentation || null,
        deliveryDate: parseGermanDate(extractedOrder.deliveryDate),
        deliveryTimeText: extractedOrder.deliveryTime || null,
        deliveryAddress: extractedOrder.deliveryAddress || null,
        contactName: extractedOrder.contactName || null,
        contactPhone: extractedOrder.contactPhone || null,
        notes:
          "Automatisch aus PDF erkannt. Eventdatum: " +
          String(extractedOrder.eventDate || "-") +
          ", Eventbeginn: " +
          String(extractedOrder.eventStart || "-"),
        platformName: extractedOrder.source || "PDF",
        originalPdfName: pdfFileName,
        confidenceScore: 70,
        reviewReason: "Automatisch aus PDF erstellt. Bitte pruefen.",
        items: {
          create: Array.isArray(extractedOrder.items)
            ? extractedOrder.items.map((item: any) => ({
                name: String(item.name || "Position"),
                quantity: Number(item.quantity || 1),
                unit: "Stueck",
                unitCents: Number(item.unitCents || 0),
                totalCents: Number(item.totalCents || 0),
                notes: [item.description, item.rawLine].filter(Boolean).join(" | ") || null,
              }))
            : [],
        },
      },
    });

    const tour = await prisma.deliveryTour.create({
      data: {
        tenantId: access.tenantId,
        name: "Import " + order.orderNumber,
        deliveryDate: parseGermanDate(extractedOrder.deliveryDate),
        status: "OPEN",
        notes: "Automatisch aus PDF-Import erstellt.",
      },
    });

    await prisma.deliveryStop.create({
      data: {
        tenantId: access.tenantId,
        tourId: tour.id,
        orderId: order.id,
        plannedTime: extractedOrder.deliveryTime || null,
        status: "OPEN",
        notes: "Automatisch aus PDF-Import erstellt.",
      },
    });

    return redirect("/auftrag-pruefung/" + order.id + "?created=1&delivery=1");
  }

  const pdfBase64 = String(formData.get("pdfBase64") || "");
  const pdfFileName = String(formData.get("pdfFileName") || "upload.pdf");

  if (!pdfBase64) {
    return { error: "Bitte eine PDF-Datei auswaehlen. Der Browser konnte keinen Dateiinhalt senden." };
  }

  if (!pdfFileName.toLowerCase().endsWith(".pdf")) {
    return { error: "Bitte nur PDF-Dateien hochladen." };
  }

  try {
    const buffer = Buffer.from(pdfBase64, "base64");
    const uint8 = new Uint8Array(buffer);

    if (buffer.byteLength <= 0) {
      return {
        error: "PDF wurde ohne Inhalt empfangen. Server: 0 Bytes.",
      };
    }

    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const pdfParseModule = require("pdf-parse");

    const pagerender = async (pageData: any) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      const items = Array.isArray(textContent?.items) ? textContent.items : [];

      return items
        .map((item: any) => String(item?.str || "").trim())
        .filter(Boolean)
        .join(" ") + "\n\n";
    };

    let text = "";

    if (typeof pdfParseModule === "function") {
      const result = await pdfParseModule(buffer, { pagerender });
      text = String(result.text || "").trim();
    } else if (typeof pdfParseModule.default === "function") {
      const result = await pdfParseModule.default(buffer, { pagerender });
      text = String(result.text || "").trim();
    } else if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: uint8 });
      const result = await parser.getText();
      text = String(result.text || "").trim();

      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    } else {
      throw new Error("pdf-parse Export wurde nicht erkannt: " + Object.keys(pdfParseModule).join(", "));
    }

    text = text
      .replace(/\u0000/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text) {
      return { error: "Aus dem PDF konnte kein Text gelesen werden. Eventuell ist es ein Scan/Bild-PDF." };
    }

    const rules = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "OrderImportRule"
       WHERE "tenantId" = $1 AND "active" = true
       ORDER BY "fieldKey" ASC`,
      access.tenantId
    );

    const lowerText = text.toLowerCase();

    const matches = rules
      .map((rule) => {
        const hits = splitKeywords(rule.keywords).filter((keyword) =>
          lowerText.includes(keyword.toLowerCase())
        );

        return {
          fieldKey: rule.fieldKey,
          label: FIELD_LABELS[rule.fieldKey] || rule.fieldKey,
          sourceName: rule.sourceName || "Alle",
          hits,
        };
      })
      .filter((match) => match.hits.length > 0);

    const extractedOrder = extractUniversalOrder(text);

    return {
      success: "PDF wurde gelesen und gegen Import-Regeln geprueft.",
      fileName: pdfFileName,
      matches,
      extractedOrder,
      preview: text.slice(0, 2500),
    };
  } catch (error: any) {
    console.error("PDF parse failed:", error);
    return { error: "PDF konnte nicht gelesen werden: " + String(error?.message || error) };
  }
}

export default function ImportPruefenPage() {
  const actionData = useActionData<typeof action>() as any;
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [fileBase64, setFileBase64] = useState("");

  async function handlePdfChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    setFileName("");
    setFileSize(0);
    setFileBase64("");

    if (!file) {
      return;
    }

    setFileName(file.name);
    setFileSize(file.size || 0);

    if (!file.size || file.size <= 0) {
      setFileName("");
      setFileSize(0);
      setFileBase64("");
      event.currentTarget.value = "";
      alert("Diese PDF-Datei hat 0 Bytes. Bitte die Datei neu herunterladen und nochmal auswaehlen.");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      if (!bytes.length) {
        alert("PDF-Datei wurde gelesen, aber mit 0 Bytes.");
        return;
      }

      let binary = "";
      const chunkSize = 8192;

      for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize);
        binary += String.fromCharCode(...Array.from(chunk));
      }

      setFileBase64(window.btoa(binary));
    } catch (error) {
      console.error(error);
      setFileBase64("");
      alert("PDF-Datei konnte im Browser nicht gelesen werden.");
    }
  }

  return (
    <AppLayout>
      <div style={pageStyle}>
        <header style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Import & Auftragserkennung</p>
            <h1 style={titleStyle}>Import pruefen</h1>
            <p style={subtitleStyle}>
              PDF-Auftrag hochladen, Daten sicher erkennen und danach als Pruefauftrag speichern.
              Erst auf der Pruefseite wird der Auftrag uebernommen.
            </p>
          </div>

          <div style={heroStepsStyle}>
            <span>1 Upload</span>
            <span>2 Erkennung</span>
            <span>3 Pruefung</span>
            <span>4 Uebernahme</span>
          </div>
        </header>

        <section style={noticeStyle}>
          <strong>Sicherer Import:</strong>
          <span>
            Aus einem PDF entsteht zuerst nur ein Pruefauftrag. Der Auftrag wird erst nach manueller Kontrolle
            auf der Pruefseite als echter Auftrag uebernommen.
          </span>
        </section>

        {actionData?.error ? <div style={errorStyle}>{actionData.error}</div> : null}
        {actionData?.success ? <div style={successStyle}>{actionData.success}</div> : null}

        <section style={uploadCardStyle}>
          <div>
            <p style={eyebrowStyle}>PDF Upload</p>
            <h2 style={sectionTitleStyle}>Auftrag hochladen</h2>
            <p style={textStyle}>
              Aktuell optimiert fuer Heycater-PDFs. Weitere Quellen wie E-Mail, Egora oder Website-Anfragen
              werden spaeter ueber die gleiche Prueflogik verarbeitet.
            </p>
          </div>

          <form method="post" encType="multipart/form-data" style={uploadFormStyle}>
            <label style={uploadDropStyle}>
              <span style={{ fontWeight: 900, color: "#0f172a" }}>
                PDF-Datei auswaehlen
              </span>
              <input type="file" accept="application/pdf,.pdf" onChange={handlePdfChange} required />
              <input type="hidden" name="pdfFileName" value={fileName} />
              <input type="hidden" name="pdfBase64" value={fileBase64} />

              {fileName ? (
                <small style={hintStyle}>
                  {fileName} ? {fileSize} Bytes
                  {fileBase64 ? " ? bereit zur Pruefung" : " ? Datei wird geladen..."}
                </small>
              ) : (
                <small style={hintStyle}>PDF hochladen und anschliessend pruefen lassen.</small>
              )}
            </label>

            <button type="submit" style={primaryButtonStyle} disabled={!fileBase64}>
              {fileBase64 ? "PDF pruefen" : "PDF wird geladen..."}
            </button>
          </form>
        </section>

        {actionData?.extractedOrder ? (
          <section style={resultLayoutStyle}>
            <div style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Auftragsvorschlag</p>
                  <h2 style={sectionTitleStyle}>Erkannte Auftragsdaten</h2>
                </div>

                <form method="post" style={saveOrderFormStyle}>
                  <input type="hidden" name="_intent" value="saveOrder" />
                  <input type="hidden" name="pdfFileName" value={actionData.fileName || "upload.pdf"} />
                  <input type="hidden" name="orderJson" value={JSON.stringify(actionData.extractedOrder)} />
                  <button type="submit" style={primaryButtonStyle}>
                    Als Pruefauftrag speichern
                  </button>
                </form>
              </div>

              <div style={summaryGridStyle}>
                <Info label="Quelle" value={actionData.extractedOrder.source} />
                <Info label="Kunde" value={actionData.extractedOrder.customerName} />
                <Info label="Kontakt" value={actionData.extractedOrder.contactName} />
                <Info label="Telefon" value={actionData.extractedOrder.contactPhone} />
                <Info label="Lieferdatum" value={actionData.extractedOrder.deliveryDate} />
                <Info label="Lieferzeit" value={actionData.extractedOrder.deliveryTime} />
                <Info label="Lieferadresse" value={actionData.extractedOrder.deliveryAddress} />
                <Info label="Praesentation" value={actionData.extractedOrder.presentation} />
              </div>

              <h3 style={smallTitleStyle}>Erkannte Positionen</h3>

              {actionData.extractedOrder.items?.length ? (
                <div style={itemListStyle}>
                  {actionData.extractedOrder.items.slice(0, 5).map((item: any, index: number) => (
                    <div key={index} style={itemRowStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <strong>{index + 1}. {item.name}</strong>
                        <strong>{item.quantity || 1}x</strong>
                      </div>
                      {item.description ? <span>{item.description}</span> : null}
                    </div>
                  ))}

                  {actionData.extractedOrder.items.length > 5 ? (
                    <details style={moreItemsStyle}>
                      <summary>
                        + {actionData.extractedOrder.items.length - 5} weitere Positionen anzeigen
                      </summary>

                      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                        {actionData.extractedOrder.items.slice(5).map((item: any, index: number) => (
                          <div key={index} style={compactItemRowStyle}>
                            <strong>{index + 6}. {item.name}</strong>
                            <span>{item.quantity || 1}x</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <div style={emptyStyle}>Noch keine Positionen erkannt.</div>
              )}
            </div>

            <aside style={sideCardStyle}>
              <p style={eyebrowStyle}>Pruefung</p>
              <h2 style={sectionTitleStyle}>Import-Check</h2>

              <div style={checkListStyle}>
                <span>Kunde erkannt</span>
                <span>Lieferdatum erkannt</span>
                <span>Lieferzeit erkannt</span>
                <span>Lieferadresse erkannt</span>
                <span>Positionen erkannt</span>
              </div>

              <p style={sideNoteStyle}>
                Nach dem Speichern oeffnet sich automatisch die Pruefseite. Dort kann der Auftrag uebernommen
                und danach unter Auftraege weiterbearbeitet werden.
              </p>
            </aside>
          </section>
        ) : null}

        {actionData?.matches ? (
          <section style={cardStyle}>
            <p style={eyebrowStyle}>Erkennung</p>
            <h2 style={sectionTitleStyle}>Treffer aus Import-Regeln</h2>

            {actionData.matches.length === 0 ? (
              <div style={emptyStyle}>
                Keine Treffer gefunden. Bitte Import-Regeln erweitern.
              </div>
            ) : (
              <div style={matchListStyle}>
                {actionData.matches.map((match: any, index: number) => (
                  <div key={index} style={matchRowStyle}>
                    <strong>{match.label}</strong>
                    <span>{match.sourceName}</span>
                    <small>{match.hits.join(", ")}</small>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {actionData?.preview ? (
          <details style={cardStyle}>
            <summary style={{ cursor: "pointer", fontWeight: 900, color: "#0f172a" }}>
              Ausgelesenen Rohtext anzeigen
            </summary>
            <pre style={preStyle}>{actionData.preview}</pre>
          </details>
        ) : null}
      </div>
    </AppLayout>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div style={infoBoxStyle}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#057a67",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  fontSize: 11,
  fontWeight: 750,
};

const titleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 34,
  letterSpacing: "-0.04em",
  fontWeight: 760,
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 15,
  fontWeight: 600,
  maxWidth: 820,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.045)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "4px 0 8px",
  fontSize: 22,
  color: "#0f172a",
};

const textStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontWeight: 650,
};


const formStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "end",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 11,
  border: "1px solid #057a67",
  background: "#057a67",
  color: "#ffffff",
  padding: "0 16px",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(5, 122, 103, 0.16)",
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#9f1239",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
};

const successStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
};

const preStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 14,
  padding: 16,
  maxHeight: 420,
  overflow: "auto",
  fontSize: 12,
  lineHeight: 1.45,
};


const hintStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 650,
};


const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  color: "#64748b",
  fontWeight: 650,
};

const matchListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const matchRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "190px 120px 1fr",
  gap: 10,
  alignItems: "center",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "10px 12px",
};


const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const infoBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 12,
  padding: "10px 12px",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const itemListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const itemRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: 10,
  padding: "10px 12px",
  color: "#0f172a",
  fontWeight: 650,
  fontSize: 13,
};


const smallTitleStyle: React.CSSProperties = {
  margin: "22px 0 10px",
  fontSize: 16,
  color: "#0f172a",
  fontWeight: 800,
};


const saveOrderFormStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
  margin: "0 0 16px",
};


const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "flex-start",
};

const heroStepsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  maxWidth: 430,
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 4,
  fontWeight: 700,
};

const uploadCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 16px 34px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 18,
};

const uploadFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "end",
};

const uploadDropStyle: React.CSSProperties = {
  border: "1px dashed #14b8a6",
  background: "#f8fffd",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 10,
};

const resultLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 16,
  alignItems: "start",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 16,
};

const sideCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.04)",
};

const checkListStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 12,
  color: "#0f172a",
  fontWeight: 800,
  flexWrap: "wrap",
};

const sideNoteStyle: React.CSSProperties = {
  marginTop: 16,
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 650,
};


const moreItemsStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  borderRadius: 14,
  padding: 14,
  color: "#0f172a",
  fontWeight: 850,
};

const compactItemRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
};



