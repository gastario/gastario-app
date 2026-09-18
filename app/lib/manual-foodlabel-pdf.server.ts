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
    compact ? mmToPt(2.0) : mmToPt(2.5);

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

    // --------------------------------------------------
    // HINTERGRUND + FEINER AUSSENRAND
    // --------------------------------------------------

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });

    const borderInset =
      compact ? 0.8 : 1;

    page.drawRectangle({
      x: borderInset,
      y: borderInset,
      width: width - borderInset * 2,
      height: height - borderInset * 2,
      borderWidth: 0.45,
      borderColor: rgb(0.80, 0.86, 0.83),
    });

    let y =
      height - margin;

    // --------------------------------------------------
    // NAME + DATUM
    // --------------------------------------------------

    const dateSize =
      compact ? 4.3 : 5.0;

    const reservedDateWidth =
      dateText
        ? regular.widthOfTextAtSize(
            dateText,
            dateSize
          ) + 8
        : 0;

    const customerMaxWidth =
      contentWidth - reservedDateWidth;

    if (customer) {
      const customerSize =
        fitSingleLine(
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
        color: rgb(0.03, 0.03, 0.03),
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

    page.drawLine({
      start: {
        x: margin,
        y,
      },
      end: {
        x: width - margin,
        y,
      },
      thickness: 0.4,
      color: rgb(0.80, 0.86, 0.83),
    });

    y -= compact ? 6 : 8;

    // --------------------------------------------------
    // GERICHT
    // --------------------------------------------------

    const dishSize =
      fitSingleLine(
        dishName,
        bold,
        compact ? 8.0 : 9.6,
        compact ? 6.0 : 7.2,
        contentWidth
      );

    const dishLines =
      wrapText(
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
        color: rgb(0.03, 0.03, 0.03),
      });

      y -=
        dishSize +
        (compact ? 1 : 1.4);
    }

    y -= compact ? 5 : 6;

    // --------------------------------------------------
    // ZUTATEN
    // --------------------------------------------------

    const infoHeadingSize =
      compact ? 4.1 : 4.7;

    const infoBodySize =
      compact ? 4.4 : 5.0;

    page.drawText("Zutaten", {
      x: margin,
      y,
      size: infoHeadingSize,
      font: bold,
      color: rgb(0.12, 0.12, 0.12),
    });

    y -= compact ? 5.5 : 6.5;

    const ingredientLines =
      wrapText(
        ingredientText,
        regular,
        infoBodySize,
        contentWidth
      ).slice(0, compact ? 3 : 4);

    for (const line of ingredientLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: infoBodySize,
        font: regular,
        color: rgb(0.05, 0.05, 0.05),
      });

      y -= compact ? 5.0 : 5.9;
    }

    y -= compact ? 3.5 : 4.5;

    // --------------------------------------------------
    // ALLERGENE
    // --------------------------------------------------

    page.drawText("Allergene", {
      x: margin,
      y,
      size: infoHeadingSize,
      font: bold,
      color: rgb(0.12, 0.12, 0.12),
    });

    y -= compact ? 5.5 : 6.5;

    const allergenLines =
      wrapText(
        allergenText,
        regular,
        infoBodySize,
        contentWidth
      ).slice(0, compact ? 2 : 3);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: infoBodySize,
        font: regular,
        color: rgb(0.05, 0.05, 0.05),
      });

      y -= compact ? 5.0 : 5.9;
    }

    // --------------------------------------------------
    // FOOTER
    // --------------------------------------------------

    const qrSize =
      compact ? 17 : 22;

    const footerBottom =
      margin;

    const footerLineY =
      footerBottom +
      (compact ? 22 : 28);

    page.drawLine({
      start: {
        x: margin,
        y: footerLineY,
      },
      end: {
        x: width - margin,
        y: footerLineY,
      },
      thickness: 0.4,
      color: rgb(0.80, 0.86, 0.83),
    });

    if (
      footerMode !== "qr-only" &&
      brandText
    ) {
      page.drawText(brandText, {
        x: margin,
        y: footerBottom + (compact ? 8 : 10),
        size: compact ? 4.8 : 5.6,
        font: bold,
        color: rgb(0.08, 0.08, 0.08),
      });

      if (brandSublineText) {
        page.drawText(brandSublineText, {
          x: margin,
          y: footerBottom + (compact ? 2 : 3),
          size: compact ? 3.5 : 4.1,
          font: regular,
          color: rgb(0.28, 0.28, 0.28),
        });
      }
    }

    if (
      qrImageBytes &&
      (
        footerMode === "brand-and-qr" ||
        footerMode === "qr-only"
      )
    ) {
      const qrImage =
        await pdf.embedPng(qrImageBytes);

      page.drawImage(qrImage, {
        x: width - margin - qrSize,
        y: footerBottom,
        width: qrSize,
        height: qrSize,
      });
    }
  }
  return pdf.save();
}























