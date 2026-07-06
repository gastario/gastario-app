import type { ActionFunctionArgs } from "react-router";

async function extractPdfText(inputBuffer: Buffer) {
  const imported: any = await import("pdf-parse");

  const candidates = [
    imported,
    imported.default,
    imported.default?.default,
    imported.pdfParse,
    imported.default?.pdfParse,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") {
      const parsed = await candidate(inputBuffer);
      return String(parsed?.text || "");
    }
  }

  const PDFParseClass = imported.PDFParse || imported.default?.PDFParse;

  if (typeof PDFParseClass === "function") {
    const parser = new PDFParseClass({ data: inputBuffer });

    try {
      const result = await parser.getText();
      return String(result?.text || result || "");
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  }

  throw new Error("pdf-parse Export nicht erkannt: " + Object.keys(imported || {}).join(", "));
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf");

    if (!(file instanceof File) || file.size === 0) {
      return new Response("Keine PDF-Datei hochgeladen.", { status: 400 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(inputBuffer);

    const { parseHeycaterLabelsFromText } = await import("../lib/heycater-label-parser.server");
    const { renderHeycaterZebraPdf } = await import("../lib/heycater-zebra-pdf.server");

    const labels = parseHeycaterLabelsFromText(text);

    if (labels.length === 0) {
      return new Response(
        "Keine Labels erkannt. PDF-Textlaenge: " + text.length + "\n\nErster Text:\n" + text.slice(0, 1500),
        {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    }

    const pdfBytes = await renderHeycaterZebraPdf(labels);

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="heycater-foodlabels-zebra-sauber.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("HEYCATER_LABEL_RENDER_ERROR", error);

    return new Response("Heycater Label Fehler: " + (error?.message || String(error)), {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export async function loader() {
  return new Response("Nur Upload per Formular erlaubt.", { status: 405 });
}
