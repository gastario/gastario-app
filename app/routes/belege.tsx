import AppLayout from "../components/AppLayout";

export function meta() {
  return [
    { title: "Belege · Gastario" },
    {
      name: "description",
      content: "Belege hochladen, pruefen und fuer den Steuerberater vorbereiten.",
    },
  ];
}

export default function Belege() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Finanzen</p>
          <h1>Belege</h1>
          <span className="pageSubline">
            Einkaufbelege, Quittungen und Lieferantenrechnungen sammeln und vorbereiten.
          </span>
        </div>
      </header>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Belegscan</p>
            <h2>Belege hochladen</h2>
          </div>
        </div>

        <div className="noteBox">
          <strong>Naechster Ausbauschritt</strong>
          <p>
            Hier sollen spaeter Belege hochgeladen, automatisch ausgelesen, kategorisiert
            und fuer den Steuerberater vorbereitet werden.
          </p>
        </div>
      </section>
    </AppLayout>
  );
}
