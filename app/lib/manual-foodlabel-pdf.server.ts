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

  if (!raw) {
    return "";
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return raw;
  }

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
    const candidate = current
      ? `${current} ${word}`
      : word;

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

function fitTitleSize(
  text: string,
  font: PDFFont,
  maxWidth: number,
  compact: boolean
) {
  let size = compact ? 10.2 : 13;
  const minimum = compact ? 7.6 : 9.8;

  while (size > minimum) {
    if (wrapText(text, font, size, maxWidth).length <= 2) {
      return size;
    }

    size -= 0.4;
  }

  return minimum;
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

  const italic =
    await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const width = mmToPt(widthMm);
  const height = mmToPt(heightMm);

  const compact =
    widthMm <= 57 || heightMm <= 32;

  const safeCount =
    Math.max(1, Math.min(Number(count || 1), 200));

  const margin =
    compact ? mmToPt(2.4) : mmToPt(3.2);

  const contentWidth =
    width - margin * 2;

  const dishName =
    clean(name) || "Foodlabel";

  const eaterName =
    clean(customerName);

  const dateText =
    formatLabelDate(labelDate);

  const ingredientText =
    prettifyList(ingredients) || "-";

  const allergenText =
    prettifyList(allergens) || "-";

  for (let index = 0; index < safeCount; index += 1) {
    const page = pdf.addPage([width, height]);

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });

    page.drawRectangle({
      x: 1.7,
      y: 1.7,
      width: width - 3.4,
      height: height - 3.4,
      borderWidth: 0.5,
      borderColor: rgb(0.68, 0.68, 0.68),
    });

    let y = height - margin;

    // Datum rechts oben
    if (dateText) {
      const dateSize =
        compact ? 4.5 : 5;

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
        color: rgb(0.42, 0.42, 0.42),
      });
    }

    // Gericht
    const titleWidth =
      dateText
        ? contentWidth * 0.76
        : contentWidth;

    const titleSize =
      fitTitleSize(
        dishName,
        bold,
        titleWidth,
        compact
      );

    const titleLines =
      wrapText(
        dishName,
        bold,
        titleSize,
        titleWidth
      ).slice(0, 2);

    for (const line of titleLines) {
      page.drawText(line, {
        x: margin,
        y: y - titleSize,
        size: titleSize,
        font: bold,
        color: rgb(0.04, 0.04, 0.04),
      });

      y -=
        titleSize +
        (compact ? 1 : 1.6);
    }

    // Essername
    if (eaterName) {
      y -= compact ? 1 : 2;

      const eaterSize =
        compact ? 5.3 : 6.1;

      page.drawText(eaterName, {
        x: margin,
        y: y - eaterSize,
        size: eaterSize,
        font: italic,
        color: rgb(0.30, 0.30, 0.30),
      });

      y -=
        eaterSize +
        (compact ? 4 : 5.5);
    } else {
      y -= compact ? 3 : 5;
    }

    // Haupttrennung
    page.drawLine({
      start: {
        x: margin,
        y,
      },
      end: {
        x: width - margin,
        y,
      },
      thickness: 0.7,
      color: rgb(0.76, 0.76, 0.76),
    });

    y -= compact ? 6 : 8;

    const sectionSize =
      compact ? 4.5 : 5.2;

    const bodySize =
      compact ? 5 : 6;

    // Zutaten
    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.42, 0.42, 0.42),
    });

    y -= compact ? 6.5 : 8;

    const allergenReserve =
      compact ? mmToPt(12) : mmToPt(15);

    const ingredientBottomLimit =
      margin + allergenReserve;

    const ingredientLines =
      wrapText(
        ingredientText,
        regular,
        bodySize,
        contentWidth
      );

    for (const line of ingredientLines) {
      if (
        y - bodySize <
        ingredientBottomLimit
      ) {
        break;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: bodySize,
        font: regular,
        color: rgb(0.08, 0.08, 0.08),
      });

      y -=
        compact ? 5.7 : 7;
    }

    // Allergene unten
    const allergenDividerY =
      margin +
      (compact ? mmToPt(10) : mmToPt(12));

    page.drawLine({
      start: {
        x: margin,
        y: allergenDividerY,
      },
      end: {
        x: width - margin,
        y: allergenDividerY,
      },
      thickness: 0.5,
      color: rgb(0.84, 0.84, 0.84),
    });

    const allergenLabelY =
      allergenDividerY -
      (compact ? 6 : 7.5);

    page.drawText("ALLERGENE", {
      x: margin,
      y: allergenLabelY,
      size: sectionSize,
      font: bold,
      color: rgb(0.42, 0.42, 0.42),
    });

    const allergenSize =
      compact ? 5.2 : 6.2;

    const allergenLines =
      wrapText(
        allergenText,
        bold,
        allergenSize,
        contentWidth
      ).slice(0, compact ? 2 : 3);

    let allergenY =
      allergenLabelY -
      (compact ? 6 : 7.5);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin,
        y: allergenY,
        size: allergenSize,
        font: bold,
        color: rgb(0.04, 0.04, 0.04),
      });

      allergenY -=
        compact ? 5.8 : 7;
    }
  }

  return pdf.save();
}
