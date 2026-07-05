const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TYPE "IncomingEmailStatus" ADD VALUE IF NOT EXISTS 'IGNORED';
  `);

  console.log("IncomingEmailStatus wurde in der Datenbank um IGNORED erweitert.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
