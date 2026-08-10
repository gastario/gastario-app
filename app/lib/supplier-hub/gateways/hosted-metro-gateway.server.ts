import type {
  MetroNativeGateway
} from "../clients/metro-native-client.server";

import type {
  SupplierSessionRef
} from "../types";

const DEFAULT_TIMEOUT_MS =
  8_000;

type HostedMetroGatewayOptions = {
  baseUrl: string;
  serviceToken: string;
  timeoutMs?: number;
};

function cleanBaseUrl(
  value: string
) {
  return value
    .trim()
    .replace(/\/+$/, "");
}

async function parseJsonResponse(
  response: Response
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  }
  catch {
    throw new Error(
      `Supplier gateway returned invalid JSON (${response.status}).`
    );
  }
}

export class HostedMetroGateway
  implements MetroNativeGateway {
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeoutMs: number;

  constructor(
    options:
      HostedMetroGatewayOptions
  ) {
    this.baseUrl =
      cleanBaseUrl(
        options.baseUrl
      );

    this.serviceToken =
      options.serviceToken.trim();

    this.timeoutMs =
      Math.max(
        1_000,
        Math.min(
          30_000,
          options.timeoutMs ??
            DEFAULT_TIMEOUT_MS
        )
      );

    if (!this.baseUrl) {
      throw new Error(
        "SUPPLIER_HUB_METRO_GATEWAY_URL fehlt."
      );
    }

    if (!this.serviceToken) {
      throw new Error(
        "SUPPLIER_HUB_SERVICE_TOKEN fehlt."
      );
    }
  }

  private async request(
    path: string,
    init?: RequestInit
  ) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        this.timeoutMs
      );

    try {
      const response =
        await fetch(
          `${this.baseUrl}${path}`,
          {
            ...init,
            headers: {
              accept:
                "application/json",
              authorization:
                `Bearer ${this.serviceToken}`,
              ...(init?.body
                ? {
                    "content-type":
                      "application/json"
                  }
                : {}),
              ...(init?.headers || {})
            },
            signal:
              controller.signal
          }
        );

      const body =
        await parseJsonResponse(
          response
        );

      if (!response.ok) {
        const message =
          typeof body?.error ===
          "string"
            ? body.error
            : typeof body?.message ===
                "string"
              ? body.message
              : `Supplier gateway HTTP ${response.status}`;

        throw new Error(
          message
        );
      }

      return body;
    }
    catch (error) {
      if (
        error instanceof Error &&
        error.name ===
          "AbortError"
      ) {
        throw new Error(
          "METRO Supplier Gateway Timeout."
        );
      }

      throw error;
    }
    finally {
      clearTimeout(timer);
    }
  }

  async health(
    session:
      SupplierSessionRef
  ) {
    const startedAt =
      Date.now();

    try {
      const params =
        new URLSearchParams({
          tenantId:
            session.tenantId,
          connectionId:
            session.supplierConnectionId
        });

      const body =
        await this.request(
          `/v1/health?${params.toString()}`
        );

      return {
        ok:
          body?.ok === true,
        latencyMs:
          Date.now() -
          startedAt,
        message:
          typeof body?.message ===
          "string"
            ? body.message
            : null,
        requiresUserAction:
          body?.requiresUserAction ===
          true
      };
    }
    catch (error) {
      return {
        ok:
          false,
        latencyMs:
          Date.now() -
          startedAt,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        requiresUserAction:
          false
      };
    }
  }

  async search(
    session:
      SupplierSessionRef,
    query: string,
    limit: number
  ) {
    const body =
      await this.request(
        "/v1/search",
        {
          method: "POST",
          body:
            JSON.stringify({
              tenantId:
                session.tenantId,
              connectionId:
                session.supplierConnectionId,
              query,
              limit
            })
        }
      );

    if (
      !Array.isArray(
        body?.products
      )
    ) {
      return [];
    }

    return body.products;
  }

  async refreshPrices(
    session:
      SupplierSessionRef,
    externalIds: string[]
  ) {
    const body =
      await this.request(
        "/v1/prices",
        {
          method: "POST",
          body:
            JSON.stringify({
              tenantId:
                session.tenantId,
              connectionId:
                session.supplierConnectionId,
              externalIds
            })
        }
      );

    if (
      !Array.isArray(
        body?.products
      )
    ) {
      return [];
    }

    return body.products;
  }
}

export function createHostedMetroGatewayFromEnv() {
  return new HostedMetroGateway({
    baseUrl:
      String(
        process.env
          .SUPPLIER_HUB_METRO_GATEWAY_URL ||
          ""
      ),
    serviceToken:
      String(
        process.env
          .SUPPLIER_HUB_SERVICE_TOKEN ||
          ""
      )
  });
}
