import AppLayout from "../components/AppLayout";

export function meta() {
  return [{ title: "Import pruefen - Gastario" }];
}

export default function ImportPruefenPage() {
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

        <section style={cardStyle}>
          <p style={eyebrowStyle}>PDF Upload</p>
          <h2 style={sectionTitleStyle}>PDF-Auftrag hochladen</h2>
          <p style={textStyle}>
            Die Seite ist vorbereitet. Im naechsten Schritt bauen wir den echten PDF-Upload ein.
          </p>
        </section>
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
