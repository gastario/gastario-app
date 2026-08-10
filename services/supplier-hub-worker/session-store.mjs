import fs from "node:fs/promises";
import path from "node:path";

import {
  EncryptedJsonVault
} from "./crypto-vault.mjs";

function safePart(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /[^A-Za-z0-9_-]/g,
      "_"
    )
    .slice(
      0,
      140
    );
}

function keyOf({
  tenantId,
  connectionId
}) {
  return (
    String(tenantId || "") +
    "::" +
    String(connectionId || "")
  );
}

function aadOf({
  tenantId,
  connectionId
}) {
  return (
    "gastario-supplier-session:" +
    keyOf({
      tenantId,
      connectionId
    })
  );
}

export class SupplierSessionStore {
  constructor({
    directory,
    vaultKey
  }) {
    this.directory =
      path.resolve(
        directory
      );

    this.vault =
      new EncryptedJsonVault({
        secret:
          vaultKey
      });
  }

  filePath({
    tenantId,
    connectionId
  }) {
    return path.join(
      this.directory,
      safePart(tenantId),
      safePart(connectionId) +
        ".session.json"
    );
  }

  async ensureDirectory({
    tenantId
  }) {
    await fs.mkdir(
      path.join(
        this.directory,
        safePart(tenantId)
      ),
      {
        recursive: true,
        mode: 0o700
      }
    );
  }

  async get({
    tenantId,
    connectionId
  }) {
    const file =
      this.filePath({
        tenantId,
        connectionId
      });

    let raw;

    try {
      raw =
        await fs.readFile(
          file,
          "utf8"
        );
    }
    catch (error) {
      if (
        error?.code ===
          "ENOENT"
      ) {
        return null;
      }

      throw error;
    }

    const envelope =
      JSON.parse(raw);

    const session =
      this.vault.decrypt(
        envelope,
        aadOf({
          tenantId,
          connectionId
        })
      );

    return {
      ...session,
      tenantId,
      connectionId
    };
  }

  async set({
    tenantId,
    connectionId,
    session
  }) {
    await this.ensureDirectory({
      tenantId
    });

    const payload = {
      ...session,
      tenantId,
      connectionId,
      updatedAt:
        new Date().toISOString()
    };

    const envelope =
      this.vault.encrypt(
        payload,
        aadOf({
          tenantId,
          connectionId
        })
      );

    const file =
      this.filePath({
        tenantId,
        connectionId
      });

    const temporary =
      file +
      "." +
      process.pid +
      "." +
      Date.now() +
      ".tmp";

    await fs.writeFile(
      temporary,
      JSON.stringify(
        envelope
      ),
      {
        encoding: "utf8",
        mode: 0o600
      }
    );

    await fs.rename(
      temporary,
      file
    );

    return {
      tenantId,
      connectionId,
      updatedAt:
        payload.updatedAt
    };
  }

  async delete({
    tenantId,
    connectionId
  }) {
    try {
      await fs.unlink(
        this.filePath({
          tenantId,
          connectionId
        })
      );

      return true;
    }
    catch (error) {
      if (
        error?.code ===
          "ENOENT"
      ) {
        return false;
      }

      throw error;
    }
  }

  async status({
    tenantId,
    connectionId
  }) {
    const session =
      await this.get({
        tenantId,
        connectionId
      });

    if (!session) {
      return {
        exists: false,
        updatedAt: null,
        provider:
          null
      };
    }

    return {
      exists: true,
      updatedAt:
        session.updatedAt ||
        null,
      provider:
        session.provider ||
        null
    };
  }
}
