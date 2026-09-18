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
    const candidate = current ? `${current} ${word}` : word;

    if (
      font.widthOfTextAtSize(candidate, fontSize) <= maxWidth ||
      current.length === 0
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

function fitTextSize(
  text: string,
  font: PDFFont,
  startSize: number,
  minSize: number,
  maxWidth: number,
  maxLines: number
) {
  let size = startSize;

  while (size >= minSize) {
    const lines = wrapTextByWidth(text, font, size, maxWidth);

    if (lines.length <= maxLines) {
      return size;
    }

    size -= 0.4;
  }

  return minSize;
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

  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const width = mmToPt(widthMm);
  const height = mmToPt(heightMm);

  const compact = widthMm <= 57 || heightMm <= 32;
  const safeCount = Math.max(1, Math.min(Number(count || 1), 200));

  const margin = compact ? mmToPt(2.4) : mmToPt(3.2);
  const contentWidth = width - margin * 2;

  const dishName = clean(name) || "Foodlabel";
  const eaterName = clean(customerName);
  const dateText = formatLabelDate(labelDate);
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

    page.drawRectangle({
      x: 2,
      y: 2,
      width: width - 4,
      height: height - 4,
      borderWidth: 0.65,
      borderColor: rgb(0.62, 0.62, 0.62),
    });

    let y = height - margin;

    // kleine Kategoriezeile
    const eyebrowSize = compact ? 4.4 : 5.1;

    page.drawText("GERICHT", {
      x: margin,
      y: y - eyebrowSize,
      size: eyebrowSize,
      font: sansBold,
      color: rgb(0.52, 0.52, 0.52),
    });

    y -= compact ? 7 : 9;

    // Gericht
    const titleSize = fitTextSize(
      dishName,
      sansBold,
      compact ? 10.5 : 13,
      compact ? 7.8 : 10,
      contentWidth,
      2
    );

    const titleLines = wrapTextByWidth(
      dishName,
      sansBold,
      titleSize,
      contentWidth
    ).slice(0, 2);

    for (const line of titleLines) {
      page.drawText(line, {
        x: margin,
        y: y - titleSize,
        size: titleSize,
        font: sansBold,
        color: rgb(0.06, 0.06, 0.06),
      });

      y -= titleSize + (compact ? 1 : 1.8);
    }

    y -= compact ? 2 : 3.5;

    // Meta-Zeile: Esser links, Datum rechts
    const metaLabelSize = compact ? 4.2 : 4.8;
    const metaValueSize = compact ? 5.1 : 6;

    if (eaterName || dateText) {
      if (eaterName) {
        page.drawText("FÜR", {
          x: margin,
          y: y - metaValueSize,
          size: metaLabelSize,
          font: sansBold,
          color: rgb(0.52, 0.52, 0.52),
        });

        const labelWidth =
          sansBold.widthOfTextAtSize("FÜR", metaLabelSize);

        page.drawText(eaterName, {
          x: margin + labelWidth + 5,
          y: y - metaValueSize,
          size: metaValueSize,
          font: serifItalic,
          color: rgb(0.18, 0.18, 0.18),
        });
      }

      if (dateText) {
        const dateWidth =
          serif.widthOfTextAtSize(dateText, metaValueSize);

        page.drawText(dateText, {
          x: width - margin - dateWidth,
          y: y - metaValueSize,
          size: metaValueSize,
          font: serif,
          color: rgb(0.22, 0.22, 0.22),
        });
      }

      y -= metaValueSize + (compact ? 5 : 7);
    }

    // feine Trennung
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.65,
      color: rgb(0.80, 0.80, 0.80),
    });

    y -= compact ? 6 : 8;

    // Zutaten
    const sectionSize = compact ? 4.6 : 5.3;
    const bodySize = compact ? 5 : 6.1;

    page.drawText("ZUTATEN", {
      x: margin,
      y,
      size: sectionSize,
      font: sansBold,
      color: rgb(0.48, 0.48, 0.48),
    });

    y -= compact ? 6.5 : 8;

    const ingredientLines = wrapTextByWidth(
      ingredientText,
      serif,
      bodySize,
      contentWidth
    ).slice(0, compact ? 3 : 5);

    for (const line of ingredientLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: bodySize,
        font: serif,
        color: rgb(0.10, 0.10, 0.10),
      });

      y -= compact ? 5.8 : 7.2;
    }

    y -= compact ? 3 : 5;

    // Allergene direkt danach, nicht künstlich nach ganz unten drücken
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.87, 0.87, 0.87),
    });

    y -= compact ? 6 : 8;

    page.drawText("ALLERGENE", {
      x: margin,
      y,
      size: sectionSize,
      font: sansBold,
      color: rgb(0.48, 0.48, 0.48),
    });

    y -= compact ? 6.5 : 8;

    const allergenLines = wrapTextByWidth(
      allergenText,
      sansBold,
      compact ? 5.1 : 6.2,
      contentWidth
    ).slice(0, compact ? 2 : 3);

    for (const line of allergenLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: compact ? 5.1 : 6.2,
        font: sansBold,
        color: rgb(0.08, 0.08, 0.08),
      });

      y -= compact ? 5.8 : 7.2;
    }
  }

  return pdf.save();
}

