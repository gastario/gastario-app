import { useState } from "react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  GastarioPage,
  GastarioHeader,
  GastarioNotice,
  gastarioButtonClass,
  GastarioMetricGrid,
  GastarioMetric,
  GastarioSection,
  GastarioToolbar,
  GastarioEmptyState,
  GastarioDataList,
  GastarioDataRow,
  GastarioDetailDialog,
  GastarioDetailTabs,
  GastarioDetailPane,
} from "../components/ui";


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

  const [selectedPriceId, setSelectedPriceId] =
    useState<string | null>(null);

  const [priceDetailTab, setPriceDetailTab] =
    useState("overview");

  const selectedPrice =
    data.prices.find(
      (price: any) =>
        price.id === selectedPriceId
    ) || null;

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Einkauf & Lieferanten"
          title="Preisprüfung"
          description={`Prüfe auffällige Lieferantenpreise von ${data.tenant.name}, bevor sie in Einkauf und Produktdaten übernommen werden.`}
          actions={
            <>
              <Link
                className={gastarioButtonClass("secondary")}
                to="/einkauf/artikelsuche"
              >
                Zur Artikelsuche
              </Link>

              <Link
                className={gastarioButtonClass("secondary")}
                to="/einkauf"
              >
                Zur Einkaufsplanung
              </Link>
            </>
          }
        />

        {actionData?.error ? (
          <GastarioNotice type="danger">
            {actionData.error}
          </GastarioNotice>
        ) : null}

        <GastarioMetricGrid>
          <GastarioMetric
            label="Offen zur Prüfung"
            value={data.suspiciousCount}
            description="auffällige Preise"
          />

          <GastarioMetric
            label="Verworfen"
            value={data.rejectedCount}
            description="nicht mehr verwendete Preise"
          />
        </GastarioMetricGrid>

        <GastarioSection
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
          <GastarioToolbar>
            <Link
              className={gastarioButtonClass(
                data.showRejected
                  ? "secondary"
                  : "primary"
              )}
              to="/einkauf/preispruefung"
            >
              Offen ({data.suspiciousCount})
            </Link>

            <Link
              className={gastarioButtonClass(
                data.showRejected
                  ? "primary"
                  : "secondary"
              )}
              to="/einkauf/preispruefung?rejected=1"
            >
              Verworfen ({data.rejectedCount})
            </Link>
          </GastarioToolbar>

          {data.prices.length === 0 ? (
            <GastarioEmptyState
              title={
                data.showRejected
                  ? "Keine verworfenen Preise"
                  : "Keine auffälligen Preise"
              }
            >
              {data.showRejected
                ? "Es sind aktuell keine verworfenen Preise vorhanden."
                : "Aktuell gibt es keine auffälligen Preise zur Prüfung."}
            </GastarioEmptyState>
          ) : (
            <>
              <GastarioDataList>
                {data.prices.map(
                  (price: any) => (
                    <GastarioDataRow
                      key={price.id}
                    >
                      <div className="g-ui-data-row-main">
                        <strong className="g-ui-data-row-title">
                          {price.catalogItem?.name ||
                            "Lieferantenartikel"}
                        </strong>

                        <span className="g-ui-data-row-description">
                          {price.catalogItem
                            ?.supplier?.name ||
                            "Lieferant"}
                          {" · "}
                          Art.-Nr.{" "}
                          {price.catalogItem
                            ?.articleNumber ||
                            price.catalogItem
                              ?.externalId ||
                            "–"}
                          {" · "}
                          Importiert:{" "}
                          {formatMoney(
                            price.netPriceCents
                          )}
                        </span>
                      </div>

                      <div className="g-ui-data-row-meta">
                        <button
                          type="button"
                          className={gastarioButtonClass(
                            "ghost"
                          )}
                          onClick={() => {
                            setSelectedPriceId(
                              price.id
                            );
                            setPriceDetailTab(
                              "overview"
                            );
                          }}
                        >
                          Prüfen
                        </button>
                      </div>
                    </GastarioDataRow>
                  )
                )}
              </GastarioDataList>

              <GastarioDetailDialog
                open={Boolean(selectedPrice)}
                title={
                  selectedPrice
                    ? selectedPrice.catalogItem
                        ?.name ||
                      "Lieferantenartikel"
                    : "Preisprüfung"
                }
                description={
                  selectedPrice
                    ? `${
                        selectedPrice.catalogItem
                          ?.supplier?.name ||
                        "Lieferant"
                      } · Art.-Nr. ${
                        selectedPrice.catalogItem
                          ?.articleNumber ||
                        selectedPrice.catalogItem
                          ?.externalId ||
                        "–"
                      }`
                    : undefined
                }
                onClose={() =>
                  setSelectedPriceId(null)
                }
                footer={
                  selectedPrice ? (
                    <>
                      <button
                        type="button"
                        className={gastarioButtonClass(
                          "secondary"
                        )}
                        onClick={() =>
                          setSelectedPriceId(null)
                        }
                      >
                        Schließen
                      </button>

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
                            value={
                              selectedPrice.id
                            }
                          />

                          <button
                            type="submit"
                            className={gastarioButtonClass(
                              "primary"
                            )}
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
                              value={
                                selectedPrice.id
                              }
                            />

                            <button
                              type="submit"
                              className={gastarioButtonClass(
                                "primary"
                              )}
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
                              value={
                                selectedPrice.id
                              }
                            />

                            <button
                              type="submit"
                              className={gastarioButtonClass(
                                "danger"
                              )}
                            >
                              Verwerfen
                            </button>
                          </Form>
                        </>
                      )}
                    </>
                  ) : null
                }
              >
                {selectedPrice ? (
                  <>
                    <GastarioDetailTabs
                      items={[
                        {
                          id: "overview",
                          label: "Preis",
                        },
                        {
                          id: "review",
                          label: "Prüfung",
                        },
                      ]}
                      activeId={priceDetailTab}
                      onChange={setPriceDetailTab}
                    />

                    <GastarioDetailPane
                      active={
                        priceDetailTab ===
                        "overview"
                      }
                    >
                      <GastarioMetricGrid>
                        <GastarioMetric
                          label="Importierter Preis"
                          value={formatMoney(
                            selectedPrice.netPriceCents
                          )}
                          description={
                            selectedPrice.priceUnit ||
                            "Einheit"
                          }
                        />

                        <GastarioMetric
                          label="Referenzpreis"
                          value={formatMoney(
                            selectedPrice.referencePriceCents
                          )}
                          description={
                            selectedPrice.priceRatio !=
                            null
                              ? `Faktor ${Number(
                                  selectedPrice.priceRatio
                                ).toFixed(2)}`
                              : "Keine Referenz"
                          }
                        />

                        <GastarioMetric
                          label="Import"
                          value={formatDateTime(
                            selectedPrice.fetchedAt
                          )}
                          description="Zeitpunkt des Preisimports"
                        />
                      </GastarioMetricGrid>
                    </GastarioDetailPane>

                    <GastarioDetailPane
                      active={
                        priceDetailTab ===
                        "review"
                      }
                    >
                      <GastarioNotice
                        type={
                          data.showRejected
                            ? "danger"
                            : "warning"
                        }
                      >
                        {selectedPrice.qualityReason ||
                          "Automatisch auffällig erkannt"}
                      </GastarioNotice>
                    </GastarioDetailPane>
                  </>
                ) : null}
              </GastarioDetailDialog>
            </>
          )}
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}
