import {
  randomBytes
} from "node:crypto";

const tickets =
  new Map();

const DEFAULT_TTL_MS =
  10 * 60 * 1000;

function createToken() {
  return randomBytes(32)
    .toString("base64url");
}

function nowIso() {
  return new Date()
    .toISOString();
}

export class LoginTicketStore {
  constructor({
    ttlMs =
      DEFAULT_TTL_MS
  } = {}) {
    this.ttlMs =
      Math.max(
        60_000,
        Math.min(
          30 * 60 * 1000,
          Number(ttlMs) ||
            DEFAULT_TTL_MS
        )
      );
  }

  cleanup() {
    const now =
      Date.now();

    for (
      const [
        token,
        ticket
      ] of tickets.entries()
    ) {
      if (
        ticket.expiresAtMs <= now
      ) {
        tickets.delete(token);
      }
    }
  }

  create({
    tenantId,
    connectionId,
    provider = "METRO"
  }) {
    this.cleanup();

    const token =
      createToken();

    const createdAtMs =
      Date.now();

    const ticket = {
      token,
      tenantId,
      connectionId,
      provider,
      state:
        "PENDING",
      createdAt:
        nowIso(),
      createdAtMs,
      expiresAt:
        new Date(
          createdAtMs +
            this.ttlMs
        ).toISOString(),
      expiresAtMs:
        createdAtMs +
        this.ttlMs,
      message:
        "Login-Sitzung wurde vorbereitet.",
      browserSessionId:
        null,
      completedAt:
        null,
      failedAt:
        null
    };

    tickets.set(
      token,
      ticket
    );

    return {
      ...ticket
    };
  }

  get(token) {
    this.cleanup();

    const ticket =
      tickets.get(
        String(token || "")
      );

    return ticket
      ? {
          ...ticket
        }
      : null;
  }

  update(
    token,
    patch
  ) {
    this.cleanup();

    const current =
      tickets.get(
        String(token || "")
      );

    if (!current) {
      return null;
    }

    const next = {
      ...current,
      ...patch
    };

    tickets.set(
      current.token,
      next
    );

    return {
      ...next
    };
  }

  assertOwnership({
    token,
    tenantId,
    connectionId
  }) {
    const ticket =
      this.get(token);

    if (
      !ticket ||
      ticket.tenantId !==
        tenantId ||
      ticket.connectionId !==
        connectionId
    ) {
      return null;
    }

    return ticket;
  }
}
