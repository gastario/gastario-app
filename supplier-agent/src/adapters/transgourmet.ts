import {
  createNetworkFirstAdapter
} from "./factory.js";

export const transgourmetAdapter =
  createNetworkFirstAdapter({
    key: "transgourmet",
    displayName:
      "Transgourmet",
    hosts: [
      "transgourmet.de"
    ]
  });
