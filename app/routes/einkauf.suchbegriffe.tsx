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
  GastarioDataList,
  GastarioDataRow,
  GastarioToolbar,
  GastarioField,
  GastarioInput,
  GastarioTextarea,
  GastarioEmptyState,
} from "../components/ui";

import {
  normalizeSupplierSearchTerm,
} from "../lib/supplier-search-index.server";


type ActionData = {
  error?: string;
  success?: string;
};

function cleanTerm(value: FormDataEntryValue | null) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitAliases(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map((entry) => cleanTerm(entry))
        .filter(Boolean)
    )
  ).slice(0, 80);
}

export function meta() {
  return [
    {
      title:
        "Suchbegriffe verwalten · Gastario",
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

  const aliases =
    await prisma.supplierSearchAlias.findMany({
      where: {
        tenantId: access.tenantId,
      },
      orderBy: [
        {
          canonicalNormalized: "asc",
        },
        {
          aliasNormalized: "asc",
        },
      ],
    });

  const groups = Array.from(
    aliases.reduce(
      (map: Map<string, any>, entry: any) => {
        const key =
          entry.canonicalNormalized;

        const current =
          map.get(key) || {
            canonicalTerm:
              entry.canonicalTerm,
            canonicalNormalized:
              entry.canonicalNormalized,
            aliases: [],
          };

        current.aliases.push(entry);
        map.set(key, current);

        return map;
      },
      new Map<string, any>()
    ).values()
  );

  const learningSuggestions =
    await prisma.supplierSearchLearningSuggestion.findMany({
      where: {
        tenantId: access.tenantId,
        status: "PENDING",
      },
      orderBy: [
        {
          evidenceCount: "desc",
        },
        {
          lastSeenAt: "desc",
        },
      ],
      take: 40,
    });

  return {
    tenant: {
      name: access.tenant.name,
    },
    groups,
    totalAliases: aliases.length,
    activeAliases: aliases.filter(
      (entry: any) => entry.active
    ).length,
    autoLearnedAliases: aliases.filter(
      (entry: any) =>
        entry.source === "AUTO_LEARNED"
    ).length,
    learningSuggestions,
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
  const intent = cleanTerm(
    formData.get("intent")
  );

  if (intent === "create-group") {
    const canonicalTerm = cleanTerm(
      formData.get("canonicalTerm")
    );

    const rawAliases = cleanTerm(
      formData.get("aliases")
    );

    if (canonicalTerm.length < 2) {
      return {
        error:
          "Bitte einen Hauptbegriff mit mindestens 2 Zeichen eingeben.",
      } satisfies ActionData;
    }

    const canonicalNormalized =
      normalizeSupplierSearchTerm(
        canonicalTerm
      );

    const aliases = splitAliases(rawAliases);

    const entries = Array.from(
      new Set([
        canonicalTerm,
        ...aliases,
      ])
    );

    for (const aliasTerm of entries) {
      const aliasNormalized =
        normalizeSupplierSearchTerm(
          aliasTerm
        );

      if (!aliasNormalized) {
        continue;
      }

      const existing =
        await prisma.supplierSearchAlias.findUnique({
          where: {
            tenantId_aliasNormalized: {
              tenantId: access.tenantId,
              aliasNormalized,
            },
          },
        });

      if (
        existing &&
        existing.canonicalNormalized !==
          canonicalNormalized
      ) {
        return {
          error:
            `„${aliasTerm}“ gehört bereits zur Gruppe „${existing.canonicalTerm}“.`,
        } satisfies ActionData;
      }

      await prisma.supplierSearchAlias.upsert({
        where: {
          tenantId_aliasNormalized: {
            tenantId: access.tenantId,
            aliasNormalized,
          },
        },
        create: {
          tenantId: access.tenantId,
          canonicalTerm,
          aliasTerm,
          canonicalNormalized,
          aliasNormalized,
          active: true,
          source: "MANUAL",
        },
        update: {
          canonicalTerm,
          aliasTerm,
          canonicalNormalized,
          active: true,
        },
      });
    }

    return redirect(
      "/einkauf/suchbegriffe?saved=1"
    );
  }

  if (intent === "accept-learning") {
    const id = cleanTerm(
      formData.get("id")
    );

    const suggestion =
      await prisma.supplierSearchLearningSuggestion.findFirst({
        where: {
          id,
          tenantId: access.tenantId,
          status: "PENDING",
        },
      });

    if (!suggestion) {
      return {
        error:
          "Der Lernvorschlag wurde nicht gefunden.",
      } satisfies ActionData;
    }

    const canonicalTerm =
      suggestion.queryTerm;

    const canonicalNormalized =
      suggestion.queryNormalized;

    const entries = [
      {
        aliasTerm:
          suggestion.queryTerm,
        aliasNormalized:
          suggestion.queryNormalized,
      },
      {
        aliasTerm:
          suggestion.candidateTerm,
        aliasNormalized:
          suggestion.candidateNormalized,
      },
    ];

    for (const entry of entries) {
      const conflict =
        await prisma.supplierSearchAlias.findUnique({
          where: {
            tenantId_aliasNormalized: {
              tenantId: access.tenantId,
              aliasNormalized:
                entry.aliasNormalized,
            },
          },
        });

      if (
        conflict &&
        conflict.canonicalNormalized !==
          canonicalNormalized
      ) {
        return {
          error:
            `„${entry.aliasTerm}“ gehört bereits zur Gruppe „${conflict.canonicalTerm}“.`,
        } satisfies ActionData;
      }

      await prisma.supplierSearchAlias.upsert({
        where: {
          tenantId_aliasNormalized: {
            tenantId: access.tenantId,
            aliasNormalized:
              entry.aliasNormalized,
          },
        },
        create: {
          tenantId: access.tenantId,
          canonicalTerm,
          aliasTerm:
            entry.aliasTerm,
          canonicalNormalized,
          aliasNormalized:
            entry.aliasNormalized,
          active: true,
          source: "LEARNED",
          useCount:
            suggestion.evidenceCount,
        },
        update: {
          canonicalTerm,
          canonicalNormalized,
          active: true,
          source: "LEARNED",
          useCount: {
            increment:
              suggestion.evidenceCount,
          },
        },
      });
    }

    await prisma.supplierSearchLearningSuggestion.update({
      where: {
        id: suggestion.id,
      },
      data: {
        status: "ACCEPTED",
      },
    });

    return redirect(
      "/einkauf/suchbegriffe?learned=1"
    );
  }

  if (intent === "reject-learning") {
    const id = cleanTerm(
      formData.get("id")
    );

    await prisma.supplierSearchLearningSuggestion.updateMany({
      where: {
        id,
        tenantId: access.tenantId,
        status: "PENDING",
      },
      data: {
        status: "REJECTED",
      },
    });

    return redirect(
      "/einkauf/suchbegriffe"
    );
  }

  if (intent === "toggle-alias") {
    const id = cleanTerm(
      formData.get("id")
    );

    if (!id) {
      return {
        error:
          "Der Suchbegriff konnte nicht gefunden werden.",
      } satisfies ActionData;
    }

    const existing =
      await prisma.supplierSearchAlias.findFirst({
        where: {
          id,
          tenantId: access.tenantId,
        },
      });

    if (!existing) {
      return {
        error:
          "Der Suchbegriff existiert nicht mehr.",
      } satisfies ActionData;
    }

    await prisma.supplierSearchAlias.update({
      where: {
        id: existing.id,
      },
      data: {
        active: !existing.active,
      },
    });

    return redirect(
      "/einkauf/suchbegriffe"
    );
  }

  if (intent === "delete-alias") {
    const id = cleanTerm(
      formData.get("id")
    );

    if (!id) {
      return {
        error:
          "Der Suchbegriff konnte nicht gefunden werden.",
      } satisfies ActionData;
    }

    await prisma.supplierSearchAlias.deleteMany({
      where: {
        id,
        tenantId: access.tenantId,
      },
    });

    return redirect(
      "/einkauf/suchbegriffe"
    );
  }

  return {
    error:
      "Unbekannte Aktion.",
  } satisfies ActionData;
}

export default function SupplierSearchAliasesPage() {
  const data = useLoaderData<typeof loader>();
  const actionData =
    useActionData<typeof action>();

  return (
    <AppLayout>
      <GastarioPage>
        <GastarioHeader
          eyebrow="Einkauf & Lieferanten"
          title="Suchbegriffe verwalten"
          description={`Lege eigene Begriffsgruppen für ${data.tenant.name} an. Gastario berücksichtigt sie sofort in der lieferantenübergreifenden Artikelsuche.`}
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
            label="Begriffsgruppen"
            value={data.groups.length}
            description="gespeicherte Gruppen"
          />

          <GastarioMetric
            label="Suchbegriffe"
            value={data.totalAliases}
            description="insgesamt hinterlegt"
          />

          <GastarioMetric
            label="Aktiv"
            value={data.activeAliases}
            description="werden aktuell berücksichtigt"
          />

          <GastarioMetric
            label="Automatisch gelernt"
            value={data.autoLearnedAliases}
            description="durch Gastario erkannt"
          />
        </GastarioMetricGrid>

        {data.learningSuggestions.length > 0 ? (
          <GastarioSection
            eyebrow="Gastario lernt mit"
            title="Erkannte Suchbeziehungen"
            description="Diese Vorschläge entstehen aus deiner tatsächlichen Artikelauswahl. Gastario aktiviert eine Beziehung nur dann automatisch, wenn sie mehrfach in beide Richtungen bestätigt wurde und keine bestehende Alias-Gruppe berührt."
          >
            <GastarioDataList>
              {data.learningSuggestions.map(
                (suggestion: any) => (
                  <GastarioDataRow
                    key={suggestion.id}
                  >
                    <div className="g-ui-data-row-main">
                      <strong className="g-ui-data-row-title">
                        {suggestion.queryTerm}
                        {" ↔ "}
                        {suggestion.candidateTerm}
                      </strong>

                      <span className="g-ui-data-row-description">
                        Zuletzt gewählt:{" "}
                        {suggestion.lastCatalogItemName ||
                          "Lieferantenartikel"}
                        {suggestion.lastSupplierName
                          ? ` · ${suggestion.lastSupplierName}`
                          : ""}
                        {" · "}
                        Evidenz:{" "}
                        {suggestion.evidenceCount}×
                      </span>
                    </div>

                    <div className="g-ui-data-row-meta">
                      <GastarioToolbar>
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="accept-learning"
                          />

                          <input
                            type="hidden"
                            name="id"
                            value={suggestion.id}
                          />

                          <button
                            type="submit"
                            className={gastarioButtonClass(
                              "primary"
                            )}
                          >
                            Übernehmen
                          </button>
                        </Form>

                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="reject-learning"
                          />

                          <input
                            type="hidden"
                            name="id"
                            value={suggestion.id}
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
                      </GastarioToolbar>
                    </div>
                  </GastarioDataRow>
                )
              )}
            </GastarioDataList>
          </GastarioSection>
        ) : null}

        <GastarioSection
          eyebrow="Neue Begriffsgruppe"
          title="Was soll Gastario als dasselbe Produkt verstehen?"
          description="Ein Hauptbegriff verbindet alle dazugehörigen Begriffe. Mehrere Aliase kannst du mit Komma, Semikolon oder einer neuen Zeile trennen."
        >
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="create-group"
            />

            <GastarioStack>
              <GastarioField
                label="Hauptbegriff"
                required
              >
                <GastarioInput
                  name="canonicalTerm"
                  placeholder="z. B. Marmelade"
                  required
                />
              </GastarioField>

              <GastarioField label="Synonyme / alternative Bezeichnungen">
                <GastarioTextarea
                  name="aliases"
                  rows={3}
                  placeholder="Konfitüre, Fruchtaufstrich, Gelee"
                />
              </GastarioField>

              <GastarioToolbar>
                <button
                  type="submit"
                  className={gastarioButtonClass(
                    "primary"
                  )}
                >
                  Begriffsgruppe speichern
                </button>
              </GastarioToolbar>
            </GastarioStack>
          </Form>
        </GastarioSection>

        <GastarioSection
          eyebrow="Gespeicherte Begriffe"
          title="Suchlogik deines Betriebs"
          description="Änderungen gelten sofort für die Artikelsuche. Deaktivierte Begriffe bleiben gespeichert, werden aber nicht mehr berücksichtigt."
        >
          {data.groups.length === 0 ? (
            <GastarioEmptyState title="Noch keine Begriffsgruppen">
              Noch keine eigenen Begriffsgruppen angelegt.
            </GastarioEmptyState>
          ) : (
            <GastarioStack>
              {data.groups.map(
                (group: any) => (
                  <GastarioSection
                    key={group.canonicalNormalized}
                    eyebrow="Hauptbegriff"
                    title={group.canonicalTerm}
                    description={`${group.aliases.length} Begriffe`}
                  >
                    <GastarioDataList>
                      {group.aliases.map(
                        (entry: any) => (
                          <GastarioDataRow
                            key={entry.id}
                          >
                            <div className="g-ui-data-row-main">
                              <strong className="g-ui-data-row-title">
                                {entry.aliasTerm}
                              </strong>

                              <span className="g-ui-data-row-description">
                                {entry.active
                                  ? "Aktiv"
                                  : "Deaktiviert"}
                                {entry.source ===
                                "AUTO_LEARNED"
                                  ? " · Automatisch gelernt"
                                  : entry.source ===
                                      "LEARNED"
                                    ? " · Aus Lernvorschlag"
                                    : ""}
                              </span>
                            </div>

                            <div className="g-ui-data-row-meta">
                              <GastarioToolbar>
                                <Form method="post">
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="toggle-alias"
                                  />

                                  <input
                                    type="hidden"
                                    name="id"
                                    value={entry.id}
                                  />

                                  <button
                                    type="submit"
                                    className={gastarioButtonClass(
                                      "secondary"
                                    )}
                                  >
                                    {entry.active
                                      ? "Deaktivieren"
                                      : "Aktivieren"}
                                  </button>
                                </Form>

                                <Form method="post">
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="delete-alias"
                                  />

                                  <input
                                    type="hidden"
                                    name="id"
                                    value={entry.id}
                                  />

                                  <button
                                    type="submit"
                                    className={gastarioButtonClass(
                                      "danger"
                                    )}
                                  >
                                    Löschen
                                  </button>
                                </Form>
                              </GastarioToolbar>
                            </div>
                          </GastarioDataRow>
                        )
                      )}
                    </GastarioDataList>
                  </GastarioSection>
                )
              )}
            </GastarioStack>
          )}
        </GastarioSection>
      </GastarioPage>
    </AppLayout>
  );
}
