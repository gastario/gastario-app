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

function extractPdfTotals(text) {
  const value = String(text || "");

  const nettoMatch = value.match(/Gesamtbetrag\s+Netto\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i);
  const grossMatch = value.match(/Gesamtbestellwert\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i);

  return {
    pdfNetCents: nettoMatch ? parseMoneyToCents(nettoMatch[1]) : 0,
    pdfGrossCents: grossMatch ? parseMoneyToCents(grossMatch[1]) : 0,
  };
}

function orderItemsTotal(order) {
  return order.items
    .filter((item) => item.name !== DIFF_NAME)
    .reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
}

function euro(cents) {
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

  const fixes = [];

  for (const email of emails) {
    const text = email.attachments.map((a) => String(a.textContent || "")).join("\n\n");
    const totals = extractPdfTotals(text);

    if (!totals.pdfNetCents) continue;

    for (const order of email.orders) {
      const itemTotalCents = orderItemsTotal(order);
      const differenceCents = totals.pdfNetCents - itemTotalCents;

      if (Math.abs(differenceCents) > 2) {
        fixes.push({
          emailId: email.id,
          orderId: order.id,
          subject: email.subject,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          itemTotal: euro(itemTotalCents),
          pdfNet: euro(totals.pdfNetCents),
          difference: euro(differenceCents),
          direction: differenceCents > 0 ? "ADD" : "CHECK_NEGATIVE",
        });
      }
    }
  }

  console.log(JSON.stringify({
    mode: process.env.CONFIRM_HEYCATER_SUM_CORRECTIONS === "YES" ? "WRITE" : "DRY_RUN",
    count: fixes.length,
    fixes,
  }, null, 2));

  if (process.env.CONFIRM_HEYCATER_SUM_CORRECTIONS !== "YES") {
    process.exit(0);
  }

  for (const fix of fixes) {
    const cents = parseMoneyToCents(fix.difference);

    await prisma.$transaction([
      prisma.orderItem.deleteMany({
        where: {
          orderId: fix.orderId,
          name: DIFF_NAME,
        },
      }),
      ...(cents > 0
        ? [
            prisma.orderItem.create({
              data: {
                orderId: fix.orderId,
                name: DIFF_NAME,
                quantity: 1,
                unit: "Pauschal",
                unitCents: cents,
                totalCents: cents,
                notes:
                  "Automatische Kontrollposition, damit die Summe mit dem Gesamtbetrag Netto aus der Heycater-PDF uebereinstimmt. Bitte Positionen im PDF gegenpruefen.",
              },
            }),
          ]
        : []),
      prisma.order.update({
        where: {
          id: fix.orderId,
        },
        data: {
          reviewReason:
            "Heycater-Summenabgleich: Positionssumme wurde an den Gesamtbetrag Netto aus der PDF angepasst. Bitte fehlende Positionen pruefen.",
        },
      }),
    ]);
  }

  console.log("Fertig.");
} finally {
  await prisma.$disconnect();
}

