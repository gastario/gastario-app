import {
  MetroNativeClient
} from "./clients/metro-native-client.server";

import type {
  MetroNativeGateway
} from "./clients/metro-native-client.server";

import {
  SupplierSearchOrchestrator
} from "./orchestrator.server";

import {
  SupplierProviderRegistry
} from "./provider-registry.server";

import {
  MetroSupplierProvider
} from "./providers/metro.server";

import type {
  SupplierSessionRef
} from "./types";

export function createSupplierHub({
  metroGateway,
  resolveSessions
}: {
  metroGateway:
    MetroNativeGateway;
  resolveSessions: (
    tenantId: string,
    supplierConnectionIds?: string[]
  ) => Promise<
    SupplierSessionRef[]
  >;
}) {
  const registry =
    new SupplierProviderRegistry();

  const metroClient =
    new MetroNativeClient(
      metroGateway
    );

  registry.register(
    new MetroSupplierProvider(
      metroClient
    )
  );

  const search =
    new SupplierSearchOrchestrator(
      registry,
      resolveSessions
    );

  return {
    registry,
    search
  };
}
