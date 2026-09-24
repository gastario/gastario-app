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

  const heroFont =
    await pdf.embedFont(StandardFonts.HelveticaBoldOblique);

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
      compact ? 0.7 : 0.8;

    page.drawRectangle({
      x: borderInset,
      y: borderInset,
      width: width - borderInset * 2,
      height: height - borderInset * 2,
      borderWidth: 0.7,
      borderColor: rgb(0.72, 0.82, 0.77),
    });

    let y =
      height - margin;

    // --------------------------------------------------
    // NAME + DATUM
    // --------------------------------------------------

    const dateSize = compact ? 7.5 : 9.0;

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
          compact ? 7.0 : 8.2,
          compact ? 5.4 : 6.2,
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
        font: bold,
        color: rgb(0, 0, 0),
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

    y -= compact ? 7 : 9;

    // --------------------------------------------------
    // GERICHT / HERO
    // --------------------------------------------------

    const dishSize =
      fitSingleLine(
        dishName,
        heroFont,
        compact ? 9.0 : 11.0,
        compact ? 6.5 : 8.0,
        contentWidth
      );

    const dishLines =
      wrapText(
        dishName,
        heroFont,
        dishSize,
        contentWidth
      ).slice(0, 2);

    for (const line of dishLines) {
      page.drawText(line, {
        x: margin,
        y: y - dishSize,
        size: dishSize,
        font: heroFont,
        color: rgb(0.02, 0.02, 0.02),
      });

      y -=
        dishSize +
        (compact ? 1.2 : 1.8);
    }

    y -= compact ? 8.5 : 11.5;

    // --------------------------------------------------
    // ZUTATEN
    // --------------------------------------------------

    const metaSize = compact ? 6.8 : 8.2;

    const bodySize = compact ? 8.5 : 10.0;

    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: metaSize,
      font: bold,
      color: rgb(0, 0, 0),
    });

    y -= bodySize + (compact ? 1.2 : 1.8);

    const ingredientLines =
      wrapText(
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
        color: rgb(0, 0, 0),
      });

      y -= bodySize + (compact ? 1.2 : 1.8);
    }

    y -= compact ? 2.5 : 3.5;

    // --------------------------------------------------
    // ALLERGENE KOMPAKT
    // --------------------------------------------------

    const allergenPrefix =
      "ALLERGENE";

    page.drawText(allergenPrefix, {
      x: margin,
      y,
      size: metaSize,
      font: bold,
      color: rgb(0, 0, 0),
    });

    y -= bodySize + (compact ? 1.2 : 1.8);

    const allergenLines =
      wrapText(
        allergenText,
        regular,
        bodySize,
        contentWidth
      ).slice(0, compact ? 2 : 3);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: bodySize,
        font: regular,
        color: rgb(0, 0, 0),
      });

      y -= bodySize + (compact ? 1.2 : 1.8);
    }

    // --------------------------------------------------
    // FOOTER
    // --------------------------------------------------

    const qrSize =
      compact ? 12 : 16;

    const footerBottom =
      margin;

    const footerLineY =
      footerBottom +
      (compact ? 15 : 20);

    page.drawLine({
      start: {
        x: margin,
        y: footerLineY,
      },
      end: {
        x: width - margin,
        y: footerLineY,
      },
      thickness: 0.65,
      color: rgb(0.72, 0.80, 0.76),
    });

    if (
      footerMode !== "qr-only" &&
      brandText
    ) {
      page.drawText(brandText, {
        x: margin,
        y: footerBottom + (compact ? 11 : 14),
        size: compact ? 7.5 : 9.0,
        font: bold,
        color: rgb(0.08, 0.08, 0.08),
      });

      if (brandSublineText) {
        page.drawText(brandSublineText, {
          x: margin,
          y: footerBottom + (compact ? 4 : 5),
          size: compact ? 6.5 : 8.0,
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













































