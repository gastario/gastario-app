export async function loader({
  request,
  params,
}: {
  request: Request;
  params: {
    draftId?: string;
  };
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

  const draftId = String(
    params.draftId || ""
  ).trim();

  const draft =
    await prisma.procurementOrderDraft.findFirst({
      where: {
        id: draftId,
        tenantId: access.tenantId,
      },
      include: {
        items: {
          orderBy: {
            ingredientName: "asc",
          },
        },
      },
    });

  if (!draft) {
    throw new Response(
      "Einkaufsbestellung nicht gefunden.",
      {
        status: 404,
      }
    );
  }

  const pdfData =
    await renderProcurementOrderPdf({
      tenantName: access.tenant.name,
      supplierName:
        draft.supplierName,
      planningDate:
        draft.planningDate,
      planType: draft.planType,
      status: draft.status,
      createdAt: draft.createdAt,
      orderedAt: draft.orderedAt,
      receivedAt: draft.receivedAt,
      netTotalCents:
        draft.netTotalCents,
      items: draft.items.map(
        (item: any) => ({
          ingredientName:
            item.ingredientName,
          catalogItemName:
            item.catalogItemName,
          articleNumber:
            item.articleNumber,
          packageCount:
            item.packageCount,
          packContent:
            item.packContent,
          baseUnit:
            item.baseUnit,
          netUnitPriceCents:
            item.netUnitPriceCents,
          netTotalCents:
            item.netTotalCents,
        })
      ),
    });

  const supplierSlug = String(
    draft.supplierName || "lieferant"
  )
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  const dateText = new Date(
    draft.planningDate
  )
    .toISOString()
    .slice(0, 10);

  const filename =
    `einkaufsbestellung-${supplierSlug}-${dateText}.pdf`;

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