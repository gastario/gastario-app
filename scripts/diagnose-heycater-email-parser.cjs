const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const { extractHeycaterOrder } = await import("../app/lib/order-import-extract.server.js").catch(async () => {
    return await import("../app/lib/order-import-extract.server.ts");
  });

  const emails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        { subject: { contains: "Fast Track", mode: "insensitive" } },
        { subject: { contains: "heycater", mode: "insensitive" } },
        { subject: { contains: "Catering", mode: "insensitive" } },
      ],
    },
    include: {
      attachments: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          deliveryDate: true,
          deliveryAddress: true,
          totalCents: true,
        },
      },
    },
    orderBy: {
      receivedAt: "desc",
    },
    take: 20,
  });

  console.log("Gefundene relevante E-Mails:", emails.length);
  console.log("");

  for (const email of emails) {
    const attachmentText = email.attachments
      .map((attachment) => String(attachment.textContent || ""))
      .join("\n\n");

    const fullText = [
      email.subject || "",
      email.bodyText || "",
      attachmentText,
    ].filter(Boolean).join("\n\n");

    const pdfTextLength = attachmentText.length;
    const extracted = extractHeycaterOrder(fullText);

    console.log("--------------------------------------------------");
    console.log("MAIL:", email.subject);
    console.log("ABSENDER:", email.sender);
    console.log("ANHAENGE:", email.attachments.length);
    console.log("PDF_TEXTLAENGE:", pdfTextLength);
    console.log("VERKNUEPFTE_AUFTRAEGE:", email.orders.length);

    for (const order of email.orders) {
      console.log("ORDER:", order.orderNumber, "|", order.customerName, "|", order.deliveryDate, "|", order.deliveryAddress || "-", "|", order.totalCents);
    }

    console.log("");
    console.log("ERKANNT:");
    console.log("source:", extracted?.source || "-");
    console.log("customerName:", extracted?.customerName || "-");
    console.log("deliveryDate:", extracted?.deliveryDate || "-");
    console.log("deliveryTime:", extracted?.deliveryTime || "-");
    console.log("deliveryAddress:", extracted?.deliveryAddress || "-");
    console.log("contactName:", extracted?.contactName || "-");
    console.log("contactPhone:", extracted?.contactPhone || "-");
    console.log("items:", Array.isArray(extracted?.items) ? extracted.items.length : 0);
    console.log("totalCents:", extracted?.totalCents || 0);

    if (Array.isArray(extracted?.items) && extracted.items.length > 0) {
      console.log("ERSTE_POSITION:", extracted.items[0]);
    }

    console.log("");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
