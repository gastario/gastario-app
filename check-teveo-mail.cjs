const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const mails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        {
          subject: {
            contains: "BMW",
            mode: "insensitive",
          },
        },
        {
          subject: {
            contains: "MARATHON",
            mode: "insensitive",
          },
        },
        {
          sender: {
            contains: "teveo",
            mode: "insensitive",
          },
        },
        {
          bodyText: {
            contains: "TEVEO",
            mode: "insensitive",
          },
        },
      ],
    },
    include: {
      orders: {
        select: {
          orderNumber: true,
          status: true,
        },
      },
      emailAccount: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      receivedAt: "desc",
    },
    take: 20,
  });

  console.log(
    JSON.stringify(
      mails.map((mail) => ({
        receivedAt: mail.receivedAt,
        connectedAccount:
          mail.emailAccount?.email || null,
        mailbox: mail.mailbox,
        sender: mail.sender,
        subject: mail.subject,
        status: mail.status,
        processedAt: mail.processedAt,
        errorMessage: mail.errorMessage,
        aiDecision:
          mail.extractedJson &&
          typeof mail.extractedJson === "object" &&
          !Array.isArray(mail.extractedJson)
            ? mail.extractedJson.aiDecision || null
            : null,
        linkedOrders: mail.orders,
        bodyPreview: String(mail.bodyText || "")
          .replace(/\s+/g, " ")
          .slice(0, 400),
      })),
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
