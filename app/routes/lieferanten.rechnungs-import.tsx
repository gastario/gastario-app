import { useState } from "react";
import AppLayout from "../components/AppLayout";

type ImportResult = {
  fileName: string;
  ok: boolean;
  recognized?: boolean;
  matched?: number;
  pricesCreated?: number;
  skipped?: number;
  error?: string;
};

const MAX_FILES = 30;
const MAX_FILE_SIZE = 12 * 1024 * 1024;

export default function SupplierInvoiceImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");

  function selectFiles(fileList: FileList | null) {
    setError("");
    setResults([]);

    if (!fileList) {
      setFiles([]);
      return;
    }

    const selected = Array.from(fileList);

    if (selected.length > MAX_FILES) {
      setError(
        `Bitte maximal ${MAX_FILES} Rechnungen auf einmal auswählen.`
      );
      return;
    }

    const invalid = selected.find((file) => {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      return (
        !isPdf ||
        !file.size ||
        file.size > MAX_FILE_SIZE
      );
    });

    if (invalid) {
      setError(
        `Datei "${invalid.name}" ist keine gültige PDF oder größer als 12 MB.`
      );
      return;
    }

    setFiles(selected);
  }

  async function startImport() {
    if (!files.length || running) {
      return;
    }

    setRunning(true);
    setResults([]);
    setCurrentIndex(0);
    setError("");

    const collected: ImportResult[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      setCurrentIndex(index + 1);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          "/api/supplier-invoice-import",
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        collected.push({
          fileName: file.name,
          ok: Boolean(data.ok),
          recognized: Boolean(data.recognized),
          matched: Number(data.matched || 0),
          pricesCreated: Number(data.pricesCreated || 0),
          skipped: Number(data.skipped || 0),
          error: data.error
            ? String(data.error)
            : undefined,
        });
      }
      catch (importError: any) {
        collected.push({
          fileName: file.name,
          ok: false,
          error: String(
            importError?.message ||
              "Rechnung konnte nicht verarbeitet werden."
          ),
        });
      }

      setResults([...collected]);
    }

    setRunning(false);
  }

  const successful = results.filter(
    (item) => item.ok && item.recognized
  ).length;

  const failed = results.filter(
    (item) => !item.ok
  ).length;

  const unrecognized = results.filter(
    (item) => item.ok && !item.recognized
  ).length;

  const totalMatched = results.reduce(
    (sum, item) => sum + Number(item.matched || 0),
    0
  );

  const totalCreated = results.reduce(
    (sum, item) =>
      sum + Number(item.pricesCreated || 0),
    0
  );

  const totalSkipped = results.reduce(
    (sum, item) => sum + Number(item.skipped || 0),
    0
  );

  const progress =
    files.length > 0
      ? Math.round(
          (results.length / files.length) * 100
        )
      : 0;

  return (
    <AppLayout>
      <main
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "32px 24px 60px",
        }}
      >
        <header
          style={{
            marginBottom: 28,
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              color: "#08705b",
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            Einkauf & Lieferanten
          </p>

          <h1
            style={{
              margin: 0,
              color: "#163f37",
              fontSize: 34,
              lineHeight: 1.15,
            }}
          >
            Lieferantenrechnungen importieren
          </h1>

          <p
            style={{
              maxWidth: 760,
              margin: "12px 0 0",
              color: "#667b76",
              fontSize: 15,
              lineHeight: 1.6,
            }}
          >
            Bis zu 30 PDF-Rechnungen gleichzeitig auswählen.
            Gastario liest die Artikel und Einkaufspreise aus
            und speichert jeden Preisstand mit dem jeweiligen
            Rechnungsdatum in der Preishistorie.
          </p>
        </header>

        <section
          style={{
            padding: 24,
            border: "1px solid #dce8e4",
            borderRadius: 18,
            background: "#fff",
            boxShadow: "0 10px 35px rgba(22,63,55,.06)",
          }}
        >
          <label
            style={{
              display: "grid",
              placeItems: "center",
              minHeight: 220,
              padding: 28,
              border: "2px dashed #b9d8ce",
              borderRadius: 16,
              background: "#f8fcfa",
              cursor: running
                ? "not-allowed"
                : "pointer",
              textAlign: "center",
            }}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={running}
              onChange={(event) =>
                selectFiles(event.currentTarget.files)
              }
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                opacity: 0,
              }}
            />

            <div>
              <strong
                style={{
                  display: "block",
                  color: "#173f37",
                  fontSize: 18,
                  marginBottom: 8,
                }}
              >
                Rechnungen auswählen
              </strong>

              <span
                style={{
                  color: "#68807a",
                  fontSize: 14,
                }}
              >
                Bis zu 30 PDF-Dateien · maximal 12 MB je Datei
              </span>
            </div>
          </label>

          {error ? (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fff2f2",
                color: "#9f2f2f",
              }}
            >
              {error}
            </div>
          ) : null}

          {files.length > 0 ? (
            <div
              style={{
                marginTop: 20,
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: 10,
                  color: "#173f37",
                }}
              >
                {files.length} Rechnung
                {files.length === 1 ? "" : "en"} ausgewählt
              </strong>

              <div
                style={{
                  maxHeight: 210,
                  overflow: "auto",
                  border: "1px solid #e1ebe8",
                  borderRadius: 12,
                }}
              >
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 20,
                      padding: "10px 13px",
                      borderBottom:
                        index < files.length - 1
                          ? "1px solid #edf2f0"
                          : "none",
                      fontSize: 13,
                    }}
                  >
                    <span>{file.name}</span>
                    <span
                      style={{
                        color: "#70827e",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={running}
                onClick={startImport}
                style={{
                  marginTop: 18,
                  minHeight: 44,
                  padding: "0 20px",
                  border: 0,
                  borderRadius: 11,
                  background: running
                    ? "#94aca6"
                    : "#08705b",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: running
                    ? "wait"
                    : "pointer",
                }}
              >
                {running
                  ? `Rechnung ${currentIndex} von ${files.length} wird verarbeitet …`
                  : `${files.length} Rechnungen importieren`}
              </button>
            </div>
          ) : null}
        </section>

        {running || results.length > 0 ? (
          <section
            style={{
              marginTop: 24,
              padding: 24,
              border: "1px solid #dce8e4",
              borderRadius: 18,
              background: "#fff",
            }}
          >
            <h2
              style={{
                margin: "0 0 16px",
                color: "#173f37",
                fontSize: 20,
              }}
            >
              Import-Ergebnis
            </h2>

            <div
              style={{
                height: 10,
                overflow: "hidden",
                borderRadius: 999,
                background: "#e8efed",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "#08705b",
                  transition: "width .2s ease",
                }}
              />
            </div>

            <p
              style={{
                margin: "8px 0 20px",
                color: "#68807a",
                fontSize: 13,
              }}
            >
              {results.length} von {files.length} verarbeitet
            </p>

            {results.length > 0 ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {[
                    ["Rechnungen erkannt", successful],
                    ["Artikel zugeordnet", totalMatched],
                    ["Preisstände gespeichert", totalCreated],
                    ["Positionen übersprungen", totalSkipped],
                    ["Nicht erkannt", unrecognized],
                    ["Fehler", failed],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "#f6faf8",
                      }}
                    >
                      <small
                        style={{
                          display: "block",
                          color: "#6c817c",
                          marginBottom: 5,
                        }}
                      >
                        {label}
                      </small>

                      <strong
                        style={{
                          color: "#173f37",
                          fontSize: 22,
                        }}
                      >
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    border: "1px solid #e1ebe8",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {results.map((item, index) => (
                    <div
                      key={`${item.fileName}-${index}`}
                      style={{
                        padding: "12px 14px",
                        borderBottom:
                          index < results.length - 1
                            ? "1px solid #edf2f0"
                            : "none",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          color: "#173f37",
                          fontSize: 13,
                        }}
                      >
                        {item.fileName}
                      </strong>

                      <small
                        style={{
                          display: "block",
                          marginTop: 4,
                          color: item.ok
                            ? "#617772"
                            : "#a43a3a",
                        }}
                      >
                        {!item.ok
                          ? item.error || "Fehler"
                          : !item.recognized
                            ? "Keine unterstützte Lieferantenrechnung erkannt"
                            : `${item.matched || 0} Artikel zugeordnet · ${item.pricesCreated || 0} Preisstände gespeichert · ${item.skipped || 0} übersprungen`}
                      </small>

                      {item.skippedPositions?.length ? (
                        <details
                          style={{
                            marginTop: 10,
                          }}
                        >
                          <summary
                            style={{
                              cursor: "pointer",
                              color: "#08705b",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {item.skippedPositions.length} nicht zugeordnete Positionen anzeigen
                          </summary>

                          <div
                            style={{
                              marginTop: 10,
                              display: "grid",
                              gap: 7,
                            }}
                          >
                            {item.skippedPositions.map(
                              (position, positionIndex) => (
                                <div
                                  key={`${position.articleNumber}-${positionIndex}`}
                                  style={{
                                    padding: "9px 10px",
                                    border: "1px solid #e3ece9",
                                    borderRadius: 9,
                                    background: "#fafcfb",
                                    fontSize: 12,
                                  }}
                                >
                                  <strong>
                                    {position.name}
                                  </strong>

                                  <div
                                    style={{
                                      marginTop: 3,
                                      color: "#697d78",
                                    }}
                                  >
                                    Art.-Nr.: {position.articleNumber || "–"}
                                    {" · "}
                                    EAN: {position.ean || "–"}
                                    {" · "}
                                    Preis: {(Number(position.netPriceCents || 0) / 100).toLocaleString(
                                      "de-DE",
                                      {
                                        style: "currency",
                                        currency: "EUR",
                                      }
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 2,
                                      color: "#9a6531",
                                    }}
                                  >
                                    {position.reason}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        ) : null}
      </main>
    </AppLayout>
  );
}


