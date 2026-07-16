import {
  Form,
  Link,
  useLoaderData,
} from "react-router";
import AppLayout from "../components/AppLayout";
import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import "../styles/produkte.css";
import "../styles/angebote.css";

const STATUS_OPTIONS = [
  { value: "", label: "Alle Status" },
  { value: "DRAFT", label: "Entwurf" },
  { value: "SENT", label: "Versendet" },
  { value: "WAITING", label: "Wartet auf Rückmeldung" },
  { value: "CONFIRMED", label: "Bestätigt" },
  { value: "REJECTED", label: "Abgelehnt" },
  { value: "EXPIRED", label: "Abgelaufen" },
];

function centsToEuro(value: number | null | undefined) {
  return ((value || 0) / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Nicht festgelegt";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nicht festgelegt";
  }

  return date.toLocaleDateString("de-DE");
}

function statusLabel(status: string) {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ||
    status
  );
}

function statusClass(status: string) {
  if (status === "CONFIRMED") {
    return "quoteStatus quoteStatus--confirmed";
  }

  if (status === "SENT") {
    return "quoteStatus quoteStatus--sent";
  }

  if (status === "DRAFT") {
    return "quoteStatus quoteStatus--draft";
  }

  if (status === "REJECTED" || status === "EXPIRED") {
    return "quoteStatus quoteStatus--rejected";
  }

  return "quoteStatus quoteStatus--waiting";
}

function nextStep(status: string) {
  if (status === "DRAFT") return "Angebot prüfen und versenden";
  if (status === "SENT") return "Rückmeldung abwarten";
  if (status === "WAITING") return "Kundenentscheidung offen";
  if (status === "CONFIRMED") return "In Auftrag übernehmen";
  if (status === "REJECTED") return "Keine weitere Bearbeitung";
  if (status === "EXPIRED") return "Gültigkeit prüfen";

  return "Angebot bearbeiten";
}

export function meta() {
  return [{ title: "Angebote · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import(
    "../lib/features.server"
  );

  const access = await getTenantAccess(request);
  const url = new URL(request.url);

  const searchQuery =
    url.searchParams.get("q")?.trim() || "";

  const activeStatus =
    url.searchParams.get("status")?.trim() || "";

  if (!access.tenantId || !access.tenant) {
    return {
      tenant: null,
      setupError:
        access.setupError || "Kein Mandant gefunden.",
      quotes: [],
      searchQuery,
      activeStatus,
      stats: {
        total: 0,
        drafts: 0,
        active: 0,
        confirmed: 0,
        totalValueCents: 0,
      },
    };
  }

  const where: any = {
    tenantId: access.tenantId,
  };

  if (activeStatus) {
    where.status = activeStatus;
  }

  if (searchQuery) {
    where.OR = [
      {
        quoteNumber: {
          contains: searchQuery,
          mode: "insensitive",
        },
      },
      {
        customerName: {
          contains: searchQuery,
          mode: "insensitive",
        },
      },
      {
        eventName: {
          contains: searchQuery,
          mode: "insensitive",
        },
      },
      {
        contactName: {
          contains: searchQuery,
          mode: "insensitive",
        },
      },
    ];
  }

  const [quotes, allQuotes] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        customer: true,
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
    }),

    prisma.quote.findMany({
      where: {
        tenantId: access.tenantId,
      },
      select: {
        status: true,
        totalCents: true,
      },
    }),
  ]);

  const stats = {
    total: allQuotes.length,
    drafts: allQuotes.filter(
      (quote: any) => quote.status === "DRAFT"
    ).length,
    active: allQuotes.filter((quote: any) =>
      ["SENT", "WAITING"].includes(quote.status)
    ).length,
    confirmed: allQuotes.filter(
      (quote: any) => quote.status === "CONFIRMED"
    ).length,
    totalValueCents: allQuotes.reduce(
      (total: number, quote: any) =>
        total + Number(quote.totalCents || 0),
      0
    ),
  };

  return {
    tenant: access.tenant,
    setupError: access.setupError,
    quotes,
    searchQuery,
    activeStatus,
    stats,
  };
}

export default function QuotesPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PageShell className="productsPage quotesPage">
        <PageHeader
          eyebrow="Verkauf"
          title="Angebote"
          subtitle={
            <>
              {data.tenant?.name || "Kein Mandant"} · Angebote
              erstellen, versenden und nach Bestätigung in Aufträge
              überführen.
            </>
          }
          actions={
            <Link
              to="/angebote/neu"
              className="productsPrimaryButton g-ui-button g-ui-button--primary"
            >
              Neues Angebot
            </Link>
          }
        />

        {data.setupError ? (
          <Notice type="warning">
            {data.setupError}
          </Notice>
        ) : null}

        <MetricGrid>
          <MetricCard
            label="Angebote gesamt"
            value={data.stats.total}
            description="im Mandanten"
            badge="Gesamt"
          />

          <MetricCard
            label="Entwürfe"
            value={data.stats.drafts}
            description="noch nicht versendet"
            badge="Offen"
          />

          <MetricCard
            label="In Klärung"
            value={data.stats.active}
            description="versendet oder Rückmeldung offen"
            badge="Aktiv"
          />

          <MetricCard
            label="Angebotswert"
            value={centsToEuro(data.stats.totalValueCents)}
            description={`${data.stats.confirmed} bestätigt`}
            badge="EUR"
          />
        </MetricGrid>

        <PageSection
          className="productsWorkspace quotesListSection"
          eyebrow="Angebotsübersicht"
          title="Aktuelle Angebote"
          description={
            data.quotes.length === 1
              ? "1 Angebot in dieser Ansicht"
              : `${data.quotes.length} Angebote in dieser Ansicht`
          }
        >
          <Form
            method="get"
            className="productsFilters quotesFilterBar"
          >
            <label className="productsSearchField quotesSearchField">
              <span>Suche</span>
              <input
                type="search"
                name="q"
                defaultValue={data.searchQuery}
                placeholder="Nummer, Kunde oder Veranstaltung"
              />
            </label>

            <label className="productsFilterField">
              <span>Status</span>
              <select
                name="status"
                defaultValue={data.activeStatus}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option
                    key={option.value || "all"}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="productsPrimaryButton g-ui-button g-ui-button--primary"
            >
              Anzeigen
            </button>

            <Link
              to="/angebote"
              className="productsSecondaryButton g-ui-button g-ui-button--secondary"
            >
              Zurücksetzen
            </Link>
          </Form>

          {data.quotes.length === 0 ? (
            <div className="productsEmptyState quotesEmptyState">
              <div
                className="productsEmptyIcon quoteIcon"
                aria-hidden="true"
              >
                A
              </div>

              <strong>
                Noch keine passenden Angebote vorhanden
              </strong>

              <span>
                Lege ein neues Angebot an oder setze die Filter
                zurück.
              </span>

              <Link
                to="/angebote/neu"
                className="productsPrimaryButton g-ui-button g-ui-button--primary"
              >
                Erstes Angebot anlegen
              </Link>
            </div>
          ) : (
            <div className="quotesList">
              {data.quotes.map((quote: any) => (
                <article
                  className="quoteCard"
                  key={quote.id}
                >
                  <div className="quoteIdentity">
                    <div
                      className="productsEmptyIcon quoteIcon"
                      aria-hidden="true"
                    >
                      A
                    </div>

                    <div className="quoteIdentityText">
                      <div className="quoteNumber">
                        {quote.quoteNumber}
                      </div>

                      <h3>{quote.customerName}</h3>

                      <p>
                        {quote.eventName ||
                          "Keine Veranstaltung angegeben"}
                      </p>

                      <span>
                        {quote.items.length === 1
                          ? "1 Position"
                          : `${quote.items.length} Positionen`}
                      </span>
                    </div>
                  </div>

                  <div className="quoteDetails">
                    <div>
                      <span>Veranstaltung</span>
                      <strong>
                        {quote.eventName || "Nicht angegeben"}
                      </strong>
                    </div>

                    <div>
                      <span>Datum</span>
                      <strong>
                        {formatDate(quote.eventDate)}
                      </strong>
                    </div>

                    <div>
                      <span>Nächster Schritt</span>
                      <strong>
                        {nextStep(quote.status)}
                      </strong>
                    </div>
                  </div>

                  <div className="quoteCommercial">
                    <em className={statusClass(quote.status)}>
                      {statusLabel(quote.status)}
                    </em>

                    <strong>
                      {centsToEuro(quote.totalCents)}
                    </strong>

                    <Link
                      to={`/angebote/${quote.id}`}
                      className="productsSecondaryButton g-ui-button g-ui-button--secondary"
                    >
                      Öffnen
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}
