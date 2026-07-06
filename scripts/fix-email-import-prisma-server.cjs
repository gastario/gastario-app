const fs = require("fs");

const path = "app/routes/api.email-import.run.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  'import { prisma } from "../lib/prisma.server";\n',
  ""
);

content = content.replace(
`async function findExistingHeycaterOrderByExternalNumber(tenantId: string, heycaterOrderNumber: string) {
  if (!heycaterOrderNumber) {`,
`async function findExistingHeycaterOrderByExternalNumber(tenantId: string, heycaterOrderNumber: string) {
  const { prisma } = await import("../lib/prisma.server");

  if (!heycaterOrderNumber) {`
);

content = content.replace(
`async function createReviewOrderFromExtracted(params: {
  tenantId: string;
  brandId?: string | null;
  incomingEmailId: string;
  extractedOrder: any;
}) {
  const { tenantId, brandId, incomingEmailId, extractedOrder } = params;`,
`async function createReviewOrderFromExtracted(params: {
  tenantId: string;
  brandId?: string | null;
  incomingEmailId: string;
  extractedOrder: any;
}) {
  const { prisma } = await import("../lib/prisma.server");
  const { tenantId, brandId, incomingEmailId, extractedOrder } = params;`
);

content = content.replace(
`  const { ImapFlow } = await import("imapflow");

  const accounts = await prisma.emailAccount.findMany({`,
`  const { ImapFlow } = await import("imapflow");
  const { prisma } = await import("../lib/prisma.server");

  const accounts = await prisma.emailAccount.findMany({`
);

fs.writeFileSync(path, content, "utf8");
console.log("Prisma-Import in api.email-import.run.tsx server-sicher gemacht.");
