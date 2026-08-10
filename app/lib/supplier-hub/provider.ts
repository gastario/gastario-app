import type {
  SupplierHealth,
  SupplierProduct,
  SupplierProviderCode,
  SupplierSessionRef
} from "./types";

export type SupplierSearchOptions = {
  limit: number;
};

export interface SupplierProvider {
  readonly code: SupplierProviderCode;

  health(
    session: SupplierSessionRef
  ): Promise<SupplierHealth>;

  search(
    session: SupplierSessionRef,
    query: string,
    options: SupplierSearchOptions
  ): Promise<SupplierProduct[]>;

  refreshPrices(
    session: SupplierSessionRef,
    externalIds: string[]
  ): Promise<SupplierProduct[]>;
}
