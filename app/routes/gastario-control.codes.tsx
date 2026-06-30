
import { Form, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return "GASTARIO-" + part() + "-" + part() + "-" + part();
}

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const codes = await prisma.registrationInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  }).catch(() => []);

  return { codes };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "create") {
    const code = generateInviteCode();

    await prisma.registrationInvite.create({
      data: {
        code,
      },
    });

    return { success: "Code wurde erstellt.", code };
  }

  const inviteId = String(formData.get("inviteId") || "");

  if (intent === "delete" && inviteId) {
    await prisma.registrationInvite.delete({ where: { id: inviteId } });
    return { success: "Code wurde gelöscht." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function CodesPage() {
  const { codes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Registrierungscodes</h1>
          <p className="pageSubtitle">
            Erstelle Einladungscodes für neue Caterer. Ohne Code gibt es keine Registrierung.
          </p>
        </div>
      </header>

      {actionData?.success ? (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: 16, borderRadius: 16, fontWeight: 900, marginBottom: 16 }}>
          {actionData.success}
          {actionData.code ? <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 18 }}>{actionData.code}</div> : null}
        </div>
      ) : null}

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Neuer Zugang</div>
            <h2 className="panelTitle">Code erstellen</h2>
          </div>
        </div>

        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <button className="btn btnPrimary" type="submit">Neuen Code erstellen</button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Codes</div>
            <h2 className="panelTitle">Alle Codes</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Erstellt</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={4}>Noch keine Codes erstellt.</td>
                </tr>
              ) : (
                codes.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontFamily: "monospace", fontWeight: 950 }}>{item.code}</td>
                    <td>
                      <span className={item.usedAt ? "badge badgeLocked" : "badge"}>
                        {item.usedAt ? "Benutzt" : "Offen"}
                      </span>
                    </td>
                    <td>{new Date(item.createdAt).toLocaleString("de-DE")}</td>
                    <td>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="inviteId" value={item.id} />
                        <button className="btn" type="submit" style={{ color: "#b91c1c" }}>Löschen</button>
                      </Form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SuperAdminLayout>
  );
}
