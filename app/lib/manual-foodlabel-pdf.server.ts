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
    const next = current ? `${current} ${word}` : word;

    if (
      !current ||
      font.widthOfTextAtSize(next, size) <= maxWidth
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

function fitSize(
  text: string,
  font: PDFFont,
  startSize: number,
  minSize: number,
  maxWidth: number
) {
  let size = startSize;

  while (
    size > minSize &&
    wrapText(text, font, size, maxWidth).length > 2
  ) {
    size -= 0.4;
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
    compact ? mmToPt(2.2) : mmToPt(3);

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

    // weißer Hintergrund
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });

    // nur ein sauberer Außenrahmen
    page.drawRectangle({
      x: 1.7,
      y: 1.7,
      width: width - 3.4,
      height: height - 3.4,
      borderWidth: 0.65,
      borderColor: rgb(0.55, 0.55, 0.55),
    });

    let y =
      height - margin;

    // GERÜST: Gericht
    const titleSize =
      fitSize(
        dishName,
        bold,
        compact ? 10.5 : 13,
        compact ? 7.5 : 10,
        contentWidth
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

      y -= titleSize + (compact ? 1 : 1.5);
    }

    // Meta-Zeile
    y -= compact ? 1.5 : 2.5;

    const metaSize =
      compact ? 4.8 : 5.7;

    if (eaterName) {
      page.drawText(eaterName, {
        x: margin,
        y: y - metaSize,
        size: metaSize,
        font: bold,
        color: rgb(0.30, 0.30, 0.30),
      });
    }

    if (dateText) {
      const dateWidth =
        regular.widthOfTextAtSize(
          dateText,
          metaSize
        );

      page.drawText(dateText, {
        x:
          width -
          margin -
          dateWidth,
        y: y - metaSize,
        size: metaSize,
        font: regular,
        color: rgb(0.38, 0.38, 0.38),
      });
    }

    if (eaterName || dateText) {
      y -= metaSize + (compact ? 4 : 5.5);
    }

    // Haupttrennlinie
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

    /*
     * Unterer Bereich:
     * Zutaten links / Allergene rechts
     */
    const gap =
      compact ? mmToPt(2) : mmToPt(2.8);

    const ingredientWidth =
      contentWidth * 0.66;

    const allergenWidth =
      contentWidth - ingredientWidth - gap;

    const allergenX =
      margin + ingredientWidth + gap;

    const sectionSize =
      compact ? 4.4 : 5.2;

    const bodySize =
      compact ? 4.8 : 5.9;

    // Abschnittstitel
    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.42, 0.42, 0.42),
    });

    page.drawText("ALLERGENE", {
      x: allergenX,
      y,
      size: sectionSize,
      font: bold,
      color: rgb(0.42, 0.42, 0.42),
    });

    // vertikale Trennung
    const columnTop =
      y + 2;

    const columnBottom =
      margin + 2;

    page.drawLine({
      start: {
        x: allergenX - gap / 2,
        y: columnTop,
      },
      end: {
        x: allergenX - gap / 2,
        y: columnBottom,
      },
      thickness: 0.5,
      color: rgb(0.84, 0.84, 0.84),
    });

    let ingredientsY =
      y - (compact ? 7 : 8.5);

    let allergensY =
      ingredientsY;

    const ingredientLines =
      wrapText(
        ingredientText,
        regular,
        bodySize,
        ingredientWidth
      ).slice(0, compact ? 5 : 7);

    for (const line of ingredientLines) {
      page.drawText(line, {
        x: margin,
        y: ingredientsY,
        size: bodySize,
        font: regular,
        color: rgb(0.10, 0.10, 0.10),
      });

      ingredientsY -=
        compact ? 5.5 : 7;
    }

    const allergenLines =
      wrapText(
        allergenText,
        bold,
        bodySize,
        allergenWidth
      ).slice(0, compact ? 5 : 7);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: allergenX,
        y: allergensY,
        size: bodySize,
        font: bold,
        color: rgb(0.06, 0.06, 0.06),
      });

      allergensY -=
        compact ? 5.5 : 7;
    }
  }

  return pdf.save();
}
