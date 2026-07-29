/*
 * gastario-supplier-connectors-core-20260729
 *
 * Gemeinsame Schnittstelle fuer automatische Lieferantenanbindungen.
 * Dieser Kern liefert niemals erfundene Preise oder Verfuegbarkeiten.
 */

export type SupplierProviderCode =
  | "METRO"
  | "TRANSGOURMET"
  | "CHEFS_CULINAR"
  | "SELGROS"
  | "OTHER";

export type SupplierConnectorCapability =
  | "CATALOG"
  | "PRICES"
  | "AVAILABILITY"
  | "LIVE_PRICE_CHECK";

export type SupplierConnectorState =
  | "READY"
  | "ACCESS_REQUIRED"
  | "CONFIGURATION_INCOMPLETE"
  | "UNSUPPORTED"
  | "ERROR";

export type SupplierConnectorSettings = {
  providerCode?: string | null;
  providerName?: string | null;
  locationName?: string | null;
  customerNumber?: string | null;
  automaticSync?: boolean | null;
  onboardingStatus?: string | null;
  credentialReference?: string | null;
  endpointUrl?: string | null;
};

export type SupplierCatalogRecord = {
  externalArticleId: string;
  articleNumber?: string | null;
  ean?: string | null;
  name: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  purchaseUnit?: string | null;
  packageQuantity?: number | null;
  packageUnit?: string | null;
  active?: boolean;
};

export type SupplierPriceRecord = {
  externalArticleId: string;
  priceCents: number;
  currency: string;
  validFrom: Date;
  validUntil?: Date | null;
  available?: boolean | null;
  stockText?: string | null;
  minimumOrderQuantity?: number | null;
};

export type SupplierAvailabilityRecord = {
  externalArticleId: string;
  available: boolean;
  stockQuantity?: number | null;
  stockText?: string | null;
  checkedAt: Date;
};

export type SupplierConnectorCheckResult = {
  ok: boolean;
  state: SupplierConnectorState;
  providerCode: SupplierProviderCode;
  providerName: string;
  message: string;
  capabilities: SupplierConnectorCapability[];
};

export type SupplierConnectorContext = {
  tenantId: string;
  supplierId: string;
  connectionId: string;
  customerNumber?: string | null;
  endpointUrl?: string | null;
  settings: SupplierConnectorSettings;
};

export interface SupplierConnector {
  readonly providerCode: SupplierProviderCode;
  readonly providerName: string;
  readonly capabilities: SupplierConnectorCapability[];

  testConnection(
    context: SupplierConnectorContext
  ): Promise<SupplierConnectorCheckResult>;

  fetchCatalog(
    context: SupplierConnectorContext
  ): Promise<SupplierCatalogRecord[]>;

  fetchPrices(
    context: SupplierConnectorContext,
    externalArticleIds?: string[]
  ): Promise<SupplierPriceRecord[]>;

  fetchAvailability(
    context: SupplierConnectorContext,
    externalArticleIds?: string[]
  ): Promise<SupplierAvailabilityRecord[]>;
}

type OfficialConnectorDefinition = {
  providerCode: SupplierProviderCode;
  providerName: string;
  credentialEnvironmentVariables: string[];
  capabilities: SupplierConnectorCapability[];
  accessMessage: string;
};

const officialConnectorDefinitions: Record<
  Exclude<SupplierProviderCode, "OTHER">,
  OfficialConnectorDefinition
> = {
  METRO: {
    providerCode: "METRO",
    providerName: "METRO",
    credentialEnvironmentVariables: [
      "METRO_API_CLIENT_ID",
      "METRO_API_CLIENT_SECRET",
    ],
    capabilities: [
      "CATALOG",
      "PRICES",
      "AVAILABILITY",
      "LIVE_PRICE_CHECK",
    ],
    accessMessage:
      "Fuer METRO fehlen noch die offiziell freigeschalteten Schnittstellen-Zugangsdaten.",
  },

  TRANSGOURMET: {
    providerCode: "TRANSGOURMET",
    providerName: "Transgourmet",
    credentialEnvironmentVariables: [
      "TRANSGOURMET_API_CLIENT_ID",
      "TRANSGOURMET_API_CLIENT_SECRET",
    ],
    capabilities: [
      "CATALOG",
      "PRICES",
      "AVAILABILITY",
      "LIVE_PRICE_CHECK",
    ],
    accessMessage:
      "Fuer Transgourmet fehlen noch die offiziell freigeschalteten Schnittstellen-Zugangsdaten.",
  },

  CHEFS_CULINAR: {
    providerCode: "CHEFS_CULINAR",
    providerName: "CHEFS CULINAR",
    credentialEnvironmentVariables: [
      "CHEFS_CULINAR_API_CLIENT_ID",
      "CHEFS_CULINAR_API_CLIENT_SECRET",
    ],
    capabilities: [
      "CATALOG",
      "PRICES",
      "AVAILABILITY",
      "LIVE_PRICE_CHECK",
    ],
    accessMessage:
      "Fuer CHEFS CULINAR fehlen noch die offiziell freigeschalteten Schnittstellen-Zugangsdaten.",
  },

  SELGROS: {
    providerCode: "SELGROS",
    providerName: "Selgros",
    credentialEnvironmentVariables: [
      "SELGROS_API_CLIENT_ID",
      "SELGROS_API_CLIENT_SECRET",
    ],
    capabilities: [
      "CATALOG",
      "PRICES",
      "AVAILABILITY",
      "LIVE_PRICE_CHECK",
    ],
    accessMessage:
      "Fuer Selgros fehlen noch die offiziell freigeschalteten Schnittstellen-Zugangsdaten.",
  },
};

function normalizeProviderCode(
  value: unknown
): SupplierProviderCode {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "METRO") {
    return "METRO";
  }

  if (
    normalized === "TRANSGOURMET" ||
    normalized === "TRANSGOURMET_DE"
  ) {
    return "TRANSGOURMET";
  }

  if (
    normalized === "CHEFS_CULINAR" ||
    normalized === "CHEFSCULINAR"
  ) {
    return "CHEFS_CULINAR";
  }

  if (normalized === "SELGROS") {
    return "SELGROS";
  }

  return "OTHER";
}

function hasConfiguredCredentials(
  environmentVariables: string[]
) {
  return environmentVariables.every((name) => {
    return Boolean(String(process.env[name] || "").trim());
  });
}

function createAccessRequiredConnector(
  definition: OfficialConnectorDefinition
): SupplierConnector {
  return {
    providerCode: definition.providerCode,
    providerName: definition.providerName,
    capabilities: definition.capabilities,

    async testConnection(context) {
      if (!context.customerNumber) {
        return {
          ok: false,
          state: "CONFIGURATION_INCOMPLETE",
          providerCode: definition.providerCode,
          providerName: definition.providerName,
          message:
            "Bitte zuerst die Kundennummer fuer " +
            definition.providerName +
            " hinterlegen.",
          capabilities: definition.capabilities,
        };
      }

      if (
        !hasConfiguredCredentials(
          definition.credentialEnvironmentVariables
        )
      ) {
        return {
          ok: false,
          state: "ACCESS_REQUIRED",
          providerCode: definition.providerCode,
          providerName: definition.providerName,
          message: definition.accessMessage,
          capabilities: definition.capabilities,
        };
      }

      return {
        ok: false,
        state: "CONFIGURATION_INCOMPLETE",
        providerCode: definition.providerCode,
        providerName: definition.providerName,
        message:
          "Die Zugangsdaten sind hinterlegt. Der offizielle " +
          definition.providerName +
          "-Adapter muss noch mit dem freigegebenen Endpunkt verbunden werden.",
        capabilities: definition.capabilities,
      };
    },

    async fetchCatalog() {
      throw new Error(
        definition.providerName +
          ": Kein offizieller Katalog-Endpunkt konfiguriert."
      );
    },

    async fetchPrices() {
      throw new Error(
        definition.providerName +
          ": Kein offizieller Preis-Endpunkt konfiguriert."
      );
    },

    async fetchAvailability() {
      throw new Error(
        definition.providerName +
          ": Kein offizieller Verfuegbarkeits-Endpunkt konfiguriert."
      );
    },
  };
}

const unsupportedConnector: SupplierConnector = {
  providerCode: "OTHER",
  providerName: "Weiterer Lieferant",
  capabilities: [],

  async testConnection() {
    return {
      ok: false,
      state: "UNSUPPORTED",
      providerCode: "OTHER",
      providerName: "Weiterer Lieferant",
      message:
        "Fuer diesen Lieferanten ist noch kein offizieller Gastario-Connector eingerichtet.",
      capabilities: [],
    };
  },

  async fetchCatalog() {
    throw new Error(
      "Fuer diesen Lieferanten ist kein Katalog-Connector eingerichtet."
    );
  },

  async fetchPrices() {
    throw new Error(
      "Fuer diesen Lieferanten ist kein Preis-Connector eingerichtet."
    );
  },

  async fetchAvailability() {
    throw new Error(
      "Fuer diesen Lieferanten ist kein Verfuegbarkeits-Connector eingerichtet."
    );
  },
};

export function getSupplierConnector(
  providerCode: unknown
): SupplierConnector {
  const normalizedCode =
    normalizeProviderCode(providerCode);

  if (normalizedCode === "OTHER") {
    return unsupportedConnector;
  }

  return createAccessRequiredConnector(
    officialConnectorDefinitions[normalizedCode]
  );
}

export function getSupportedSupplierProviders() {
  return Object.values(officialConnectorDefinitions).map(
    (definition) => ({
      providerCode: definition.providerCode,
      providerName: definition.providerName,
      capabilities: definition.capabilities,
      credentialsConfigured:
        hasConfiguredCredentials(
          definition.credentialEnvironmentVariables
        ),
    })
  );
}

export function resolveSupplierProviderCode(
  settings: SupplierConnectorSettings | null | undefined,
  fallbackName?: string | null
) {
  return normalizeProviderCode(
    settings?.providerCode ||
      settings?.providerName ||
      fallbackName ||
      ""
  );
}