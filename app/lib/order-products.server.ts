import { prisma } from "./prisma.server";

function cleanProductName(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNonProductPosition(value: unknown) {
  const name = cleanProductName(value).toLowerCase();

  if (!name) return true;

  return [
    "lieferung und abholung",
    "lieferung",
    "abholung",
    "transport",
    "servicepersonal",
    "personal",
    "aufbau",
    "abbau",
    "fehlende position",
    "fehlende position(en)",
    "automatische kontrollposition",
    "pfand",
    "standgebühr",
    "standgebuehr",
  ].some(
    (blockedName) =>
      name === blockedName ||
      name.startsWith(blockedName + " ") ||
      name.includes(
        blockedName === "fehlende position"
          ? blockedName
          : "__niemals__"
      )
  );
}

function normalizeUnit(value: unknown) {
  const unit = cleanProductName(value);

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
  const order = await prisma.order.findFirst({
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

  let createdProducts = 0;
  let connectedProducts = 0;
  let skippedItems = 0;

  for (const item of order.items) {
    const externalName = cleanProductName(item.name);

    if (isNonProductPosition(externalName)) {
      skippedItems += 1;
      continue;
    }

    /*
     * Bereits verbundene Positionen nicht erneut bearbeiten.
     */
    if (item.productId) {
      connectedProducts += 1;
      continue;
    }

    /*
     * 1. Plattform-Mapping suchen.
     */
    const existingMapping =
      await prisma.productMapping.findFirst({
        where: {
          tenantId,
          source: order.source,
          externalName: {
            equals: externalName,
            mode: "insensitive",
          },
        },
        select: {
          productId: true,
        },
      });

    if (existingMapping) {
      await prisma.orderItem.update({
        where: {
          id: item.id,
        },
        data: {
          productId: existingMapping.productId,
        },
      });

      connectedProducts += 1;
      continue;
    }

    /*
     * 2. Bereits vorhandenes Produkt mit gleichem Namen suchen.
     */
    let product = await prisma.product.findFirst({
      where: {
        tenantId,
        name: {
          equals: externalName,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    /*
     * 3. Fehlendes Produkt automatisch anlegen.
     */
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId,
          name: externalName,
          category: "Automatisch importiert",
          unit: normalizeUnit(item.unit),
          priceCents: Number(item.unitCents || 0),
          taxRate: 7,
          active: true,
        },
        select: {
          id: true,
        },
      });

      createdProducts += 1;
    }

    /*
     * 4. Externe Bezeichnung dauerhaft merken.
     */
    const duplicateMapping =
      await prisma.productMapping.findFirst({
        where: {
          tenantId,
          source: order.source,
          externalName: {
            equals: externalName,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
        },
      });

    if (!duplicateMapping) {
      await prisma.productMapping.create({
        data: {
          tenantId,
          externalName,
          source: order.source,
          productId: product.id,
        },
      });
    }

    /*
     * 5. Auftragsposition mit Produkt verbinden.
     */
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
    skippedItems,
  };
}
