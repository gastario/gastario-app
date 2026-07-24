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

  const url = new URL(request.url);
  const forceRefresh =
    url.searchParams.get("refresh") === "1";

  const note = await ensureDeliveryNoteForOrder(
    order.id,
    {
      force: forceRefresh,
    }
  );

  const pdfBuffer = Buffer.from(note.pdfData);

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBuffer.byteLength),
      "Content-Disposition":
        'inline; filename="' + note.filename + '"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
