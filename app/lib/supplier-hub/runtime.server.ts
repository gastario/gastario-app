import {
  createSupplierHub
} from "./bootstrap.server";

import {
  createHostedMetroGatewayFromEnv
} from "./gateways/hosted-metro-gateway.server";

import {
  resolveSupplierSessions
} from "./sessions.server";

let supplierHub:
  ReturnType<
    typeof createSupplierHub
  > | null = null;

export function getSupplierHub() {
  if (!supplierHub) {
    supplierHub =
      createSupplierHub({
        metroGateway:
          createHostedMetroGatewayFromEnv(),
        resolveSessions:
          resolveSupplierSessions
      });
  }

  return supplierHub;
}

export function resetSupplierHubForTests() {
  supplierHub = null;
}
