import {
  renderProcurementOrderPdf,
} from "./procurement-order-pdf.server";

type ProcurementOrderMailInput = {
  tenantName: string;
  replyTo?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  message: string;
  draft: any;
};

function readRequiredEnvironmentVariable(
  name: string
) {
  const value = String(
    process.env[name] || ""
  ).trim();

  if (!value) {
    throw new Error(
      `Die Umgebungsvariable ${name} fehlt.`
    );
  }

  return value;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendProcurementOrderEmail(
  input: ProcurementOrderMailInput
) {
  const apiKey = readRequiredEnvironmentVariable(
    "MAILJET_API_KEY"
  );

  const secretKey =
    readRequiredEnvironmentVariable(
      "MAILJET_SECRET_KEY"
    );

  const fromEmail = String(
    process.env.MAILJET_FROM_EMAIL ||
      process.env.MAIL_FROM_EMAIL ||
      ""
  ).trim();

  if (!fromEmail) {
    throw new Error(
      "MAILJET_FROM_EMAIL oder MAIL_FROM_EMAIL fehlt."
    );
  }

  const fromName =
    String(
      process.env.MAILJET_FROM_NAME ||
        process.env.MAIL_FROM_NAME ||
        ""
    ).trim() || input.tenantName;

  const pdfData =
    await renderProcurementOrderPdf({
      tenantName: input.tenantName,
      supplierName:
        input.draft.supplierName,
      planningDate:
        input.draft.planningDate,
      planType: input.draft.planType,
      status: input.draft.status,
      createdAt: input.draft.createdAt,
      orderedAt: input.draft.orderedAt,
      receivedAt:
        input.draft.receivedAt,
      netTotalCents:
        input.draft.netTotalCents,
      items: input.draft.items.map(
        (item: any) => ({
          ingredientName:
            item.ingredientName,
          catalogItemName:
            item.catalogItemName,
          articleNumber:
            item.articleNumber,
          packageCount:
            item.packageCount,
          packContent:
            item.packContent,
          baseUnit:
            item.baseUnit,
          netUnitPriceCents:
            item.netUnitPriceCents,
          netTotalCents:
            item.netTotalCents,
        })
      ),
    });

  const dateText = new Date(
    input.draft.planningDate
  )
    .toISOString()
    .slice(0, 10);

  const safeSupplier = String(
    input.draft.supplierName ||
      "lieferant"
  )
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  const textPart = String(
    input.message || ""
  ).trim();

  const htmlPart = `
    <div style="font-family:Arial,sans-serif;color:#173f37;line-height:1.55">
      ${textPart
        .split("\n")
        .map(
          (line) =>
            `<div>${
              line
                ? escapeHtml(line)
                : "&nbsp;"
            }</div>`
        )
        .join("")}
    </div>
  `;

  const authorization = Buffer.from(
    `${apiKey}:${secretKey}`,
    "utf8"
  ).toString("base64");

  const message: any = {
    From: {
      Email: fromEmail,
      Name: fromName,
    },
    To: [
      {
        Email: input.recipientEmail,
        Name:
          input.recipientName ||
          input.draft.supplierName,
      },
    ],
    Subject: input.subject,
    TextPart: textPart,
    HTMLPart: htmlPart,
    Attachments: [
      {
        ContentType: "application/pdf",
        Filename:
          `einkaufsbestellung-${safeSupplier}-${dateText}.pdf`,
        Base64Content:
          pdfData.toString("base64"),
      },
    ],
  };

  if (input.replyTo) {
    message.ReplyTo = {
      Email: input.replyTo,
      Name: input.tenantName,
    };
  }

  const response = await fetch(
    "https://api.mailjet.com/v3.1/send",
    {
      method: "POST",
      headers: {
        Authorization:
          `Basic ${authorization}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        Messages: [message],
      }),
    }
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Mailjet-Versand fehlgeschlagen (${response.status}): ${responseText.slice(
        0,
        500
      )}`
    );
  }

  let responseData: any = null;

  try {
    responseData =
      JSON.parse(responseText);
  } catch {
    responseData = null;
  }

  const messageResult =
    responseData?.Messages?.[0];

  if (
    messageResult?.Status &&
    messageResult.Status !== "success"
  ) {
    throw new Error(
      "Mailjet hat die Bestellung nicht als erfolgreich versendet bestätigt."
    );
  }

  return {
    messageId:
      messageResult?.To?.[0]
        ?.MessageID ||
      messageResult?.To?.[0]
        ?.MessageUUID ||
      null,
  };
}