type SendPasswordResetEmailInput = {
  to: string;
  name?: string | null;
  resetUrl: string;
  expiresInMinutes: number;
};

function readRequiredEnvironmentVariable(name: string) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`Die Umgebungsvariable ${name} fehlt.`);
  }

  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isPasswordResetMailConfigured() {
  return Boolean(
    String(process.env.MAILJET_API_KEY || "").trim() &&
      String(process.env.MAILJET_SECRET_KEY || "").trim() &&
      String(
        process.env.MAILJET_FROM_EMAIL ||
          process.env.MAIL_FROM_EMAIL ||
          ""
      ).trim()
  );
}

export async function sendPasswordResetEmail(
  input: SendPasswordResetEmailInput
) {
  const apiKey = readRequiredEnvironmentVariable(
    "MAILJET_API_KEY"
  );

  const secretKey = readRequiredEnvironmentVariable(
    "MAILJET_SECRET_KEY"
  );

  const fromEmail = String(
    process.env.MAILJET_FROM_EMAIL ||
      process.env.MAIL_FROM_EMAIL ||
      ""
  ).trim();

  if (!fromEmail) {
    throw new Error(
      "Die Umgebungsvariable MAIL_FROM_EMAIL fehlt."
    );
  }

  const fromName =
    String(
      process.env.MAILJET_FROM_NAME ||
        process.env.MAIL_FROM_NAME ||
        ""
    ).trim() || "Gastario";

  const recipientName =
    String(input.name || "").trim() || "Gastario Nutzer";

  const safeName = escapeHtml(recipientName);
  const safeResetUrl = escapeHtml(input.resetUrl);

  const textPart = [
    `Hallo ${recipientName},`,
    "",
    "für dein Gastario-Konto wurde das Zurücksetzen des Passworts angefordert.",
    "",
    `Öffne innerhalb von ${input.expiresInMinutes} Minuten diesen Link:`,
    input.resetUrl,
    "",
    "Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.",
    "",
    "Viele Grüße",
    "Dein Gastario-Team",
  ].join("\n");

  const htmlPart = `
    <!doctype html>
    <html lang="de">
      <body style="margin:0;padding:0;background:#f3f8f6;font-family:Arial,sans-serif;color:#173c36;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f8f6;padding:32px 14px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d8e7e3;border-radius:20px;">
                <tr>
                  <td style="padding:38px;">
                    <div style="font-size:24px;font-weight:700;color:#08715c;margin-bottom:30px;">
                      Gastario
                    </div>

                    <h1 style="margin:0 0 16px;font-size:29px;line-height:1.2;color:#173c36;">
                      Passwort neu setzen
                    </h1>

                    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#607571;">
                      Hallo ${safeName}, für dein Gastario-Konto wurde das Zurücksetzen des Passworts angefordert.
                    </p>

                    <p style="margin:0 0 25px;font-size:15px;line-height:1.65;color:#607571;">
                      Der folgende Link ist einmalig verwendbar und läuft nach
                      ${input.expiresInMinutes} Minuten ab.
                    </p>

                    <a
                      href="${safeResetUrl}"
                      style="display:block;padding:16px 20px;border-radius:13px;background:#08715c;color:#ffffff;text-decoration:none;text-align:center;font-size:15px;font-weight:600;"
                    >
                      Neues Passwort festlegen
                    </a>

                    <p style="margin:26px 0 8px;font-size:12px;line-height:1.55;color:#81928f;">
                      Funktioniert der Button nicht, kopiere diesen Link:
                    </p>

                    <p style="margin:0;font-size:12px;line-height:1.55;color:#08715c;word-break:break-all;">
                      ${safeResetUrl}
                    </p>

                    <div style="height:1px;background:#e5efec;margin:30px 0;"></div>

                    <p style="margin:0;font-size:13px;line-height:1.6;color:#81928f;">
                      Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const authorization = Buffer.from(
    `${apiKey}:${secretKey}`,
    "utf8"
  ).toString("base64");

  const response = await fetch(
    "https://api.mailjet.com/v3.1/send",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: fromEmail,
              Name: fromName,
            },
            To: [
              {
                Email: input.to,
                Name: recipientName,
              },
            ],
            Subject: "Gastario Passwort zurücksetzen",
            TextPart: textPart,
            HTMLPart: htmlPart,
          },
        ],
      }),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Mailjet-Versand fehlgeschlagen (${response.status}): ` +
        responseText.slice(0, 500)
    );
  }

  let responseData: any = null;

  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = null;
  }

  const messageStatus =
    responseData?.Messages?.[0]?.Status;

  if (messageStatus && messageStatus !== "success") {
    throw new Error(
      "Mailjet hat die Nachricht nicht als erfolgreich bestätigt."
    );
  }
}