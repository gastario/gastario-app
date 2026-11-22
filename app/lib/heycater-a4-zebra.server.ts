/**
 * Heycater A4 -> individual 76x51 mm Zebra labels.
 * The source PDF is the source of truth: 3 columns x 8 labels per A4 page.
 * Every populated cell produces exactly one output page; the source QR is
 * embedded directly from the PDF rather than replaced with a generic login QR.
 *
 * Tested layout: Heycater PDF dated 18-11-2026, 144 labels, 6 occupied pages
 * plus an empty 7th page. Reject unknown layouts instead of printing partials.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const WIDTH_MM = 76;
const HEIGHT_MM = 51;
const mm = (n: number) => (n * 72) / 25.4;
const ROWS = 8;
const COLS = 3;
const SOURCE_ROW_HEIGHT = 102.04724; // Source grid geometry in PDF points
const SOURCE_TOP = 12.75592;
const QR_LEFT = 155.60;
const QR_TOP = 78.50;
const QR_RIGHT = 178.01;
const QR_BOTTOM = 100.87;
const MAX_LABELS = 2000;

export interface A4Label {
  name: string;
  meal: string;
  date: string;
  details: string;
  caterer: string;
  customer: string;
  address: string;
  pageIndex: number;
  row: number;
  column: number;
}

type Word = { x: number; y: number; value: string };

function norm(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** PDF Standard fonts cannot encode every unicode codepoint. */
function latinText(value: string): string {
  return norm(value)
    .replace(/ß/g, "ss").replace(/ẞ/g, "SS")
    .replace(/ø/g, "o").replace(/Ø/g, "O")
    .replace(/ł/g, "l").replace(/Ł/g, "L")
    .replace(/æ/g, "ae").replace(/Æ/g, "AE")
    .replace(/œ/g, "oe").replace(/Œ/g, "OE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018-\u201b]/g, "'")
    .replace(/[\u201c-\u201f]/g, '"')
    .replace(/[^\x20-\x7e]/g, "");
}

function joinWords(words: Word[]): string {
  if (!words.length) return "";
  const sorted = words.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const lines: Word[][] = [];
  for (const word of sorted) {
    const current = lines[lines.length - 1];
    if (!current || Math.abs(current[0].y - word.y) > 3.1) lines.push([word]);
    else current.push(word);
  }
  return norm(lines.map((line) => line.sort((a, b) => a.x - b.x)
    .map((item) => item.value).join(" ")).join(" "));
}

function extractOneCell(words: Word[], pageIndex: number, row: number, column: number): A4Label | null {
  if (!words.length) return null;
  const data = {
    name: [] as Word[], meal: [] as Word[], details: [] as Word[],
    date: [] as Word[], caterer: [] as Word[], customer: [] as Word[], address: [] as Word[],
  };
  // Classify by each item's actual position in the source label, not by
  // keywords such as "Sesame", "Fish" or "Vegan". These words can legitimately
  // appear in dish names and caused the previous dish/allergen swap.
  // Coordinates below are relative to the start of each 102.047 pt A4 cell.
  for (const word of words) {
    const value = norm(word.value);
    if (!value) continue;
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) data.date.push(word);
    else if (word.y < 25) data.name.push(word);
    else if (word.y < 40) data.meal.push(word);
    else if (word.y < 58) data.details.push(word);
    else if (word.y < 66) data.caterer.push(word);
    else if (word.y < 77) data.customer.push(word);
    else if (word.y < 96) data.address.push(word);
    else throw new Error(`Etikett S.${pageIndex + 1}, Reihe ${row + 1}, Spalte ${column + 1}: Text außerhalb des bekannten Inhaltsbereichs: ${value}`);
  }
  const record: A4Label = {
    name: joinWords(data.name),
    meal: joinWords(data.meal),
    details: joinWords(data.details),
    date: joinWords(data.date),
    caterer: joinWords(data.caterer).replace(/^Caterer:\s*/i, ""),
    customer: joinWords(data.customer).replace(/^Customer:\s*/i, ""),
    address: joinWords(data.address),
    pageIndex, row, column,
  };
  if (!/^Caterer\s*:/i.test(joinWords(data.caterer)) || !/^Customer\s*:/i.test(joinWords(data.customer))) {
    throw new Error(`SICHERHEITSSTOPP: Unerwartete Feldpositionen in Etikett ${pageIndex + 1}/${row + 1}/${column + 1}.`);
  }
  if (/(?:\bgluten free\b|\bpescatarian\b)/i.test(record.meal) && !/(bowl|wrap|salad|rice|chicken|salmon|curry|pasta|noodle)/i.test(record.meal)) {
    throw new Error(`SICHERHEITSSTOPP: Gerichts-/Allergenfelder nicht plausibel auf Etikett ${pageIndex + 1}/${row + 1}/${column + 1}.`);
  }
  for (const key of ["name", "meal", "date", "details", "caterer", "customer", "address"] as const) {
    if (!record[key]) throw new Error(`SICHERHEITSSTOPP: Etikett ${pageIndex + 1}/${row + 1}/${column + 1} ohne ${key}. Kein PDF erstellt.`);
  }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(record.date)) {
    throw new Error(`SICHERHEITSSTOPP: Ungültiges Datum auf Etikett ${pageIndex + 1}/${row + 1}/${column + 1}.`);
  }
  return record;
}

export async function readHeycaterA4Labels(input: Uint8Array): Promise<A4Label[]> {
  // PDF.js gives positioned text items; unlike plain text extraction this can
  // never accidentally mix names from neighboring A4 label columns.
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(input), useSystemFonts: true, disableFontFace: true });
  const source = await task.promise;
  const all: A4Label[] = [];
  try {
    for (let pageIndex = 0; pageIndex < source.numPages; pageIndex++) {
      const page = await source.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 1 });
      if (Math.abs(viewport.width - mm(210)) > 6 || Math.abs(viewport.height - mm(297)) > 6) {
        throw new Error(`Unbekanntes A4-Format auf Seite ${pageIndex + 1}. Druck gesperrt.`);
      }
      const colWidth = viewport.width / COLS;
      const cells: Word[][] = Array.from({ length: ROWS * COLS }, () => []);
      const content = await page.getTextContent();
      for (const item of content.items as any[]) {
        if (typeof item.str !== "string" || !item.str.trim() || !item.transform) continue;
        const x = Number(item.transform[4]);
        const yTop = viewport.height - Number(item.transform[5]);
        const col = Math.floor(x / colWidth);
        const row = Math.floor((yTop - SOURCE_TOP) / SOURCE_ROW_HEIGHT);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
          throw new Error(`Text außerhalb des bekannten A4-Etikettenrasters auf Seite ${pageIndex + 1}.`);
        }
        cells[row * COLS + col].push({ x: x - col * colWidth, y: yTop - SOURCE_TOP - row * SOURCE_ROW_HEIGHT, value: item.str });
      }
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const parsed = extractOneCell(cells[row * COLS + col], pageIndex, row, col);
          if (parsed) all.push(parsed);
        }
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  if (!all.length || all.length > MAX_LABELS) throw new Error("Keine gültigen A4-Etiketten erkannt.");
  return all;
}

function fit(text: string, font: any, maxWidth: number, maxLines: number, preferred: number, minSize: number) {
  const raw = latinText(text);
  if (!raw) throw new Error("Leeres Pflichtfeld auf einem Etikett.");
  for (let size = preferred; size >= minSize - 0.001; size -= 0.2) {
    const lines: string[] = [];
    let line = "";
    const chunks = raw.split(/\s+/);
    for (const word of chunks) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else if (!line) {
        // A word too long for one line must not be cut or silently omitted.
        line = "";
        for (const char of word) {
          const trial = line + char;
          if (font.widthOfTextAtSize(trial, size) > maxWidth) {
            if (line) lines.push(line);
            line = char;
          } else line = trial;
        }
      } else {
        lines.push(line);
        line = "";
        for (const char of word) {
          const trial = line + char;
          if (font.widthOfTextAtSize(trial, size) > maxWidth) {
            if (line) lines.push(line);
            line = char;
          } else line = trial;
        }
      }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => font.widthOfTextAtSize(l, size) <= maxWidth)) {
      return { lines, size };
    }
  }
  throw new Error(`Text passt nicht vollständig auf Zebra-Etikett: ${raw}`);
}

export async function convertHeycaterA4ToZebra(sourceBytes: Uint8Array, expectedCount?: number | null) {
  const records = await readHeycaterA4Labels(sourceBytes);
  if (expectedCount !== null && expectedCount !== undefined && records.length !== expectedCount) {
    throw new Error(`SICHERHEITSSTOPP: erwartet ${expectedCount} Etiketten, aber ${records.length} erkannt. Kein PDF erstellt.`);
  }
  const sourceDoc = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = mm(WIDTH_MM);
  const H = mm(HEIGHT_MM);
  const margin = mm(4.2);
  const x = margin;
  const textArea = W - 2 * margin;
  const black = rgb(0, 0, 0);
  const grey = rgb(0.72, 0.72, 0.72);

  for (const label of records) {
    const page = pdf.addPage([W, H]);
    const name = fit(label.name, bold, textArea - 50, 2, 11, 7.6);
    const meal = fit(label.meal, bold, textArea, 2, 10.2, 7.8);
    const details = fit(label.details, regular, textArea - 35, 3, 7.0, 5.9);
    page.drawText(latinText(label.date), { x: W - margin - regular.widthOfTextAtSize(label.date, 7), y: H - 12.4, font: regular, size: 7, color: black });
    name.lines.forEach((line, i) => page.drawText(line, { x, y: H - 16.2 - i * 10.7, font: bold, size: name.size, color: black }));
    page.drawLine({ start: { x, y: H - 40 }, end: { x: W - margin, y: H - 40 }, thickness: 0.36, color: grey });
    meal.lines.forEach((line, i) => page.drawText(line, { x, y: H - 55 - i * 11.5, font: bold, size: meal.size, color: black }));
    page.drawText("Allergens / Notes", { x, y: H - 78, font: bold, size: 7.1, color: black });
    details.lines.forEach((line, i) => page.drawText(line, { x, y: H - 89 - i * 8.5, font: regular, size: details.size, color: black }));
    page.drawLine({ start: { x, y: 34 }, end: { x: W - 50, y: 34 }, thickness: 0.35, color: grey });
    const footer = [
      [label.caterer, 24, 7.6, bold],
      [label.customer, 16, 7.1, regular],
      [label.address, 8, 6.3, regular],
    ] as const;
    for (const [value, y, size, font] of footer) {
      const line = fit(value, font, W - 60, 1, size, 5.2);
      page.drawText(line.lines[0], { x, y, font, size: line.size, color: black });
    }
    // Directly preserve each *original* source QR's vector content.
    // Do not invent replacement URL or use the same QR for every customer.
    const sourcePage = sourceDoc.getPage(label.pageIndex);
    const sourceHeight = sourcePage.getHeight();
    const colWidth = sourcePage.getWidth() / COLS;
    const sourceX = label.column * colWidth;
    const sourceY = SOURCE_TOP + label.row * SOURCE_ROW_HEIGHT;
    const qrBox = {
      left: sourceX + QR_LEFT,
      right: sourceX + QR_RIGHT,
      bottom: sourceHeight - (sourceY + QR_BOTTOM),
      top: sourceHeight - (sourceY + QR_TOP),
    };
    const qr = await pdf.embedPage(sourcePage, qrBox);
    page.drawPage(qr, { x: W - 46, y: 7, width: 38, height: 38 });
  }
  if (pdf.getPageCount() !== records.length) throw new Error("SICHERHEITSSTOPP: Etikettenzählung vor Export fehlgeschlagen.");
  return { count: records.length, bytes: await pdf.save() };
}
