import type {
  NetworkObservation,
  NormalizedSupplierProduct,
  SupplierKey
} from "../types.js";

export type SupplierEndpointKind =
  | "PRODUCT_SEARCH"
  | "PRODUCT_DETAIL"
  | "PRODUCT_VARIANTS"
  | "PRODUCT_SUBSTITUTES"
  | "NAVIGATION"
  | "ACCOUNT"
  | "CART"
  | "CONFIG"
  | "OTHER";

export interface SupplierAdapter {
  key: SupplierKey;
  displayName: string;
  hosts: readonly string[];

  matchesUrl(url: string): boolean;

  classifyEndpoint?(
    url: string
  ): SupplierEndpointKind;

  /**
   * Netzwerkantworten des Shops in ein einheitliches Format überführen.
   * Ein Adapter darf [] zurückgeben, wenn die Response fachlich
   * uninteressant ist.
   */
  extractNetworkProducts(
    observation: NetworkObservation
  ): Promise<NormalizedSupplierProduct[]>;

  /**
   * DOM-Fallback. Wird erst relevant, wenn Network-/JSON-Extraktion
   * für einen Shop nicht ausreicht.
   */
  extractDomProducts?(
    pageUrl: string
  ): Promise<NormalizedSupplierProduct[]>;
}
