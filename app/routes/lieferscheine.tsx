import AppLayout from "../components/AppLayout";

const deliveryNotes = [
  {
    number: "LS-2026-1001",
    order: "GA-1001",
    customer: "Muster GmbH",
    delivery: "29.06.2026 · 11:30 Uhr",
    address: "Musterstraße 12, 10115 Berlin",
    items: "80 Bowls, 80 Bestecksets, 4 Thermoboxen",
    status: "Bereit",
    signature: "offen",
  },
  {
    number: "LS-2026-1002",
    order: "GA-1002",
    customer: "ABC Consulting",
    delivery: "29.06.2026 · 12:15 Uhr",
    address: "Friedrichstraße 88, 10117 Berlin",
    items: "45 Frühstücksboxen, 2 Thermoboxen, 1 Kaffeekanne",
    status: "Erstellt",
    signature: "offen",
  },
  {
    number: "LS-2026-1003",
    order: "GA-1003",
    customer: "Eventagentur Berlin",
    delivery: "29.06.2026 · 16:00 Uhr",
    address: "Köpenicker Straße 40, 10997 Berlin",
    items: "8 Fingerfood-Platten, 6 Dips, 2 Chafing Dishes",
    status: "Entwurf",
    signature: "nicht nötig",
  },
];

const documentChecks = [
  "Kunden-Lieferschein erzeugt",
  "Fahrerzettel intern vorbereitet",
  "Produkte und Mengen geprüft",
  "Equipment auf Rückholung prüfen",
  "Unterschriftsfeld vorhanden",
];

const statusClass: Record<string, string> = {
  Bereit: "success",
  Erstellt: "info",
  Entwurf: "warning",
};

export function meta() {
  return [{ title: "Lieferscheine · Gastario" }];
}

export default function DeliveryNotesPage() {
  return (
    <AppLayout>
      <header className="topbar">
        <div>
          <p className="eyebrow">Betrieb</p>
          <h1>Lieferscheine</h1>
          <span className="pageSubline">
            Kunden-Lieferscheine und interne Fahrerzettel mit Produkten, Mengen und Equipment.
          </span>
        </div>

        <div className="topActions">
          <button className="secondaryButton">Alle PDF</button>
          <button className="primaryButton">Lieferschein erstellen</button>
        </div>
      </header>

      <section className="orderSummaryGrid">
        <article className="metricCard">
          <div>
            <p>Lieferscheine heute</p>
            <strong>3</strong>
            <span>für geplante Lieferungen</span>
          </div>
          <small data-trend="aktiv">aktiv</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Unterschriften offen</p>
            <strong>2</strong>
            <span>bei Übergabe einholen</span>
          </div>
          <small data-trend="prüfen">prüfen</small>
        </article>

        <article className="metricCard">
          <div>
            <p>Equipment enthalten</p>
            <strong>9</strong>
            <span>Rückholung beachten</span>
          </div>
          <small data-trend="kritisch">prüfen</small>
        </article>
      </section>

      <section className="mainGrid">
        <article className="panel schedulePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Dokumente</p>
              <h2>Aktuelle Lieferscheine</h2>
            </div>
            <button className="ghostButton">Druckansicht</button>
          </div>

          <div className="deliveryNoteList">
            {deliveryNotes.map((note) => (
              <article className="deliveryNoteCard" key={note.number}>
                <div className="deliveryNoteHeader">
                  <div>
                    <strong>{note.number} · {note.customer}</strong>
                    <span>{note.order} · {note.delivery}</span>
                  </div>
                  <em className={statusClass[note.status] ?? "success"}>{note.status}</em>
                </div>

                <div className="deliveryNoteDetails">
                  <p>
                    <b>Adresse</b>
                    <span>{note.address}</span>
                  </p>
                  <p>
                    <b>Positionen</b>
                    <span>{note.items}</span>
                  </p>
                  <p>
                    <b>Unterschrift</b>
                    <span>{note.signature}</span>
                  </p>
                </div>

                <div className="documentActions">
                  <button className="ghostButton">PDF öffnen</button>
                  <button className="ghostButton">Fahrerzettel</button>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="sideStack">
          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Prüfung</p>
                <h2>Dokumente</h2>
              </div>
            </div>

            <div className="taskList">
              {documentChecks.map((item) => (
                <label key={item}>
                  <input type="checkbox" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelHeader compact">
              <div>
                <p className="eyebrow">Hinweis</p>
                <h2>Kunde vs. Fahrer</h2>
              </div>
            </div>

            <div className="noteBox">
              <strong>Zwei Dokumente</strong>
              <p>
                Der Kunde erhält den Lieferschein mit Produkten und Mengen. Der Fahrerzettel enthält zusätzlich Telefon,
                Parkhinweis, Etage, interne Notizen und Equipment-Rückholung.
              </p>
            </div>
          </article>
        </aside>
      </section>
    </AppLayout>
  );
}
