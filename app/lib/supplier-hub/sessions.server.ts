import {
  prisma
} from "../prisma.server";

import type {
  SupplierProviderCode,
  SupplierSessionRef
} from "./types";

function readObject(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function cleanText(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

function resolveProviderCode({
  supplierName,
  settingsJson
}: {
  supplierName: string;
  settingsJson: unknown;
}): SupplierProviderCode | null {
  const settings =
    readObject(
      settingsJson
    );

  const explicit =
    cleanText(
      settings.providerCode
    ).toUpperCase();

  if (explicit === "METRO") {
    return "METRO";
  }

  const normalizedName =
    supplierName
      .trim()
      .toUpperCase();

  if (
    normalizedName.includes(
      "METRO"
    )
  ) {
    return "METRO";
  }

  return null;
}

export async function resolveSupplierSessions(
  tenantId: string,
  supplierConnectionIds?: string[]
): Promise<SupplierSessionRef[]> {
  const requestedIds =
    Array.from(
      new Set(
        (
          supplierConnectionIds ||
          []
        )
          .map(
            (value) =>
              cleanText(value)
          )
          .filter(Boolean)
      )
    );

  const connections =
    await prisma
      .supplierConnection
      .findMany({
        where: {
          tenantId,
          active: true,
          ...(requestedIds.length >
          0
            ? {
                id: {
                  in:
                    requestedIds
                }
              }
            : {})
        },
        select: {
          id: true,
          tenantId: true,
          settingsJson: true,
          supplier: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        }
      });

  return connections
    .map(
      (
        connection
      ): SupplierSessionRef | null => {
        const providerCode =
          resolveProviderCode({
            supplierName:
              connection
                .supplier
                .name,
            settingsJson:
              connection
                .settingsJson
          });

        if (!providerCode) {
          return null;
        }

        /*
         * WICHTIG:
         * Hier werden KEINE Lieferanten-Passwörter,
         * Cookies oder Browser-Tokens an den
         * Gastario-Webclient gegeben.
         *
         * Der Hosted Supplier Worker identifiziert
         * die isolierte serverseitige Sitzung über
         * tenantId + supplierConnectionId.
         */
        return {
          tenantId:
            connection.tenantId,
          supplierConnectionId:
            connection.id,
          providerCode,
          sessionKey:
            connection.id
        };
      }
    )
    .filter(
      (
        value
      ): value is SupplierSessionRef =>
        value !== null
    );
}
