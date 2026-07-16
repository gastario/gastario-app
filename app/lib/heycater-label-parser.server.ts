export type HeycaterLabelData = {
  name: string;
  date: string;
  meal: string;
  details: string;
  caterer: string;
  customer: string;
  address: string;
};

function cleanLine(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .trim();
}

function normalize(value: string) {
  return cleanLine(value).toLowerCase();
}

function isDate(value: string) {
  return /\b\d{2}[.-]\d{2}[.-]\d{4}\b/.test(value);
}

function extractDate(value: string) {
  const match = value.match(/\b\d{2}[.-]\d{2}[.-]\d{4}\b/);
  return match ? match[0].replace(/\./g, "-") : "";
}

function isMetaLine(value: string) {
  const text = normalize(value);

  return (
    !text ||
    text === "-" ||
    text.includes("caterer:") ||
    text.includes("customer:") ||
    text.includes("alexander") ||
    text.includes("berlin") ||
    text.includes("10178") ||
    text.includes("page") ||
    /^[-–—_]+$/.test(text)
  );
}

function looksLikePersonName(value: string) {
  const text = cleanLine(value);
  const lower = text.toLowerCase();

  if (text.length < 3 || text.length > 46) return false;
  if (isDate(text)) return false;
  if (isMetaLine(text)) return false;
  if (/\d/.test(text)) return false;

  const blockedWords = [
    "gluten",
    "free",
    "halal",
    "vegan",
    "vegetarian",
    "fish",
    "milk",
    "sesame",
    "sulphur",
    "sulfur",
    "peanut",
    "nuts",
    "soy",
    "soya",
    "bowl",
    "wrap",
    "salad",
    "salmon",
    "chicken",
    "shawarma",
    "tempura",
    "rice",
    "asian",
    "greens",
    "caterer",
    "customer",
    "ninja",
    "let me bowl",
    "heykantine",
  ];

  if (blockedWords.some((word) => lower.includes(word))) return false;

  return /^[A-Za-zÄÖÜäöüßÀ-ÿ'’ .-]+$/.test(text);
}

function looksLikeMeal(value: string) {
  const raw = cleanLine(value);
  const text = normalize(raw);

  if (!text || isDate(raw) || isMetaLine(raw)) return false;

  // Sehr wichtig:
  // Allergen-/Hinweiszeilen wie "Vegan, Vegetarian / Soybeans"
  // duerfen NIE als eigenes Gericht/Label zaehlen.
  if (raw.includes(",") || raw.includes(" / ") || raw.includes("/")) {
    const strongDish =
      text.includes("bowl") ||
      text.includes("wrap") ||
      text.includes("salad") ||
      text.includes("salmon") ||
      text.includes("chicken") ||
      text.includes("tofu") ||
      text.includes("falafel") ||
      text.includes("tempura");

    if (!strongDish) return false;
  }

  const blockedDetailOnly = [
    "gluten free",
    "halal",
    "poultry",
    "milk",
    "sesame seeds",
    "soybeans",
    "soya",
    "sulphur",
    "sulfur",
    "nuts",
    "peanut",
    "vegetarian /",
    "vegan,",
    "pescatarian /",
  ];

  if (blockedDetailOnly.some((word) => text.includes(word))) {
    return false;
  }

  const mealWords = [
    "bowl",
    "wrap",
    "salad",
    "salmon",
    "chicken",
    "tofu",
    "falafel",
    "tempura",
    "shawarma",
    "oriental",
    "beetroot",
    "tuna",
    "greens with sesame",
  ];

  return mealWords.some((word) => text.includes(word));
}

function looksLikeDetails(value: string) {
  const text = normalize(value);

  if (!text || isDate(value) || isMetaLine(value)) return false;

  const detailWords = [
    "gluten",
    "free",
    "halal",
    "vegan",
    "vegetarian",
    "fish",
    "milk",
    "sesame",
    "sulphur",
    "sulfur",
    "poultry",
    "peanut",
    "nuts",
    "soy",
    "soya",
    "mustard",
    "celery",
    "crustaceans",
  ];

  return detailWords.some((word) => text.includes(word));
}

function findNearby(lines: string[], start: number, matcher: (value: string) => boolean, max = 12) {
  for (let i = start; i < Math.min(lines.length, start + max); i++) {
    if (matcher(lines[i])) return lines[i];
  }


  return "";
}

function isPossibleNameLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  if (!text || text.length < 2 || text.length > 60) return false;
  if (isDate(text)) return false;
  if (isMetaLine(text)) return false;
  if (looksLikeMeal(text)) return false;
  if (looksLikeDetails(text)) return false;
  if (lower.includes("powered by")) return false;
  if (lower.includes("pdf generator")) return false;
  if (/--\s*\d+\s*of\s*\d+\s*--/i.test(text)) return false;
  if (/^\d+\s*of\s*\d+$/i.test(text)) return false;
  if (/--\s*\d+\s*of\s*\d+\s*--/i.test(text)) return false;
  if (/^\d+\s*of\s*\d+$/i.test(text)) return false;
  if (lower.includes("caterer:")) return false;
  if (lower.includes("customer:")) return false;
  if (/^[-–—_]+$/.test(text)) return false;

  return true;
}

function findNameBeforeMeal(lines: string[], mealIndex: number) {
  const candidates: string[] = [];

  for (let i = mealIndex - 1; i >= Math.max(0, mealIndex - 5); i--) {
    const line = cleanLine(lines[i]);

    if (!line) continue;
    if (isPossibleNameLine(line)) {
      candidates.unshift(line);
    }
  }

  if (candidates.length === 0) return "Name nicht erkannt";

  // Wenn PDF Vorname und Nachname getrennt hat, wieder zusammenbauen.
  const joined = candidates.join(" ").replace(/\s+/g, " ").trim();

  // Maximal die letzten 2 sinnvollen Namenszeilen nehmen.
  if (candidates.length >= 2) {
    return candidates.slice(-2).join(" ").replace(/\s+/g, " ").trim();
  }

  return joined;
}

function isAddressLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  return (
    /\b\d{5}\b/.test(text) ||
    lower.includes("strasse") ||
    lower.includes("straße") ||
    lower.includes("allee") ||
    lower.includes("platz") ||
    lower.includes("berlin")
  );
}

function isCatererLine(value: string) {
  return normalize(value).includes("caterer:");
}

function isCustomerLine(value: string) {
  return normalize(value).includes("customer:");
}

function isFooterLine(value: string) {
  const text = cleanLine(value);
  const lower = normalize(text);

  return (
    !text ||
    lower.includes("powered by") ||
    lower.includes("pdf generator") ||
    /--\s*\d+\s*of\s*\d+\s*--/i.test(text) ||
    /^\d+\s*of\s*\d+$/i.test(text)
  );
}

function isInfoLine(value: string) {
  const lower = normalize(value);

  return [
    "gluten",
    "lactose",
    "halal",
    "poultry",
    "milk",
    "soy",
    "soya",
    "soybeans",
    "sesame",
    "nuts",
    "peanut",
    "fish",
    "crustaceans",
    "cereals",
    "vegetarian",
    "vegan",
    "pescatarian",
    "sulphur",
    "sulfur",
    "sulphites",
    "sulfites",
    "celery",
    "mustard",
    "egg",
    "eggs"
  ].some((word) => lower.includes(word));
}

function isUsableLabelContentLine(value: string) {
  const line = cleanLine(value);

  if (!line) return false;
  if (isDate(line)) return false;
  if (isFooterLine(line)) return false;
  if (isCatererLine(line)) return false;
  if (isCustomerLine(line)) return false;
  if (isAddressLine(line)) return false;
  if (isInfoLine(line)) return false;

  return true;
}

function cleanBlockAfterDate(lines: string[], start: number, end: number) {
  return lines
    .slice(start + 1, end)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isFooterLine(line));
}

function isDishLine(value: string) {
  const lower = normalize(value);

  const dishWords = [
    "bowl",
    "wrap",
    "salad",
    "risotto",
    "curry",
    "chicken",
    "salmon",
    "tofu",
    "bbq",
    "veggie",
    "tempura",
    "falafel",
    "pasta",
    "mushroom",
    "rice",
    "noodle",
    "shawarma",
    "grill",
    "tuna",
    "beetroot",
    "oriental",
    "korean",
    "panaeng",
    "teriyaki"
  ];

  return dishWords.some((word) => lower.includes(word));
}

function looksLikeNamePart(value: string) {
  const text = cleanLine(value);
  if (!text) return false;
  if (text.length < 2 || text.length > 40) return false;
  if (isDishLine(text)) return false;
  if (isInfoLine(text)) return false;
  if (isAddressLine(text)) return false;
  if (isCatererLine(text)) return false;
  if (isCustomerLine(text)) return false;
  if (isDate(text)) return false;

  return /^[A-Za-zÀ-ž.'’\- ]+$/.test(text);
}

function splitMealAndInfo(value: string) {
  const line = cleanLine(value);
  const parts = line
    .split("/")
    .map((part) => cleanLine(part))
    .filter(Boolean);

  if (parts.length <= 1) {
    return { meal: line, info: "" };
  }

  // Gericht gewinnt immer, wenn ein typisches Gerichtswort vorkommt.
  // Beispiel: Vegetarian / Korean BBQ Veggie Wrap / Cereals containing gluten
  // => Gericht: Korean BBQ Veggie Wrap
  const mealPart =
    parts.find((part) => isDishLine(part)) ||
    parts.find((part) => !isInfoLine(part)) ||
    parts[0];

  const infoParts = parts.filter((part) => part !== mealPart);

  return {
    meal: mealPart,
    info: infoParts.join(" / "),
  };
}

function parseOneHeycaterLabel(date: string, block: string[]) {
  const address =
    block.find((line) => isAddressLine(line)) ||
    "Adresse nicht erkannt";

  const caterer =
    block.find((line) => isCatererLine(line)) ||
    "Caterer: Let Me Bowl heykantine";

  const customer =
    block.find((line) => isCustomerLine(line)) ||
    "Customer: Heycater";

  const cleanContent = block
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isDate(line))
    .filter((line) => !isFooterLine(line))
    .filter((line) => !isCatererLine(line))
    .filter((line) => !isCustomerLine(line))
    .filter((line) => !isAddressLine(line));

  let name =
    cleanContent[0] ||
    "Name nicht erkannt";

  let startIndex = 1;

  /*
   * gastario-exact-multiline-dish-fix-20260716
   *
   * Getrennte Vor- und Nachnamen werden nur zusammengefügt,
   * wenn beide Zeilen jeweils wie ein einzelner Namensteil
   * aussehen.
   *
   * Dadurch wird beispielsweise:
   *
   * Max Mustermann
   * Mediterrane Gemüsepfanne
   * mit Chicken und Reis
   *
   * nicht fälschlich zu:
   *
   * Name: Max Mustermann Mediterrane Gemüsepfanne
   */
  const looksLikeSingleNamePart = (value: string) => {
    const text = cleanLine(value);

    if (!looksLikeNamePart(text)) {
      return false;
    }

    const words = text
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    return words.length === 1;
  };

  if (
    cleanContent.length >= 3 &&
    looksLikeSingleNamePart(cleanContent[0]) &&
    looksLikeSingleNamePart(cleanContent[1]) &&
    isDishLine(cleanContent[2])
  ) {
    name = cleanLine(
      cleanContent[0] +
      " " +
      cleanContent[1]
    );

    startIndex = 2;
  }

  let meal =
    "Gericht nicht erkannt";

  const details: string[] = [];

  let collectingMeal = true;

  for (
    let i = startIndex;
    i < cleanContent.length;
    i++
  ) {
    const line = cleanLine(cleanContent[i]);

    if (!line) {
      continue;
    }

    /*
     * Gericht und Allergene können gemeinsam mit
     * Schrägstrichen in einer Zeile stehen.
     */
    if (line.includes("/")) {
      const split =
        splitMealAndInfo(line);

      if (split.meal) {
        if (
          meal ===
          "Gericht nicht erkannt"
        ) {
          meal = split.meal;
        } else if (collectingMeal) {
          meal = cleanLine(
            meal +
            " " +
            split.meal
          );
        }
      }

      if (split.info) {
        details.push(split.info);
        collectingMeal = false;
      }

      continue;
    }

    /*
     * Sobald Allergene, Ernährungsformen oder sonstige
     * Infozeilen beginnen, endet der Gerichtname.
     */
    if (isInfoLine(line)) {
      details.push(line);
      collectingMeal = false;
      continue;
    }

    /*
     * Alle normalen Zeilen vor dem Infoblock gehören
     * zum vollständigen Gerichtnamen.
     */
    if (collectingMeal) {
      if (
        meal ===
        "Gericht nicht erkannt"
      ) {
        meal = line;
      } else {
        meal = cleanLine(
          meal +
          " " +
          line
        );
      }

      continue;
    }

    /*
     * Zusätzliche Zeilen nach dem Infoblock werden als
     * Details behandelt und nicht als Kunde oder Gericht.
     */
    details.push(line);
  }

  let finalMeal = meal;
  let finalDetails =
    details.join(" / ");

  /*
   * Bestehende Sicherheitskorrektur:
   * Falls eine reine Infozeile als Gericht erkannt wurde,
   * aber in den Details ein echter Gerichtname vorkommt,
   * wird die Zuordnung korrigiert.
   */
  if (
    (
      isInfoLine(finalMeal) ||
      !isDishLine(finalMeal)
    ) &&
    finalDetails
  ) {
    const detailParts = finalDetails
      .split("/")
      .map((part) => cleanLine(part))
      .filter(Boolean);

    const realMealFromDetails =
      detailParts.find(
        (part) => isDishLine(part)
      ) ||
      detailParts.find(
        (part) => !isInfoLine(part)
      );

    if (realMealFromDetails) {
      /*
       * Nur austauschen, wenn der bisherige Gerichtname
       * keine zusammengefügte mehrzeilige Bezeichnung ist.
       */
      const mealWordCount =
        cleanLine(finalMeal)
          .split(/\s+/)
          .filter(Boolean)
          .length;

      if (mealWordCount <= 2) {
        finalMeal =
          realMealFromDetails;

        finalDetails = detailParts
          .filter(
            (part) =>
              part !==
              realMealFromDetails
          )
          .join(" / ");
      }
    }
  }

  return {
    name,
    date,
    meal: finalMeal,
    details: finalDetails,
    caterer,
    customer,
    address,
  };
}

const DELIVERY_OVERVIEW_DISH_DETAILS: Record<string, string> = {
  "Chicken Shawarma Grill Bowl": "Allergens: Egg, Soy, Gluten, Sesame, Mustard | Note: Chicken",
  "Lemon Chicken Bowl": "No declared allergens | Note: Chicken, spices",
  "Crispy Chicken Salad": "Allergens: Gluten, Egg, Soy, Milk, Mustard | Note: Chicken",
  "Falafel Wrap": "Allergens: Gluten, Sesame | Note: Vegan",
  "Mediterranean Halloumi Crunch Wrap": "Allergens: Gluten, Milk, Sesame | Note: Vegetarian",
  "Ebi Tempura Bowl": "Allergens: Gluten, Crustaceans, Egg, Soy | Note: Ebi/Shrimp",
  "Mediterranean Grill Bowl": "Allergens: Sesame, Mustard | Note: Vegan/Vegetarian check",
  "Veggie Oriental Bowl": "Allergens: Sesame, Mustard | Note: Vegetarian",
  "Planted Chicken Power Bowl": "Allergens: Soy, Gluten | Note: Planted Chicken",
  "Crispy Tofu Wrap": "Allergens: Gluten, Soy, Sesame | Note: Vegan",
  "Vegan Beetroot Salad": "Allergens: Mustard | Note: Vegan",
  "Asian Greens with Sesame Salmon": "Allergens: Fish, Sesame, Soy, Gluten | Note: Salmon",
  "Vegan Tuna Bowl": "Allergens: Soy, Gluten | Note: Vegan",
  "Green Tofu Fitness Bowl": "Allergens: Soy, Sesame | Note: Vegan",
  "Garden Halloumi Bowl": "Allergens: Milk, Sesame, Mustard | Note: Vegetarian",
  "Fennel Citrus Sea Bream Salad": "Allergens: Fish, Mustard | Note: Sea Bream",
  "Trout Herb Salad": "Allergens: Fish, Mustard | Note: Trout",
  "Oriental Salad": "Allergens: Sesame, Mustard | Note: Vegan/Vegetarian check",
};

const DELIVERY_OVERVIEW_DISHES = Object.keys(DELIVERY_OVERVIEW_DISH_DETAILS).sort((a, b) => b.length - a.length);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractDeliveryOverviewDate(rawText: string) {
  const text = String(rawText || "");
  const titleDate = text.match(/Delivery Overview\s+(\d{2}-\d{2}-\d{4})/i);
  if (titleDate) return titleDate[1];

  const anyDate = text.match(/\b\d{2}-\d{2}-\d{4}\b/);
  return anyDate ? anyDate[0] : "";
}

function extractDeliveryOverviewAddress(lines: string[]) {
  const addressLine = lines.find((line) => /\b\d{5}\b/.test(line) && /Berlin/i.test(line));
  return addressLine || "Adresse nicht erkannt";
}

function parseDeliveryOverviewOrderLine(line: string, pendingNameParts: string[], deliveryOverviewDishes: string[]) {
  const clean = cleanLine(line);

  for (const dish of deliveryOverviewDishes) {
    const dishPattern = escapeRegExp(dish);

    // Variante 1:
    // Akhil Jacob Lemon Chicken Bowl 1x
    const quantityAfterDishMatch = clean.match(new RegExp("^(.*?)\\s+(" + dishPattern + ")\\s+(\\d+)x$", "i"));
    if (quantityAfterDishMatch) {
      const inlineName = cleanLine(quantityAfterDishMatch[1]);
      const quantity = Number(quantityAfterDishMatch[3]);

      return {
        name: cleanLine([...pendingNameParts, inlineName].filter(Boolean).join(" ")),
        meal: dish,
        quantity,
      };
    }

    // Variante 2:
    // Akhil Jacob 1x Lemon Chicken Bowl
    const quantityBeforeDishMatch = clean.match(new RegExp("^(.*?)\\s+(\\d+)x\\s+(" + dishPattern + ")$", "i"));
    if (quantityBeforeDishMatch) {
      const inlineName = cleanLine(quantityBeforeDishMatch[1]);
      const quantity = Number(quantityBeforeDishMatch[2]);

      return {
        name: cleanLine([...pendingNameParts, inlineName].filter(Boolean).join(" ")),
        meal: dish,
        quantity,
      };
    }

    // Variante 3:
    // Alejandro Nicolas
    // Becerra Ebi Tempura Bowl 1x
    const splitNameQuantityAfterDishMatch = clean.match(new RegExp("^(.*?)\\s+(" + dishPattern + ")\\s+(\\d+)x$", "i"));
    if (splitNameQuantityAfterDishMatch && pendingNameParts.length > 0) {
      const inlineName = cleanLine(splitNameQuantityAfterDishMatch[1]);
      const quantity = Number(splitNameQuantityAfterDishMatch[3]);

      return {
        name: cleanLine([...pendingNameParts, inlineName].filter(Boolean).join(" ")),
        meal: dish,
        quantity,
      };
    }

    // Variante 4:
    // Alejandro Nicolas
    // Becerra 1x Ebi Tempura Bowl
    const splitNameQuantityBeforeDishMatch = clean.match(new RegExp("^(.*?)\\s+(\\d+)x\\s+(" + dishPattern + ")$", "i"));
    if (splitNameQuantityBeforeDishMatch && pendingNameParts.length > 0) {
      const inlineName = cleanLine(splitNameQuantityBeforeDishMatch[1]);
      const quantity = Number(splitNameQuantityBeforeDishMatch[2]);

      return {
        name: cleanLine([...pendingNameParts, inlineName].filter(Boolean).join(" ")),
        meal: dish,
        quantity,
      };
    }

    // Variante 5:
    // Ebi Tempura Bowl 1x
    // wenn Name komplett in vorherigen Zeilen steht
    const dishOnlyQuantityAfterMatch = clean.match(new RegExp("^(" + dishPattern + ")\\s+(\\d+)x$", "i"));
    if (dishOnlyQuantityAfterMatch && pendingNameParts.length > 0) {
      const quantity = Number(dishOnlyQuantityAfterMatch[2]);

      return {
        name: cleanLine(pendingNameParts.join(" ")),
        meal: dish,
        quantity,
      };
    }

    // Variante 6:
    // 1x Ebi Tempura Bowl
    // wenn Name komplett in vorherigen Zeilen steht
    const dishOnlyQuantityBeforeMatch = clean.match(new RegExp("^(\\d+)x\\s+(" + dishPattern + ")$", "i"));
    if (dishOnlyQuantityBeforeMatch && pendingNameParts.length > 0) {
      const quantity = Number(dishOnlyQuantityBeforeMatch[1]);

      return {
        name: cleanLine(pendingNameParts.join(" ")),
        meal: dish,
        quantity,
      };
    }
  }

  return null;
}

function isDeliveryOverviewMetaLine(line: string) {
  const lower = normalize(line);

  return (
    !line ||
    lower.includes("delivery overview") ||
    lower === "delivery date: delivery time:" ||
    lower === "address:" ||
    lower === "delivery comment:" ||
    lower.includes("fahrstuhl:") ||
    lower.includes("parkplatz:") ||
    lower.includes("kontaktperson") ||
    lower.includes("customer name dish type dish name quantity") ||
    lower.includes("powered by pdf generator") ||
    /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line) ||
    /^\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}$/.test(line) ||
    (/\b\d{5}\b/.test(line) && lower.includes("berlin"))
  );
}

function normalizeRuleText(value: string) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAllergenDetails(value: string) {
  const text = cleanLine(value);
  const allergensMatch = text.match(/Allergens:\s*([^|]+)/i);
  const noteMatch = text.match(/Note:\s*(.+)$/i);

  const allergens = allergensMatch
    ? allergensMatch[1].split(",").map((item) => cleanLine(item)).filter(Boolean)
    : [];

  const notes = noteMatch
    ? noteMatch[1].split(",").map((item) => cleanLine(item)).filter(Boolean)
    : [];

  return { allergens, notes };
}

function buildAutomaticDetailsForMeal(meal: string, dishDetailsMap: Record<string, string>) {
  const normalizedMeal = normalizeRuleText(meal);

  // Exakte Gericht-Regel gewinnt. Wichtig z. B. Lemon Chicken Bowl,
  // damit nicht automatisch die allgemeine Chicken-Regel greift.
  for (const [keyword, details] of Object.entries(dishDetailsMap)) {
    if (normalizeRuleText(keyword) === normalizedMeal) {
      return details;
    }
  }

  const allergens = new Set<string>();
  const notes = new Set<string>();

  const sortedRules = Object.entries(dishDetailsMap).sort((a, b) => b[0].length - a[0].length);

  for (const [keyword, details] of sortedRules) {
    const normalizedKeyword = normalizeRuleText(keyword);
    if (!normalizedKeyword) continue;

    if (normalizedMeal.includes(normalizedKeyword)) {
      const parsed = parseAllergenDetails(details);

      for (const allergen of parsed.allergens) {
        if (!/^no declared allergens$/i.test(allergen)) allergens.add(allergen);
      }

      for (const note of parsed.notes) {
        notes.add(note);
      }
    }
  }

  const allergenList = Array.from(allergens);
  const noteList = Array.from(notes);

  if (allergenList.length > 0 && noteList.length > 0) {
    return `Allergens: ${allergenList.join(", ")} | Note: ${noteList.join(", ")}`;
  }

  if (allergenList.length > 0) {
    return `Allergens: ${allergenList.join(", ")}`;
  }

  if (noteList.length > 0) {
    return `No declared allergens | Note: ${noteList.join(", ")}`;
  }

  return "No declared allergens | Note: Please check recipe";
}

function pushDeliveryOverviewLabels(labels: HeycaterLabelData[], input: {
  name: string;
  meal: string;
  quantity: number;
  date: string;
  address: string;
  customer: string;
  dishDetailsMap: Record<string, string>;
}) {
  const name = cleanLine(input.name);
  const meal = cleanLine(input.meal);
  const quantity = Number(input.quantity);

  if (!name || !meal || !Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
    return;
  }

  const details = buildAutomaticDetailsForMeal(meal, input.dishDetailsMap);

  for (let copy = 0; copy < quantity; copy++) {
    labels.push({
      name,
      date: input.date,
      meal,
      details,
      caterer: "Caterer: Let Me Bowl heykantine",
      customer: input.customer ? "Customer: " + input.customer : "",
      address: input.address,
    });
  }
}

function extractDeliveryOverviewCustomer(rawText: string, sourceFileName = "", customerOverride = "") {
  const override = cleanLine(customerOverride);
  if (override) return override;

  const fileText = cleanLine(
    decodeURIComponent(String(sourceFileName || ""))
      .replace(/\.pdf$/i, "")
      .replace(/[_]+/g, " ")
      .replace(/\s*-\s*/g, " - ")
  );

  const fileMatch = fileText.match(/\b\d{2}-\d{2}-\d{4}\b\s*-\s*(.*?)\s*-\s*let\s*me\s*bowl/i);
  if (fileMatch?.[1]) {
    return cleanLine(fileMatch[1]);
  }

  const raw = String(rawText || "");
  const customerLine = raw.match(/Customer(?:\s+Name)?\s*[:\-]\s*(.+)/i);
  if (customerLine?.[1]) {
    const value = cleanLine(customerLine[1]);
    if (
      value &&
      !/dish|quantity|delivery|address|customer name dish/i.test(value)
    ) {
      return value;
    }
  }


  return "";
}
/*
 * gastario-delivery-overview-allergen-skip-20260713
 * Verhindert, dass Allergenzeilen als Gericht übernommen werden.
 */
function isDeliveryOverviewAllergenOrDetailLine(
  value: string
) {
  const line = cleanLine(value);
  const lower = line.toLowerCase();

  if (!line) return true;

  const prefixes = [
    "allergen",
    "allergene",
    "allergens",
    "allergy",
    "enthält",
    "enthaelt",
    "contains",
    "hinweis",
    "hinweise",
    "zutaten",
    "ingredients",
  ];

  if (
    prefixes.some((prefix) =>
      lower.startsWith(prefix)
    )
  ) {
    return true;
  }

  const signals = [
    "gluten",
    "weizen",
    "roggen",
    "gerste",
    "hafer",
    "milch",
    "laktose",
    "ei",
    "eier",
    "erdnuss",
    "erdnüsse",
    "erdnuesse",
    "sesam",
    "soja",
    "sellerie",
    "senf",
    "sulfite",
    "schalenfrüchte",
    "schalenfruechte",
    "mandeln",
    "cashew",
    "walnuss",
    "fisch",
    "krebstiere",
    "weichtiere",
    "lupine",
  ];

  const matches = signals.filter((signal) =>
    lower.includes(signal)
  ).length;

  const looksLikeList =
    /[,;|]/.test(line) ||
    /\([^)]{3,}\)/.test(line);

  return matches >= 2 && looksLikeList;
}

function parseDeliveryOverviewLabelsFromText(rawText: string, dishDetailsMap: Record<string, string> = DELIVERY_OVERVIEW_DISH_DETAILS, sourceFileName = "", customerOverride = ""): HeycaterLabelData[] {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const date = extractDeliveryOverviewDate(rawText);
  const address = extractDeliveryOverviewAddress(lines);
  const customer = extractDeliveryOverviewCustomer(rawText, sourceFileName, customerOverride);
  const labels: HeycaterLabelData[] = [];
  const pendingNameParts: string[] = [];
  let pendingQuantityName: { name: string; quantity: number } | null = null;

  for (const line of lines) {
    if (isDeliveryOverviewMetaLine(line)) continue;

    // Variante: Akash Gupta 1x Vegan Vegetable Paella with Side Salad
    const quantityBeforeDishMatch = line.match(/^(.*?)\s+(\d+)x\s+(.+)$/i);
    if (quantityBeforeDishMatch) {
      const inlineName = cleanLine(quantityBeforeDishMatch[1]);
      const quantity = Number(quantityBeforeDishMatch[2]);
      const meal = cleanLine(quantityBeforeDishMatch[3]);

      pushDeliveryOverviewLabels(labels, {
        name: cleanLine([...pendingNameParts, inlineName].filter(Boolean).join(" ")),
        meal,
        quantity,
        date,
        address,
        customer,
        dishDetailsMap,
      });

      pendingNameParts.length = 0;
      pendingQuantityName = null;
      continue;
    }

    // Variante: Andrea De Maio 1x
    // nächste Zeile: Vegan Harissa Bowl
    const quantityOnlyMatch = line.match(/^(.*?)\s+(\d+)x$/i);
    if (quantityOnlyMatch) {
      pendingQuantityName = {
        name: cleanLine([...pendingNameParts, quantityOnlyMatch[1]].filter(Boolean).join(" ")),
        quantity: Number(quantityOnlyMatch[2]),
      };
      pendingNameParts.length = 0;
      continue;
    }

    if (pendingQuantityName) {
      /*
       * Allergen- oder Hinweiszeilen überspringen.
       * Name und Menge bleiben gespeichert, bis das echte Gericht folgt.
       */
      if (
        isDeliveryOverviewAllergenOrDetailLine(line)
      ) {
        continue;
      }

      pushDeliveryOverviewLabels(labels, {
        name: pendingQuantityName.name,
        meal: line,
        quantity: pendingQuantityName.quantity,
        date,
        address,
        customer,
        dishDetailsMap,
      });

      pendingQuantityName = null;
      continue;
    }

    if (looksLikeNamePart(line)) {
      pendingNameParts.push(line);
      continue;
    }
  }

  if (pendingQuantityName) {
    pushDeliveryOverviewLabels(labels, {
      name: pendingQuantityName.name,
      meal: "Gericht nicht erkannt",
      quantity: pendingQuantityName.quantity,
      date,
      address,
      customer,
      dishDetailsMap,
    });
  }

  return labels;
}

export function parseHeycaterLabelsFromText(rawText: string, deliveryDishDetails?: Record<string, string>, sourceFileName = "", customerOverride = ""): HeycaterLabelData[] {
  if (/Delivery Overview/i.test(String(rawText || ""))) {
    return parseDeliveryOverviewLabelsFromText(rawText, deliveryDishDetails || DELIVERY_OVERVIEW_DISH_DETAILS, sourceFileName, customerOverride);
  }

  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const dateIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => isDate(entry.line))
    .map((entry) => entry.index);

  const labels: HeycaterLabelData[] = [];

  for (let i = 0; i < dateIndexes.length; i++) {
    const start = dateIndexes[i];
    const end = i + 1 < dateIndexes.length ? dateIndexes[i + 1] : lines.length;
    const date = extractDate(lines[start]);
    const block = cleanBlockAfterDate(lines, start, end);

    labels.push(parseOneHeycaterLabel(date, block));
  }

  return labels;
}





















