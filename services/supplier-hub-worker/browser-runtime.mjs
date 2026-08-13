import {
  chromium
} from "playwright-core";

const DEFAULT_LOGIN_URL =
  "https://lieferservice.metro.de/";

const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 800
};

function cleanToken(
  value
) {
  return String(
    value || ""
  ).trim();
}

function cleanText(
  value,
  maxLength = 2000
) {
  return String(
    value || ""
  ).slice(
    0,
    maxLength
  );
}

export class HostedBrowserRuntimeManager {
  constructor({
    ticketStore,
    sessionStore,
    executablePath,
    loginUrl =
      DEFAULT_LOGIN_URL
  }) {
    this.ticketStore =
      ticketStore;

    this.sessionStore =
      sessionStore;

    this.executablePath =
      cleanToken(
        executablePath
      );

    this.loginUrl =
      cleanToken(
        loginUrl
      ) ||
      DEFAULT_LOGIN_URL;

    this.runtimes =
      new Map();
  }

  getRuntime(
    token
  ) {
    return (
      this.runtimes.get(
        cleanToken(token)
      ) ||
      null
    );
  }

  async start(
    ticket
  ) {
    const token =
      cleanToken(
        ticket?.token
      );

    if (!token) {
      throw new Error(
        "Login-Ticket fehlt."
      );
    }

    const existing =
      this.getRuntime(
        token
      );

    if (existing) {
      return this.status(
        token
      );
    }

    const launchOptions = {
      headless:
        process.env
          .SUPPLIER_HUB_BROWSER_HEADLESS ===
          "1",
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-features=Translate"
      ]
    };

    if (
      this.executablePath
    ) {
      launchOptions.executablePath =
        this.executablePath;
    }

    const browser =
      await chromium.launch(
        launchOptions
      );

    const context =
      await browser.newContext({
        viewport:
          DEFAULT_VIEWPORT,
        locale:
          "de-DE",
        timezoneId:
          "Europe/Berlin"
      });

    const page =
      await context.newPage();

    const runtime = {
      token,
      tenantId:
        ticket.tenantId,
      connectionId:
        ticket.connectionId,
      provider:
        ticket.provider,
      browser,
      context,
      page,
      startedAt:
        new Date()
          .toISOString(),
      state:
        "STARTING",
      lastError:
        null
    };

    this.runtimes.set(
      token,
      runtime
    );

    this.ticketStore.update(
      token,
      {
        state:
          "STARTING",
        message:
          "Geschützte METRO-Anmeldesitzung wird gestartet."
      }
    );

    try {
      await page.goto(
        this.loginUrl,
        {
          waitUntil:
            "domcontentloaded",
          timeout:
            45_000
        }
      );

      runtime.state =
        "INTERACTIVE";

      this.ticketStore.update(
        token,
        {
          state:
            "INTERACTIVE",
          message:
            "METRO-Anmeldesitzung ist bereit."
        }
      );

      return this.status(
        token
      );
    }
    catch (error) {
      runtime.state =
        "FAILED";

      runtime.lastError =
        error instanceof Error
          ? error.message
          : String(error);

      this.ticketStore.update(
        token,
        {
          state:
            "FAILED",
          message:
            runtime.lastError,
          failedAt:
            new Date()
              .toISOString()
        }
      );

      await this.close(
        token,
        false
      );

      throw error;
    }
  }

  async status(
    token
  ) {
    const runtime =
      this.getRuntime(
        token
      );

    if (!runtime) {
      return {
        active: false,
        state:
          "NOT_RUNNING",
        url:
          null,
        title:
          null
      };
    }

    let title = null;

    try {
      title =
        await runtime.page
          .title();
    }
    catch {}

    return {
      active: true,
      state:
        runtime.state,
      url:
        runtime.page
          .url(),
      title,
      startedAt:
        runtime.startedAt,
      lastError:
        runtime.lastError
    };
  }

  async screenshot(
    token
  ) {
    const runtime =
      this.getRuntime(
        token
      );

    if (!runtime) {
      throw new Error(
        "Browser-Sitzung ist nicht aktiv."
      );
    }

    return await runtime.page
      .screenshot({
        type: "jpeg",
        quality: 72,
        fullPage: false
      });
  }

  ensureMetroLoginDiagnostics(
    runtime
  ) {
    if (
      !runtime ||
      runtime.metroLoginDiagnosticsInstalled
    ) {
      return;
    }

    runtime.metroLoginDiagnosticsInstalled =
      true;

    const sanitizeUrl =
      (value) => {
        try {
          const parsed =
            new URL(
              String(
                value ||
                ""
              )
            );

          return (
            parsed.origin +
            parsed.pathname
          );
        }
        catch {
          return "[invalid-url]";
        }
      };

    const isRelevantUrl =
      (value) => {
        const text =
          String(
            value ||
            ""
          )
            .toLowerCase();

        return (
          text.includes("metro.de") ||
          text.includes("metro-online") ||
          text.includes("identity") ||
          text.includes("oauth") ||
          text.includes("login") ||
          text.includes("signin")
        );
      };

    runtime.page.on(
      "request",
      (request) => {
        const url =
          request.url();

        if (!isRelevantUrl(url)) {
          return;
        }

        console.log(
          "[METRO LOGIN NET] request",
          {
            method:
              request.method(),
            url:
              sanitizeUrl(url),
            resourceType:
              request.resourceType()
          }
        );
      }
    );

    runtime.page.on(
      "response",
      (response) => {
        const url =
          response.url();

        if (!isRelevantUrl(url)) {
          return;
        }

        console.log(
          "[METRO LOGIN NET] response",
          {
            status:
              response.status(),
            url:
              sanitizeUrl(url)
          }
        );
      }
    );

    runtime.page.on(
      "requestfailed",
      (request) => {
        const url =
          request.url();

        if (!isRelevantUrl(url)) {
          return;
        }

        console.warn(
          "[METRO LOGIN NET] request-failed",
          {
            method:
              request.method(),
            url:
              sanitizeUrl(url),
            failure:
              request.failure()
                ?.errorText ||
              "unknown"
          }
        );
      }
    );

    runtime.page.on(
      "framenavigated",
      (frame) => {
        if (
          frame !==
          runtime.page
            .mainFrame()
        ) {
          return;
        }

        const url =
          frame.url();

        if (!isRelevantUrl(url)) {
          return;
        }

        console.log(
          "[METRO LOGIN NET] navigation",
          {
            url:
              sanitizeUrl(url)
          }
        );
      }
    );

    console.log(
      "[METRO LOGIN NET] diagnostics-active",
      {
        tenantId:
          runtime.tenantId,
        connectionId:
          runtime.connectionId,
        provider:
          runtime.provider
      }
    );
  }
  async input(
    token,
    action
  ) {
    const runtime =
      this.getRuntime(
        token
      );

    this.ensureMetroLoginDiagnostics(
      runtime
    );

    if (!runtime) {
      throw new Error(
        "Browser-Sitzung ist nicht aktiv."
      );
    }

    const type =
      cleanToken(
        action?.type
      );

    if (
      type === "click"
    ) {
      const x =
        Number(
          action.x
        );

      const y =
        Number(
          action.y
        );

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        throw new Error(
          "Ungültige Klickposition."
        );
      }

      await runtime.page
        .mouse
        .click(
          Math.max(
            0,
            Math.min(
              DEFAULT_VIEWPORT.width,
              x
            )
          ),
          Math.max(
            0,
            Math.min(
              DEFAULT_VIEWPORT.height,
              y
            )
          )
        );

      return;
    }

    if (
      type === "text"
    ) {
      const text =
        cleanText(
          action.text,
          500
        );

      /*
       * Text wird ausschließlich direkt an die aktive
       * Browserseite weitergegeben. Er wird nicht geloggt,
       * nicht in Tickets gespeichert und nicht im Vault abgelegt.
       */
      await runtime.page
        .keyboard
        .insertText(text);

      return;
    }

    if (
      type === "key"
    ) {
      const allowed =
        new Set([
          "Enter",
          "Tab",
          "Escape",
          "Backspace",
          "Delete",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight"
        ]);

      const key =
        cleanToken(
          action.key
        );

      if (!allowed.has(key)) {
        throw new Error(
          "Taste ist nicht erlaubt."
        );
      }

      await runtime.page
        .keyboard
        .press(key);

      return;
    }

    throw new Error(
      "Unbekannte Browser-Eingabe."
    );
  }

  async complete(
    token
  ) {
    const runtime =
      this.getRuntime(
        token
      );

    if (!runtime) {
      throw new Error(
        "Browser-Sitzung ist nicht aktiv."
      );
    }

    console.log(
      "[SUPPLIER HUB LOGIN] complete:start",
      {
        tenantId:
          runtime.tenantId,
        connectionId:
          runtime.connectionId,
        provider:
          runtime.provider
      }
    );

    const storageState =
      await runtime.context
        .storageState();

    console.log(
      "[SUPPLIER HUB LOGIN] complete:storage-state"
    );

    await this.sessionStore.set({
      tenantId:
        runtime.tenantId,
      connectionId:
        runtime.connectionId,
      session: {
        provider:
          runtime.provider,
        storageState,
        metadata: {
          source:
            "HOSTED_INTERACTIVE_LOGIN",
          capturedAt:
            new Date()
              .toISOString(),
          lastUrl:
            runtime.page
              .url()
        }
      }
    });

    console.log(
      "[SUPPLIER HUB LOGIN] complete:session-saved"
    );

    this.ticketStore.update(
      token,
      {
        state:
          "COMPLETED",
        message:
          "METRO-Konto wurde verbunden.",
        completedAt:
          new Date()
            .toISOString()
      }
    );

    /*
     * Die Session ist ab hier bereits dauerhaft gespeichert.
     * Browser-Cleanup darf die HTTP-Antwort nicht mehr blockieren.
     * Railway/Chromium kann beim Schliessen mehrere Sekunden warten.
     */
    void this.close(
      token,
      false
    )
      .then(() => {
        console.log(
          "[SUPPLIER HUB LOGIN] complete:cleanup-finished"
        );
      })
      .catch((error) => {
        console.error(
          "[SUPPLIER HUB LOGIN] complete:cleanup-failed",
          error
        );
      });

    console.log(
      "[SUPPLIER HUB LOGIN] complete:response-ready"
    );

    return {
      ok: true,
      state:
        "COMPLETED"
    };
  }
  async cancel(
    token
  ) {
    this.ticketStore.update(
      token,
      {
        state:
          "CANCELLED",
        message:
          "Anmeldung wurde abgebrochen.",
        failedAt:
          new Date()
            .toISOString()
      }
    );

    await this.close(
      token,
      false
    );
  }

  async close(
    token,
    updateTicket = true
  ) {
    const runtime =
      this.getRuntime(
        token
      );

    if (!runtime) {
      return;
    }

    this.runtimes.delete(
      cleanToken(token)
    );

    try {
      await runtime.context
        .close();
    }
    catch {}

    try {
      await runtime.browser
        .close();
    }
    catch {}

    if (updateTicket) {
      this.ticketStore.update(
        token,
        {
          state:
            "CLOSED",
          message:
            "Browser-Sitzung wurde beendet."
        }
      );
    }
  }
}
