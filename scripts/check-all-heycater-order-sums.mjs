process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

function parseMoneyToCents(value) {
  const raw = String(value || "")
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function findPdfNetCents(text) {
  const value = String(text || "");

  const patterns = [
    /Gesamtbetrag\s+Netto\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i,
    /Gesamtbetrag\s+Netto\s*([0-9]+(?:[.,][0-9]+)?)\s*€/i,
    /Netto\s+Gesamtbetrag\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i,
    /Gesamtsumme\s+Netto\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i,
    /Zwischensumme\s+Netto\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return parseMoneyToCents(match[1]);
  }

  return 0;
}

function centsToEuro(cents) {
  return (Number(cents || 0) / 100).toFixed(2).replace(".", ",") + " €";
}

try {
  const emails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        { subject: { contains: "Fast Track", mode: "insensitive" } },
        { subject: { contains: "bestätige den Auftrag", mode: "insensitive" } },
        { subject: { contains: "Bestelldetails wurden geändert", mode: "insensitive" } },
        { subject: { contains: "Auftragsbest", mode: "insensitive" } },
        { subject: { contains: "Order Confirmation", mode: "insensitive" } }
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      attachments: true,
      orders: {
        include: {
          items: true,
        },
      },
    },
  });

  const result = [];

  for (const email of emails) {
    const pdfText = email.attachments.map((a) => String(a.textContent || "")).join("\n\n");
    const pdfNetCents = findPdfNetCents(pdfText);

    for (const order of email.orders) {
      const orderTotalCents = order.items.reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
      const correctionItems = order.items.filter((item) =>
        String(item.name || "").toLowerCase().includes("fehlende position")
      );

      result.push({
        subject: email.subject,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        itemCount: order.items.length,
        correctionItemCount: correctionItems.length,
        orderTotal: centsToEuro(orderTotalCents),
        pdfNet: pdfNetCents ? centsToEuro(pdfNetCents) : "NICHT GEFUNDEN",
        difference: pdfNetCents ? centsToEuro(pdfNetCents - orderTotalCents) : "-",
        ok: pdfNetCents ? Math.abs(pdfNetCents - orderTotalCents) <= 2 : false,
        pdfTextPreview: pdfText.slice(-1200),
      });
    }
  }

  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
