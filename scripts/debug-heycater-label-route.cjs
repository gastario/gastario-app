const fs = require("fs");

const path = "app/routes/foodlabels.heycater-pdf.tsx";
let content = fs.readFileSync(path, "utf8");

// createRequire/pdf-parse oben entfernen, falls vorhanden
content = content.replace('import { createRequire } from "module";\n', "");
content = content.replace('const require = createRequire(import.meta.url);\nconst pdfParse = require("pdf-parse");\n', "");

// Hilfsfunktion fuer robusten pdf-parse Import einfuegen
if (!content.includes("async function extractPdfText")) {
  content = content.replace(
    "function mmToPt(mm: number) {",
    `async function extractPdfText(inputBuffer: Buffer) {
  const imported = await import("pdf-parse");
  const pdfParse: any = (imported as any).default || imported;

  if (typeof pdfParse !== "function") {
    throw new Error("pdf-parse konnte nicht als Funktion geladen werden.");
  }

  const parsed = await pdfParse(inputBuffer);
  return String(parsed?.text || "");
}

function mmToPt(mm: number) {`
  );
}

// parsed = await pdfParse(...) ersetzen
content = content.replace(
  'const parsed = await pdfParse(inputBuffer);\n  const labels = parseHeycaterLabels(parsed.text || "");',
  'const extractedText = await extractPdfText(inputBuffer);\n  const labels = parseHeycaterLabels(extractedText);'
);

// Action mit try/catch absichern
if (!content.includes("HEY_LABEL_DEBUG_ERROR")) {
  content = content.replace(
    "export async function action({ request }: ActionFunctionArgs) {\n",
    "export async function action({ request }: ActionFunctionArgs) {\n  try {\n"
  );

  content = content.replace(
    "\n  const pdfBytes = await outputPdf.save();\n\n  return new Response(pdfBytes, {",
    "\n  const pdfBytes = await outputPdf.save();\n\n  return new Response(pdfBytes, {"
  );

  content = content.replace(
    `  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="heycater-foodlabels-sauber-zebra.pdf"',
      "Cache-Control": "no-store",
    },
  });
}

export async function loader() {`,
    `  return new Response(pdfBytes, {
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

export async function loader() {`
  );
}

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Label Route debug-sicher gemacht.");
