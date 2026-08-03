import http from "node:http";

import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

import { decryptJson, encryptJson } from "./crypto.mjs";

const prisma = new PrismaClient();
const pendingSessions = new Map();
const PORT = Number(process.env.PORT || 3000);
const HOST = "::";
const SESSION_TTL_MS = 10 * 60 * 1000;

function json(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  response.end(JSON.stringify(payload));
}

function isAuthorized(request) {
  const expected = String(
    process.env.SUPPLIER_PORTAL_WORKER_TOKEN ||
      ""
  ).trim();

  const received = String(
    request.headers.authorization || ""
  ).trim();

  return Boolean(expected) &&
    received === `Bearer ${expected}`;
}

async function readBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > 64 * 1024) {
      throw new Error("Anfrage ist zu groß.");
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(
    Buffer.concat(chunks).toString("utf8")
  );
}

function getSettings(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value;
}

async function updateConnection(
  connection,
  values
) {
  const settings = getSettings(
    connection.settingsJson
  );

  await prisma.supplierConnection.update({
    where: { id: connection.id },
    data: {
      status:
        values.status || connection.status,
      lastError:
        values.lastError === undefined
          ? connection.lastError
          : values.lastError,
      settingsJson: {
        ...settings,
        ...values.settings,
      },
    },
  });
}

async function loadConnection(
  connectionId,
  tenantId
) {
  const connection =
    await prisma.supplierConnection.findFirst({
      where: {
        id: connectionId,
        tenantId,
      },
      include: {
        supplier: {
          select: { name: true },
        },
      },
    });

  if (!connection) {
    throw new Error(
      "Lieferantenverbindung nicht gefunden."
    );
  }

  if (!connection.credentialsEncrypted) {
    throw new Error(
      "Für diese Verbindung sind keine Zugangsdaten gespeichert."
    );
  }

  const settings = getSettings(
    connection.settingsJson
  );

  const providerCode = String(
    settings.providerCode ||
      connection.label ||
      connection.supplier.name
  )
    .trim()
    .toUpperCase();

  if (providerCode !== "METRO") {
    throw new Error(
      "Dieser Browserworker unterstützt aktuell nur METRO."
    );
  }

  return connection;
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    try {
      if (await locator.isVisible({ timeout: 500 })) {
        return locator;
      }
    } catch {
      // Nächsten stabilen Selektor prüfen.
    }
  }

  return null;
}

async function clickFirst(page, selectors) {
  const locator = await firstVisible(
    page,
    selectors
  );

  if (!locator) {
    return false;
  }

  await locator.click({ timeout: 5_000 });
  return true;
}

async function acceptCookies(page) {
  await clickFirst(page, [
    'button:has-text("Alle akzeptieren")',
    'button:has-text("Akzeptieren")',
    'button:has-text("Zustimmen")',
    '#onetrust-accept-btn-handler',
  ]).catch(() => false);
}

async function isCaptchaPage(page) {
  const text = String(
    await page.locator("body").innerText().catch(() => "")
  ).toLowerCase();

  return (
    text.includes("captcha") ||
    text.includes("ich bin kein roboter") ||
    text.includes("unusual traffic") ||
    (await page.locator(
      'iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'
    ).count()) > 0
  );
}

async function isLoggedIn(page) {
  const url = page.url().toLowerCase();

  if (!url.includes("metro")) {
    return false;
  }

  const bodyText = String(
    await page.locator("body").innerText().catch(() => "")
  ).toLowerCase();

  const markers = [
    "meine bestellungen",
    "ihr warenkorb",
    "ausgewählter markt",
    "ausgewaehlter markt",
    "lieferdepot",
    "listen",
  ];

  return markers.some((marker) =>
    bodyText.includes(marker)
  );
}

async function findOtpInput(page) {
  return firstVisible(page, [
    'input[autocomplete="one-time-code"]',
    'input[name*="otp" i]',
    'input[id*="otp" i]',
    'input[name*="code" i]',
    'input[id*="code" i]',
    'input[inputmode="numeric"]',
  ]);
}

async function fillLogin(page, credentials) {
  await acceptCookies(page);

  if (await isLoggedIn(page)) {
    return { loggedIn: true };
  }

  await clickFirst(page, [
    'a:has-text("Anmelden")',
    'button:has-text("Anmelden")',
    'a:has-text("Login")',
    'button:has-text("Login")',
  ]).catch(() => false);

  await page.waitForTimeout(1_000);

  const usernameInput = await firstVisible(
    page,
    [
      'input[autocomplete="username"]',
      'input[type="email"]',
      'input[name*="email" i]',
      'input[name*="user" i]',
      'input[id*="email" i]',
      'input[id*="user" i]',
    ]
  );

  if (usernameInput) {
    await usernameInput.fill(credentials.username);

    const passwordAlreadyVisible =
      await firstVisible(page, [
        'input[autocomplete="current-password"]',
        'input[type="password"]',
      ]);

    if (!passwordAlreadyVisible) {
      await clickFirst(page, [
        'button[type="submit"]',
        'button:has-text("Weiter")',
        'button:has-text("Next")',
        'input[type="submit"]',
      ]);

      await page.waitForTimeout(1_000);
    }
  }

  const passwordInput = await firstVisible(
    page,
    [
      'input[autocomplete="current-password"]',
      'input[type="password"]',
    ]
  );

  if (!passwordInput) {
    if (await isCaptchaPage(page)) {
      return { captcha: true };
    }

    return {
      error:
        "Das METRO-Passwortfeld wurde nicht erkannt. Der Login-Ablauf muss anhand der Worker-Diagnose angepasst werden.",
    };
  }

  await passwordInput.fill(credentials.password);

  await clickFirst(page, [
    'button[type="submit"]',
    'button:has-text("Anmelden")',
    'button:has-text("Einloggen")',
    'button:has-text("Login")',
    'input[type="submit"]',
  ]);

  await page.waitForTimeout(2_500);

  const otpInput = await findOtpInput(page);

  if (otpInput) {
    return { mfaRequired: true };
  }

  if (await isCaptchaPage(page)) {
    return { captcha: true };
  }

  if (await isLoggedIn(page)) {
    return { loggedIn: true };
  }

  return {
    error:
      "METRO hat die Anmeldung nicht bestätigt. Bitte Zugangsdaten prüfen oder die Worker-Diagnose senden.",
  };
}

async function saveActiveSession(
  connection,
  browser,
  context,
  page
) {
  const storageState =
    await context.storageState();

  const now = new Date();
  const settings = getSettings(
    connection.settingsJson
  );

  await prisma.supplierConnection.update({
    where: { id: connection.id },
    data: {
      status: "ACTIVE",
      lastError: null,
      nextSyncAt: now,
      settingsJson: {
        ...settings,
        onboardingStatus: "CONNECTED",
        sessionStatus: "ACTIVE",
        portalSessionEncrypted:
          encryptJson(storageState),
        sessionSavedAt: now.toISOString(),
        lastLoginUrl: page.url(),
        lastLoginTitle:
          await page.title().catch(() => ""),
        automaticSync: true,
      },
    },
  });

  await browser.close();
}

async function startLogin(payload) {
  const connection = await loadConnection(
    String(payload.connectionId || ""),
    String(payload.tenantId || "")
  );

  const credentials = decryptJson(
    connection.credentialsEncrypted
  );

  const existing = pendingSessions.get(
    connection.id
  );

  if (existing) {
    clearTimeout(existing.timer);
    await existing.browser.close().catch(() => {});
    pendingSessions.delete(connection.id);
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    viewport: { width: 1440, height: 1000 },
  });

  const page = await context.newPage();
  const portalUrl = String(
    credentials.portalUrl ||
      "https://lieferservice.metro.de/"
  );

  try {
    await updateConnection(connection, {
      status: "CONFIGURED",
      lastError: null,
      settings: {
        sessionStatus: "LOGIN_RUNNING",
        loginStartedAt:
          new Date().toISOString(),
      },
    });

    await page.goto(portalUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    const result = await fillLogin(
      page,
      credentials
    );

    if (result.loggedIn) {
      await saveActiveSession(
        connection,
        browser,
        context,
        page
      );

      return {
        ok: true,
        message:
          "METRO-Anmeldung erfolgreich.",
        sessionStatus: "ACTIVE",
      };
    }

    if (result.mfaRequired) {
      const timer = setTimeout(async () => {
        pendingSessions.delete(connection.id);
        await browser.close().catch(() => {});

        await updateConnection(connection, {
          status: "CONFIGURED",
          lastError:
            "Der METRO-Sicherheitscode wurde nicht rechtzeitig eingegeben.",
          settings: {
            sessionStatus: "MFA_EXPIRED",
          },
        }).catch(() => {});
      }, SESSION_TTL_MS);

      pendingSessions.set(connection.id, {
        browser,
        context,
        page,
        connection,
        timer,
        expiresAt:
          Date.now() + SESSION_TTL_MS,
      });

      await updateConnection(connection, {
        status: "CONFIGURED",
        lastError: null,
        settings: {
          sessionStatus: "MFA_REQUIRED",
          mfaRequestedAt:
            new Date().toISOString(),
        },
      });

      return {
        ok: true,
        mfaRequired: true,
        message:
          "METRO verlangt einen Sicherheitscode.",
        sessionStatus: "MFA_REQUIRED",
      };
    }

    const message = result.captcha
      ? "METRO verlangt eine manuelle Captcha-Prüfung. Diese wird nicht umgangen."
      : result.error ||
        "METRO-Anmeldung fehlgeschlagen.";

    await updateConnection(connection, {
      status: "CONFIGURED",
      lastError: message,
      settings: {
        sessionStatus: result.captcha
          ? "MANUAL_REQUIRED"
          : "LOGIN_FAILED",
        lastLoginUrl: page.url(),
        lastLoginTitle:
          await page.title().catch(() => ""),
      },
    });

    await browser.close();

    return {
      ok: false,
      message,
      sessionStatus: result.captcha
        ? "MANUAL_REQUIRED"
        : "LOGIN_FAILED",
    };
  } catch (error) {
    const message =
      "METRO-Browserlogin fehlgeschlagen: " +
      String(error?.message || error);

    await updateConnection(connection, {
      status: "CONFIGURED",
      lastError: message,
      settings: {
        sessionStatus: "LOGIN_FAILED",
        lastLoginUrl: page.url(),
      },
    }).catch(() => {});

    await browser.close().catch(() => {});

    return {
      ok: false,
      message,
      sessionStatus: "LOGIN_FAILED",
    };
  }
}

async function submitOtp(payload) {
  const connectionId = String(
    payload.connectionId || ""
  );

  const tenantId = String(
    payload.tenantId || ""
  );

  const code = String(payload.code || "")
    .replace(/\s+/g, "")
    .trim();

  const pending = pendingSessions.get(
    connectionId
  );

  if (
    !pending ||
    pending.connection.tenantId !== tenantId ||
    pending.expiresAt < Date.now()
  ) {
    throw new Error(
      "Keine wartende METRO-Anmeldung gefunden. Bitte den Login erneut starten."
    );
  }

  const otpInput = await findOtpInput(
    pending.page
  );

  if (!otpInput) {
    throw new Error(
      "Das METRO-Feld für den Sicherheitscode wurde nicht mehr gefunden."
    );
  }

  await otpInput.fill(code);

  await clickFirst(pending.page, [
    'button[type="submit"]',
    'button:has-text("Bestätigen")',
    'button:has-text("Weiter")',
    'button:has-text("Verify")',
    'input[type="submit"]',
  ]);

  await pending.page.waitForTimeout(2_500);

  if (!(await isLoggedIn(pending.page))) {
    const message =
      "Der METRO-Sicherheitscode wurde nicht bestätigt.";

    await updateConnection(
      pending.connection,
      {
        status: "CONFIGURED",
        lastError: message,
        settings: {
          sessionStatus: "MFA_FAILED",
        },
      }
    );

    return {
      ok: false,
      message,
      sessionStatus: "MFA_FAILED",
    };
  }

  clearTimeout(pending.timer);
  pendingSessions.delete(connectionId);

  await saveActiveSession(
    pending.connection,
    pending.browser,
    pending.context,
    pending.page
  );

  return {
    ok: true,
    message:
      "METRO-Sicherheitscode bestätigt.",
    sessionStatus: "ACTIVE",
  };
}

const server = http.createServer(
  async (request, response) => {
    try {
      if (
        request.method === "GET" &&
        request.url === "/health"
      ) {
        return json(response, 200, {
          ok: true,
          service:
            "gastario-supplier-portal-worker",
          pendingSessions:
            pendingSessions.size,
        });
      }

      if (!isAuthorized(request)) {
        return json(response, 401, {
          ok: false,
          message: "Nicht autorisiert.",
        });
      }

      const body = await readBody(request);

      if (
        request.method === "POST" &&
        request.url ===
          "/api/metro/login/start"
      ) {
        const result = await startLogin(body);
        return json(
          response,
          result.ok ? 200 : 422,
          result
        );
      }

      if (
        request.method === "POST" &&
        request.url ===
          "/api/metro/login/otp"
      ) {
        const result = await submitOtp(body);
        return json(
          response,
          result.ok ? 200 : 422,
          result
        );
      }

      return json(response, 404, {
        ok: false,
        message: "Route nicht gefunden.",
      });
    } catch (error) {
      return json(response, 500, {
        ok: false,
        message: String(
          error?.message || error
        ),
      });
    }
  }
);

server.listen(PORT, HOST, () => {
  console.log(
    `Supplier portal worker listening on [${HOST}]:${PORT}`
  );
});

async function shutdown() {
  for (const pending of pendingSessions.values()) {
    clearTimeout(pending.timer);
    await pending.browser.close().catch(() => {});
  }

  pendingSessions.clear();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
