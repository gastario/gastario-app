import AppLayout from "../components/AppLayout";

export function meta() {
  return [
    { title: "Steuerberater-Export · Gastario" },
    {
      name: "description",
      content: "Monatsabschluss und Unterlagen fuer den Steuerberater vorbereiten.",
    },
  ];
}

export default function SteuerberaterExport() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Finanzen</p>
          <h1>Steuerberater-Export</h1>
          <span className="pageSubline">
            Rechnungen, offene Auftraege und Belege fuer den Monatsabschluss vorbereiten.
          </span>
        </div>
      </header>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Monatsabschluss</p>
            <h2>Export vorbereiten</h2>
          </div>
        </div>

        <div className="noteBox">
          <strong>Geplant</strong>
          <p>
            Hier sollen spaeter Rechnungen, Belege und offene Punkte gesammelt werden,
            damit der Steuerberater alles sauber bekommt.
          </p>
        </div>
      </section>
    </AppLayout>
  );
}
