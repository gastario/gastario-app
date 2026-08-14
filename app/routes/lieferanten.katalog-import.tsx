import {
  Form,
  Link,
  useActionData,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import {
  importSupplierCatalogRows,
  parseSupplierCatalogCsv,
  type SupplierCatalogImportRow,
} from "../lib/supplier-catalog-import.server";

export function meta() {
  return [
    {
      title:
        "Lieferanten-Katalog importieren · Gastario",
    },
  ];
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import(
      "../lib/prisma.server"
    );

  const { getTenantAccess } =
    await import(
      "../lib/features.server"
    );

  const access =
    await getTenantAccess(request);

  if (!access.tenantId) {
    return {
      tenant: access.tenant,
      suppliers: [],
      connections: [],
      setupError:
        access.setupError ||
        "Kein Mandant gefunden.",
    };
  }

  const [
    suppliers,
    connections,
  ] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        tenantId:
          access.tenantId,
        active: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),

    prisma.supplierConnection.findMany({
      where: {
        tenantId:
          access.tenantId,
        active: true,
      },
      select: {
        id: true,
        supplierId: true,
        label: true,
        type: true,
        status: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    tenant: access.tenant,
    suppliers,
    connections,
    setupError: null,
  };
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const { getTenantAccess } =
    await import(
      "../lib/features.server"
    );

  const access =
    await getTenantAccess(request);

  if (!access.tenantId) {
    return {
      error:
        access.setupError ||
        "Kein Mandant gefunden.",
    };
  }

  const formData =
    await request.formData();

  const intent =
    String(
      formData.get(
        "intent"
      ) || ""
    ).trim();

  const supplierId =
    String(
      formData.get(
        "supplierId"
      ) || ""
    ).trim();

  const connectionId =
    String(
      formData.get(
        "connectionId"
      ) || ""
    ).trim() || null;

  if (!supplierId) {
    return {
      error:
        "Bitte einen Lieferanten auswählen.",
    };
  }

  if (
    intent ===
    "preview"
  ) {
    const file =
      formData.get(
        "file"
      ) as any;

    if (
      !file ||
      typeof file.text !==
        "function"
    ) {
      return {
        error:
          "Bitte eine CSV-Datei auswählen.",
      };
    }

    const csvText =
      await file.text();

    const preview =
      parseSupplierCatalogCsv(
        csvText
      );

    if (
      preview.fatalError
    ) {
      return {
        error:
          preview.fatalError,
      };
    }

    return {
      preview: true,
      supplierId,
      connectionId,
      rows:
        preview.rows,
      payload:
        JSON.stringify(
          preview.rows
        ),
      summary:
        preview.summary,
    };
  }

  if (
    intent ===
    "import"
  ) {
    const payload =
      String(
        formData.get(
          "payload"
        ) || ""
      );

    if (!payload) {
      return {
        error:
          "Importdaten fehlen. Bitte die CSV erneut prüfen.",
      };
    }

    let rows:
      SupplierCatalogImportRow[];

    try {
      rows =
        JSON.parse(
          payload
        );
    } catch {
      return {
        error:
          "Die Importvorschau ist ungültig. Bitte die CSV erneut prüfen.",
      };
    }

    const result =
      await importSupplierCatalogRows({
        tenantId:
          access.tenantId,
        supplierId,
        connectionId,
        rows,
      });

    return {
      success:
        result.created +
        " Artikel neu angelegt, " +
        result.updated +
        " Artikel aktualisiert.",
      result: {
        total:
          result.total,
        valid:
          result.valid,
        created:
          result.created,
        updated:
          result.updated,
        skipped:
          result.skipped,
      },
    };
  }

  return {
    error:
      "Unbekannte Aktion.",
  };
}

function PreviewTable({
  rows,
}: {
  rows:
    SupplierCatalogImportRow[];
}) {
  const visible =
    rows.slice(
      0,
      100
    );

  return (
    <div
      style={{
        overflowX:
          "auto",
      }}
    >
      <table
        style={{
          width:
            "100%",
          borderCollapse:
            "collapse",
          fontSize:
            13,
        }}
      >
        <thead>
          <tr>
            {[
              "Zeile",
              "Artikel",
              "Artikelnummer",
              "EAN / GTIN",
              "Marke",
              "Einheit",
              "Status",
            ].map(
              (
                label
              ) => (
                <th
                  key={
                    label
                  }
                  style={{
                    textAlign:
                      "left",
                    padding:
                      "10px 8px",
                    borderBottom:
                      "1px solid var(--border-color, #ddd)",
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  {
                    label
                  }
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {visible.map(
            (row) => {
              const hasErrors =
                row.errors
                  .length >
                0;

              return (
                <tr
                  key={
                    row.rowNumber
                  }
                >
                  <td
                    style={{
                      padding:
                        "9px 8px",
                      verticalAlign:
                        "top",
                    }}
                  >
                    {
                      row.rowNumber
                    }
                  </td>

                  <td
                    style={{
                      padding:
                        "9px 8px",
                      verticalAlign:
                        "top",
                      minWidth:
                        220,
                    }}
                  >
                    <strong>
                      {
                        row.name ||
                        "—"
                      }
                    </strong>

                    {row.description ? (
                      <div
                        style={{
                          marginTop:
                            4,
                          opacity:
                            0.7,
                        }}
                      >
                        {
                          row.description
                        }
                      </div>
                    ) : null}
                  </td>

                  <td
                    style={{
                      padding:
                        "9px 8px",
                      verticalAlign:
                        "top",
                    }}
                  >
                    {
                      row.articleNumber ||
                      row.externalId ||
                      "—"
                    }
                  </td>

                  <td
                    style={{
                      padding:
                        "9px 8px",
                      verticalAlign:
                        "top",
                    }}
                  >
                    {
                      row.ean ||
                      row.gtin ||
                      "—"
                    }
                  </td>

                  <td
                    style={{
                      padding:
                        "9px 8px",
                      verticalAlign:
                        "top",
                    }}
                  >
                    {
                      row.brand ||
                      "—"
                    }
                  </td>

                  <td
                    style={{
                      padding:
                        "9px 8px",
                      verticalAlign:
                        "top",
                    }}
                  >
                    {
                      row.orderUnit ||
                      row.baseUnit ||
                      "—"
                    }
                  </td>

                  <td
                    style={{
                      padding:
                        "9px 8px",
                      verticalAlign:
                        "top",
                      minWidth:
                        220,
                    }}
                  >
                    {hasErrors ? (
                      <span>
                        Fehler:{" "}
                        {row.errors.join(
                          " · "
                        )}
                      </span>
                    ) : row.warnings
                        .length >
                      0 ? (
                      <span>
                        Hinweis:{" "}
                        {row.warnings.join(
                          " · "
                        )}
                      </span>
                    ) : (
                      <span>
                        Bereit
                      </span>
                    )}
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>

      {rows.length >
      visible.length ? (
        <p
          style={{
            marginTop:
              12,
            opacity:
              0.7,
          }}
        >
          Es werden die
          ersten{" "}
          {
            visible.length
          }{" "}
          von{" "}
          {
            rows.length
          }{" "}
          Zeilen angezeigt.
        </p>
      ) : null}
    </div>
  );
}

export default function SupplierCatalogImportPage() {
  const data =
    useLoaderData<
      typeof loader
    >();

  const actionData =
    useActionData<
      typeof action
    >() as any;

  const previewRows =
    Array.isArray(
      actionData?.rows
    )
      ? actionData.rows
      : [];

  const selectedSupplierId =
    actionData?.supplierId ||
    "";

  const connectionsForSelectedSupplier =
    data.connections.filter(
      (
        connection: any
      ) =>
        !selectedSupplierId ||
        connection.supplierId ===
          selectedSupplierId
    );

  return (
    <AppLayout>
      <PageShell>
        <PageHeader
          eyebrow="Einkauf & Lager"
          title="Lieferanten-Katalog importieren"
          description="CSV-Kataloge eines Lieferanten prüfen und sicher in Gastario übernehmen."
          actions={
            <Link
              to="/lieferanten"
              className="secondaryButton"
            >
              Zurück zu Lieferanten
            </Link>
          }
        />

        {data.setupError ? (
          <Notice
            tone="warning"
            title="Mandant fehlt"
          >
            {
              data.setupError
            }
          </Notice>
        ) : null}

        {actionData?.error ? (
          <Notice
            tone="danger"
            title="Import nicht möglich"
          >
            {
              actionData.error
            }
          </Notice>
        ) : null}

        {actionData?.success ? (
          <Notice
            tone="success"
            title="Katalog importiert"
          >
            {
              actionData.success
            }
          </Notice>
        ) : null}

        <PageSection
          title="1. CSV auswählen"
          description="Zuerst Lieferant wählen und anschließend die Datei prüfen."
        >
          <Form
            method="post"
            encType="multipart/form-data"
            style={{
              display:
                "grid",
              gap: 16,
              maxWidth:
                760,
            }}
          >
            <input
              type="hidden"
              name="intent"
              value="preview"
            />

            <label>
              <div
                style={{
                  marginBottom:
                    6,
                  fontWeight:
                    600,
                }}
              >
                Lieferant
              </div>

              <select
                name="supplierId"
                defaultValue={
                  selectedSupplierId
                }
                required
                style={{
                  width:
                    "100%",
                  minHeight:
                    44,
                }}
              >
                <option value="">
                  Lieferant auswählen
                </option>

                {data.suppliers.map(
                  (
                    supplier: any
                  ) => (
                    <option
                      key={
                        supplier.id
                      }
                      value={
                        supplier.id
                      }
                    >
                      {
                        supplier.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    6,
                  fontWeight:
                    600,
                }}
              >
                Verbindung
                (optional)
              </div>

              <select
                name="connectionId"
                defaultValue={
                  actionData
                    ?.connectionId ||
                  ""
                }
                style={{
                  width:
                    "100%",
                  minHeight:
                    44,
                }}
              >
                <option value="">
                  Keine Verbindung zuordnen
                </option>

                {connectionsForSelectedSupplier.map(
                  (
                    connection: any
                  ) => (
                    <option
                      key={
                        connection.id
                      }
                      value={
                        connection.id
                      }
                    >
                      {
                        connection.label ||
                        connection.type
                      }{" "}
                      ·{" "}
                      {
                        connection.status
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <div
                style={{
                  marginBottom:
                    6,
                  fontWeight:
                    600,
                }}
              >
                CSV-Datei
              </div>

              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                required
              />
            </label>

            <div
              style={{
                fontSize:
                  13,
                opacity:
                  0.75,
              }}
            >
              Benötigt wird mindestens
              eine Spalte für den
              Artikelnamen. Unterstützt
              werden außerdem z. B.
              Artikelnummer, EAN, GTIN,
              Marke, Beschreibung,
              Bestelleinheit und
              Packungsmenge.
            </div>

            <button
              type="submit"
              className="primaryButton"
            >
              CSV prüfen
            </button>
          </Form>
        </PageSection>

        {actionData?.preview ? (
          <>
            <MetricGrid>
              <MetricCard
                label="Zeilen"
                value={
                  actionData
                    .summary
                    ?.total ||
                  0
                }
              />

              <MetricCard
                label="Bereit"
                value={
                  actionData
                    .summary
                    ?.valid ||
                  0
                }
              />

              <MetricCard
                label="Hinweise"
                value={
                  actionData
                    .summary
                    ?.warnings ||
                  0
                }
              />

              <MetricCard
                label="Fehler"
                value={
                  actionData
                    .summary
                    ?.errors ||
                  0
                }
              />
            </MetricGrid>

            <PageSection
              title="2. Vorschau prüfen"
              description="Fehlerhafte Zeilen werden beim Import nicht übernommen."
            >
              <PreviewTable
                rows={
                  previewRows
                }
              />
            </PageSection>

            <PageSection
              title="3. Import bestätigen"
              description="Vorhandene Artikel werden anhand externer Kennungen aktualisiert; neue Artikel werden angelegt."
            >
              <Form
                method="post"
                style={{
                  display:
                    "flex",
                  gap: 12,
                  flexWrap:
                    "wrap",
                }}
              >
                <input
                  type="hidden"
                  name="intent"
                  value="import"
                />

                <input
                  type="hidden"
                  name="supplierId"
                  value={
                    actionData
                      .supplierId
                  }
                />

                <input
                  type="hidden"
                  name="connectionId"
                  value={
                    actionData
                      .connectionId ||
                    ""
                  }
                />

                <input
                  type="hidden"
                  name="payload"
                  value={
                    actionData
                      .payload
                  }
                />

                <button
                  type="submit"
                  className="primaryButton"
                  disabled={
                    !actionData
                      .summary
                      ?.valid
                  }
                >
                  {
                    actionData
                      .summary
                      ?.valid ||
                    0
                  }{" "}
                  Artikel importieren
                </button>
              </Form>
            </PageSection>
          </>
        ) : null}
      </PageShell>
    </AppLayout>
  );
}
