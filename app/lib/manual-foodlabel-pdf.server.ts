import QRCode from "qrcode";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
} from "pdf-lib";

function mmToPt(mm: number) {
  return (mm * 72) / 25.4;
}

function clean(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLabelDate(value: string | null | undefined) {
  const raw = clean(value);

  if (!raw) return "";

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return raw;

  return `${match[3]}.${match[2]}.${match[1]}`;
}

function prettifyList(value: string | null | undefined) {
  return clean(value)
    .replace(/\s*,\s*/g, " · ")
    .replace(/\s*;\s*/g, " · ");
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = clean(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (
      !current ||
      font.widthOfTextAtSize(candidate, size) <= maxWidth
    ) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function fitSingleLine(
  text: string,
  font: PDFFont,
  startSize: number,
  minSize: number,
  maxWidth: number
) {
  let size = startSize;

  while (
    size > minSize &&
    font.widthOfTextAtSize(text, size) > maxWidth
  ) {
    size -= 0.3;
  }

  return size;
}

export async function renderManualFoodLabelPdf({
  name,
  customerName,
  brandName,
  brandSubline,
  qrText,
  assetMode,
  labelDate,
  ingredients,
  allergens,
  count,
  widthMm,
  heightMm,
}: {
  name: string;
  customerName?: string | null;
  brandName?: string | null;
  brandSubline?: string | null;
  qrText?: string | null;
  assetMode?: string | null;
  labelDate?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  count: number;
  widthMm: number;
  heightMm: number;
}) {
  const pdf = await PDFDocument.create();

  const regular =
    await pdf.embedFont(StandardFonts.Helvetica);

  const bold =
    await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = mmToPt(widthMm);
  const height = mmToPt(heightMm);

  const compact =
    widthMm <= 57 || heightMm <= 32;

  const safeCount =
    Math.max(1, Math.min(Number(count || 1), 200));

  const margin =
    compact ? mmToPt(2.3) : mmToPt(3);

  const contentWidth =
    width - margin * 2;

  const dishName =
    clean(name) || "Foodlabel";

  const customer =
    clean(customerName);

  const brandText =
    clean(brandName);

  const brandSublineText =
    clean(brandSubline);

  const qrValue =
    clean(qrText);

  const footerMode =
    clean(assetMode) || "brand-only";

  const dateText =
    formatLabelDate(labelDate);

  const ingredientText =
    prettifyList(ingredients) || "-";

  const allergenText =
    prettifyList(allergens) || "-";

  let qrImageBytes: Uint8Array | null = null;

  if (
    qrValue &&
    (footerMode === "brand-and-qr" ||
      footerMode === "qr-only")
  ) {
    const qrDataUrl =
      await QRCode.toDataURL(qrValue, {
        margin: 0,
        width: 256,
        color: {
          dark: "#111111",
          light: "#FFFFFF",
        },
      });

    const base64 =
      qrDataUrl.split(",")[1];

    qrImageBytes =
      Uint8Array.from(
        Buffer.from(base64, "base64")
      );
  }
  for (let index = 0; index < safeCount; index += 1) {
    const page = pdf.addPage([width, height]);

    // Weißer Hintergrund
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });

    // Feiner kompletter Labelrand
    page.drawRectangle({
      x: 0.8,
      y: 0.8,
      width: width - 1.6,
      height: height - 1.6,
      borderWidth: 0.35,
      borderColor: rgb(0.82, 0.82, 0.82),
    });

    let y = height - margin;

    // --------------------------------------------------
    // NAME + DATUM
    // --------------------------------------------------

    const dateSize = compact ? 4.5 : 5.2;

    const reservedDateWidth = dateText
      ? regular.widthOfTextAtSize(dateText, dateSize) + 8
      : 0;

    const customerMaxWidth =
      contentWidth - reservedDateWidth;

    if (customer) {
      const customerSize = fitSingleLine(
        customer,
        bold,
        compact ? 7.8 : 9.2,
        compact ? 5.8 : 6.8,
        customerMaxWidth
      );

      page.drawText(customer, {
        x: margin,
        y: y - customerSize,
        size: customerSize,
        font: bold,
        color: rgb(0.02, 0.02, 0.02),
      });
    }

    if (dateText) {
      const dateWidth =
        regular.widthOfTextAtSize(
          dateText,
          dateSize
        );

      page.drawText(dateText, {
        x: width - margin - dateWidth,
        y: y - dateSize,
        size: dateSize,
        font: regular,
        color: rgb(0.18, 0.18, 0.18),
      });
    }

    y -= compact ? 11 : 14;

    // Linie wie bei Heycater
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.55,
      color: rgb(0.80, 0.80, 0.80),
    });

    y -= compact ? 6 : 8;

    // --------------------------------------------------
    // GERICHT
    // --------------------------------------------------

    const dishSize = fitSingleLine(
      dishName,
      bold,
      compact ? 7.8 : 9.4,
      compact ? 5.8 : 7,
      contentWidth
    );

    const dishLines = wrapText(
      dishName,
      bold,
      dishSize,
      contentWidth
    ).slice(0, 2);

    for (const line of dishLines) {
      page.drawText(line, {
        x: margin,
        y: y - dishSize,
        size: dishSize,
        font: bold,
        color: rgb(0.02, 0.02, 0.02),
      });

      y -= dishSize + (compact ? 1 : 1.5);
    }

    y -= compact ? 4 : 5.5;

    // --------------------------------------------------
    // ZUTATEN
    // --------------------------------------------------

    const sectionSize = compact ? 4.6 : 5.3;
    const bodySize = compact ? 4.8 : 5.7;

    page.drawText("Zutaten", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    });

    y -= compact ? 5.8 : 7;

    const ingredientLines = wrapText(
      ingredientText,
      regular,
      bodySize,
      contentWidth
    ).slice(0, compact ? 3 : 4);

    for (const line of ingredientLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: bodySize,
        font: regular,
        color: rgb(0.04, 0.04, 0.04),
      });

      y -= compact ? 5.2 : 6.4;
    }

    y -= compact ? 3 : 4;

    // --------------------------------------------------
    // ALLERGENE
    // --------------------------------------------------

    page.drawText("Allergene", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    });

    y -= compact ? 5.8 : 7;

    const allergenSize = compact ? 4.8 : 5.7;

    const allergenLines = wrapText(
      allergenText,
      regular,
      allergenSize,
      contentWidth
    ).slice(0, 3);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: allergenSize,
        font: regular,
        color: rgb(0.02, 0.02, 0.02),
      });

      y -= compact ? 5.2 : 6.4;
    }

    // --------------------------------------------------
    // FOOTER
    // --------------------------------------------------
    const footerLineY =
      margin + (compact ? 8 : 11);

    page.drawLine({
      start: {
        x: margin,
        y: footerLineY + (compact ? 8 : 10),
      },
      end: {
        x: width - margin,
        y: footerLineY + (compact ? 8 : 10),
      },
      thickness: 0.5,
      color: rgb(0.82, 0.82, 0.82),
    });

    if (
      footerMode !== "qr-only" &&
      brandText
    ) {
      page.drawText(brandText, {
        x: margin,
        y: footerLineY,
        size: compact ? 4.8 : 5.8,
        font: bold,
        color: rgb(0.10, 0.10, 0.10),
      });
    }

    if (
      qrImageBytes &&
      (footerMode === "brand-and-qr" ||
        footerMode === "qr-only")
    ) {
      const qrImage =
        await pdf.embedPng(qrImageBytes);

      const qrSize =
        compact ? 18 : 24;

      page.drawImage(qrImage, {
        x: width - margin - qrSize + 1,
        y: margin - 1,
        width: qrSize,
        height: qrSize,
      });
    }
  }

  return pdf.save();
}











