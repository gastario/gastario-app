import { requireSuperAdmin } from "../lib/session.server";
import { Form, useActionData, useLoaderData } from "react-router";
import SuperAdminLayout from "../components/SuperAdminLayout";
import { prisma } from "../lib/prisma.server";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const makePart = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return `GASTARIO-${makePart()}-${makePart()}-${makePart()}`;
}

export async function loader({ request }: { request: Request }) {
  await requireSuperAdmin(request);
  await requireSuperAdmin(request);
  const codes = await prisma.registrationInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return { codes };
}

export async function action({ request }: { request: Request }) {
  await requireSuperAdmin(request);
  const formData = await request.formData();

  const note = String(formData.get("note") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();

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
    },
  });

  return { createdCode: invite.code };
}

export default function RegistrationCodesPage() {
  const { codes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <SuperAdminLayout>
      <header className="topbar">
        <div>
          <div className="kicker">Super Admin</div>
          <h1 className="pageTitle">Registrierungscodes</h1>
          <p className="pageSubtitle">
            Erstelle einmalige Einladungscodes fÃƒÂ¼r neue Caterer. Nach erfolgreicher Registrierung wird der Code automatisch verbraucht.
          </p>
        </div>
      </header>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panelHeader">
          <div>
            <div className="panelKicker">Neuer Zugang</div>
            <h2 className="panelTitle">Einladungscode erstellen</h2>
          </div>
        </div>

        {actionData?.createdCode ? (
          <div style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            padding: "14px 16px",
            borderRadius: 16,
            fontWeight: 900,
            marginBottom: 16
          }}>
            Neuer Code: {actionData.createdCode}
          </div>
        ) : null}

        <Form method="post" style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 12,
          alignItems: "end"
        }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            Notiz
            <input
              name="note"
              placeholder="z. B. MÃƒÂ¼ller Catering"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                padding: "12px 14px"
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
            E-Mail optional
            <input
              name="email"
              type="email"
              placeholder="kunde@firma.de"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                padding: "12px 14px"
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
            <h2 className="panelTitle">Letzte Registrierungscodes</h2>
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
                <th>Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={6}>Noch keine Codes erstellt.</td>
                </tr>
              ) : (
                codes.map((item) => (
                  <tr key={item.id}>
                    <td style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontWeight: 950
                    }}>
                      {item.code}
                    </td>
                    <td>{item.note || "-"}</td>
                    <td>{item.email || "-"}</td>
                    <td>
                      {item.usedAt ? (
                        <span className="badge badgeLocked">Benutzt</span>
                      ) : (
                        <span className="badge">Offen</span>
                      )}
                    </td>
                    <td>{item.usedBy || "-"}</td>
                    <td>{new Date(item.createdAt).toLocaleString("de-DE")}</td>
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
