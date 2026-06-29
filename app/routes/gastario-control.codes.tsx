import { Form, useActionData, useLoaderData } from "react-router";
import { prisma } from "../lib/prisma.server";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  let part3 = "";

  for (let i = 0; i < 4; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) part3 += chars[Math.floor(Math.random() * chars.length)];

  return `GASTARIO-${part1}-${part2}-${part3}`;
}

export async function loader() {
  const codes = await prisma.registrationInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { codes };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const note = String(formData.get("note") || "").trim();
  const email = String(formData.get("email") || "").trim();

  let code = generateInviteCode();

  for (let i = 0; i < 5; i++) {
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

export default function GastarioControlCodes() {
  const { codes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="page">
      <style>{`
        .page {
          padding: 32px;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 24px;
          max-width: 980px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        h1 {
          margin: 0 0 8px;
          font-size: 28px;
          color: #0f172a;
        }

        p {
          color: #64748b;
          margin-bottom: 24px;
        }

        form {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 12px;
          align-items: end;
          margin-bottom: 24px;
        }

        label {
          display: grid;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }

        input {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
        }

        button {
          border: none;
          background: #0f766e;
          color: white;
          border-radius: 12px;
          padding: 13px 18px;
          font-weight: 800;
          cursor: pointer;
        }

        .created {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 14px 16px;
          border-radius: 14px;
          margin-bottom: 18px;
          font-weight: 800;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }

        th {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .04em;
          color: #64748b;
        }

        .code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-weight: 900;
          color: #0f172a;
        }

        .used {
          color: #991b1b;
          font-weight: 800;
        }

        .open {
          color: #047857;
          font-weight: 800;
        }
      `}</style>

      <div className="card">
        <h1>Registrierungscodes</h1>
        <p>Erstelle Einladungscodes für neue Caterer. Jeder Code kann nur einmal benutzt werden.</p>

        {actionData?.createdCode ? (
          <div className="created">
            Neuer Code: {actionData.createdCode}
          </div>
        ) : null}

        <Form method="post">
          <label>
            Notiz
            <input name="note" placeholder="z. B. Müller Catering" />
          </label>

          <label>
            E-Mail optional
            <input name="email" placeholder="kunde@firma.de" />
          </label>

          <button type="submit">Neuen Code erstellen</button>
        </Form>

        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Notiz</th>
              <th>E-Mail</th>
              <th>Status</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((item) => (
              <tr key={item.id}>
                <td className="code">{item.code}</td>
                <td>{item.note || "-"}</td>
                <td>{item.email || "-"}</td>
                <td>
                  {item.usedAt ? (
                    <span className="used">Benutzt</span>
                  ) : (
                    <span className="open">Offen</span>
                  )}
                </td>
                <td>{new Date(item.createdAt).toLocaleString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
