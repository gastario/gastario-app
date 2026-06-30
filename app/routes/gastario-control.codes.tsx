import { Form, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const makePart = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return `GASTARIO-${makePart()}-${makePart()}-${makePart()}`;
}

export async function loader() {
  const { prisma } = await import("../lib/prisma.server");

  const codes = await prisma.registrationInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return { codes };
}

export async function action({ request }: { request: Request }) {
  const { prisma } = await import("../lib/prisma.server");
  const formData = await request.formData();

  const intent = String(formData.get("intent") || "");

  if (intent === "create") {
    const note = String(formData.get("note") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const expiresInDaysRaw = String(formData.get("expiresInDays") || "").trim();

    let expiresAt: Date | null = null;

    if (expiresInDaysRaw) {
      const days = Number(expiresInDaysRaw);
      if (Number.isFinite(days) && days > 0) {
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    }

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
        note: note || null,
        email: email || null,
        expiresAt,
      },
    });

    return { success: "Registrierungscode wurde erstellt.", createdCode: invite.code };
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

function getCodeStatus(code: any) {
  if (code.usedAt) return "Benutzt";
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return "Abgelaufen";
  return "Offen";
}

function getStatusClass(status: string) {
  if (status === "Offen") return "badge";
  if (status === "Abgelaufen") return "badge badgeTrial";
  return "badge badgeLocked";
}

export default function RegistrationCodesPage() {
  const { codes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const openCount = codes.filter((code) => getCodeStatus(code) === "Offen").length;
  const usedCount = codes.filter((code) => getCodeStatus(code) === "Benutzt").length;
  const expiredCount = codes.filter((code) => getCodeStatus(code) === "Abgelaufen").length;

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Registrierungscodes</h1>
          <p className="pageSubtitle">
            Erstelle einmalige Einladungscodes für neue Caterer. Nach erfolgreicher Registrierung wird der Code automatisch verbraucht.
          </p>
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
              fontSize: 18
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
          <div className="statHint">gesamt erstellt</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Offen</div>
          <div className="statValue">{openCount}</div>
          <div className="statHint">noch nutzbar</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Benutzt</div>
          <div className="statValue">{usedCount}</div>
          <div className="statHint">registriert oder deaktiviert</div>
        </article>

        <article className="statCard">
          <div className="statLabel">Abgelaufen</div>
          <div className="statValue">{expiredCount}</div>
          <div className="statHint">nicht mehr gültig</div>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Neuer Zugang</div>
            <h2 className="panelTitle">Einladungscode erstellen</h2>
          </div>
        </div>

        <Form method="post" style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 160px auto",
          gap: 12,
          alignItems: "end"
        }}>
          <input type="hidden" name="intent" value="create" />

          <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
            Notiz
            <input
              name="note"
              placeholder="z. B. Müller Catering"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                padding: "11px 12px"
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
            E-Mail optional
            <input
              name="email"
              type="email"
              placeholder="kunde@firma.de"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                padding: "11px 12px"
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 850 }}>
            Gültig Tage
            <input
              name="expiresInDays"
              type="number"
              min="1"
              placeholder="optional"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                padding: "11px 12px"
              }}
            />
          </label>

          <button className="btn btnPrimary" type="submit">
            Code erstellen
          </button>
        </Form>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Codes</div>
            <h2 className="panelTitle">Alle Registrierungscodes</h2>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Notiz</th>
                <th>E-Mail</th>
                <th>Status</th>
                <th>Benutzt von</th>
                <th>Ablauf</th>
                <th>Erstellt</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={8}>Noch keine Codes erstellt.</td>
                </tr>
              ) : (
                codes.map((item) => {
                  const status = getCodeStatus(item);

                  return (
                    <tr key={item.id}>
                      <td style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontWeight: 950,
                        color: "#07111f"
                      }}>
                        {item.code}
                      </td>
                      <td>{item.note || "-"}</td>
                      <td>{item.email || "-"}</td>
                      <td>
                        <span className={getStatusClass(status)}>
                          {status}
                        </span>
                      </td>
                      <td>{item.usedBy || "-"}</td>
                      <td>
                        {item.expiresAt
                          ? new Date(item.expiresAt).toLocaleDateString("de-DE")
                          : "-"}
                      </td>
                      <td>{new Date(item.createdAt).toLocaleString("de-DE")}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {item.usedAt ? (
                            <Form method="post">
                              <input type="hidden" name="intent" value="reopen" />
                              <input type="hidden" name="inviteId" value={item.id} />
                              <button className="btn" type="submit">Öffnen</button>
                            </Form>
                          ) : (
                            <Form method="post">
                              <input type="hidden" name="intent" value="deactivate" />
                              <input type="hidden" name="inviteId" value={item.id} />
                              <button className="btn" type="submit">Deaktivieren</button>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </SuperAdminLayout>
  );
}
