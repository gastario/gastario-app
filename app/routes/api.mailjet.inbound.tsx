import { prisma } from "../lib/prisma.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function cleanEmail(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const angleMatch = raw.match(/<([^>]+)>/);
  const email = angleMatch ? angleMatch[1] : raw.split(",")[0];

  return email.trim().toLowerCase();
}

function pickFirstEmail(payload: any) {
  const candidates = [
    payload.Recipient,
    payload.To,
    payload.Cc,
    payload.Mailbox,
    payload.recipient,
    payload.to,
    payload.mailbox,
  ];

  for (const candidate of candidates) {
    const email = cleanEmail(candidate);

    if (email) {
      return email;
    }
  }

  if (Array.isArray(payload.Recipients) && payload.Recipients.length) {
    const email = cleanEmail(payload.Recipients[0]?.Email || payload.Recipients[0]);

    if (email) {
      return email;
    }
  }

  return "";
}

function pickSender(payload: any) {
  return cleanEmail(
    payload.Sender ||
      payload.From ||
      payload.sender ||
      payload.from ||
      payload["FromEmail"]
  );
}

async function readPayload(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await request.json();
  }

  const formData = await request.formData();
  const payload: Record<string, any> = {};

  for (const [key, value] of formData.entries()) {
    payload[key] = typeof value === "string" ? value : value.name;
  }

  return payload;
}

export async function loader() {
  return json({
    ok: true,
    route: "mailjet-inbound",
  });
}

export async function action({ request }: { request: Request }) {
  try {
    const secret = process.env.MAILJET_INBOUND_SECRET || "";
    const url = new URL(request.url);
    const givenSecret =
      url.searchParams.get("secret") ||
      request.headers.get("x-mailjet-webhook-secret") ||
      "";

    if (secret && givenSecret !== secret) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const payload = await readPayload(request);

    const mailbox = pickFirstEmail(payload);
    const sender = pickSender(payload);
    const subject = String(payload.Subject || payload.subject || "(ohne Betreff)");
    const bodyText = String(
      payload["Text-part"] ||
        payload.TextPart ||
        payload.text ||
        payload.Body ||
        payload.body ||
        ""
    );

    if (!mailbox) {
      return json({ ok: false, error: "Keine Empfaengeradresse gefunden." }, 400);
    }

    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        email: {
          equals: mailbox,
          mode: "insensitive",
        },
        active: true,
      },
    });

    if (!emailAccount) {
      return json({
        ok: false,
        error: "Keine EmailAccount-Zuordnung gefunden.",
        mailbox,
      }, 404);
    }

    const incomingEmail = await prisma.incomingEmail.create({
      data: {
        tenantId: emailAccount.tenantId,
        emailAccountId: emailAccount.id,
        brandId: emailAccount.brandId || null,
        mailbox,
        sender,
        subject,
        bodyText,
        source: "EMAIL" as any,
        status: "RECEIVED" as any,
        messageId: String(payload.MessageID || payload.MessageId || payload["Message-ID"] || ""),
        extractedJson: payload,
      },
    });

    const rawAttachments =
      Array.isArray(payload.Attachments)
        ? payload.Attachments
        : Array.isArray(payload.attachments)
          ? payload.attachments
          : [];

    for (const attachment of rawAttachments) {
      await prisma.emailAttachment.create({
        data: {
          incomingEmailId: incomingEmail.id,
          filename: String(
            attachment.Filename ||
              attachment.FileName ||
              attachment.filename ||
              "attachment"
          ),
          mimeType: String(
            attachment.ContentType ||
              attachment.contentType ||
              attachment.mimeType ||
              ""
          ) || null,
          fileUrl: String(
            attachment.Url ||
              attachment.url ||
              attachment.DownloadUrl ||
              ""
          ) || null,
          textContent: String(
            attachment.TextContent ||
              attachment.textContent ||
              ""
          ) || null,
          extractedJson: attachment,
        },
      });
    }

    return json({
      ok: true,
      incomingEmailId: incomingEmail.id,
      tenantId: emailAccount.tenantId,
      mailbox,
      subject,
      attachmentCount: rawAttachments.length,
    });
  } catch (error: any) {
    console.error("Mailjet inbound failed:", error);

    return json({
      ok: false,
      error: String(error?.message || error),
    }, 500);
  }
}
