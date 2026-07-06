process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const emails = await prisma.incomingEmail.findMany({
    where: {
      OR: [
        { subject: { contains: "Partner Event Confirmation", mode: "insensitive" } },
        { subject: { contains: "Fast Track Order", mode: "insensitive" } },
        { subject: { contains: "Auftragsbest", mode: "insensitive" } }
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      subject: true,
      sender: true,
      status: true,
      errorMessage: true,
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
