import { redirect } from "react-router";

async function ensureFoodProductLabelTable(prisma: any) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FoodProductLabel" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "customerName" TEXT,
      "labelDate" TEXT,
      "ingredients" TEXT,
      "allergens" TEXT,
      "logoDataUrl" TEXT,
      "labelCount" INTEGER NOT NULL DEFAULT 12,
      "printPreset" TEXT NOT NULL DEFAULT 'a4-3',
      "labelSize" TEXT NOT NULL DEFAULT 'auto',
      "publicToken" TEXT UNIQUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "FoodProductLabel"
    ADD COLUMN IF NOT EXISTS "customerName" TEXT;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "FoodProductLabel"
    ADD COLUMN IF NOT EXISTS "labelDate" TEXT;
  `);
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { labelId?: string };
}) {
  const { getUserId } =
    await import("../lib/session.server");

  const { prisma } =
    await import("../lib/prisma.server");

  const { renderManualFoodLabelPdf } =
    await import("../lib/manual-foodlabel-pdf.server");

  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const access =
    await prisma.tenantUser.findFirst({
      where: { userId },
      include: { tenant: true },
    });

  if (!access?.tenant) {
    throw redirect("/");
  }

  await ensureFoodProductLabelTable(prisma);

  const rows =
    await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "FoodProductLabel" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      params.labelId,
      access.tenantId
    );

  const label = rows[0];

  if (!label) {
    throw new Response("Label nicht gefunden", {
      status: 404,
    });
  }

  const widthMm =
    label.printPreset === "roll-57x32"
      ? 57
      : 76;

  const heightMm =
    label.printPreset === "roll-57x32"
      ? 32
      : 51;

  const pdfBytes =
    await renderManualFoodLabelPdf({
      name: label.name,
      customerName: label.customerName,
      labelDate: label.labelDate,
      ingredients: label.ingredients,
      allergens: label.allergens,
      count: Number(label.labelCount || 1),
      widthMm,
      heightMm,
    });

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'inline; filename="gastario-foodlabels.pdf"',
      "Cache-Control": "no-store",
    },
  });
}


