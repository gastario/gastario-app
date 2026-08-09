import {
  createNetworkFirstAdapter
} from "./factory.js";

export const chefsCulinarAdapter =
  createNetworkFirstAdapter({
    key: "chefs-culinar",
    displayName:
      "CHEFS CULINAR",
    hosts: [
      "chefsculinar.de"
    ]
  });
