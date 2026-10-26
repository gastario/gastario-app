import crypto from "node:crypto";
import { useState } from "react";
import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioPage,
  GastarioHeader,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioNotice,
  GastarioSection,
  GastarioFormGrid,
  GastarioField,
  GastarioInput,
  GastarioSelect,
  GastarioToolbar,
  GastarioDataList,
  GastarioDataRow,
  GastarioEmptyState,
  GastarioDetailDialog,
  GastarioDetailTabs,
  GastarioDetailPane,
  gastarioButtonClass,
} from "../components/ui";




export function meta() {
  return [{ title: "E-Mail-Import · Gastario" }];
}

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

function encryptSecret(value: string) {
  const keyValue = process.env.IMAP_ENCRYPTION_KEY || "";

  if (!keyValue) {
    throw new Error("IMAP_ENCRYPTION_KEY fehlt in Railway.");
  }

  const key = Buffer.from(keyValue, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}


function decryptSecret(value: string) {
  const keyValue = process.env.IMAP_ENCRYPTION_KEY || "";

  if (!keyValue) {
    throw new Error("IMAP_ENCRYPTION_KEY fehlt in Railway.");
  }

  const [ivValue, tagValue, encryptedValue] = value.split(".");
  const key = Buffer.from(keyValue, "base64");
  const iv = Buffer.from(ivValue, "base64");
  const tag = Buffer.from(tagValue, "base64");
  const encrypted = Buffer.from(encryptedValue, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

async function testImapConnection(options: {
  host: string;
  port: number;
  username: string;
  password: string;
}) {
  const { ImapFlow } = await import("imapflow");

  const client = new ImapFlow({
    host: options.host,
    port: options.port,
    secure: true,
    auth: {
      user: options.username,
      pass: options.password,
    },
    logger: false,
  });

  await client.connect();
  const mailbox = await client.mailboxOpen("INBOX");
  await client.logout();

  return Number(mailbox.exists || 0);
}


function maskSecret(value?: string | null) {
  return value ? "Passwort gespeichert" : "Noch kein Passwort gespeichert";
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access?.tenantId) {
    return {
      tenantName: "Gastario",
      emailAccounts: [],
      error: "Kein Mandant gefunden.",
    };
  }

  const emailAccounts = await prisma.emailAccount.findMany({
    where: {
      tenantId: access.tenantId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    tenantName: access.tenant?.name || "Gastario",
    emailAccounts,
    error: null,
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access?.tenantId) {
    return { error: "Kein Mandant gefunden." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "saveMailbox" || intent === "testMailbox") {
    const email = cleanEmail(formData.get("email"));
    const label = String(formData.get("label") || "").trim();
    const provider = String(formData.get("provider") || "STRATO").trim();
    const imapHost = String(formData.get("imapHost") || "").trim();
    const imapPort = Number(formData.get("imapPort") || 993);
    const imapUsername = String(formData.get("imapUsername") || "").trim() || email;
    const password = String(formData.get("password") || "");

    if (!email || !email.includes("@")) {
      return { error: "Bitte eine gueltige E-Mail-Adresse eintragen." };
    }

    if (!imapHost) {
      return { error: "Bitte IMAP-Server eintragen." };
    }

    if (!imapUsername) {
      return { error: "Bitte Benutzername eintragen." };
    }

    const accountId =
      String(formData.get("id") || "").trim();

    const existing = accountId
      ? await prisma.emailAccount.findFirst({
          where: {
            id: accountId,
            tenantId: access.tenantId,
          },
        })
      : await prisma.emailAccount.findFirst({
          where: {
            tenantId: access.tenantId,
            email,
          },
        });

    if (accountId && !existing) {
      return {
        error: "Das Postfach wurde nicht gefunden.",
      };
    }

    if (accountId) {
      const emailOwner =
        await prisma.emailAccount.findFirst({
          where: {
            tenantId: access.tenantId,
            email,
          },
        });

      if (
        emailOwner &&
        emailOwner.id !== accountId
      ) {
        return {
          error:
            "Diese E-Mail-Adresse ist bereits als anderes Postfach eingerichtet.",
        };
      }
    }

    const passwordData = password
      ? { imapPasswordEncrypted: encryptSecret(password) }
      : {};

    if (intent === "testMailbox") {
      const passwordForTest =
        password ||
        (existing?.imapPasswordEncrypted ? decryptSecret(existing.imapPasswordEncrypted) : "");

      if (!passwordForTest) {
        return { error: "Bitte Passwort eintragen oder zuerst ein Passwort speichern." };
      }

      try {
        const inboxCount = await testImapConnection({
          host: imapHost,
          port: imapPort,
          username: imapUsername,
          password: passwordForTest,
        });

        return { success: "Verbindung erfolgreich. Posteingang erreichbar. Mails im INBOX: " + inboxCount };
      } catch (error: any) {
        return { error: "Verbindung fehlgeschlagen: " + String(error?.message || error) };
      }
    }

    if (existing) {
      await prisma.emailAccount.update({
        where: { id: existing.id },
        data: {
          email,
          label: label || "Auftragseingang",
          active: true,
          provider,
          mode: "IMAP",
          imapHost,
          imapPort,
          imapSecure: true,
          imapUsername,
          ...passwordData,
        } as any,
      });
    } else {
      await prisma.emailAccount.create({
        data: {
          tenantId: access.tenantId,
          email,
          label: label || "Auftragseingang",
          active: true,
          provider,
          mode: "IMAP",
          imapHost,
          imapPort,
          imapSecure: true,
          imapUsername,
          ...passwordData,
        } as any,
      });
    }

    return { success: "Postfach wurde gespeichert. Als naechstes bauen wir den automatischen Abruf." };
  }

  if (intent === "deleteEmailAccount") {
    const id = String(formData.get("id") || "");

    await prisma.emailAccount.deleteMany({
      where: {
        id,
        tenantId: access.tenantId,
      },
    });

    return { success: "Postfach wurde entfernt." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function ImportsPage() {
  const data =
    useLoaderData<typeof loader>();

  const actionData =
    useActionData<typeof action>() as any;

  const [
    selectedMailboxId,
    setSelectedMailboxId,
  ] = useState<string | null>(null);

  const selectedMailbox =
    data.emailAccounts.find(
      (account: any) =>
        account.id === selectedMailboxId
    ) || null;

  const activeAccounts =
    data.emailAccounts.filter(
      (account: any) =>
        Boolean(account.active)
    ).length;

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Eingang"
          title="E-Mail-Konten"
          description={`${data.tenantName} · Auftrags-Postfächer sicher verbinden und für den automatischen Abruf vorbereiten.`}
        />

        <GastarioMetricGrid>
          <GastarioMetric
            label="Aktive Postfächer"
            value={activeAccounts}
            description="Für den automatischen Abruf aktiviert"
          />

          <GastarioMetric
            label="Konten gesamt"
            value={data.emailAccounts.length}
            description="Eingerichtete E-Mail-Konten"
          />

          <GastarioMetric
            label="Abruf"
            value="IMAP"
            description="Direkte Verbindung zum Postfach"
          />
        </GastarioMetricGrid>

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
          eyebrow="Postfach verbinden"
          title="Neues E-Mail-Konto"
          description="Gastario liest Bestellungen direkt per IMAP. Das Passwort wird verschlüsselt gespeichert."
        >
          <Form method="post">
            <GastarioFormGrid>
              <GastarioField
                label="E-Mail-Adresse"
                required
              >
                <GastarioInput
                  name="email"
                  type="email"
                  placeholder="info@firma.de"
                  required
                />
              </GastarioField>

              <GastarioField label="Bezeichnung">
                <GastarioInput
                  name="label"
                  placeholder="z. B. Heycater oder Website"
                />
              </GastarioField>

              <GastarioField label="Anbieter">
                <GastarioSelect
                  name="provider"
                  defaultValue="STRATO"
                >
                  <option value="STRATO">STRATO</option>
                  <option value="GMAIL">Gmail</option>
                  <option value="MICROSOFT">Microsoft 365</option>
                  <option value="IONOS">IONOS</option>
                  <option value="OTHER">Sonstiges</option>
                </GastarioSelect>
              </GastarioField>

              <GastarioField
                label="IMAP-Server"
                required
              >
                <GastarioInput
                  name="imapHost"
                  defaultValue="imap.strato.de"
                  required
                />
              </GastarioField>

              <GastarioField
                label="Port"
                required
              >
                <GastarioInput
                  name="imapPort"
                  defaultValue="993"
                  inputMode="numeric"
                  required
                />
              </GastarioField>

              <GastarioField label="Benutzername">
                <GastarioInput
                  name="imapUsername"
                  placeholder="meistens die E-Mail-Adresse"
                />
              </GastarioField>

              <GastarioField
                label="Passwort oder App-Passwort"
                hint="Das Passwort wird verschlüsselt gespeichert."
              >
                <GastarioInput
                  name="password"
                  type="password"
                  placeholder="Verschlüsselte Speicherung"
                />
              </GastarioField>
            </GastarioFormGrid>

            <GastarioToolbar align="end">
              <button
                type="submit"
                name="intent"
                value="testMailbox"
                className={gastarioButtonClass("secondary")}
              >
                Verbindung testen
              </button>

              <button
                type="submit"
                name="intent"
                value="saveMailbox"
                className={gastarioButtonClass("primary")}
              >
                Postfach speichern
              </button>
            </GastarioToolbar>
          </Form>
        </GastarioSection>

        <GastarioSection
          eyebrow="Ablauf"
          title="So funktioniert der E-Mail-Abruf"
          description="Gastario verbindet sich direkt mit dem vorhandenen Postfach."
        >
          <GastarioDataList>
            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">
                  Keine Weiterleitung nötig
                </strong>

                <span className="g-ui-data-row-description">
                  Gastario verbindet sich direkt mit dem vorhandenen Postfach.
                </span>
              </div>
            </GastarioDataRow>

            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">
                  Erst prüfen, dann übernehmen
                </strong>

                <span className="g-ui-data-row-description">
                  Neue Aufträge landen zuerst kontrolliert in der Eingangszentrale.
                </span>
              </div>
            </GastarioDataRow>

            <GastarioDataRow>
              <div className="g-ui-data-row-main">
                <strong className="g-ui-data-row-title">
                  Nur IMAP erforderlich
                </strong>

                <span className="g-ui-data-row-description">
                  SMTP wird für das Lesen der eingehenden Nachrichten nicht benötigt.
                </span>
              </div>
            </GastarioDataRow>
          </GastarioDataList>
        </GastarioSection>

        <GastarioSection
          eyebrow="Verbunden"
          title="Aktive Postfächer"
          description="Alle Konten, die für den automatischen Auftragseingang eingerichtet sind."
        >
          {data.emailAccounts.length === 0 ? (
            <GastarioEmptyState title="Noch kein Postfach verbunden">
              Richte oben das erste Auftrags-Postfach ein.
            </GastarioEmptyState>
          ) : (
            <GastarioDataList>
              {data.emailAccounts.map(
                (account: any) => (
                  <GastarioDataRow
                    key={account.id}
                    onClick={() =>
                      setSelectedMailboxId(
                        account.id
                      )
                    }
                  >
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {account.email}
                      </strong>

                      <span className="g-ui-data-row-description">
                        {account.label || "Auftragseingang"}
                        {" · "}
                        {account.provider || "IMAP"}
                        {" · "}
                        {account.imapHost || "-"}
                        :
                        {account.imapPort || "-"}
                        {" · "}
                        {maskSecret(
                          account.imapPasswordEncrypted
                        )}
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <strong>
                        {account.active
                          ? "Aktiv"
                          : "Inaktiv"}
                      </strong>
                    </div>
                    <span
                      className="g-ui-data-row-chevron"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </GastarioDataRow>
                )
              )}
            </GastarioDataList>
          )}
        </GastarioSection>

        <GastarioDetailDialog
          open={Boolean(selectedMailbox)}
          title={
            selectedMailbox?.email ||
            "E-Mail-Konto"
          }
          description="Postfach-Verbindung bearbeiten, testen oder entfernen."
          onClose={() =>
            setSelectedMailboxId(null)
          }
          footer={
            selectedMailbox ? (
              <GastarioToolbar>
                <button
                  type="button"
                  className={gastarioButtonClass("secondary")}
                  onClick={() =>
                    setSelectedMailboxId(null)
                  }
                >
                  Schließen
                </button>

                <button
                  type="submit"
                  form="mailbox-detail-form"
                  name="intent"
                  value="testMailbox"
                  className={gastarioButtonClass("secondary")}
                >
                  Verbindung testen
                </button>

                <button
                  type="submit"
                  form="mailbox-detail-form"
                  name="intent"
                  value="deleteEmailAccount"
                  formNoValidate
                  className={gastarioButtonClass("danger")}
                  onClick={(event) => {
                    if (
                      !window.confirm(
                        "Dieses Postfach wirklich entfernen?"
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  Entfernen
                </button>

                <button
                  type="submit"
                  form="mailbox-detail-form"
                  name="intent"
                  value="saveMailbox"
                  className={gastarioButtonClass("primary")}
                >
                  Änderungen speichern
                </button>
              </GastarioToolbar>
            ) : null
          }
        >
          {selectedMailbox ? (
            <Form
              id="mailbox-detail-form"
              method="post"
              key={selectedMailbox.id}
            >
              <input
                type="hidden"
                name="id"
                value={selectedMailbox.id}
              />

              <GastarioDetailTabs
                items={[
                  {
                    id: "connection",
                    label: "Verbindung",
                  },
                ]}
                activeId="connection"
                onChange={() => undefined}
              />

              <GastarioDetailPane active>
                <GastarioFormGrid>
                  <GastarioField
                    label="E-Mail-Adresse"
                    required
                  >
                    <GastarioInput
                      name="email"
                      type="email"
                      defaultValue={
                        selectedMailbox.email ||
                        ""
                      }
                      required
                    />
                  </GastarioField>

                  <GastarioField label="Bezeichnung">
                    <GastarioInput
                      name="label"
                      defaultValue={
                        selectedMailbox.label ||
                        ""
                      }
                      placeholder="z. B. Heycater oder Website"
                    />
                  </GastarioField>

                  <GastarioField label="Anbieter">
                    <GastarioSelect
                      name="provider"
                      defaultValue={
                        selectedMailbox.provider ||
                        "STRATO"
                      }
                    >
                      <option value="STRATO">
                        STRATO
                      </option>

                      <option value="GMAIL">
                        Gmail
                      </option>

                      <option value="MICROSOFT">
                        Microsoft 365
                      </option>

                      <option value="IONOS">
                        IONOS
                      </option>

                      <option value="OTHER">
                        Andere
                      </option>
                    </GastarioSelect>
                  </GastarioField>

                  <GastarioField
                    label="IMAP-Server"
                    required
                  >
                    <GastarioInput
                      name="imapHost"
                      defaultValue={
                        selectedMailbox.imapHost ||
                        ""
                      }
                      required
                    />
                  </GastarioField>

                  <GastarioField
                    label="IMAP-Port"
                    required
                  >
                    <GastarioInput
                      name="imapPort"
                      type="number"
                      defaultValue={
                        selectedMailbox.imapPort ||
                        993
                      }
                      required
                    />
                  </GastarioField>

                  <GastarioField
                    label="Benutzername"
                    required
                  >
                    <GastarioInput
                      name="imapUsername"
                      defaultValue={
                        selectedMailbox.imapUsername ||
                        selectedMailbox.email ||
                        ""
                      }
                      required
                    />
                  </GastarioField>

                  <GastarioField label="Neues Passwort – optional">
                    <GastarioInput
                      name="password"
                      type="password"
                      placeholder="Leer lassen = bestehendes Passwort behalten"
                    />
                  </GastarioField>
                </GastarioFormGrid>

                <GastarioNotice type="info">
                  Das vorhandene Passwort bleibt verschlüsselt gespeichert,
                  solange kein neues Passwort eingetragen wird.
                </GastarioNotice>
              </GastarioDetailPane>
            </Form>
          ) : null}
        </GastarioDetailDialog>
      </GastarioPage>
    </AppLayout>
  );
}
