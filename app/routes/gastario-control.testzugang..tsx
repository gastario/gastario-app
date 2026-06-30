import { redirect } from "react-router";

const ALL_FEATURES = [
  "DASHBOARD",
  "ORDERS",
  "CUSTOMERS",
  "PRODUCTS",
  "QUOTES",
  "PRODUCTION",
  "PACKING_LISTS",
  "DELIVERY_NOTES",
  "DELIVERIES",
  "INCOMING_ORDERS",
  "PDF_EXTRACTION",
  "EMAIL_AUTOMATION",
  "PURCHASING",
  "INVENTORY",
  "SUPPLIERS",
  "RECIPES",
  "REPORTS",
  "MULTI_USER",
  "DRIVER_VIEW",
  "PRODUCT_MAPPING",
  "INTEGRATIONS",
];

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { tenantId?: string };
}) {
  const { prisma } = await import("../lib/prisma.server");
  const { getUserId } = await import("../lib/session.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.platformRole !== "SUPER_ADMIN") {
    throw new Response("Nur Super Admins duerfen Mandanten testen.", { status: 403 });
  }

  const tenantId = params.tenantId;

  if (!tenantId) {
    throw new Response("Mandant fehlt.", { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Response("Mandant nicht gefunden.", { status: 404 });
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

  for (const feature of ALL_FEATURES) {
    await prisma.tenantFeature.upsert({
      where: {
        tenantId_feature: {
          tenantId: tenant.id,
          feature: feature as any,
        },
      },
      update: {
        enabled: true,
      },
      create: {
        tenantId: tenant.id,
        feature: feature as any,
        enabled: true,
      },
    });
  }

  return redirect("/auftragseingang");
}
