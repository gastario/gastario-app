import { Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("de-DE");
}

export function meta() {
  return [
    { title: "E-Mail prüfen · Gastario" },
    {
      name: "description",
      content: "Eingegangene E-Mail prüfen und für die Auftragserstellung vorbereiten.",
    },
  ];
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { emailId?: string };
}) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    return {
      setupError: "Nicht angemeldet. Bitte neu einloggen.",
      email: null,
    };
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
  });

  if (!tenantUser) {
    return {
      setupError: "Kein Mandant gefunden.",
      email: null,
    };
  }

  const email = await prisma.incomingEmail.findFirst({
    where: {
      id: params.emailId || "",
      tenantId: tenantUser.tenantId,
    },
    include: {
      attachments: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
        },
      },
    },
  });

  return {
    setupError: email ? null : "E-Mail wurde nicht gefunden.",
    email,
  };
}

export default function EmailPruefung() {
  const data = useLoaderData<typeof loader>();

  if (data.setupError || !data.email) {
    return (
      <AppLayout>
        <header className="topbar">
          <div>
            <p className="eyebrow">E-Mail-Prüfung</p>
            <h1>Nicht gefunden</h1>
            <span className="pageSubline">{data.setupError}</span>
          </div>
          <div className="topActions">
            <Link className="secondaryButton" to="/auftragseingang">Zurück</Link>
          </div>
        </header>
      </AppLayout>
    );
  }

  const email = data.email;

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">E-Mail-Prüfung</p>
          <h1>{email.subject || "E-Mail ohne Betreff"}</h1>
          <span className="pageSubline">
            {email.sender || "Unbekannter Absender"} · {formatDateTime(email.receivedAt)}
          </span>
        </div>

        <div className="topActions">
          <Link className="secondaryButton" to="/auftragseingang">Zurück</Link>
          <Link className="primaryButton" to="/auftragseingang">Auftrag später erstellen</Link>
        </div>
      </header>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Status</p>
            <h2 style={h2Style}>E-Mail wurde empfangen</h2>
            <p style={mutedStyle}>
              Diese E-Mail ist gespeichert, wurde aber noch nicht sicher als Auftrag übernommen.
            </p>
          </div>
          <span style={statusPillStyle}>Erkennung nötig</span>
        </div>

        <div style={infoGridStyle}>
          <div style={infoBoxStyle}>
            <span style={labelStyle}>Absender</span>
            <strong>{email.sender || "-"}</strong>
          </div>

          <div style={infoBoxStyle}>
            <span style={labelStyle}>Postfach</span>
            <strong>{email.mailbox || "-"}</strong>
          </div>

          <div style={infoBoxStyle}>
            <span style={labelStyle}>Quelle</span>
            <strong>{email.source}</strong>
          </div>

          <div style={infoBoxStyle}>
            <span style={labelStyle}>Anhänge</span>
            <strong>{email.attachments?.length || 0}</strong>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Inhalt</p>
            <h2 style={h2Style}>E-Mail-Text</h2>
          </div>
        </div>

        <pre style={preStyle}>{email.bodyText || "Kein Textinhalt gespeichert."}</pre>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={eyebrowStyle}>Anhänge</p>
            <h2 style={h2Style}>Dateien und erkannter Text</h2>
          </div>
        </div>

        {email.attachments.length === 0 ? (
          <div style={emptyStyle}>
            <strong>Keine Anhänge gespeichert.</strong>
            <span>Bei Heycater-Aufträgen sollte hier normalerweise eine PDF oder ein Textauszug erscheinen.</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {email.attachments.map((attachment: any) => (
              <details key={attachment.id} style={attachmentStyle}>
                <summary style={{ cursor: "pointer", fontWeight: 900 }}>
                  {attachment.filename || "Anhang"} · {attachment.mimeType || "Datei"}
                </summary>

                <pre style={{ ...preStyle, marginTop: 12 }}>
                  {attachment.textContent || "Für diesen Anhang wurde noch kein Text gespeichert."}
                </pre>
              </details>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 16px 34px rgba(15, 23, 42, 0.055)",
  marginTop: 18,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 16,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#057a67",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const h2Style: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#071426",
  fontSize: 23,
  letterSpacing: "-0.035em",
};

const mutedStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontWeight: 700,
};

const statusPillStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "7px 11px",
  background: "#fff7ed",
  color: "#9a3412",
  fontWeight: 900,
  fontSize: 13,
  border: "1px solid #fed7aa",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const infoBoxStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  display: "grid",
  gap: 5,
};

const labelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const preStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  color: "#0f172a",
  fontSize: 13,
  lineHeight: 1.55,
  maxHeight: 420,
  overflow: "auto",
};

const emptyStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 18,
  display: "grid",
  gap: 5,
  color: "#64748b",
};

const attachmentStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 15,
};
