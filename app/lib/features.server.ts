import { redirect } from "react-router";

type FeatureCode =
  | "DASHBOARD"
  | "ORDERS"
  | "CUSTOMERS"
  | "PRODUCTS"
  | "QUOTES"
  | "PRODUCTION"
  | "PACKING_LISTS"
  | "DELIVERY_NOTES"
  | "DELIVERIES"
  | "INCOMING_ORDERS"
  | "PDF_EXTRACTION"
  | "EMAIL_AUTOMATION"
  | "PRODUCT_MAPPING"
  | "PURCHASING"
  | "INVENTORY"
  | "SUPPLIERS"
  | "RECIPES"
  | "REPORTS"
  | "MULTI_USER"
  | "DRIVER_VIEW"
  | "INTEGRATIONS";

export async function requireTenantFeature(request: Request, feature: FeatureCode) {
  const { prisma } = await import("./prisma.server");
  const { getUserId } = await import("./session.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: {
      userId,
    },
    include: {
      tenant: true,
      user: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!tenantUser) {
    throw new Response("Kein Mandant zugeordnet.", { status: 403 });
  }

  if (tenantUser.tenant.lockedAt) {
    throw new Response("Dieser Mandant wurde gesperrt.", { status: 403 });
  }

  const enabledFeature = await prisma.tenantFeature.findUnique({
    where: {
      tenantId_feature: {
        tenantId: tenantUser.tenantId,
        feature: feature as any,
      },
    },
  });

  if (!enabledFeature?.enabled) {
    throw new Response("Dieses Modul ist fuer deinen Mandanten nicht freigeschaltet.", { status: 403 });
  }

  return {
    userId,
    tenantId: tenantUser.tenantId,
    tenant: tenantUser.tenant,
    user: tenantUser.user,
    role: tenantUser.role,
  };
}

export async function getTenantAccess(request: Request) {
  const { prisma } = await import("./prisma.server");
  const { getUserId } = await import("./session.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: {
      userId,
    },
    include: {
      tenant: true,
      user: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!tenantUser) {
    throw new Response("Kein Mandant zugeordnet.", { status: 403 });
  }

  if (tenantUser.tenant.lockedAt) {
    throw new Response("Dieser Mandant wurde gesperrt.", { status: 403 });
  }

  const enabledFeatures = await prisma.tenantFeature.findMany({
    where: {
      tenantId: tenantUser.tenantId,
      enabled: true,
    },
    select: {
      feature: true,
    },
  });

  return {
    userId,
    tenantId: tenantUser.tenantId,
    tenant: tenantUser.tenant,
    user: tenantUser.user,
    role: tenantUser.role,
    features: enabledFeatures.map((item) => item.feature),
  };
}
