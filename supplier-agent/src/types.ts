export type SupplierKey =
  | "metro"
  | "selgros"
  | "transgourmet"
  | "chefs-culinar"
  | (string & {});

export type CaptureSource =
  | "NETWORK"
  | "EMBEDDED_JSON"
  | "DOM"
  | "TEXT";

export type ConfidenceLevel =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type PriceQuality =
  | "VALID"
  | "SUSPICIOUS"
  | "REJECTED"
  | "UNCHECKED";

export interface SupplierPriceTier {
  minimumQuantity: number;
  netPriceCents: number | null;
  grossPriceCents: number | null;
  label: string | null;
}

export interface NormalizedSupplierProduct {
  supplierKey: SupplierKey;
  externalId: string | null;
  articleNumber: string | null;
  ean: string | null;

  name: string;
  brand: string | null;

  orderUnit: string | null;
  packageText: string | null;

  netPriceCents: number | null;
  grossPriceCents: number | null;
  currency: "EUR";

  tiers: SupplierPriceTier[];

  available: boolean | null;
  availabilityText: string | null;

  productUrl: string | null;

  source: CaptureSource;
  confidence: ConfidenceLevel;
  capturedAt: string;
}

export interface SafeRequestShape {
  queryParameterNames: string[];
  bodyKind:
    | "none"
    | "json"
    | "form"
    | "text";
  bodyKeys: string[];
  safeValues:
    Record<
      string,
      string | number | boolean
    >;
}
export interface NetworkObservation {
  url: string;
  method: string;
  status: number;
  contentType: string | null;
  supplierKey: SupplierKey | null;
  capturedAt: string;
  requestShape: SafeRequestShape;
  body: unknown;
}

export interface SupplierSearchRequest {
  id: string;
  query: string;
  requestedAt: string;
}
