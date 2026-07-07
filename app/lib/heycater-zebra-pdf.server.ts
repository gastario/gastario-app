import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { HeycaterLabelData } from "./heycater-label-parser.server";

const QR_URL = "https://heycater.com/de/account/login";

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function safeText(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe")
    .replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/Œ/g, "OE")
    .replace(/œ/g, "oe")
    .replace(/Æ/g, "AE")
    .replace(/æ/g, "ae")
    .replace(/Ð/g, "D")
    .replace(/ð/g, "d")
    .replace(/Þ/g, "Th")
    .replace(/þ/g, "th")
    .replace(/Ø/g, "O")
    .replace(/ø/g, "o")
    .replace(/[’‘‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(value: string, maxChars: number) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? current + " " + word : word;

    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function formatDate(value: string) {
  const text = safeText(value);

  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  return text;
}

async function makeQrPngDataUrl() {
  const imported: any = await import("qrcode");
  const qrcode = imported.default || imported;

  if (!qrcode?.toDataURL) {
    throw new Error("QRCode Modul konnte nicht geladen werden.");
  }

  return await qrcode.toDataURL(QR_URL, {
    margin: 0,
    width: 120,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function drawDashedLine(page: any, x1: number, x2: number, y: number) {
  let x = x1;

  while (x < x2) {
    const end = Math.min(x + 9, x2);

    page.drawLine({
      start: { x, y },
      end: { x: end, y },
      thickness: 0.9,
      color: rgb(0, 0, 0),
    });

    x += 16;
  }
}

export async function renderHeycaterZebraPdf(labels: HeycaterLabelData[]) {
  const pdf = await PDFDocument.create();

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const qrDataUrl = await makeQrPngDataUrl();
  const qrImage = await pdf.embedPng(dataUrlToBytes(qrDataUrl));

  const width = mmToPt(76);
  const height = mmToPt(51);

  const black = rgb(0, 0, 0);
  const muted = rgb(0.12, 0.12, 0.12);

  for (const label of labels) {
    const page = pdf.addPage([width, height]);

    const left = 9;
    const right = width - 9;

    page.drawRectangle({
      x: 5,
      y: 5,
      width: width - 10,
      height: height - 10,
      borderColor: rgb(0.82, 0.88, 0.86),
      borderWidth: 0.7,
      color: rgb(1, 1, 1),
    });

    page.drawText(safeText(label.name || "-").slice(0, 36), {
      x: left,
      y: height - 20,
      size: 11.4,
      font: bold,
      color: black,
    });

    const date = formatDate(label.date);

    if (date) {
      page.drawText(safeText(date), {
        x: width - 55,
        y: height - 18,
        size: 7.2,
        font: regular,
        color: black,
      });
    }

    page.drawLine({
      start: { x: left, y: height - 27 },
      end: { x: right, y: height - 27 },
      thickness: 0.6,
      color: rgb(0.82, 0.88, 0.86),
    });

    let y = height - 42;

    for (const line of wrapText(label.meal, 36).slice(0, 2)) {
      page.drawText(line, {
        x: left,
        y,
        size: 10.7,
        font: bold,
        color: black,
      });
      y -= 12.2;
    }

    y -= 2;

    const detailLines = wrapText(label.details, 48).slice(0, 3);

    if (detailLines.length > 0) {
      page.drawText("Allergene / Hinweis", {
        x: left,
        y,
        size: 6.2,
        font: bold,
        color: rgb(0.25, 0.32, 0.36),
      });

      y -= 7.4;

      for (const line of detailLines) {
        page.drawText(line, {
          x: left,
          y,
          size: 7.1,
          font: regular,
          color: black,
        });
        y -= 8.1;
      }
    }

    const qrSize = 16;

    page.drawImage(qrImage, {
      x: width - qrSize - 9,
      y: 12,
      width: qrSize,
      height: qrSize,
    });

    page.drawLine({
      start: { x: left, y: 32 },
      end: { x: width - qrSize - 14, y: 32 },
      thickness: 0.5,
      color: rgb(0.82, 0.88, 0.86),
    });

    page.drawText(safeText(label.caterer || "Let Me Bowl heykantine").replace(/^Caterer:\s*/i, "").slice(0, 42), {
      x: left,
      y: 24,
      size: 6.7,
      font: bold,
      color: black,
    });

    page.drawText(safeText(label.customer || "Delivery Overview").replace(/^Customer:\s*/i, "").slice(0, 42), {
      x: left,
      y: 16,
      size: 6.7,
      font: regular,
      color: black,
    });

    page.drawText(safeText(label.address || "Alexanderstrasse 5, Berlin, 10178").slice(0, 44), {
      x: left,
      y: 8,
      size: 6.4,
      font: regular,
      color: rgb(0.25, 0.32, 0.36),
    });
  }

  return await pdf.save();
}




