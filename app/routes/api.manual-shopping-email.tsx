import { requireTenantFeature } from "../lib/features.server";
import { prisma } from "../lib/prisma.server";
import { createManualShoppingMobileToken } from "../lib/manual-shopping-mobile.server";
import { sendShoppingListEmail } from "../lib/shopping-list-mail.server";

function result(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") return result({ error: "Methode nicht erlaubt." }, 405);
  const access = await requireTenantFeature(request, "PURCHASING");
  const form = await request.formData();
  const listId = String(form.get("listId") || "").trim();
  if (!listId || listId.length > 150) return result({ error: "Ungültige Liste." }, 400);
  const list = await prisma.manualShoppingList.findFirst({
    where: { id: listId, tenantId: access.tenantId },
    select: { id: true, title: true },
  });
  if (!list) return result({ error: "Einkaufsliste nicht gefunden." }, 404);
  const to = String(access.user?.email || "").trim();
  if (!to) return result({ error: "Keine E-Mail-Adresse im Gastario-Konto hinterlegt." }, 400);
  const base = process.env.GASTARIO_PUBLIC_URL || "https://gastario-app-production.up.railway.app";
  const url = new URL("/einkauf/mobil/" + encodeURIComponent(list.id), base);
  url.searchParams.set("token", createManualShoppingMobileToken(list.id));
  try {
    await sendShoppingListEmail({ to, title: list.title, url: url.toString() });
  } catch (error) {
    console.error("Einkaufslisten-Mail fehlgeschlagen", error);
    return result({ error: "E-Mail-Versand fehlgeschlagen. Bitte Mailjet-Einstellungen prüfen." }, 502);
  }
  return result({ success: true, recipient: to });
}
