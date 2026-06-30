const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "info@gastario.de";
  const password = "Sikerimlanben21.";
  const name = "Gastario Super Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      platformRole: "SUPER_ADMIN",
    },
    create: {
      name,
      email,
      passwordHash,
      platformRole: "SUPER_ADMIN",
    },
  });

  console.log("Super Admin erstellt/aktualisiert:");
  console.log("E-Mail:", email);
  console.log("Platform Role:", user.platformRole);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
