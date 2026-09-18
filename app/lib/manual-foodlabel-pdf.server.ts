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
    // Schlichter Außenrahmen für sauberen Thermodruck
    page.drawRectangle({
      x: 2,
      y: 2,
      width: width - 4,
      height: height - 4,
      borderWidth: 0.75,
      borderColor: rgb(0.48, 0.48, 0.48),
    });

    let y = height - margin;
    // Ruhiger Kopfbereich
    const titleSize =
      compact
        ? 10.8
        : 12.6;

    const titleLines = wrapTextByWidth(
      dishName,
      bold,
      titleSize,
      contentWidth
    ).slice(0, 2);

    for (const line of titleLines) {
      page.drawText(line, {
        x: margin,
        y: y - titleSize,
        size: titleSize,
        font: bold,
        color: rgb(0.08, 0.08, 0.08),
      });

      y -= titleSize + (compact ? 1.2 : 1.8);
    }

    if (eaterName) {
      y -= compact ? 1.2 : 2;

      const metaLabelSize = compact ? 4.1 : 4.6;
      const eaterSize = compact ? 5.2 : 5.9;

      page.drawText("für", {
        x: margin,
        y: y - eaterSize,
        size: metaLabelSize,
        font: regular,
        color: rgb(0.45, 0.45, 0.45),
      });

      const fuerWidth = regular.widthOfTextAtSize("für", metaLabelSize);

      page.drawText(eaterName, {
        x: margin + fuerWidth + (compact ? 4 : 6),
        y: y - eaterSize,
        size: eaterSize,
        font: bold,
        color: rgb(0.22, 0.22, 0.22),
      });

      y -= eaterSize + (compact ? 4 : 6);
    } else {
      y -= compact ? 2 : 4;
    }

    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentWidth, y },
      thickness: 0.8,
      color: rgb(0.78, 0.78, 0.78),
    });

    y -= compact ? 4 : 6;


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
    // Feine Trennlinie vor Allergenen
    const dividerY = allergenBoxY + allergenBoxHeight + (compact ? 3 : 4);

    page.drawLine({
      start: { x: margin, y: dividerY },
      end: { x: margin + contentWidth, y: dividerY },
      thickness: 0.7,
      color: rgb(0.84, 0.84, 0.84),
    });

    // Schlichter Allergene-Bereich ohne Hintergrundkasten
    const allergenLabelY = dividerY - (compact ? 7 : 9);
    const allergenTextYStart = allergenLabelY - (compact ? 6 : 7);

    page.drawText("ALLERGENE", {
      x: margin,
      y: allergenLabelY,
      size: compact ? 4.8 : 5.5,
      font: bold,
      color: rgb(0.42, 0.42, 0.42),
    });

    const allergenLines = wrapTextByWidth(
      allergenText,
      bold,
      compact ? 5.2 : 6.1,
      contentWidth
    ).slice(0, compact ? 2 : 3);

    let allergenY = allergenTextYStart;

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin,
        y: allergenY,
        size: compact ? 5.2 : 6.1,
        font: bold,
        color: rgb(0.08, 0.08, 0.08),
      });

      allergenY -= compact ? 6 : 7.2;
    }

}
  return pdf.save();
}
