import { Form, useActionData, useLoaderData } from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioPage, GastarioHeader, GastarioMetricGrid, GastarioMetric,
  GastarioSection, GastarioBadge, GastarioNotice, GastarioEmptyState,
  GastarioButton, GastarioDataList, GastarioDataRow, GastarioField,
  GastarioInput, GastarioToolbar, gastarioButtonClass,
} from "../components/ui";

export function meta() {
  return [{ title: "Belege · Gastario" }];
}

const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

async function accessFor(request: Request) {
  const { getTenantAccess } = await import("../lib/features.server");
  const access = await getTenantAccess(request);
  if (!access.tenantId) throw new Response("Kein Betrieb ausgewählt.", { status: 403 });
  return access.tenantId;
}

export async function loader({ request }: { request: Request }) {
  const tenantId = await accessFor(request);
  const { prisma } = await import("../lib/prisma.server");
  const [receipts, receivedCount, readyCount, exportedCount] = await Promise.all([
    prisma.receipt.findMany({
    where: { tenantId },
    select: { id: true, originalFileName: true, mimeType: true, status: true, receiptDate: true, supplierName: true, amountCents: true, fileSize: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
    }),
    prisma.receipt.count({ where: { tenantId, status: "RECEIVED" } }),
    prisma.receipt.count({ where: { tenantId, status: "READY" } }),
    prisma.receipt.count({ where: { tenantId, status: "EXPORTED" } }),
  ]);
  return {
    receipts,
    stats: {
      received: receivedCount,
      ready: readyCount,
      exported: exportedCount,
    },
  };
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") return { error: "Methode nicht erlaubt." };
  const tenantId = await accessFor(request);
  const { prisma } = await import("../lib/prisma.server");
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  if (intent === "upload") {
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Bitte eine Datei auswählen." };
    if (file.size > MAX_RECEIPT_BYTES) return { error: "Der Beleg darf höchstens 8 MB groß sein." };
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdf = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!pdf && !jpeg && !png) return { error: "Nur echte PDF-, JPG- oder PNG-Dateien sind erlaubt." };
    const originalFileName = file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 160) || "Beleg";
    const dateText = String(form.get("receiptDate") || "").trim();
    const receiptDate = /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? new Date(dateText + "T12:00:00Z") : null;
    if (receiptDate && Number.isNaN(receiptDate.getTime())) return { error: "Ungültiges Belegdatum." };
    const supplierName = String(form.get("supplierName") || "").trim().slice(0, 150) || null;
    const amountInput = String(form.get("amountEuro") || "").trim();
    const amount = Number(amountInput.replace(",", "."));
    if (amountInput && (!Number.isFinite(amount) || amount < 0 || amount > 100000000)) return { error: "Ungültiger Betrag." };
    await prisma.receipt.create({
      data: {
        tenantId, originalFileName, fileSize: buffer.length,
        mimeType: pdf ? "application/pdf" : jpeg ? "image/jpeg" : "image/png",
        fileData: buffer, status: "RECEIVED",
        receiptDate, supplierName,
        amountCents: amountInput ? Math.round(amount * 100) : null,
      },
    });
    return { success: "Beleg erfolgreich hochgeladen und sicher gespeichert." };
  }
  if (intent === "markReady" || intent === "markReceived") {
    const id = String(form.get("receiptId") || "");
    const updated = await prisma.receipt.updateMany({
      where: { id, tenantId },
      data: { status: intent === "markReady" ? "READY" : "RECEIVED" },
    });
    return updated.count ? { success: "Belegstatus gespeichert." } : { error: "Beleg nicht gefunden." };
  }
  return { error: "Unbekannte Aktion." };
}

export default function BelegePage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Finanzen" title="Belege"
          subtitle="Einkaufsbelege, Quittungen und Lieferantenrechnungen sicher für die Buchhaltung erfassen."
        />
        {actionData && "error" in actionData ? <GastarioNotice type="danger">{actionData.error}</GastarioNotice> : null}
        {actionData && "success" in actionData ? <GastarioNotice type="success">{actionData.success}</GastarioNotice> : null}
        <GastarioMetricGrid>
          <GastarioMetric label="Unbearbeitet" value={data.stats.received} description="Müssen geprüft werden" badge="Eingang" />
          <GastarioMetric label="Bereit" value={data.stats.ready} description="Für den Steuerberater freigegeben" badge="Geprüft" />
          <GastarioMetric label="Exportiert" value={data.stats.exported} description="Bereits übergeben" badge="Erledigt" />
        </GastarioMetricGrid>
        <GastarioSection eyebrow="Belegerfassung" title="Beleg hochladen"
          description="PDF, JPG oder PNG bis 8 MB. Dokumente werden betriebsbezogen gespeichert.">
          <Form method="post" encType="multipart/form-data">
            <input type="hidden" name="intent" value="upload" />
            <GastarioField label="Belegdatei" required>
              <GastarioInput type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required />
            </GastarioField>
            <GastarioField label="Belegdatum (optional)">
              <GastarioInput type="date" name="receiptDate" />
            </GastarioField>
            <GastarioField label="Lieferant (optional)">
              <GastarioInput name="supplierName" placeholder="z. B. METRO" maxLength={150} />
            </GastarioField>
            <GastarioField label="Bruttobetrag in EUR (optional)">
              <GastarioInput name="amountEuro" placeholder="z. B. 125,40" />
            </GastarioField>
            <GastarioToolbar>
              <GastarioButton type="submit" variant="primary">Beleg hochladen</GastarioButton>
            </GastarioToolbar>
          </Form>
          <GastarioNotice type="info">
            Die Belegdatei wird unverändert gespeichert. Automatisches Auslesen von Lieferant, Betrag und Steuer ist noch nicht aktiviert.
          </GastarioNotice>
        </GastarioSection>
        <GastarioSection eyebrow="Belegübersicht" title="Gespeicherte Belege"
          description="Dokumente öffnen und nach Sichtprüfung für den Export freigeben."
          action={<GastarioBadge variant="neutral">{data.receipts.length} Belege</GastarioBadge>}>
          {data.receipts.length === 0 ? (
            <GastarioEmptyState title="Noch keine Belege vorhanden">
              <p>Lade deinen ersten Beleg als PDF, JPG oder PNG hoch.</p>
            </GastarioEmptyState>
          ) : (
            <GastarioDataList>
              {data.receipts.map(receipt => (
                <GastarioDataRow key={receipt.id}>
                  <div className="g-ui-data-row-main">
                    <strong className="g-ui-data-row-title">{receipt.originalFileName}</strong>
                    <span className="g-ui-data-row-description">
                      {new Date(receipt.receiptDate || receipt.createdAt).toLocaleDateString("de-DE")}
                      {" · "}{receipt.supplierName || "Ohne Lieferant"}
                      {" · "}{receipt.amountCents !== null ? (receipt.amountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "Betrag offen"}
                      {" · "}{Math.ceil(receipt.fileSize / 1024)} KB
                    </span>
                  </div>
                  <div className="g-ui-data-row-meta">
                    <GastarioBadge variant={receipt.status === "READY" ? "success" : receipt.status === "EXPORTED" ? "info" : "warning"}>
                      {receipt.status === "READY" ? "Geprüft" : receipt.status === "EXPORTED" ? "Exportiert" : "Unbearbeitet"}
                    </GastarioBadge>
                  </div>
                  <div className="g-ui-data-row-actions">
                    <a href={`/belege/datei/${receipt.id}`} target="_blank" rel="noopener noreferrer" className={gastarioButtonClass("secondary")}>Öffnen</a>
                    <Form method="post">
                      <input type="hidden" name="receiptId" value={receipt.id} />
                      <button type="submit" name="intent" value={receipt.status === "READY" ? "markReceived" : "markReady"} className={gastarioButtonClass("secondary")}>
                        {receipt.status === "READY" ? "Prüfung zurücknehmen" : "Als geprüft markieren"}
                      </button>
                    </Form>
                  </div>
                </GastarioDataRow>
              ))}
            </GastarioDataList>
          )}
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}
