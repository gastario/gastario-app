const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function removeBrokenUmlauts(content) {
  const replacements = [
    ["Ã¤", "ae"],
    ["Ã„", "Ae"],
    ["Ã¶", "oe"],
    ["Ã–", "Oe"],
    ["Ã¼", "ue"],
    ["Ãœ", "Ue"],
    ["ÃŸ", "ss"],
    ["Â", ""],
    ["ä", "ae"],
    ["Ä", "Ae"],
    ["ö", "oe"],
    ["Ö", "Oe"],
    ["ü", "ue"],
    ["Ü", "Ue"],
    ["ß", "ss"],
  ];

  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }

  return content;
}

// 1) Umlaute/Mojibake in Label-Routen entfernen
for (const file of ["app/routes/mhd-labels.tsx", "app/routes/foodlabels.tsx", "app/components/AppLayout.tsx"]) {
  if (fs.existsSync(file)) {
    write(file, removeBrokenUmlauts(read(file)));
  }
}

// 2) Neue Upload-Route fuer Heycater Foodlabel PDF erstellen
const routeFile = "app/routes/foodlabels.heycater-pdf.tsx";

write(routeFile, `import { PDFDocument } from "pdf-lib";
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
`);

// 3) Route registrieren
const routesPath = "app/routes.ts";
let routes = read(routesPath);

if (!routes.includes('route("foodlabels/heycater-pdf"')) {
  routes = routes.replace(
    'route("foodlabels", "routes/foodlabels.tsx"),',
    'route("foodlabels", "routes/foodlabels.tsx"),\n  route("foodlabels/heycater-pdf", "routes/foodlabels.heycater-pdf.tsx"),'
  );
}

write(routesPath, routes);

// 4) Upload-Box in Foodlabels-Seite einbauen
const foodlabelsPath = "app/routes/foodlabels.tsx";
let foodlabels = read(foodlabelsPath);

if (!foodlabels.includes("Heycater-PDF hochladen")) {
  const uploadBlock = `
        <section style={{
          background: "#fff",
          border: "1px solid #d9e4ea",
          borderRadius: 12,
          padding: 18,
          marginBottom: 18,
        }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{
              color: "#047857",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}>
              PDF Import
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
              Heycater-PDF hochladen
            </h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
              A4-PDF mit mehreren Stickern hochladen. Gastario erstellt daraus einzelne Zebra-Etiketten.
            </p>
          </div>

          <form
            action="/foodlabels/heycater-pdf"
            method="post"
            encType="multipart/form-data"
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr .75fr .75fr .85fr .85fr auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600 }}>
              PDF-Datei
              <input
                type="file"
                name="pdf"
                accept="application/pdf"
                required
                style={{
                  height: 38,
                  border: "1px solid #d6e2e8",
                  borderRadius: 8,
                  padding: "7px 10px",
                  background: "#fff",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600 }}>
              Spalten
              <select name="columns" defaultValue="3" style={{
                height: 38,
                border: "1px solid #d6e2e8",
                borderRadius: 8,
                padding: "0 10px",
                background: "#fff",
              }}>
                <option value="3">3 Spalten</option>
                <option value="2">2 Spalten</option>
                <option value="1">1 Spalte</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600 }}>
              Reihen
              <select name="rows" defaultValue="6" style={{
                height: 38,
                border: "1px solid #d6e2e8",
                borderRadius: 8,
                padding: "0 10px",
                background: "#fff",
              }}>
                <option value="6">6 Reihen</option>
                <option value="5">5 Reihen</option>
                <option value="4">4 Reihen</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600 }}>
              Breite
              <select name="labelWidthMm" defaultValue="76" style={{
                height: 38,
                border: "1px solid #d6e2e8",
                borderRadius: 8,
                padding: "0 10px",
                background: "#fff",
              }}>
                <option value="76">76 mm</option>
                <option value="70">70 mm</option>
                <option value="60">60 mm</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 600 }}>
              Hoehe
              <select name="labelHeightMm" defaultValue="51" style={{
                height: 38,
                border: "1px solid #d6e2e8",
                borderRadius: 8,
                padding: "0 10px",
                background: "#fff",
              }}>
                <option value="51">51 mm</option>
                <option value="50">50 mm</option>
                <option value="38">38 mm</option>
              </select>
            </label>

            <button type="submit" style={{
              height: 38,
              border: 0,
              borderRadius: 8,
              padding: "0 16px",
              background: "#059669",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}>
              Zebra-PDF erstellen
            </button>

            <input type="hidden" name="marginTopMm" value="0" />
            <input type="hidden" name="marginRightMm" value="0" />
            <input type="hidden" name="marginBottomMm" value="0" />
            <input type="hidden" name="marginLeftMm" value="0" />
          </form>
        </section>
`;

  const titleMarker = "<h1>Foodlabel erstellen</h1>";

  if (foodlabels.includes(titleMarker)) {
    foodlabels = foodlabels.replace(titleMarker, titleMarker + "\n" + uploadBlock);
  } else {
    const fallbackMarker = "Labeldaten speichern";
    foodlabels = foodlabels.replace(fallbackMarker, uploadBlock + "\n" + fallbackMarker);
  }
}

write(foodlabelsPath, foodlabels);

console.log("Umlaute bereinigt, Heycater-PDF Uploadroute erstellt und Uploadbox in Foodlabels eingebaut.");
