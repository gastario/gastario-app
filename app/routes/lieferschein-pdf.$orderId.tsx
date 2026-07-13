export async function loader({
  request,
  params,
}: {
  request: Request;
  params: {
    orderId?: string;
  };
}) {
  const { prisma } = await import("../lib/prisma.server");
  const { getTenantAccess } = await import("../lib/features.server");
  const {
    ensureDeliveryNoteForOrder,
  } = await import("../lib/delivery-note.server");

  const access = await getTenantAccess(request);

  if (!access.tenantId) {
    throw new Response("Nicht angemeldet.", {
      status: 401,
    });
  }

  const orderId = String(params.orderId || "");

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      tenantId: access.tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!order) {
    throw new Response("Auftrag nicht gefunden.", {
      status: 404,
    });
  }

  const note = await ensureDeliveryNoteForOrder(order.id);

  return new Response(note.pdfData, {
    headers: {
      "Content-Type":
        note.mimeType || "application/pdf",
      "Content-Disposition":
        'inline; filename="' + note.filename + '"',
      "Cache-Control":
        "private, max-age=0, must-revalidate",
    },
  });
}
