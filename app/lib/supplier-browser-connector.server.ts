import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const CONNECTOR_CODE_PREFIX = "gsc1";

export type SupplierBrowserConnectorCode = {
  code: string;
  tokenHash: string;
  tokenLastFour: string;
  createdAt: string;
};

function hashConnectorSecret(
  connectionId: string,
  secret: string
) {
  return createHash("sha256")
    .update(`${connectionId}:${secret}`, "utf8")
    .digest("hex");
}

export function createSupplierBrowserConnectorCode(
  connectionId: string
): SupplierBrowserConnectorCode {
  const normalizedConnectionId = String(
    connectionId || ""
  ).trim();

  if (!normalizedConnectionId) {
    throw new Error(
      "Lieferantenverbindung fehlt."
    );
  }

  const secret = randomBytes(32).toString(
    "base64url"
  );

  return {
    code: [
      CONNECTOR_CODE_PREFIX,
      normalizedConnectionId,
      secret,
    ].join("."),
    tokenHash: hashConnectorSecret(
      normalizedConnectionId,
      secret
    ),
    tokenLastFour: secret.slice(-4),
    createdAt: new Date().toISOString(),
  };
}

export function parseSupplierBrowserConnectorCode(
  value: unknown
) {
  const code = String(value || "").trim();
  const parts = code.split(".");

  if (
    parts.length !== 3 ||
    parts[0] !== CONNECTOR_CODE_PREFIX
  ) {
    return null;
  }

  const connectionId = parts[1].trim();
  const secret = parts[2].trim();

  if (
    !/^[a-zA-Z0-9_-]{8,80}$/.test(
      connectionId
    ) ||
    !/^[a-zA-Z0-9_-]{32,100}$/.test(secret)
  ) {
    return null;
  }

  return {
    connectionId,
    secret,
  };
}

export function verifySupplierBrowserConnectorCode({
  connectionId,
  secret,
  expectedHash,
}: {
  connectionId: string;
  secret: string;
  expectedHash: unknown;
}) {
  const normalizedExpectedHash = String(
    expectedHash || ""
  )
    .trim()
    .toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(normalizedExpectedHash)) {
    return false;
  }

  const actualHash = hashConnectorSecret(
    connectionId,
    secret
  );

  const actualBuffer = Buffer.from(
    actualHash,
    "hex"
  );

  const expectedBuffer = Buffer.from(
    normalizedExpectedHash,
    "hex"
  );

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(
      actualBuffer,
      expectedBuffer
    )
  );
}

export function readBearerToken(
  request: Request
) {
  const authorization = String(
    request.headers.get("authorization") || ""
  ).trim();

  const match = authorization.match(
    /^Bearer\s+(.+)$/i
  );

  return match ? match[1].trim() : "";
}
