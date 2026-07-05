const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const attachments = await prisma.emailAttachment.findMany({
    where: {
      filename: {
        contains: ".pdf",
        mode: "insensitive",
      },
    },
    include: {
      incomingEmail: {
        select: {
          subject: true,
          sender: true,
          receivedAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });

  console.log("PDF-Anhaenge:", attachments.length);
  console.log("");

  for (const attachment of attachments) {
    const textLength = String(attachment.textContent || "").length;

    console.log([
      attachment.incomingEmail.subject,
      attachment.filename,
      "textLength=" + textLength,
      attachment.incomingEmail.receivedAt.toISOString(),
    ].join(" | "));
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
