import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const mobileSecret =
  process.env.MANUAL_SHOPPING_MOBILE_SECRET ||
  process.env.SESSION_SECRET ||
  "gastario-dev-secret-change-me";

function tokenPayload(listId: string) {
  return `manual-shopping-mobile:${listId}`;
}

export function createManualShoppingMobileToken(
  listId: string
) {
  return createHmac(
    "sha256",
    mobileSecret
  )
    .update(tokenPayload(listId))
    .digest("base64url");
}

export function verifyManualShoppingMobileToken(
  listId: string,
  token: string
) {
  if (!listId || !token) {
    return false;
  }

  const expected =
    createManualShoppingMobileToken(
      listId
    );

  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8"
    );

  const actualBuffer =
    Buffer.from(
      token,
      "utf8"
    );

  if (
    expectedBuffer.length !==
    actualBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    actualBuffer
  );
}