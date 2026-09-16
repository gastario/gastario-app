import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

function mmToPt(mm: number) {
  return (mm * 72) / 25.4;
}

function wrapText(
  text: string,
  maxChars: number
) {
  const words = String(text || "")
    .trim()
    .split(/\s+/);

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next =
      current.length > 0
        ? `${current} ${word}`
        : word;

    if (
      next.length > maxChars &&
      current
    ) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export async function renderManualFoodLabelPdf({
  name,
  ingredients,
  allergens,
  count,
  widthMm,
  heightMm,
}: {
  name: string;
  ingredients?: string | null;
  allergens?: string | null;
  count: number;
  widthMm: number;
  heightMm: number;
}) {
  const pdf =
    await PDFDocument.create();

  const regular =
    await pdf.embedFont(
      StandardFonts.Helvetica
    );

  const bold =
    await pdf.embedFont(
      StandardFonts.HelveticaBold
    );

  const width =
    mmToPt(widthMm);

  const height =
    mmToPt(heightMm);

  const safeCount =
    Math.max(
      1,
      Math.min(count, 200)
    );

  for (
    let index = 0;
    index < safeCount;
    index += 1
  ) {
    const page =
      pdf.addPage([
        width,
        height,
      ]);

    const margin =
      mmToPt(4);

    page.drawRectangle({
      x: 2,
      y: 2,
      width: width - 4,
      height: height - 4,
      borderColor:
        rgb(0.1, 0.1, 0.1),
      borderWidth: 1,
    });

    let y =
      height - margin - 8;

    const titleLines =
      wrapText(name, 28)
        .slice(0, 2);

    for (
      const line of titleLines
    ) {
      page.drawText(line, {
        x: margin,
        y,
        size: 11,
        font: bold,
      });

      y -= 13;
    }

    y -= 3;

    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: 6.5,
      font: bold,
    });

    y -= 9;

    const ingredientLines =
      wrapText(
        ingredients || "-",
        48
      ).slice(0, 5);

    for (
      const line of ingredientLines
    ) {
      page.drawText(line, {
        x: margin,
        y,
        size: 7,
        font: regular,
      });

      y -= 8;
    }

    y -= 2;

    page.drawText("ALLERGENE", {
      x: margin,
      y,
      size: 6.5,
      font: bold,
    });

    y -= 9;

    const allergenLines =
      wrapText(
        allergens || "-",
        48
      ).slice(0, 3);

    for (
      const line of allergenLines
    ) {
      page.drawText(line, {
        x: margin,
        y,
        size: 7,
        font: regular,
      });

      y -= 8;
    }
  }

  return pdf.save();
}
