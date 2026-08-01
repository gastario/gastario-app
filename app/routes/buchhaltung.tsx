import {
  Form,
  useActionData,
  useLoaderData,
} from "react-router";
import AppLayout from "../components/AppLayout";

import {
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-module-workspace.css";
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

  const connectionLabel =
    connection?.active
      ? "Aktiv"
      : connection
        ? "Pausiert"
        : "Nicht verbunden";

  return (
    <AppLayout>
      <PageShell className="modulePage">
        <PageHeader
          eyebrow="Finanzen"
          title="Buchhaltung"
          subtitle="Verbinde Gastario sicher mit deinem Buchhaltungsprogramm und verwalte den technischen Status zentral."
          actions={
            <span
              className={
                connection?.active
                  ? "moduleBadge moduleBadgeSuccess"
                  : "moduleBadge"
              }
            >
              {connectionLabel}
            </span>
          }
        />

        {data.error ? (
          <Notice type="danger">
            {data.error}
          </Notice>
        ) : null}

        {actionData?.error ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        {actionData?.success ? (
          <Notice type="success">
            {actionData.success}
          </Notice>
        ) : null}

        <PageSection
          eyebrow="Anbieter"
          title="Unterstützte Buchhaltungsprogramme"
          description="Wähle das Buchhaltungsprogramm deines Betriebs. Weitere Anbieter werden schrittweise ergänzt."
        >
          <div className="moduleProviderGrid">
            {ACCOUNTING_PROVIDERS.map(
              (provider) => {
                const available =
                  provider.availability ===
                  "AVAILABLE";

                const connected =
                  provider.code ===
                    "LEXWARE" &&
                  Boolean(connection);

                return (
                  <article
                    key={provider.code}
                    className={
                      connected
                        ? "moduleProviderCard isConnected"
                        : "moduleProviderCard"
                    }
                  >
                    <div className="moduleProviderTop">
                      <strong>
                        {provider.name}
                      </strong>

                      <span
                        className={
                          connected
                            ? "moduleBadge moduleBadgeSuccess"
                            : "moduleBadge"
                        }
                      >
                        {connected
                          ? "Verbunden"
                          : available
                            ? "Verfügbar"
                            : "In Vorbereitung"}
                      </span>
                    </div>

                    <p>
                      {provider.description}
                    </p>

                    <div className="moduleCapabilities">
                      {provider.capabilities.length >
                      0 ? (
                        provider.capabilities.map(
                          (capability) => (
                            <span key={capability}>
                              ✓ {capability}
                            </span>
                          )
                        )
                      ) : (
                        <span>
                          Noch keine aktive
                          Verbindung verfügbar.
                        </span>
                      )}
                    </div>

                    {available ? (
                      <a
                        href="#zugang-einrichten"
                        className="moduleButton moduleButtonSecondary"
                      >
                        {connected
                          ? "Verbindung verwalten"
                          : "Verbindung einrichten"}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="moduleButton moduleButtonSecondary"
                        disabled
                      >
                        Noch nicht verfügbar
                      </button>
                    )}
                  </article>
                );
              }
            )}
          </div>
        </PageSection>

        <section className="moduleSplit">
          <PageSection
            id="zugang-einrichten"
            className="moduleConnectionPanel"
            eyebrow="Verbindung"
            title="Lexware Office verbinden"
            description="Zugangsschlüssel sicher hinterlegen und die Verbindung prüfen."
            actions={
              <span
                className={
                  connection?.active
                    ? "moduleBadge moduleBadgeSuccess"
                    : "moduleBadge"
                }
              >
                {connectionLabel}
              </span>
            }
          >
            <Form
              method="post"
              className="moduleConnectionForm"
            >
              <label className="moduleField">
                <span>Zugangsschlüssel</span>

                <input
                  type="password"
                  name="accessToken"
                  autoComplete="off"
                  placeholder={
                    connection
                      ? "Leer lassen, um den gespeicherten Schlüssel weiterzuverwenden"
                      : "Zugangsschlüssel eintragen"
                  }
                />

                <small>
                  {data.secretStatus}
                </small>
              </label>

              <div className="moduleFormActions moduleFormActionsStart">
                <button
                  type="submit"
                  name="intent"
                  value="saveConnection"
                  className="moduleButton moduleButtonPrimary"
                >
                  Verbindung speichern
                </button>

                <button
                  type="submit"
                  name="intent"
                  value="testConnection"
                  className="moduleButton moduleButtonSecondary"
                >
                  Verbindung testen
                </button>
              </div>
            </Form>

            <div className="moduleSafeBox">
              <strong>
                Sicherer, nur lesender Zugriff
              </strong>

              <p>
                Gastario liest ausschließlich
                benötigte Belegdaten. Im
                verbundenen Buchhaltungskonto
                werden keine Dokumente erstellt,
                geändert oder gelöscht.
              </p>
            </div>
          </PageSection>

          <PageSection
            eyebrow="Status"
            title="Verbindungsstatus"
            description="Technischer Status der aktuell ausgewählten Anbindung."
          >
            <div className="moduleStatusList">
              <div>
                <span>Anbieter</span>
                <strong>
                  Lexware Office
                </strong>
              </div>

              <div>
                <span>Mandant</span>
                <strong>
                  {data.tenantName}
                </strong>
              </div>

              <div>
                <span>Unternehmen</span>
                <strong>
                  {connection?.companyName ||
                    "-"}
                </strong>
              </div>

              <div>
                <span>Organisations-ID</span>
                <strong>
                  {connection?.organizationId ||
                    "-"}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {connection?.status ||
                    "DISCONNECTED"}
                </strong>
              </div>

              <div>
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

              <div>
                <span>Letzter Fehler</span>

                <strong>
                  {connection?.lastError ||
                    "-"}
                </strong>
              </div>
            </div>

            {connection ? (
              <div className="moduleFormActions moduleFormActionsStart moduleStatusActions">
                <Form method="post">
                  <button
                    type="submit"
                    name="intent"
                    value={
                      connection.active
                        ? "pauseConnection"
                        : "activateConnection"
                    }
                    className="moduleButton moduleButtonSecondary"
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
                    className="moduleButton moduleButtonDanger"
                  >
                    Verbindung entfernen
                  </button>
                </Form>
              </div>
            ) : null}
          </PageSection>
        </section>
      </PageShell>
    </AppLayout>
  );
}