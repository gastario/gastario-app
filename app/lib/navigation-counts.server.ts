export type NavigationCounts = {
  inbox: number;
  upcomingOrders: number;
  openQuotes: number;
  production: number;
  packing: number;
  deliveries: number;
  financeOpen: number;
  inventoryWarnings: number;
};

export const emptyNavigationCounts: NavigationCounts = {
  inbox: 0,
  upcomingOrders: 0,
  openQuotes: 0,
  production: 0,
  packing: 0,
  deliveries: 0,
  financeOpen: 0,
  inventoryWarnings: 0,
};

export async function getNavigationCounts(
  request: Request
): Promise<NavigationCounts> {
  const { prisma } =
    await import("./prisma.server");

  const { getUserId } =
    await import("./session.server");

  const userId =
    await getUserId(request);

  if (!userId) {
    return {
      ...emptyNavigationCounts,
    };
  }

  const membership =
    await prisma.tenantUser
      .findFirst({
        where: {
          userId,
        },
        select: {
          tenantId: true,
          tenant: {
            select: {
              lockedAt: true,
            },
          },
        },
      })
      .catch(() => null);

  if (
    !membership?.tenantId ||
    membership.tenant?.lockedAt
  ) {
    return {
      ...emptyNavigationCounts,
    };
  }

  const tenantId =
    membership.tenantId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /*
   * Der Auftragseingang zeigt standardmäßig
   * die letzten sieben Tage. Der Badge folgt
   * demselben Zeitraum, damit keine jahrealten
   * unverknüpften E-Mails als offene Aufgabe
   * erscheinen.
   */
  const inboxSince = new Date(today);
  inboxSince.setDate(
    inboxSince.getDate() - 7
  );

  const intakeOrderStatuses = [
    "AUTO_CREATED",
    "REVIEW_NEEDED",
    "INCOMPLETE",
    "POSSIBLE_DUPLICATE",
  ] as any;

  /*
   * Muss der Auftragsübersicht entsprechen:
   * nur operative, noch nicht abgeschlossene
   * Aufträge mit heutiger oder zukünftiger
   * Lieferung.
   */
  const activeUpcomingStatuses = [
    "CONFIRMED",
    "IN_PRODUCTION",
    "PACKING_OPEN",
  ] as any;

  const [
    pendingEmails,
    pendingIntakeOrders,
    upcomingOrders,
    openQuotes,
    production,
    packing,
    deliveries,
    openInvoices,
    readyToInvoice,
    inventoryItems,
  ] = await Promise.all([
    prisma.incomingEmail
      .count({
        where: {
          tenantId,

          status: {
            in: [
              "RECEIVED",
              "REVIEW_NEEDED",
              "FAILED",
            ] as any,
          },

          receivedAt: {
            gte: inboxSince,
          },

          orders: {
            none: {},
          },
        },
      })
      .catch(() => 0),

    prisma.order
      .count({
        where: {
          tenantId,

          status: {
            in: intakeOrderStatuses,
          },
        },
      })
      .catch(() => 0),

    prisma.order
      .count({
        where: {
          tenantId,

          status: {
            in: activeUpcomingStatuses,
          },

          deliveryDate: {
            gte: today,
          },
        },
      })
      .catch(() => 0),

    prisma.quote
      .count({
        where: {
          tenantId,
          status: "DRAFT" as any,
        },
      })
      .catch(() => 0),

    prisma.order
      .count({
        where: {
          tenantId,
          status:
            "IN_PRODUCTION" as any,
        },
      })
      .catch(() => 0),

    prisma.order
      .count({
        where: {
          tenantId,
          status:
            "PACKING_OPEN" as any,
        },
      })
      .catch(() => 0),

    prisma.order
      .count({
        where: {
          tenantId,

          status: {
            in: activeUpcomingStatuses,
          },

          deliveryDate: {
            gte: today,
          },
        },
      })
      .catch(() => 0),

    prisma.invoice
      .count({
        where: {
          tenantId,

          status: {
            in: [
              "DRAFT",
              "ISSUED",
            ] as any,
          },

          cancelledAt: null,
        },
      })
      .catch(() => 0),

    prisma.order
      .count({
        where: {
          tenantId,

          billingStatus:
            "READY_TO_INVOICE" as any,

          invoices: {
            none: {},
          },
        },
      })
      .catch(() => 0),

    prisma.inventoryItem
      .findMany({
        where: {
          tenantId,
          active: true,
        },

        select: {
          currentStock: true,
          minStock: true,
        },
      })
      .catch(() => []),
  ]);

  const inventoryWarnings =
    inventoryItems.filter((item) => {
      const currentStock =
        Number(item.currentStock || 0);

      const minStock =
        Number(item.minStock || 0);

      return (
        minStock > 0 &&
        currentStock <= minStock
      );
    }).length;

  return {
    inbox:
      Number(pendingEmails || 0) +
      Number(pendingIntakeOrders || 0),

    upcomingOrders:
      Number(upcomingOrders || 0),

    openQuotes:
      Number(openQuotes || 0),

    production:
      Number(production || 0),

    packing:
      Number(packing || 0),

    deliveries:
      Number(deliveries || 0),

    financeOpen:
      Number(openInvoices || 0) +
      Number(readyToInvoice || 0),

    inventoryWarnings,
  };
}