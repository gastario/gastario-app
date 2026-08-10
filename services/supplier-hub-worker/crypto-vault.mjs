import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";

const ALGORITHM =
  "aes-256-gcm";

const FORMAT_VERSION =
  1;

function deriveKey(
  secret
) {
  const normalized =
    String(secret || "")
      .trim();

  if (
    normalized.length < 32
  ) {
    throw new Error(
      "SUPPLIER_HUB_VAULT_KEY muss mindestens 32 Zeichen lang sein."
    );
  }

  return createHash(
    "sha256"
  )
    .update(
      normalized,
      "utf8"
    )
    .digest();
}

export class EncryptedJsonVault {
  constructor({
    secret
  }) {
    this.key =
      deriveKey(secret);
  }

  encrypt(
    value,
    aad = ""
  ) {
    const iv =
      randomBytes(12);

    const cipher =
      createCipheriv(
        ALGORITHM,
        this.key,
        iv
      );

    const aadBuffer =
      Buffer.from(
        String(aad || ""),
        "utf8"
      );

    if (
      aadBuffer.length > 0
    ) {
      cipher.setAAD(
        aadBuffer
      );
    }

    const plaintext =
      Buffer.from(
        JSON.stringify(value),
        "utf8"
      );

    const ciphertext =
      Buffer.concat([
        cipher.update(
          plaintext
        ),
        cipher.final()
      ]);

    const authTag =
      cipher.getAuthTag();

    return {
      version:
        FORMAT_VERSION,
      algorithm:
        ALGORITHM,
      iv:
        iv.toString(
          "base64"
        ),
      authTag:
        authTag.toString(
          "base64"
        ),
      ciphertext:
        ciphertext.toString(
          "base64"
        )
    };
  }

  decrypt(
    envelope,
    aad = ""
  ) {
    if (
      !envelope ||
      envelope.version !==
        FORMAT_VERSION ||
      envelope.algorithm !==
        ALGORITHM
    ) {
      throw new Error(
        "Unbekanntes Supplier-Vault-Format."
      );
    }

    const decipher =
      createDecipheriv(
        ALGORITHM,
        this.key,
        Buffer.from(
          envelope.iv,
          "base64"
        )
      );

    const aadBuffer =
      Buffer.from(
        String(aad || ""),
        "utf8"
      );

    if (
      aadBuffer.length > 0
    ) {
      decipher.setAAD(
        aadBuffer
      );
    }

    decipher.setAuthTag(
      Buffer.from(
        envelope.authTag,
        "base64"
      )
    );

    const plaintext =
      Buffer.concat([
        decipher.update(
          Buffer.from(
            envelope.ciphertext,
            "base64"
          )
        ),
        decipher.final()
      ]);

    return JSON.parse(
      plaintext.toString(
        "utf8"
      )
    );
  }
}
