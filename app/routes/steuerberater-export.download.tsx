import { redirect } from "react-router";
import { createTaxZip, createInvoiceExportPdf, csvBytes } from "../lib/tax-export.server";

export async function loader({ request }: { request: Request }) {
  const { getTenantAccess } = await import("../lib/features.server");
  const { prisma } = await import("../lib/prisma.server");
  const access = await getTenantAccess(request);
  if (!access.tenantId) throw redirect("/login");
  const month = new URL(request.url).searchParams.get("month") || "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Response("Ungültiger Monat.", { status: 400 });
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end = new Date(Date.UTC(year, monthNum, 1));

  const [invoices, receipts] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId: access.tenantId, invoiceDate: { gte: start, lt: end }, status: { not: "DRAFT" } },
      include: { items: { orderBy: { position: "asc" } } },
      orderBy: { invoiceDate: "asc" },
      take: 401,
    }),
    prisma.receipt.findMany({
      where: { tenantId: access.tenantId, status: { in: ["READY", "EXPORTED"] }, OR: [{ receiptDate: { gte: start, lt: end } }, { receiptDate: null, createdAt: { gte: start, lt: end } }] },
      orderBy: { createdAt: "asc" },
      take: 201,
    }),
  ]);
  if (invoices.length > 400 || receipts.length > 200) {
    throw new Response("Zu viele Dokumente im Monat. Bitte den Support für einen größeren Export kontaktieren.", { status: 413 });
  }
  const totalReceiptSize = receipts.reduce((sum, r) => sum + r.fileSize, 0);
  if (totalReceiptSize > 90 * 1024 * 1024) {
    throw new Response("Der Export enthält mehr als 90 MB Belege. Bitte den Support kontaktieren.", { status: 413 });
  }
  const rows: unknown[][] = [[
    "ID", "Rechnungsnummer", "Rechnungsdatum", "Kunde", "Status", "Waehrung", "Netto EUR", "USt EUR", "Brutto EUR",
  ]];
  const itemRows: unknown[][] = [[
    "Rechnungsnummer", "Pos", "Artikel", "Menge", "Einheit", "Netto EUR", "USt %", "USt EUR", "Brutto EUR",
  ]];
  const files = [];
  for (const inv of invoices) {
    const id = inv.externalInvoiceNumber || inv.internalNumber || inv.id;
    rows.push([inv.id, id, inv.invoiceDate?.toISOString().slice(0, 10) || "", inv.customerName, inv.status, inv.currency,
      (inv.netTotalCents / 100).toFixed(2), (inv.taxTotalCents / 100).toFixed(2), (inv.grossTotalCents / 100).toFixed(2)]);
    for (const item of inv.items) {
      itemRows.push([id, item.position, item.name, item.quantity, item.unit,
        (item.netTotalCents / 100).toFixed(2), item.taxRate,
        (item.taxTotalCents / 100).toFixed(2), (item.grossTotalCents / 100).toFixed(2)]);
    }
  }
  files.push({ name: "Rechnungen.csv", bytes: csvBytes(rows) });
  files.push({ name: "Rechnungspositionen.csv", bytes: csvBytes(itemRows) });

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const name = (inv.externalInvoiceNumber || inv.internalNumber || inv.id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const bytes = await createInvoiceExportPdf(inv, access.tenant?.name || "Gastario");
    files.push({ name: "Rechnungsauszuge/" + String(i + 1).padStart(3, "0") + "_" + name + ".pdf", bytes });
  }
  const receiptRows: unknown[][] = [["ID", "Dateiname", "Belegdatum", "Hochgeladen", "Lieferant", "Betrag EUR", "Status", "Dateigroesse"]];
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    const safe = r.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 110);
    files.push({ name: "Einkaufsbelege/" + String(i + 1).padStart(3, "0") + "_" + safe, bytes: Buffer.from(r.fileData) });
    receiptRows.push([r.id, r.originalFileName, r.receiptDate?.toISOString().slice(0, 10) || "", r.createdAt.toISOString(), r.supplierName || "", r.amountCents !== null ? (r.amountCents / 100).toFixed(2) : "", r.status, r.fileSize]);
  }
  files.push({ name: "Einkaufsbelege.csv", bytes: csvBytes(receiptRows) });
  files.push({ name: "HINWEISE.txt", bytes: Buffer.from(
    "Gastario Steuerberater-Export " + month + "\r\n" +
    "Enthalten: erfasste finalisierte Rechnungsdaten, Rechnungspositionen, vereinfachte PDF-Rechnungsauszüge sowie geprüfte Original-Einkaufsbelege.\r\n" +
    "PDF-Auszüge sind keine vollständigen Originalrechnungen und ersetzen diese nicht.\r\n" +
    "Automatischer DATEV/LEXWARE-Import wird nicht gewährleistet. Bitte auf Vollständigkeit prüfen.\r\n", "utf8"),
  });
  const archive = createTaxZip(files);
  return new Response(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="Gastario-Steuerberater-' + month + '.zip"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
