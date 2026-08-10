export class MetroHostedProvider {
  code = "METRO";

  constructor({
    sessionStore
  }) {
    this.sessionStore =
      sessionStore;
  }

  async getSession({
    tenantId,
    connectionId
  }) {
    return await this.sessionStore.get({
      tenantId,
      connectionId
    });
  }

  async health({
    tenantId,
    connectionId
  }) {
    const session =
      await this.getSession({
        tenantId,
        connectionId
      });

    if (!session) {
      return {
        ok: false,
        requiresUserAction: true,
        message:
          "METRO-Konto ist noch nicht im Hosted Supplier Hub verbunden."
      };
    }

    return {
      ok: true,
      requiresUserAction: false,
      message:
        "METRO Hosted Session vorhanden."
    };
  }

  async search({
    tenantId,
    connectionId,
    query,
    limit
  }) {
    const session =
      await this.getSession({
        tenantId,
        connectionId
      });

    if (!session) {
      const error =
        new Error(
          "METRO Hosted Session fehlt. Konto muss verbunden werden."
        );

      error.code =
        "REAUTH_REQUIRED";

      throw error;
    }

    /*
     * Phase 2.2:
     * Hier wird der bereits erforschte native METRO-Transport
     * eingebunden:
     *
     * /searchdiscover/articlesearch/search
     * + Betty-Variant-Hydration.
     *
     * Der Gastario-Nutzer benötigt dafür KEINEN lokalen Connector.
     */
    if (
      typeof session.search !==
      "function"
    ) {
      const error =
        new Error(
          "METRO Native Transport ist noch nicht an den Hosted Session Vault gebunden."
        );

      error.code =
        "TRANSPORT_NOT_READY";

      throw error;
    }

    return session.search(
      query,
      limit
    );
  }

  async refreshPrices({
    tenantId,
    connectionId,
    externalIds
  }) {
    const session =
      await this.getSession({
        tenantId,
        connectionId
      });

    if (!session) {
      const error =
        new Error(
          "METRO Hosted Session fehlt. Konto muss verbunden werden."
        );

      error.code =
        "REAUTH_REQUIRED";

      throw error;
    }

    if (
      typeof session.refreshPrices !==
      "function"
    ) {
      return [];
    }

    return session.refreshPrices(
      externalIds
    );
  }
}
