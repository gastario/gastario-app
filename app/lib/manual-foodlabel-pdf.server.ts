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

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
) {
  const words = clean(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (
      font.widthOfTextAtSize(candidate, size) <= maxWidth ||
      !line
    ) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function getTitleSize(name: string, compact: boolean) {
  const length = clean(name).length;

  if (compact) {
    if (length > 34) return 8;
    if (length > 24) return 9;
    return 10;
  }

  if (length > 42) return 11;
  if (length > 30) return 12;
  return 14;
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

  const compact =
    widthMm <= 57 || heightMm <= 32;

  const safeCount =
    Math.max(1, Math.min(Number(count || 1), 200));

  const margin =
    compact ? mmToPt(2.2) : mmToPt(3.2);

  const contentWidth =
    width - margin * 2;

  const dishName = clean(name) || "Foodlabel";
  const eaterName = clean(customerName);
  const ingredientText = clean(ingredients) || "-";
  const allergenText = clean(allergens) || "-";

  for (let index = 0; index < safeCount; index += 1) {
    const page =
      pdf.addPage([width, height]);

    // Außenrahmen
    page.drawRectangle({
      x: 1.4,
      y: 1.4,
      width: width - 2.8,
      height: height - 2.8,
      borderWidth: 0.7,
      borderColor: rgb(0.15, 0.15, 0.15),
    });

    let y =
      height - margin;

    // Optionaler Name des Essers
    if (eaterName) {
      const labelSize =
        compact ? 5.2 : 5.8;

      page.drawText("FÜR", {
        x: margin,
        y: y - labelSize,
        size: labelSize,
        font: bold,
        color: rgb(0.35, 0.35, 0.35),
      });

      const prefixWidth =
        bold.widthOfTextAtSize("FÜR  ", labelSize);

      const eaterSize =
        compact ? 6.8 : 8;

      let shownName = eaterName;

      while (
        shownName.length > 1 &&
        bold.widthOfTextAtSize(shownName, eaterSize) >
          contentWidth - prefixWidth
      ) {
        shownName =
          shownName.slice(0, -1);
      }

      if (shownName !== eaterName && shownName.length > 3) {
        shownName =
          shownName.slice(0, -3) + "...";
      }

      page.drawText(shownName, {
        x: margin + prefixWidth,
        y: y - eaterSize,
        size: eaterSize,
        font: bold,
        color: rgb(0.05, 0.05, 0.05),
      });

      y -= compact ? 12 : 15;
    }

    // Gericht
    const titleSize =
      getTitleSize(dishName, compact);

    const titleLines =
      wrapText(
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
        color: rgb(0.02, 0.02, 0.02),
      });

      y -= titleSize + 2;
    }

    y -= compact ? 2 : 4;

    // Trennlinie
    page.drawLine({
      start: {
        x: margin,
        y,
      },
      end: {
        x: width - margin,
        y,
      },
      thickness: 0.65,
      color: rgb(0.68, 0.68, 0.68),
    });

    y -= compact ? 7 : 10;

    // Zutaten
    const sectionSize =
      compact ? 5 : 5.6;

    const bodySize =
      compact ? 5.2 : 6.4;

    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.38, 0.38, 0.38),
    });

    y -= compact ? 7 : 8.5;

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
        color: rgb(0.06, 0.06, 0.06),
      });

      y -= compact ? 6.2 : 7.8;
    }

    // Allergene fest am unteren Rand
    const boxHeight =
      compact ? mmToPt(8) : mmToPt(10);

    const boxY =
      margin;

    page.drawRectangle({
      x: margin,
      y: boxY,
      width: contentWidth,
      height: boxHeight,
      color: rgb(0.93, 0.93, 0.93),
    });

    const boxPadding =
      compact ? 3 : 4;

    page.drawText("ALLERGENE", {
      x: margin + boxPadding,
      y:
        boxY +
        boxHeight -
        sectionSize -
        boxPadding,
      size: sectionSize,
      font: bold,
      color: rgb(0.30, 0.30, 0.30),
    });

    const allergenSize =
      compact ? 5.2 : 6.4;

    const allergenLines =
      wrapText(
        allergenText,
        bold,
        allergenSize,
        contentWidth - boxPadding * 2
      ).slice(0, compact ? 1 : 2);

    let allergenY =
      boxY +
      boxHeight -
      sectionSize -
      allergenSize -
      boxPadding -
      3;

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin + boxPadding,
        y: allergenY,
        size: allergenSize,
        font: bold,
        color: rgb(0.02, 0.02, 0.02),
      });

      allergenY -= allergenSize + 1.5;
    }
  }

  return pdf.save();
}
