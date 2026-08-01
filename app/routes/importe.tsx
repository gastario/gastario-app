import crypto from "node:crypto";
import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

import {
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-module-workspace.css";

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

    const existing = await prisma.emailAccount.findFirst({
      where: {
        tenantId: access.tenantId,
        email,
      },
    });

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

  const activeAccounts =
    data.emailAccounts.filter(
      (account: any) =>
        Boolean(account.active)
    ).length;

  return (
    <AppLayout>
      <PageShell className="modulePage">
        <PageHeader
          eyebrow="Eingang"
          title="E-Mail-Konten"
          subtitle={
            <>
              {data.tenantName}
              {" · "}
              Auftrags-Postfächer sicher verbinden
              und für den automatischen Abruf
              vorbereiten.
            </>
          }
          actions={
            <div className="moduleHeaderStatus">
              <span className="moduleBadge moduleBadgeSuccess">
                {activeAccounts} aktiv
              </span>

              <span className="moduleBadge">
                IMAP
              </span>
            </div>
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
          eyebrow="Postfach verbinden"
          title="Neues E-Mail-Konto"
          description="Gastario liest Bestellungen direkt per IMAP. Das Passwort wird verschlüsselt gespeichert."
          actions={
            <span className="moduleBadge moduleBadgeSuccess">
              Sicherer Abruf
            </span>
          }
        >
          <Form
            method="post"
            className="moduleFormGrid moduleFormGridMailbox"
          >
            <label className="moduleField">
              <span>E-Mail-Adresse</span>

              <input
                name="email"
                type="email"
                placeholder="info@firma.de"
                required
              />
            </label>

            <label className="moduleField">
              <span>Bezeichnung</span>

              <input
                name="label"
                placeholder="z. B. Heycater oder Website"
              />
            </label>

            <label className="moduleField">
              <span>Anbieter</span>

              <select
                name="provider"
                defaultValue="STRATO"
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
                  Sonstiges
                </option>
              </select>
            </label>

            <label className="moduleField">
              <span>IMAP-Server</span>

              <input
                name="imapHost"
                defaultValue="imap.strato.de"
                required
              />
            </label>

            <label className="moduleField">
              <span>Port</span>

              <input
                name="imapPort"
                defaultValue="993"
                inputMode="numeric"
                required
              />
            </label>

            <label className="moduleField">
              <span>Benutzername</span>

              <input
                name="imapUsername"
                placeholder="meistens die E-Mail-Adresse"
              />
            </label>

            <label className="moduleField moduleFieldPassword">
              <span>Passwort oder App-Passwort</span>

              <input
                name="password"
                type="password"
                placeholder="Verschlüsselte Speicherung"
              />
            </label>

            <div className="moduleFormActions">
              <button
                type="submit"
                name="intent"
                value="testMailbox"
                className="moduleButton moduleButtonSecondary"
              >
                Verbindung testen
              </button>

              <button
                type="submit"
                name="intent"
                value="saveMailbox"
                className="moduleButton moduleButtonPrimary"
              >
                Postfach speichern
              </button>
            </div>
          </Form>

          <div className="moduleHintGrid">
            <article>
              <strong>
                Keine Weiterleitung nötig
              </strong>

              <span>
                Gastario verbindet sich direkt
                mit dem vorhandenen Postfach.
              </span>
            </article>

            <article>
              <strong>
                Erst prüfen, dann übernehmen
              </strong>

              <span>
                Neue Aufträge landen zuerst
                kontrolliert in der
                Eingangszentrale.
              </span>
            </article>

            <article>
              <strong>
                Nur IMAP erforderlich
              </strong>

              <span>
                SMTP wird für das Lesen der
                eingehenden Nachrichten nicht
                benötigt.
              </span>
            </article>
          </div>
        </PageSection>

        <PageSection
          eyebrow="Verbunden"
          title="Aktive Postfächer"
          description="Alle Konten, die für den automatischen Auftragseingang eingerichtet sind."
          actions={
            <span className="moduleCount">
              {data.emailAccounts.length}
            </span>
          }
        >
          {data.emailAccounts.length === 0 ? (
            <div className="moduleEmpty">
              <strong>
                Noch kein Postfach verbunden
              </strong>

              <span>
                Richte oben das erste
                Auftrags-Postfach ein.
              </span>
            </div>
          ) : (
            <div className="moduleList">
              {data.emailAccounts.map(
                (account: any) => (
                  <article
                    key={account.id}
                    className="moduleListRow"
                  >
                    <div className="moduleListMain">
                      <strong>
                        {account.email}
                      </strong>

                      <span>
                        {account.label ||
                          "Auftragseingang"}
                      </span>

                      <small>
                        {account.provider ||
                          "IMAP"}
                        {" · "}
                        {account.imapHost || "-"}
                        :
                        {account.imapPort || "-"}
                        {" · "}
                        {maskSecret(
                          account.imapPasswordEncrypted
                        )}
                      </small>
                    </div>

                    <div className="moduleRowActions">
                      <span
                        className={
                          account.active
                            ? "moduleBadge moduleBadgeSuccess"
                            : "moduleBadge"
                        }
                      >
                        {account.active
                          ? "Aktiv"
                          : "Inaktiv"}
                      </span>

                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="deleteEmailAccount"
                        />

                        <input
                          type="hidden"
                          name="id"
                          value={account.id}
                        />

                        <button
                          type="submit"
                          className="moduleButton moduleButtonDanger"
                        >
                          Entfernen
                        </button>
                      </Form>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}