import {
  Form,
  Link,
  useLoaderData,
  useNavigate,
} from "react-router";
import AppLayout from "../components/AppLayout";
import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioBadge,
  GastarioFilterBar,
  GastarioField,
  GastarioInput,
  GastarioSelect,
  GastarioButton,
  GastarioEmptyState,
  GastarioDataList,
  GastarioDataRow,
  GastarioToolbar,
  gastarioButtonClass,
} from "../components/ui";

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
  const navigate = useNavigate();

  return (
    <AppLayout>
      <GastarioPage>

        <GastarioHeader
          eyebrow="Verkauf"
          title="Angebote"
          subtitle={
            <>
              {data.tenant?.name || "Kein Mandant"} · Angebote erstellen,
              versenden und nach Bestätigung in Aufträge überführen.
            </>
          }
          actions={
            <Link
              to="/angebote/neu"
              className={gastarioButtonClass("primary")}
            >
              Neues Angebot
            </Link>
          }
        />

        {data.setupError ? (
          <GastarioNotice type="warning">
            {data.setupError}
          </GastarioNotice>
        ) : null}

        <GastarioMetricGrid>

          <GastarioMetric
            label="Angebote gesamt"
            value={data.stats.total}
            description="Im Mandanten"
            badge="Gesamt"
          />

          <GastarioMetric
            label="Entwürfe"
            value={data.stats.drafts}
            description="Noch nicht versendet"
            badge="Offen"
          />

          <GastarioMetric
            label="In Klärung"
            value={data.stats.active}
            description="Versendet oder Rückmeldung offen"
            badge="Aktiv"
          />

          <GastarioMetric
            label="Angebotswert"
            value={centsToEuro(data.stats.totalValueCents)}
            description={`${data.stats.confirmed} bestätigt`}
            badge="EUR"
          />

        </GastarioMetricGrid>


        <GastarioSection
          eyebrow="Angebotsübersicht"
          title="Aktuelle Angebote"
          description="Angebote erstellen, prüfen und weiterbearbeiten."
          action={
            <GastarioBadge variant="neutral">
              {data.quotes.length === 1
                ? "1 Angebot"
                : `${data.quotes.length} Angebote`}
            </GastarioBadge>
          }
        >

          <Form method="get">

            <GastarioFilterBar
              actions={
                <>
                  <GastarioButton
                    type="submit"
                    variant="primary"
                  >
                    Anzeigen
                  </GastarioButton>

                  <Link
                    to="/angebote"
                    className={gastarioButtonClass("secondary")}
                  >
                    Zurücksetzen
                  </Link>
                </>
              }
            >

              <GastarioField label="Suche">
                <GastarioInput
                  type="search"
                  name="q"
                  defaultValue={data.searchQuery}
                  placeholder="Nummer, Kunde oder Veranstaltung"
                />
              </GastarioField>

              <GastarioField label="Status">
                <GastarioSelect
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
                </GastarioSelect>
              </GastarioField>

            </GastarioFilterBar>

          </Form>


          {data.quotes.length === 0 ? (

            <GastarioEmptyState title="Noch keine passenden Angebote vorhanden">

              Lege ein neues Angebot an oder setze die Filter zurück.

              <GastarioToolbar align="start">
                <Link
                  to="/angebote/neu"
                  className={gastarioButtonClass("primary")}
                >
                  Erstes Angebot anlegen
                </Link>
              </GastarioToolbar>

            </GastarioEmptyState>

          ) : (

            <GastarioDataList>

              {data.quotes.map((quote: any) => (

                <GastarioDataRow
                      key={quote.id}
                      onClick={() =>
                        navigate(
                          `/angebote/${quote.id}`
                        )
                      }
                    >

                  <div className="g-ui-data-row-main">

                    <span className="g-ui-data-row-description">
                      {quote.quoteNumber}
                    </span>

                    <strong className="g-ui-data-row-title">
                      {quote.customerName}
                    </strong>

                    <span className="g-ui-data-row-description">
                      {quote.eventName ||
                        "Keine Veranstaltung angegeben"}
                    </span>

                    <span className="g-ui-data-row-description">
                      {quote.items.length === 1
                        ? "1 Position"
                        : `${quote.items.length} Positionen`}
                      {" · "}
                      {formatDate(quote.eventDate)}
                      {" · "}
                      {nextStep(quote.status)}
                    </span>

                  </div>


                  <div className="g-ui-data-row-meta">

                    <GastarioBadge variant="neutral">
                      {statusLabel(quote.status)}
                    </GastarioBadge>

                    <strong>
                      {centsToEuro(quote.totalCents)}
                    </strong>

                  </div>


                  <div className="g-ui-data-row-actions">

                    <Link
                      to={`/angebote/${quote.id}`}
                      className={gastarioButtonClass("secondary")}
                    >
                      Öffnen
                    </Link>

                  </div>


                  <span
                    className="g-ui-data-row-chevron"
                    aria-hidden="true"
                  >
                    →
                  </span>

                </GastarioDataRow>

              ))}

            </GastarioDataList>

          )}

        </GastarioSection>

      </GastarioPage>
    </AppLayout>
  );
}
