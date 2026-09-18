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
  let size = compact ? 10.2 : 12.8;
  const minimum = compact ? 7.6 : 9.4;

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

  const width = mmToPt(widthMm);
  const height = mmToPt(heightMm);

  const compact =
    widthMm <= 57 || heightMm <= 32;

  const safeCount =
    Math.max(1, Math.min(Number(count || 1), 200));

  const margin =
    compact ? mmToPt(2.5) : mmToPt(3.2);

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

    // Klarer, feiner Labelrand
    page.drawRectangle({
      x: 1.6,
      y: 1.6,
      width: width - 3.2,
      height: height - 3.2,
      borderWidth: 0.65,
      borderColor: rgb(0.62, 0.62, 0.62),
    });

    let y = height - margin;

    // --------------------------------------------------
    // 1. CUSTOMER-NAME LINKS / DATUM RECHTS
    // --------------------------------------------------
    const customerSize =
      compact ? 6.1 : 7.3;

    const dateSize =
      compact ? 4.7 : 5.4;

    if (customer) {
      page.drawText(customer, {
        x: margin,
        y: y - customerSize,
        size: customerSize,
        font: bold,
        color: rgb(0.06, 0.06, 0.06),
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
        color: rgb(0.34, 0.34, 0.34),
      });
    }

    if (customer || dateText) {
      y -=
        Math.max(customerSize, dateSize) +
        (compact ? 4.5 : 6);
    }

    // Trennlinie nach Customer
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
      color: rgb(0.80, 0.80, 0.80),
    });

    y -= compact ? 6 : 8;

    // --------------------------------------------------
    // 2. GERICHT
    // --------------------------------------------------
    const titleSize =
      fitTitleSize(
        dishName,
        bold,
        contentWidth,
        compact
      );

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
        color: rgb(0.03, 0.03, 0.03),
      });

      y -=
        titleSize +
        (compact ? 1 : 1.7);
    }

    y -= compact ? 4 : 6;

    // --------------------------------------------------
    // 3. ZUTATEN
    // --------------------------------------------------
    const sectionSize =
      compact ? 4.5 : 5.2;

    const bodySize =
      compact ? 5 : 6;

    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.40, 0.40, 0.40),
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
        color: rgb(0.07, 0.07, 0.07),
      });

      y -=
        compact ? 5.8 : 7.1;
    }

    y -= compact ? 3.5 : 5;

    // Trennlinie vor Allergenen
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

    // --------------------------------------------------
    // 4. ALLERGENE
    // --------------------------------------------------
    page.drawText("ALLERGENE", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.40, 0.40, 0.40),
    });

    y -= compact ? 6.5 : 8;

    const allergenSize =
      compact ? 5.2 : 6.2;

    const allergenLines =
      wrapText(
        allergenText,
        bold,
        allergenSize,
        contentWidth
      ).slice(0, compact ? 2 : 3);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: allergenSize,
        font: bold,
        color: rgb(0.03, 0.03, 0.03),
      });

      y -=
        compact ? 5.8 : 7;
    }
  }

  return pdf.save();
}
