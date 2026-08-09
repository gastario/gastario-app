import {
  createNetworkFirstAdapter
} from "./factory.js";

export const metroAdapter =
  createNetworkFirstAdapter({
    key: "metro",
    displayName: "METRO",
    hosts: [
      "lieferservice.metro.de"
    ]
  });
