import { prisma } from "../lib/prisma.server";
import { runSupplierSync } from "../lib/supplier-sync.server";
import { resolveSupplierConnectionStrategy } from "../lib/supplier-hub/connection-strategy";

/*
 * gastario-automatic-supplier-sync-route-20260729
 *
 * Interner Endpunkt fuer automatisch faellige Lieferantenabrufe.
 * Zugriff ausschliesslich mit SUPPLIER_SYNC_SECRET.
 */

function json(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}

function isAuthorized(request: Request) {
  const expectedSecret = String(
    process.env.SUPPLIER_SYNC_SECRET || ""
  ).trim();

  if (!expectedSecret) {
    return false;
  }

  const authorization = String(
    request.headers.get("Authorization") || ""
  ).trim();

  return authorization === "Bearer " + expectedSecret;
}

async function runDueSupplierConnections() {
  const now = new Date();

  const connections =
    await prisma.supplierConnection.findMany({
      where: {
        active: true,
        status: "ACTIVE",
        supplier: {
          active: true,
        },
        OR: [
          {
            nextSyncAt: null,
          },
          {
            nextSyncAt: {
              lte: now,
            },
          },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        label: true,
        status: true,
        active: true,
        settingsJson: true,
        _count: {
          select: {
            catalogItems: true,
          },
        },
        supplier: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        {
          nextSyncAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      take: 25,
    });

  const results: any[] = [];

  for (const connection of connections) {
    try {
      const strategy =
        resolveSupplierConnectionStrategy({
          providerCode: connection.label,
          status: connection.status,
          active: connection.active,
          settingsJson: connection.settingsJson,
          catalogItems:
            connection._count?.catalogItems || 0,
          priceItems: 0,
        });

      if (!strategy.live) {
        results.push({
          connectionId: connection.id,
          supplierName: connection.supplier.name,
          ok: strategy.usable,
          status: "SKIPPED",
          message:
            strategy.strategy === "CATALOG"
              ? "Vorhandene Katalogdaten werden genutzt; kein Live-Sync erforderlich."
              : strategy.strategy === "HISTORICAL"
                ? "Historische Einkaufsdaten werden genutzt; kein Live-Sync erforderlich."
                : "Keine Live-Datenquelle für eine automatische Synchronisierung verfügbar.",
          strategy: strategy.strategy,
        });
        continue;
      }

      const result = await runSupplierSync({
        connectionId: connection.id,
        tenantId: connection.tenantId,
        mode: "FULL",
      });

      results.push({
        connectionId: connection.id,
        supplierName: connection.supplier.name,
        ok: result.ok,
        status: result.status,
        message: result.message,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        pricesCreated: result.pricesCreated,
        errorsCount: result.errorsCount,
      });
    } catch (error: any) {
      results.push({
        connectionId: connection.id,
        supplierName: connection.supplier.name,
        ok: false,
        status: "FAILED",
        message: String(
          error?.message || error
        ),
      });
    }
  }

  return {
    checkedAt: now.toISOString(),
    connectionsFound: connections.length,
    successful: results.filter(
      (result) => result.ok
    ).length,
    failed: results.filter(
      (result) => !result.ok
    ).length,
    results,
  };
}

export async function loader({
  request,
}: {
  request: Request;
}) {
  if (!isAuthorized(request)) {
    return json(
      {
        ok: false,
        error: "Nicht autorisiert.",
      },
      401
    );
  }

  const result =
    await runDueSupplierConnections();

  return json({
    ok: true,
    ...result,
  });
}

export async function action({
  request,
}: {
  request: Request;
}) {
  if (!isAuthorized(request)) {
    return json(
      {
        ok: false,
        error: "Nicht autorisiert.",
      },
      401
    );
  }

  const result =
    await runDueSupplierConnections();

  return json({
    ok: true,
    ...result,
  });
}
