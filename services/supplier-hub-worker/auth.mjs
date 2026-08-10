import {
  timingSafeEqual
} from "node:crypto";

function toBuffer(
  value
) {
  return Buffer.from(
    String(value || ""),
    "utf8"
  );
}

export function readBearerToken(
  request
) {
  const header =
    String(
      request.headers.authorization ||
      ""
    ).trim();

  const match =
    header.match(
      /^Bearer\s+(.+)$/i
    );

  return match
    ? match[1].trim()
    : "";
}

export function verifyServiceToken(
  request,
  expectedToken
) {
  const actual =
    readBearerToken(
      request
    );

  const expected =
    String(
      expectedToken || ""
    ).trim();

  if (
    !actual ||
    !expected
  ) {
    return false;
  }

  const actualBuffer =
    toBuffer(actual);

  const expectedBuffer =
    toBuffer(expected);

  if (
    actualBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    actualBuffer,
    expectedBuffer
  );
}
