import { prisma } from "./prisma.server";
import { materializeGlobalSupplierCatalog } from "./global-supplier-catalog-materialize.server";

function normalizeProviderCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}

function readProviderCode(connection: {
  label?: string | null;
  settingsJson?: unknown;
}) {
  const settings =
    connection.settingsJson &&
    typeof connection.settingsJson === "object" &&
    !Array.isArray(connection.settingsJson)
      ? connection.settingsJson as Record<string, unknown>
      : {};

  return normalizeProviderCode(
    settings.providerCode ||
    connection.label ||
    ""
  );
}

export async function distributeGlobalSupplierCatalog(params: {
  providerCode: string;
  tenantId?: string | null;
  supplierId?: string | null;
  onlyActiveGlobalItems?: boolean;
  perTenantLimit?: number;
}) {
  const providerCode =
    normalizeProviderCode(
      params.providerCode
    );

  if (!providerCode) {
    throw new Error(
      "Provider-Code fehlt."
    );
  }

  const connections =
    await prisma.supplierConnection.findMany({
      where: {
        active: true,
        ...(params.tenantId
          ? {
              tenantId:
                params.tenantId,
            }
          : {}),
        ...(params.supplierId
          ? {
              supplierId:
                params.supplierId,
            }
          : {}),
        supplier: {
          active: true,
        },
      },
      select: {
        id: true,
        tenantId: true,
        supplierId: true,
        label: true,
        settingsJson: true,
        updatedAt: true,
        supplier: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

  const matching =
    connections.filter(
      (connection) =>
        readProviderCode(connection) ===
        providerCode
    );

  /*
   * Pro Tenant + Lieferant nur eine Verbindung verwenden.
   * Falls mehrere alte/verwaiste Verbindungen existieren,
   * gewinnt durch orderBy updatedAt desc die aktuellste.
   */
  const uniqueTargets = new Map<
    string,
    (typeof matching)[number]
  >();

  for (const connection of matching) {
    const key =
      connection.tenantId +
      ":" +
      connection.supplierId;

    if (!uniqueTargets.has(key)) {
      uniqueTargets.set(
        key,
        connection
      );
    }
  }

  const results: Array<{
    tenantId: string;
    supplierId: string;
    supplierName: string;
    connectionId: string;
    ok: boolean;
    globalItems?: number;
    created?: number;
    updated?: number;
    linkedExisting?: number;
    skipped?: number;
    error?: string;
  }> = [];

  for (const connection of uniqueTargets.values()) {
    try {
      const result =
        await materializeGlobalSupplierCatalog({
          tenantId:
            connection.tenantId,
          supplierId:
            connection.supplierId,
          providerCode,
          connectionId:
            connection.id,
          onlyActive:
            params.onlyActiveGlobalItems !==
            false,
          limit:
            params.perTenantLimit,
        });

      results.push({
        tenantId:
          connection.tenantId,
        supplierId:
          connection.supplierId,
        supplierName:
          connection.supplier.name,
        connectionId:
          connection.id,
        ok: true,
        globalItems:
          result.globalItems,
        created:
          result.created,
        updated:
          result.updated,
        linkedExisting:
          result.linkedExisting,
        skipped:
          result.skipped,
      });
    } catch (error: any) {
      results.push({
        tenantId:
          connection.tenantId,
        supplierId:
          connection.supplierId,
        supplierName:
          connection.supplier.name,
        connectionId:
          connection.id,
        ok: false,
        error:
          String(
            error?.message ||
            error
          ),
      });
    }
  }

  return {
    providerCode,
    connectionsChecked:
      connections.length,
    matchingConnections:
      matching.length,
    targets:
      uniqueTargets.size,
    successful:
      results.filter(
        (result) =>
          result.ok
      ).length,
    failed:
      results.filter(
        (result) =>
          !result.ok
      ).length,
    totals: {
      globalItems:
        results.reduce(
          (sum, result) =>
            sum +
            Number(
              result.globalItems ||
              0
            ),
          0
        ),
      created:
        results.reduce(
          (sum, result) =>
            sum +
            Number(
              result.created ||
              0
            ),
          0
        ),
      updated:
        results.reduce(
          (sum, result) =>
            sum +
            Number(
              result.updated ||
              0
            ),
          0
        ),
      linkedExisting:
        results.reduce(
          (sum, result) =>
            sum +
            Number(
              result.linkedExisting ||
              0
            ),
          0
        ),
      skipped:
        results.reduce(
          (sum, result) =>
            sum +
            Number(
              result.skipped ||
              0
            ),
          0
        ),
    },
    results,
  };
}
