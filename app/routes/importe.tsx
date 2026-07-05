import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Importe · Gastario" }];
}

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
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

  if (intent === "createEmailAccount") {
    const email = cleanEmail(formData.get("email"));
    const label = String(formData.get("label") || "").trim();

    if (!email || !email.includes("@")) {
      return { error: "Bitte eine gueltige E-Mail-Adresse eintragen." };
    }

    await prisma.emailAccount.upsert({
      where: {
        tenantId_email: {
          tenantId: access.tenantId,
          email,
        },
      },
      update: {
        label: label || "Auftragseingang",
        active: true,
        provider: "MAILJET",
        mode: "FORWARDING",
      },
      create: {
        tenantId: access.tenantId,
        email,
        label: label || "Auftragseingang",
        active: true,
        provider: "MAILJET",
        mode: "FORWARDING",
      },
    });

    return { success: "Auftrags-E-Mail wurde gespeichert." };
  }

  if (intent === "deleteEmailAccount") {
    const id = String(formData.get("id") || "");

    if (!id) {
      return { error: "E-Mail-Konto fehlt." };
    }

    await prisma.emailAccount.deleteMany({
      where: {
        id,
        tenantId: access.tenantId,
      },
    });

    return { success: "Auftrags-E-Mail wurde entfernt." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function ImportsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;

  return (
    <AppLayout>
      <div style={pageStyle}>
        <header style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Importe</p>
            <h1 style={titleStyle}>Auftragserkennung per E-Mail</h1>
            <p style={subtitleStyle}>
              Hinterlege die E-Mail-Adressen, ueber die Gastario eingehende Auftraege erkennen soll.
              Eingehende Mails werden zuerst als Pruefauftrag verarbeitet.
            </p>
          </div>
        </header>

        {data.error ? <div style={errorStyle}>{data.error}</div> : null}
        {actionData?.error ? <div style={errorStyle}>{actionData.error}</div> : null}
        {actionData?.success ? <div style={successStyle}>{actionData.success}</div> : null}

        <section style={cardStyle}>
          <p style={eyebrowStyle}>Neue Quelle</p>
          <h2 style={sectionTitleStyle}>Auftrags-E-Mail eintragen</h2>

          <Form method="post" style={formStyle}>
            <input type="hidden" name="intent" value="createEmailAccount" />

            <label style={fieldStyle}>
              <span>E-Mail-Adresse</span>
              <input
                name="email"
                type="email"
                placeholder="auftraege@deine-domain.de"
                required
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span>Bezeichnung</span>
              <input
                name="label"
                placeholder="z. B. Heycater, Website, Allgemein"
                style={inputStyle}
              />
            </label>

            <button type="submit" style={primaryButtonStyle}>
              Speichern
            </button>
          </Form>

          <div style={hintBoxStyle}>
            <strong>Mailjet Webhook</strong>
            <span>
              Diese Adresse muss in Mailjet oder bei deinem Mailanbieter so eingerichtet sein,
              dass eingehende Auftraege an den Gastario Webhook weitergeleitet werden.
            </span>
          </div>
        </section>

        <section style={cardStyle}>
          <p style={eyebrowStyle}>Aktive Quellen</p>
          <h2 style={sectionTitleStyle}>E-Mail-Importe</h2>

          {data.emailAccounts.length === 0 ? (
            <div style={emptyStyle}>
              Noch keine Auftrags-E-Mail hinterlegt.
            </div>
          ) : (
            <div style={listStyle}>
              {data.emailAccounts.map((account: any) => (
                <article key={account.id} style={rowStyle}>
                  <div>
                    <strong>{account.email}</strong>
                    <span>{account.label || "Auftragseingang"}</span>
                  </div>

                  <div style={rowActionsStyle}>
                    <span style={badgeStyle}>{account.active ? "aktiv" : "inaktiv"}</span>

                    <Form method="post">
                      <input type="hidden" name="intent" value="deleteEmailAccount" />
                      <input type="hidden" name="id" value={account.id} />
                      <button type="submit" style={deleteButtonStyle}>
                        Entfernen
                      </button>
                    </Form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#057a67",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  fontSize: 11,
  fontWeight: 800,
};

const titleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 34,
  letterSpacing: "-0.04em",
  fontWeight: 850,
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 15,
  fontWeight: 650,
  maxWidth: 880,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 16px 34px rgba(15, 23, 42, 0.06)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "4px 0 16px",
  color: "#0f172a",
  fontSize: 23,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr auto",
  gap: 14,
  alignItems: "end",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#475569",
  fontSize: 12,
  fontWeight: 800,
};

const inputStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid #057a67",
  background: "#057a67",
  color: "#ffffff",
  padding: "0 18px",
  fontWeight: 900,
  cursor: "pointer",
};

const hintBoxStyle: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 4,
  fontWeight: 700,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const rowStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
};

const rowActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const badgeStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 900,
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  borderRadius: 12,
  padding: "9px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#9f1239",
  borderRadius: 14,
  padding: 14,
  fontWeight: 800,
};

const successStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 14,
  padding: 14,
  fontWeight: 800,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  color: "#64748b",
  fontWeight: 700,
};
