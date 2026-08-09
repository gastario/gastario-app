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

import {
  normalizeSupplierSearchTerm,
} from "../lib/supplier-search-index.server";

import "../styles/gastario-page-shell.css";
import "../styles/gastario-procurement-search.css";

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
      <PageShell className="procurementSearchPage">
        <PageHeader
          eyebrow="Einkauf & Lieferanten"
          title="Suchbegriffe verwalten"
          subtitle={`Lege eigene Begriffsgruppen für ${data.tenant.name} an. Gastario berücksichtigt sie sofort in der lieferantenübergreifenden Artikelsuche.`}
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

        <section className="supplierAliasMetrics">
          <div className="supplierAliasMetric">
            <span>Begriffsgruppen</span>
            <strong>{data.groups.length}</strong>
          </div>

          <div className="supplierAliasMetric">
            <span>Suchbegriffe</span>
            <strong>{data.totalAliases}</strong>
          </div>

          <div className="supplierAliasMetric">
            <span>Aktiv</span>
            <strong>{data.activeAliases}</strong>
          </div>

          <div className="supplierAliasMetric">
            <span>Automatisch gelernt</span>
            <strong>{data.autoLearnedAliases}</strong>
          </div>
        </section>

        {data.learningSuggestions.length > 0 ? (
          <PageSection
            eyebrow="Gastario lernt mit"
            title="Erkannte Suchbeziehungen"
            description="Diese Vorschläge entstehen aus deiner tatsächlichen Artikelauswahl. Gastario aktiviert eine Beziehung nur dann automatisch, wenn sie mehrfach in beide Richtungen bestätigt wurde und keine bestehende Alias-Gruppe berührt."
          >
            <div className="supplierLearningList">
              {data.learningSuggestions.map(
                (suggestion: any) => (
                  <article
                    className="supplierLearningCard"
                    key={suggestion.id}
                  >
                    <div className="supplierLearningMain">
                      <span className="supplierAliasEyebrow">
                        Lernvorschlag
                      </span>

                      <strong>
                        {suggestion.queryTerm}
                        <span> ↔ </span>
                        {suggestion.candidateTerm}
                      </strong>

                      <small>
                        Zuletzt gewählt:{" "}
                        {suggestion.lastCatalogItemName ||
                          "Lieferantenartikel"}
                        {suggestion.lastSupplierName
                          ? ` · ${suggestion.lastSupplierName}`
                          : ""}
                      </small>
                    </div>

                    <div className="supplierLearningEvidence">
                      <span>Evidenz</span>
                      <strong>
                        {suggestion.evidenceCount}×
                      </strong>
                    </div>

                    <div className="supplierLearningActions">
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
                          className="procurementSearchButton"
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
                          className="procurementSearchButton procurementSearchButton--secondary"
                        >
                          Verwerfen
                        </button>
                      </Form>
                    </div>
                  </article>
                )
              )}
            </div>
          </PageSection>
        ) : null}

        <PageSection
          eyebrow="Neue Begriffsgruppe"
          title="Was soll Gastario als dasselbe Produkt verstehen?"
          description="Ein Hauptbegriff verbindet alle dazugehörigen Begriffe. Mehrere Aliase kannst du mit Komma, Semikolon oder einer neuen Zeile trennen."
        >
          <Form
            method="post"
            className="supplierAliasCreateForm"
          >
            <input
              type="hidden"
              name="intent"
              value="create-group"
            />

            <label className="supplierAliasField">
              <span>Hauptbegriff</span>
              <input
                name="canonicalTerm"
                placeholder="z. B. Marmelade"
                required
              />
            </label>

            <label className="supplierAliasField supplierAliasField--wide">
              <span>Synonyme / alternative Bezeichnungen</span>
              <textarea
                name="aliases"
                rows={3}
                placeholder="Konfitüre, Fruchtaufstrich, Gelee"
              />
            </label>

            <div className="supplierAliasFormActions">
              <button
                type="submit"
                className="procurementSearchButton"
              >
                Begriffsgruppe speichern
              </button>
            </div>
          </Form>
        </PageSection>

        <PageSection
          eyebrow="Gespeicherte Begriffe"
          title="Suchlogik deines Betriebs"
          description="Änderungen gelten sofort für die Artikelsuche. Deaktivierte Begriffe bleiben gespeichert, werden aber nicht mehr berücksichtigt."
        >
          {data.groups.length === 0 ? (
            <div className="supplierAliasEmpty">
              Noch keine eigenen Begriffsgruppen angelegt.
            </div>
          ) : (
            <div className="supplierAliasGroupList">
              {data.groups.map((group: any) => (
                <article
                  className="supplierAliasGroup"
                  key={group.canonicalNormalized}
                >
                  <div className="supplierAliasGroupHeader">
                    <div>
                      <span className="supplierAliasEyebrow">
                        Hauptbegriff
                      </span>
                      <h3>
                        {group.canonicalTerm}
                      </h3>
                    </div>

                    <span className="supplierAliasCount">
                      {group.aliases.length} Begriffe
                    </span>
                  </div>

                  <div className="supplierAliasPills">
                    {group.aliases.map(
                      (entry: any) => (
                        <div
                          className={`supplierAliasPill ${
                            entry.active
                              ? ""
                              : "supplierAliasPill--inactive"
                          }`}
                          key={entry.id}
                        >
                          <span className="supplierAliasPillLabel">
                            <span>
                              {entry.aliasTerm}
                            </span>

                            {entry.source === "AUTO_LEARNED" ? (
                              <small className="supplierAliasSourceBadge">
                                Automatisch gelernt
                              </small>
                            ) : entry.source === "LEARNED" ? (
                              <small className="supplierAliasSourceBadge supplierAliasSourceBadge--reviewed">
                                Aus Lernvorschlag
                              </small>
                            ) : null}
                          </span>

                          <div className="supplierAliasPillActions">
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
                                className="supplierAliasTextButton"
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
                                className="supplierAliasTextButton supplierAliasTextButton--danger"
                              >
                                Löschen
                              </button>
                            </Form>
                          </div>
                        </div>
                      )
                    )}
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