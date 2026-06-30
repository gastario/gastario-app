import { Form, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return `GASTARIO-${part()}-${part()}-${part()}`;
}

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const codes = await prisma.registrationInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { codes };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");

  if (intent === "create") {
    let code = generateInviteCode();

    for (let i = 0; i < 10; i++) {
      const existing = await prisma.registrationInvite.findUnique({
        where: { code },
      });

      if (!existing) break;
      code = generateInviteCode();
    }

    const invite = await prisma.registrationInvite.create({
      data: {
        code,
      },
    });

    return {
      success: "Registrierungscode wurde erstellt.",
      createdCode: invite.code,
    };
  }

  const inviteId = String(formData.get("inviteId") || "");

  if (!inviteId) {
    return { error: "Code fehlt." };
  }

  if (intent === "deactivate") {
    await prisma.registrationInvite.update({
      where: { id: inviteId },
      data: {
        usedAt: new Date(),
        usedBy: "deaktiviert durch Super Admin",
      },
    });

    return { success: "Code wurde deaktiviert." };
  }

  if (intent === "reopen") {
    await prisma.registrationInvite.update({
      where: { id: inviteId },
      data: {
        usedAt: null,
        usedBy: null,
      },
    });

    return { success: "Code wurde wieder geöffnet." };
  }

  if (intent === "delete") {
    await prisma.registrationInvite.delete({
      where: { id: inviteId },
    });

    return { success: "Code wurde gelöscht." };
  }

  return { error: "Unbekannte Aktion." };
}

export default function CodesPage() {
  const { codes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const openCodes = codes.filter((code) => !code.usedAt);
  const usedCodes = codes.filter((code) => code.usedAt);

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Registrierungscodes</h1>
          <p className="pageSubtitle">
            Erstelle und verwalte Einladungscodes für neue Caterer. Ohne Code kann sich kein Mandant registrieren.
          </p>
        </div>

        <div className="topActions">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <button className="btn btnPrimary" type="submit">
              Neuen Code erstellen
            </button>
          </Form>
        </div>
      </header>

      {actionData?.success ? (
        <div style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          color: "#065f46",
          padding: "14px 16px",
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.success}
          {actionData.createdCode ? (
            <div style={{
              marginTop: 8,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 18,
              fontWeight: 950
            }}>
              {actionData.createdCode}
            </div>
          ) : null}
        </div>
      ) : null}

      {actionData?.error ? (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
          padding: "14px 16px",
          borderRadius: 16,
          fontWeight: 900,
          marginBottom: 16
        }}>
          {actionData.error}
        </div>
      ) : null}

      <section className="statGrid">
        <article className="statCard">
          <div className="statLabel">Codes</div>
          <div className="statValue">{codes.length}</div>
          <div className="statHint">gesamt</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Offen</div>
          <div className="statValue">{openCodes.length}</div>
          <div className="statHint">noch nutzbar</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Benutzt / deaktiviert</div>
          <div className="statValue">{usedCodes.length}</div>
          <div className="statHint">nicht mehr nutzbar</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Registrierung</div>
          <div className="statValue" style={{ fontSize: 28 }}>Code</div>
          <div className="statHint">Pflicht für neue Mandanten</div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Einladungen</div>
            <h2 className="panelTitle">Alle Registrierungscodes</h2>
          </div>

          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <button className="btn btnPrimary" type="submit">
              Code erstellen
            </button>
          </Form>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Benutzt von</th>
                <th>Erstellt</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={5}>Noch keine Codes erstellt.</td>
                </tr>
              ) : (
                codes.map((item) => (
                  <tr key={item.id}>
                    <td style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontWeight: 950,
                      color: "#07111f"
                    }}>
                      {item.code}
                    </td>

                    <td>
                      <span className={item.usedAt ? "badge badgeLocked" : "badge"}>
                        {item.usedAt ? "Benutzt / deaktiviert" : "Offen"}
                      </span>
                    </td>

                    <td>{item.usedBy || "-"}</td>

                    <td>{new Date(item.createdAt).toLocaleString("de-DE")}</td>

                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {item.usedAt ? (
                          <Form method="post">
                            <input type="hidden" name="intent" value="reopen" />
                            <input type="hidden" name="inviteId" value={item.id} />
                            <button className="btn" type="submit">
                              Wieder öffnen
                            </button>
                          </Form>
                        ) : (
                          <Form method="post">
                            <input type="hidden" name="intent" value="deactivate" />
                            <input type="hidden" name="inviteId" value={item.id} />
                            <button className="btn" type="submit">
                              Deaktivieren
                            </button>
                          </Form>
                        )}

                        <Form method="post">
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="inviteId" value={item.id} />
                          <button className="btn" type="submit" style={{ color: "#b91c1c" }}>
                            Löschen
                          </button>
                        </Form>
                      </div>
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
