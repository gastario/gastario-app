import AppLayout from "../components/AppLayout";
import {
  MetricCard,
  MetricGrid,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import "../styles/angebote.css";

type QuoteStatus =
  | "Entwurf"
  | "Versendet"
  | "Bestätigt"
  | "Wartet auf Rückmeldung";

type Quote = {
  number: string;
  customer: string;
  event: string;
  date: string;
  persons: string;
  status: QuoteStatus;
  valueCents: number;
  nextStep: string;
};

const quotes: Quote[] = [
  {
    number: "AN-2026-0041",
    customer: "Muster GmbH",
    event: "Office Lunch",
    date: "02.07.2026",
    persons: "80 Personen",
    status: "Versendet",
    valueCents: 128000,
    nextStep: "Rückmeldung abwarten",
  },
  {
    number: "AN-2026-0042",
    customer: "Eventagentur Berlin",
    event: "Fingerfood-Empfang",
    date: "05.07.2026",
    persons: "120 Personen",
    status: "Entwurf",
    valueCents: 218000,
    nextStep: "Positionen prüfen",
  },
  {
    number: "AN-2026-0043",
    customer: "ABC Consulting",
    event: "Frühstück",
    date: "08.07.2026",
    persons: "45 Personen",
    status: "Bestätigt",
    valueCents: 76500,
    nextStep: "Auftrag erstellen",
  },
  {
    number: "AN-2026-0044",
    customer: "Müller & Partner",
    event: "Meeting-Catering",
    date: "10.07.2026",
    persons: "35 Personen",
    status: "Wartet auf Rückmeldung",
    valueCents: 94000,
    nextStep: "Kundenentscheidung offen",
  },
];

function centsToEuro(value: number) {
  return (value / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function statusClass(status: QuoteStatus) {
  if (status === "Bestätigt") {
    return "quoteStatus quoteStatus--confirmed";
  }

  if (status === "Versendet") {
    return "quoteStatus quoteStatus--sent";
  }

  if (status === "Entwurf") {
    return "quoteStatus quoteStatus--draft";
  }

  return "quoteStatus quoteStatus--waiting";
}

export function meta() {
  return [{ title: "Angebote · Gastario" }];
}

export default function QuotesPage() {
  const draftCount = quotes.filter(
    (quote) => quote.status === "Entwurf"
  ).length;

  const sentCount = quotes.filter(
    (quote) =>
      quote.status === "Versendet" ||
      quote.status === "Wartet auf Rückmeldung"
  ).length;

  const confirmedCount = quotes.filter(
    (quote) => quote.status === "Bestätigt"
  ).length;

  const totalValueCents = quotes.reduce(
    (total, quote) => total + quote.valueCents,
    0
  );

  return (
    <AppLayout>
      <PageShell className="quotesPage">
        <PageHeader
          eyebrow="Verkauf"
          title="Angebote"
          subtitle={
            <>
              Angebote erstellen, versenden, nachverfolgen und nach
              Bestätigung in Aufträge überführen.
            </>
          }
          actions={
            <>
              <button
                type="button"
                className="g-ui-button g-ui-button--secondary"
              >
                Vorlagen
              </button>

              <button
                type="button"
                className="g-ui-button g-ui-button--primary"
              >
                Neues Angebot
              </button>
            </>
          }
        />

        <MetricGrid>
          <MetricCard
            label="Angebote gesamt"
            value={quotes.length}
            description="in dieser Übersicht"
            badge="Gesamt"
          />

          <MetricCard
            label="Entwürfe"
            value={draftCount}
            description="noch nicht versendet"
            badge="Offen"
          />

          <MetricCard
            label="In Klärung"
            value={sentCount}
            description="versendet oder Rückmeldung offen"
            badge="Aktiv"
          />

          <MetricCard
            label="Angebotswert"
            value={centsToEuro(totalValueCents)}
            description={`${confirmedCount} bestätigt`}
            badge="EUR"
          />
        </MetricGrid>

        <PageSection
          className="quotesListSection"
          eyebrow="Angebotsübersicht"
          title="Aktuelle Angebote"
          description={`${quotes.length} Angebote im System`}
        >
          <div className="quotesFilterBar">
            <label className="g-ui-field quotesSearchField">
              <span>Suche</span>
              <input
                type="search"
                placeholder="Nummer, Kunde oder Veranstaltung"
              />
            </label>

            <label className="g-ui-field">
              <span>Status</span>
              <select defaultValue="">
                <option value="">Alle Status</option>
                <option value="DRAFT">Entwurf</option>
                <option value="SENT">Versendet</option>
                <option value="WAITING">
                  Wartet auf Rückmeldung
                </option>
                <option value="CONFIRMED">Bestätigt</option>
              </select>
            </label>

            <button
              type="button"
              className="g-ui-button g-ui-button--primary"
            >
              Anzeigen
            </button>

            <button
              type="button"
              className="g-ui-button g-ui-button--secondary"
            >
              Zurücksetzen
            </button>
          </div>

          <div className="quotesList">
            {quotes.map((quote) => (
              <article
                className="quoteCard"
                key={quote.number}
              >
                <div className="quoteIdentity">
                  <div className="quoteIcon" aria-hidden="true">
                    A
                  </div>

                  <div className="quoteIdentityText">
                    <div className="quoteNumber">
                      {quote.number}
                    </div>

                    <h3>{quote.customer}</h3>

                    <p>{quote.event}</p>

                    <span>{quote.persons}</span>
                  </div>
                </div>

                <div className="quoteDetails">
                  <div>
                    <span>Veranstaltung</span>
                    <strong>{quote.event}</strong>
                  </div>

                  <div>
                    <span>Datum</span>
                    <strong>{quote.date}</strong>
                  </div>

                  <div>
                    <span>Nächster Schritt</span>
                    <strong>{quote.nextStep}</strong>
                  </div>
                </div>

                <div className="quoteCommercial">
                  <em className={statusClass(quote.status)}>
                    {quote.status}
                  </em>

                  <strong>
                    {centsToEuro(quote.valueCents)}
                  </strong>

                  <button
                    type="button"
                    className="g-ui-button g-ui-button--secondary"
                  >
                    Öffnen
                  </button>
                </div>
              </article>
            ))}
          </div>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}