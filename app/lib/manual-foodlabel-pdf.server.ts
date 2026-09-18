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
  let size = compact ? 10.2 : 13.2;
  const minimum = compact ? 7.8 : 9.8;

  while (size > minimum) {
    const lines = wrapText(text, font, size, maxWidth);

    if (lines.length <= 2) {
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

  const width = mmToPt(widthMm);
  const height = mmToPt(heightMm);

  const compact =
    widthMm <= 57 || heightMm <= 32;

  const safeCount =
    Math.max(1, Math.min(Number(count || 1), 200));

  const margin =
    compact ? mmToPt(2.4) : mmToPt(3.3);

  const contentWidth =
    width - margin * 2;

  const dishName =
    clean(name) || "Foodlabel";

  const eaterName =
    clean(customerName);

  const dateText =
    formatLabelDate(labelDate);

  const ingredientText =
    clean(ingredients) || "-";

  const allergenText =
    clean(allergens) || "-";

  for (let index = 0; index < safeCount; index += 1) {
    const page =
      pdf.addPage([width, height]);

    // Weißer Hintergrund
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });

    // Sehr dezenter Rahmen
    page.drawRectangle({
      x: 1.7,
      y: 1.7,
      width: width - 3.4,
      height: height - 3.4,
      borderWidth: 0.45,
      borderColor: rgb(0.68, 0.68, 0.68),
    });

    let y =
      height - margin;

    // Datum klein rechts oben
    const dateSize =
      compact ? 4.5 : 5.1;

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
        color: rgb(0.42, 0.42, 0.42),
      });
    }

    // Gericht
    const titleMaxWidth =
      dateText
        ? contentWidth * 0.76
        : contentWidth;

    const titleSize =
      fitTitleSize(
        dishName,
        bold,
        titleMaxWidth,
        compact
      );

    const titleLines =
      wrapText(
        dishName,
        bold,
        titleSize,
        titleMaxWidth
      ).slice(0, 2);

    for (const line of titleLines) {
      page.drawText(line, {
        x: margin,
        y: y - titleSize,
        size: titleSize,
        font: bold,
        color: rgb(0.03, 0.03, 0.03),
      });

      y -=
        titleSize +
        (compact ? 1.2 : 1.8);
    }

    // Essername
    if (eaterName) {
      y -= compact ? 1 : 2;

      const eaterSize =
        compact ? 5.2 : 6;

      page.drawText(eaterName, {
        x: margin,
        y: y - eaterSize,
        size: eaterSize,
        font: bold,
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
      thickness: 0.75,
      color: rgb(0.72, 0.72, 0.72),
    });

    y -= compact ? 6 : 8;

    // Zutaten
    const sectionSize =
      compact ? 4.5 : 5.2;

    const bodySize =
      compact ? 5.1 : 6.1;

    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.42, 0.42, 0.42),
    });

    y -= compact ? 6.5 : 8;

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
        color: rgb(0.08, 0.08, 0.08),
      });

      y -=
        compact ? 5.9 : 7.2;
    }

    y -= compact ? 3 : 5;

    // Kleine Trennung
    page.drawLine({
      start: {
        x: margin,
        y,
      },
      end: {
        x: width - margin,
        y,
      },
      thickness: 0.45,
      color: rgb(0.86, 0.86, 0.86),
    });

    y -= compact ? 6 : 8;

    // Allergene
    page.drawText("ALLERGENE", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.42, 0.42, 0.42),
    });

    y -= compact ? 6.5 : 8;

    const allergenLines =
      wrapText(
        allergenText,
        bold,
        compact ? 5.3 : 6.4,
        contentWidth
      ).slice(0, compact ? 2 : 3);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: compact ? 5.3 : 6.4,
        font: bold,
        color: rgb(0.02, 0.02, 0.02),
      });

      y -=
        compact ? 6 : 7.4;
    }
  }

  return pdf.save();
}
