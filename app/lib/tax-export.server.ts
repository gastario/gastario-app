import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ExportFile = { name: string; bytes: Buffer };

export function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+@\-]/.test(raw.trimStart()) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function csvBytes(rows: unknown[][]) {
  return Buffer.from("\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n") + "\r\n", "utf8");
}
function crc32(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
// Simple ZIP with stored entries, generated in memory (no shell tools/dependencies).
export function createTaxZip(files: ExportFile[]) {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name.replace(/[\\]/g, "/").replace(/\.\./g, "_"), "utf8");
    const bytes = file.bytes;
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, bytes);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + bytes.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export async function createInvoiceExportPdf(invoice: any, tenantName: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 792;
  const clean = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\xFF]/g, "?");
  const line = (value: unknown, size = 10, emphasis = false) => {
    if (y < 60) return;
    const text = clean(value).slice(0, 98);
    page.drawText(text, { x: 45, y, size, font: emphasis ? bold : regular, color: rgb(.1, .23, .2) });
    y -= size + 11;
  };
  const money = (c: number) => (Number(c || 0) / 100).toFixed(2) + " EUR";
  line(invoice.sellerName || tenantName, 13, true);
  line("RECHNUNG", 22, true);
  line("Rechnungsnummer: " + (invoice.externalInvoiceNumber || invoice.internalNumber || invoice.id), 10);
  line("Datum: " + (invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString("de-DE") : "-"));
  line("Status: " + invoice.status);
  y -= 12;
  line("Rechnungsempfaenger", 12, true);
  line(invoice.customerName, 11, true);
  for (const addressLine of String(invoice.customerAddress || "").split("\n").slice(0, 5)) line(addressLine);
  y -= 12;
  line("Positionen", 12, true);
  for (const item of invoice.items || []) {
    line(item.position + ". " + item.name + " | " + item.quantity + " " + item.unit + " | " + money(item.grossTotalCents));
    if (y < 120) { line("(Weitere Positionen siehe CSV)", 9); break; }
  }
  y -= 10;
  line("Netto: " + money(invoice.netTotalCents), 11);
  line("Umsatzsteuer: " + money(invoice.taxTotalCents), 11);
  line("Gesamt: " + money(invoice.grossTotalCents), 14, true);
  line("Dies ist ein vereinfachter Exportbeleg; massgeblich sind die Original-Rechnungsdaten.", 8);
  return Buffer.from(await doc.save());
}
