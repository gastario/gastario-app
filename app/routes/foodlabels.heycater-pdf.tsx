import { PDFDocument } from "pdf-lib";
import type { ActionFunctionArgs } from "react-router";

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function readNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const file = formData.get("pdf");
  const columns = Math.max(1, Math.floor(readNumber(formData.get("columns"), 3)));
  const rows = Math.max(1, Math.floor(readNumber(formData.get("rows"), 6)));

  const labelWidthMm = readNumber(formData.get("labelWidthMm"), 76);
  const labelHeightMm = readNumber(formData.get("labelHeightMm"), 51);

  const pageTopMm = readNumber(formData.get("pageTopMm"), 9);
  const pageRightMm = readNumber(formData.get("pageRightMm"), 9);
  const pageBottomMm = readNumber(formData.get("pageBottomMm"), 9);
  const pageLeftMm = readNumber(formData.get("pageLeftMm"), 9);

  const innerTopMm = readNumber(formData.get("innerTopMm"), 0.8);
  const innerRightMm = readNumber(formData.get("innerRightMm"), 1.2);
  const innerBottomMm = readNumber(formData.get("innerBottomMm"), 9);
  const innerLeftMm = readNumber(formData.get("innerLeftMm"), 1.2);

  if (!(file instanceof File) || file.size === 0) {
    return new Response("Keine PDF-Datei hochgeladen.", { status: 400 });
  }

  const sourcePdf = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  const outputPdf = await PDFDocument.create();

  const targetWidth = mmToPt(labelWidthMm);
  const targetHeight = mmToPt(labelHeightMm);

  for (const sourcePage of sourcePdf.getPages()) {
    const pageWidth = sourcePage.getWidth();
    const pageHeight = sourcePage.getHeight();

    const usableLeft = mmToPt(pageLeftMm);
    const usableRight = pageWidth - mmToPt(pageRightMm);
    const usableTop = pageHeight - mmToPt(pageTopMm);
    const usableBottom = mmToPt(pageBottomMm);

    const usableWidth = usableRight - usableLeft;
    const usableHeight = usableTop - usableBottom;

    const cellWidth = usableWidth / columns;
    const cellHeight = usableHeight / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const cellLeft = usableLeft + col * cellWidth;
        const cellRight = cellLeft + cellWidth;

        const cellTop = usableTop - row * cellHeight;
        const cellBottom = cellTop - cellHeight;

        const left = cellLeft + mmToPt(innerLeftMm);
        const right = cellRight - mmToPt(innerRightMm);
        const top = cellTop - mmToPt(innerTopMm);
        const bottom = cellBottom + mmToPt(innerBottomMm);

        if (right <= left || top <= bottom) continue;

        const embedded = await outputPdf.embedPage(sourcePage, {
          left,
          bottom,
          right,
          top,
        });

        const page = outputPdf.addPage([targetWidth, targetHeight]);

        const sourceWidth = right - left;
        const sourceHeight = top - bottom;
        const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);

        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;

        page.drawPage(embedded, {
          x: (targetWidth - drawWidth) / 2,
          y: (targetHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      }
    }
  }

  const pdfBytes = await outputPdf.save();

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="heycater-foodlabels-zebra.pdf"',
      "Cache-Control": "no-store",
    },
  });
}

export async function loader() {
  return new Response("Nur Upload per Formular erlaubt.", { status: 405 });
}
