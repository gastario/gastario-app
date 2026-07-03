import { Form, useActionData } from "react-router";
import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Import pruefen - Gastario" }];
}


export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const file = formData.get("pdfFile");

  if (!(file instanceof File)) {
    return { error: "Bitte eine PDF-Datei hochladen." };
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Bitte nur PDF-Dateien hochladen." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pdfParseModule: any = await import("pdf-parse");
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const result = await pdfParse(buffer);

    const text = String(result.text || "").trim();

    if (!text) {
      return { error: "Aus dem PDF konnte kein Text gelesen werden. Eventuell ist es ein Scan/Bild-PDF." };
    }

    return {
      success: "PDF wurde gelesen.",
      fileName: file.name,
      preview: text.slice(0, 2500),
    };
  } catch (error) {
    console.error("PDF parse failed:", error);
    return { error: "PDF konnte nicht gelesen werden. Eventuell ist es ein Scan/Bild-PDF." };
  }
}

export default function ImportPruefenPage() {
  const actionData = useActionData<typeof action>() as any;
  return (
    <AppLayout>
      <div style={pageStyle}>
        <header>
          <p style={eyebrowStyle}>Import & Auftragserkennung</p>
          <h1 style={titleStyle}>Import pruefen</h1>
          <p style={subtitleStyle}>
            Hier laden wir im naechsten Schritt PDF-Auftraege hoch und pruefen sie gegen die Import-Regeln.
          </p>
        </header>

        {actionData?.error ? <div style={errorStyle}>{actionData.error}</div> : null}
        {actionData?.success ? <div style={successStyle}>{actionData.success}</div> : null}

        <section style={cardStyle}>
          <p style={eyebrowStyle}>PDF Upload</p>
          <h2 style={sectionTitleStyle}>PDF-Auftrag hochladen</h2>

          <Form method="post" encType="multipart/form-data" style={formStyle}>
            <label style={fieldStyle}>
              <span>PDF-Datei</span>
              <input type="file" name="pdfFile" accept="application/pdf,.pdf" required />
            </label>

            <button type="submit" style={primaryButtonStyle}>PDF pruefen</button>
          </Form>
        </section>

        {actionData?.preview ? (
          <section style={cardStyle}>
            <p style={eyebrowStyle}>Ausgelesener Text</p>
            <h2 style={sectionTitleStyle}>{actionData.fileName}</h2>
            <pre style={preStyle}>{actionData.preview}</pre>
          </section>
        ) : null}
      </div>
    </AppLayout>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#057a67",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  fontSize: 11,
  fontWeight: 750,
};

const titleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 34,
  letterSpacing: "-0.04em",
  fontWeight: 760,
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 15,
  fontWeight: 600,
  maxWidth: 820,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5eb",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.045)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "4px 0 8px",
  fontSize: 22,
  color: "#0f172a",
};

const textStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontWeight: 650,
};


const formStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "end",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 11,
  border: "1px solid #057a67",
  background: "#057a67",
  color: "#ffffff",
  padding: "0 16px",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(5, 122, 103, 0.16)",
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#9f1239",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
};

const successStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 14,
  padding: 14,
  fontWeight: 750,
};

const preStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 14,
  padding: 16,
  maxHeight: 420,
  overflow: "auto",
  fontSize: 12,
  lineHeight: 1.45,
};
