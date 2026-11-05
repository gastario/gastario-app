import { useState } from "react";
import {
  useLoaderData,
} from "react-router";

import {
  GastarioPage,
  GastarioHeader,
  GastarioSection,
  GastarioNotice,
  GastarioDataList,
  GastarioDataRow,
  GastarioToolbar,
  gastarioButtonClass,
} from "../components/ui";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: {
    listId?: string;
  };
}) {
  const listId =
    String(
      params.listId || ""
    ).trim();

  const token =
    new URL(
      request.url
    ).searchParams.get(
      "token"
    ) || "";

  const {
    verifyManualShoppingMobileToken,
  } =
    await import(
      "../lib/manual-shopping-mobile.server"
    );

  if (
    !listId ||
    !verifyManualShoppingMobileToken(
      listId,
      token
    )
  ) {
    throw new Response(
      "Einkaufsliste nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  const { prisma } =
    await import(
      "../lib/prisma.server"
    );

  const list =
    await prisma.manualShoppingList.findUnique({
      where: {
        id: listId,
      },
      include: {
        items: {
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
        },
      },
    });

  if (!list) {
    throw new Response(
      "Einkaufsliste nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  return {
    list: {
      id: list.id,
      title: list.title,
      planningDate:
        list.planningDate.toISOString(),
      notes:
        list.notes || "",
      items:
        list.items.map(
          (item: any) => ({
            id: item.id,
            name:
              item.name,
            quantity:
              Number(
                item.quantity
              ),
            unit:
              item.unit,
            notes:
              item.notes || "",
            checked:
              Boolean(
                item.checked
              ),
          })
        ),
    },
  };
}

function formatDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "de-DE"
  );
}

function formatQuantity(
  value: number
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return "0";
  }

  if (
    Number.isInteger(
      value
    )
  ) {
    return String(value);
  }

  return value
    .toFixed(3)
    .replace(
      /0+$/,
      ""
    )
    .replace(
      /\.$/,
      ""
    );
}

function buildShoppingText(
  list: any
) {
  const lines = [
    `Einkaufsliste – ${list.title}`,
    formatDate(
      list.planningDate
    ),
    "",
  ];

  for (
    const item of
    list.items
  ) {
    const line = [
      "☐",
      formatQuantity(
        Number(
          item.quantity
        )
      ),
      String(
        item.unit || ""
      ).trim(),
      String(
        item.name || ""
      ).trim(),
    ]
      .filter(Boolean)
      .join(" ");

    lines.push(
      item.notes
        ? `${line} – ${item.notes}`
        : line
    );
  }

  if (list.notes) {
    lines.push(
      "",
      "Notiz:",
      list.notes
    );
  }

  return lines.join(
    "\n"
  );
}

export default function MobileShoppingListPage() {
  const { list } =
    useLoaderData<
      typeof loader
    >();

  const [
    message,
    setMessage,
  ] = useState("");

  const text =
    buildShoppingText(
      list
    );

  const shareToNotes =
    async () => {
      setMessage("");

      try {
        if (
          typeof navigator.share ===
          "function"
        ) {
          await navigator.share({
            title:
              "Einkaufsliste – " +
              list.title,
            text,
          });

          return;
        }

        await navigator.clipboard.writeText(
          text
        );

        setMessage(
          "Liste kopiert. Öffne jetzt deine Notizen-App und füge sie ein."
        );
      } catch (
        error: any
      ) {
        if (
          error?.name ===
          "AbortError"
        ) {
          return;
        }

        try {
          await navigator.clipboard.writeText(
            text
          );

          setMessage(
            "Liste kopiert. Öffne jetzt deine Notizen-App und füge sie ein."
          );
        } catch {
          window.prompt(
            "Einkaufsliste kopieren:",
            text
          );
        }
      }
    };

  return (
    <GastarioPage>
      <GastarioHeader
        eyebrow="Gastario Mobil"
        title={list.title}
        subtitle={
          <>
            Einkaufsliste für{" "}
            {formatDate(
              list.planningDate
            )}
          </>
        }
      />

      <GastarioNotice type="info">
        Tippe unten auf{" "}
        <strong>
          In Notizen teilen
        </strong>
        . Wähle danach auf deinem
        Handy die Notizen-App aus.
      </GastarioNotice>

      <GastarioSection
        eyebrow="Einkauf"
        title="Einkaufsliste"
        description="Einfach auf dem Handy öffnen und anschließend in deine Notizen übernehmen."
      >
        <GastarioDataList>
          {list.items.map(
            (
              item: any
            ) => (
              <GastarioDataRow
                key={
                  item.id
                }
              >
                <div className="g-ui-data-row-main">
                  <strong className="g-ui-data-row-title">
                    {formatQuantity(
                      Number(
                        item.quantity
                      )
                    )}{" "}
                    {
                      item.unit
                    }{" "}
                    {
                      item.name
                    }
                  </strong>

                  {item.notes ? (
                    <span className="g-ui-data-row-description">
                      {
                        item.notes
                      }
                    </span>
                  ) : null}
                </div>
              </GastarioDataRow>
            )
          )}
        </GastarioDataList>
      </GastarioSection>

      {list.notes ? (
        <GastarioNotice type="neutral">
          <strong>
            Notiz:
          </strong>{" "}
          {list.notes}
        </GastarioNotice>
      ) : null}

      {message ? (
        <GastarioNotice type="success">
          {message}
        </GastarioNotice>
      ) : null}

      <GastarioToolbar align="start">
        <button
          type="button"
          className={
            gastarioButtonClass(
              "primary"
            )
          }
          onClick={
            shareToNotes
          }
        >
          In Notizen teilen
        </button>
      </GastarioToolbar>
    </GastarioPage>
  );
}