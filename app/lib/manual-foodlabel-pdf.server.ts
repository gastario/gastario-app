import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
} from "pdf-lib";

function mmToPt(mm: number) {
  return (mm * 72) / 25.4;
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapTextByWidth({
  text,
  font,
  fontSize,
  maxWidth,
}: {
  text: string;
  font: PDFFont;
  fontSize: number;
  maxWidth: number;
}) {
  const words = normalizeText(text).split(" ").filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word;

    const candidateWidth =
      font.widthOfTextAtSize(candidate, fontSize);

    if (candidateWidth <= maxWidth || !current) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export async function renderManualFoodLabelPdf({
  name,
  customerName,
  ingredients,
  allergens,
  count,
  widthMm,
  heightMm,
}: {
  name: string;
  customerName?: string | null;
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

  const safeCount =
    Math.max(1, Math.min(Number(count || 1), 200));

  const compact = widthMm <= 57 || heightMm <= 32;

  const outerMargin = compact
    ? mmToPt(2.2)
    : mmToPt(3);

  const contentWidth =
    width - outerMargin * 2;

  const titleSize = compact ? 9.5 : 13.5;
  const customerSize = compact ? 6.2 : 7.6;
  const sectionLabelSize = compact ? 5.3 : 6;
  const bodySize = compact ? 5.5 : 6.6;

  const titleLeading = titleSize + (compact ? 1.3 : 2);
  const bodyLeading = bodySize + (compact ? 1.4 : 2);

  const customer = normalizeText(customerName);
  const ingredientText =
    normalizeText(ingredients) || "-";
  const allergenText =
    normalizeText(allergens) || "-";

  for (let index = 0; index < safeCount; index += 1) {
    const page = pdf.addPage([width, height]);

    /*
     * Äußerer Rahmen.
     * Auf Thermodruckern bewusst dünn und sauber.
     */
    page.drawRectangle({
      x: 1.5,
      y: 1.5,
      width: width - 3,
      height: height - 3,
      borderColor: rgb(0.12, 0.12, 0.12),
      borderWidth: 0.8,
    });

    let y = height - outerMargin - titleSize;

    /*
     * Gericht
     */
    const titleLines = wrapTextByWidth({
      text: name,
      font: bold,
      fontSize: titleSize,
      maxWidth: contentWidth,
    }).slice(0, compact ? 2 : 2);

    for (const line of titleLines) {
      page.drawText(line, {
        x: outerMargin,
        y,
        size: titleSize,
        font: bold,
        color: rgb(0.05, 0.05, 0.05),
      });

      y -= titleLeading;
    }

    /*
     * Optionaler Bestellername
     */
    if (customer) {
      y -= compact ? 1 : 2;

      page.drawText("FÜR", {
        x: outerMargin,
        y,
        size: customerSize - 0.8,
        font: bold,
        color: rgb(0.35, 0.35, 0.35),
      });

      const prefixWidth =
        bold.widthOfTextAtSize(
          "FÜR  ",
          customerSize - 0.8
        );

      const customerLines = wrapTextByWidth({
        text: customer,
        font: bold,
        fontSize: customerSize,
        maxWidth: contentWidth - prefixWidth,
      });

      page.drawText(customerLines[0] || customer, {
        x: outerMargin + prefixWidth,
        y: y - 0.3,
        size: customerSize,
        font: bold,
        color: rgb(0.08, 0.08, 0.08),
      });

      y -= customerSize + (compact ? 3 : 5);
    } else {
      y -= compact ? 2 : 4;
    }

    /*
     * Trennlinie
     */
    page.drawLine({
      start: {
        x: outerMargin,
        y,
      },
      end: {
        x: width - outerMargin,
        y,
      },
      thickness: 0.65,
      color: rgb(0.7, 0.7, 0.7),
    });

    y -= compact ? 7 : 10;

    /*
     * Zutaten
     */
    page.drawText("ZUTATEN", {
      x: outerMargin,
      y,
      size: sectionLabelSize,
      font: bold,
      color: rgb(0.28, 0.28, 0.28),
    });

    y -= sectionLabelSize + (compact ? 2.2 : 3.5);

    const ingredientLines =
      wrapTextByWidth({
        text: ingredientText,
        font: regular,
        fontSize: bodySize,
        maxWidth: contentWidth,
      }).slice(0, compact ? 3 : 5);

    for (const line of ingredientLines) {
      page.drawText(line, {
        x: outerMargin,
        y,
        size: bodySize,
        font: regular,
        color: rgb(0.05, 0.05, 0.05),
      });

      y -= bodyLeading;
    }

    y -= compact ? 2.5 : 4;

    /*
     * Allergene als klar abgesetzter unterer Bereich.
     */
    const allergenLabelHeight =
      sectionLabelSize + bodySize + (compact ? 7 : 10);

    const allergenBoxBottom =
      Math.max(
        outerMargin,
        y - allergenLabelHeight + bodySize
      );

    page.drawRectangle({
      x: outerMargin,
      y: allergenBoxBottom,
      width: contentWidth,
      height: allergenLabelHeight,
      color: rgb(0.94, 0.94, 0.94),
    });

    const allergenLabelY =
      allergenBoxBottom +
      allergenLabelHeight -
      sectionLabelSize -
      (compact ? 2.5 : 3.5);

    page.drawText("ALLERGENE", {
      x: outerMargin + (compact ? 3 : 4),
      y: allergenLabelY,
      size: sectionLabelSize,
      font: bold,
      color: rgb(0.18, 0.18, 0.18),
    });

    const allergenLines =
      wrapTextByWidth({
        text: allergenText,
        font: bold,
        fontSize: bodySize,
        maxWidth:
          contentWidth - (compact ? 6 : 8),
      }).slice(0, compact ? 1 : 2);

    let allergenY =
      allergenLabelY -
      bodySize -
      (compact ? 1.2 : 2);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: outerMargin + (compact ? 3 : 4),
        y: allergenY,
        size: bodySize,
        font: bold,
        color: rgb(0.04, 0.04, 0.04),
      });

      allergenY -= bodyLeading;
    }
  }

  return pdf.save();
}
