import type {
  SupplierProvider
} from "./provider";

import type {
  SupplierProviderCode
} from "./types";

export class SupplierProviderRegistry {
  private readonly providers =
    new Map<
      SupplierProviderCode,
      SupplierProvider
    >();

  register(
    provider: SupplierProvider
  ) {
    if (
      this.providers.has(
        provider.code
      )
    ) {
      throw new Error(
        `Supplier provider ${provider.code} is already registered.`
      );
    }

    this.providers.set(
      provider.code,
      provider
    );

    return this;
  }

  get(
    code: SupplierProviderCode
  ) {
    const provider =
      this.providers.get(code);

    if (!provider) {
      throw new Error(
        `Supplier provider ${code} is not registered.`
      );
    }

    return provider;
  }

  has(
    code: SupplierProviderCode
  ) {
    return this.providers.has(code);
  }

  list() {
    return Array.from(
      this.providers.values()
    );
  }
}
