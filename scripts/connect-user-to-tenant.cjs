const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function slugify(value) {
  return String(value || "mandant")
    .toLowerCase()
    .replace(/&/g, "und")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "mandant";
}

async function main() {
  const email = (process.argv[2] || "mutluer.edis@gmail.com").toLowerCase();
  const tenantName = process.argv[3] || "Edis Gastrobetriebe GmbH & Co. KG";

  console.log("Suche User:", email);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log("User nicht gefunden:", email);
    console.log("Bitte erst mit dieser E-Mail registrieren/einloggen.");
    return;
  }

  let tenant =
    (await prisma.tenant.findFirst({
      where: {
        OR: [
          { name: { contains: "Edis", mode: "insensitive" } },
          { name: { contains: "Let", mode: "insensitive" } },
          { name: { contains: "Gastrobetriebe", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    })) ||
    null;

  if (!tenant) {
    let slug = slugify(tenantName);
    let finalSlug = slug;
    let counter = 1;

    while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
      counter += 1;
      finalSlug = `${slug}-${counter}`;
    }

    tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug: finalSlug,
        planCode: "PRO",
        subscriptionStatus: "TRIAL",
        maxBrands: 3,
        maxEmailAccounts: 3,
        maxUsers: 5,
      },
    });

    console.log("Mandant erstellt:", tenant.name);
  } else {
    console.log("Mandant gefunden:", tenant.name);
  }

  await prisma.tenantUser.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    update: {
      role: "OWNER",
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  const features = [
    "CUSTOMERS",
    "PRODUCTS",
    "OFFERS",
    "ORDERS",
    "ORDER_INBOX",
    "PRODUCTION",
    "PACKING_LISTS",
    "DELIVERY_NOTES",
    "DELIVERIES",
    "PURCHASING",
    "INVENTORY",
    "SUPPLIERS",
    "RECIPES",
    "ANALYTICS",
    "SETTINGS",
  ];

  for (const feature of features) {
    try {
      await prisma.tenantFeature.upsert({
        where: {
          tenantId_feature: {
            tenantId: tenant.id,
            feature,
          },
        },
        update: {
          enabled: true,
        },
        create: {
          tenantId: tenant.id,
          feature,
          enabled: true,
        },
      });
    } catch (error) {
      console.log("Feature uebersprungen:", feature);
    }
  }

  console.log("Fertig.");
  console.log("User:", user.email);
  console.log("Mandant:", tenant.name);
  console.log("Rolle: OWNER");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
