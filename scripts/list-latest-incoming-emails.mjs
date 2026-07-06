process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const emails = await prisma.incomingEmail.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      subject: true,
      sender: true,
      status: true,
      errorMessage: true,
      extractedJson: true,
      _count: {
        select: {
          attachments: true,
          orders: true,
        },
      },
    },
  });

  console.log(JSON.stringify(emails, null, 2));
} finally {
  await prisma.$disconnect();
}
