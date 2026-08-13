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
body{margin:0;background:#eef5f2;color:#12372b;font-family:Inter,Arial,sans-serif}
.shell{max-width:1360px;margin:0 auto;padding:20px}
.header{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:14px}
h1{font-size:22px;margin:0}
p{margin:4px 0 0;color:#52665e}
.browser{background:#fff;border:1px solid #cfe0da;border-radius:16px;overflow:hidden;box-shadow:0 15px 40px rgba(12,70,52,.10)}
.bar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #e3ece8;background:#f8fbfa}
#state{font-size:13px;font-weight:700}
.frame-wrap{position:relative;background:#f3f3f3;overflow:auto}
#frame{display:block;width:100%;height:auto;min-height:520px;cursor:default}
.controls{display:flex;gap:10px;flex-wrap:wrap;padding:14px;background:#fff;border-top:1px solid #e3ece8}
input{flex:1;min-width:260px;border:1px solid #cbdad5;border-radius:10px;padding:11px 12px;font-size:14px}
button{border:0;border-radius:10px;padding:11px 15px;font-weight:800;cursor:pointer}
.primary{background:#07966f;color:#fff}
.secondary{background:#edf5f2;color:#12372b}
.danger{background:#fff0ef;color:#a4312b}
.note{padding:0 14px 14px;color:#6b7c75;font-size:12px}
</style>
</head>
<body>
<div class="shell">
  <div class="header">
    <div>
      <h1>METRO mit Gastario verbinden</h1>
      <p>Melde dich einmal direkt in der geschützten Gastario-Browsersitzung an.</p>
    </div>
    <strong id="state">Verbindung wird geladen …</strong>
  </div>

  <div class="browser">
    <div class="bar">
      <span>Geschützte Lieferanten-Sitzung</span>
      <button class="secondary" id="refresh">Bild aktualisieren</button>
    </div>

    <div class="frame-wrap">
      <img id="frame" alt="METRO Browser">
    </div>

    <div class="controls">
      <input
        id="text"
        autocomplete="off"
        placeholder="Text für das aktuell ausgewählte Feld eingeben"
      >
      <button class="secondary" id="type">Text eingeben</button>
      <button class="secondary" id="tab">Tab</button>
      <button class="secondary" id="enter">Enter</button>
      <button class="primary" id="complete">Anmeldung abgeschlossen</button>
      <button class="danger" id="cancel">Abbrechen</button>
    </div>

    <div class="note">
      Passwörter werden nicht in Gastario gespeichert. Eingaben werden direkt an die aktive Browser-Sitzung weitergegeben.
    </div>
  </div>
</div>

<script>
const token = ${JSON.stringify(token)};
const frame = document.getElementById("frame");
const state = document.getElementById("state");
let timer = null;

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || ("HTTP " + response.status));
  }
  return response;
}

async function refreshFrame() {
  frame.src = "/public/login/" + encodeURIComponent(token) + "/frame?t=" + Date.now();
}

async function refreshStatus() {
  try {
    const response = await api(
      "/public/login/" + encodeURIComponent(token) + "/status"
    );
    const data = await response.json();
    state.textContent = data.state || "INTERACTIVE";

    if (
      data.state === "COMPLETED" ||
      data.state === "CANCELLED" ||
      data.state === "FAILED"
    ) {
      clearInterval(timer);
    }
  }
  catch (error) {
    state.textContent = "Verbindung unterbrochen";
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

  setTimeout(refreshFrame, 250);
}

frame.addEventListener("click", async (event) => {
  const rect = frame.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (1280 / rect.width);
  const y = (event.clientY - rect.top) * (800 / rect.height);

  await sendInput({
    type: "click",
    x,
    y
  });
});

document.getElementById("type").onclick = async () => {
  const input = document.getElementById("text");
  const text = input.value;
  input.value = "";
  await sendInput({
    type: "text",
    text
  });
};

document.getElementById("tab").onclick = () =>
  sendInput({
    type: "key",
    key: "Tab"
  });

document.getElementById("enter").onclick = () =>
  sendInput({
    type: "key",
    key: "Enter"
  });

document.getElementById("refresh").onclick = refreshFrame;

document.getElementById("complete").onclick = async () => {
  await api(
    "/public/login/" + encodeURIComponent(token) + "/complete",
    {
      method: "POST"
    }
  );

  state.textContent = "Verbunden";
  clearInterval(timer);
  alert("METRO wurde mit Gastario verbunden.");
};

document.getElementById("cancel").onclick = async () => {
  await api(
    "/public/login/" + encodeURIComponent(token) + "/cancel",
    {
      method: "POST"
    }
  );

  state.textContent = "Abgebrochen";
  clearInterval(timer);
};

refreshFrame();
refreshStatus();
timer = setInterval(() => {
  refreshFrame();
  refreshStatus();
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
