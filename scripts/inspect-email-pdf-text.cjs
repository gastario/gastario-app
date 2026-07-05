const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const attachments = await prisma.emailAttachment.findMany({
    where: {
      OR: [
        {
          filename: {
            contains: ".pdf",
            mode: "insensitive",
          },
        },
        {
          mimeType: {
            contains: "pdf",
            mode: "insensitive",
          },
        },
      ],
    },
    include: {
      incomingEmail: {
        select: {
          id: true,
          subject: true,
          sender: true,
          status: true,
          receivedAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  console.log("PDF-Anhaenge gefunden:", attachments.length);
  console.log("");

  for (const attachment of attachments) {
    const text = String(attachment.textContent || "");
    const preview = text.replace(/\s+/g, " ").slice(0, 180);

    console.log([
      "MAIL=" + attachment.incomingEmail.subject,
      "DATEI=" + attachment.filename,
      "MIME=" + (attachment.mimeType || "-"),
      "TEXTLAENGE=" + text.length,
      "VORSCHAU=" + (preview || "-"),
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
