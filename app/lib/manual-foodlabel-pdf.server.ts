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

function wrapTextByWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
) {
  const words = clean(text).split(" ").filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (
      font.widthOfTextAtSize(next, fontSize) <= maxWidth ||
      current.length === 0
    ) {
      current = next;
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

function fitTitleSize(
  text: string,
  font: PDFFont,
  maxWidth: number,
  compact: boolean
) {
  let size = compact ? 10.5 : 14.5;
  const minSize = compact ? 7.5 : 10.5;

  while (size >= minSize) {
    const lines = wrapTextByWidth(text, font, size, maxWidth);
    if (lines.length <= 2) {
      return size;
    }
    size -= 0.5;
  }

  return minSize;
}

function fitCustomerSize(
  text: string,
  font: PDFFont,
  maxWidth: number,
  compact: boolean
) {
  let size = compact ? 6.2 : 7.2;
  const minSize = compact ? 4.8 : 5.8;

  while (size >= minSize) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return size;
    }
    size -= 0.4;
  }

  return minSize;
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

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = mmToPt(widthMm);
  const height = mmToPt(heightMm);

  const compact = widthMm <= 57 || heightMm <= 32;

  const safeCount = Math.max(1, Math.min(Number(count || 1), 200));

  const margin = compact ? mmToPt(2.4) : mmToPt(3.4);
  const contentWidth = width - margin * 2;

  const dishName = clean(name) || "Foodlabel";
  const eaterName = clean(customerName);
  const ingredientText = clean(ingredients) || "-";
  const allergenText = clean(allergens) || "-";

  for (let index = 0; index < safeCount; index += 1) {
    const page = pdf.addPage([width, height]);

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });

    // weicher Außenrand
    page.drawRectangle({
      x: 2,
      y: 2,
      width: width - 4,
      height: height - 4,
      borderWidth: 1.1,
      borderColor: rgb(0.72, 0.72, 0.72),
    });

    // dezenter Innenrahmen
    page.drawRectangle({
      x: 5.5,
      y: 5.5,
      width: width - 11,
      height: height - 11,
      borderWidth: 0.6,
      borderColor: rgb(0.88, 0.88, 0.88),
    });

    let y = height - margin;

    // GERICHTSNAME zuerst
    const titleSize = fitTitleSize(dishName, bold, contentWidth, compact);
    const titleLines = wrapTextByWidth(dishName, bold, titleSize, contentWidth).slice(0, 2);

    for (const line of titleLines) {
      page.drawText(line, {
        x: margin,
        y: y - titleSize,
        size: titleSize,
        font: bold,
        color: rgb(0.07, 0.07, 0.07),
      });

      y -= titleSize + (compact ? 1.5 : 2.5);
    }

    // Name des Essers darunter
    if (eaterName) {
      y -= compact ? 1 : 2;

      const prefixSize = compact ? 4.8 : 5.4;
      const eaterLine = `Für ${eaterName}`;
      const eaterSize = fitCustomerSize(eaterLine, bold, contentWidth, compact);

      page.drawText(eaterLine, {
        x: margin,
        y: y - eaterSize,
        size: eaterSize,
        font: bold,
        color: rgb(0.42, 0.42, 0.42),
      });

      y -= eaterSize + (compact ? 4 : 6);
    } else {
      y -= compact ? 3 : 5;
    }

    // Trennlinie 1
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.8,
      color: rgb(0.75, 0.75, 0.75),
    });

    y -= compact ? 7 : 10;

    // ZUTATEN
    const sectionLabelSize = compact ? 4.9 : 5.8;
    const bodySize = compact ? 5.1 : 6.4;

    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: sectionLabelSize,
      font: bold,
      color: rgb(0.45, 0.45, 0.45),
    });

    y -= compact ? 7 : 9;

    const allergenBoxHeight = compact ? mmToPt(8.5) : mmToPt(12);
    const allergenBoxY = margin;
    const ingredientBottomLimit = allergenBoxY + allergenBoxHeight + (compact ? 8 : 10);

    const ingredientLines = wrapTextByWidth(
      ingredientText,
      regular,
      bodySize,
      contentWidth
    );

    for (const line of ingredientLines) {
      if (y - bodySize < ingredientBottomLimit) {
        break;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: bodySize,
        font: regular,
        color: rgb(0.10, 0.10, 0.10),
      });

      y -= compact ? 6.2 : 8;
    }

    // Trennlinie 2 über Allergenen
    const dividerY = allergenBoxY + allergenBoxHeight + (compact ? 4 : 5);

    page.drawLine({
      start: { x: margin, y: dividerY },
      end: { x: width - margin, y: dividerY },
      thickness: 0.6,
      color: rgb(0.86, 0.86, 0.86),
    });

    // weicher Allergene-Kasten
    page.drawRectangle({
      x: margin,
      y: allergenBoxY,
      width: contentWidth,
      height: allergenBoxHeight,
      color: rgb(0.96, 0.96, 0.96),
      borderWidth: 0.6,
      borderColor: rgb(0.86, 0.86, 0.86),
    });

    const boxPadding = compact ? 3.5 : 5;

    page.drawText("ALLERGENE", {
      x: margin + boxPadding,
      y: allergenBoxY + allergenBoxHeight - boxPadding - sectionLabelSize,
      size: sectionLabelSize,
      font: bold,
      color: rgb(0.45, 0.45, 0.45),
    });

    const allergenSize = compact ? 5.2 : 6.5;
    const allergenLines = wrapTextByWidth(
      allergenText,
      bold,
      allergenSize,
      contentWidth - boxPadding * 2
    ).slice(0, compact ? 1 : 2);

    let allergenY =
      allergenBoxY +
      allergenBoxHeight -
      boxPadding -
      sectionLabelSize -
      allergenSize -
      3;

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin + boxPadding,
        y: allergenY,
        size: allergenSize,
        font: bold,
        color: rgb(0.08, 0.08, 0.08),
      });

      allergenY -= allergenSize + 1.5;
    }
  }

  return pdf.save();
}
