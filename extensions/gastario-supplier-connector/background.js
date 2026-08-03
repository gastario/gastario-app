const DEFAULT_API_BASE =
  "https://gastario-app-production.up.railway.app";

function normalizeApiBase(value) {
  const text = String(value || "").trim();

  if (!text) {
    return DEFAULT_API_BASE;
  }

  try {
    const url = new URL(text);

    if (url.protocol !== "https:") {
      throw new Error("Gastario muss über HTTPS erreichbar sein.");
    }

    return url.origin;
  } catch (error) {
    throw new Error(
      error?.message ||
        "Die Gastario-Adresse ist ungültig."
    );
  }
}

async function readSettings() {
  const stored = await chrome.storage.local.get([
    "apiBaseUrl",
    "connectorCode",
  ]);

  return {
    apiBaseUrl: normalizeApiBase(
      stored.apiBaseUrl || DEFAULT_API_BASE
    ),
    connectorCode: String(
      stored.connectorCode || ""
    ).trim(),
  };
}

async function saveSettings(input) {
  const apiBaseUrl = normalizeApiBase(
    input?.apiBaseUrl
  );

  const connectorCode = String(
    input?.connectorCode || ""
  ).trim();

  if (!connectorCode) {
    throw new Error(
      "Bitte den Gastario-Verbindungscode eintragen."
    );
  }

  await chrome.storage.local.set({
    apiBaseUrl,
    connectorCode,
  });

  return {
    apiBaseUrl,
    connectorCode,
  };
}

async function apiRequest({
  method,
  body,
}) {
  const settings = await readSettings();

  if (!settings.connectorCode) {
    throw new Error(
      "Der Gastario-Verbindungscode fehlt."
    );
  }

  const response = await fetch(
    `${settings.apiBaseUrl}/api/supplier-browser-connector`,
    {
      method,
      headers: {
        Authorization:
          `Bearer ${settings.connectorCode}`,
        ...(body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
      },
      body: body
        ? JSON.stringify(body)
        : undefined,
      cache: "no-store",
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Gastario antwortete mit Status ${response.status}.`
    );
  }

  return data;
}

chrome.runtime.onInstalled.addListener(
  async () => {
    const settings = await chrome.storage.local.get(
      "apiBaseUrl"
    );

    if (!settings.apiBaseUrl) {
      await chrome.storage.local.set({
        apiBaseUrl: DEFAULT_API_BASE,
      });
    }
  }
);

chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    const run = async () => {
      switch (message?.type) {
        case "GASTARIO_SAVE_SETTINGS":
          return {
            ok: true,
            settings: await saveSettings(
              message.payload
            ),
          };

        case "GASTARIO_READ_SETTINGS":
          return {
            ok: true,
            settings: await readSettings(),
          };

        case "GASTARIO_TEST_CONNECTION":
          return {
            ok: true,
            data: await apiRequest({
              method: "GET",
            }),
          };

        case "GASTARIO_PUSH_CAPTURE":
          return {
            ok: true,
            data: await apiRequest({
              method: "POST",
              body: message.payload,
            }),
          };

        default:
          throw new Error(
            "Unbekannte Connector-Aktion."
          );
      }
    };

    run()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: String(
            error?.message || error
          ),
        });
      });

    return true;
  }
);
