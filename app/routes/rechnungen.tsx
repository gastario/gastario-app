import { Link, redirect, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Rechnungen · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { getUserId } = await import("../lib/session.server");
  const { prisma } = await import("../lib/prisma.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
  });

  if (!access) {
    return {
      tenantName: "Gastario",
      invoiceStats: {
        direct: 0,
        external: 0,
        platform: 0,
        drafts: 0,
      },
    };
  }

  return {
    tenantName: access.tenant?.name || "Gastario",
    invoiceStats: {
      direct: 0,
      external: 0,
      platform: 0,
      drafts: 0,
    },
  };
}

export default function RechnungenPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Verkauf</p>
          <h1>Rechnungen</h1>
          <p className="muted">
            Rechnungen, externe Kassen-Rechnungen und Plattform-Gutschriften sauber getrennt verwalten.
          </p>
        </div>

        <Link className="button secondary" to="/auftragseingang">
          Auftrag erfassen
        </Link>
      </header>

      <section className="contentGrid">
        <div className="card">
          <p className="eyebrow">Grundprinzip</p>
          <h2>Keine doppelte Abrechnung</h2>
          <p className="muted">
            Ein Auftrag wird nicht automatisch zur Rechnung. Pro Auftrag wird später festgelegt,
            ob eine direkte Rechnung erstellt wird, ob eine externe Kassen-Rechnung verknüpft wird
            oder ob eine Plattform wie Heycater/Egora per Gutschrift abrechnet.
          </p>

          <div style={noticeStyle}>
            <strong>Wichtig:</strong> Fertige Rechnungen dürfen später nicht einfach überschrieben
            werden. Änderungen laufen über Storno, Korrektur oder neue Rechnung.
          </div>
        </div>

        <div className="statsGrid">
          <div className="statCard">
            <span>Direkte Rechnungen</span>
            <strong>{data.invoiceStats.direct}</strong>
            <small>Für direkte Kundenaufträge</small>
          </div>

          <div className="statCard">
            <span>Externe Rechnungen</span>
            <strong>{data.invoiceStats.external}</strong>
            <small>Kasse / Lexware / extern</small>
          </div>

          <div className="statCard">
            <span>Plattform-Gutschriften</span>
            <strong>{data.invoiceStats.platform}</strong>
            <small>Heycater / Egora / Feedr</small>
          </div>

          <div className="statCard">
            <span>Entwürfe</span>
            <strong>{data.invoiceStats.drafts}</strong>
            <small>Noch nicht finalisiert</small>
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">Abrechnungsarten</p>
          <h2>So wird Gastario rechnen</h2>

          <div style={billingGridStyle}>
            <div style={billingBoxStyle}>
              <strong>Direkte Rechnung</strong>
              <p>
                Für Kunden, die direkt bei dir bestellen. Aus Auftrag wird auf Wunsch eine Rechnung.
              </p>
            </div>

            <div style={billingBoxStyle}>
              <strong>Externe Kassen-Rechnung</strong>
              <p>
                Die offizielle Rechnungsnummer kommt aus deiner Kasse. Gastario speichert und verknüpft sie.
              </p>
            </div>

            <div style={billingBoxStyle}>
              <strong>Plattform-Gutschrift</strong>
              <p>
                Für Heycater, Egora, Feedr usw. Gastario erstellt keine doppelte Rechnung.
              </p>
            </div>

            <div style={billingBoxStyle}>
              <strong>Keine Rechnung</strong>
              <p>
                Für interne Vorgänge, Testaufträge oder Fälle ohne Abrechnung.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">Rechtssichere Vorbereitung</p>
          <h2>Was wir als Nächstes bauen</h2>

          <ul style={listStyle}>
            <li>Eigene Tabellen für Invoice und InvoiceItem.</li>
            <li>Abrechnungsart am Auftrag: direkt, extern, Plattform oder keine Rechnung.</li>
            <li>Pflichtfelder: Rechnungsdatum, Leistungsdatum, Kunde, Steuersatz, Netto, Steuer, Brutto.</li>
            <li>Externe Rechnungsnummer aus Kasse eindeutig speichern und danach sperren.</li>
            <li>Storno-/Korrektur-Logik statt fertige Rechnungen zu überschreiben.</li>
            <li>Später PDF und E-Rechnung/ZUGFeRD/XRechnung vorbereiten.</li>
          </ul>
        </div>
      </section>
    </AppLayout>
  );
}

const noticeStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 14,
  borderRadius: 14,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontWeight: 700,
};

const billingGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 18,
};

const billingBoxStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#ffffff",
};

const listStyle: React.CSSProperties = {
  margin: "14px 0 0",
  paddingLeft: 20,
  color: "#475569",
  fontWeight: 650,
  lineHeight: 1.8,
};
