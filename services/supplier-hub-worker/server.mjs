import http from "node:http";

import {
  verifyServiceToken
} from "./auth.mjs";

import {
  SupplierWorkerProviderRegistry
} from "./provider-registry.mjs";

import {
  SupplierSessionStore
} from "./session-store.mjs";

import {
  MetroHostedProvider
} from "./providers/metro.mjs";

import {
  MetroNativeTransport
} from "./providers/metro-native-transport.mjs";

import {
  LoginTicketStore
} from "./login-ticket-store.mjs";

import {
  HostedBrowserRuntimeManager
} from "./browser-runtime.mjs";

const port =
  Number(
    process.env.PORT ||
    8080
  );

const serviceToken =
  String(
    process.env
      .SUPPLIER_HUB_SERVICE_TOKEN ||
      ""
  ).trim();

if (!serviceToken) {
  console.error(
    "SUPPLIER_HUB_SERVICE_TOKEN fehlt."
  );

  process.exit(1);
}

const sessionDirectory =
  String(
    process.env
      .SUPPLIER_HUB_SESSION_DIR ||
      "/data/supplier-sessions"
  ).trim();

const vaultKey =
  String(
    process.env
      .SUPPLIER_HUB_VAULT_KEY ||
      ""
  ).trim();

if (!vaultKey) {
  console.error(
    "SUPPLIER_HUB_VAULT_KEY fehlt."
  );

  process.exit(1);
}

const sessionStore =
  new SupplierSessionStore({
    directory:
      sessionDirectory,
    vaultKey
  });

const loginTickets =
  new LoginTicketStore();

const browserRuntime =
  new HostedBrowserRuntimeManager({
    ticketStore:
      loginTickets,
    sessionStore,
    executablePath:
      String(
        process.env
          .SUPPLIER_HUB_CHROMIUM_PATH ||
          ""
      ).trim(),
    loginUrl:
      String(
        process.env
          .SUPPLIER_HUB_METRO_LOGIN_URL ||
          "https://lieferservice.metro.de/"
      ).trim()
  });
const metroTransport =
  new MetroNativeTransport({
    executablePath:
      String(
        process.env
          .SUPPLIER_HUB_CHROMIUM_PATH ||
          ""
      ).trim(),
    headless:
      process.env
        .SUPPLIER_HUB_NATIVE_HEADLESS ===
        "1"
  });
const registry =
  new SupplierWorkerProviderRegistry()
    .register(
      new MetroHostedProvider({
        sessionStore,
        transport:
          metroTransport
      })
    );

function sendJson(
  response,
  status,
  data
) {
  const body =
    JSON.stringify(data);

  response.writeHead(
    status,
    {
      "content-type":
        "application/json; charset=utf-8",
      "cache-control":
        "no-store",
      "content-length":
        Buffer.byteLength(body)
    }
  );

  response.end(body);
}

async function readJson(
  request
) {
  const chunks = [];

  let size = 0;

  for await (
    const chunk of request
  ) {
    size += chunk.length;

    if (size > 256_000) {
      const error =
        new Error(
          "Request zu groß."
        );

      error.statusCode =
        413;

      throw error;
    }

    chunks.push(chunk);
  }

  if (
    chunks.length === 0
  ) {
    return {};
  }

  const text =
    Buffer.concat(
      chunks
    ).toString("utf8");

  try {
    return JSON.parse(text);
  }
  catch {
    const error =
      new Error(
        "Ungültiges JSON."
      );

    error.statusCode =
      400;

    throw error;
  }
}

function cleanText(
  value,
  maxLength = 240
) {
  return String(
    value || ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(
      0,
      maxLength
    );
}

function requireIdentity(
  input
) {
  const tenantId =
    cleanText(
      input.tenantId,
      120
    );

  const connectionId =
    cleanText(
      input.connectionId,
      120
    );

  if (
    !tenantId ||
    !connectionId
  ) {
    const error =
      new Error(
        "tenantId oder connectionId fehlt."
      );

    error.statusCode =
      400;

    throw error;
  }

  return {
    tenantId,
    connectionId
  };
}

async function handleRequest(
  request,
  response
) {
  const url =
    new URL(
      request.url ||
        "/",
      "http://localhost"
    );

  if (
    request.method ===
      "GET" &&
    url.pathname ===
      "/health"
  ) {
    return sendJson(
      response,
      200,
      {
        ok: true,
        service:
          "gastario-supplier-hub-worker",
        version:
          "0.1.0",
        timestamp:
          new Date().toISOString()
      }
    );
  }

  /*
   * Interne /v1/* APIs bleiben mit dem Service-Token geschützt.
   * Der Hosted-Login wird über ein kurzlebiges, zufälliges Login-Ticket
   * autorisiert und muss deshalb im normalen Browser erreichbar sein.
   */
  const isPublicLoginRoute =
    (
      request.method ===
        "GET" &&
      /^\/connect\/metro\/[A-Za-z0-9_-]{20,200}$/.test(
        url.pathname
      )
    ) ||
    /^\/public\/login\/[A-Za-z0-9_-]{20,200}\/(?:frame|status|input|complete|cancel)$/.test(
      url.pathname
    );

  if (
    !isPublicLoginRoute &&
    !verifyServiceToken(
      request,
      serviceToken
    )
  ) {
    return sendJson(
      response,
      401,
      {
        ok: false,
        error:
          "Nicht autorisiert."
      }
    );
  }

  if (
    request.method ===
      "POST" &&
    url.pathname ===
      "/v1/login/start"
  ) {
    const input =
      await readJson(
        request
      );

    const identity =
      requireIdentity(
        input
      );

    const provider =
      cleanText(
        input.provider ||
          "METRO",
        40
      ).toUpperCase();

    if (provider !== "METRO") {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "Dieser Login-Provider wird noch nicht unterstützt."
        }
      );
    }

    const ticket =
      loginTickets.create({
        ...identity,
        provider
      });

    await browserRuntime.start(
      ticket
    );

    /*
     * Phase 2.3:
     * Das Ticket ist jetzt die sichere Einmal-Verbindung
     * zwischen Gastario und einer späteren interaktiven
     * Hosted Browser Session.
     *
     * Phase 2.4 hängt hier den Browser Runtime Manager an.
     */
    const publicBaseUrl =
      String(
        process.env
          .SUPPLIER_HUB_PUBLIC_URL ||
          ""
      )
        .trim()
        .replace(/\/+$/, "");

    return sendJson(
      response,
      200,
      {
        ok: true,
        ticket:
          ticket.token,
        provider,
        state:
          ticket.state,
        expiresAt:
          ticket.expiresAt,
        connectUrl:
          publicBaseUrl
            ? (
                publicBaseUrl +
                "/connect/metro/" +
                encodeURIComponent(
                  ticket.token
                )
              )
            : null
      }
    );
  }

  if (
    request.method ===
      "GET" &&
    url.pathname ===
      "/v1/login/status"
  ) {
    const identity =
      requireIdentity({
        tenantId:
          url.searchParams.get(
            "tenantId"
          ),
        connectionId:
          url.searchParams.get(
            "connectionId"
          )
      });

    const token =
      cleanText(
        url.searchParams.get(
          "ticket"
        ),
        200
      );

    const ticket =
      loginTickets.assertOwnership({
        token,
        ...identity
      });

    if (!ticket) {
      return sendJson(
        response,
        404,
        {
          ok: false,
          error:
            "Login-Ticket wurde nicht gefunden oder ist abgelaufen."
        }
      );
    }

    return sendJson(
      response,
      200,
      {
        ok: true,
        provider:
          ticket.provider,
        state:
          ticket.state,
        expiresAt:
          ticket.expiresAt,
        message:
          ticket.message,
        completedAt:
          ticket.completedAt,
        failedAt:
          ticket.failedAt
      }
    );
  }
  const publicLoginMatch =
    url.pathname.match(
      /^\/connect\/metro\/([A-Za-z0-9_-]{20,200})$/
    );

  if (
    request.method === "GET" &&
    publicLoginMatch
  ) {
    const token =
      publicLoginMatch[1];

    const ticket =
      loginTickets.get(
        token
      );

    if (!ticket) {
      response.writeHead(
        404,
        {
          "content-type":
            "text/html; charset=utf-8",
          "cache-control":
            "no-store"
        }
      );

      response.end(
        "<!doctype html><html><body><h1>Login-Sitzung abgelaufen</h1></body></html>"
      );

      return;
    }

    const html =
      `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>METRO mit Gastario verbinden</title>
<style>
*{box-sizing:border-box}
:root{color-scheme:light;--ink:#12372b;--muted:#667a72;--line:#d9e6e1;--green:#07966f;--green-dark:#087e61;--success:#eaf8f2;--danger:#a4312b}
html,body{min-height:100%}
body{margin:0;background:#f3f7f5;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.shell{width:min(1440px,100%);margin:0 auto;padding:20px 22px 28px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:16px}
.brand{display:flex;align-items:center;gap:12px}
.brandmark{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--green);color:#fff;font-weight:900;font-size:18px}
.title h1{margin:0;font-size:21px;line-height:1.15}
.title p{margin:5px 0 0;color:var(--muted);font-size:13px}
.status{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:800}
.dot{width:8px;height:8px;border-radius:50%;background:#d7a11e}
.browser{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 18px 50px rgba(15,60,46,.08)}
.browser-head{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 14px;border-bottom:1px solid #e7efec;background:#fbfdfc}
.browser-head strong{font-size:13px}
.browser-head span{color:var(--muted);font-size:12px}
.frame-wrap{position:relative;min-height:620px;overflow:auto;background:#eef1f0;outline:none}
#frame{display:block;width:100%;height:auto;min-height:620px;user-select:none;-webkit-user-drag:none;cursor:pointer}
.helper{display:flex;justify-content:space-between;gap:18px;align-items:center;min-height:54px;padding:11px 14px;border-top:1px solid #e7efec;background:#fff}
.helper-text{color:var(--muted);font-size:12px;line-height:1.45}
button{border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}
.cancel{color:var(--danger);background:#fff2f1}
#error{display:none;margin:12px 0 0;border:1px solid #efc9c5;border-radius:12px;padding:10px 12px;background:#fff5f4;color:#8c2822;font-size:12px}
.success{display:none;min-height:690px;align-items:center;justify-content:center;padding:40px 20px}
.success-card{width:min(520px,100%);text-align:center}
.success-icon{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;margin:0 auto 18px;background:var(--success);color:var(--green-dark);font-size:30px;font-weight:900}
.success h2{margin:0;font-size:25px}
.success p{margin:10px auto 20px;max-width:430px;color:var(--muted);line-height:1.55}
.close-button{background:var(--green);color:#fff}
@media(max-width:760px){.shell{padding:12px}.topbar{align-items:flex-start;flex-direction:column}.frame-wrap,#frame{min-height:520px}.helper{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<div class="shell">
  <div class="topbar" id="topbar">
    <div class="brand">
      <div class="brandmark">G</div>
      <div class="title">
        <h1>METRO-Konto verbinden</h1>
        <p>Melde dich einmal bei METRO an. Gastario übernimmt danach automatisch.</p>
      </div>
    </div>
    <div class="status">
      <span class="dot" id="statusDot"></span>
      <span id="state">Anmeldung wird vorbereitet</span>
    </div>
  </div>

  <div class="browser" id="browser">
    <div class="browser-head">
      <strong>METRO Anmeldung</strong>
      <span>Klicke und tippe direkt im Fenster</span>
    </div>

    <div class="frame-wrap" id="frameWrap" tabindex="0" aria-label="METRO Browser">
      <img id="frame" alt="METRO Browser" draggable="false">
    </div>

    <div class="helper">
      <div class="helper-text">
        Dein Passwort wird nicht in Gastario gespeichert.
        Nach erfolgreicher Anmeldung wird nur die verschlüsselte Sitzung hinterlegt.
      </div>
      <button class="cancel" id="cancel">Abbrechen</button>
    </div>
  </div>

  <div id="error"></div>

  <div class="success" id="success">
    <div class="success-card">
      <div class="success-icon">✓</div>
      <h2>METRO erfolgreich verbunden</h2>
      <p>
        Dein METRO-Konto ist jetzt mit Gastario verbunden.
        Preise und Verfügbarkeiten können künftig automatisch aktualisiert werden.
      </p>
      <button class="close-button" id="closeWindow">Zurück zu Gastario</button>
    </div>
  </div>
</div>

<script>
const token = ${JSON.stringify(token)};
const frame = document.getElementById("frame");
const frameWrap = document.getElementById("frameWrap");
const browser = document.getElementById("browser");
const topbar = document.getElementById("topbar");
const success = document.getElementById("success");
const state = document.getElementById("state");
const statusDot = document.getElementById("statusDot");
const errorBox = document.getElementById("error");

let timer = null;
let completing = false;
let authenticatedChecks = 0;
let lastFrameRefresh = 0;

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || ("HTTP " + response.status));
  }
  return response;
}

function setState(label, kind) {
  state.textContent = label;
  statusDot.style.background =
    kind === "success"
      ? "#07966f"
      : kind === "error"
        ? "#c93c32"
        : "#d7a11e";
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  errorBox.textContent = "Die Verbindung konnte nicht abgeschlossen werden. " + message;
  errorBox.style.display = "block";
  setState("Verbindung prüfen", "error");
}

function refreshFrame(force) {
  const now = Date.now();
  if (!force && now - lastFrameRefresh < 650) {
    return;
  }
  lastFrameRefresh = now;
  frame.src = "/public/login/" + encodeURIComponent(token) + "/frame?t=" + now;
}

function looksLikeAuthenticatedMetro(runtime) {
  const url = String(runtime?.url || "").toLowerCase();
  if (!url) {
    return false;
  }

  const metroShop = url.includes("lieferservice.metro.de");
  const loginLike =
    url.includes("/login") ||
    url.includes("/signin") ||
    url.includes("/auth") ||
    url.includes("identity") ||
    url.includes("oauth");

  return metroShop && !loginLike;
}

async function completeAutomatically() {
  if (completing) {
    return;
  }

  completing = true;

  try {
    setState("Verbindung wird gespeichert", "pending");

    await api(
      "/public/login/" + encodeURIComponent(token) + "/complete",
      { method: "POST" }
    );

    clearInterval(timer);
    setState("Verbunden", "success");
    browser.style.display = "none";
    topbar.style.display = "none";
    errorBox.style.display = "none";
    success.style.display = "flex";

    setTimeout(() => {
      try {
        window.opener?.focus();
        window.close();
      }
      catch {}
    }, 2200);
  }
  catch (error) {
    completing = false;
    authenticatedChecks = 0;
    showError(error);
  }
}

async function refreshStatus() {
  try {
    const response = await api(
      "/public/login/" + encodeURIComponent(token) + "/status"
    );
    const data = await response.json();

    if (data.state === "COMPLETED") {
      clearInterval(timer);
      browser.style.display = "none";
      topbar.style.display = "none";
      success.style.display = "flex";
      return;
    }

    if (data.state === "CANCELLED" || data.state === "FAILED") {
      clearInterval(timer);
      setState(data.message || "Verbindung beendet", "error");
      return;
    }

    if (looksLikeAuthenticatedMetro(data.runtime)) {
      authenticatedChecks += 1;
      setState("Anmeldung erkannt", "pending");

      if (authenticatedChecks >= 2) {
        await completeAutomatically();
      }
      return;
    }

    authenticatedChecks = 0;
    setState("Bei METRO anmelden", "pending");
  }
  catch {
    setState("Verbindung wird wiederhergestellt", "error");
  }
}

async function sendInput(payload) {
  await api(
    "/public/login/" + encodeURIComponent(token) + "/input",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  setTimeout(() => refreshFrame(true), 180);
  setTimeout(refreshStatus, 260);
}

frame.addEventListener("click", async (event) => {
  try {
    frameWrap.focus();

    const rect = frame.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (1280 / rect.width);
    const y = (event.clientY - rect.top) * (800 / rect.height);

    await sendInput({
      type: "click",
      x,
      y
    });
  }
  catch (error) {
    showError(error);
  }
});

frameWrap.addEventListener("keydown", async (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const specialKeys = new Set([
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

  try {
    if (specialKeys.has(event.key)) {
      event.preventDefault();
      await sendInput({
        type: "key",
        key: event.key
      });
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      await sendInput({
        type: "text",
        text: event.key
      });
    }
  }
  catch (error) {
    showError(error);
  }
});

document.getElementById("cancel").onclick = async () => {
  try {
    await api(
      "/public/login/" + encodeURIComponent(token) + "/cancel",
      { method: "POST" }
    );
  }
  finally {
    clearInterval(timer);
    try {
      window.opener?.focus();
      window.close();
    }
    catch {}
  }
};

document.getElementById("closeWindow").onclick = () => {
  try {
    window.opener?.focus();
    window.close();
  }
  catch {
    history.back();
  }
};

frameWrap.focus();
refreshFrame(true);
refreshStatus();

timer = setInterval(() => {
  if (!completing) {
    refreshFrame(false);
    refreshStatus();
  }
}, 900);
</script>
</body>
</html>`;
    response.writeHead(
      200,
      {
        "content-type":
          "text/html; charset=utf-8",
        "cache-control":
          "no-store",
        "content-security-policy":
          "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none';"
      }
    );

    response.end(html);
    return;
  }

  const publicRuntimeMatch =
    url.pathname.match(
      /^\/public\/login\/([A-Za-z0-9_-]{20,200})\/(frame|status|input|complete|cancel)$/
    );

  if (publicRuntimeMatch) {
    const token =
      publicRuntimeMatch[1];

    const operation =
      publicRuntimeMatch[2];

    const ticket =
      loginTickets.get(
        token
      );

    if (!ticket) {
      return sendJson(
        response,
        404,
        {
          ok: false,
          error:
            "Login-Sitzung wurde nicht gefunden oder ist abgelaufen."
        }
      );
    }

    if (
      request.method === "GET" &&
      operation === "frame"
    ) {
      const image =
        await browserRuntime
          .screenshot(token);

      response.writeHead(
        200,
        {
          "content-type":
            "image/jpeg",
          "cache-control":
            "no-store",
          "content-length":
            image.length
        }
      );

      response.end(image);
      return;
    }

    if (
      request.method === "GET" &&
      operation === "status"
    ) {
      const runtimeStatus =
        await browserRuntime
          .status(token);

      return sendJson(
        response,
        200,
        {
          ok: true,
          state:
            ticket.state,
          message:
            ticket.message,
          runtime:
            runtimeStatus
        }
      );
    }

    if (
      request.method === "POST" &&
      operation === "input"
    ) {
      const input =
        await readJson(
          request
        );

      await browserRuntime.input(
        token,
        input
      );

      return sendJson(
        response,
        200,
        {
          ok: true
        }
      );
    }

    if (
      request.method === "POST" &&
      operation === "complete"
    ) {
      const result =
        await browserRuntime
          .complete(token);

      return sendJson(
        response,
        200,
        result
      );
    }

    if (
      request.method === "POST" &&
      operation === "cancel"
    ) {
      await browserRuntime
        .cancel(token);

      return sendJson(
        response,
        200,
        {
          ok: true,
          state:
            "CANCELLED"
        }
      );
    }
  }
  if (
    request.method ===
      "GET" &&
    url.pathname ===
      "/v1/session/status"
  ) {
    const identity =
      requireIdentity({
        tenantId:
          url.searchParams.get(
            "tenantId"
          ),
        connectionId:
          url.searchParams.get(
            "connectionId"
          )
      });

    const status =
      await sessionStore.status(
        identity
      );

    return sendJson(
      response,
      200,
      {
        ok: true,
        ...identity,
        ...status
      }
    );
  }

  if (
    request.method ===
      "PUT" &&
    url.pathname ===
      "/v1/session/storage-state"
  ) {
    const input =
      await readJson(
        request
      );

    const identity =
      requireIdentity(
        input
      );

    if (
      !input.storageState ||
      typeof input.storageState !==
        "object" ||
      Array.isArray(
        input.storageState
      )
    ) {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "storageState fehlt."
        }
      );
    }

    const saved =
      await sessionStore.set({
        ...identity,
        session: {
          provider:
            "METRO",
          storageState:
            input.storageState,
          metadata:
            input.metadata &&
            typeof input.metadata ===
              "object" &&
            !Array.isArray(
              input.metadata
            )
              ? input.metadata
              : {}
        }
      });

    return sendJson(
      response,
      200,
      {
        ok: true,
        provider:
          "METRO",
        ...saved
      }
    );
  }

  if (
    request.method ===
      "DELETE" &&
    url.pathname ===
      "/v1/session"
  ) {
    const input =
      await readJson(
        request
      );

    const identity =
      requireIdentity(
        input
      );

    const deleted =
      await sessionStore.delete(
        identity
      );

    return sendJson(
      response,
      200,
      {
        ok: true,
        deleted,
        ...identity
      }
    );
  }
  if (
    request.method ===
      "GET" &&
    url.pathname ===
      "/v1/health"
  ) {
    const identity =
      requireIdentity({
        tenantId:
          url.searchParams.get(
            "tenantId"
          ),
        connectionId:
          url.searchParams.get(
            "connectionId"
          )
      });

    const provider =
      registry.get("METRO");

    const health =
      await provider.health(
        identity
      );

    return sendJson(
      response,
      200,
      {
        ok:
          health.ok,
        provider:
          "METRO",
        ...health
      }
    );
  }

  if (
    request.method ===
      "POST" &&
    url.pathname ===
      "/v1/search"
  ) {
    const input =
      await readJson(
        request
      );

    const identity =
      requireIdentity(
        input
      );

    const query =
      cleanText(
        input.query,
        240
      );

    if (
      query.length < 2
    ) {
      return sendJson(
        response,
        400,
        {
          ok: false,
          error:
            "Suchbegriff muss mindestens 2 Zeichen enthalten."
        }
      );
    }

    const limit =
      Math.min(
        100,
        Math.max(
          1,
          Math.floor(
            Number(
              input.limit ||
              20
            )
          )
        )
      );

    const provider =
      registry.get("METRO");

    const products =
      await provider.search({
        ...identity,
        query,
        limit
      });

    return sendJson(
      response,
      200,
      {
        ok: true,
        provider:
          "METRO",
        query,
        products
      }
    );
  }

  if (
    request.method ===
      "POST" &&
    url.pathname ===
      "/v1/prices"
  ) {
    const input =
      await readJson(
        request
      );

    const identity =
      requireIdentity(
        input
      );

    const externalIds =
      Array.isArray(
        input.externalIds
      )
        ? Array.from(
            new Set(
              input.externalIds
                .map(
                  (value) =>
                    cleanText(
                      value,
                      160
                    )
                )
                .filter(Boolean)
            )
          ).slice(
            0,
            100
          )
        : [];

    const provider =
      registry.get("METRO");

    const products =
      await provider.refreshPrices({
        ...identity,
        externalIds
      });

    return sendJson(
      response,
      200,
      {
        ok: true,
        provider:
          "METRO",
        products
      }
    );
  }

  return sendJson(
    response,
    404,
    {
      ok: false,
      error:
        "Route nicht gefunden."
    }
  );
}

const server =
  http.createServer(
    async (
      request,
      response
    ) => {
      try {
        await handleRequest(
          request,
          response
        );
      }
      catch (error) {
        const statusCode =
          Number(
            error?.statusCode ||
            (
              error?.code ===
                "REAUTH_REQUIRED"
                ? 409
                : error?.code ===
                    "TRANSPORT_NOT_READY"
                  ? 503
                  : 500
            )
          );

        sendJson(
          response,
          statusCode,
          {
            ok: false,
            code:
              error?.code ||
              "SUPPLIER_WORKER_ERROR",
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }
        );
      }
    }
  );

server.listen(
  port,
  "0.0.0.0",
  () => {
    console.log(
      JSON.stringify({
        event:
          "supplier-hub-worker-started",
        port,
        providers: [
          "METRO"
        ]
      })
    );
  }
);
