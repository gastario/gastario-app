import type {
  SupplierAdapter
} from "../adapters/types.js";

export class AdapterRegistry {
  private readonly adapters =
    new Map<string, SupplierAdapter>();

  register(adapter: SupplierAdapter) {
    if (this.adapters.has(adapter.key)) {
      throw new Error(
        `Supplier adapter already registered: ${adapter.key}`
      );
    }

    this.adapters.set(
      adapter.key,
      adapter
    );

    return this;
  }

  all() {
    return Array.from(
      this.adapters.values()
    );
  }

  byUrl(url: string) {
    return (
      this.all().find(
        (adapter) =>
          adapter.matchesUrl(url)
      ) || null
    );
  }
}
