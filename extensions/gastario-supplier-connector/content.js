(() => {
  if (window.__gastarioSupplierConnectorLoaded) {
    return;
  }

  window.__gastarioSupplierConnectorLoaded = true;

  const EURO_PATTERN =
    /([0-9]{1,6}(?:[.,][0-9]{2}))\s*€/g;

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();
  }

  function cents(value) {
    const normalized = String(value || "")
      .replace(/\./g, "")
      .replace(",", ".");

    const number = Number(normalized);

    return Number.isFinite(number)
      ? Math.round(number * 100)
      : null;
  }

  function safeUrl(value) {
    try {
      const url = new URL(
        String(value || ""),
        window.location.href
      );

      if (url.protocol !== "https:") {
        return null;
      }

      url.hash = "";

      return url.toString();
    } catch {
      return null;
    }
  }

  function firstUsefulText(root, selectors) {
    for (const selector of selectors) {
      const elements = Array.from(
        root.querySelectorAll(selector)
      );

      for (const element of elements) {
        const text = cleanText(
          element.textContent
        );

        if (
          text &&
          text.length >= 2 &&
          text.length <= 260 &&
          !text.includes("€") &&
          !/^verfügbar$/i.test(text)
        ) {
          return text;
        }
      }
    }

    return "";
  }

  function findProductUrl(root) {
    const anchors = Array.from(
      root.querySelectorAll("a[href]")
    );

    for (const anchor of anchors) {
      const href = safeUrl(
        anchor.getAttribute("href")
      );

      if (!href) {
        continue;
      }

      const url = new URL(href);

      if (
        url.hostname ===
          "lieferservice.metro.de" &&
        url.pathname.startsWith("/shop/") &&
        !url.pathname.startsWith(
          "/shop/search"
        )
      ) {
        return href;
      }
    }

    return null;
  }

  function findExternalId(root, productUrl) {
    const attributeNames = [
      "data-product-id",
      "data-article-id",
      "data-article-number",
      "data-sku",
      "data-item-id",
      "data-product-code",
    ];

    const candidates = [
      root,
      ...Array.from(
        root.querySelectorAll("*")
      ).slice(0, 80),
    ];

    for (const element of candidates) {
      for (const attributeName of attributeNames) {
        const value = cleanText(
          element.getAttribute?.(
            attributeName
          )
        );

        if (
          value &&
          /^[a-zA-Z0-9._-]{4,120}$/.test(
            value
          )
        ) {
          return value;
        }
      }
    }

    if (productUrl) {
      const url = new URL(productUrl);
      const segments = url.pathname
        .split("/")
        .filter(Boolean)
        .reverse();

      const segment = segments.find(
        (value) =>
          /^[a-zA-Z0-9_-]{6,120}$/.test(
            value
          )
      );

      if (segment) {
        return segment;
      }
    }

    return "";
  }

  function parsePrices(text) {
    const normalized = cleanText(text)
      .replace(/\n+/g, " ");

    const grossMatch = normalized.match(
      /inkl\.?\s*MwSt\.?\s*([0-9]{1,6}(?:[.,][0-9]{2}))\s*€/i
    );

    const netBeforeGrossMatch =
      normalized.match(
        /([0-9]{1,6}(?:[.,][0-9]{2}))\s*€\s*inkl\.?\s*MwSt\.?/i
      );

    const tiers = [];
    const tierValues = new Set();
    const tierPattern =
      /([0-9]{1,6}(?:[.,][0-9]{2}))\s*€\s*ab\s*(\d{1,6})\s*\+?/gi;

    let tierMatch;

    while (
      (tierMatch = tierPattern.exec(
        normalized
      ))
    ) {
      const netPriceCents = cents(
        tierMatch[1]
      );
      const minimumQuantity = Number(
        tierMatch[2]
      );

      if (
        netPriceCents !== null &&
        Number.isFinite(minimumQuantity) &&
        minimumQuantity > 1
      ) {
        tiers.push({
          minimumQuantity,
          netPriceCents,
          grossPriceCents: null,
          label: tierMatch[0],
        });
        tierValues.add(netPriceCents);
      }
    }

    const allValues = [];

    for (const match of normalized.matchAll(
      EURO_PATTERN
    )) {
      const value = cents(match[1]);

      if (value !== null) {
        allValues.push(value);
      }
    }

    const grossPriceCents = grossMatch
      ? cents(grossMatch[1])
      : null;

    let netPriceCents = netBeforeGrossMatch
      ? cents(netBeforeGrossMatch[1])
      : null;

    if (netPriceCents === null) {
      const candidates = allValues.filter(
        (value) =>
          value !== grossPriceCents &&
          !tierValues.has(value)
      );

      netPriceCents =
        candidates.length > 0
          ? candidates[candidates.length - 1]
          : allValues.length > 0
            ? allValues[allValues.length - 1]
            : null;
    }

    return {
      netPriceCents,
      grossPriceCents,
      tiers,
      promotional:
        tiers.length > 0 ||
        /preisvorteil|aktion|angebot/i.test(
          normalized
        ),
    };
  }

  function parsePackageText(text) {
    const normalized = cleanText(text)
      .replace(/\n+/g, " ");

    const match = normalized.match(
      /Gebinde\s*:?\s*([^€]{1,80}?)(?=\s+(?:Verfügbar|Nicht verfügbar|[0-9]+[.,][0-9]{2}\s*€|$))/i
    );

    return match
      ? cleanText(match[1])
      : "";
  }

  function findImageUrl(root) {
    const image = root.querySelector(
      "img[src], img[data-src]"
    );

    return image
      ? safeUrl(
          image.getAttribute("src") ||
            image.getAttribute("data-src")
        )
      : null;
  }

  function candidateRoots() {
    const selectors = [
      '[data-testid*="product-card" i]',
      '[data-test*="product-card" i]',
      '[class*="product-card" i]',
      '[class*="productcard" i]',
      '[class*="product-tile" i]',
      "article",
    ];

    const roots = new Set();

    for (const selector of selectors) {
      try {
        for (const element of document.querySelectorAll(
          selector
        )) {
          const text = cleanText(
            element.textContent
          );

          if (
            text.includes("€") &&
            text.length >= 20 &&
            text.length <= 3_500
          ) {
            roots.add(element);
          }
        }
      } catch {
        // Ungültige herstellerspezifische Selektoren
        // dürfen den Connector nicht abbrechen.
      }
    }

    if (roots.size === 0) {
      for (const anchor of document.querySelectorAll(
        'a[href*="/shop/"]'
      )) {
        let current = anchor;

        for (let depth = 0; depth < 7; depth += 1) {
          current = current?.parentElement;

          if (!current) {
            break;
          }

          const text = cleanText(
            current.textContent
          );

          if (
            text.includes("€") &&
            text.length >= 20 &&
            text.length <= 2_500
          ) {
            roots.add(current);
            break;
          }
        }
      }
    }

    return Array.from(roots).sort(
      (left, right) =>
        cleanText(left.textContent).length -
        cleanText(right.textContent).length
    );
  }

  function extractProduct(root) {
    const text = cleanText(root.textContent);
    const productUrl = findProductUrl(root);
    const name = firstUsefulText(root, [
      '[data-testid*="product-name" i]',
      '[data-test*="product-name" i]',
      '[class*="product-name" i]',
      '[class*="producttitle" i]',
      "h2",
      "h3",
      "h4",
      'a[href*="/shop/"]',
    ]);

    if (!name || !text.includes("€")) {
      return null;
    }

    const prices = parsePrices(text);

    if (
      prices.netPriceCents === null &&
      prices.tiers.length === 0
    ) {
      return null;
    }

    const availabilityText =
      /nicht\s+verfügbar|ausverkauft/i.test(text)
        ? "Nicht verfügbar"
        : /verfügbar/i.test(text)
          ? "Verfügbar"
          : "";

    const externalId = findExternalId(
      root,
      productUrl
    );

    const packageText = parsePackageText(
      text
    );

    return {
      name,
      externalId,
      articleNumber: externalId,
      productUrl,
      imageUrl: findImageUrl(root),
      packageText,
      orderUnit: packageText,
      availabilityText,
      available:
        availabilityText === "Verfügbar"
          ? true
          : availabilityText ===
              "Nicht verfügbar"
            ? false
            : null,
      currency: "EUR",
      ...prices,
    };
  }

  function readLocationName() {
    const bodyText = cleanText(
      document.body?.innerText
    );

    const match = bodyText.match(
      /Ausgewählter\s+Markt\s*\n?\s*([^\n]{2,120})/i
    );

    if (match) {
      return cleanText(match[1]);
    }

    const depotMatch = bodyText.match(
      /(METRO\s+(?:Lieferdepot|Großmarkt)\s+[^\n]{2,100})/i
    );

    return depotMatch
      ? cleanText(depotMatch[1])
      : "";
  }

  function collectProducts() {
    const products = [];
    const seen = new Set();

    for (const root of candidateRoots()) {
      const product = extractProduct(root);

      if (!product) {
        continue;
      }

      const key =
        product.externalId ||
        product.productUrl ||
        `${product.name}:${product.netPriceCents}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      products.push(product);

      if (products.length >= 180) {
        break;
      }
    }

    return {
      sourceUrl: window.location.href,
      locationName: readLocationName(),
      capturedAt: new Date().toISOString(),
      products,
    };
  }

  function setFloatingStatus(text, tone) {
    const button = document.getElementById(
      "gastario-supplier-capture-button"
    );

    if (!button) {
      return;
    }

    button.textContent = text;
    button.dataset.tone = tone || "default";
  }

  async function sendCurrentProducts() {
    const capture = collectProducts();

    if (capture.products.length === 0) {
      setFloatingStatus(
        "Keine sichtbaren Produkte erkannt",
        "error"
      );
      return;
    }

    setFloatingStatus(
      `${capture.products.length} Produkte werden gesendet …`,
      "busy"
    );

    const response = await chrome.runtime.sendMessage({
      type: "GASTARIO_PUSH_CAPTURE",
      payload: capture,
    });

    if (!response?.ok) {
      setFloatingStatus(
        response?.error ||
          "Übertragung fehlgeschlagen",
        "error"
      );
      return;
    }

    setFloatingStatus(
      `${response.data?.itemsAccepted || capture.products.length} Produkte an Gastario gesendet`,
      "success"
    );
  }

  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      if (
        message?.type !==
        "GASTARIO_COLLECT_PRODUCTS"
      ) {
        return false;
      }

      try {
        sendResponse({
          ok: true,
          capture: collectProducts(),
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: String(
            error?.message || error
          ),
        });
      }

      return true;
    }
  );

  const button = document.createElement(
    "button"
  );

  button.id =
    "gastario-supplier-capture-button";
  button.type = "button";
  button.textContent =
    "Sichtbare Preise an Gastario senden";
  button.addEventListener(
    "click",
    () => {
      sendCurrentProducts().catch((error) => {
        setFloatingStatus(
          String(error?.message || error),
          "error"
        );
      });
    }
  );

  document.documentElement.appendChild(
    button
  );
})();
