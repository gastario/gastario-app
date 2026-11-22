import type { ActionFunctionArgs } from "react-router";
import { convertHeycaterA4ToZebra } from "../lib/heycater-a4-zebra.server";

function expectedCountFromFileName(filename: string): number | null {
  const found = String(filename).match(/(?:^|[_\s-])(\d{1,4})\s*(?:labels?|etiketten)(?=$|[_\s.\-])/i);
  if (!found) return null;
  const count = Number(found[1]);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { getUserId } = await import("../lib/session.server");
    const { prisma } = await import("../lib/prisma.server");
    const userId = await getUserId(request);
    if (!userId) return new Response("Bitte anmelden.", { status: 401 });
    const access = await prisma.tenantUser.findFirst({ where: { userId }, include: { tenant: true } });
    if (!access?.tenant) return new Response("Kein Betrieb gefunden.", { status: 403 });

    const form = await request.formData();
    const file = form.get("pdf");
    if (!(file instanceof File) || file.size === 0 || file.size > 20 * 1024 * 1024) {
      return new Response("Bitte eine Heycater-A4-PDF (max. 20 MB) hochladen.", { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") {
      return new Response("Die hochgeladene Datei ist keine PDF.", { status: 400 });
    }
    const expectedFromFileName = expectedCountFromFileName(file.name);
    const manualCount = Number(String(form.get("expectedCount") || "").trim());
    const expected = Number.isInteger(manualCount) && manualCount >= 1
      ? manualCount : expectedFromFileName;
    if (expected === null) {
      return new Response("SICHERHEITSSTOPP: Anzahl fehlt. Bitte Heycater-Datei mit Angabe wie '144labels' im Dateinamen hochladen oder die erwartete Anzahl eingeben.", { status: 422 });
    }
    const output = await convertHeycaterA4ToZebra(bytes, expected);
    return new Response(output.bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gastario-zebra-${output.count}-etiketten.pdf"`,
        "X-Label-Count": String(output.count),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unbekannter Importfehler";
    console.error("HEYCATER_A4_ZEBRA_IMPORT_FAILED", message);
    return new Response(`Etikettendruck gesperrt: ${message}`, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

export async function loader() {
  return new Response("Nur PDF-Upload per Formular erlaubt.", { status: 405 });
}
