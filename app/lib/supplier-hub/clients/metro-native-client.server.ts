import type {
  MetroNativeSearchClient
} from "../providers/metro.server";

import type {
  SupplierProduct,
  SupplierSessionRef
} from "../types";

export type MetroNativeGateway = {
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
  ): Promise<
    Array<{
      externalId: string;
      articleNumber?: string | null;
      name: string;
      brand?: string | null;
      orderUnit?: string | null;
      packageText?: string | null;
      netPriceCents?: number | null;
      grossPriceCents?: number | null;
      currency?: string | null;
      available?: boolean | null;
      availabilityText?: string | null;
      imageUrl?: string | null;
      productUrl?: string | null;
      fetchedAt?: Date | string | null;
    }>
  >;

  refreshPrices?(
    session: SupplierSessionRef,
    externalIds: string[]
  ): Promise<
    Array<{
      externalId: string;
      articleNumber?: string | null;
      name: string;
      brand?: string | null;
      orderUnit?: string | null;
      packageText?: string | null;
      netPriceCents?: number | null;
      grossPriceCents?: number | null;
      currency?: string | null;
      available?: boolean | null;
      availabilityText?: string | null;
      imageUrl?: string | null;
      productUrl?: string | null;
      fetchedAt?: Date | string | null;
    }>
  >;
};

function toDate(
  value: Date | string | null | undefined
) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const date =
      new Date(value);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }

  return new Date();
}

function normalizeCurrency(
  value: string | null | undefined
): "EUR" {
  const currency =
    String(value || "EUR")
      .trim()
      .toUpperCase();

  if (currency !== "EUR") {
    throw new Error(
      `Unsupported supplier currency: ${currency}`
    );
  }

  return "EUR";
}

function mapMetroProduct(
  session: SupplierSessionRef,
  item: Awaited<
    ReturnType<
      MetroNativeGateway["search"]
    >
  >[number]
): SupplierProduct {
  return {
    providerCode:
      "METRO",
    supplierConnectionId:
      session.supplierConnectionId,
    externalId:
      String(
        item.externalId || ""
      ).trim(),
    articleNumber:
      item.articleNumber
        ? String(
            item.articleNumber
          ).trim()
        : null,
    name:
      String(
        item.name || ""
      ).trim(),
    brand:
      item.brand
        ? String(
            item.brand
          ).trim()
        : null,
    orderUnit:
      item.orderUnit
        ? String(
            item.orderUnit
          ).trim()
        : null,
    packageText:
      item.packageText
        ? String(
            item.packageText
          ).trim()
        : null,
    netPriceCents:
      Number.isFinite(
        item.netPriceCents
      )
        ? Number(
            item.netPriceCents
          )
        : null,
    grossPriceCents:
      Number.isFinite(
        item.grossPriceCents
      )
        ? Number(
            item.grossPriceCents
          )
        : null,
    currency:
      normalizeCurrency(
        item.currency
      ),
    available:
      typeof item.available ===
      "boolean"
        ? item.available
        : null,
    availabilityText:
      item.availabilityText
        ? String(
            item.availabilityText
          ).trim()
        : null,
    imageUrl:
      item.imageUrl
        ? String(
            item.imageUrl
          ).trim()
        : null,
    productUrl:
      item.productUrl
        ? String(
            item.productUrl
          ).trim()
        : null,
    fetchedAt:
      toDate(
        item.fetchedAt
      )
  };
}

export class MetroNativeClient
  implements MetroNativeSearchClient {
  constructor(
    private readonly gateway:
      MetroNativeGateway
  ) {}

  health(
    session: SupplierSessionRef
  ) {
    return this.gateway.health(
      session
    );
  }

  async search(
    session: SupplierSessionRef,
    query: string,
    limit: number
  ) {
    const items =
      await this.gateway.search(
        session,
        query,
        limit
      );

    return items
      .filter(
        (item) =>
          Boolean(
            String(
              item.externalId || ""
            ).trim()
          ) &&
          Boolean(
            String(
              item.name || ""
            ).trim()
          )
      )
      .map(
        (item) =>
          mapMetroProduct(
            session,
            item
          )
      );
  }

  async refreshPrices(
    session: SupplierSessionRef,
    externalIds: string[]
  ) {
    if (
      !this.gateway
        .refreshPrices
    ) {
      return [];
    }

    const items =
      await this.gateway
        .refreshPrices(
          session,
          externalIds
        );

    return items
      .filter(
        (item) =>
          Boolean(
            String(
              item.externalId || ""
            ).trim()
          ) &&
          Boolean(
            String(
              item.name || ""
            ).trim()
          )
      )
      .map(
        (item) =>
          mapMetroProduct(
            session,
            item
          )
      );
  }
}
