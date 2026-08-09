import {
  AdapterRegistry
} from "../core/adapter-registry.js";

import {
  metroAdapter
} from "./metro.js";

import {
  selgrosAdapter
} from "./selgros.js";

import {
  transgourmetAdapter
} from "./transgourmet.js";

import {
  chefsCulinarAdapter
} from "./chefs-culinar.js";

export function createSupplierRegistry() {
  return new AdapterRegistry()
    .register(metroAdapter)
    .register(selgrosAdapter)
    .register(
      transgourmetAdapter
    )
    .register(
      chefsCulinarAdapter
    );
}
