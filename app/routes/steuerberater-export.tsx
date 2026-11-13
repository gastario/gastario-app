import { Form, Link, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioPage, GastarioHeader, GastarioMetricGrid, GastarioMetric,
  GastarioSection, GastarioNotice, GastarioField, GastarioInput,
  GastarioButton, GastarioToolbar, gastarioButtonClass,
} from "../components/ui";

export function meta() {
  return [{ title: "Steuerberater-Export · Gastario" }];
}

function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Response("Ungültiger Monat.", { status: 400 });
  const [year, number] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, number - 1, 1)),
    end: new Date(Date.UTC(year, number, 1)),
  };
}

export async function loader({ request }: { request: Request }) {
  const { getTenantAccess } = await import("../lib/features.server");
  const { prisma } = await import("../lib/prisma.server");
  const access = await getTenantAccess(request);
  if (!access.tenantId) throw new Response("Kein Betrieb ausgewählt.", { status: 403 });
  const month = new URL(request.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const range = monthRange(month);
  const [invoiceCount, receipts, pending] = await Promise.all([
    prisma.invoice.count({
      where: { tenantId: access.tenantId, invoiceDate: { gte: range.start, lt: range.end }, status: { not: "DRAFT" } },
    }),
    prisma.receipt.count({
      where: { tenantId: access.tenantId, status: { in: ["READY", "EXPORTED"] }, createdAt: { gte: range.start, lt: range.end } },
    }),
    prisma.receipt.count({
      where: { tenantId: access.tenantId, status: "RECEIVED", createdAt: { gte: range.start, lt: range.end } },
    }),
  ]);
  return { month, invoiceCount, receipts, pending };
}

export default function SteuerberaterExport() {
  const data = useLoaderData<typeof loader>();
  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Finanzen" title="Steuerberater-Export"
          subtitle="Rechnungen und geprüfte Einkaufsbelege für den Monatsabschluss zusammenstellen."
        />
        <GastarioMetricGrid>
          <GastarioMetric label="Rechnungen" value={data.invoiceCount} description="Ohne Entwürfe im gewählten Monat" badge="Rechnungen" />
          <GastarioMetric label="Einkaufsbelege" value={data.receipts} description="Für den Export freigegeben" badge="Geprüft" />
          <GastarioMetric label="Offene Punkte" value={data.pending} description="Noch ungeprüfte Belege" badge="Prüfen" />
        </GastarioMetricGrid>
        <GastarioSection eyebrow="Monatsabschluss" title="Export vorbereiten"
          description="Monat auswählen und die vorhandenen Unterlagen als ZIP-Datei herunterladen.">
          <Form method="get">
            <GastarioField label="Abrechnungsmonat">
              <GastarioInput type="month" name="month" defaultValue={data.month} required />
            </GastarioField>
            <GastarioToolbar>
              <GastarioButton type="submit" variant="secondary">Zeitraum anzeigen</GastarioButton>
              <a className={gastarioButtonClass("primary")} href={`/steuerberater-export/download?month=${encodeURIComponent(data.month)}`}>
                ZIP für Steuerberater herunterladen
              </a>
            </GastarioToolbar>
          </Form>
          {data.pending > 0 ? (
            <GastarioNotice type="warning">
              {data.pending} ungeprüfte Belege sind noch nicht im ZIP enthalten. Bitte erst unter Belege prüfen und freigeben.
            </GastarioNotice>
          ) : null}
          <GastarioNotice type="info">
            Enthalten sind eine Rechnungsübersicht als CSV, Positionsdaten, vereinfachte PDF-Rechnungsauszüge und geprüfte Originalbelege.
            Die Auszüge ersetzen nicht die gesetzlich maßgebliche Originalrechnung.
            Ein direkter DATEV- oder Lexware-Import wird damit noch nicht zugesichert.
          </GastarioNotice>
        </GastarioSection>
        <GastarioSection eyebrow="Prüfung" title="Belege vervollständigen"
          description="Ungeprüfte Einkaufsbelege vor der Übergabe kontrollieren.">
          <Link to="/belege" className={gastarioButtonClass("secondary")}>Belege prüfen</Link>
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}
