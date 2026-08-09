import {
  createNetworkFirstAdapter
} from "./factory.js";

export const selgrosAdapter =
  createNetworkFirstAdapter({
    key: "selgros",
    displayName: "SELGROS",
    hosts: [
      "selgros.de"
    ]
  });
