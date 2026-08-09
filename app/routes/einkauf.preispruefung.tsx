import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-page-shell.css";
import "../styles/gastario-procurement-search.css";

type ActionData = {
  error?: string;
};

function cleanId(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function formatMoney(
  cents: number | null | undefined
) {
  if (cents == null) {
    return "–";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
}

function formatDateTime(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "–";
  }

  return new Date(value).toLocaleString(
    "de-DE"
  );
}

export function meta() {
  return [
    {
      title:
        "Preisprüfung · Gastario",
    },
  ];
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const url = new URL(request.url);
  const showRejected =
    url.searchParams.get("rejected") === "1";

  const [
    suspiciousPrices,
    suspiciousCount,
    rejectedCount,
  ] = await Promise.all([
    prisma.supplierPriceSnapshot.findMany({
      where: {
        tenantId: access.tenantId,
        qualityStatus: showRejected
          ? "REJECTED"
          : "SUSPICIOUS",
      },
      include: {
        catalogItem: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        fetchedAt: "desc",
      },
      take: 100,
    }),

    prisma.supplierPriceSnapshot.count({
      where: {
        tenantId: access.tenantId,
        qualityStatus: "SUSPICIOUS",
      },
    }),

    prisma.supplierPriceSnapshot.count({
      where: {
        tenantId: access.tenantId,
        qualityStatus: "REJECTED",
      },
    }),
  ]);

  return {
    tenant: {
      name: access.tenant.name,
    },
    showRejected,
    suspiciousCount,
    rejectedCount,
    prices: suspiciousPrices,
  };
}

export async function action({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const formData = await request.formData();

  const intent = cleanId(
    formData.get("intent")
  );

  const id = cleanId(
    formData.get("id")
  );

  if (!id) {
    return {
      error:
        "Der Preisdatensatz wurde nicht gefunden.",
    } satisfies ActionData;
  }

  const price =
    await prisma.supplierPriceSnapshot.findFirst({
      where: {
        id,
        tenantId: access.tenantId,
      },
    });

  if (!price) {
    return {
      error:
        "Der Preisdatensatz existiert nicht mehr.",
    } satisfies ActionData;
  }

  if (intent === "approve") {
    await prisma.supplierPriceSnapshot.update({
      where: {
        id: price.id,
      },
      data: {
        qualityStatus: "VALID",
        qualityReason:
          "Manuell als plausibel bestätigt.",
        qualityCheckedAt: new Date(),
      },
    });

    return redirect(
      "/einkauf/preispruefung?approved=1"
    );
  }

  if (intent === "reject") {
    await prisma.supplierPriceSnapshot.update({
      where: {
        id: price.id,
      },
      data: {
        qualityStatus: "REJECTED",
        qualityReason:
          price.qualityReason ||
          "Manuell als fehlerhaft verworfen.",
        qualityCheckedAt: new Date(),
      },
    });

    return redirect(
      "/einkauf/preispruefung?rejectedPrice=1"
    );
  }

  if (intent === "restore") {
    await prisma.supplierPriceSnapshot.update({
      where: {
        id: price.id,
      },
      data: {
        qualityStatus: "SUSPICIOUS",
        qualityReason:
          price.qualityReason ||
          "Zur erneuten Prüfung zurückgestellt.",
        qualityCheckedAt: new Date(),
      },
    });

    return redirect(
      "/einkauf/preispruefung?restored=1"
    );
  }

  return {
    error:
      "Unbekannte Aktion.",
  } satisfies ActionData;
}

export default function SupplierPriceReviewPage() {
  const data = useLoaderData<typeof loader>();
  const actionData =
    useActionData<typeof action>();

  return (
    <AppLayout>
      <PageShell className="procurementSearchPage">
        <PageHeader
          eyebrow="Einkauf & Lieferanten"
          title="Preisprüfung"
          subtitle={`Prüfe auffällige Lieferantenpreise von ${data.tenant.name}, bevor sie in Einkauf und Produktdaten übernommen werden.`}
          actions={
            <>
              <Link
                className="procurementSearchButton procurementSearchButton--secondary"
                to="/einkauf/artikelsuche"
              >
                Zur Artikelsuche
              </Link>

              <Link
                className="procurementSearchButton procurementSearchButton--secondary"
                to="/einkauf"
              >
                Zur Einkaufsplanung
              </Link>
            </>
          }
        />

        {actionData?.error ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        <section className="supplierPriceReviewMetrics">
          <div className="supplierAliasMetric">
            <span>Offen zur Prüfung</span>
            <strong>
              {data.suspiciousCount}
            </strong>
          </div>

          <div className="supplierAliasMetric">
            <span>Verworfen</span>
            <strong>
              {data.rejectedCount}
            </strong>
          </div>
        </section>

        <PageSection
          eyebrow="Preisqualität"
          title={
            data.showRejected
              ? "Verworfene Preise"
              : "Auffällige Preise"
          }
          description={
            data.showRejected
              ? "Diese Preise werden von Gastario nicht mehr für Preisvergleich oder Produktübernahme verwendet."
              : "Gastario verwendet bei auffälligen Preisen automatisch den letzten plausiblen Preis. Bestätigen spätere plausible Preisimporte den Ausreißer, kann Gastario ihn automatisch verwerfen. Du kannst hier jederzeit manuell bestätigen oder eingreifen."
          }
        >
          <div className="supplierPriceReviewTabs">
            <Link
              className={`procurementSearchButton ${
                data.showRejected
                  ? "procurementSearchButton--secondary"
                  : ""
              }`}
              to="/einkauf/preispruefung"
            >
              Offen ({data.suspiciousCount})
            </Link>

            <Link
              className={`procurementSearchButton ${
                data.showRejected
                  ? ""
                  : "procurementSearchButton--secondary"
              }`}
              to="/einkauf/preispruefung?rejected=1"
            >
              Verworfen ({data.rejectedCount})
            </Link>
          </div>

          {data.prices.length === 0 ? (
            <div className="supplierAliasEmpty">
              {data.showRejected
                ? "Keine verworfenen Preise vorhanden."
                : "Aktuell gibt es keine auffälligen Preise."}
            </div>
          ) : (
            <div className="supplierPriceReviewList">
              {data.prices.map(
                (price: any) => (
                  <article
                    className="supplierPriceReviewCard"
                    key={price.id}
                  >
                    <div className="supplierPriceReviewIdentity">
                      <span className="supplierAliasEyebrow">
                        {price.catalogItem
                          ?.supplier?.name ||
                          "Lieferant"}
                      </span>

                      <strong>
                        {price.catalogItem?.name ||
                          "Lieferantenartikel"}
                      </strong>

                      <small>
                        Art.-Nr.{" "}
                        {price.catalogItem
                          ?.articleNumber ||
                          price.catalogItem
                            ?.externalId ||
                          "–"}
                      </small>
                    </div>

                    <div className="supplierPriceReviewPrice">
                      <span>Importierter Preis</span>
                      <strong>
                        {formatMoney(
                          price.netPriceCents
                        )}
                      </strong>
                      <small>
                        {price.priceUnit ||
                          "Einheit"}
                      </small>
                    </div>

                    <div className="supplierPriceReviewReference">
                      <span>Referenz</span>
                      <strong>
                        {formatMoney(
                          price.referencePriceCents
                        )}
                      </strong>
                      <small>
                        {price.priceRatio != null
                          ? `Faktor ${Number(
                              price.priceRatio
                            ).toFixed(2)}`
                          : "Keine Referenz"}
                      </small>
                    </div>

                    <div className="supplierPriceReviewReason">
                      <span>Prüfgrund</span>
                      <strong>
                        {price.qualityReason ||
                          "Automatisch auffällig erkannt"}
                      </strong>
                      <small>
                        Import:{" "}
                        {formatDateTime(
                          price.fetchedAt
                        )}
                      </small>
                    </div>

                    <div className="supplierPriceReviewActions">
                      {data.showRejected ? (
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="restore"
                          />
                          <input
                            type="hidden"
                            name="id"
                            value={price.id}
                          />

                          <button
                            type="submit"
                            className="procurementSearchButton procurementSearchButton--secondary"
                          >
                            Erneut prüfen
                          </button>
                        </Form>
                      ) : (
                        <>
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="approve"
                            />
                            <input
                              type="hidden"
                              name="id"
                              value={price.id}
                            />

                            <button
                              type="submit"
                              className="procurementSearchButton"
                            >
                              Preis bestätigen
                            </button>
                          </Form>

                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="reject"
                            />
                            <input
                              type="hidden"
                              name="id"
                              value={price.id}
                            />

                            <button
                              type="submit"
                              className="procurementSearchButton procurementSearchButton--secondary"
                            >
                              Verwerfen
                            </button>
                          </Form>
                        </>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}