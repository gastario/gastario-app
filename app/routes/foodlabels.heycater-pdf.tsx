import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ActionFunctionArgs } from "react-router";


async function extractPdfText(inputBuffer: Buffer) {
  const imported = await import("pdf-parse");
  const pdfParse: any = (imported as any).default || imported;

  if (typeof pdfParse !== "function") {
    throw new Error("pdf-parse konnte nicht als Funktion geladen werden.");
  }

  const parsed = await pdfParse(inputBuffer);
  return String(parsed?.text || "");
}

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function cleanLine(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .trim();
}

function isDateLine(line: string) {
  return /\b\d{2}[.-]\d{2}[.-]\d{4}\b/.test(line);
}

function getDateFromLine(line: string) {
  const match = line.match(/\b\d{2}[.-]\d{2}[.-]\d{4}\b/);
  return match ? match[0].replace(/-/g, ".") : "";
}

function isNoise(line: string) {
  const text = line.toLowerCase();
  return (
    !text ||
    text === "-" ||
    text.includes("qr") ||
    text.includes("page") ||
    /^[-–—_]+$/.test(text)
  );
}

function looksLikeName(line: string) {
  const text = cleanLine(line);
  const lower = text.toLowerCase();

  if (text.length < 3 || text.length > 42) return false;
  if (isDateLine(text)) return false;
  if (lower.includes("caterer:")) return false;
  if (lower.includes("customer:")) return false;
  if (lower.includes("alexander")) return false;
  if (lower.includes("berlin")) return false;
  if (lower.includes("gluten")) return false;
  if (lower.includes("vegan")) return false;
  if (lower.includes("vegetarian")) return false;
  if (lower.includes("sesame")) return false;
  if (lower.includes("bowl")) return false;
  if (lower.includes("wrap")) return false;
  if (lower.includes("salmon")) return false;
  if (lower.includes("chicken")) return false;
  if (lower.includes("catering")) return false;
  if (/\d{4,}/.test(text)) return false;

  return /^[A-Za-zÄÖÜäöüßÀ-ÿ'’\- ]+$/.test(text);
}

type LabelData = {
  name: string;
  date: string;
  dish: string;
  allergens: string;
  caterer: string;
  customer: string;
  address: string;
};

function parseHeycaterLabels(rawText: string): LabelData[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line && !isNoise(line));

  const labels: LabelData[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!looksLikeName(line)) continue;

    const nextChunk = lines.slice(i, i + 10);
    const dateLine = nextChunk.find(isDateLine) || "";
    const date = getDateFromLine(dateLine);

    const afterName = lines.slice(i + 1, i + 12).filter((item) => {
      const lower = item.toLowerCase();
      return (
        item &&
        !isDateLine(item) &&
        !lower.includes("caterer:") &&
        !lower.includes("customer:") &&
        !lower.includes("alexander") &&
        !/^\d{5}/.test(lower)
      );
    });

    const dish = afterName[0] || "";
    const allergens = afterName[1] || "";

    const searchArea = lines.slice(i, i + 16);

    const caterer =
      searchArea.find((item) => item.toLowerCase().includes("caterer:")) ||
      "Caterer: Let Me Bowl heykantine";

    const customer =
      searchArea.find((item) => item.toLowerCase().includes("customer:")) ||
      "Customer:";

    const address =
      searchArea.find((item) => /\d{5}/.test(item) || item.toLowerCase().includes("alexander")) ||
      "Alexanderstrasse 5, Berlin, 10178";

    if (dish || date) {
      labels.push({
        name: line,
        date,
        dish,
        allergens,
        caterer,
        customer,
        address,
      });
    }
  }

  const unique = new Map<string, LabelData>();

  for (const label of labels) {
    const key = [label.name, label.date, label.dish].join("|").toLowerCase();
    if (!unique.has(key)) unique.set(key, label);
  }

  return Array.from(unique.values());
}

function wrapText(text: string, maxChars: number) {
  const words = cleanLine(text).split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export async function action({ request }: ActionFunctionArgs) {
  try {
  const formData = await request.formData();
  const file = formData.get("pdf");

  if (!(file instanceof File) || file.size === 0) {
    return new Response("Keine PDF-Datei hochgeladen.", { status: 400 });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const extractedText = await extractPdfText(inputBuffer);
  const labels = parseHeycaterLabels(extractedText);

  if (labels.length === 0) {
    return new Response("Keine Labels im PDF erkannt.", { status: 400 });
  }

  const outputPdf = await PDFDocument.create();
  const regularFont = await outputPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await outputPdf.embedFont(StandardFonts.HelveticaBold);

  const width = mmToPt(76);
  const height = mmToPt(51);

  for (const label of labels) {
    const page = outputPdf.addPage([width, height]);

    const black = rgb(0.05, 0.08, 0.12);
    const muted = rgb(0.28, 0.34, 0.42);

    let y = height - 18;

    page.drawText(label.name || "-", {
      x: 10,
      y,
      size: 10.5,
      font: boldFont,
      color: black,
    });

    if (label.date) {
      page.drawText(label.date, {
        x: width - 56,
        y: y + 1,
        size: 6.8,
        font: regularFont,
        color: black,
      });
    }

    y -= 17;

    for (const line of wrapText(label.dish, 44).slice(0, 2)) {
      page.drawText(line, {
        x: 10,
        y,
        size: 7.3,
        font: regularFont,
        color: black,
      });
      y -= 9;
    }

    y -= 2;

    for (const line of wrapText(label.allergens, 54).slice(0, 2)) {
      page.drawText(line, {
        x: 10,
        y,
        size: 5.7,
        font: regularFont,
        color: muted,
      });
      y -= 7;
    }

    y -= 4;

    page.drawText(label.caterer, {
      x: 10,
      y,
      size: 6.4,
      font: boldFont,
      color: black,
    });

    y -= 8;

    page.drawText(label.customer, {
      x: 10,
      y,
      size: 6.4,
      font: boldFont,
      color: black,
    });

    y -= 12;

    page.drawText(label.address, {
      x: 10,
      y,
      size: 5.9,
      font: regularFont,
      color: black,
    });
  }

  const pdfBytes = await outputPdf.save();

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="heycater-foodlabels-sauber-zebra.pdf"',
      "Cache-Control": "no-store",
    },
  });
  } catch (error: any) {
    console.error("HEY_LABEL_DEBUG_ERROR", error);
    return new Response("Heycater Label Fehler: " + (error?.message || String(error)), {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export async function loader() {
  return new Response("Nur Upload per Formular erlaubt.", { status: 405 });
}
