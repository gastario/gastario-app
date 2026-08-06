import {
  Form,
  Link,
  redirect,
  useLoaderData,
} from "react-router";

import AppLayout from "../components/AppLayout";

import {
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";

import "../styles/gastario-page-shell.css";
import "../styles/gastario-procurement-orders.css";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(cents || 0) / 100);
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(
    "de-DE"
  );
}

function formatDateTime(
  value: string | Date | null
) {
  if (!value) {
    return "–";
  }

  return new Date(value).toLocaleString(
    "de-DE"
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Entwurf",
    ORDERED: "Bestellt",
    PARTIALLY_RECEIVED: "Teilweise geliefert",
    RECEIVED: "Geliefert",
    CANCELLED: "Storniert",
  };

  return labels[status] || status;
}

export function meta() {
  return [
    {
      title:
        "Einkaufsbestellung · Gastario",
    },
  ];
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: {
    draftId?: string;
  };
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const draftId = String(
    params.draftId || ""
  ).trim();

  const draft =
    await prisma.procurementOrderDraft.findFirst({
      where: {
        id: draftId,
        tenantId: access.tenantId,
      },
      include: {
        items: {
          orderBy: {
            ingredientName: "asc",
          },
        },
      },
    });

  if (!draft) {
    throw new Response(
      "Einkaufsbestellung nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  const supplier = draft.supplierId
    ? await prisma.supplier.findFirst({
        where: {
          id: draft.supplierId,
          tenantId: access.tenantId,
          active: true,
        },
        select: {
          id: true,
          name: true,
          contactName: true,
          email: true,
        },
      })
    : await prisma.supplier.findFirst({
        where: {
          tenantId: access.tenantId,
          name: draft.supplierName,
          active: true,
        },
        select: {
          id: true,
          name: true,
          contactName: true,
          email: true,
        },
      });

  return {
    tenant: access.tenant,
    draft,
    supplier,
    mailConfigured: Boolean(
      String(
        process.env.MAILJET_API_KEY || ""
      ).trim() &&
        String(
          process.env.MAILJET_SECRET_KEY || ""
        ).trim() &&
        String(
          process.env.MAILJET_FROM_EMAIL ||
            process.env.MAIL_FROM_EMAIL ||
            ""
        ).trim()
    ),
  };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: {
    draftId?: string;
  };
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const draftId = String(
    params.draftId || ""
  ).trim();

  const formData = await request.formData();
  const intent = String(
    formData.get("intent") || "update-order"
  ).trim();

  if (intent === "send-procurement-order-email") {
    const draft =
      await prisma.procurementOrderDraft.findFirst({
        where: {
          id: draftId,
          tenantId: access.tenantId,
        },
        include: {
          items: {
            orderBy: {
              ingredientName: "asc",
            },
          },
        },
      });

    if (!draft) {
      throw new Response(
        "Einkaufsbestellung nicht gefunden.",
        {
          status: 404,
        }
      );
    }

    const supplier = draft.supplierId
      ? await prisma.supplier.findFirst({
          where: {
            id: draft.supplierId,
            tenantId: access.tenantId,
            active: true,
          },
          select: {
            contactName: true,
            email: true,
          },
        })
      : null;

    const recipientEmail = String(
      formData.get("recipientEmail") ||
        supplier?.email ||
        ""
    ).trim();

    const recipientName = String(
      formData.get("recipientName") ||
        supplier?.contactName ||
        draft.supplierName
    ).trim();

    const subject = String(
      formData.get("emailSubject") ||
        `Einkaufsbestellung für ${new Date(
          draft.planningDate
        ).toLocaleDateString("de-DE")}`
    ).trim();

    const message = String(
      formData.get("emailMessage") || ""
    ).trim();

    if (
      !recipientEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        recipientEmail
      )
    ) {
      throw new Response(
        "Bitte eine gültige Lieferanten-E-Mail-Adresse eintragen.",
        {
          status: 400,
        }
      );
    }

    try {
      const {
        sendProcurementOrderEmail,
      } = await import(
        "../lib/procurement-order-mail.server"
      );

      const result =
        await sendProcurementOrderEmail({
          tenantName: access.tenant.name,
          replyTo:
            access.tenant.invoiceEmail ||
            null,
          recipientEmail,
          recipientName,
          subject,
          message,
          draft,
        });

      await prisma.procurementOrderDraft.update({
        where: {
          id: draft.id,
        },
        data: {
          emailedAt: new Date(),
          emailedTo: recipientEmail,
          emailSubject: subject,
          emailMessageId:
            result.messageId || null,
          emailError: null,
          status:
            draft.status === "DRAFT"
              ? "ORDERED"
              : draft.status,
          orderedAt:
            draft.orderedAt || new Date(),
        },
      });

      return redirect(
        `/einkaufsbestellungen/${draft.id}?mail=sent`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Versandfehler.";

      await prisma.procurementOrderDraft.update({
        where: {
          id: draft.id,
        },
        data: {
          emailError:
            errorMessage.slice(0, 1000),
        },
      });

      throw new Response(
        `E-Mail-Versand fehlgeschlagen: ${errorMessage}`,
        {
          status: 502,
        }
      );
    }
  }

  const statusRaw = String(
    formData.get("status") || ""
  ).trim();

  const allowedStatuses = new Set([
    "DRAFT",
    "ORDERED",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CANCELLED",
  ]);

  if (!allowedStatuses.has(statusRaw)) {
    throw new Response(
      "Ungültiger Status.",
      {
        status: 400,
      }
    );
  }

  const draft =
    await prisma.procurementOrderDraft.findFirst({
      where: {
        id: draftId,
        tenantId: access.tenantId,
      },
      include: {
        items: true,
      },
    });

  if (!draft) {
    throw new Response(
      "Einkaufsbestellung nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  const updates = draft.items.map(
    (item: any) => {
      const packageCount = Number(
        String(
          formData.get(
            `packageCount_${item.id}`
          ) ?? item.packageCount
        ).replace(",", ".")
      );

      const receivedPackageCount = Number(
        String(
          formData.get(
            `receivedPackageCount_${item.id}`
          ) ?? item.receivedPackageCount
        ).replace(",", ".")
      );

      if (
        !Number.isFinite(packageCount) ||
        packageCount <= 0 ||
        !Number.isFinite(
          receivedPackageCount
        ) ||
        receivedPackageCount < 0 ||
        receivedPackageCount > packageCount
      ) {
        throw new Response(
          `Ungültige Menge bei ${item.ingredientName}.`,
          {
            status: 400,
          }
        );
      }

      return {
        id: item.id,
        packageCount,
        receivedPackageCount,
        netTotalCents: Math.round(
          packageCount *
            Number(
              item.netUnitPriceCents || 0
            )
        ),
      };
    }
  );

  const allReceived =
    updates.length > 0 &&
    updates.every(
      (item: any) =>
        item.receivedPackageCount >=
        item.packageCount
    );

  const anyReceived = updates.some(
    (item: any) =>
      item.receivedPackageCount > 0
  );

  let resolvedStatus = statusRaw;

  if (
    statusRaw !== "DRAFT" &&
    statusRaw !== "CANCELLED"
  ) {
    if (allReceived) {
      resolvedStatus = "RECEIVED";
    } else if (anyReceived) {
      resolvedStatus =
        "PARTIALLY_RECEIVED";
    } else if (
      statusRaw === "RECEIVED" ||
      statusRaw ===
        "PARTIALLY_RECEIVED"
    ) {
      resolvedStatus = "ORDERED";
    }
  }

  const now = new Date();

  await prisma.$transaction([
    ...updates.map((item: any) =>
      prisma.procurementOrderDraftItem.update({
        where: {
          id: item.id,
        },
        data: {
          packageCount:
            item.packageCount,
          receivedPackageCount:
            item.receivedPackageCount,
          netTotalCents:
            item.netTotalCents,
        },
      })
    ),
    prisma.procurementOrderDraft.update({
      where: {
        id: draft.id,
      },
      data: {
        status: resolvedStatus,
        netTotalCents: updates.reduce(
          (sum: number, item: any) =>
            sum +
            item.netTotalCents,
          0
        ),
        orderedAt:
          resolvedStatus === "ORDERED" ||
          resolvedStatus ===
            "PARTIALLY_RECEIVED" ||
          resolvedStatus === "RECEIVED"
            ? draft.orderedAt || now
            : null,
        receivedAt:
          resolvedStatus === "RECEIVED"
            ? draft.receivedAt || now
            : null,
      },
    }),
  ]);

  return redirect(
    `/einkaufsbestellungen/${draft.id}`
  );
}

export default function ProcurementOrderDetailPage() {
  const data = useLoaderData<typeof loader>();
  const draft = data.draft;

  return (
    <AppLayout>
      <PageShell className="procurementOrderDetailPage">
        <PageHeader
          eyebrow="Einkaufsbestellung"
          title={draft.supplierName}
          subtitle={`Planungstag ${formatDate(
            draft.planningDate
          )} · ${statusLabel(
            draft.status
          )}`}
          actions={
            <>
              <a
                className="procurementOrdersButton procurementOrdersButton--primary"
                href={`/einkaufsbestellungen/${draft.id}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                PDF herunterladen
              </a>

              <button
                type="button"
                className="procurementOrdersButton procurementOrdersButton--secondary"
                onClick={() =>
                  window.print()
                }
              >
                Drucken
              </button>

              <Link
                className="procurementOrdersButton procurementOrdersButton--secondary"
                to="/einkaufsbestellungen"
              >
                Zur Übersicht
              </Link>
            </>
          }
        />

        <PageSection
          eyebrow="Bestelldaten"
          title="Lieferantenbestellung"
          description="Bestellmengen, Liefermengen und Status verwalten."
        >
          <div className="procurementOrderFacts">
            <div>
              <span>Planungstag</span>
              <strong>
                {formatDate(
                  draft.planningDate
                )}
              </strong>
            </div>
            <div>
              <span>Planart</span>
              <strong>
                {draft.planType ===
                "PRACTICAL"
                  ? "Praktischer Plan"
                  : "Günstigster Plan"}
              </strong>
            </div>
            <div>
              <span>Bestellt am</span>
              <strong>
                {formatDateTime(
                  draft.orderedAt
                )}
              </strong>
            </div>
            <div>
              <span>Geliefert am</span>
              <strong>
                {formatDateTime(
                  draft.receivedAt
                )}
              </strong>
            </div>
            <div>
              <span>Gesamtsumme netto</span>
              <strong>
                {formatMoney(
                  draft.netTotalCents
                )}
              </strong>
            </div>
            <div>
              <span>Letzter E-Mail-Versand</span>
              <strong>
                {draft.emailedAt
                  ? formatDateTime(
                      draft.emailedAt
                    )
                  : "Noch nicht versendet"}
              </strong>
            </div>
          </div>
        </PageSection>

        <PageSection
          eyebrow="Versand"
          title="Bestellung per E-Mail senden"
          description="Die aktuelle Bestellung wird als PDF-Anhang an den Lieferanten gesendet."
        >
          <Form
            method="post"
            className="procurementOrderMailForm"
          >
            <input
              type="hidden"
              name="intent"
              value="send-procurement-order-email"
            />

            <div className="procurementOrderMailGrid">
              <label>
                <span>Empfänger</span>
                <input
                  type="email"
                  name="recipientEmail"
                  defaultValue={
                    data.supplier?.email ||
                    draft.emailedTo ||
                    ""
                  }
                  placeholder="bestellung@lieferant.de"
                  required
                />
              </label>

              <label>
                <span>Ansprechpartner</span>
                <input
                  name="recipientName"
                  defaultValue={
                    data.supplier
                      ?.contactName ||
                    draft.supplierName
                  }
                  placeholder="Ansprechpartner"
                />
              </label>

              <label className="procurementOrderMailWide">
                <span>Betreff</span>
                <input
                  name="emailSubject"
                  defaultValue={
                    draft.emailSubject ||
                    `Einkaufsbestellung für ${formatDate(
                      draft.planningDate
                    )}`
                  }
                  required
                />
              </label>

              <label className="procurementOrderMailWide">
                <span>Nachricht</span>
                <textarea
                  name="emailMessage"
                  rows={6}
                  defaultValue={[
                    `Guten Tag${
                      data.supplier
                        ?.contactName
                        ? ` ${data.supplier.contactName}`
                        : ""
                    },`,
                    "",
                    `anbei erhalten Sie unsere Einkaufsbestellung für den ${formatDate(
                      draft.planningDate
                    )}.`,
                    "",
                    "Bitte bestätigen Sie uns kurz den Erhalt und die Liefermöglichkeit.",
                    "",
                    "Vielen Dank und freundliche Grüße",
                    data.tenant.name,
                  ].join("\n")}
                />
              </label>
            </div>

            <div className="procurementOrderMailFooter">
              <div>
                {draft.emailedAt ? (
                  <span className="procurementOrderMailSuccess">
                    Zuletzt an {draft.emailedTo} am{" "}
                    {formatDateTime(
                      draft.emailedAt
                    )} versendet.
                  </span>
                ) : null}

                {draft.emailError ? (
                  <span className="procurementOrderMailError">
                    Letzter Fehler:{" "}
                    {draft.emailError}
                  </span>
                ) : null}

                {!data.mailConfigured ? (
                  <span className="procurementOrderMailWarning">
                    Mailjet ist noch nicht vollständig konfiguriert.
                  </span>
                ) : null}
              </div>

              <button
                type="submit"
                className="procurementOrdersButton procurementOrdersButton--primary"
                disabled={
                  !data.mailConfigured
                }
              >
                Bestellung mit PDF senden
              </button>
            </div>
          </Form>
        </PageSection>
        <PageSection
          eyebrow="Positionen"
          title="Bestellpositionen"
          description={`${draft.items.length} Position(en) bei ${draft.supplierName}.`}
        >
          <Form
            method="post"
            className="procurementOrderDetailForm"
          >
            <div className="procurementOrderStatusBar">
              <label>
                <span>Status</span>
                <select
                  name="status"
                  defaultValue={
                    draft.status
                  }
                >
                  <option value="DRAFT">
                    Entwurf
                  </option>
                  <option value="ORDERED">
                    Bestellt
                  </option>
                  <option value="PARTIALLY_RECEIVED">
                    Teilweise geliefert
                  </option>
                  <option value="RECEIVED">
                    Geliefert
                  </option>
                  <option value="CANCELLED">
                    Storniert
                  </option>
                </select>
              </label>

              <button
                type="submit"
                className="procurementOrdersButton procurementOrdersButton--primary"
              >
                Änderungen speichern
              </button>
            </div>

            <div className="procurementOrderDetailTableWrap">
              <table className="procurementOrderDetailTable">
                <thead>
                  <tr>
                    <th>Zutat / Artikel</th>
                    <th>Artikelnummer</th>
                    <th>Bestellt</th>
                    <th>Geliefert</th>
                    <th>Einzelpreis</th>
                    <th>Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map(
                    (item: any) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.ingredientName}
                          </strong>
                          <span>
                            {item.catalogItemName}
                          </span>
                        </td>
                        <td>
                          {item.articleNumber ||
                            "–"}
                        </td>
                        <td>
                          <input
                            type="number"
                            name={`packageCount_${item.id}`}
                            min="0.01"
                            step="0.01"
                            defaultValue={
                              item.packageCount
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            name={`receivedPackageCount_${item.id}`}
                            min="0"
                            step="0.01"
                            max={
                              item.packageCount
                            }
                            defaultValue={
                              item.receivedPackageCount
                            }
                          />
                        </td>
                        <td>
                          {formatMoney(
                            item.netUnitPriceCents
                          )}
                        </td>
                        <td>
                          <strong>
                            {formatMoney(
                              item.netTotalCents
                            )}
                          </strong>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Form>
        </PageSection>
      </PageShell>
    </AppLayout>
  );
}