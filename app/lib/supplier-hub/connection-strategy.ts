export type SupplierConnectionStrategy =
  | "OFFICIAL"
  | "HOSTED"
  | "CATALOG"
  | "HISTORICAL"
  | "NONE";

type ResolveSupplierStrategyInput = {
  providerCode?: unknown;
  status?: unknown;
  active?: unknown;
  settingsJson?: unknown;
  catalogItems?: unknown;
  priceItems?: unknown;
};

function asRecord(
  value: unknown
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positiveCount(
  value: unknown
) {
  const number =
    Number(value || 0);

  return Number.isFinite(number)
    ? Math.max(
        0,
        Math.trunc(number)
      )
    : 0;
}

export function resolveSupplierConnectionStrategy(
  input: ResolveSupplierStrategyInput
) {
  const settings =
    asRecord(
      input.settingsJson
    );

  const providerCode =
    String(
      settings.providerCode ||
      input.providerCode ||
      ""
    )
      .trim()
      .toUpperCase();

  const configuredStrategy =
    String(
      settings.integrationStrategy ||
      settings.connectionStrategy ||
      ""
    )
      .trim()
      .toUpperCase() as SupplierConnectionStrategy;

  const catalogItems =
    positiveCount(
      input.catalogItems
    );

  const priceItems =
    positiveCount(
      input.priceItems
    );

  const active =
    input.active !== false;

  const connectionStatus =
    String(
      input.status ||
      ""
    )
      .trim()
      .toUpperCase();

  const officialReady =
    configuredStrategy ===
      "OFFICIAL" ||
    Boolean(
      settings.officialApiReady ||
      settings.punchoutReady ||
      settings.officialIntegrationReady
    );

  const hostedAllowed =
    providerCode !==
      "METRO" ||
    settings.hostedLoginSupported ===
      true;

  const hostedReady =
    configuredStrategy ===
      "HOSTED" &&
    hostedAllowed &&
    connectionStatus ===
      "ACTIVE";

  let strategy: SupplierConnectionStrategy =
    "NONE";

  if (
    active &&
    officialReady
  ) {
    strategy =
      "OFFICIAL";
  }
  else if (
    active &&
    hostedReady
  ) {
    strategy =
      "HOSTED";
  }
  else if (
    active &&
    catalogItems > 0
  ) {
    strategy =
      "CATALOG";
  }
  else if (
    active &&
    priceItems > 0
  ) {
    strategy =
      "HISTORICAL";
  }

  const usable =
    strategy !==
      "NONE";

  const live =
    strategy ===
      "OFFICIAL" ||
    strategy ===
      "HOSTED";

  const label =
    strategy === "OFFICIAL"
      ? "Offizielle Schnittstelle"
      : strategy === "HOSTED"
        ? "Portalverbindung"
        : strategy === "CATALOG"
          ? "Katalogdaten"
          : strategy === "HISTORICAL"
            ? "Historische Einkaufsdaten"
            : "Noch keine Datenquelle";

  return {
    strategy,
    usable,
    live,
    label,
    providerCode
  };
}
