import { isPasswordResetMailConfigured } from "./password-reset-mail.server";

export async function sendShoppingListEmail(input: { to: string; title: string; url: string }) {
  if (!isPasswordResetMailConfigured()) throw new Error("Mailjet ist nicht konfiguriert.");
  const key = String(process.env.MAILJET_API_KEY || "").trim();
  const secret = String(process.env.MAILJET_SECRET_KEY || "").trim();
  const from = String(process.env.MAILJET_FROM_EMAIL || process.env.MAIL_FROM_EMAIL || "").trim();
  const name = String(process.env.MAILJET_FROM_NAME || process.env.MAIL_FROM_NAME || "Gastario").trim();
  const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Messages: [{
        From: { Email: from, Name: name },
        To: [{ Email: input.to }],
        Subject: "Gastario Einkaufsliste: " + input.title.slice(0, 90),
        TextPart: ["Deine Gastario-Einkaufsliste: " + input.title, "", "Auf dem iPhone öffnen:", input.url, "", "Dort auf „In Notizen teilen“ tippen.", "", "Bitte diesen privaten Link nicht weiterleiten."].join("\n"),
        HTMLPart: '<div style="font-family:Arial,sans-serif;color:#173c36;padding:24px"><h2>Deine Gastario-Einkaufsliste</h2><p>' + escape(input.title) + '</p><p>Öffne die Liste auf deinem iPhone und tippe anschließend auf „In Notizen teilen“.</p><p><a style="background:#08715c;color:white;padding:14px 20px;display:inline-block;text-decoration:none;border-radius:10px" href="' + escape(input.url) + '">Einkaufsliste öffnen</a></p><p style="font-size:12px">Dieser private Link ermöglicht Zugriff auf die Liste. Bitte nicht weiterleiten.</p></div>',
      }],
    }),
  });
  if (!response.ok) throw new Error("Mailjet HTTP " + response.status);
  const data: any = await response.json();
  if (data?.Messages?.[0]?.Status !== "success") throw new Error("Mailjet hat den Versand nicht bestätigt.");
}
