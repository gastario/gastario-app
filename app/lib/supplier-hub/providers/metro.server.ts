import type {
  SupplierProvider,
  SupplierSearchOptions
} from "../provider";

import type {
  SupplierHealth,
  SupplierProduct,
  SupplierSessionRef
} from "../types";

export type MetroNativeSearchClient = {
  health(
    session: SupplierSessionRef
  ): Promise<{
    ok: boolean;
    latencyMs?: number | null;
    message?: string | null;
    requiresUserAction?: boolean;
  }>;

  search(
    session: SupplierSessionRef,
    query: string,
    limit: number
  ): Promise<SupplierProduct[]>;

  refreshPrices(
    session: SupplierSessionRef,
    externalIds: string[]
  ): Promise<SupplierProduct[]>;
};

export class MetroSupplierProvider
  implements SupplierProvider {
  readonly code = "METRO" as const;

  constructor(
    private readonly client:
      MetroNativeSearchClient
  ) {}

  async health(
    session: SupplierSessionRef
  ): Promise<SupplierHealth> {
    const startedAt =
      Date.now();

    try {
      const result =
        await this.client.health(
          session
        );

      return {
        providerCode:
          this.code,
        state:
          result.ok
            ? "CONNECTED"
            : result.requiresUserAction
              ? "REAUTH_REQUIRED"
              : "DEGRADED",
        checkedAt:
          new Date(),
        latencyMs:
          result.latencyMs ??
          (
            Date.now() -
            startedAt
          ),
        message:
          result.message ??
          null,
        requiresUserAction:
          result.requiresUserAction ===
          true
      };
    }
    catch (error) {
      return {
        providerCode:
          this.code,
        state:
          "OFFLINE",
        checkedAt:
          new Date(),
        latencyMs:
          Date.now() -
          startedAt,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        requiresUserAction:
          false
      };
    }
  }

  search(
    session: SupplierSessionRef,
    query: string,
    options: SupplierSearchOptions
  ) {
    return this.client.search(
      session,
      query,
      options.limit
    );
  }

  refreshPrices(
    session: SupplierSessionRef,
    externalIds: string[]
  ) {
    return this.client.refreshPrices(
      session,
      externalIds
    );
  }
}
