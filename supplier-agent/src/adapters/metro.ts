import {
  extractGenericNetworkProducts
} from "./generic-network.js";

import type {
  SupplierAdapter,
  SupplierEndpointKind
} from "./types.js";

function classifyMetroEndpoint(
  value: string
): SupplierEndpointKind {
  let pathname = "";

  try {
    pathname =
      new URL(value).pathname;
  } catch {
    pathname =
      value.split("?")[0];
  }

  if (
    pathname ===
    "/searchdiscover/articlesearch/search"
  ) {
    return "PRODUCT_SEARCH";
  }

  if (
    pathname ===
    "/evaluate.article.v1/betty-variants"
  ) {
    return "PRODUCT_VARIANTS";
  }

  if (
    pathname ===
    "/evaluate.article.v1/substitutes" ||
    pathname.includes(
      "/evaluate.article.v1/replacements/"
    )
  ) {
    return "PRODUCT_SUBSTITUTES";
  }

  if (
    pathname.includes(
      "/searchdiscover/navigationmenu/"
    ) ||
    pathname.includes(
      "/searchdiscover/category/"
    )
  ) {
    return "NAVIGATION";
  }

  if (
    pathname.includes(
      "/customer/"
    ) ||
    pathname.includes(
      "/businessaccounts/"
    ) ||
    pathname.includes(
      "/personallists/"
    ) ||
    pathname.includes(
      "/orderhistory/"
    )
  ) {
    return "ACCOUNT";
  }

  if (
    pathname.includes(
      "/customercart/"
    ) ||
    pathname.includes(
      "/checkout/"
    )
  ) {
    return "CART";
  }

  if (
    pathname.includes(
      "/price-config/"
    ) ||
    pathname.includes(
      "/uidispatcher/"
    ) ||
    pathname.includes(
      "/storeinfo/"
    ) ||
    pathname.includes(
      "/depotsettings/"
    ) ||
    pathname.includes(
      "/i18n/"
    )
  ) {
    return "CONFIG";
  }

  return "OTHER";
}

export const metroAdapter:
  SupplierAdapter = {
    key: "metro",

    displayName:
      "METRO",

    hosts: [
      "lieferservice.metro.de"
    ],

    matchesUrl(url: string) {
      try {
        const hostname =
          new URL(url)
            .hostname
            .toLowerCase();

        return (
          hostname ===
            "lieferservice.metro.de" ||
          hostname.endsWith(
            ".lieferservice.metro.de"
          )
        );
      } catch {
        return false;
      }
    },

    classifyEndpoint(
      url: string
    ) {
      return classifyMetroEndpoint(
        url
      );
    },

    async extractNetworkProducts(
      observation
    ) {
      const endpoint =
        classifyMetroEndpoint(
          observation.url
        );

      /*
       * Generic Parsing ist nur noch für produktnahe Endpoints erlaubt.
       * Account-, Navigation-, Cart- und Config-JSON darf niemals als
       * Produkt interpretiert werden.
       */
      if (
        endpoint !==
          "PRODUCT_SEARCH" &&
        endpoint !==
          "PRODUCT_DETAIL" &&
        endpoint !==
          "PRODUCT_VARIANTS" &&
        endpoint !==
          "PRODUCT_SUBSTITUTES"
      ) {
        return [];
      }

      return extractGenericNetworkProducts(
        "metro",
        observation
      );
    }
  };
