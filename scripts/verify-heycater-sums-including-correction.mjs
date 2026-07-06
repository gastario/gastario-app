process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

function parseMoneyToCents(value) {
  const raw = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function extractPdfTotals(text) {
  const value = String(text || "");

  const nettoMatch = value.match(/Gesamtbetrag\s+Netto\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i);
  const grossMatch = value.match(/Gesamtbestellwert\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i);

  return {
    pdfNetCents: nettoMatch ? parseMoneyToCents(nettoMatch[1]) : 0,
    pdfGrossCents: grossMatch ? parseMoneyToCents(grossMatch[1]) : 0,
  };
}

function centsToEuro(cents) {
  return (Number(cents || 0) / 100).toFixed(2).replace(".", ",") + " €";
}

try {
  const emails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        { subject: { contains: "Fast Track Order", mode: "insensitive" } },
        { subject: { contains: "Partner Event Confirmation", mode: "insensitive" } },
        { subject: { contains: "Auftragsbest", mode: "insensitive" } },
        { subject: { contains: "Angebotsbest", mode: "insensitive" } }
      ],
    },
    include: {
      attachments: true,
      orders: {
        include: {
          items: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const result = [];

  for (const email of emails) {
    const text = email.attachments.map((a) => String(a.textContent || "")).join("\n\n");
    const totals = extractPdfTotals(text);

    for (const order of email.orders) {
      const totalIncludingCorrection = order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
      const correctionItems = order.items.filter((item) =>
        String(item.name || "").toLowerCase().includes("fehlende position")
      );

      result.push({
        subject: email.subject,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        itemCount: order.items.length,
        correctionItemCount: correctionItems.length,
        totalIncludingCorrection: centsToEuro(totalIncludingCorrection),
        pdfNet: centsToEuro(totals.pdfNetCents),
        difference: centsToEuro(totals.pdfNetCents - totalIncludingCorrection),
        ok: Math.abs(totals.pdfNetCents - totalIncludingCorrection) <= 2,
        correctionItems: correctionItems.map((item) => ({
          name: item.name,
          total: centsToEuro(item.totalCents),
        })),
      });
    }
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
