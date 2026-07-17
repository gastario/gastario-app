import { redirect, useActionData } from "react-router";
import { useEffect, useRef, useState } from "react";
import AppLayout from "../components/AppLayout";
import importPruefenStyles from "../styles/import-pruefen.css?url";

export function links() {
  return [
    {
      rel: "stylesheet",
      href: importPruefenStyles,
    },
  ];
}

export function meta() {
  return [{ title: "Dokument importieren - Gastario" }];
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


function mapDetectedOrderSource(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized.includes("heycater") ||
    normalized.includes("heykantine")
  ) {
    return "HEYCATER" as const;
  }

  if (normalized.includes("egora")) {
    return "EGORA" as const;
  }

  if (
    normalized.includes("website") ||
    normalized.includes("webseite") ||
    normalized.includes("webformular")
  ) {
    return "WEBSITE" as const;
  }

  if (normalized.includes("lexware")) {
    return "LEXWARE" as const;
  }

  return "OTHER" as const;
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
        source: mapDetectedOrderSource(extractedOrder.source),
        status: "REVIEW_NEEDED",
        customerName: extractedOrder.customerName || "Unbekannter Kunde",
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
        reviewReason: "Aus einem hochgeladenen Dokument erkannt. Angaben vor der Übernahme prüfen.",
        items: {
          create: Array.isArray(extractedOrder.items)
            ? extractedOrder.items.map((item: any) => ({
                name: String(item.name || "Position"),
                quantity: Number(item.quantity || 1),
                unit: "Stueck",
                unitCents: Number(item.unitCents || 0),
                totalCents:
                  Math.max(1, Number(item.quantity || 1)) *
                  Math.max(0, Number(item.unitCents || 0)),
                notes: [item.description, item.rawLine].filter(Boolean).join(" | ") || null,
              }))
            : [],
        },
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
      success: "Dokument wurde gelesen und die erkannten Auftragsdaten wurden vorbereitet.",
      fileName: pdfFileName,
      matches,
      extractedOrder,
      preview:
        text.length <= 10000
          ? text
          : [
              "===== DOKUMENTANFANG =====",
              text.slice(0, 5000),
              "",
              "===== DOKUMENTENDE =====",
              text.slice(-5000),
            ].join("\n"),
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
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [editableOrder, setEditableOrder] = useState<any>(null);

  const editableTotalCents =
    Array.isArray(editableOrder?.items)
      ? editableOrder.items.reduce(
          (sum: number, item: any) => {
            const quantity = Math.max(
              1,
              Number(item?.quantity || 1)
            );

            const unitCents = Math.max(
              0,
              Number(item?.unitCents || 0)
            );

            const calculatedTotalCents =
              unitCents * quantity;

            return sum + calculatedTotalCents;
          },
          0
        )
      : 0;

  const editableTotalFormatted =
    (editableTotalCents / 100).toLocaleString(
      "de-DE",
      {
        style: "currency",
        currency: "EUR",
      }
    );

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (actionData?.extractedOrder) {
      setEditableOrder({
        ...actionData.extractedOrder,
        items: Array.isArray(actionData.extractedOrder.items)
          ? actionData.extractedOrder.items.map((item: any) => ({
              ...item,
              name: String(item?.name || ""),
              quantity: Number(item?.quantity || 1),
              unitCents: Number(item?.unitCents || 0),
              totalCents: Number(item?.totalCents || 0),
              description: String(item?.description || ""),
            }))
          : [],
      });
    }
  }, [actionData?.extractedOrder]);

  const MAX_PDF_SIZE_BYTES =
    12 * 1024 * 1024;

  function resetSelectedFile() {
    setFileName("");
    setFileSize(0);
    setFileBase64("");
    setFileError("");
    setIsDragging(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function loadPdfFile(
    file: File | null | undefined
  ) {
    resetSelectedFile();

    if (!file) {
      return;
    }

    const normalizedName =
      String(file.name || "")
        .trim()
        .toLowerCase();

    const isPdf =
      file.type === "application/pdf" ||
      normalizedName.endsWith(".pdf");

    if (!isPdf) {
      setFileError(
        "Bitte ausschließlich eine PDF-Datei auswählen."
      );
      return;
    }

    if (!file.size || file.size <= 0) {
      setFileError(
        "Die ausgewählte PDF-Datei ist leer."
      );
      return;
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      setFileError(
        "Die PDF ist größer als 12 MB."
      );
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    try {
      const arrayBuffer =
        await file.arrayBuffer();

      const bytes =
        new Uint8Array(arrayBuffer);

      if (!bytes.length) {
        setFileError(
          "Die PDF-Datei konnte nicht vollständig gelesen werden."
        );
        return;
      }

      let binary = "";
      const chunkSize = 8192;

      for (
        let index = 0;
        index < bytes.length;
        index += chunkSize
      ) {
        const chunk = bytes.subarray(
          index,
          index + chunkSize
        );

        binary += String.fromCharCode(
          ...Array.from(chunk)
        );
      }

      setFileBase64(window.btoa(binary));
    }
    catch (error) {
      console.error(error);
      setFileBase64("");

      setFileError(
        "Die PDF-Datei konnte im Browser nicht gelesen werden."
      );
    }
  }

  async function handlePdfChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    await loadPdfFile(
      event.currentTarget.files?.[0]
    );
  }

  async function handlePdfDrop(
    event: React.DragEvent<HTMLLabelElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);

    await loadPdfFile(
      event.dataTransfer.files?.[0]
    );
  }

  return (
    <AppLayout>
      <div className="documentImportPage" style={pageStyle}>
        <header className="documentImportHero" style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Import & Auftragserkennung</p>
            <h1 style={titleStyle}>Dokument importieren</h1>
            <p style={subtitleStyle}>
              Auftragsbestätigung, Anfrage oder Catering-Dokument hochladen,
              automatisch auslesen und anschließend kontrolliert als Prüfauftrag übernehmen.
            </p>
          </div>

          <div className="documentImportSteps" style={heroStepsStyle}>
            <span>1 Upload</span>
            <span>2 Erkennung</span>
            <span>3 Pruefung</span>
            <span>4 Uebernahme</span>
          </div>
        </header>

        <section className="documentImportNotice" style={noticeStyle}>
          <strong>Sicherer Import:</strong>
          <span>
            Aus einem PDF entsteht zuerst nur ein Pruefauftrag. Der Auftrag wird erst nach manueller Kontrolle
            auf der Pruefseite als echter Auftrag uebernommen.
          </span>
        </section>

        {actionData?.error ? <div style={errorStyle}>{actionData.error}</div> : null}
        {actionData?.success ? <div style={successStyle}>{actionData.success}</div> : null}

        <section className="documentImportUploadCard" style={uploadCardStyle}>
          <div>
            <p style={eyebrowStyle}>Dokument-Upload</p>
            <h2 style={sectionTitleStyle}>Auftragsdokument hochladen</h2>
            <p style={textStyle}>
              Geeignet für Auftragsbestätigungen, Catering-Anfragen und
              Bestelldokumente aus Plattformen, Kundenportalen und
              individuellen PDF-Vorlagen.
            </p>
          </div>

          <form className="documentImportUploadForm" method="post" encType="multipart/form-data" style={uploadFormStyle}>
            <label
              style={{
                ...uploadDropStyle,
                position: "relative",
                cursor: "pointer",
                borderColor: isDragging
                  ? "#79bea9"
                  : fileBase64
                    ? "#9bcfbe"
                    : "#cdded9",
                background: isDragging
                  ? "#eaf8f3"
                  : fileBase64
                    ? "#f3faf7"
                    : "#ffffff",
                boxShadow: isDragging
                  ? "0 0 0 4px rgba(16, 163, 127, 0.10)"
                  : "none",
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={handlePdfDrop}
              className="documentImportDropzone"
            >
              <span
                style={{
                  color: "#173f37",
                  fontSize: 17,
                  fontWeight: 800,
                }}
              >
                {isDragging
                  ? "PDF jetzt hier ablegen"
                  : "PDF-Datei auswählen oder hierherziehen"}
              </span>

              <span
                style={{
                  color: "#68807a",
                  fontSize: 13,
                  lineHeight: 1.5,
                  textAlign: "center",
                }}
              >
                Auftragsbestätigung, Anfrage oder
                Bestelldokument bis maximal 12 MB
              </span>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handlePdfChange}
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />

              <input
                type="hidden"
                name="pdfFileName"
                value={fileName}
              />

              <input
                type="hidden"
                name="pdfBase64"
                value={fileBase64}
              />

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 40,
                  padding: "0 17px",
                  border: "1px solid #b8d8ce",
                  borderRadius: 10,
                  background: "#edf8f4",
                  color: "#08705b",
                  fontSize: 13,
                  fontWeight: 750,
                }}
              >
                Datei auswählen
              </span>

              {fileName ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 13px",
                    border: "1px solid #d7e7e2",
                    borderRadius: 11,
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 4,
                      minWidth: 0,
                      textAlign: "left",
                    }}
                  >
                    <strong
                      style={{
                        overflow: "hidden",
                        color: "#173f37",
                        fontSize: 13,
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fileName}
                    </strong>

                    <small style={hintStyle}>
                      {(fileSize / 1024 / 1024).toFixed(2)} MB
                      {fileBase64
                        ? " · bereit zum Auslesen"
                        : " · Datei wird vorbereitet"}
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      resetSelectedFile();
                    }}
                    style={{
                      minWidth: 86,
                      minHeight: 36,
                      padding: "0 12px",
                      border: "1px solid #e8c8c4",
                      borderRadius: 9,
                      background: "#fff8f7",
                      color: "#b23a30",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Entfernen
                  </button>
                </div>
              ) : (
                <small style={hintStyle}>
                  Anklicken oder die PDF direkt
                  in diesen Bereich ziehen.
                </small>
              )}
            </label>

            {fileError ? (
              <div
                style={{
                  padding: "11px 13px",
                  border: "1px solid #efc8c4",
                  borderRadius: 10,
                  background: "#fff7f6",
                  color: "#a93229",
                  fontSize: 13,
                  fontWeight: 650,
                }}
              >
                {fileError}
              </div>
            ) : null}

            <button type="submit" style={primaryButtonStyle} disabled={!fileBase64}>
              {fileBase64 ? "Dokument auslesen" : "PDF auswählen"}
            </button>
          </form>
        </section>

        {actionData?.extractedOrder ? (
          <section className="documentImportResult" style={resultLayoutStyle}>
            <div style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={eyebrowStyle}>Auftragsvorschlag</p>
                  <h2 style={sectionTitleStyle}>Erkannte Auftragsdaten</h2>
                </div>

                {editableOrder ? (
                  <form method="post" style={saveOrderFormStyle}>
                    <input
                      type="hidden"
                      name="_intent"
                      value="saveOrder"
                    />

                    <input
                      type="hidden"
                      name="pdfFileName"
                      value={actionData.fileName || "upload.pdf"}
                    />

                    <input
                      type="hidden"
                      name="orderJson"
                      value={JSON.stringify(editableOrder)}
                    />

                    <div className="documentImportTotalCard">
                      <span>Gesamtsumme netto</span>
                      <strong>
                        {editableTotalFormatted}
                      </strong>
                      <small>
                        Summe der erkannten Positionen
                      </small>
                    </div>

                    <button
                      type="submit"
                      style={primaryButtonStyle}
                      disabled={
                        !String(editableOrder.customerName || "").trim() ||
                        !String(editableOrder.deliveryDate || "").trim() ||
                        !Array.isArray(editableOrder.items) ||
                        editableOrder.items.length === 0
                      }
                    >
                      Als Prüfauftrag speichern
                    </button>
                  </form>
                ) : null}
              </div>

              {editableOrder ? (
                <>
                  <div className="documentImportFieldsGrid" style={editableFieldsGridStyle}>
                    <EditableField
                      label="Quelle"
                      value={editableOrder.source}
                      onChange={(value) =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          source: value,
                        }))
                      }
                    />

                    <EditableField
                      label="Kunde *"
                      value={editableOrder.customerName}
                      required
                      onChange={(value) =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          customerName: value,
                        }))
                      }
                    />

                    <EditableField
                      label="Kontaktperson"
                      value={editableOrder.contactName}
                      onChange={(value) =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          contactName: value,
                        }))
                      }
                    />

                    <EditableField
                      label="Telefon"
                      value={editableOrder.contactPhone}
                      onChange={(value) =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          contactPhone: value,
                        }))
                      }
                    />

                    <EditableField
                      label="Lieferdatum *"
                      value={editableOrder.deliveryDate}
                      placeholder="TT.MM.JJJJ"
                      required
                      onChange={(value) =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          deliveryDate: value,
                        }))
                      }
                    />

                    <EditableField
                      label="Lieferzeit"
                      value={editableOrder.deliveryTime}
                      placeholder="z. B. 12:00"
                      onChange={(value) =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          deliveryTime: value,
                        }))
                      }
                    />

                    <EditableField
                      label="Lieferadresse"
                      value={editableOrder.deliveryAddress}
                      onChange={(value) =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          deliveryAddress: value,
                        }))
                      }
                    />

                    <EditableField
                      label="Event / Präsentation"
                      value={editableOrder.presentation}
                      onChange={(value) =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          presentation: value,
                        }))
                      }
                    />
                  </div>

                  <div style={itemsHeaderStyle}>
                    <div>
                      <h3 style={smallTitleStyle}>
                        Erkannte Positionen
                      </h3>

                      <p style={editorHintStyle}>
                        Bezeichnung, Menge und Preise vor der Übernahme prüfen.
                      </p>
                    </div>

                    <button
                      type="button"
                      style={secondaryActionButtonStyle}
                      onClick={() =>
                        setEditableOrder((current: any) => ({
                          ...current,
                          items: [
                            ...(Array.isArray(current?.items)
                              ? current.items
                              : []),
                            {
                              name: "",
                              quantity: 1,
                              unitCents: 0,
                              totalCents: 0,
                              description: "",
                            },
                          ],
                        }))
                      }
                    >
                      + Position
                    </button>
                  </div>

                  <div className="documentImportItemsList" style={editableItemsListStyle}>
                    {editableOrder.items.map(
                      (item: any, index: number) => (
                        <div
                          key={index}
                          className="documentImportItemRow" style={editableItemRowStyle}
                        >
                          <label style={editorFieldStyle}>
                            Bezeichnung *
                            <input
                              value={item.name || ""}
                              placeholder="Produkt oder Leistung"
                              onChange={(event) => {
                                const value = event.currentTarget.value;

                                setEditableOrder((current: any) => ({
                                  ...current,
                                  items: current.items.map(
                                    (entry: any, itemIndex: number) =>
                                      itemIndex === index
                                        ? { ...entry, name: value }
                                        : entry
                                  ),
                                }));
                              }}
                            />
                          </label>

                          <label style={editorFieldStyle}>
                            Menge
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity || 1}
                              onChange={(event) => {
                                const quantity =
                                  Math.max(
                                    1,
                                    Number(event.currentTarget.value || 1)
                                  );

                                setEditableOrder((current: any) => ({
                                  ...current,
                                  items: current.items.map(
                                    (entry: any, itemIndex: number) =>
                                      itemIndex === index
                                        ? {
                                            ...entry,
                                            quantity,
                                            totalCents:
                                              Number(entry.unitCents || 0) *
                                              quantity,
                                          }
                                        : entry
                                  ),
                                }));
                              }}
                            />
                          </label>

                          <label style={editorFieldStyle}>
                            Einzelpreis netto
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                Number(item.unitCents || 0) / 100
                              }
                              onChange={(event) => {
                                const unitCents =
                                  Math.round(
                                    Number(
                                      event.currentTarget.value || 0
                                    ) * 100
                                  );

                                setEditableOrder((current: any) => ({
                                  ...current,
                                  items: current.items.map(
                                    (entry: any, itemIndex: number) =>
                                      itemIndex === index
                                        ? {
                                            ...entry,
                                            unitCents,
                                            totalCents:
                                              unitCents *
                                              Number(entry.quantity || 1),
                                          }
                                        : entry
                                  ),
                                }));
                              }}
                            />
                          </label>

                          <label style={editorFieldStyle}>
                            Beschreibung / Details
                            <input
                              value={item.description || ""}
                              placeholder="Zutaten, Beilagen, Allergene oder Besonderheiten"
                              onChange={(event) => {
                                const description =
                                  event.currentTarget.value;

                                setEditableOrder((current: any) => ({
                                  ...current,
                                  items: current.items.map(
                                    (entry: any, itemIndex: number) =>
                                      itemIndex === index
                                        ? { ...entry, description }
                                        : entry
                                  ),
                                }));
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            style={removeItemButtonStyle}
                            disabled={editableOrder.items.length <= 1}
                            onClick={() =>
                              setEditableOrder((current: any) => ({
                                ...current,
                                items: current.items.filter(
                                  (_: any, itemIndex: number) =>
                                    itemIndex !== index
                                ),
                              }))
                            }
                            aria-label={
                              "Position " + (index + 1) + " entfernen"
                            }
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  {editableOrder.items.some(
                    (item: any) =>
                      !String(item?.name || "").trim()
                  ) ? (
                    <div style={warningStyle}>
                      Mindestens eine Position hat noch keine Bezeichnung.
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={emptyStyle}>
                  Die erkannten Daten werden vorbereitet.
                </div>
              )}
            </div>

            <aside className="documentImportCheckCard" style={sideCardStyle}>
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
          <details className="documentImportRawText" style={cardStyle}>
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

function EditableField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const normalizedValue = String(value || "");
  const missing = Boolean(required && !normalizedValue.trim());

  return (
    <label style={editorFieldStyle}>
      {label}
      <input
        value={normalizedValue}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.currentTarget.value)
        }
        style={{
          borderColor: missing ? "#e5a8a2" : "#d4e1df",
          background: missing ? "#fff9f8" : "#ffffff",
        }}
      />

      {missing ? (
        <small style={requiredHintStyle}>
          Bitte prüfen und ergänzen.
        </small>
      ) : null}
    </label>
  );
}

const editableFieldsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
};

const editorFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#38514d",
  fontSize: 12,
  fontWeight: 700,
};

const requiredHintStyle: React.CSSProperties = {
  color: "#b23a30",
  fontSize: 11,
  fontWeight: 650,
};

const itemsHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  marginTop: 22,
  marginBottom: 12,
};

const editorHintStyle: React.CSSProperties = {
  margin: 0,
  color: "#70837f",
  fontSize: 13,
  fontWeight: 500,
};

const editableItemsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const editableItemRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(240px, 1.4fr) 90px 130px minmax(220px, 1fr) 42px",
  gap: 10,
  alignItems: "end",
  padding: 13,
  border: "1px solid #dce8e4",
  borderRadius: 14,
  background: "#fbfdfc",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "0 15px",
  border: "1px solid #acd6ca",
  borderRadius: 10,
  background: "#edf8f4",
  color: "#08705b",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
};

const removeItemButtonStyle: React.CSSProperties = {
  width: 42,
  minWidth: 42,
  height: 42,
  border: "1px solid #edc8c4",
  borderRadius: 10,
  background: "#fff8f7",
  color: "#ba3b31",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
};

const warningStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "11px 13px",
  border: "1px solid #efd5a6",
  borderRadius: 10,
  background: "#fffaf0",
  color: "#8a5a12",
  fontSize: 12,
  fontWeight: 700,
};

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



