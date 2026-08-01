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

  const logoUrl = new URL(
    "/brand/gastario-logo-full.png",
    input.resetUrl
  ).toString();

  const safeLogoUrl = escapeHtml(logoUrl);

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
      <body style="margin:0;padding:0;background:#eff6f3;font-family:Arial,Helvetica,sans-serif;color:#173c36;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eff6f3;padding:32px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:580px;background:#ffffff;border:1px solid #d7e7e2;border-radius:24px;overflow:hidden;">
                <tr>
                  <td style="height:8px;background:#0c8065;font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <tr>
                  <td style="padding:38px 38px 34px;">
                    <div style="text-align:center;margin-bottom:29px;">
                      <img
                        src="${safeLogoUrl}"
                        alt="Gastario"
                        width="184"
                        style="display:block;width:184px;max-width:70%;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;"
                      />
                    </div>

                    <div style="margin:0 0 10px;text-align:center;color:#0c8065;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                      Gastario Zugang
                    </div>

                    <h1 style="margin:0 0 18px;text-align:center;color:#173c36;font-size:30px;line-height:38px;font-weight:700;">
                      Passwort neu setzen
                    </h1>

                    <p style="margin:0 0 17px;color:#607571;font-size:15px;line-height:25px;">
                      Hallo ${safeName},
                    </p>

                    <p style="margin:0 0 20px;color:#607571;font-size:15px;line-height:25px;">
                      für dein Gastario-Konto wurde das Zurücksetzen des Passworts angefordert. Über den folgenden Button kannst du ein neues Passwort festlegen.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 25px;">
                      <tr>
                        <td align="center">
                          <a
                            href="${safeResetUrl}"
                            style="display:inline-block;min-width:230px;padding:16px 24px;border-radius:13px;background:#08715c;color:#ffffff;text-decoration:none;text-align:center;font-size:15px;line-height:20px;font-weight:700;"
                          >
                            Neues Passwort festlegen
                          </a>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:#f5faf8;border:1px solid #dceae6;border-radius:15px;">
                      <tr>
                        <td style="padding:16px 18px;">
                          <div style="margin:0 0 5px;color:#31504b;font-size:13px;line-height:20px;font-weight:700;">
                            Sicherer Einmal-Link
                          </div>

                          <div style="color:#667b77;font-size:13px;line-height:21px;">
                            Dieser Link ist nur einmal verwendbar und läuft nach
                            <strong style="color:#31504b;">${input.expiresInMinutes} Minuten</strong>
                            automatisch ab.
                          </div>
                        </td>
                      </tr>
                    </table>

                    <div style="height:1px;margin:0 0 23px;background:#e5efec;font-size:0;line-height:0;">&nbsp;</div>

                    <p style="margin:0 0 8px;color:#81928f;font-size:12px;line-height:19px;">
                      Funktioniert der Button nicht, kopiere diesen Link in deinen Browser:
                    </p>

                    <p style="margin:0 0 24px;color:#08715c;font-size:12px;line-height:19px;word-break:break-all;">
                      <a href="${safeResetUrl}" style="color:#08715c;text-decoration:none;">
                        ${safeResetUrl}
                      </a>
                    </p>

                    <p style="margin:0;color:#81928f;font-size:13px;line-height:21px;">
                      Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail einfach ignorieren. Dein bisheriges Passwort bleibt unverändert.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 28px;background:#f7fbfa;text-align:center;color:#8a9b97;font-size:12px;line-height:19px;">
                    Diese Nachricht wurde automatisch von Gastario versendet.
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