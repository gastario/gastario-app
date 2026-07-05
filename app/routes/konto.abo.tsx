import { useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Plan & Abo · Gastario" }];
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("de-DE");
  } catch {
    return "-";
  }
}

export async function loader({ request }: { request: Request }) {
  const { getTenantAccess } = await import("../lib/features.server");

  const access = await getTenantAccess(request);

  if (!access?.tenant) {
    return {
      tenantName: "Gastario",
      planCode: "STARTER",
      subscriptionStatus: "TRIAL",
      trialEndsAt: null,
      maxUsers: 1,
      maxBrands: 1,
      maxEmailAccounts: 1,
      error: "Kein Mandant gefunden.",
    };
  }

  return {
    tenantName: access.tenant.name,
    planCode: access.tenant.planCode,
    subscriptionStatus: access.tenant.subscriptionStatus,
    trialEndsAt: access.tenant.trialEndsAt,
    maxUsers: access.tenant.maxUsers,
    maxBrands: access.tenant.maxBrands,
    maxEmailAccounts: access.tenant.maxEmailAccounts,
    error: null,
  };
}

export default function KontoAboPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <div style={pageStyle}>
        <header style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>Konto</p>
            <h1 style={titleStyle}>Plan & Abo</h1>
            <p style={subtitleStyle}>
              Hier sieht der Kunde sein aktuelles Paket, Limits und spaeter seine Abo-Rechnungen.
            </p>
          </div>
        </header>

        {data.error ? <div style={errorStyle}>{data.error}</div> : null}

        <section style={gridStyle}>
          <article style={cardStyle}>
            <p style={eyebrowStyle}>Aktueller Plan</p>
            <h2 style={planTitleStyle}>{data.planCode}</h2>
            <p style={mutedStyle}>Mandant: {data.tenantName}</p>

            <div style={badgeRowStyle}>
              <span style={badgeStyle}>{data.subscriptionStatus}</span>
              <span style={softBadgeStyle}>Testphase bis {formatDate(data.trialEndsAt)}</span>
            </div>
          </article>

          <article style={cardStyle}>
            <p style={eyebrowStyle}>Limits</p>
            <h2 style={sectionTitleStyle}>Paketumfang</h2>

            <div style={limitListStyle}>
              <div>
                <strong>{data.maxUsers}</strong>
                <span>Nutzer</span>
              </div>
              <div>
                <strong>{data.maxBrands}</strong>
                <span>Marken</span>
              </div>
              <div>
                <strong>{data.maxEmailAccounts}</strong>
                <span>E-Mail-Importe</span>
              </div>
            </div>
          </article>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Abrechnung</p>
              <h2 style={sectionTitleStyle}>Abo-Rechnungen</h2>
              <p style={mutedStyle}>
                Hier kann der Kunde spaeter seine Gastario-Rechnungen herunterladen.
              </p>
            </div>

            <button type="button" style={disabledButtonStyle} disabled>
              Noch keine Rechnungen
            </button>
          </div>

          <div style={emptyStyle}>
            Noch keine Abo-Rechnungen vorhanden. Sobald die Abrechnung aktiv ist, erscheinen sie hier als PDF-Download.
          </div>
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
  fontWeight: 850,
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
  maxWidth: 850,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 16px 34px rgba(15, 23, 42, 0.06)",
};

const planTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#0f172a",
  fontSize: 32,
  fontWeight: 900,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "4px 0 10px",
  color: "#0f172a",
  fontSize: 23,
};

const mutedStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontWeight: 650,
};

const badgeRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
};

const badgeStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 900,
};

const softBadgeStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 12,
  fontWeight: 900,
};

const limitListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
  marginTop: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const disabledButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 850,
};

const emptyStyle: React.CSSProperties = {
  marginTop: 18,
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  color: "#64748b",
  fontWeight: 700,
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#9f1239",
  borderRadius: 14,
  padding: 14,
  fontWeight: 800,
};
