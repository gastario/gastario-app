import http from "node:http";

import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

import { decryptJson, encryptJson } from "./crypto.mjs";

const prisma = new PrismaClient();
const pendingSessions = new Map();
const PORT = Number(process.env.PORT || 3000);
const HOST = "::";
const SESSION_TTL_MS = 10 * 60 * 1000;


const MAX_RUNTIME_DIAGNOSTIC_ENTRIES = 40;

function sanitizeDiagnosticUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value || "")
      .replace(/\?.*$/, "")
      .slice(0, 300);
  }
}

function redactDiagnosticText(value) {
  return String(value || "")
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[email]"
    )
    .replace(
      /(?:password|passwd|pwd|token|secret|code)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]"
    )
    .replace(
      /\b[A-Za-z0-9_-]{40,}\b/g,
      "[long-value-redacted]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function createRuntimeDiagnosis() {
  return {
    console: [],
    pageErrors: [],
    requestFailures: [],
    responseErrors: [],
  };
}

function pushRuntimeDiagnosis(list, value) {
  if (list.length >= MAX_RUNTIME_DIAGNOSTIC_ENTRIES) {
    return;
  }

  list.push(value);
}

function attachRuntimeDiagnosis(page, diagnosis) {
  if (page.__gastarioDiagnosisAttached) {
    return;
  }

  page.__gastarioDiagnosisAttached = true;

  page.on("console", (message) => {
    pushRuntimeDiagnosis(diagnosis.console, {
      type: message.type(),
      text: redactDiagnosticText(message.text()),
    });
  });

  page.on("pageerror", (error) => {
    pushRuntimeDiagnosis(
      diagnosis.pageErrors,
      redactDiagnosticText(error?.message || error)
    );
  });

  page.on("requestfailed", (request) => {
    pushRuntimeDiagnosis(
      diagnosis.requestFailures,
      {
        method: request.method(),
        url: sanitizeDiagnosticUrl(request.url()),
        failure: redactDiagnosticText(
          request.failure()?.errorText || ""
        ),
      }
    );
  });

  page.on("response", (response) => {
    if (response.status() < 400) {
      return;
    }

    pushRuntimeDiagnosis(
      diagnosis.responseErrors,
      {
        status: response.status(),
        url: sanitizeDiagnosticUrl(response.url()),
      }
    );
  });
}

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

function getPageSurfaces(page) {
  return [
    page,
    ...page
      .frames()
      .filter((frame) => frame !== page.mainFrame()),
  ];
}

async function firstVisible(
  page,
  selectors,
  timeout = 900
) {
  for (const surface of getPageSurfaces(page)) {
    for (const selector of selectors) {
      const locator = surface
        .locator(selector)
        .first();

      try {
        if (
          await locator.isVisible({
            timeout,
          })
        ) {
          return {
            locator,
            surface,
            selector,
          };
        }
      } catch {
        // Nächsten stabilen Selektor prüfen.
      }
    }
  }

  return null;
}

async function getNewestPage(context, fallbackPage) {
  const pages = context.pages();

  if (pages.length === 0) {
    return fallbackPage;
  }

  return pages[pages.length - 1];
}

async function clickFirst(page, selectors) {
  const match = await firstVisible(
    page,
    selectors
  );

  if (!match) {
    return {
      clicked: false,
      page,
    };
  }

  const context = page.context();

  const popupPromise = context
    .waitForEvent("page", {
      timeout: 5_000,
    })
    .catch(() => null);

  const navigationPromise = page
    .waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 5_000,
    })
    .catch(() => null);

  await match.locator.click({
    timeout: 5_000,
  });

  const popup = await popupPromise;

  if (popup) {
    await popup
      .waitForLoadState("domcontentloaded", {
        timeout: 15_000,
      })
      .catch(() => {});

    return {
      clicked: true,
      page: popup,
      selector: match.selector,
    };
  }

  await navigationPromise;

  return {
    clicked: true,
    page:
      await getNewestPage(
        context,
        page
      ),
    selector: match.selector,
  };
}

async function collectLoginDiagnosis(
  page,
  runtimeDiagnosis = null
) {
  const context = page.context();
  const pages = context.pages();

  const pageDetails = [];

  for (const currentPage of pages) {
    const frameDetails = [];

    for (const frame of currentPage.frames()) {
      const inputs = await frame
        .locator("input")
        .evaluateAll((nodes) =>
          nodes.slice(0, 30).map((node) => ({
            type:
              node.getAttribute("type") ||
              "text",
            name:
              node.getAttribute("name") ||
              "",
            id:
              node.getAttribute("id") ||
              "",
            autocomplete:
              node.getAttribute("autocomplete") ||
              "",
            placeholder:
              node.getAttribute("placeholder") ||
              "",
            ariaLabel:
              node.getAttribute("aria-label") ||
              "",
            visible: Boolean(
              node.offsetWidth ||
              node.offsetHeight ||
              node.getClientRects().length
            ),
          }))
        )
        .catch(() => []);

      const buttons = await frame
        .locator(
          'button, input[type="submit"], a[role="button"]'
        )
        .evaluateAll((nodes) =>
          nodes.slice(0, 30).map((node) => ({
            tag:
              node.tagName.toLowerCase(),
            type:
              node.getAttribute("type") ||
              "",
            text: String(
              node.innerText ||
              node.getAttribute("value") ||
              node.getAttribute("aria-label") ||
              ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 120),
            visible: Boolean(
              node.offsetWidth ||
              node.offsetHeight ||
              node.getClientRects().length
            ),
          }))
        )
        .catch(() => []);

      const documentDetails = await frame
        .evaluate(() => {
          const bodyText = String(
            document.body?.innerText || ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 1_000);

          const scriptSources = Array.from(
            document.scripts || []
          )
            .map((script) => script.src || "")
            .filter(Boolean)
            .slice(0, 25);

          const customElements = Array.from(
            document.querySelectorAll("*")
          )
            .map((element) =>
              element.tagName.toLowerCase()
            )
            .filter((tagName) =>
              tagName.includes("-")
            )
            .slice(0, 30);

          return {
            readyState: document.readyState,
            bodyText,
            htmlLength:
              document.documentElement?.outerHTML
                ?.length || 0,
            bodyChildCount:
              document.body?.children?.length || 0,
            scriptCount:
              document.scripts?.length || 0,
            scriptSources,
            customElements,
          };
        })
        .catch(() => ({
          readyState: "",
          bodyText: "",
          htmlLength: 0,
          bodyChildCount: 0,
          scriptCount: 0,
          scriptSources: [],
          customElements: [],
        }));

      frameDetails.push({
        url: sanitizeDiagnosticUrl(frame.url()),
        name: frame.name(),
        inputs,
        buttons,
        document: {
          ...documentDetails,
          bodyText: redactDiagnosticText(
            documentDetails.bodyText
          ),
          scriptSources:
            documentDetails.scriptSources.map(
              sanitizeDiagnosticUrl
            ),
        },
      });
    }

    pageDetails.push({
      url: sanitizeDiagnosticUrl(
        currentPage.url()
      ),
      title: redactDiagnosticText(
        await currentPage
          .title()
          .catch(() => "")
      ),
      frames: frameDetails,
    });
  }

  return {
    capturedAt:
      new Date().toISOString(),
    pages: pageDetails,
    runtime: runtimeDiagnosis || undefined,
  };
}

async function hasLoginUi(page) {
  for (const surface of getPageSurfaces(page)) {
    const count = await surface
      .locator(
        'input, button, input[type="submit"], a[role="button"]'
      )
      .count()
      .catch(() => 0);

    if (count > 0) {
      return true;
    }
  }

  return false;
}

async function waitForMetroLoginUi(
  page,
  timeout = 20_000
) {
  let activePage = page;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    activePage = await getNewestPage(
      activePage.context(),
      activePage
    );

    if (
      await isLoggedIn(activePage) ||
      await hasLoginUi(activePage)
    ) {
      return activePage;
    }

    await activePage
      .waitForTimeout(750)
      .catch(() => {});
  }

  if (
    activePage
      .url()
      .toLowerCase()
      .includes("idam.metro.de")
  ) {
    await activePage
      .reload({
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      })
      .catch(() => {});

    const reloadDeadline = Date.now() + 12_000;

    while (Date.now() < reloadDeadline) {
      if (
        await isLoggedIn(activePage) ||
        await hasLoginUi(activePage)
      ) {
        return activePage;
      }

      await activePage
        .waitForTimeout(750)
        .catch(() => {});
    }
  }

  return activePage;
}

async function acceptCookies(page) {
  await clickFirst(page, [
    'button:has-text("Alle akzeptieren")',
    'button:has-text("Akzeptieren")',
    'button:has-text("Zustimmen")',
    '#onetrust-accept-btn-handler',
  ]).catch(() => ({
    clicked: false,
    page,
  }));
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
  const match = await firstVisible(page, [
    'input[autocomplete="one-time-code"]',
    'input[name*="otp" i]',
    'input[id*="otp" i]',
    'input[name*="code" i]',
    'input[id*="code" i]',
    'input[inputmode="numeric"]',
  ]);

  return match?.locator || null;
}

async function fillLogin(
  page,
  credentials,
  runtimeDiagnosis
) {
  let activePage = page;

  await acceptCookies(activePage);

  if (await isLoggedIn(activePage)) {
    return {
      loggedIn: true,
      page: activePage,
    };
  }

  const loginClick = await clickFirst(
    activePage,
    [
      'a:has-text("Anmelden")',
      'button:has-text("Anmelden")',
      'a:has-text("Login")',
      'button:has-text("Login")',
      'a[href*="login" i]',
      'a[href*="auth" i]',
    ]
  ).catch(() => ({
    clicked: false,
    page: activePage,
  }));

  activePage =
    loginClick.page || activePage;

  await activePage
    .waitForLoadState("domcontentloaded", {
      timeout: 15_000,
    })
    .catch(() => {});

  await activePage.waitForTimeout(1_500);
  await acceptCookies(activePage);

  activePage = await waitForMetroLoginUi(
    activePage
  );

  const usernameMatch = await firstVisible(
    activePage,
    [
      'input[autocomplete="username"]',
      'input[type="email"]',
      'input[name="identifier"]',
      'input[name*="email" i]',
      'input[name*="user" i]',
      'input[name*="login" i]',
      'input[id*="email" i]',
      'input[id*="user" i]',
      'input[id*="login" i]',
      'input[placeholder*="E-Mail" i]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="Benutzer" i]',
      'input[aria-label*="E-Mail" i]',
      'input[aria-label*="Email" i]',
      'input[aria-label*="Benutzer" i]',
    ],
    1_200
  );

  if (usernameMatch) {
    await usernameMatch.locator.fill(
      credentials.username
    );

    let passwordMatch =
      await firstVisible(
        activePage,
        [
          'input[autocomplete="current-password"]',
          'input[type="password"]',
          'input[name="password"]',
          'input[name="passwd"]',
          'input[name*="password" i]',
          'input[id*="password" i]',
          'input[placeholder*="Passwort" i]',
          'input[placeholder*="Password" i]',
          'input[aria-label*="Passwort" i]',
          'input[aria-label*="Password" i]',
        ],
        700
      );

    if (!passwordMatch) {
      const continueClick = await clickFirst(
        activePage,
        [
          'button:has-text("Weiter")',
          'button:has-text("Next")',
          'button:has-text("Fortfahren")',
          'button:has-text("Continue")',
          'button[type="submit"]',
          'input[type="submit"]',
        ]
      ).catch(() => ({
        clicked: false,
        page: activePage,
      }));

      if (!continueClick.clicked) {
        await usernameMatch.locator
          .press("Enter")
          .catch(() => {});
      }

      activePage =
        continueClick.page ||
        await getNewestPage(
          activePage.context(),
          activePage
        );

      await activePage
        .waitForLoadState(
          "domcontentloaded",
          {
            timeout: 15_000,
          }
        )
        .catch(() => {});

      await activePage.waitForTimeout(2_500);
      await acceptCookies(activePage);

      passwordMatch =
        await firstVisible(
          activePage,
          [
            'input[autocomplete="current-password"]',
            'input[type="password"]',
            'input[name="password"]',
            'input[name="passwd"]',
            'input[name*="password" i]',
            'input[id*="password" i]',
            'input[placeholder*="Passwort" i]',
            'input[placeholder*="Password" i]',
            'input[aria-label*="Passwort" i]',
            'input[aria-label*="Password" i]',
          ],
          1_500
        );
    }

    if (!passwordMatch) {
      if (await isCaptchaPage(activePage)) {
        return {
          captcha: true,
          page: activePage,
        };
      }

      return {
        error:
          "Das METRO-Passwortfeld wurde nicht erkannt. Die sichere Worker-Diagnose wurde gespeichert.",
        diagnosis:
          await collectLoginDiagnosis(
            activePage,
            runtimeDiagnosis
          ),
        page: activePage,
      };
    }

    await passwordMatch.locator.fill(
      credentials.password
    );
  } else {
    const directPasswordMatch =
      await firstVisible(
        activePage,
        [
          'input[autocomplete="current-password"]',
          'input[type="password"]',
          'input[name="password"]',
          'input[name="passwd"]',
        ],
        1_000
      );

    if (!directPasswordMatch) {
      return {
        error:
          "Das METRO-Benutzerfeld wurde nicht erkannt. Die sichere Worker-Diagnose wurde gespeichert.",
        diagnosis:
          await collectLoginDiagnosis(
            activePage,
            runtimeDiagnosis
          ),
        page: activePage,
      };
    }

    await directPasswordMatch.locator.fill(
      credentials.password
    );
  }

  const submitClick = await clickFirst(
    activePage,
    [
      'button:has-text("Anmelden")',
      'button:has-text("Einloggen")',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button[type="submit"]',
      'input[type="submit"]',
    ]
  ).catch(() => ({
    clicked: false,
    page: activePage,
  }));

  activePage =
    submitClick.page ||
    await getNewestPage(
      activePage.context(),
      activePage
    );

  await activePage
    .waitForLoadState("domcontentloaded", {
      timeout: 15_000,
    })
    .catch(() => {});

  await activePage.waitForTimeout(3_000);

  const otpInput =
    await findOtpInput(activePage);

  if (otpInput) {
    return {
      mfaRequired: true,
      page: activePage,
    };
  }

  if (await isCaptchaPage(activePage)) {
    return {
      captcha: true,
      page: activePage,
    };
  }

  if (await isLoggedIn(activePage)) {
    return {
      loggedIn: true,
      page: activePage,
    };
  }

  return {
    error:
      "METRO hat die Anmeldung nicht bestätigt. Die sichere Worker-Diagnose wurde gespeichert.",
    diagnosis:
      await collectLoginDiagnosis(
        activePage,
        runtimeDiagnosis
      ),
    page: activePage,
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
    colorScheme: "light",
    javaScriptEnabled: true,
    extraHTTPHeaders: {
      "Accept-Language":
        "de-DE,de;q=0.9,en;q=0.7",
    },
  });

  const runtimeDiagnosis =
    createRuntimeDiagnosis();

  context.on("page", (newPage) => {
    attachRuntimeDiagnosis(
      newPage,
      runtimeDiagnosis
    );
  });

  const page = await context.newPage();

  attachRuntimeDiagnosis(
    page,
    runtimeDiagnosis
  );
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
      credentials,
      runtimeDiagnosis
    );

    const resultPage =
      result.page || page;

    if (result.loggedIn) {
      await saveActiveSession(
        connection,
        browser,
        context,
        resultPage
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
        page: resultPage,
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
        lastLoginUrl:
          resultPage.url(),
        lastLoginTitle:
          await resultPage
            .title()
            .catch(() => ""),
        loginDiagnosis:
          result.diagnosis || null,
      },
    });

    if (result.diagnosis) {
      console.log(
        "[METRO_LOGIN_DIAGNOSIS]",
        JSON.stringify(
          result.diagnosis
        )
      );
    }

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

    const diagnosis =
      await collectLoginDiagnosis(
        page,
        runtimeDiagnosis
      ).catch(() => null);

    if (diagnosis) {
      console.log(
        "[METRO_LOGIN_DIAGNOSIS]",
        JSON.stringify(diagnosis)
      );
    }

    await updateConnection(connection, {
      status: "CONFIGURED",
      lastError: message,
      settings: {
        sessionStatus: "LOGIN_FAILED",
        lastLoginUrl: page.url(),
        loginDiagnosis: diagnosis,
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
