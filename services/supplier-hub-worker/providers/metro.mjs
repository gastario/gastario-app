export class MetroHostedProvider {
  code = "METRO";

  constructor({
    sessionStore,
    transport
  }) {
    this.sessionStore =
      sessionStore;

    this.transport =
      transport;
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

    return await this.transport.health(
      session
    );
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

    return await this.transport.search(
      session,
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

    return await this.transport
      .refreshPrices(
        session,
        externalIds
      );
  }
}
