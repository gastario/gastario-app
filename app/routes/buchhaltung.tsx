import {
  Form,
  useActionData,
  useLoaderData,
} from "react-router";
import AppLayout from "../components/AppLayout";
import { ACCOUNTING_PROVIDERS } from "../lib/accounting-providers";

export function meta() {
  return [{ title: "Buchhaltung · Gastario" }];
}

function formatDateTime(
  value?: string | Date | null
) {
  if (!value) {
    return "-";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "de-DE",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function formatAccountingAmount(
  value?: number | null,
  currency = "EUR"
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "-";
  }

  return new Intl.NumberFormat(
    "de-DE",
    {
      style: "currency",
      currency,
    }
  ).format(value);
}

function formatAccountingDate(
  value?: string | null
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "de-DE"
  ).format(date);
}
export async function loader({
  request,
}: {
  request: Request;
}) {
  const { prisma } = await import(
    "../lib/prisma.server"
  );

  const { getTenantAccess } = await import(
    "../lib/features.server"
  );

  const {
    maskIntegrationSecret,
  } = await import(
    "../lib/integration-secret.server"
  );

  const access =
    await getTenantAccess(request);

  if (!access?.tenantId) {
    return {
      tenantName: "Gastario",
      connection: null,
      secretStatus:
        "Noch kein Zugangsschlüssel gespeichert",
      error: "Kein Mandant gefunden.",
    };
  }

  const connection =
    await prisma.accountingConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId: access.tenantId,
          provider: "LEXWARE",
        },
      },
      select: {
        id: true,
        provider: true,
        status: true,
        label: true,
        credentialsEncrypted: true,
        organizationId: true,
        companyName: true,
        lastSyncAt: true,
        lastSuccessfulSyncAt: true,
        lastError: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  return {
    tenantName:
      access.tenant?.name || "Gastario",
    connection: connection
      ? {
          ...connection,
          credentialsEncrypted: undefined,
        }
      : null,
    secretStatus:
      maskIntegrationSecret(
        connection?.credentialsEncrypted
      ),
    error: null,
  };
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const { prisma } = await import(
    "../lib/prisma.server"
  );

  const { getTenantAccess } = await import(
    "../lib/features.server"
  );

  const {
    encryptIntegrationSecret,
    decryptIntegrationSecret,
  } = await import(
    "../lib/integration-secret.server"
  );

  const {
    testAccountingConnection,
    getAccountingConnector,
  } = await import(
    "../lib/accounting-connectors.server"
  );

  const access =
    await getTenantAccess(request);

  if (!access?.tenantId) {
    return {
      error: "Kein Mandant gefunden.",
    };
  }

  const formData =
    await request.formData();

  const intent = String(
    formData.get("intent") || ""
  );

  const existing =
    await prisma.accountingConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId: access.tenantId,
          provider: "LEXWARE",
        },
      },
    });

  if (intent === "previewDocuments") {
    if (
      !existing ||
      !existing.credentialsEncrypted
    ) {
      return {
        error:
          "Bitte zuerst eine Buchhaltungsverbindung einrichten.",
      };
    }

    if (!existing.active) {
      return {
        error:
          "Die Buchhaltungsverbindung ist pausiert.",
      };
    }

    const connector =
      getAccountingConnector(
        existing.provider
      );

    if (!connector) {
      return {
        error:
          "Für diesen Anbieter ist noch kein aktiver Connector vorhanden.",
      };
    }

    try {
      const accessToken =
        decryptIntegrationSecret(
          existing.credentialsEncrypted
        );

      const page =
        await connector.listOrderConfirmations(
          accessToken,
          {
            page: 0,
            size: 20,
          }
        );

      const documents = (
        Array.isArray(page.content)
          ? page.content
          : []
      ).map((document) => ({
        id: document.id,
        voucherNumber:
          document.voucherNumber || "-",
        voucherDate:
          document.voucherDate || null,
        voucherStatus:
          document.voucherStatus || "-",
        contactName:
          document.contactName || "-",
        totalAmount:
          typeof document.totalAmount ===
          "number"
            ? document.totalAmount
            : null,
        currency:
          document.currency || "EUR",
        archived:
          Boolean(document.archived),
      }));

      await prisma.accountingConnection.update({
        where: {
          id: existing.id,
        },
        data: {
          status: "ACTIVE",
          lastSyncAt: new Date(),
          lastSuccessfulSyncAt:
            new Date(),
          lastError: null,
        },
      });

      return {
        success:
          documents.length +
          " Auftragsbestätigungen wurden abgerufen.",
        documents,
      };
    } catch (error: any) {
      const message = String(
        error?.message || error
      );

      await prisma.accountingConnection.update({
        where: {
          id: existing.id,
        },
        data: {
          status: "ERROR",
          lastSyncAt: new Date(),
          lastError: message,
        },
      });

      return {
        error:
          "Auftragsbestätigungen konnten nicht abgerufen werden: " +
          message,
      };
    }
  }
  if (
    intent === "saveConnection" ||
    intent === "testConnection"
  ) {
    const accessToken = String(
      formData.get("accessToken") || ""
    ).trim();

    const tokenForRequest =
      accessToken ||
      (
        existing?.credentialsEncrypted
          ? decryptIntegrationSecret(
              existing.credentialsEncrypted
            )
          : ""
      );

    if (!tokenForRequest) {
      return {
        error:
          "Bitte einen Zugangsschlüssel eintragen oder zuerst speichern.",
      };
    }

    let profile;

    try {
      profile =
        await testAccountingConnection(
          tokenForRequest
        );
    } catch (error: any) {
      const message = String(
        error?.message || error
      );

      if (existing) {
        await prisma.accountingConnection.update({
          where: {
            id: existing.id,
          },
          data: {
            status: "ERROR",
            lastError: message,
            lastSyncAt: new Date(),
          },
        });
      }

      return {
        error:
          "Verbindung fehlgeschlagen: " +
          message,
      };
    }

    if (intent === "testConnection") {
      if (existing) {
        await prisma.accountingConnection.update({
          where: {
            id: existing.id,
          },
          data: {
            status: "ACTIVE",
            organizationId:
              profile.organizationId || null,
            companyName:
              profile.companyName || null,
            lastSyncAt: new Date(),
            lastSuccessfulSyncAt:
              new Date(),
            lastError: null,
            active: true,
          },
        });
      }

      return {
        success:
          "Verbindung erfolgreich. Verbunden mit " +
          (
            profile.companyName ||
            "dem Buchhaltungskonto"
          ) +
          ".",
      };
    }

    const credentialsEncrypted =
      accessToken
        ? encryptIntegrationSecret(
            accessToken
          )
        : existing?.credentialsEncrypted;

    if (!credentialsEncrypted) {
      return {
        error:
          "Der Zugangsschlüssel konnte nicht gespeichert werden.",
      };
    }

    await prisma.accountingConnection.upsert({
      where: {
        tenantId_provider: {
          tenantId: access.tenantId,
          provider: "LEXWARE",
        },
      },
      update: {
        label: "Buchhaltung",
        credentialsEncrypted,
        status: "ACTIVE",
        organizationId:
          profile.organizationId || null,
        companyName:
          profile.companyName || null,
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt:
          new Date(),
        lastError: null,
        active: true,
      },
      create: {
        tenantId: access.tenantId,
        provider: "LEXWARE",
        label: "Buchhaltung",
        credentialsEncrypted,
        status: "ACTIVE",
        organizationId:
          profile.organizationId || null,
        companyName:
          profile.companyName || null,
        lastSyncAt: new Date(),
        lastSuccessfulSyncAt:
          new Date(),
        lastError: null,
        active: true,
        settingsJson: {
          readOnly: true,
          documentTypes: [
            "orderconfirmation",
          ],
        },
      },
    });

    return {
      success:
        "Buchhaltungsverbindung wurde gespeichert.",
    };
  }

  if (intent === "pauseConnection") {
    if (!existing) {
      return {
        error:
          "Es ist keine Verbindung vorhanden.",
      };
    }

    await prisma.accountingConnection.update({
      where: {
        id: existing.id,
      },
      data: {
        active: false,
        status: "PAUSED",
      },
    });

    return {
      success:
        "Die Verbindung wurde pausiert.",
    };
  }

  if (intent === "activateConnection") {
    if (!existing) {
      return {
        error:
          "Es ist keine Verbindung vorhanden.",
      };
    }

    await prisma.accountingConnection.update({
      where: {
        id: existing.id,
      },
      data: {
        active: true,
        status: "CONFIGURED",
        lastError: null,
      },
    });

    return {
      success:
        "Die Verbindung wurde aktiviert.",
    };
  }

  if (intent === "deleteConnection") {
    if (existing) {
      await prisma.accountingConnection.delete({
        where: {
          id: existing.id,
        },
      });
    }

    return {
      success:
        "Die Buchhaltungsverbindung wurde entfernt.",
    };
  }

  return {
    error: "Unbekannte Aktion.",
  };
}

export default function AccountingPage() {
  const data =
    useLoaderData<typeof loader>();

  const actionData =
    useActionData<typeof action>();

  const connection =
    data.connection;

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Integrationen
          </p>

          <h1>Buchhaltung</h1>

          <span className="pageSubline">
            Verbinde Gastario sicher mit deinem Buchhaltungsprogramm.
            Aktive Verbindungen werden beim zentralen Import automatisch berücksichtigt.
          </span>
        </div>
      </header>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">
              Anbieter
            </p>

            <h2>
              Unterstützte Buchhaltungsprogramme
            </h2>

            <span className="pageSubline">
              Wähle das Buchhaltungsprogramm deines Betriebs. Weitere Anbieter werden schrittweise ergänzt.
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {ACCOUNTING_PROVIDERS.map(
            (provider) => {
              const available =
                provider.availability ===
                "AVAILABLE";

              const connected =
                provider.code === "LEXWARE" &&
                Boolean(connection);

              return (
                <article
                  key={provider.code}
                  className="settingsCard"
                  style={{
                    display: "grid",
                    gridTemplateRows:
                      "auto minmax(64px, auto) 1fr auto",
                    gap: 14,
                    alignContent: "start",
                    minHeight: 236,
                    padding: 18,
                    border:
                      connected
                        ? "1px solid #9ed9c5"
                        : "1px solid #dbe7e2",
                    background:
                      connected
                        ? "linear-gradient(180deg, #f3fcf8 0%, #ffffff 100%)"
                        : available
                          ? "#ffffff"
                          : "#f8faf9",
                    boxShadow:
                      connected
                        ? "0 14px 32px rgba(12, 122, 86, 0.10)"
                        : "0 8px 22px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div className="settingsCardTop">
                    <strong
                      style={{
                        fontSize: 18,
                        lineHeight: 1.2,
                        color: "#12372b",
                      }}
                    >
                      {provider.name}
                    </strong>

                    <em
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 28,
                        padding: "5px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontStyle: "normal",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                        color:
                          connected
                            ? "#087554"
                            : available
                              ? "#1d4f43"
                              : "#64748b",
                        background:
                          connected
                            ? "#dff7ed"
                            : available
                              ? "#edf7f3"
                              : "#eef2f4",
                        border:
                          connected
                            ? "1px solid #afe5d3"
                            : "1px solid #dbe5e1",
                      }}
                    >
                      {connected
                        ? "Verbunden"
                        : available
                          ? "Verfügbar"
                          : "In Vorbereitung"}
                    </em>
                  </div>

                  <span>
                    {provider.description}
                  </span>

                  {provider.capabilities.length >
                  0 ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 5,
                      }}
                    >
                      {provider.capabilities.map(
                        (capability) => (
                          <small
                            key={capability}
                          >
                            ✓ {capability}
                          </small>
                        )
                      )}
                    </div>
                  ) : (
                    <small>
                      Noch keine aktive Verbindung verfügbar.
                    </small>
                  )}

                  {available ? (
                    <a
                      href="#zugang-einrichten"
                      className="secondaryButton"
                      style={{
                        display: "inline-flex",
                        justifyContent: "center",
                        alignItems: "center",
                        textDecoration: "none",
                        marginTop: "auto",
                      }}
                    >
                      {connected
                        ? "Verbindung verwalten"
                        : "Verbindung einrichten"}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="ghostButton"
                      disabled
                      style={{
                        marginTop: "auto",
                        opacity: 0.6,
                        cursor: "not-allowed",
                      }}
                    >
                      Noch nicht verfügbar
                    </button>
                  )}
                </article>
              );
            }
          )}
        </div>
      </section>

      {data.error ? (
        <section className="panel">
          <div className="noteBox">
            <strong>Fehler</strong>
            <p>{data.error}</p>
          </div>
        </section>
      ) : null}

      {actionData?.error ? (
        <section className="panel">
          <div className="noteBox">
            <strong>
              Verbindung nicht möglich
            </strong>
            <p>{actionData.error}</p>
          </div>
        </section>
      ) : null}

      {actionData?.success ? (
        <section className="panel">
          <div className="noteBox">
            <strong>Erfolgreich</strong>
            <p>{actionData.success}</p>
          </div>
        </section>
      ) : null}

      <section className="settingsGrid">
        <article
          className="panel"
          id="zugang-einrichten"
          style={{
            scrollMarginTop: 24,
          }}
        >
          <div className="panelHeader">
            <div>
              <p className="eyebrow">
                Verbindung
              </p>

              <h2>
                Lexware Office verbinden
              </h2>

              <span className="pageSubline">
                Zugang sicher hinterlegen und die Verbindung prüfen.
              </span>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "7px 12px",
                borderRadius: 999,
                background:
                  connection?.active
                    ? "#e8f7f1"
                    : "#f1f5f9",
                color:
                  connection?.active
                    ? "#087b59"
                    : "#475569",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {connection?.active
                ? "aktiv"
                : connection
                  ? "pausiert"
                  : "nicht verbunden"}
            </span>
          </div>

          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="saveConnection"
            />

            <div
              style={{
                display: "grid",
                gap: 16,
              }}
            >
              <label
                style={{
                  display: "grid",
                  gap: 7,
                }}
              >
                <strong>
                  Zugangsschlüssel
                </strong>

                <input
                  type="password"
                  name="accessToken"
                  autoComplete="off"
                  placeholder={
                    connection
                      ? "Leer lassen, um gespeicherten Schlüssel weiterzuverwenden"
                      : "Zugangsschlüssel eintragen"
                  }
                  style={{
                    width: "100%",
                    minHeight: 46,
                    border:
                      "1px solid #cbd5e1",
                    borderRadius: 12,
                    padding: "0 14px",
                    font: "inherit",
                    boxSizing:
                      "border-box",
                  }}
                />

                <small>
                  {data.secretStatus}
                </small>
              </label>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <button
                  type="submit"
                  className="primaryButton"
                >
                  Verbindung speichern
                </button>

                <button
                  type="submit"
                  name="intent"
                  value="testConnection"
                  className="secondaryButton"
                >
                  Verbindung testen
                </button>
              </div>
            </div>
          </Form>

          <div
            className="noteBox"
            style={{
              marginTop: 20,
            }}
          >
            <strong>
              Sicherer, nur lesender Zugriff
            </strong>

            <p>
              Gastario liest ausschließlich benötigte Belegdaten.
              Im verbundenen Buchhaltungskonto werden keine Dokumente
              erstellt, geändert oder gelöscht.
            </p>
          </div>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">
                Status
              </p>

              <h2>
                Verbindungsstatus
              </h2>

              <span className="pageSubline">
                Technischer Status der aktuell ausgewählten Anbindung.
              </span>
            </div>
          </div>

          <div className="settingsList">
            <div className="settingsItem">
              <span>Anbieter</span>
              <strong>Lexware Office</strong>
            </div>

            <div className="settingsItem">
              <span>Mandant</span>
              <strong>
                {data.tenantName}
              </strong>
            </div>

            <div className="settingsItem">
              <span>Unternehmen</span>
              <strong>
                {connection?.companyName ||
                  "-"}
              </strong>
            </div>

            <div className="settingsItem">
              <span>
                Organisations-ID
              </span>
              <strong>
                {connection?.organizationId ||
                  "-"}
              </strong>
            </div>

            <div className="settingsItem">
              <span>Status</span>
              <strong>
                {connection?.status ||
                  "DISCONNECTED"}
              </strong>
            </div>

            <div className="settingsItem">
              <span>
                Letzter erfolgreicher Test
              </span>
              <strong>
                {formatDateTime(
                  connection
                    ?.lastSuccessfulSyncAt
                )}
              </strong>
            </div>

            <div className="settingsItem">
              <span>
                Letzter Fehler
              </span>
              <strong>
                {connection?.lastError ||
                  "-"}
              </strong>
            </div>
          </div>

          {connection ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 20,
              }}
            >
              <Form method="post">
                <button
                  type="submit"
                  name="intent"
                  value={
                    connection.active
                      ? "pauseConnection"
                      : "activateConnection"
                  }
                  className="secondaryButton"
                >
                  {connection.active
                    ? "Verbindung pausieren"
                    : "Verbindung aktivieren"}
                </button>
              </Form>

              <Form method="post">
                <button
                  type="submit"
                  name="intent"
                  value="deleteConnection"
                  className="ghostButton"
                >
                  Verbindung entfernen
                </button>
              </Form>
            </div>
          ) : null}
        </article>
      </section>
    </AppLayout>
  );
}