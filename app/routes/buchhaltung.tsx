import {
  Form,
  useActionData,
  useLoaderData,
} from "react-router";
import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  GastarioSection,
  GastarioDataList,
  GastarioDataRow,
  gastarioButtonClass,
  GastarioField,
  GastarioInput,
  GastarioToolbar,
  GastarioSplitView,
  GastarioSplitMain,
  GastarioSplitAside,
} from "../components/ui";

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
      <GastarioPage>
        <GastarioHeader
          eyebrow="Finanzen"
          title="Buchhaltung"
          description="Verbinde Gastario sicher mit deinem Buchhaltungsprogramm und verwalte den technischen Status zentral."
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
          <GastarioNotice type="danger">
            {data.error}
          </GastarioNotice>
        ) : null}

        {actionData?.error ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}

        {actionData?.success ? (
          <GastarioNotice type="success">
            {actionData.success}
          </GastarioNotice>
        ) : null}

        <GastarioSection
          eyebrow="Anbieter"
          title="Unterstützte Buchhaltungsprogramme"
          description="Wähle das Buchhaltungsprogramm deines Betriebs. Weitere Anbieter werden schrittweise ergänzt."
        >
          <GastarioDataList>
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
                  <GastarioDataRow
                    key={provider.code}
                  >
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {provider.name}
                      </strong>

                      <span className="g-ui-data-row-description">
                        {provider.description}

                        {provider.capabilities.length >
                        0
                          ? ` · ${provider.capabilities.join(
                              " · "
                            )}`
                          : " · Noch keine aktive Verbindung verfügbar."}
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <strong>
                        {connected
                          ? "Verbunden"
                          : available
                            ? "Verfügbar"
                            : "In Vorbereitung"}
                      </strong>
                    </div>

                    <div className="g-ui-data-row-actions">
                      {available ? (
                        <a
                          href="#zugang-einrichten"
                          className={gastarioButtonClass(
                            "secondary"
                          )}
                        >
                          {connected
                            ? "Verbindung verwalten"
                            : "Verbindung einrichten"}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className={gastarioButtonClass(
                            "secondary"
                          )}
                          disabled
                        >
                          Noch nicht verfügbar
                        </button>
                      )}
                    </div>
                  </GastarioDataRow>
                );
              }
            )}
          </GastarioDataList>
        </GastarioSection>

        <GastarioSplitView wide>
          <GastarioSplitMain>
          <div id="zugang-einrichten">
            <GastarioSection
              eyebrow="Verbindung"
              title="Lexware Office verbinden"
              description="Zugangsschlüssel sicher hinterlegen und die Verbindung prüfen."
              actions={
                <strong>
                  {connectionLabel}
                </strong>
              }
            >
              <Form method="post">
                <GastarioField label="Zugangsschlüssel">
                  <GastarioInput
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
                </GastarioField>

                <GastarioToolbar>
                  <button
                    type="submit"
                    name="intent"
                    value="saveConnection"
                    className={gastarioButtonClass(
                      "primary"
                    )}
                  >
                    Verbindung speichern
                  </button>

                  <button
                    type="submit"
                    name="intent"
                    value="testConnection"
                    className={gastarioButtonClass(
                      "secondary"
                    )}
                  >
                    Verbindung testen
                  </button>
                </GastarioToolbar>
              </Form>

              <GastarioNotice type="info">
                <strong>
                  Sicherer, nur lesender Zugriff
                </strong>
                {" "}
                Gastario liest ausschließlich benötigte
                Belegdaten. Im verbundenen Buchhaltungskonto
                werden keine Dokumente erstellt, geändert
                oder gelöscht.
              </GastarioNotice>
            </GastarioSection>
          </div>
          </GastarioSplitMain>

          <GastarioSplitAside>
            <GastarioSection
              eyebrow="Status"
              title="Verbindungsstatus"
              description="Technischer Status der aktuell ausgewählten Anbindung."
            >
              <GastarioDataList>
                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Anbieter
                    </strong>
                    <span className="g-ui-data-row-description">
                      Verbundenes Buchhaltungsprogramm
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>Lexware Office</strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Mandant
                    </strong>
                    <span className="g-ui-data-row-description">
                      Gastario-Betrieb
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {data.tenantName}
                    </strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Unternehmen
                    </strong>
                    <span className="g-ui-data-row-description">
                      Verbundenes Lexware-Unternehmen
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {connection?.companyName || "-"}
                    </strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Organisations-ID
                    </strong>
                    <span className="g-ui-data-row-description">
                      Technische Konto-Zuordnung
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {connection?.organizationId || "-"}
                    </strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Status
                    </strong>
                    <span className="g-ui-data-row-description">
                      Aktueller Zustand der Verbindung
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {connection?.status || "DISCONNECTED"}
                    </strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Letzter erfolgreicher Test
                    </strong>
                    <span className="g-ui-data-row-description">
                      Letzte bestätigte Kommunikation
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {formatDateTime(
                        connection?.lastSuccessfulSyncAt
                      )}
                    </strong>
                  </div>
                </GastarioDataRow>

                <GastarioDataRow>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">
                      Letzter Fehler
                    </strong>
                    <span className="g-ui-data-row-description">
                      Letzte technische Fehlermeldung
                    </span>
                  </div>

                  <div className="g-ui-data-row-meta">
                    <strong>
                      {connection?.lastError || "-"}
                    </strong>
                  </div>
                </GastarioDataRow>
              </GastarioDataList>

              {connection ? (
                <GastarioToolbar>
                  <Form method="post">
                    <button
                      type="submit"
                      name="intent"
                      value={
                        connection.active
                          ? "pauseConnection"
                          : "activateConnection"
                      }
                      className={gastarioButtonClass(
                        "secondary"
                      )}
                    >
                      {connection.active
                        ? "Verbindung pausieren"
                        : "Verbindung aktivieren"}
                    </button>
                  </Form>

                  <Form
                    method="post"
                    onSubmit={(event) => {
                      if (
                        !window.confirm(
                          "Buchhaltungsverbindung wirklich entfernen?"
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <button
                      type="submit"
                      name="intent"
                      value="deleteConnection"
                      className={gastarioButtonClass(
                        "danger"
                      )}
                    >
                      Verbindung entfernen
                    </button>
                  </Form>
                </GastarioToolbar>
              ) : null}
            </GastarioSection>
          </GastarioSplitAside>
        </GastarioSplitView>
      </GastarioPage>
    </AppLayout>
  );
}