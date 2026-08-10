import type {
  SupplierProviderRegistry
} from "./provider-registry.server";

import type {
  SupplierSearchRequest,
  SupplierSearchResult,
  SupplierSessionRef
} from "./types";

export type SupplierSessionResolver = (
  tenantId: string,
  supplierConnectionIds?: string[]
) => Promise<SupplierSessionRef[]>;

export class SupplierSearchOrchestrator {
  constructor(
    private readonly registry:
      SupplierProviderRegistry,
    private readonly resolveSessions:
      SupplierSessionResolver
  ) {}

  async search(
    request: SupplierSearchRequest
  ): Promise<SupplierSearchResult> {
    const query =
      request.query.trim();

    if (query.length < 2) {
      throw new Error(
        "Supplier search query must contain at least 2 characters."
      );
    }

    const startedAt =
      new Date();

    const sessions =
      await this.resolveSessions(
        request.tenantId,
        request.supplierConnectionIds
      );

    const limit =
      Math.min(
        100,
        Math.max(
          1,
          Math.floor(
            request.limit ?? 20
          )
        )
      );

    const providerResults =
      await Promise.all(
        sessions.map(
          async (session) => {
            const provider =
              this.registry.get(
                session.providerCode
              );

            const providerStartedAt =
              Date.now();

            try {
              const products =
                await provider.search(
                  session,
                  query,
                  {
                    limit
                  }
                );

              return {
                providerCode:
                  provider.code,
                supplierConnectionId:
                  session.supplierConnectionId,
                durationMs:
                  Date.now() -
                  providerStartedAt,
                products,
                error:
                  null
              };
            }
            catch (error) {
              return {
                providerCode:
                  provider.code,
                supplierConnectionId:
                  session.supplierConnectionId,
                durationMs:
                  Date.now() -
                  providerStartedAt,
                products:
                  [],
                error:
                  error instanceof Error
                    ? error.message
                    : String(error)
              };
            }
          }
        )
      );

    const products =
      providerResults
        .flatMap(
          (result) =>
            result.products
        )
        .sort(
          (left, right) => {
            const leftPrice =
              left.netPriceCents ??
              Number.MAX_SAFE_INTEGER;

            const rightPrice =
              right.netPriceCents ??
              Number.MAX_SAFE_INTEGER;

            if (
              leftPrice !==
              rightPrice
            ) {
              return (
                leftPrice -
                rightPrice
              );
            }

            return left.name.localeCompare(
              right.name,
              "de"
            );
          }
        );

    const finishedAt =
      new Date();

    return {
      query,
      startedAt,
      finishedAt,
      durationMs:
        finishedAt.getTime() -
        startedAt.getTime(),
      providerResults,
      products
    };
  }
}
