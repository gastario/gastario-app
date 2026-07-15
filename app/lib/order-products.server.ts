import { prisma } from "./prisma.server";

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vereinheitlicht Schreibweisen, ohne fachlich unterschiedliche
 * Produkte zu aggressiv zusammenzuführen.
 */
function normalizeProductKey(value: unknown) {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/^\d+\s*[x×]\s*/i, "")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSignature(value: unknown) {
  return Array.from(
    new Set(
      normalizeProductKey(value)
        .split(" ")
        .filter(Boolean)
    )
  )
    .sort()
    .join(" ");
}

function levenshteinDistance(a: string, b: string) {
  const rows = a.length + 1;
  const columns = b.length + 1;

  const matrix = Array.from(
    { length: rows },
    () => Array<number>(columns).fill(0)
  );

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (
      let column = 1;
      column < columns;
      column += 1
    ) {
      const substitutionCost =
        a[row - 1] === b[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] +
          substitutionCost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(a: string, b: string) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const maximumLength = Math.max(
    a.length,
    b.length
  );

  return (
    1 -
    levenshteinDistance(a, b) /
      maximumLength
  );
}

/**
 * Nur sehr ähnliche Namen automatisch verbinden.
 * Dadurch bleiben fachlich unterschiedliche Produkte getrennt.
 */
function isConservativeDuplicate(
  incomingName: string,
  existingName: string
) {
  const incomingKey =
    normalizeProductKey(incomingName);

  const existingKey =
    normalizeProductKey(existingName);

  if (!incomingKey || !existingKey) {
    return false;
  }

  /*
   * Exakt gleicher normalisierter Name.
   */
  if (incomingKey === existingKey) {
    return true;
  }

  /*
   * Gleiche Wörter, nur in anderer Reihenfolge.
   */
  if (
    incomingKey.length >= 6 &&
    tokenSignature(incomingKey) ===
      tokenSignature(existingKey)
  ) {
    return true;
  }

  const incomingWords =
    incomingKey.split(" ");

  const existingWords =
    existingKey.split(" ");

  /*
   * Bei unscharfer Erkennung muss mindestens das erste
   * Hauptwort übereinstimmen.
   */
  if (
    incomingWords[0] !== existingWords[0]
  ) {
    return false;
  }

  /*
   * Unterschiedliche Anzahl an Wörtern ist meist ein
   * anderes Produkt, zum Beispiel:
   * Chicken Bowl / Vegan Chicken Bowl.
   */
  if (
    incomingWords.length !==
    existingWords.length
  ) {
    return false;
  }

  /*
   * Nur kleine Tippfehler zulassen.
   */
  if (
    Math.abs(
      incomingKey.length -
        existingKey.length
    ) > 3
  ) {
    return false;
  }

  return (
    similarity(incomingKey, existingKey) >=
    0.94
  );
}

function isNonProductPosition(
  value: unknown
) {
  const name =
    normalizeProductKey(value);

  if (!name) return true;

  const exactServiceNames = new Set([
    "lieferung",
    "abholung",
    "lieferung und abholung",
    "transport",
    "aufbau",
    "abbau",
    "aufbau und abbau",
    "servicepersonal",
    "personal",
    "pfand",
    "standgebuhr",
    "standgebuehr",
  ]);

  if (exactServiceNames.has(name)) {
    return true;
  }

  return [
    "fehlende position",
    "automatische kontrollposition",
    "kontrollposition",
    "differenzposition",
  ].some((phrase) =>
    name.includes(phrase)
  );
}

function normalizeUnit(value: unknown) {
  const unit = cleanText(value);

  if (!unit) return "Portion";

  const lower = unit.toLowerCase();

  if (
    lower === "stück" ||
    lower === "stueck" ||
    lower === "stk"
  ) {
    return "Portion";
  }

  return unit;
}

export async function ensureProductsForOrder(
  orderId: string,
  tenantId: string
) {
  const order =
    await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
      include: {
        items: true,
      },
    });

  if (!order) {
    throw new Error(
      "Auftrag für automatische Produktanlage nicht gefunden."
    );
  }

  /*
   * Alle vorhandenen Produkte und Mappings einmal laden.
   * Das verhindert unnötig viele Datenbankabfragen.
   */
  const existingProducts =
    await prisma.product.findMany({
      where: {
        tenantId,
      },
      select: {
        id: true,
        name: true,
      },
    });

  const existingMappings =
    await prisma.productMapping.findMany({
      where: {
        tenantId,
        source: order.source,
      },
      select: {
        id: true,
        externalName: true,
        productId: true,
      },
    });

  let createdProducts = 0;
  let connectedProducts = 0;
  let reusedProducts = 0;
  let skippedItems = 0;

  for (const item of order.items) {
    const externalName =
      cleanText(item.name);

    if (
      isNonProductPosition(externalName)
    ) {
      skippedItems += 1;
      continue;
    }

    if (item.productId) {
      connectedProducts += 1;
      continue;
    }

    /*
     * 1. Vorhandenes Plattform-Mapping erkennen.
     * Auch Schreibvarianten werden berücksichtigt.
     */
    const matchingMapping =
      existingMappings.find((mapping) =>
        isConservativeDuplicate(
          externalName,
          mapping.externalName
        )
      );

    if (matchingMapping) {
      await prisma.orderItem.update({
        where: {
          id: item.id,
        },
        data: {
          productId:
            matchingMapping.productId,
        },
      });

      connectedProducts += 1;
      reusedProducts += 1;
      continue;
    }

    /*
     * 2. Vorhandenes Produkt über normalisierten
     * oder sehr ähnlichen Namen suchen.
     */
    let product =
      existingProducts.find(
        (candidate) =>
          isConservativeDuplicate(
            externalName,
            candidate.name
          )
      );

    /*
     * 3. Nur wenn wirklich kein passendes Produkt
     * vorhanden ist, ein neues Produkt anlegen.
     */
    if (!product) {
      product =
        await prisma.product.create({
          data: {
            tenantId,
            name: externalName,
            category:
              "Automatisch importiert",
            unit: normalizeUnit(item.unit),
            priceCents: Number(
              item.unitCents || 0
            ),
            taxRate: 7,
            active: true,
          },
          select: {
            id: true,
            name: true,
          },
        });

      existingProducts.push(product);
      createdProducts += 1;
    } else {
      reusedProducts += 1;
    }

    /*
     * 4. Nur ein Mapping für diese Schreibvariante
     * anlegen.
     */
    const mappingAlreadyExists =
      existingMappings.some((mapping) =>
        isConservativeDuplicate(
          externalName,
          mapping.externalName
        )
      );

    if (!mappingAlreadyExists) {
      const newMapping =
        await prisma.productMapping.create({
          data: {
            tenantId,
            externalName,
            source: order.source,
            productId: product.id,
          },
          select: {
            id: true,
            externalName: true,
            productId: true,
          },
        });

      existingMappings.push(newMapping);
    }

    await prisma.orderItem.update({
      where: {
        id: item.id,
      },
      data: {
        productId: product.id,
      },
    });

    connectedProducts += 1;
  }

  return {
    createdProducts,
    connectedProducts,
    reusedProducts,
    skippedItems,
  };
}
