import { createRequire } from "node:module";
import { prisma } from "../lib/prisma.server";
import { getTenantAccess } from "../lib/features.server";
import { learnSupplierPricesFromInvoice } from "../lib/supplier-invoice-prices.server";

const MAX_PDF_SIZE_BYTES = 12 * 1024 * 1024;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function extractPdfText(buffer: Buffer) {
  const require = createRequire(import.meta.url);
  const pdfParseModule = require("pdf-parse");
  const uint8 = new Uint8Array(buffer);

  const pagerender = async (pageData: any) => {
    const textContent = await pageData.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    const items = Array.isArray(textContent?.items)
      ? textContent.items
      : [];

    return (
      items
        .map((item: any) =>
          String(item?.str || "").trim()
        )
        .filter(Boolean)
        .join(" ") + "\n\n"
    );
  };

  let text = "";

  if (typeof pdfParseModule === "function") {
    const result = await pdfParseModule(buffer, {
      pagerender,
    });

    text = String(result.text || "").trim();
  }
  else if (
    typeof pdfParseModule.default === "function"
  ) {
    const result =
      await pdfParseModule.default(buffer, {
        pagerender,
      });

    text = String(result.text || "").trim();
  }
  else if (pdfParseModule.PDFParse) {
    const parser =
      new pdfParseModule.PDFParse({
        data: uint8,
      });

    const result = await parser.getText();

    text = String(result.text || "").trim();

    if (typeof parser.destroy === "function") {
      await parser.destroy();
    }
  }
  else {
    throw new Error(
      "pdf-parse Export wurde nicht erkannt."
    );
  }

  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const access =
    await getTenantAccess(request);

  if (!access?.tenantId) {
    return json(
      {
        ok: false,
        error: "Nicht angemeldet.",
      },
      401
    );
  }

  const formData =
    await request.formData();

  const file =
    formData.get("file");

  if (
    !file ||
    typeof file === "string" ||
    typeof (file as File).arrayBuffer !==
      "function"
  ) {
    return json(
      {
        ok: false,
        error: "Keine PDF-Datei empfangen.",
      },
      400
    );
  }

  const pdf = file as File;

  const fileName =
    String(pdf.name || "rechnung.pdf");

  if (
    pdf.type !== "application/pdf" &&
    !fileName.toLowerCase().endsWith(".pdf")
  ) {
    return json(
      {
        ok: false,
        fileName,
        error:
          "Es werden nur PDF-Dateien unterstützt.",
      },
      400
    );
  }

  if (!pdf.size || pdf.size <= 0) {
    return json(
      {
        ok: false,
        fileName,
        error: "Die PDF-Datei ist leer.",
      },
      400
    );
  }

  if (pdf.size > MAX_PDF_SIZE_BYTES) {
    return json(
      {
        ok: false,
        fileName,
        error:
          "Die PDF-Datei ist größer als 12 MB.",
      },
      400
    );
  }

  try {
    const buffer = Buffer.from(
      await pdf.arrayBuffer()
    );

    const text =
      await extractPdfText(buffer);

    if (!text) {
      return json(
        {
          ok: false,
          fileName,
          error:
            "Aus dieser PDF konnte kein Text gelesen werden.",
        },
        422
      );
    }

    const result =
      await learnSupplierPricesFromInvoice({
        prisma,
        tenantId: access.tenantId,
        text,
      });

    return json({
      ok: true,
      fileName,
      ...result,
    });
  }
  catch (error: any) {
    console.error(
      "[supplier-invoice-import]",
      error
    );

    return json(
      {
        ok: false,
        fileName,
        error: String(
          error?.message ||
            "Rechnung konnte nicht verarbeitet werden."
        ),
      },
      500
    );
  }
}
