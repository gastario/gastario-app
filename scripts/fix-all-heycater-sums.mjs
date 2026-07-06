process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const DIFF_NAME = "Fehlende Position(en) laut Heycater-PDF";

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

function baseTotalWithoutCorrection(order) {
  return order.items
    .filter((item) => String(item.name || "") !== DIFF_NAME)
    .reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
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
    take: 80,
    include: {
      attachments: true,
      orders: {
        include: {
          items: true,
        },
      },
    },
  });

  const fixes = [];

  for (const email of emails) {
    const pdfText = email.attachments.map((a) => String(a.textContent || "")).join("\n\n");
    const pdfNetCents = findPdfNetCents(pdfText);

    if (!pdfNetCents) continue;

    for (const order of email.orders) {
      const baseTotalCents = baseTotalWithoutCorrection(order);
      const differenceCents = pdfNetCents - baseTotalCents;

      if (differenceCents > 2) {
        fixes.push({
          emailId: email.id,
          orderId: order.id,
          subject: email.subject,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          baseTotal: centsToEuro(baseTotalCents),
          pdfNet: centsToEuro(pdfNetCents),
          difference: centsToEuro(differenceCents),
          differenceCents,
        });
      }
    }
  }

  console.log(JSON.stringify({
    mode: process.env.CONFIRM_FIX_ALL_HEYCATER_SUMS === "YES" ? "WRITE" : "DRY_RUN",
    count: fixes.length,
    fixes: fixes.map((fix) => ({
      subject: fix.subject,
      orderNumber: fix.orderNumber,
      customerName: fix.customerName,
      baseTotal: fix.baseTotal,
      pdfNet: fix.pdfNet,
      difference: fix.difference,
    })),
  }, null, 2));

  if (process.env.CONFIRM_FIX_ALL_HEYCATER_SUMS !== "YES") {
    process.exit(0);
  }

  for (const fix of fixes) {
    await prisma.$transaction([
      prisma.orderItem.deleteMany({
        where: {
          orderId: fix.orderId,
          name: DIFF_NAME,
        },
      }),
      prisma.orderItem.create({
        data: {
          orderId: fix.orderId,
          name: DIFF_NAME,
          quantity: 1,
          unit: "Pauschal",
          unitCents: fix.differenceCents,
          totalCents: fix.differenceCents,
          notes:
            "Automatische Kontrollposition, damit die Summe mit dem Gesamtbetrag Netto aus der Heycater-PDF übereinstimmt. Bitte fehlende/übersehene Positionen im PDF gegenprüfen.",
        },
      }),
      prisma.order.update({
        where: {
          id: fix.orderId,
        },
        data: {
          reviewReason:
            "Heycater-Summenabgleich: Positionssumme wurde an den Gesamtbetrag Netto aus der PDF angepasst. Bitte fehlende Positionen prüfen.",
        },
      }),
    ]);
  }

  console.log("Fertig.");
} finally {
  await prisma.$disconnect();
}
