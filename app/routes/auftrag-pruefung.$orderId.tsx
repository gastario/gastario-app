import { Link, useParams } from "react-router";

export function meta() {
  return [{ title: "Auftragsprüfung - Gastario" }];
}

export default function AuftragPruefungPage() {
  const params = useParams();

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1>Auftragsprüfung</h1>
      <p>Prüf-PDF-Seite ist vorbereitet.</p>
      <p>Auftrag-ID: {params.orderId}</p>
      <Link to="/auftragseingang">Zurück zum Auftragseingang</Link>
    </main>
  );
}
