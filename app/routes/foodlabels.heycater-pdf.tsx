import { PDFDocument } from "pdf-lib";
import type { ActionFunctionArgs } from "react-router";

function mmToPt(mm: number) {
  return (mm / 25.4) * 72;
}

function numberFromForm(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const file = formData.get("pdf");
  const columns = Math.max(1, Math.floor(numberFromForm(formData.get("columns"), 3)));
  const rows = Math.max(1, Math.floor(numberFromForm(formData.get("rows"), 6)));
  const targetWidthMm = numberFromForm(formData.get("labelWidthMm"), 76);
  const targetHeightMm = numberFromForm(formData.get("labelHeightMm"), 51);

  const marginTopMm = numberFromForm(formData.get("marginTopMm"), 0);
  const marginRightMm = numberFromForm(formData.get("marginRightMm"), 0);
  const marginBottomMm = numberFromForm(formData.get("marginBottomMm"), 0);
  const marginLeftMm = numberFromForm(formData.get("marginLeftMm"), 0);

  if (!(file instanceof File) || file.size === 0) {
    return new Response("Keine PDF-Datei hochgeladen.", { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return new Response("Bitte eine PDF-Datei hochladen.", { status: 400 });
  }

  const inputBytes = new Uint8Array(await file.arrayBuffer());
  const sourcePdf = await PDFDocument.load(inputBytes);
  const outputPdf = await PDFDocument.create();

  const targetWidth = mmToPt(targetWidthMm);
  const targetHeight = mmToPt(targetHeightMm);

  for (const sourcePage of sourcePdf.getPages()) {
    const pageWidth = sourcePage.getWidth();
    const pageHeight = sourcePage.getHeight();

    const cropLeft = mmToPt(marginLeftMm);
    const cropRight = mmToPt(marginRightMm);
    const cropTop = mmToPt(marginTopMm);
    const cropBottom = mmToPt(marginBottomMm);

    const usableWidth = pageWidth - cropLeft - cropRight;
    const usableHeight = pageHeight - cropTop - cropBottom;

    const cellWidth = usableWidth / columns;
    const cellHeight = usableHeight / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const left = cropLeft + col * cellWidth;
        const right = left + cellWidth;

        const top = pageHeight - cropTop - row * cellHeight;
        const bottom = top - cellHeight;

        const embedded = await outputPdf.embedPage(sourcePage, {
          left,
          bottom,
          right,
          top,
        });

        const page = outputPdf.addPage([targetWidth, targetHeight]);
        page.drawPage(embedded, {
          x: 0,
          y: 0,
          width: targetWidth,
          height: targetHeight,
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
