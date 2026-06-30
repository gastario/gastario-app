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
  | "PURCHASING"
  | "INVENTORY"
  | "SUPPLIERS"
  | "RECIPES"
  | "REPORTS"
  | "MULTI_USER"
  | "DRIVER_VIEW"
  | "PRODUCT_MAPPING"
  | "INTEGRATIONS";

const DEFAULT_FEATURES: FeatureCode[] = [
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

export async function getTenantAccess(request: Request) {
  const { prisma } = await import("./prisma.server");
  const { getUserId } = await import("./session.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: {
      user: true,
      tenant: true,
    },
  });

  if (!tenantUser) {
    return {
      userId,
      tenantId: null,
      tenant: null,
      user: null,
      role: null,
      features: [],
      setupError: "Kein Mandant gefunden. Bitte Benutzer im Super Admin einem Mandanten zuordnen.",
    };
  }

  if (tenantUser.tenant.lockedAt) {
    return {
      userId,
      tenantId: tenantUser.tenantId,
      tenant: tenantUser.tenant,
      user: tenantUser.user,
      role: tenantUser.role,
      features: [],
      setupError: tenantUser.tenant.lockReason || "Dieser Mandant ist gesperrt.",
    };
  }

  for (const feature of DEFAULT_FEATURES) {
    await prisma.tenantFeature.upsert({
      where: {
        tenantId_feature: {
          tenantId: tenantUser.tenantId,
          feature,
        },
      },
      update: {},
      create: {
        tenantId: tenantUser.tenantId,
        feature,
        enabled: true,
      },
    });
  }

  const featureRows = await prisma.tenantFeature.findMany({
    where: {
      tenantId: tenantUser.tenantId,
      enabled: true,
    },
  });

  return {
    userId,
    tenantId: tenantUser.tenantId,
    tenant: tenantUser.tenant,
    user: tenantUser.user,
    role: tenantUser.role,
    features: featureRows.map((row) => row.feature),
    setupError: null,
  };
}

export async function requireTenantFeature(request: Request, feature: FeatureCode) {
  const access = await getTenantAccess(request);

  if (!access.tenantId || !access.tenant) {
    throw new Response(access.setupError || "Kein Mandant gefunden.", { status: 403 });
  }

  if (access.setupError) {
    throw new Response(access.setupError, { status: 403 });
  }

  if (!access.features.includes(feature)) {
    throw new Response("Dieses Modul ist fuer deinen Mandanten nicht freigeschaltet.", { status: 403 });
  }

  return {
    userId: access.userId,
    tenantId: access.tenantId,
    tenant: access.tenant,
    user: access.user,
    role: access.role,
    features: access.features,
  };
}
