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
  labelDate,
  ingredients,
  allergens,
  count,
  widthMm,
  heightMm,
}: {
  name: string;
  customerName?: string | null;
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

  const dateText =
    formatLabelDate(labelDate);

  const ingredientText =
    prettifyList(ingredients) || "-";

  const allergenText =
    prettifyList(allergens) || "-";

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
      x: 1.4,
      y: 1.4,
      width: width - 2.8,
      height: height - 2.8,
      borderWidth: 0.55,
      borderColor: rgb(0.72, 0.72, 0.72),
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
        y: footerLineY,
      },
      end: {
        x: width - margin,
        y: footerLineY,
      },
      thickness: 0.5,
      color: rgb(0.82, 0.82, 0.82),
    });

    page.drawText("Gastario Foodlabel", {
      x: margin,
      y: margin + (compact ? 2 : 3),
      size: compact ? 4.2 : 4.8,
      font: bold,
      color: rgb(0.16, 0.16, 0.16),
    });
  }

  return pdf.save();
}



