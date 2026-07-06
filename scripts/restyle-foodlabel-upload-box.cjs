const fs = require("fs");

const path = "app/routes/foodlabels.tsx";
let content = fs.readFileSync(path, "utf8");

const start = content.indexOf("<section style={{");
const headline = content.indexOf("Heycater-PDF hochladen", start);
let sectionStart = -1;
let sectionEnd = -1;

if (headline !== -1) {
  sectionStart = content.lastIndexOf("<section", headline);
  sectionEnd = content.indexOf("</section>", headline);
}

if (sectionStart === -1 || sectionEnd === -1) {
  throw new Error("Heycater Uploadbox nicht gefunden.");
}

sectionEnd = sectionEnd + "</section>".length;

const newBox = `
        <section className="heycaterUploadBox">
          <div className="heycaterUploadHeader">
            <div>
              <p>PDF Import</p>
              <h2>Heycater-Labels fuer Zebra vorbereiten</h2>
              <span>A4-PDF hochladen und in einzelne 76 x 51 mm Etiketten schneiden.</span>
            </div>
          </div>

          <form action="/foodlabels/heycater-pdf" method="post" encType="multipart/form-data" className="heycaterUploadForm">
            <label>
              PDF-Datei
              <input type="file" name="pdf" accept="application/pdf" required />
            </label>

            <label>
              Raster
              <select name="columns" defaultValue="3">
                <option value="3">3 Spalten</option>
                <option value="2">2 Spalten</option>
                <option value="1">1 Spalte</option>
              </select>
            </label>

            <label>
              Reihen
              <select name="rows" defaultValue="6">
                <option value="6">6 Reihen</option>
                <option value="5">5 Reihen</option>
                <option value="4">4 Reihen</option>
              </select>
            </label>

            <label>
              Etikett
              <select name="labelWidthMm" defaultValue="76">
                <option value="76">76 mm breit</option>
                <option value="70">70 mm breit</option>
                <option value="60">60 mm breit</option>
              </select>
            </label>

            <label>
              Hoehe
              <select name="labelHeightMm" defaultValue="51">
                <option value="51">51 mm hoch</option>
                <option value="50">50 mm hoch</option>
                <option value="38">38 mm hoch</option>
              </select>
            </label>

            <button type="submit">PDF erstellen</button>

            <input type="hidden" name="pageTopMm" value="0" />
            <input type="hidden" name="pageRightMm" value="0" />
            <input type="hidden" name="pageBottomMm" value="0" />
            <input type="hidden" name="pageLeftMm" value="0" />

            <input type="hidden" name="innerTopMm" value="1.5" />
            <input type="hidden" name="innerRightMm" value="1.5" />
            <input type="hidden" name="innerBottomMm" value="5" />
            <input type="hidden" name="innerLeftMm" value="1.5" />
          </form>

          <div className="heycaterUploadHint">
            Standard: 3 Spalten x 6 Reihen. Wenn ein Nachbarlabel sichtbar ist, erhoehen wir danach den Innenrand unten.
          </div>
        </section>
`;

content = content.slice(0, sectionStart) + newBox + content.slice(sectionEnd);

const marker = "/* heycater-upload-clean-v2 */";

if (!content.includes(marker)) {
  const css = `
      <style>{\`
        ${marker}

        .heycaterUploadBox {
          border: 1px solid #d9e4ea;
          background: #ffffff;
          border-radius: 12px;
          padding: 14px 16px;
          margin: 0 0 18px;
          box-shadow: none;
        }

        .heycaterUploadHeader {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }

        .heycaterUploadHeader p {
          margin: 0 0 4px;
          font-size: 10px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #047857;
        }

        .heycaterUploadHeader h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.2;
          font-weight: 600;
          color: #0f172a;
        }

        .heycaterUploadHeader span {
          display: block;
          margin-top: 4px;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 400;
          color: #64748b;
        }

        .heycaterUploadForm {
          display: grid;
          grid-template-columns: minmax(220px, 1.4fr) repeat(4, minmax(120px, .7fr)) auto;
          gap: 8px;
          align-items: end;
        }

        .heycaterUploadForm label {
          display: grid;
          gap: 5px;
          font-size: 11.5px;
          line-height: 1.2;
          font-weight: 600;
          color: #334155;
        }

        .heycaterUploadForm input,
        .heycaterUploadForm select {
          height: 34px;
          border: 1px solid #d6e2e8;
          border-radius: 7px;
          padding: 0 9px;
          background: #ffffff;
          color: #0f172a;
          font-size: 13px;
          font-weight: 400;
        }

        .heycaterUploadForm input[type="file"] {
          padding: 6px 9px;
        }

        .heycaterUploadForm button {
          height: 34px;
          border: 1px solid #047857;
          border-radius: 7px;
          padding: 0 13px;
          background: #059669;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: none;
        }

        .heycaterUploadHint {
          margin-top: 9px;
          padding: 8px 10px;
          border: 1px dashed #d6e2e8;
          border-radius: 8px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.35;
          background: #f8fafc;
        }

        @media (max-width: 1150px) {
          .heycaterUploadForm {
            grid-template-columns: 1fr 1fr;
          }

          .heycaterUploadForm button {
            width: 100%;
          }
        }
      \`}</style>
`;

  const insertAt = content.lastIndexOf("</AppLayout>");
  if (insertAt === -1) throw new Error("AppLayout Ende nicht gefunden.");

  content = content.slice(0, insertAt) + css + "\n    " + content.slice(insertAt);
}

fs.writeFileSync(path, content, "utf8");
console.log("Foodlabel Uploadbox ruhiger gestylt.");
