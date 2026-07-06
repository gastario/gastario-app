const fs = require("fs");

const path = "app/routes/foodlabels.heycater-pdf.tsx";
let content = fs.readFileSync(path, "utf8");

const oldBlock = `async function extractPdfText(inputBuffer: Buffer) {
  const imported = await import("pdf-parse");
  const pdfParse: any = (imported as any).default || imported;

  if (typeof pdfParse !== "function") {
    throw new Error("pdf-parse konnte nicht als Funktion geladen werden.");
  }

  const parsed = await pdfParse(inputBuffer);
  return String(parsed?.text || "");
}
`;

const newBlock = `async function extractPdfText(inputBuffer: Buffer) {
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

  throw new Error("pdf-parse Export nicht erkannt. Gefunden: " + Object.keys(imported || {}).join(", "));
}
`;

if (!content.includes(oldBlock)) {
  throw new Error("Alter extractPdfText Block nicht gefunden.");
}

content = content.replace(oldBlock, newBlock);

fs.writeFileSync(path, content, "utf8");
console.log("pdf-parse Import fuer Heycater Labels robust gemacht.");
