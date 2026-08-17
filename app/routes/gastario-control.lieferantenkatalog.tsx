import {
  Form,
  Link,
  useActionData,
  useLoaderData,
} from "react-router";

import SuperAdminLayout from "../components/SuperAdminLayout";
import { requireSuperAdmin } from "../lib/session.server";
import { refreshGlobalSupplierCatalogCsv } from "../lib/global-supplier-catalog-refresh.server";

const PROVIDERS = [
  {
    code: "METRO",
    name: "METRO",
  },
  {
    code: "TRANSGOURMET",
    name: "Transgourmet",
  },
  {
    code: "CHEFS_CULINAR",
    name: "CHEFS CULINAR",
  },
  {
    code: "SELGROS",
    name: "Selgros",
  },
] as const;

export function meta() {
  return [
    {
      title:
        "Globaler Lieferantenkatalog · Gastario Control",
    },
  ];
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  await requireSuperAdmin(
    request
  );

  const { prisma } =
    await import(
      "../lib/prisma.server"
    );

  const url =
    new URL(request.url);

  const query =
    String(
      url.searchParams.get("q") || ""
    ).trim();

  const provider =
    String(
      url.searchParams.get("provider") || ""
    )
      .trim()
      .toUpperCase();

  const page =
    Math.max(
      1,
      Number(
        url.searchParams.get("page") || 1
      ) || 1
    );

  const pageSize = 50;

  const where = {
    active: true,
    ...(provider
      ? {
          providerCode:
            provider,
        }
      : {}),
    ...(query
      ? {
          OR: [
            {
              name: {
                contains:
                  query,
                mode:
                  "insensitive" as const,
              },
            },
            {
              brand: {
                contains:
                  query,
                mode:
                  "insensitive" as const,
              },
            },
            {
              articleNumber: {
                contains:
                  query,
                mode:
                  "insensitive" as const,
              },
            },
            {
              externalId: {
                contains:
                  query,
                mode:
                  "insensitive" as const,
              },
            },
            {
              ean: {
                contains:
                  query,
                mode:
                  "insensitive" as const,
              },
            },
            {
              gtin: {
                contains:
                  query,
                mode:
                  "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const grouped =
    await prisma.globalSupplierCatalogItem.groupBy({
      by: [
        "providerCode",
      ],
      _count: {
        _all: true,
      },
      where: {
        active: true,
      },
      orderBy: {
        providerCode:
          "asc",
      },
    });

  const counts =
    Object.fromEntries(
      grouped.map(
        (entry) => [
          entry.providerCode,
          entry._count._all,
        ]
      )
    );

  const [
    filteredTotal,
    items,
  ] = await Promise.all([
    prisma.globalSupplierCatalogItem.count({
      where,
    }),
    prisma.globalSupplierCatalogItem.findMany({
      where,
      orderBy: [
        {
          providerCode:
            "asc",
        },
        {
          name:
            "asc",
        },
      ],
      skip:
        (page - 1) *
        pageSize,
      take:
        pageSize,
      select: {
        id: true,
        providerCode: true,
        name: true,
        brand: true,
        articleNumber: true,
        externalId: true,
        ean: true,
        gtin: true,
        orderUnit: true,
        packageQuantity: true,
        lastSeenAt: true,
      },
    }),
  ]);

  return {
    counts,
    total:
      grouped.reduce(
        (
          sum,
          entry
        ) =>
          sum +
          entry._count._all,
        0
      ),
    items,
    filteredTotal,
    query,
    provider,
    page,
    pageSize,
    pageCount:
      Math.max(
        1,
        Math.ceil(
          filteredTotal /
          pageSize
        )
      ),
  };
}

export async function action({
  request,
}: {
  request: Request;
}) {
  await requireSuperAdmin(
    request
  );

  const formData =
    await request.formData();

  const providerCode =
    String(
      formData.get(
        "providerCode"
      ) || ""
    )
      .trim()
      .toUpperCase();

  if (
    !PROVIDERS.some(
      (provider) =>
        provider.code ===
        providerCode
    )
  ) {
    return {
      ok: false,
      error:
        "Bitte einen unterstützten Lieferanten auswählen.",
    };
  }

  const file =
    formData.get(
      "file"
    ) as any;

  if (
    !file ||
    typeof file.text !==
      "function"
  ) {
    return {
      ok: false,
      error:
        "Bitte eine CSV-Datei auswählen.",
    };
  }

  const fileName =
    String(
      file.name || ""
    );

  if (
    fileName &&
    !fileName
      .toLowerCase()
      .endsWith(".csv")
  ) {
    return {
      ok: false,
      error:
        "Für V1 wird eine CSV-Datei erwartet.",
    };
  }

  const csvText =
    await file.text();

  if (
    !String(
      csvText || ""
    ).trim()
  ) {
    return {
      ok: false,
      error:
        "Die CSV-Datei ist leer.",
    };
  }

  const distribute =
    String(
      formData.get(
        "distribute"
      ) || ""
    ) === "true";

  try {
    const result =
      await refreshGlobalSupplierCatalogCsv({
        providerCode,
        csvText,
        distribute,
      });

    return {
      ok: true,
      fileName:
        fileName ||
        null,
      ...result,
    };
  } catch (
    error: any
  ) {
    return {
      ok: false,
      error:
        String(
          error?.message ||
          error
        ),
    };
  }
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value:
    string |
    number;
  hint?: string;
}) {
  return (
    <div className="catalogMetric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      {hint ? (
        <small>
          {hint}
        </small>
      ) : null}
    </div>
  );
}

export default function GlobalSupplierCatalogControlPage() {
  const data =
    useLoaderData<
      typeof loader
    >();

  const actionData =
    useActionData<
      typeof action
    >() as any;

  const distribution =
    actionData?.distribution ||
    null;

  return (
    <SuperAdminLayout>
      <style>{`
        .catalogPage {
          display: grid;
          gap: 20px;
        }

        .catalogHero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          padding: 28px;
          border-radius: 30px;
          background:
            radial-gradient(circle at top right, rgba(23,195,166,.2), transparent 36%),
            linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.86));
          border: 1px solid rgba(148,163,184,.24);
          box-shadow: 0 24px 70px rgba(15,23,42,.1);
        }

        .catalogKicker {
          color: #047857;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 12px;
          font-weight: 950;
        }

        .catalogHero h1 {
          margin: 7px 0 0;
          color: #07111f;
          font-size: 38px;
          letter-spacing: -.05em;
          line-height: 1;
        }

        .catalogHero p {
          max-width: 760px;
          margin: 12px 0 0;
          color: #64748b;
          line-height: 1.55;
          font-weight: 730;
        }

        .catalogBack {
          text-decoration: none;
          color: #0f172a;
          font-weight: 900;
          border: 1px solid rgba(148,163,184,.32);
          background: #fff;
          border-radius: 14px;
          padding: 11px 14px;
        }

        .catalogGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, .7fr);
          gap: 20px;
          align-items: start;
        }

        .catalogPanel {
          border-radius: 24px;
          padding: 22px;
          background: #fff;
          border: 1px solid rgba(148,163,184,.24);
          box-shadow: 0 18px 46px rgba(15,23,42,.07);
        }

        .catalogPanel h2 {
          margin: 0;
          color: #07111f;
          letter-spacing: -.03em;
        }

        .catalogPanelText {
          margin: 7px 0 18px;
          color: #64748b;
          line-height: 1.5;
          font-size: 14px;
          font-weight: 730;
        }

        .catalogForm {
          display: grid;
          gap: 15px;
        }

        .catalogField {
          display: grid;
          gap: 7px;
          color: #334155;
          font-size: 13px;
          font-weight: 900;
        }

        .catalogField select,
        .catalogField input[type="file"] {
          width: 100%;
          min-height: 46px;
          border: 1px solid rgba(148,163,184,.34);
          border-radius: 14px;
          background: #fff;
          padding: 10px 12px;
          color: #0f172a;
          font: inherit;
        }

        .catalogCheck {
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 16px;
          padding: 13px 14px;
          background: #f8fafc;
          border: 1px solid rgba(148,163,184,.2);
          color: #334155;
          font-size: 13px;
          font-weight: 820;
        }

        .catalogSubmit {
          border: 0;
          border-radius: 14px;
          padding: 13px 17px;
          background: #07111f;
          color: #fff;
          font-weight: 950;
          cursor: pointer;
        }

        .catalogMetrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 12px;
        }

        .catalogMetric {
          border-radius: 18px;
          padding: 17px;
          background: #f8fafc;
          border: 1px solid rgba(148,163,184,.2);
        }

        .catalogMetric span {
          display: block;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .09em;
          font-weight: 950;
        }

        .catalogMetric strong {
          display: block;
          margin-top: 7px;
          color: #07111f;
          font-size: 30px;
          letter-spacing: -.05em;
        }

        .catalogMetric small {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-weight: 720;
        }

        .catalogNotice {
          border-radius: 18px;
          padding: 15px 17px;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.5;
        }

        .catalogNotice--success {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .catalogNotice--danger {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .catalogResultGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 12px;
          margin-top: 14px;
        }

        /* GLOBAL_CATALOG_LIST_V1 */
        .catalogListToolbar {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) 220px auto;
          gap: 10px;
          align-items: end;
          margin: 16px 0;
        }

        .catalogListToolbar label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          font-weight: 900;
          color: #475569;
        }

        .catalogListToolbar input,
        .catalogListToolbar select {
          min-height: 44px;
          border: 1px solid rgba(148,163,184,.34);
          border-radius: 13px;
          padding: 9px 11px;
          background: #fff;
          font: inherit;
          color: #0f172a;
        }

        .catalogSearchButton {
          min-height: 44px;
          border: 0;
          border-radius: 13px;
          padding: 10px 16px;
          background: #07111f;
          color: white;
          font-weight: 950;
          cursor: pointer;
        }

        .catalogTableWrap {
          overflow-x: auto;
          border: 1px solid rgba(148,163,184,.2);
          border-radius: 18px;
        }

        .catalogTable {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          font-size: 13px;
        }

        .catalogTable th {
          text-align: left;
          padding: 12px 11px;
          background: #f8fafc;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .07em;
          white-space: nowrap;
        }

        .catalogTable td {
          padding: 12px 11px;
          border-top: 1px solid rgba(148,163,184,.16);
          color: #334155;
          vertical-align: top;
        }

        .catalogTable strong {
          display: block;
          color: #07111f;
        }

        .catalogTable small {
          color: #64748b;
        }

        .catalogPager {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        .catalogPagerLinks {
          display: flex;
          gap: 8px;
        }

        .catalogPagerLink {
          text-decoration: none;
          border: 1px solid rgba(148,163,184,.3);
          border-radius: 11px;
          padding: 8px 11px;
          background: #fff;
          color: #0f172a;
          font-weight: 850;
        }

        .catalogPagerLink[aria-disabled="true"] {
          opacity: .45;
          pointer-events: none;
        }

        @media (max-width: 760px) {
          .catalogListToolbar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .catalogGrid {
            grid-template-columns: 1fr;
          }

          .catalogResultGrid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
        }
      `}</style>

      <div className="catalogPage">
        <section className="catalogHero">
          <div>
            <div className="catalogKicker">
              Gastario Control
            </div>

            <h1>
              Globaler Lieferantenkatalog
            </h1>

            <p>
              Lieferanten-Stammdaten einmal zentral pflegen und anschließend automatisch für alle passenden Mandanten bereitstellen.
            </p>
          </div>

          <Link
            to="/gastario-control"
            className="catalogBack"
          >
            Zur Übersicht
          </Link>
        </section>

        {actionData?.ok === false ? (
          <div className="catalogNotice catalogNotice--danger">
            {actionData.error}
          </div>
        ) : null}

        {actionData?.ok === true ? (
          <div className="catalogNotice catalogNotice--success">
            {actionData.providerCode} wurde aktualisiert
            {actionData.fileName
              ? " · " + actionData.fileName
              : ""}.
          </div>
        ) : null}

        <section className="catalogGrid">
          <div className="catalogPanel">
            <h2>
              Katalog aktualisieren
            </h2>

            <p className="catalogPanelText">
              CSV hochladen, globale Artikel aktualisieren und auf Wunsch direkt an alle passenden Mandanten verteilen.
            </p>

            <Form
              method="post"
              encType="multipart/form-data"
              className="catalogForm"
            >
              <label className="catalogField">
                <span>
                  Lieferant / Provider
                </span>

                <select
                  name="providerCode"
                  defaultValue="METRO"
                  required
                >
                  {PROVIDERS.map(
                    (
                      provider
                    ) => (
                      <option
                        key={
                          provider.code
                        }
                        value={
                          provider.code
                        }
                      >
                        {
                          provider.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="catalogField">
                <span>
                  CSV-Datei
                </span>

                <input
                  type="file"
                  name="file"
                  accept=".csv,text/csv"
                  required
                />
              </label>

              <label className="catalogCheck">
                <input
                  type="checkbox"
                  name="distribute"
                  value="true"
                  defaultChecked
                />

                Nach dem Import automatisch an passende Mandanten verteilen
              </label>

              <button
                type="submit"
                className="catalogSubmit"
              >
                Katalog aktualisieren
              </button>
            </Form>
          </div>

          <aside className="catalogPanel">
            <h2>
              Zentraler Bestand
            </h2>

            <p className="catalogPanelText">
              Aktive globale Artikel je Provider.
            </p>

            <div className="catalogMetrics">
              <Metric
                label="Gesamt"
                value={
                  data.total
                }
              />

              {PROVIDERS.map(
                (
                  provider
                ) => (
                  <Metric
                    key={
                      provider.code
                    }
                    label={
                      provider.name
                    }
                    value={
                      data.counts[
                        provider.code
                      ] || 0
                    }
                  />
                )
              )}
            </div>
          </aside>
        </section>

        <section className="catalogPanel">
          <h2>
            Globaler Bestand
          </h2>

          <p className="catalogPanelText">
            Zentrale Artikel aller Provider durchsuchen und kontrollieren.
          </p>

          <Form
            method="get"
            className="catalogListToolbar"
          >
            <label>
              <span>
                Suche
              </span>

              <input
                type="search"
                name="q"
                defaultValue={
                  data.query
                }
                placeholder="Artikel, Marke, Artikelnummer, EAN ..."
              />
            </label>

            <label>
              <span>
                Provider
              </span>

              <select
                name="provider"
                defaultValue={
                  data.provider
                }
              >
                <option value="">
                  Alle Provider
                </option>

                {PROVIDERS.map(
                  (
                    provider
                  ) => (
                    <option
                      key={
                        provider.code
                      }
                      value={
                        provider.code
                      }
                    >
                      {
                        provider.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <button
              className="catalogSearchButton"
              type="submit"
            >
              Suchen
            </button>
          </Form>

          <div className="catalogTableWrap">
            <table className="catalogTable">
              <thead>
                <tr>
                  <th>
                    Artikel
                  </th>
                  <th>
                    Provider
                  </th>
                  <th>
                    Artikelnummer
                  </th>
                  <th>
                    EAN / GTIN
                  </th>
                  <th>
                    Einheit
                  </th>
                  <th>
                    Zuletzt gesehen
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      Noch keine passenden globalen Artikel vorhanden.
                    </td>
                  </tr>
                ) : (
                  data.items.map(
                    (
                      item
                    ) => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              item.name
                            }
                          </strong>

                          <small>
                            {
                              item.brand ||
                              "—"
                            }
                          </small>
                        </td>

                        <td>
                          {
                            item.providerCode
                          }
                        </td>

                        <td>
                          {
                            item.articleNumber ||
                            item.externalId ||
                            "—"
                          }
                        </td>

                        <td>
                          {
                            item.ean ||
                            item.gtin ||
                            "—"
                          }
                        </td>

                        <td>
                          {
                            item.orderUnit ||
                            "—"
                          }
                          {
                            item.packageQuantity
                              ? " · " +
                                item.packageQuantity
                              : ""
                          }
                        </td>

                        <td>
                          {
                            item.lastSeenAt
                              ? new Date(
                                  item.lastSeenAt
                                ).toLocaleDateString(
                                  "de-DE"
                                )
                              : "—"
                          }
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="catalogPager">
            <div>
              <strong>
                {
                  data.filteredTotal
                }
              </strong>{" "}
              Artikel · Seite{" "}
              {
                data.page
              }{" "}
              von{" "}
              {
                data.pageCount
              }
            </div>

            <div className="catalogPagerLinks">
              <Link
                className="catalogPagerLink"
                aria-disabled={
                  data.page <= 1
                    ? "true"
                    : undefined
                }
                to={
                  "?q=" +
                  encodeURIComponent(
                    data.query
                  ) +
                  "&provider=" +
                  encodeURIComponent(
                    data.provider
                  ) +
                  "&page=" +
                  Math.max(
                    1,
                    data.page - 1
                  )
                }
              >
                Zurück
              </Link>

              <Link
                className="catalogPagerLink"
                aria-disabled={
                  data.page >=
                  data.pageCount
                    ? "true"
                    : undefined
                }
                to={
                  "?q=" +
                  encodeURIComponent(
                    data.query
                  ) +
                  "&provider=" +
                  encodeURIComponent(
                    data.provider
                  ) +
                  "&page=" +
                  Math.min(
                    data.pageCount,
                    data.page + 1
                  )
                }
              >
                Weiter
              </Link>
            </div>
          </div>
        </section>

        {actionData?.ok === true ? (
          <section className="catalogPanel">
            <h2>
              Ergebnis
            </h2>

            <p className="catalogPanelText">
              Zusammenfassung des letzten zentralen Imports.
            </p>

            <div className="catalogResultGrid">
              <Metric
                label="Global neu"
                value={
                  actionData
                    .import
                    ?.created ||
                  0
                }
              />

              <Metric
                label="Global aktualisiert"
                value={
                  actionData
                    .import
                    ?.updated ||
                  0
                }
              />

              <Metric
                label="Dateifehler"
                value={
                  actionData
                    .preview
                    ?.errors ||
                  0
                }
              />

              <Metric
                label="Mandanten-Ziele"
                value={
                  distribution
                    ?.targets ||
                  0
                }
              />

              <Metric
                label="Tenant-Artikel neu"
                value={
                  distribution
                    ?.totals
                    ?.created ||
                  0
                }
              />

              <Metric
                label="Bestehende verknüpft"
                value={
                  distribution
                    ?.totals
                    ?.linkedExisting ||
                  0
                }
              />

              <Metric
                label="Tenant-Artikel aktualisiert"
                value={
                  distribution
                    ?.totals
                    ?.updated ||
                  0
                }
              />

              <Metric
                label="Verteilung Fehler"
                value={
                  distribution
                    ?.failed ||
                  0
                }
              />
            </div>
          </section>
        ) : null}
      </div>
    </SuperAdminLayout>
  );
}
