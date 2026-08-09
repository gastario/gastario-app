import {
  extractGenericNetworkProducts
} from "./generic-network.js";

import type {
  SupplierAdapter,
  SupplierEndpointKind
} from "./types.js";

import type {
  SupplierKey
} from "../types.js";

export function createNetworkFirstAdapter(
  options: {
    key: SupplierKey;
    displayName: string;
    hosts: readonly string[];
  }
): SupplierAdapter {
  return {
    ...options,

    matchesUrl(url: string) {
      try {
        const hostname =
          new URL(url)
            .hostname
            .toLowerCase();

        return options.hosts.some(
          (host) =>
            hostname === host ||
            hostname.endsWith(
              `.${host}`
            )
        );
      } catch {
        return false;
      }
    },

    classifyEndpoint(
      _url: string
    ): SupplierEndpointKind {
      return "OTHER";
    },

    async extractNetworkProducts(
      observation
    ) {
      return extractGenericNetworkProducts(
        options.key,
        observation
      );
    }
  };
}
