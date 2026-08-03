type SupplierPortalWorkerResponse = {
  ok: boolean;
  message: string;
  mfaRequired?: boolean;
  sessionStatus?: string;
};

type SupplierPortalWorkerRequest = {
  connectionId: string;
  tenantId: string;
};

function getWorkerConfiguration() {
  const baseUrl = String(
    process.env.SUPPLIER_PORTAL_WORKER_URL ||
      ""
  )
    .trim()
    .replace(/\/+$/, "");

  const token = String(
    process.env.SUPPLIER_PORTAL_WORKER_TOKEN ||
      ""
  ).trim();

  if (!baseUrl) {
    throw new Error(
      "SUPPLIER_PORTAL_WORKER_URL fehlt. Bitte zuerst den Railway-Browserworker verbinden."
    );
  }

  if (!token) {
    throw new Error(
      "SUPPLIER_PORTAL_WORKER_TOKEN fehlt. Bitte denselben geheimen Token in App und Worker hinterlegen."
    );
  }

  return { baseUrl, token };
}

async function callWorker(
  path: string,
  payload: Record<string, unknown>
): Promise<SupplierPortalWorkerResponse> {
  const { baseUrl, token } =
    getWorkerConfiguration();

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    115_000
  );

  try {
    const response = await fetch(
      `${baseUrl}${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    const result =
      (await response.json().catch(() => ({
        ok: false,
        message:
          "Der Browserworker hat keine gültige JSON-Antwort geliefert.",
      }))) as SupplierPortalWorkerResponse;

    if (!response.ok) {
      return {
        ok: false,
        message:
          result.message ||
          `Browserworker-Fehler ${response.status}.`,
      };
    }

    return result;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(
        "Der METRO-Browserlogin hat zu lange gedauert und wurde abgebrochen."
      );
    }

    throw new Error(
      "Der Lieferanten-Browserworker ist nicht erreichbar: " +
        String(error?.message || error)
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function startSupplierPortalLogin(
  request: SupplierPortalWorkerRequest
) {
  return callWorker(
    "/api/metro/login/start",
    request
  );
}

export function submitSupplierPortalOtp(
  request: SupplierPortalWorkerRequest & {
    code: string;
  }
) {
  return callWorker(
    "/api/metro/login/otp",
    request
  );
}
