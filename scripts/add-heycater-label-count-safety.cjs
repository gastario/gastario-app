const fs = require("fs");

const path = "app/routes/foodlabels.heycater-pdf.tsx";
let content = fs.readFileSync(path, "utf8");

if (!content.includes("function getExpectedLabelCountFromFilename")) {
  content = content.replace(
`async function extractPdfText(inputBuffer: Buffer) {`,
`function getExpectedLabelCountFromFilename(filename: string) {
  const text = String(filename || "");

  const patterns = [
    /(\\d{1,4})\\s*labels/i,
    /(\\d{1,4})\\s*label/i,
    /(\\d{1,4})\\s*etiketten/i,
    /_(\\d{1,4})labels_/i,
    /_(\\d{1,4})label_/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  return null;
}

async function extractPdfText(inputBuffer: Buffer) {`
  );
}

const oldBlock = `    const labels = parseHeycaterLabelsFromText(text);

    if (labels.length === 0) {
      return new Response(
        "Keine Labels erkannt. PDF-Textlaenge: " + text.length + "\\n\\nErster Text:\\n" + text.slice(0, 1500),
        {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    }

    const pdfBytes = await renderHeycaterZebraPdf(labels);`;

const newBlock = `    const labels = parseHeycaterLabelsFromText(text);
    const expectedCount = getExpectedLabelCountFromFilename(file.name);

    if (labels.length === 0) {
      return new Response(
        "Keine Labels erkannt. PDF-Textlaenge: " + text.length + "\\n\\nErster Text:\\n" + text.slice(0, 2000),
        {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    }

    if (expectedCount !== null && labels.length !== expectedCount) {
      return new Response(
        [
          "SICHERHEITSSTOPP: Etikettenanzahl stimmt nicht.",
          "",
          "Erwartet laut Dateiname: " + expectedCount,
          "Erkannt durch Gastario: " + labels.length,
          "",
          "Es wurde KEINE Druckdatei erstellt, damit niemand ein falsches oder fehlendes Essen bekommt.",
          "",
          "Erkannte Labels:",
          ...labels.map((label, index) => {
            return String(index + 1).padStart(3, "0") + " | " + label.name + " | " + label.meal + " | " + label.date;
          }),
          "",
          "PDF-Textlaenge: " + text.length,
          "",
          "Erster PDF-Textauszug:",
          text.slice(0, 3000),
        ].join("\\n"),
        {
          status: 409,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }
      );
    }

    const pdfBytes = await renderHeycaterZebraPdf(labels);`;

if (!content.includes(oldBlock)) {
  throw new Error("Labels-Block in foodlabels.heycater-pdf.tsx nicht gefunden.");
}

content = content.replace(oldBlock, newBlock);

// Dateiname mit Anzahl ausgeben
content = content.replace(
  `"Content-Disposition": 'attachment; filename="heycater-foodlabels-zebra-sauber.pdf"',`,
  `"Content-Disposition": 'attachment; filename="heycater-foodlabels-zebra-' + labels.length + '-labels.pdf"',`
);

fs.writeFileSync(path, content, "utf8");
console.log("Heycater Label Route: Sicherheitszaehler eingebaut.");
