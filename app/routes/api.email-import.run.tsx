import crypto from "node:crypto";
import { createRequire } from "node:module";
import { simpleParser } from "mailparser";
import { prisma } from "../lib/prisma.server";
import { extractHeycaterOrder } from "../lib/order-import-extract.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function decryptSecret(value: string) {
  const keyValue = process.env.IMAP_ENCRYPTION_KEY || "";

  if (!keyValue) {
    throw new Error("IMAP_ENCRYPTION_KEY fehlt.");
  }

  const [ivValue, tagValue, encryptedValue] = value.split(".");
  const key = Buffer.from(keyValue, "base64");
  const iv = Buffer.from(ivValue, "base64");
  const tag = Buffer.from(tagValue, "base64");
  const encrypted = Buffer.from(encryptedValue, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

function parseGermanDate(value: string) {
  const match = String(value || "").match(/^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/);

  if (!match) return null;

  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function createOrderNumber() {
  const now = new Date();
  const datePart =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  return "MAIL-" + datePart + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function hasEnoughOrderData(order: any) {
  return Boolean(
    order &&
      (
        order.customerName ||
        order.deliveryAddress ||
        order.deliveryDate ||
        (Array.isArray(order.items) && order.items.length > 0)
      )
  );
}

async function extractPdfText(buffer: Buffer) {
  const require = createRequire(import.meta.url);
  const pdfParseModule = require("pdf-parse");

  if (typeof pdfParseModule === "function") {
    const result = await pdfParseModule(buffer);
    return String(result.text || "").trim();
  }

  if (typeof pdfParseModule.default === "function") {
    const result = await pdfParseModule.default(buffer);
    return String(result.text || "").trim();
  }

  return "";
}

async function createReviewOrderFromExtracted(params: {
  tenantId: string;
  brandId?: string | null;
  incomingEmailId: string;
  extractedOrder: any;
}) {
  const { tenantId, brandId, incomingEmailId, extractedOrder } = params;

  const order = await prisma.order.create({
    data: {
      tenantId,
      brandId: brandId || null,
      incomingEmailId,
      orderNumber: createOrderNumber(),
      source: extractedOrder.source === "Heycater" ? "HEYCATER" : "EMAIL",
      status: "AUTO_CREATED",
      customerName: extractedOrder.customerName || "E-Mail Import",
      eventName: extractedOrder.presentation || null,
      deliveryDate: parseGermanDate(extractedOrder.deliveryDate),
      deliveryTimeText: extractedOrder.deliveryTime || null,
      deliveryAddress: extractedOrder.deliveryAddress || null,
      contactName: extractedOrder.contactName || null,
      contactPhone: extractedOrder.contactPhone || null,
      notes:
        "Automatisch aus E-Mail erkannt. Eventdatum: " +
        String(extractedOrder.eventDate || "-") +
        ", Eventbeginn: " +
        String(extractedOrder.eventStart || "-"),
      platformName: extractedOrder.source || "E-Mail",
      confidenceScore: 70,
      reviewReason: "Automatisch aus E-Mail erstellt. Bitte pruefen.",
      items: {
        create: Array.isArray(extractedOrder.items)
          ? extractedOrder.items.map((item: any) => ({
              tenantId,
              name: String(item.name || "Position"),
              quantity: Number(item.quantity || 1),
              unit: "Stueck",
              unitCents: Number(item.unitCents || 0),
              totalCents: Number(item.totalCents || 0),
              notes: [item.description, item.rawLine].filter(Boolean).join(" | ") || null,
            }))
          : [],
      },
    } as any,
  });

  const tour = await prisma.deliveryTour.create({
    data: {
      tenantId,
      name: "Import " + order.orderNumber,
      deliveryDate: parseGermanDate(extractedOrder.deliveryDate),
      status: "OPEN",
      notes: "Automatisch aus E-Mail-Import vorbereitet.",
    },
  });

  await prisma.deliveryStop.create({
    data: {
      tenantId,
      tourId: tour.id,
      orderId: order.id,
      plannedTime: extractedOrder.deliveryTime || null,
      status: "OPEN",
      notes: "Automatisch aus E-Mail-Import vorbereitet.",
    },
  });

  return order;
}

export async function loader({ request }: { request: Request }) {
  const secret = process.env.EMAIL_IMPORT_RUN_SECRET || "";
  const url = new URL(request.url);
  const givenSecret = url.searchParams.get("secret") || "";

  if (secret && givenSecret !== secret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const { ImapFlow } = await import("imapflow");

  const accounts = await prisma.emailAccount.findMany({
    where: {
      active: true,
      mode: "IMAP",
      imapHost: { not: null },
      imapPasswordEncrypted: { not: null },
    },
  });

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const result = {
    ok: true,
    accounts: accounts.length,
    checked: 0,
    savedEmails: 0,
    createdOrders: 0,
    skippedDuplicates: 0,
    errors: [] as string[],
  };

  for (const account of accounts) {
    try {
      const password = decryptSecret(account.imapPasswordEncrypted || "");

      const client = new ImapFlow({
        host: account.imapHost || "",
        port: account.imapPort || 993,
        secure: account.imapSecure ?? true,
        auth: {
          user: account.imapUsername || account.email,
          pass: password,
        },
        logger: false,
      });

      await client.connect();

      const lock = await client.getMailboxLock("INBOX");

      try {
        const uids = await client.search({ since });

        for await (const message of client.fetch(uids, {
          uid: true,
          envelope: true,
          source: true,
        })) {
          result.checked += 1;

          const parsed = await simpleParser(message.source as Buffer);
          const messageId = String(parsed.messageId || message.uid || "");

          const existing = await prisma.incomingEmail.findFirst({
            where: {
              tenantId: account.tenantId,
              OR: [
                { messageId },
                {
                  mailbox: account.email,
                  subject: String(parsed.subject || "(ohne Betreff)"),
                  sender: String(parsed.from?.text || ""),
                },
              ],
            },
          });

          if (existing) {
            result.skippedDuplicates += 1;
            continue;
          }

          const incomingEmail = await prisma.incomingEmail.create({
            data: {
              tenantId: account.tenantId,
              emailAccountId: account.id,
              brandId: account.brandId || null,
              mailbox: account.email,
              sender: String(parsed.from?.text || ""),
              subject: String(parsed.subject || "(ohne Betreff)"),
              bodyText: String(parsed.text || ""),
              source: "EMAIL" as any,
              status: "RECEIVED" as any,
              messageId,
              extractedJson: {
                uid: message.uid,
                date: parsed.date?.toISOString?.() || null,
                from: parsed.from?.text || null,
                to: parsed.to?.text || null,
                subject: parsed.subject || null,
              },
            },
          });

          result.savedEmails += 1;

          let bestText = String(parsed.text || "");

          for (const attachment of parsed.attachments || []) {
            let attachmentText = "";

            if (
              attachment.contentType === "application/pdf" ||
              String(attachment.filename || "").toLowerCase().endsWith(".pdf")
            ) {
              attachmentText = await extractPdfText(Buffer.from(attachment.content));
              bestText = attachmentText || bestText;
            }

            await prisma.emailAttachment.create({
              data: {
                incomingEmailId: incomingEmail.id,
                filename: attachment.filename || "attachment",
                mimeType: attachment.contentType || null,
                textContent: attachmentText || null,
                extractedJson: {
                  size: attachment.size,
                  contentType: attachment.contentType,
                },
              },
            });
          }

          const extractedOrder = extractHeycaterOrder(bestText);

          if (hasEnoughOrderData(extractedOrder)) {
            const order = await createReviewOrderFromExtracted({
              tenantId: account.tenantId,
              brandId: account.brandId,
              incomingEmailId: incomingEmail.id,
              extractedOrder,
            });

            await prisma.incomingEmail.update({
              where: { id: incomingEmail.id },
              data: {
                status: "ORDER_CREATED" as any,
                processedAt: new Date(),
                extractedJson: extractedOrder,
              },
            });

            result.createdOrders += 1;
          } else {
            await prisma.incomingEmail.update({
              where: { id: incomingEmail.id },
              data: {
                status: "REVIEW_NEEDED" as any,
                processedAt: new Date(),
                errorMessage: "Keine ausreichenden Auftragsdaten erkannt.",
              },
            });
          }
        }

        await prisma.emailAccount.update({
          where: { id: account.id },
          data: {
            imapLastCheckedAt: new Date(),
          },
        });
      } finally {
        lock.release();
        await client.logout();
      }
    } catch (error: any) {
      result.errors.push(account.email + ": " + String(error?.message || error));
    }
  }

  return json(result);
}
