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
  const taxMatch = value.match(/Umsatzsteuer\s+7%\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i);
  const grossMatch = value.match(/Gesamtbestellwert\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i);

  return {
    pdfNetCents: nettoMatch ? parseMoneyToCents(nettoMatch[1]) : 0,
    pdfTaxCents: taxMatch ? parseMoneyToCents(taxMatch[1]) : 0,
    pdfGrossCents: grossMatch ? parseMoneyToCents(grossMatch[1]) : 0,
  };
}

function orderItemsTotal(order) {
  return order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
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
      const itemTotalCents = orderItemsTotal(order);
      const differenceCents = totals.pdfNetCents - itemTotalCents;

      result.push({
        subject: email.subject,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        itemCount: order.items.length,
        itemTotalEuro: (itemTotalCents / 100).toFixed(2),
        pdfNetEuro: (totals.pdfNetCents / 100).toFixed(2),
        pdfGrossEuro: (totals.pdfGrossCents / 100).toFixed(2),
        differenceEuro: (differenceCents / 100).toFixed(2),
        ok: Math.abs(differenceCents) <= 2,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitEuro: (Number(item.unitCents || 0) / 100).toFixed(2),
          totalEuro: (Number(item.totalCents || 0) / 100).toFixed(2),
        })),
      });
    }
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
