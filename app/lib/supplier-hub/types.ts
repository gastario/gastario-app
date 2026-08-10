export type SupplierProviderCode =
  | "METRO"
  | "SELGROS"
  | "TRANSGOURMET"
  | "CHEFS_CULINAR"
  | (string & {});

export type SupplierConnectionState =
  | "CONNECTED"
  | "REAUTH_REQUIRED"
  | "DEGRADED"
  | "OFFLINE"
  | "UNKNOWN";

export type SupplierPriceFreshness =
  | "LIVE"
  | "FRESH"
  | "STALE"
  | "EXPIRED"
  | "UNKNOWN";

export type SupplierSessionRef = {
  tenantId: string;
  supplierConnectionId: string;
  providerCode: SupplierProviderCode;
  sessionKey: string;
};

export type SupplierHealth = {
  providerCode: SupplierProviderCode;
  state: SupplierConnectionState;
  checkedAt: Date;
  latencyMs: number | null;
  message: string | null;
  requiresUserAction: boolean;
};

export type SupplierProduct = {
  providerCode: SupplierProviderCode;
  supplierConnectionId: string;

  externalId: string;
  articleNumber: string | null;

  name: string;
  brand: string | null;

  orderUnit: string | null;
  packageText: string | null;

  netPriceCents: number | null;
  grossPriceCents: number | null;
  currency: "EUR";

  available: boolean | null;
  availabilityText: string | null;

  imageUrl: string | null;
  productUrl: string | null;

  fetchedAt: Date;
};

export type SupplierSearchRequest = {
  tenantId: string;
  query: string;
  limit?: number;
  supplierConnectionIds?: string[];
  maxPriceAgeMs?: number;
};

export type SupplierSearchProviderResult = {
  providerCode: SupplierProviderCode;
  supplierConnectionId: string;
  durationMs: number;
  products: SupplierProduct[];
  error: string | null;
};

export type SupplierSearchResult = {
  query: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  providerResults: SupplierSearchProviderResult[];
  products: SupplierProduct[];
};

export type SupplierCachedOffer = {
  product: SupplierProduct;
  freshness: SupplierPriceFreshness;
  ageMs: number | null;
};
