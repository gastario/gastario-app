export class SupplierWorkerProviderRegistry {
  constructor() {
    this.providers =
      new Map();
  }

  register(provider) {
    const code =
      String(
        provider?.code || ""
      )
        .trim()
        .toUpperCase();

    if (!code) {
      throw new Error(
        "Provider code fehlt."
      );
    }

    if (
      this.providers.has(code)
    ) {
      throw new Error(
        `Provider ${code} ist bereits registriert.`
      );
    }

    this.providers.set(
      code,
      provider
    );

    return this;
  }

  get(code) {
    const normalized =
      String(code || "")
        .trim()
        .toUpperCase();

    const provider =
      this.providers.get(
        normalized
      );

    if (!provider) {
      throw new Error(
        `Provider ${normalized || "UNKNOWN"} ist nicht registriert.`
      );
    }

    return provider;
  }
}
