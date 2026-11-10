import { Form, Link, useActionData, useLoaderData } from "react-router";
import { useEffect, useState } from "react";

import AppLayout from "../components/AppLayout";

import {
  MetricCard,
  MetricGrid,
  Notice,
  PageHeader,
  PageSection,
  PageShell,
} from "../components/ui/PageShell";
import { GastarioButton, GastarioMetricGrid, GastarioMetric, GastarioSection, GastarioInsight, GastarioDataList, GastarioDataRow, GastarioStack, GastarioBadge, GastarioFormGrid, GastarioField, GastarioInput, GastarioToolbar, GastarioDetailDialog, gastarioButtonClass } from "../components/ui";

import "../styles/gastario-page-shell.css";
import "../styles/gastario-supply-masterdesign.css";

import {
  resolveSupplierConnectionStrategy,
} from "../lib/supplier-hub/connection-strategy";

export function meta() {
  return [{ title: "Lieferanten · Gastario" }];
}

export async function loader({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "SUPPLIERS");

  /*
   * gastario-supplier-connections-ui-20260729
   * Lieferanten inklusive Verbindungen, Katalogen und aktuellem Preisstand.
   */
  const suppliers = await prisma.supplier.findMany({
    where: {
      tenantId: access.tenantId,
    },
    include: {
      supplierConnections: {
        orderBy: [
          { active: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          syncRuns: {
            orderBy: {
              startedAt: "desc",
            },
            take: 1,
          },
          _count: {
            select: {
              catalogItems: true,
              syncRuns: true,
            },
          },
        },
      },
      supplierCatalogItems: {
        orderBy: {
          name: "asc",
        },
        include: {
          prices: {
            orderBy: {
              fetchedAt: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [
      { active: "desc" },
      { name: "asc" },
    ],
  });

  /*
   * Zugangsdaten duerfen niemals ueber den Loader
   * an den Browser ausgeliefert werden.
   */
  const safeSuppliers = suppliers.map((supplier: any) => ({
    ...supplier,
    supplierConnections:
      supplier.supplierConnections.map(
        (connection: any) => {
          const {
            credentialsEncrypted:
              _credentialsEncrypted,
            ...safeConnection
          } = connection;

          const rawSettings =
            connection.settingsJson &&
            typeof connection.settingsJson ===
              "object" &&
            !Array.isArray(
              connection.settingsJson
            )
              ? connection.settingsJson
              : {};

          const {
            browserConnectorTokenHash:
              _browserConnectorTokenHash,
            portalSessionEncrypted:
              _portalSessionEncrypted,
            ...safeSettings
          } = rawSettings as Record<
            string,
            unknown
          >;

          const effectiveCustomerNumber = String(
            safeConnection.customerNumber ||
              (safeSettings as Record<string, unknown>)
                .customerNumber ||
              ""
          ).trim();

          return {
            ...safeConnection,
            settingsJson: {
              ...safeSettings,
              customerNumber:
                effectiveCustomerNumber || null,
            },
            hasPortalCredentials: Boolean(
              connection.credentialsEncrypted
            ),
          };
        }
      ),
  }));

  const activeSuppliers = safeSuppliers.filter(
    (supplier: any) => supplier.active
  );
  const mainCategories = Array.from(
    new Set(activeSuppliers.map((supplier) => supplier.category).filter(Boolean))
  );

  const freshnessLimit = Date.now() - 24 * 60 * 60 * 1000;

  const connections = safeSuppliers.flatMap((supplier: any) => {
    return supplier.supplierConnections.map((connection: any) => ({
      ...connection,
      supplierName: supplier.name,
      supplierActive: supplier.active,
    }));
  });

  const catalogItems = safeSuppliers.flatMap((supplier: any) => {
    return supplier.supplierCatalogItems.map((item: any) => ({
      ...item,
      supplierName: supplier.name,
    }));
  });

  const catalogItemsWithPrice = catalogItems.filter((item: any) => {
    return item.prices.length > 0;
  });

  const currentPriceItems = catalogItemsWithPrice.filter((item: any) => {
    const fetchedAt = new Date(item.prices[0].fetchedAt).getTime();

    return Number.isFinite(fetchedAt) && fetchedAt >= freshnessLimit;
  });

  const stalePriceItems = catalogItemsWithPrice.filter((item: any) => {
    const fetchedAt = new Date(item.prices[0].fetchedAt).getTime();

    return !Number.isFinite(fetchedAt) || fetchedAt < freshnessLimit;
  });

  const usableConnections =
    connections.filter(
      (connection: any) => {
        const strategy =
          resolveSupplierConnectionStrategy({
            providerCode:
              connection.label,
            status:
              connection.status,
            active:
              connection.active,
            settingsJson:
              connection.settingsJson,
            catalogItems:
              connection._count?.catalogItems ||
              0,
            priceItems:
              connection._count?.catalogItems ||
              0,
          });

        return strategy.usable;
      }
    );

  const liveConnections =
    connections.filter(
      (connection: any) => {
        const strategy =
          resolveSupplierConnectionStrategy({
            providerCode:
              connection.label,
            status:
              connection.status,
            active:
              connection.active,
            settingsJson:
              connection.settingsJson,
            catalogItems:
              connection._count?.catalogItems ||
              0,
            priceItems:
              connection._count?.catalogItems ||
              0,
          });

        return strategy.live;
      }
    );
  return {
    tenant: access.tenant,
    suppliers: safeSuppliers,
    connections,
    catalogItems,
    currentPriceItems,
    stalePriceItems,
    stats: {
      total: suppliers.length,
      active: activeSuppliers.length,
      categories: mainCategories.length,
      inactive: suppliers.length - activeSuppliers.length,
      connections: connections.length,
      activeConnections: connections.filter(
        (connection: any) =>
          connection.active &&
          connection.status === "ACTIVE"
      ).length,
      usableConnections:
        usableConnections.length,
      liveConnections:
        liveConnections.length,
      catalogItems: catalogItems.length,
      currentPrices: currentPriceItems.length,
      stalePrices: stalePriceItems.length,
    },
  };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const { requireTenantFeature } = await import("../lib/features.server");

  const access = await requireTenantFeature(request, "SUPPLIERS");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createSupplier") {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      return { error: "Lieferantenname fehlt." };
    }

    await prisma.supplier.create({
      data: {
        tenantId: access.tenantId,
        name,
        category: String(formData.get("category") || "").trim() || null,
        contactName: String(formData.get("contactName") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        items: String(formData.get("items") || "").trim() || null,
        orderDays: String(formData.get("orderDays") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
        active: true,
      },
    });

    return { success: "Lieferant wurde angelegt." };
  }

  if (intent === "createConnection") {
    const supplierId = String(
      formData.get("supplierId") || ""
    ).trim();

    const providerCode = String(
      formData.get("providerCode") || ""
    ).trim();

    const provider = automaticSupplierProviders.find(
      (entry) => entry.code === providerCode
    );

    if (!supplierId) {
      return {
        error: "Bitte einen Lieferanten auswählen.",
      };
    }

    if (!provider) {
      return {
        error: "Bitte einen unterstützten Anbieter auswählen.",
      };
    }

    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId: access.tenantId,
      },
    });

    if (!supplier) {
      return {
        error: "Lieferant nicht gefunden.",
      };
    }

    const existingConnection =
      await prisma.supplierConnection.findFirst({
        where: {
          tenantId: access.tenantId,
          supplierId: supplier.id,
          active: true,
        },
      });

    if (existingConnection) {
      return {
        error:
          "Für diesen Lieferanten besteht bereits eine aktive Verbindung.",
      };
    }

    const customerNumber = String(
      formData.get("customerNumber") || ""
    ).trim();

    const locationName = String(
      formData.get("locationName") || ""
    ).trim();

    await prisma.supplierConnection.create({
      data: {
        tenantId: access.tenantId,
        supplierId: supplier.id,
        type: provider.internalType as any,
        status: "CONFIGURED",
        label: provider.name,
        customerNumber: customerNumber || null,
        syncIntervalMinutes: 360,
        active: true,
        settingsJson: {
          providerCode: provider.code,
          providerName: provider.name,
          customerNumber: customerNumber || null,
          locationName: locationName || null,
          automaticSync: true,
          fullCatalogSyncHour: 4,
          priceRefreshHours: [8, 12, 16],
          liveCheckBeforePurchase: true,
          onboardingStatus: "ACCESS_REQUIRED",
        },
      },
    });

    return {
      success:
        provider.name +
        " wurde für die automatische Verbindung vorbereitet.",
    };
  }
  /*
   * gastario-supplier-portal-credentials-20260802
   * Zugangsdaten werden ausschliesslich verschluesselt gespeichert.
   */
  if (intent === "savePortalCredentials") {
    const connectionId = String(
      formData.get("connectionId") || ""
    ).trim();

    const customerNumber = String(
      formData.get("customerNumber") || ""
    ).trim();

    const locationName = String(
      formData.get("locationName") || ""
    ).trim();

    const username = String(
      formData.get("username") || ""
    ).trim();

    const password = String(
      formData.get("password") || ""
    );

    if (!connectionId) {
      return {
        error: "Lieferantenverbindung fehlt.",
      };
    }

    if (!customerNumber) {
      return {
        error: "Bitte die METRO-Kundennummer eintragen.",
      };
    }

    if (!username || !password) {
      return {
        error:
          "Bitte METRO-Benutzername und Passwort vollständig eintragen.",
      };
    }

    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: connectionId,
          tenantId: access.tenantId,
        },
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
        },
      });

    if (!connection) {
      return {
        error: "Lieferantenverbindung nicht gefunden.",
      };
    }

    const previousSettings =
      connection.settingsJson &&
      typeof connection.settingsJson === "object" &&
      !Array.isArray(connection.settingsJson)
        ? connection.settingsJson
        : {};

    const providerCode = String(
      (previousSettings as any).providerCode ||
        connection.label ||
        connection.supplier.name
    )
      .trim()
      .toUpperCase();

    if (providerCode !== "METRO") {
      return {
        error:
          "Der sichere Portal-Login wird zuerst für METRO eingerichtet.",
      };
    }

    try {
      const {
        createSupplierPortalAccountHint,
        encryptSupplierPortalCredentials,
      } = await import(
        "../lib/supplier-portal-credentials.server"
      );

      const credentialsEncrypted =
        encryptSupplierPortalCredentials({
          providerCode: "METRO",
          username,
          password,
          portalUrl:
            "https://lieferservice.metro.de/",
          savedAt: new Date().toISOString(),
        });

      await prisma.supplierConnection.update({
        where: {
          id: connection.id,
        },
        data: {
          customerNumber,
          endpointUrl:
            "https://lieferservice.metro.de/",
          credentialsEncrypted,
          status: "CONFIGURED",
          lastError: null,
          settingsJson: {
            ...(previousSettings as Record<
              string,
              unknown
            >),
            providerCode: "METRO",
            providerName: "METRO",
            connectionMode: "PORTAL_BROWSER",
            portalUrl:
              "https://lieferservice.metro.de/",
            customerNumber,
            locationName: locationName || null,
            accountHint:
              createSupplierPortalAccountHint(
                username
              ),
            credentialsSavedAt:
              new Date().toISOString(),
            onboardingStatus:
              "CREDENTIALS_SAVED",
            sessionStatus: "CREDENTIALS_SAVED",
            portalSessionEncrypted: null,
            sessionSavedAt: null,
            sessionExpiresAt: null,
            automaticSync: false,
          },
        },
      });
    } catch (error: any) {
      return {
        error: String(
          error?.message || error
        ),
      };
    }

    return {
      success:
        "Der METRO-Zugang wurde verschlüsselt gespeichert. Der Preisabruf bleibt bis zum erfolgreichen Browser-Login gesperrt.",
    };
  }

  if (intent === "clearPortalCredentials") {
    const connectionId = String(
      formData.get("connectionId") || ""
    ).trim();

    if (!connectionId) {
      return {
        error: "Lieferantenverbindung fehlt.",
      };
    }

    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: connectionId,
          tenantId: access.tenantId,
        },
        select: {
          id: true,
          settingsJson: true,
        },
      });

    if (!connection) {
      return {
        error: "Lieferantenverbindung nicht gefunden.",
      };
    }

    const previousSettings =
      connection.settingsJson &&
      typeof connection.settingsJson === "object" &&
      !Array.isArray(connection.settingsJson)
        ? connection.settingsJson
        : {};

    await prisma.supplierConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        credentialsEncrypted: null,
        status: "CONFIGURED",
        lastError: null,
        settingsJson: {
          ...(previousSettings as Record<
            string,
            unknown
          >),
          accountHint: null,
          credentialsSavedAt: null,
          onboardingStatus: "ACCESS_REQUIRED",
          sessionStatus: "LOGIN_REQUIRED",
          portalSessionEncrypted: null,
          sessionSavedAt: null,
          sessionExpiresAt: null,
          automaticSync: false,
        },
      },
    });

    return {
      success: "Der gespeicherte Portalzugang wurde entfernt.",
    };
  }

  /*
   * gastario-local-supplier-browser-connector-20260803
   * Erstellt einen einmal sichtbaren Verbindungscode fuer die
   * lokale Chrome-Erweiterung. In der Datenbank wird nur der
   * SHA-256-Hash des geheimen Codeanteils gespeichert.
   */
  if (intent === "generateBrowserConnectorCode") {
    const connectionId = String(
      formData.get("connectionId") || ""
    ).trim();

    if (!connectionId) {
      return {
        error: "Lieferantenverbindung fehlt.",
      };
    }

    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: connectionId,
          tenantId: access.tenantId,
        },
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
        },
      });

    if (!connection) {
      return {
        error: "Lieferantenverbindung nicht gefunden.",
      };
    }

    const previousSettings =
      connection.settingsJson &&
      typeof connection.settingsJson === "object" &&
      !Array.isArray(connection.settingsJson)
        ? connection.settingsJson
        : {};

    const providerCode = String(
      (previousSettings as any).providerCode ||
        connection.label ||
        connection.supplier.name
    )
      .trim()
      .toUpperCase();

    if (providerCode !== "METRO") {
      return {
        error:
          "Der lokale Browser-Connector wird zuerst für METRO eingerichtet.",
      };
    }

    const {
      createSupplierBrowserConnectorCode,
    } = await import(
      "../lib/supplier-browser-connector.server"
    );

    const generated =
      createSupplierBrowserConnectorCode(
        connection.id
      );

    await prisma.supplierConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        status: "CONFIGURED",
        credentialsEncrypted: null,
        lastError: null,
        nextSyncAt: null,
        settingsJson: {
          ...(previousSettings as Record<
            string,
            unknown
          >),
          connectionMode:
            "LOCAL_BROWSER_EXTENSION",
          browserConnectorStatus:
            "PAIRING_READY",
          browserConnectorTokenHash:
            generated.tokenHash,
          browserConnectorTokenLastFour:
            generated.tokenLastFour,
          browserConnectorTokenCreatedAt:
            generated.createdAt,
          browserConnectorRevokedAt: null,
          browserConnectorLastSeenAt: null,
          browserConnectorLastCaptureAt: null,
          browserConnectorLastCaptureItems: 0,
          onboardingStatus:
            "BROWSER_CONNECTOR_READY",
          sessionStatus:
            "LOCAL_BROWSER_READY",
          portalSessionEncrypted: null,
          sessionSavedAt: null,
          sessionExpiresAt: null,
          automaticSync: false,
        },
      },
    });

    return {
      success:
        "Der Chrome-Connector wurde vorbereitet. Der nicht mehr benötigte Server-Zugang wurde entfernt. Kopiere den Verbindungscode jetzt in die Erweiterung.",
      browserConnectorCode: generated.code,
      browserConnectorConnectionId:
        connection.id,
    };
  }

  if (intent === "revokeBrowserConnectorCode") {
    const connectionId = String(
      formData.get("connectionId") || ""
    ).trim();

    if (!connectionId) {
      return {
        error: "Lieferantenverbindung fehlt.",
      };
    }

    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: connectionId,
          tenantId: access.tenantId,
        },
        select: {
          id: true,
          settingsJson: true,
        },
      });

    if (!connection) {
      return {
        error: "Lieferantenverbindung nicht gefunden.",
      };
    }

    const previousSettings =
      connection.settingsJson &&
      typeof connection.settingsJson === "object" &&
      !Array.isArray(connection.settingsJson)
        ? connection.settingsJson
        : {};

    await prisma.supplierConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        status: "CONFIGURED",
        lastError: null,
        settingsJson: {
          ...(previousSettings as Record<
            string,
            unknown
          >),
          browserConnectorStatus:
            "REVOKED",
          browserConnectorTokenHash: null,
          browserConnectorTokenLastFour: null,
          browserConnectorTokenCreatedAt: null,
          browserConnectorRevokedAt:
            new Date().toISOString(),
          onboardingStatus:
            "BROWSER_CONNECTOR_REQUIRED",
          sessionStatus:
            "LOCAL_BROWSER_REVOKED",
          automaticSync: false,
        },
      },
    });

    return {
      success:
        "Der Chrome-Verbindungscode wurde widerrufen.",
    };
  }

  /*
   * gastario-update-supplier-connection-20260729
   * Speichert Kundennummer und Standort einer bestehenden
   * automatischen Lieferantenverbindung.
   */
  if (intent === "updateSupplierConnection") {
    const connectionId = String(
      formData.get("connectionId") || ""
    ).trim();

    const customerNumber = String(
      formData.get("customerNumber") || ""
    ).trim();

    const locationName = String(
      formData.get("locationName") || ""
    ).trim();

    if (!connectionId) {
      return {
        error: "Lieferantenverbindung fehlt.",
      };
    }

    if (!customerNumber) {
      return {
        error: "Bitte die Kundennummer eintragen.",
      };
    }

    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: connectionId,
          tenantId: access.tenantId,
        },
        select: {
          id: true,
          settingsJson: true,
        },
      });

    if (!connection) {
      return {
        error: "Lieferantenverbindung nicht gefunden.",
      };
    }

    const previousSettings =
      connection.settingsJson &&
      typeof connection.settingsJson === "object" &&
      !Array.isArray(connection.settingsJson)
        ? connection.settingsJson
        : {};

    await prisma.supplierConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        customerNumber,
        status: "CONFIGURED",
        lastError: null,
        settingsJson: {
          ...(previousSettings as Record<string, unknown>),
          customerNumber,
          locationName: locationName || null,
          onboardingStatus: "ACCESS_REQUIRED",
          automaticSync: true,
        },
      },
    });

    return {
      success:
        "Kundennummer und Standort wurden gespeichert.",
    };
  }
  /*
   * gastario-metro-browser-login-worker-20260802
   * Der Railway-Browserworker testet den verschluesselten Zugang
   * und speichert nur eine verschluesselte Portalsitzung.
   */
  if (intent === "testPortalLogin") {
    const connectionId = String(
      formData.get("connectionId") || ""
    ).trim();

    if (!connectionId) {
      return {
        error: "Lieferantenverbindung fehlt.",
      };
    }

    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: connectionId,
          tenantId: access.tenantId,
        },
        select: {
          id: true,
          credentialsEncrypted: true,
        },
      });

    if (!connection) {
      return {
        error: "Lieferantenverbindung nicht gefunden.",
      };
    }

    if (!connection.credentialsEncrypted) {
      return {
        error:
          "Bitte zuerst den METRO-Zugang sicher speichern.",
      };
    }

    try {
      const { startSupplierPortalLogin } =
        await import(
          "../lib/supplier-portal-worker.server"
        );

      const result =
        await startSupplierPortalLogin({
          connectionId: connection.id,
          tenantId: access.tenantId,
        });

      if (!result.ok) {
        return {
          error: result.message,
        };
      }

      return {
        success: result.mfaRequired
          ? "METRO verlangt einen Sicherheitscode. Bitte den Code in der Verbindungskarte eingeben."
          : "Die METRO-Anmeldung war erfolgreich. Die verschlüsselte Portalsitzung wurde gespeichert.",
      };
    } catch (error: any) {
      return {
        error: String(
          error?.message || error
        ),
      };
    }
  }

  if (intent === "submitPortalOtp") {
    const connectionId = String(
      formData.get("connectionId") || ""
    ).trim();

    const code = String(
      formData.get("code") || ""
    )
      .replace(/\s+/g, "")
      .trim();

    if (!connectionId) {
      return {
        error: "Lieferantenverbindung fehlt.",
      };
    }

    if (!/^[0-9A-Za-z-]{4,12}$/.test(code)) {
      return {
        error:
          "Bitte den vollständigen METRO-Sicherheitscode eingeben.",
      };
    }

    try {
      const { submitSupplierPortalOtp } =
        await import(
          "../lib/supplier-portal-worker.server"
        );

      const result =
        await submitSupplierPortalOtp({
          connectionId,
          tenantId: access.tenantId,
          code,
        });

      if (!result.ok) {
        return {
          error: result.message,
        };
      }

      return {
        success:
          "Der Sicherheitscode wurde bestätigt. Die METRO-Sitzung ist jetzt aktiv.",
      };
    } catch (error: any) {
      return {
        error: String(
          error?.message || error
        ),
      };
    }
  }

  /*
   * gastario-supplier-sync-actions-20260729
   * Startet ausschliesslich den echten serverseitigen Connector.
   * Es werden niemals Testpreise oder erfundene Artikel gespeichert.
   */
  if (intent === "syncSupplierConnection") {
    const connectionId = String(
      formData.get("connectionId") || ""
    ).trim();

    if (!connectionId) {
      return {
        error: "Lieferantenverbindung fehlt.",
      };
    }

    const connection =
      await prisma.supplierConnection.findFirst({
        where: {
          id: connectionId,
          tenantId: access.tenantId,
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
        },
      });

    if (!connection) {
      return {
        error: "Lieferantenverbindung nicht gefunden.",
      };
    }

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

    if (strategy.strategy === "CATALOG") {
      return {
        success:
          "Die vorhandenen Katalogdaten sind als Datenquelle aktiv. Ein Live-Sync ist für diese Verbindung derzeit nicht erforderlich.",
      };
    }

    if (strategy.strategy === "HISTORICAL") {
      return {
        success:
          "Historische Einkaufsdaten sind als Datenquelle aktiv. Ein Live-Sync ist für diese Verbindung derzeit nicht erforderlich.",
      };
    }

    if (!strategy.live) {
      return {
        error:
          "Für diese Lieferantenverbindung ist derzeit keine Live-Schnittstelle verfügbar.",
      };
    }

    const { runSupplierSync } = await import(
      "../lib/supplier-sync.server"
    );

    const result = await runSupplierSync({
      connectionId: connection.id,
      tenantId: access.tenantId,
      mode: "FULL",
    });

    if (!result.ok) {
      return {
        error:
          result.providerName +
          ": " +
          result.message,
      };
    }

    return {
      success:
        result.providerName +
        " wurde aktualisiert. " +
        result.itemsCreated +
        " Artikel neu, " +
        result.itemsUpdated +
        " Artikel aktualisiert und " +
        result.pricesCreated +
        " Preise gespeichert.",
    };
  }

  const supplierId = String(formData.get("supplierId") || "");

  if (!supplierId) {
    return { error: "Lieferant fehlt." };
  }

  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      tenantId: access.tenantId,
    },
  });

  if (!supplier) {
    return { error: "Lieferant nicht gefunden." };
  }

  if (intent === "updateSupplier") {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      return { error: "Lieferantenname fehlt." };
    }

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        name,
        category: String(formData.get("category") || "").trim() || null,
        contactName: String(formData.get("contactName") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        phone: String(formData.get("phone") || "").trim() || null,
        items: String(formData.get("items") || "").trim() || null,
        orderDays: String(formData.get("orderDays") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
      },
    });

    return { success: "Lieferant wurde gespeichert." };
  }

  if (intent === "toggleActive") {
    const active = String(formData.get("active") || "") === "true";

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { active },
    });

    return { success: active ? "Lieferant wurde aktiviert." : "Lieferant wurde deaktiviert." };
  }

  if (intent === "deleteSupplier") {
    await prisma.supplier.delete({
      where: { id: supplier.id },
    });

    return { success: "Lieferant wurde geloescht." };
  }

  return { error: "Unbekannte Aktion." };
}

/*
 * gastario-automatic-supplier-connectors-20260729
 * Nutzer wählen konkrete Lieferanten statt technischer Schnittstellentypen.
 */
const automaticSupplierProviders = [
  {
    code: "METRO",
    name: "METRO",
    description:
      "Automatischer Abruf kundenspezifischer Preise und Verfügbarkeit.",
    internalType: "API",
  },
  {
    code: "TRANSGOURMET",
    name: "Transgourmet",
    description:
      "Automatischer Preis- und Sortimentsabgleich für das Kundenkonto.",
    internalType: "API",
  },
  {
    code: "CHEFS_CULINAR",
    name: "CHEFS CULINAR",
    description:
      "Automatischer Katalog-, Preis- und Verfügbarkeitsabgleich.",
    internalType: "API",
  },
  {
    code: "SELGROS",
    name: "Selgros",
    description:
      "Automatischer Abruf von Sortiment und kundenspezifischen Preisen.",
    internalType: "API",
  },
  {
    code: "OTHER",
    name: "Weiterer Lieferant",
    description:
      "Gastario richtet den passenden offiziellen Datenkanal ein.",
    internalType: "API",
  },
] as const;
export default function SuppliersPage() {
  /*
   * gastario-suppliers-masterdesign-v1-20260802
   *
   * Stammdaten- und Verbindungslogik bleiben unverändert.
   * Die Oberfläche nennt vorbereitete Konten bewusst
   * Lieferantenportale statt fertiger API-Schnittstellen.
   */
  const data = useLoaderData<typeof loader>();
  const actionData =
    useActionData<typeof action>() as any;

  const [newSupplierOpen, setNewSupplierOpen] = useState(false);

  useEffect(() => {
    if (actionData?.success) setNewSupplierOpen(false);
  }, [actionData]);

  const printPage = () => {
    window.print();
  };

  return (
    <AppLayout>
            <PageShell className="supplyPage supplyDashboardV1Page">
        <PageHeader
          eyebrow="Einkauf & Lager"
          title="Lieferanten"
          subtitle={<>Lieferanten, Portale und Einkaufspreise für {data.tenant.name} verwalten.</>}
          actions={
            <>
              <GastarioButton variant="secondary" onClick={printPage}>Drucken</GastarioButton>
              <a href="#portal-new" className={gastarioButtonClass("secondary")}>Portal verbinden</a>
              <Link to="/lieferanten/rechnungs-import" className={gastarioButtonClass("secondary")}>Katalog importieren</Link>
              <GastarioButton variant="primary" onClick={() => setNewSupplierOpen(true)}>+ Neuer Lieferant</GastarioButton>
            </>
          }
        />

        {actionData?.success ? (
          <Notice type="success">
            {actionData.success}
          </Notice>
        ) : null}

        {actionData?.error ? (
          <Notice type="danger">
            {actionData.error}
          </Notice>
        ) : null}

        <GastarioMetricGrid>
          <GastarioMetric label="Lieferanten" value={data.stats.total} description={`${data.stats.active} aktiv`} badge="Bestand" />
          <GastarioMetric label="Nutzbare Quellen" value={data.stats.usableConnections} description={`${data.stats.liveConnections} live`} badge="Portale" />
          <GastarioMetric label="Katalogartikel" value={data.stats.catalogItems} description="Einkaufsdaten" badge="Katalog" />
          <GastarioMetric label="Aktuelle Preise" value={data.stats.currentPrices}
            description={data.stats.stalePrices > 0 ? `${data.stats.stalePrices} prüfen` : "Aktuell"} badge="Preise" />
        </GastarioMetricGrid>

        <GastarioDetailDialog
          open={newSupplierOpen}
          title="Neuen Lieferanten anlegen"
          description="Kontaktdaten, Bestelltage und Sortiment erfassen."
          onClose={() => setNewSupplierOpen(false)}
          size="lg"
          footer={
            <>
              <GastarioButton variant="secondary" onClick={() => setNewSupplierOpen(false)}>
                Abbrechen
              </GastarioButton>
              <GastarioButton variant="primary" type="submit" form="supplier-create-form">
                Lieferant anlegen
              </GastarioButton>
            </>
          }
        >
          <Form method="post" id="supplier-create-form">
            <input type="hidden" name="intent" value="createSupplier" />
            <GastarioFormGrid columns={2}>
              <GastarioField label="Name" required>
                <GastarioInput name="name" placeholder="z. B. METRO" required />
              </GastarioField>
              <GastarioField label="Kategorie">
                <GastarioInput name="category" placeholder="Lebensmittel" />
              </GastarioField>
              <GastarioField label="Ansprechpartner">
                <GastarioInput name="contactName" placeholder="Herr / Frau …" />
              </GastarioField>
              <GastarioField label="Bestelltage">
                <GastarioInput name="orderDays" placeholder="Mo–Fr" />
              </GastarioField>
              <GastarioField label="E-Mail">
                <GastarioInput name="email" type="email" placeholder="bestellung@…" />
              </GastarioField>
              <GastarioField label="Telefon">
                <GastarioInput name="phone" placeholder="030 …" />
              </GastarioField>
              <GastarioField label="Artikel / Sortiment">
                <GastarioInput name="items" placeholder="Reis, Hähnchen, Gemüse …" />
              </GastarioField>
              <GastarioField label="Notiz">
                <GastarioInput name="notes" placeholder="Optional" />
              </GastarioField>
            </GastarioFormGrid>
          </Form>
        </GastarioDetailDialog>

        <GastarioStack>
          <div>
            <GastarioSection
              className="supplyV1UnifiedPanel"
              eyebrow="Lieferanten & Einkaufsdaten"
              title="Lieferantenübersicht"
              description="Lieferanten, Portale, Kataloge und Preisstände in einer gemeinsamen Arbeitsansicht."
              action={<GastarioButton variant="secondary" onClick={() => setNewSupplierOpen(true)}>Lieferant hinzufügen</GastarioButton>}
            >

              {data.suppliers.length === 0 ? (
                <div className="supplyEmpty supplyV1UnifiedEmpty">
                  <strong>Noch keine Lieferanten angelegt</strong>
                  <p>
                    Lege deinen ersten Lieferanten an und verbinde anschließend das passende Portal.
                  </p>
                </div>
              ) : (
                <GastarioDataList>

                  {data.suppliers.map((supplier: any) => {
                    const connection = data.connections.find(
                      (entry: any) =>
                        entry.supplierId === supplier.id
                    );

                    const catalogCount =
                      supplier.supplierCatalogItems?.length || 0;

                    const currentPriceCount =
                      supplier.supplierCatalogItems?.filter(
                        (item: any) =>
                          Array.isArray(item.prices) &&
                          item.prices.length > 0
                      ).length || 0;

                    const connectionStatus =
                      connection?.status === "ACTIVE"
                        ? "Aktiv"
                        : connection
                          ? "Einrichtung"
                          : "Nicht verbunden";

                    return (
                      <GastarioDataRow key={supplier.id}>
                        <div className="g-ui-data-row-main">
                          <strong className="g-ui-data-row-title">{supplier.name}</strong>
                          <span className="g-ui-data-row-description">
                            {supplier.category || "Ohne Kategorie"} · {supplier.contactName || supplier.email || "Keine Kontaktdaten"}
                          </span>
                          <span className="g-ui-data-row-description">
                            {connection?.settingsJson?.providerName || connection?.label || "Kein Portal"}
                            {" · "}{connection?.settingsJson?.locationName || "Kein Standort"}
                          </span>
                        </div>
                        <div className="g-ui-data-row-meta">
                          <GastarioBadge variant={connection?.status === "ACTIVE" ? "success" : connection ? "warning" : "neutral"}>
                            {connectionStatus}
                          </GastarioBadge>
                          <span>{catalogCount} Artikel</span>
                          <span>{currentPriceCount} Preise</span>
                          <span>{supplier.active ? "Aktiv" : "Inaktiv"}</span>
                        </div>
                        <div className="g-ui-data-row-actions">
                        <>
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="toggleActive"
                            />
                            <input
                              type="hidden"
                              name="supplierId"
                              value={supplier.id}
                            />
                            <input
                              type="hidden"
                              name="active"
                              value={
                                supplier.active
                                  ? "false"
                                  : "true"
                              }
                            />
                            <button
                              className={gastarioButtonClass("secondary")}
                              type="submit"
                            >
                              {supplier.active
                                ? "Deaktivieren"
                                : "Aktivieren"}
                            </button>
                          </Form>

                          <details className="supplyV1RowDetails">
                            <summary className={gastarioButtonClass("secondary")}>
                              Bearbeiten
                            </summary>

                            <Form
                              method="post"
                              className="supplyEditGrid"
                            >
                              <input
                                type="hidden"
                                name="intent"
                                value="updateSupplier"
                              />
                              <input
                                type="hidden"
                                name="supplierId"
                                value={supplier.id}
                              />
                              <input
                                name="name"
                                defaultValue={supplier.name}
                              />
                              <input
                                name="category"
                                defaultValue={
                                  supplier.category || ""
                                }
                                placeholder="Kategorie"
                              />
                              <input
                                name="contactName"
                                defaultValue={
                                  supplier.contactName || ""
                                }
                                placeholder="Ansprechpartner"
                              />
                              <input
                                name="orderDays"
                                defaultValue={
                                  supplier.orderDays || ""
                                }
                                placeholder="Bestelltage"
                              />
                              <input
                                name="email"
                                type="email"
                                defaultValue={
                                  supplier.email || ""
                                }
                                placeholder="E-Mail"
                              />
                              <input
                                name="phone"
                                defaultValue={
                                  supplier.phone || ""
                                }
                                placeholder="Telefon"
                              />
                              <input
                                className="supplyEditWide"
                                name="items"
                                defaultValue={
                                  supplier.items || ""
                                }
                                placeholder="Sortiment"
                              />
                              <input
                                className="supplyEditWide"
                                name="notes"
                                defaultValue={
                                  supplier.notes || ""
                                }
                                placeholder="Notiz"
                              />
                              <button
                                className="supplyButton supplyButton--primary supplyEditWide"
                                type="submit"
                              >
                                Speichern
                              </button>
                            </Form>
                          </details>

                          <a
                            className={gastarioButtonClass("secondary")}
                            href="#portal-technical"
                          >
                            {connection
                              ? "Portal"
                              : "Verbinden"}
                          </a>
                          {connection &&
                          String(
                            connection?.settingsJson?.providerCode ||
                              connection?.label ||
                              supplier.name ||
                              ""
                          )
                            .trim()
                            .toUpperCase()
                            .includes("METRO") ? (
                            <a
                              className={gastarioButtonClass("secondary")}
                              href="/api/supplier-hub/connect/metro"
                              target="_blank"
                              rel="noreferrer"
                            >
                              METRO verbinden
                            </a>
                          ) : null}
                        </>
                        </div>
                      </GastarioDataRow>
                    );
                  })}
                </GastarioDataList>
              )}

            </GastarioSection>
          </div>

        <GastarioInsight
          tone={data.stats.stalePrices > 0 ? "rose" : "sage"}
          eyebrow="Gastario Intelligence"
          title={data.stats.stalePrices > 0
            ? `${data.stats.stalePrices} Preisstände benötigen deine Aufmerksamkeit.`
            : "Lieferanten und Einkaufsdaten sind übersichtlich vorbereitet."}
          description={data.stats.connections === 0
            ? "Lege eine Lieferantenquelle an. Gastario kann mit offiziellen Schnittstellen, Katalogen oder vorhandenen Einkaufsdaten arbeiten."
            : `${data.stats.usableConnections} von ${data.stats.connections} Lieferantenquellen sind nutzbar. ${data.stats.liveConnections} davon liefern Live-Daten. ${data.stats.currentPrices} Preise sind aktuell.`}
          actionLabel="Hinweise prüfen"
          actionTo="#portal-workspace"
        />


          <GastarioSection
            eyebrow="Verbindungen"
            title="Technische Portalverwaltung"
            description="Portalverbindungen einrichten oder technisch verwalten."
          >
              <details
                className="supplyV1TechnicalPanel"
                id="portal-technical"
              >
                <summary>
                  <span>
                    <small>Technische Verwaltung</small>
                    <strong>
                      Portale und automatische Lieferantenverbindungen
                    </strong>
                    <p>
                      Nur öffnen, wenn ein Portal eingerichtet oder technisch verwaltet werden soll.
                    </p>
                  </span>
                  <b>+</b>
                </summary>

                <div className="supplyV1TechnicalBody">
<details className="supplyDisclosure supplyDisclosure--compact">
            <summary>
              <span>
                <strong>Weiteres Lieferantenportal anlegen</strong>
                <small>
                  Lieferant, Portal, Standort und Kundennummer zuordnen
                </small>
              </span>

              <span className="supplyDisclosureAction">
                Portal hinzufügen
              </span>
            </summary>

            <div className="supplyDisclosureBody">          {data.suppliers.length === 0 ? (
            <div className="supplyEmpty">
              <strong>
                Zuerst einen Lieferanten anlegen
              </strong>
              <p>
                Ein Portalzugang kann erst einem
                vorhandenen Lieferanten zugeordnet
                werden.
              </p>
            </div>
          ) : (
            <Form
              method="post"
              className="supplyPortalSetup"
            >
              <input
                type="hidden"
                name="intent"
                value="createConnection"
              />

              <label className="supplyField">
                <span>Lieferant</span>
                <select
                  name="supplierId"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Lieferant auswählen
                  </option>

                  {data.suppliers
                    .filter(
                      (supplier: any) =>
                        supplier.active
                    )
                    .map((supplier: any) => (
                      <option
                        key={supplier.id}
                        value={supplier.id}
                      >
                        {supplier.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="supplyField">
                <span>Portal</span>
                <select
                  name="providerCode"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Portal auswählen
                  </option>

                  {automaticSupplierProviders.map(
                    (provider) => (
                      <option
                        key={provider.code}
                        value={provider.code}
                      >
                        {provider.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="supplyField">
                <span>Standort / Markt</span>
                <input
                  name="locationName"
                  placeholder="z. B. Berlin-Marienfelde"
                />
              </label>

              <label className="supplyField">
                <span>Kundennummer</span>
                <input
                  name="customerNumber"
                  placeholder="optional"
                />
              </label>

              <div className="supplyPortalHint">
                <strong>
                  Automatische Server-Verbindung
                </strong>
                <span>
                  Nach dem Anlegen kann der Lieferant einmalig mit Gastario verbunden werden. Danach laufen Katalog- und Preisabfragen serverseitig.
                </span>
              </div>

              <button
                className="supplyButton supplyButton--primary"
                type="submit"
              >
                Portal anlegen
              </button>
            </Form>
          )}
            </div>
          </details>
          <div className="supplyConnectionList">
            {data.connections.length === 0 ? (
              <div className="supplyEmpty">
                <strong>
                  Noch kein Lieferantenportal vorbereitet
                </strong>
                <p>
                  Lege oben die erste Verbindung an.
                  Danach kann die sichere Anmeldung
                  eingerichtet werden.
                </p>
              </div>
            ) : (
              data.connections.map(
                (connection: any) => {
                  const lastSync =
                    connection.syncRuns[0] || null;

                  const sessionStatus = String(
                    connection.settingsJson
                      ?.sessionStatus || ""
                  ).toUpperCase();

                  const browserConnectorStatus =
                    String(
                      connection.settingsJson
                        ?.browserConnectorStatus ||
                        ""
                    ).toUpperCase();

                  const browserConnectorReady =
                    Boolean(
                      connection.settingsJson
                        ?.browserConnectorTokenCreatedAt
                    );

                  const browserConnectorActive =
                    browserConnectorStatus ===
                      "ACTIVE" ||
                    sessionStatus ===
                      "LOCAL_BROWSER_ACTIVE";

                  const statusLabel =
                    browserConnectorActive &&
                    connection.status === "ACTIVE"
                      ? "Einkaufsdaten aktiv"
                      : browserConnectorReady
                        ? "Katalogdaten vorhanden"
                        : connection.status === "ERROR"
                          ? "Fehler"
                          : connection.status ===
                              "PAUSED"
                            ? "Pausiert"
                            : "Datenquelle vorbereitet";

                  const statusTone =
                    browserConnectorActive &&
                    connection.status === "ACTIVE"
                      ? "success"
                      : connection.status === "ERROR"
                        ? "danger"
                        : "warning";

                  const lastBrowserCaptureAt =
                    connection.settingsJson
                      ?.browserConnectorLastCaptureAt;

                  const lastSyncText =
                    lastBrowserCaptureAt
                      ? new Date(
                          lastBrowserCaptureAt
                        ).toLocaleString("de-DE")
                      : connection.lastSyncAt
                        ? new Date(
                            connection.lastSyncAt
                          ).toLocaleString("de-DE")
                        : lastSync?.startedAt
                          ? new Date(
                              lastSync.startedAt
                            ).toLocaleString("de-DE")
                          : "Noch keine Browserübertragung";

                  const generatedBrowserConnectorCode =
                    actionData
                      ?.browserConnectorConnectionId ===
                    connection.id
                      ? String(
                          actionData
                            ?.browserConnectorCode ||
                            ""
                        )
                      : "";

                  const lastBrowserCaptureItems =
                    Number(
                      connection.settingsJson
                        ?.browserConnectorLastCaptureItems ||
                        0
                    );

                  return (
                    <article
                      className="supplyConnectionCard"
                      key={connection.id}
                    >
                      <div className="supplyConnectionTop">
                        <div>
                          <small>
                            {connection.settingsJson
                              ?.providerName ||
                              connection.label ||
                              "Lieferantenportal"}
                          </small>

                          <strong>
                            {connection.supplierName}
                          </strong>

                          <span>
                            {connection.settingsJson
                              ?.locationName ||
                              "Kein Standort hinterlegt"}
                          </span>
                        </div>

                        <span
                          className={[
                            "supplyStatus",
                            `supplyStatus--${statusTone}`,
                          ].join(" ")}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="supplyConnectionFacts">
                        <div>
                          <small>Kundennummer</small>
                          <strong>
                            {connection.customerNumber ||
                              connection.settingsJson
                                ?.customerNumber ||
                              "–"}
                          </strong>
                        </div>

                        <div>
                          <small>Katalogartikel</small>
                          <strong>
                            {
                              connection._count
                                .catalogItems
                            }
                          </strong>
                        </div>

                        <div>
                          <small>Letzter Abruf</small>
                          <strong>
                            {lastSyncText}
                          </strong>
                        </div>
                      </div>

                      {connection.lastError ||
                      lastSync?.errorMessage ? (
                        <div className="supplyConnectionError">
                          {connection.lastError ||
                            lastSync?.errorMessage}
                        </div>
                      ) : null}

                      <div className="supplyPortalState">
                        <strong>
                          METRO Einkaufsdaten
                        </strong>

                        <span>
                          Verbinde dein Lieferantenkonto einmalig mit Gastario.
                          Danach laufen Katalog-, Preis- und
                          Verfügbarkeitsabfragen automatisch über die
                          sichere Server-Verbindung.
                        </span>
                      </div>

                      {String(
                        connection.settingsJson?.providerCode ||
                          connection.label ||
                          connection.supplierName ||
                          ""
                      )
                        .trim()
                        .toUpperCase()
                        .includes("METRO") ? (
                        <div className="supplyBrowserConnectorPanel">
                          <div className="supplyBrowserConnectorHeader">
                            <div>
                              <small>Automatische Verbindung</small>

                              <strong>
                                METRO Katalog & Einkaufspreise
                              </strong>

                              <span>
                                Einmal bei METRO anmelden. Anschließend
                                übernimmt Gastario die Verbindung
                                serverseitig – ohne Chrome-Erweiterung.
                              </span>
                            </div>

                            <span
                              className={[
                                "supplyStatus",
                                connection.status === "ACTIVE"
                                  ? "supplyStatus--success"
                                  : "supplyStatus--warning",
                              ].join(" ")}
                            >
                              {connection.status === "ACTIVE"
                                ? "Verbunden"
                                : "Anmeldung erforderlich"}
                            </span>
                          </div>

                          <div className="supplyBrowserConnectorActions">
                            <a
                              className="supplyButton supplyButton--primary"
                              href="/einkauf/artikelsuche"
                            >
                              Katalog anzeigen
                            </a>

                            <a
                              className="supplyButton supplyButton--secondary"
                              href="/lieferanten/rechnungs-import"
                            >
                              Rechnungen importieren
                            </a>
                          </div>

                          <div className="supplyBrowserConnectorFacts">
                            <div>
                              <small>Kundennummer</small>
                              <strong>
                                {connection.customerNumber ||
                                  connection.settingsJson?.customerNumber ||
                                  "–"}
                              </strong>
                            </div>

                            <div>
                              <small>Katalogartikel</small>
                              <strong>
                                {connection._count.catalogItems}
                              </strong>
                            </div>

                            <div>
                              <small>Letzter Abruf</small>
                              <strong>
                                {lastSyncText}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <details
                        className="supplyDisclosure supplyDisclosure--connector"
                        style={{ display: "none" }}
                      >
                        <summary>
                          <span>
                            <strong>Chrome-Connector einrichten und verwalten</strong>
                            <small>
                              Erweiterung, Verbindungscode und technische Angaben
                            </small>
                          </span>

                          <span className="supplyDisclosureAction">
                            Einrichtung & Details
                          </span>
                        </summary>

                        <div className="supplyDisclosureBody">
                          <div className="supplyBrowserConnectorPanel">
                        <div className="supplyBrowserConnectorHeader">
                          <div>
                            <small>Lokale Verbindung</small>
                            <strong>
                              Gastario Chrome-Connector
                            </strong>
                            <span>
                              Kein METRO-Passwort und keine METRO-Sitzung werden an Railway übertragen.
                            </span>
                          </div>

                          <span
                            className={[
                              "supplyStatus",
                              browserConnectorActive
                                ? "supplyStatus--success"
                                : "supplyStatus--warning",
                            ].join(" ")}
                          >
                            {browserConnectorActive
                              ? "Aktiv"
                              : browserConnectorReady
                                ? "Kopplung bereit"
                                : "Nicht eingerichtet"}
                          </span>
                        </div>

                        <ol className="supplyBrowserConnectorSteps">
                          <li>
                            Erweiterung herunterladen und in Chrome entpackt laden.
                          </li>
                          <li>
                            Verbindungscode erzeugen und einmalig in die Erweiterung kopieren.
                          </li>
                          <li>
                            Bei lieferservice.metro.de normal anmelden und sichtbare Preise senden.
                          </li>
                        </ol>

                        <div className="supplyBrowserConnectorActions">
                          <a
                            className="supplyButton supplyButton--secondary"
                            href="/downloads/gastario-supplier-connector.zip"
                            download
                          >
                            Chrome-Erweiterung herunterladen
                          </a>

                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="generateBrowserConnectorCode"
                            />

                            <input
                              type="hidden"
                              name="connectionId"
                              value={connection.id}
                            />

                            <button
                              className="supplyButton supplyButton--primary"
                              type="submit"
                            >
                              {browserConnectorReady
                                ? "Verbindungscode erneuern"
                                : "Verbindungscode erzeugen"}
                            </button>
                          </Form>
                        </div>

                        {generatedBrowserConnectorCode ? (
                          <div className="supplyBrowserConnectorCode">
                            <div>
                              <strong>
                                Verbindungscode – nur jetzt sichtbar
                              </strong>
                              <span>
                                Nach dem Verlassen der Seite wird der Code nicht erneut angezeigt. Bei Verlust einfach einen neuen erzeugen.
                              </span>
                            </div>

                            <div className="supplyBrowserConnectorCodeRow">
                              <input
                                value={
                                  generatedBrowserConnectorCode
                                }
                                readOnly
                                aria-label="Gastario Verbindungscode"
                              />

                              <button
                                className="supplyButton supplyButton--secondary"
                                type="button"
                                onClick={() => {
                                  navigator.clipboard
                                    .writeText(
                                      generatedBrowserConnectorCode
                                    )
                                    .catch(() => {});
                                }}
                              >
                                Code kopieren
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className="supplyBrowserConnectorFacts">
                          <div>
                            <small>Letzte Übertragung</small>
                            <strong>
                              {lastBrowserCaptureAt
                                ? new Date(
                                    lastBrowserCaptureAt
                                  ).toLocaleString(
                                    "de-DE"
                                  )
                                : "Noch keine"}
                            </strong>
                          </div>

                          <div>
                            <small>Übertragene Artikel</small>
                            <strong>
                              {lastBrowserCaptureItems}
                            </strong>
                          </div>

                          <div>
                            <small>Code-Endung</small>
                            <strong>
                              {connection.settingsJson
                                ?.browserConnectorTokenLastFour
                                ? `••••${connection.settingsJson.browserConnectorTokenLastFour}`
                                : "–"}
                            </strong>
                          </div>
                        </div>

                        {browserConnectorReady ? (
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="revokeBrowserConnectorCode"
                            />

                            <input
                              type="hidden"
                              name="connectionId"
                              value={connection.id}
                            />

                            <button
                              className="supplyButton supplyButton--dangerGhost"
                              type="submit"
                            >
                              Chrome-Verbindung widerrufen
                            </button>
                          </Form>
                        ) : null}

                        {connection.hasPortalCredentials ? (
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="clearPortalCredentials"
                            />

                            <input
                              type="hidden"
                              name="connectionId"
                              value={connection.id}
                            />

                            <button
                              className="supplyButton supplyButton--dangerGhost"
                              type="submit"
                            >
                              Alten Server-Zugang entfernen
                            </button>
                          </Form>
                        ) : null}
                          </div>
                        </div>
                      </details>
                    </article>
                  );
                }
              )
            )}
          </div>
                </div>
              </details>
          </GastarioSection>

        </GastarioStack>
      </PageShell>
    </AppLayout>
  );
}








