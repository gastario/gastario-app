type SupplierConnectResult = {
  ok: boolean;
  ticket: string;
  provider: string;
  state: string;
  expiresAt: string;
  connectUrl: string | null;
};

function workerConfig() {
  const baseUrl =
    String(
      process.env
        .SUPPLIER_HUB_METRO_GATEWAY_URL ||
        ""
    )
      .trim()
      .replace(/\/+$/, "");

  const serviceToken =
    String(
      process.env
        .SUPPLIER_HUB_SERVICE_TOKEN ||
        ""
    ).trim();

  if (!baseUrl) {
    throw new Error(
      "SUPPLIER_HUB_METRO_GATEWAY_URL fehlt."
    );
  }

  if (!serviceToken) {
    throw new Error(
      "SUPPLIER_HUB_SERVICE_TOKEN fehlt."
    );
  }

  return {
    baseUrl,
    serviceToken
  };
}

async function requestWorker(
  path: string,
  init?: RequestInit
) {
  const {
    baseUrl,
    serviceToken
  } = workerConfig();

  const response =
    await fetch(
      `${baseUrl}${path}`,
      {
        ...init,
        headers: {
          accept:
            "application/json",
          authorization:
            `Bearer ${serviceToken}`,
          ...(init?.body
            ? {
                "content-type":
                  "application/json"
              }
            : {}),
          ...(init?.headers || {})
        }
      }
    );

  const body =
    await response.json()
      .catch(
        () => ({})
      );

  if (!response.ok) {
    throw new Error(
      typeof body?.error ===
      "string"
        ? body.error
        : `Supplier Worker HTTP ${response.status}`
    );
  }

  return body;
}

export async function startSupplierConnect({
  tenantId,
  connectionId,
  provider = "METRO"
}: {
  tenantId: string;
  connectionId: string;
  provider?: string;
}): Promise<SupplierConnectResult> {
  return await requestWorker(
    "/v1/login/start",
    {
      method: "POST",
      body:
        JSON.stringify({
          tenantId,
          connectionId,
          provider
        })
    }
  );
}

export async function readSupplierConnectStatus({
  tenantId,
  connectionId,
  ticket
}: {
  tenantId: string;
  connectionId: string;
  ticket: string;
}) {
  const params =
    new URLSearchParams({
      tenantId,
      connectionId,
      ticket
    });

  return await requestWorker(
    `/v1/login/status?${params.toString()}`
  );
}
