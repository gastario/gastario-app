export async function loader({
  request,
}: {
  request: Request;
}) {
  const { prisma } =
    await import("../lib/prisma.server");

  const { requireTenantFeature } =
    await import("../lib/features.server");

  const {
    renderProcurementOrderPdf,
  } = await import(
    "../lib/procurement-order-pdf.server"
  );

  const access = await requireTenantFeature(
    request,
    "PURCHASING"
  );

  const url = new URL(request.url);

  const draftIds = Array.from(
    new Set(
      String(
        url.searchParams.get("draftIds") ||
          ""
      )
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (draftIds.length === 0) {
    throw new Response(
      "Keine Bestellungen ausgewählt.",
      {
        status: 400,
      }
    );
  }

  const drafts =
    await prisma.procurementOrderDraft.findMany({
      where: {
        tenantId: access.tenantId,
        id: {
          in: draftIds,
        },
        status: {
          in: [
            "DRAFT",
            "ORDERED",
            "PARTIALLY_RECEIVED",
          ],
        },
      },
      include: {
        items: true,
      },
    });

  if (drafts.length !== draftIds.length) {
    throw new Response(
      "Mindestens eine Bestellung wurde nicht gefunden oder ist nicht mehr offen.",
      {
        status: 409,
      }
    );
  }

  const supplierNames = Array.from(
    new Set(
      drafts.map((draft: any) =>
        String(
          draft.supplierName
        ).trim()
      )
    )
  );

  if (supplierNames.length !== 1) {
    throw new Response(
      "Die ausgewählten Bestellungen gehören nicht zum selben Lieferanten.",
      {
        status: 409,
      }
    );
  }

  const itemMap = new Map<string, any>();

  for (const draft of drafts) {
    for (const item of draft.items) {
      const key = [
        item.catalogItemId || "",
        item.articleNumber || "",
        item.catalogItemName || "",
        item.baseUnit || "",
        item.netUnitPriceCents || 0,
      ].join("|");

      let merged = itemMap.get(key);

      if (!merged) {
        merged = {
          ingredientName:
            item.ingredientName,
          catalogItemName:
            item.catalogItemName,
          articleNumber:
            item.articleNumber,
          packageCount: 0,
          packContent:
            item.packContent,
          baseUnit: item.baseUnit,
          netUnitPriceCents:
            item.netUnitPriceCents,
          netTotalCents: 0,
        };

        itemMap.set(key, merged);
      }

      merged.packageCount += Number(
        item.packageCount || 0
      );

      merged.netTotalCents += Number(
        item.netTotalCents || 0
      );
    }
  }

  const planningDates = drafts.map(
    (draft: any) =>
      new Date(draft.planningDate)
  );

  const earliestPlanningDate =
    new Date(
      Math.min(
        ...planningDates.map(
          (date) => date.getTime()
        )
      )
    );

  const latestPlanningDate =
    new Date(
      Math.max(
        ...planningDates.map(
          (date) => date.getTime()
        )
      )
    );

  const pdfData =
    await renderProcurementOrderPdf({
      tenantName: access.tenant.name,
      supplierName:
        supplierNames[0],
      planningDate:
        earliestPlanningDate,
      planType: "PRACTICAL",
      status: "ORDERED",
      createdAt: new Date(),
      orderedAt: new Date(),
      receivedAt: null,
      netTotalCents: drafts.reduce(
        (
          sum: number,
          draft: any
        ) =>
          sum +
          Number(
            draft.netTotalCents || 0
          ),
        0
      ),
      items: Array.from(
        itemMap.values()
      ),
    });

  const supplierSlug = String(
    supplierNames[0] || "lieferant"
  )
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  const fromDate =
    earliestPlanningDate
      .toISOString()
      .slice(0, 10);

  const toDate =
    latestPlanningDate
      .toISOString()
      .slice(0, 10);

  const filename =
    `sammelbestellung-${supplierSlug}-${fromDate}-bis-${toDate}.pdf`;

  return new Response(pdfData, {
    headers: {
      "Content-Type":
        "application/pdf",
      "Content-Disposition":
        `inline; filename="${filename}"`,
      "Cache-Control":
        "private, no-store",
    },
  });
}