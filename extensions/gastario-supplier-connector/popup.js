const apiBaseUrlInput = document.getElementById(
  "apiBaseUrl"
);
const connectorCodeInput = document.getElementById(
  "connectorCode"
);
const saveButton = document.getElementById(
  "saveButton"
);
const testButton = document.getElementById(
  "testButton"
);
const captureButton = document.getElementById(
  "captureButton"
);
const statusBox = document.getElementById(
  "status"
);

function setStatus(text, tone = "info") {
  statusBox.textContent = text;
  statusBox.dataset.tone = tone;
}

function setBusy(busy) {
  for (const button of [
    saveButton,
    testButton,
    captureButton,
  ]) {
    button.disabled = busy;
  }
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(
    message
  );

  if (!response?.ok) {
    throw new Error(
      response?.error ||
        "Der Gastario-Connector antwortet nicht."
    );
  }

  return response;
}

async function saveSettings() {
  const response = await sendMessage({
    type: "GASTARIO_SAVE_SETTINGS",
    payload: {
      apiBaseUrl: apiBaseUrlInput.value,
      connectorCode:
        connectorCodeInput.value,
    },
  });

  apiBaseUrlInput.value =
    response.settings.apiBaseUrl;
  connectorCodeInput.value =
    response.settings.connectorCode;

  setStatus(
    "Gastario-Verbindung wurde lokal gespeichert.",
    "success"
  );
}

async function testConnection() {
  await saveSettings();

  const response = await sendMessage({
    type: "GASTARIO_TEST_CONNECTION",
  });

  const connection = response.data.connection;

  setStatus(
    `Verbunden mit ${connection.supplierName}` +
      (connection.locationName
        ? ` · ${connection.locationName}`
        : ""),
    "success"
  );
}

async function captureProducts() {
  await saveSettings();

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (
    !tab?.id ||
    !String(tab.url || "").startsWith(
      "https://lieferservice.metro.de/"
    )
  ) {
    throw new Error(
      "Bitte zuerst eine METRO-Lieferservice-Seite öffnen."
    );
  }

  const captureResponse =
    await chrome.tabs.sendMessage(
      tab.id,
      {
        type: "GASTARIO_COLLECT_PRODUCTS",
      }
    );

  if (!captureResponse?.ok) {
    throw new Error(
      captureResponse?.error ||
        "Die sichtbaren METRO-Produkte konnten nicht gelesen werden. Seite bitte neu laden."
    );
  }

  const count =
    captureResponse.capture?.products?.length || 0;

  if (count === 0) {
    throw new Error(
      "Auf der aktuellen Seite wurden keine sichtbaren Produktkarten erkannt."
    );
  }

  setStatus(
    `${count} Produkte werden an Gastario übertragen …`,
    "info"
  );

  const response = await sendMessage({
    type: "GASTARIO_PUSH_CAPTURE",
    payload: captureResponse.capture,
  });

  setStatus(
    response.data.message ||
      `${response.data.itemsAccepted} Produkte wurden übertragen.`,
    response.data.status === "PARTIAL"
      ? "info"
      : "success"
  );
}

async function run(task) {
  setBusy(true);

  try {
    await task();
  } catch (error) {
    setStatus(
      String(error?.message || error),
      "error"
    );
  } finally {
    setBusy(false);
  }
}

saveButton.addEventListener("click", () => {
  run(saveSettings);
});

testButton.addEventListener("click", () => {
  run(testConnection);
});

captureButton.addEventListener("click", () => {
  run(captureProducts);
});

chrome.runtime.sendMessage(
  {
    type: "GASTARIO_READ_SETTINGS",
  },
  (response) => {
    if (!response?.ok) {
      return;
    }

    apiBaseUrlInput.value =
      response.settings.apiBaseUrl || "";
    connectorCodeInput.value =
      response.settings.connectorCode || "";
  }
);
