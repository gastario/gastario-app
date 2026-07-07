import crypto from "node:crypto";
import { createRequire } from "node:module";
import { simpleParser } from "mailparser";
import { prisma } from "../lib/prisma.server";
import { extractUniversalOrder } from "../lib/order-import-extract.server";

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
  if (!order) return false;

  const items = Array.isArray(order.items) ? order.items : [];
  const realItems = items.filter((item: any) => {
    const name = String(item?.name || "").trim().toLowerCase();
    const totalCents = Number(item?.totalCents || 0);
    const quantity = Number(item?.quantity || 0);

    if (!name) return false;
    if (name.includes("lieferkosten")) return false;
    if (name.includes("lieferung")) return false;
    if (name.includes("summe")) return false;
    if (name.includes("netto")) return false;
    if (name.includes("brutto")) return false;
    if (name.includes("rabatt")) return false;
    if (name.includes("gutschein")) return false;

    return quantity > 0 && totalCents > 0;
  });

  const customerName = String(order.customerName || "").trim();
  const deliveryAddress = String(order.deliveryAddress || "").trim();
  const deliveryDate = String(order.deliveryDate || "").trim();
  const deliveryTime = String(order.deliveryTime || "").trim();

  const hasRealCustomer =
    Boolean(customerName) &&
    customerName.toLowerCase() !== "e-mail import" &&
    customerName.toLowerCase() !== "heycater" &&
    customerName.toLowerCase() !== "unbekannt";

  const totalCents = realItems.reduce((sum: number, item: any) => {
    return sum + Number(item?.totalCents || 0);
  }, 0);

  return Boolean(
    hasRealCustomer &&
    deliveryDate &&
    deliveryTime &&
    deliveryAddress &&
    realItems.length > 0 &&
    totalCents > 0
  );
}


function normalizeImportText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getHeycaterOrderNumber(...values: unknown[]) {
  const text = values.map((value) => String(value || "")).join("\n");
  const match = text.match(/\b(20[0-9]{2}-[0-9]{5,})\b/);
  return match?.[1] || "";
}

function getHeycaterEmailKind(subject: string, text: string) {
  const combined = normalizeImportText(subject + "\n" + text);

  const isDeliveryNote =
    combined.includes("delivery note") ||
    combined.includes("lieferschein") ||
    combined.includes("dein morgiges catering") ||
    combined.includes("dein morgiges heykantine") ||
    combined.includes("morgiges catering mit heycater") ||
    combined.includes("morgiges heykantine");

  const isConfirmation =
    combined.includes("partner event confirmation") ||
    combined.includes("event confirmation") ||
    combined.includes("order confirmation") ||
    combined.includes("fast track order bestatigt") ||
    combined.includes("fast track order bestaetigt") ||
    combined.includes("order bestatigt") ||
    combined.includes("order bestaetigt") ||
    combined.includes("auftrag bestatigt") ||
    combined.includes("auftrag bestaetigt") ||
    combined.includes("auftragsbestatigung") ||
    combined.includes("auftragsbestaetigung") ||
    combined.includes("angebotsbestatigung") ||
    combined.includes("angebotsbestaetigung");

  const isRequestOrOffer =
    combined.includes("bitte auftrag bestatigen") ||
    combined.includes("bitte auftrag bestaetigen") ||
    combined.includes("angebot freigeben") ||
    combined.includes("bitte angebot freigeben") ||
    combined.includes("angebot erstellen") ||
    combined.includes("bitte angebot") ||
    combined.includes("anfrage") ||
    combined.includes("angebotsanfrage") ||
    combined.includes("catering anfrage");

  return {
    isDeliveryNote,
    isConfirmation,
    isRequestOrOffer,
  };
}

function parseImportMoneyToCents(value: unknown) {
  const raw = String(value || "")
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

function extractHeycaterPdfNetCents(text: string) {
  const match = String(text || "").match(/Gesamtbetrag\s+Netto\s+€\s*([0-9]+(?:[.,][0-9]+)?)/i);
  return match ? parseImportMoneyToCents(match[1]) : 0;
}

function getItemsWithHeycaterSumCorrection(extractedOrder: any, bestText: string) {
  const baseItems = Array.isArray(extractedOrder?.items) ? extractedOrder.items : [];
  const source = String(extractedOrder?.source || "").toLowerCase();
  const pdfNetCents = extractHeycaterPdfNetCents(bestText);

  const itemTotalCents = baseItems.reduce((sum: number, item: any) => {
    return sum + Number(item?.totalCents || 0);
  }, 0);

  const differenceCents = pdfNetCents - itemTotalCents;

  if (
    source === "heycater" &&
    pdfNetCents > 0 &&
    itemTotalCents > 0 &&
    differenceCents > 2
  ) {
    return [
      ...baseItems,
      {
        name: "Fehlende Position(en) laut Heycater-PDF",
        quantity: 1,
        unitCents: differenceCents,
        totalCents: differenceCents,
        description:
          "Automatische Kontrollposition, damit die Summe mit dem Gesamtbetrag Netto aus der Heycater-PDF uebereinstimmt.",
        rawLine:
          "Heycater Gesamtbetrag Netto: " +
          (pdfNetCents / 100).toFixed(2) +
          " EUR | erkannte Positionen: " +
          (itemTotalCents / 100).toFixed(2) +
          " EUR | Differenz: " +
          (differenceCents / 100).toFixed(2) +
          " EUR",
      },
    ];
  }

  return baseItems;
}

async function findExistingHeycaterOrderByExternalNumber(tenantId: string, heycaterOrderNumber: string) {
  const { prisma } = await import("../lib/prisma.server");

  if (!heycaterOrderNumber) {
    return null;
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT o.id, o."orderNumber", o.status
      FROM "Order" o
      LEFT JOIN "IncomingEmail" e ON e.id = o."incomingEmailId"
      WHERE o."tenantId" = $1
        AND o.source = 'HEYCATER'
        AND (
          e.subject ILIKE $2
          OR o.notes ILIKE $2
          OR o."reviewReason" ILIKE $2
        )
      ORDER BY o."createdAt" ASC
      LIMIT 1
    `,
    tenantId,
    "%" + heycaterOrderNumber + "%"
  );

  return rows[0] || null;
}

function getEmailImportDecision(params: {
  subject: string;
  bestText: string;
  extractedOrder: any;
  existingHeycaterOrder: any;
}) {
  const { subject, bestText, extractedOrder, existingHeycaterOrder } = params;
  const heycaterOrderNumber = getHeycaterOrderNumber(subject, bestText);
  const kind = getHeycaterEmailKind(subject, bestText);

  if (heycaterOrderNumber && kind.isDeliveryNote) {
    return {
      shouldCreateOrder: false,
      heycaterOrderNumber,
      reason: existingHeycaterOrder
        ? "Heycater-Lieferschein erkannt. Kein neuer Auftrag erstellt, weil die Heycater-Auftragsnummer bereits vorhanden ist."
        : "Heycater-Lieferschein erkannt. Kein automatischer Auftrag erstellt, weil Lieferscheine keine Preise enthalten. Bitte Auftragsbestaetigung importieren oder manuell pruefen.",
    };
  }

  if (heycaterOrderNumber && existingHeycaterOrder) {
    return {
      shouldCreateOrder: false,
      heycaterOrderNumber,
      reason: "Heycater-Auftragsnummer bereits vorhanden. Keine Dublette erstellt.",
    };
  }

  return {
    shouldCreateOrder: hasEnoughOrderData(extractedOrder),
    heycaterOrderNumber,
    reason: "",
  };
}


async function extractPdfText(buffer: Buffer) {
  let parser: any = null;

  try {
    if (!buffer || buffer.length === 0) {
      return {
        text: "",
        error: "PDF_BUFFER_EMPTY",
      };
    }

    const require = createRequire(import.meta.url);
    const pdfParseModule = require("pdf-parse");

    const pagerender = async (pageData: any) => {
      const textContent = await pageData.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      const items = Array.isArray(textContent?.items) ? textContent.items : [];

      return items
        .map((item: any) => String(item?.str || "").trim())
        .filter(Boolean)
        .join(" ") + "\n\n";
    };

    let result: any = null;

    if (typeof pdfParseModule === "function") {
      result = await pdfParseModule(buffer, { pagerender });
    } else if (typeof pdfParseModule.default === "function") {
      result = await pdfParseModule.default(buffer, { pagerender });
    } else if (typeof pdfParseModule.PDFParse === "function") {
      parser = new pdfParseModule.PDFParse({ data: buffer });
      result = await parser.getText();
    } else {
      return {
        text: "",
        error: "PDF_PARSE_FUNCTION_NOT_FOUND exports=" + Object.keys(pdfParseModule || {}).join(","),
      };
    }

    const text = String(result?.text || "")
      .replace(/\u0000/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      text,
      error: null,
    };
  } catch (error: any) {
    return {
      text: "",
      error: String(error?.message || error),
    };
  } finally {
    if (parser && typeof parser.destroy === "function") {
      await parser.destroy();
    }
  }
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
          ? extractedOrder.items.map((item: any) => ({              name: String(item.name || "Position"),
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
    pdfAttachments: 0,
    pdfTextExtracted: 0,
    pdfTextEmpty: 0,
    pdfErrors: [] as string[],
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
            include: {
              attachments: true,
              orders: {
                select: {
                  id: true,
                },
              },
            },
          });

          if (existing) {
            result.skippedDuplicates += 1;

            let bestText = String(existing.bodyText || parsed.text || "");

            for (const attachment of parsed.attachments || []) {
              let attachmentText = "";

              if (
                attachment.contentType === "application/pdf" ||
                String(attachment.filename || "").toLowerCase().endsWith(".pdf")
              ) {
                result.pdfAttachments += 1;

                const pdfResult = await extractPdfText(Buffer.from(attachment.content));
                attachmentText = pdfResult.text;

                if (attachmentText) {
                  result.pdfTextExtracted += 1;
                } else {
                  result.pdfTextEmpty += 1;
                }

                if (pdfResult.error) {
                  result.pdfErrors.push(String(attachment.filename || "attachment") + ": " + pdfResult.error);
                }

                bestText = attachmentText || bestText;
              }

              const filename = attachment.filename || "attachment";

              const savedAttachment = existing.attachments.find((item: any) => {
                return item.filename === filename;
              });

              if (savedAttachment) {
                if (attachmentText && !savedAttachment.textContent) {
                  await prisma.emailAttachment.update({
                    where: {
                      id: savedAttachment.id,
                    },
                    data: {
                      textContent: attachmentText,
                      extractedJson: {
                        size: attachment.size,
                        contentType: attachment.contentType,
                        pdfTextLength: attachmentText.length,
                        pdfTextError: attachmentText ? null : "PDF_TEXT_EMPTY",
                        reprocessedAt: new Date().toISOString(),
                      },
                    },
                  });
                }
              } else {
                await prisma.emailAttachment.create({
                  data: {
                    incomingEmailId: existing.id,
                    filename,
                    mimeType: attachment.contentType || null,
                    textContent: attachmentText || null,
                    extractedJson: {
                      size: attachment.size,
                      contentType: attachment.contentType,
                      pdfTextLength: attachmentText.length,
                      pdfTextError: attachmentText ? null : "PDF_TEXT_EMPTY",
                      reprocessedAt: new Date().toISOString(),
                    },
                  },
                });
              }
            }

            const extractedOrder = extractUniversalOrder(bestText);

            if (existing.orders.length === 0 && hasEnoughOrderData(extractedOrder)) {
              await createReviewOrderFromExtracted({
                tenantId: account.tenantId,
                brandId: account.brandId,
                incomingEmailId: existing.id,
                extractedOrder,
              });

              await prisma.incomingEmail.update({
                where: { id: existing.id },
                data: {
                  status: "ORDER_CREATED" as any,
                  processedAt: new Date(),
                  extractedJson: extractedOrder,
                  errorMessage: null,
                },
              });

              result.createdOrders += 1;
            } else if (existing.orders.length === 0) {
              await prisma.incomingEmail.update({
                where: { id: existing.id },
                data: {
                  status: "REVIEW_NEEDED" as any,
                  processedAt: new Date(),
                  extractedJson: extractedOrder || undefined,
                  errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",
                },
              });
            }

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
              result.pdfAttachments += 1;

              const pdfResult = await extractPdfText(Buffer.from(attachment.content));
              attachmentText = pdfResult.text;

              if (attachmentText) {
                result.pdfTextExtracted += 1;
              } else {
                result.pdfTextEmpty += 1;
              }

              if (pdfResult.error) {
                result.pdfErrors.push(String(attachment.filename || "attachment") + ": " + pdfResult.error);
              }

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
                  pdfTextLength: attachmentText.length,
                  pdfTextError: attachmentText ? null : "PDF_TEXT_EMPTY",
                },
              },
            });
          }

          const extractedOrder = extractUniversalOrder(bestText);

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
                errorMessage: "Nicht automatisch als Auftrag erstellt: Daten nicht eindeutig genug. Bitte im Auftragseingang pruefen.",
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









