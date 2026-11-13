import { redirect } from "react-router";

export async function loader({ request, params }: { request: Request; params: { receiptId?: string } }) {
  const { getTenantAccess } = await import("../lib/features.server");
  const { prisma } = await import("../lib/prisma.server");
  const access = await getTenantAccess(request);
  if (!access.tenantId) throw redirect("/login");
  const receipt = await prisma.receipt.findFirst({
    where: { id: params.receiptId || "", tenantId: access.tenantId },
    select: { originalFileName: true, mimeType: true, fileData: true },
  });
  if (!receipt) throw new Response("Beleg nicht gefunden.", { status: 404 });
  const fileName = receipt.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(new Uint8Array(receipt.fileData), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Content-Disposition": 'inline; filename="' + fileName + '"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
